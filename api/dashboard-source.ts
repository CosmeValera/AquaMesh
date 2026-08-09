import { randomUUID } from "node:crypto";

import { applyCors, getHeader } from "./cors";
import { loadLocalApiEnv } from "./local-env";

loadLocalApiEnv();

type JsonObject = Record<string, unknown>;

interface VercelRequest {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
}

interface VercelResponse {
  setHeader(name: string, value: string): void;
  status(code: number): VercelResponse;
  json(body: DashboardSourceResponse): void;
  end(): void;
}

interface DashboardSource {
  id: string;
  url: string;
  title: string;
  text: string;
  originType?: "web" | "user-web";
  /**
   * Where `text` came from. "snippet" means page extraction failed and this
   * is the search result summary instead - enough to ground and cite an
   * answer, but far too thin to draft a Study Guide page from.
   */
  textOrigin?: "extracted" | "snippet";
  searchQuery: string;
  score?: number;
  favicon?: string;
  fetchedAt: number;
}

interface DashboardSourceResponse {
  ok: boolean;
  source?: DashboardSource;
  sources?: DashboardSource[];
  error?: {
    code:
      | "not_authenticated"
      | "invalid_request"
      | "fetch_failed"
      | "unsupported_content"
      | "server_error";
    message: string;
  };
}

interface DashboardSourceRequest {
  question: string;
  dashboardTitle: string;
  searchQuery?: string;
  sourceUrl?: string;
  contextSummary?: string;
  rejectedUrls?: string[];
  rejectedDomains?: string[];
}

const TAVILY_SEARCH_ENDPOINT = "https://api.tavily.com/search";
const TAVILY_EXTRACT_ENDPOINT = "https://api.tavily.com/extract";
const SEARCH_TIMEOUT_MS = 30_000;
const MAX_QUERY_CHARS = 280;
const MAX_TEXT_CHARS = 60_000;
const MIN_SOURCE_TEXT_CHARS = 80;
const SEARCH_CANDIDATE_COUNT = 12;
const MAX_EXTRACT_URLS = 3;
const OFFICIAL_DOMAIN_HINTS = ["docs", "developer", "learn", "help", "support"];

/**
 * Universities, government bodies and standards organisations. Independent of
 * the topic, so it is a general authority signal rather than a per-question
 * one: it is what separates chemed.chem.purdue.edu from a vendor blog when
 * both are equally on-topic by keyword.
 */
const ACADEMIC_DOMAIN_PATTERN =
  /(?:^|\.)(?:edu|gov|mil|int)$|(?:^|\.)(?:edu|gov|ac|research)\.[a-z]{2,3}$/;

/**
 * Reference works and primary scientific publishers. Deliberately short and
 * limited to sources that are authoritative across many subjects; topic
 * specific official sites are handled by domainLooksOfficialForTerm instead.
 * There is intentionally no blocklist counterpart: rewarding authority
 * generalises, while naming individual low-quality sites does not.
 */
const REFERENCE_DOMAINS = [
  "britannica.com",
  "wikipedia.org",
  "nature.com",
  "science.org",
  "sciencedirect.com",
  "springer.com",
  "jstor.org",
  "arxiv.org",
  "pubmed.ncbi.nlm.nih.gov",
  "ieee.org",
  "acm.org",
  "libretexts.org",
  "who.int",
  "oed.com",
  "merriam-webster.com",
];
const LOW_QUALITY_TITLE_PATTERNS =
  /alternative|alternatives|market share|reviews?|pricing|competitors?|software comparison/i;
const COMPARISON_CUE_PATTERN =
  /\b(?:vs\.?|versus|compare[ds]?|comparison|difference[s]?|differ|better than|instead of|alternative[s]?|which one|pros and cons)\b/i;
const NON_TEXT_SOURCE_DOMAINS = [
  "facebook.com",
  "instagram.com",
  "pinterest.com",
  "tiktok.com",
  "twitter.com",
  "x.com",
  "youtube.com",
];
const QUERY_STOPWORDS = new Set([
  "about",
  "and",
  "between",
  "compare",
  "comparison",
  "difference",
  "different",
  "does",
  "from",
  "guide",
  "into",
  "is",
  "lesson",
  "official",
  "overview",
  "or",
  "similar",
  "source",
  "study",
  "the",
  "their",
  "this",
  "tool",
  "tools",
  "use",
  "versus",
  "vs",
  "what",
  "with",
]);

interface TavilyCandidate {
  url: string;
  title: string;
  snippet: string;
  searchQuery: string;
  score?: number;
  favicon?: string;
}

interface ExtractedSourceText {
  text: string;
  title?: string;
  fetchedAt: number;
}

const searchCandidateCache = new Map<string, TavilyCandidate[]>();
const extractedUrlCache = new Map<string, ExtractedSourceText>();

const getEnv = (name: string): string => process.env[name]?.trim() || "";

const isObject = (value: unknown): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const json = (
  res: VercelResponse,
  statusCode: number,
  body: DashboardSourceResponse,
): void => {
  res.status(statusCode).json(body);
};

const errorResponse = (
  code: NonNullable<DashboardSourceResponse["error"]>["code"],
  message: string,
): DashboardSourceResponse => ({
  ok: false,
  error: { code, message },
});

const normalizeText = (value: unknown): string =>
  typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";

const normalizeRequest = (body: unknown): DashboardSourceRequest | null => {
  if (typeof body === "string") {
    try {
      return normalizeRequest(JSON.parse(body) as unknown);
    } catch {
      return null;
    }
  }

  if (!isObject(body)) {
    return null;
  }

  const question = normalizeText(body.question);
  const dashboardTitle = normalizeText(body.dashboardTitle);
  const searchQuery = normalizeText(body.searchQuery);
  const sourceUrl = normalizeText(body.sourceUrl || body.url);
  const contextSummary = normalizeText(body.contextSummary);
  const rejectedUrls = Array.isArray(body.rejectedUrls)
    ? body.rejectedUrls.map(normalizeText).filter(Boolean)
    : [];
  const rejectedDomains = Array.isArray(body.rejectedDomains)
    ? body.rejectedDomains.map(normalizeText).filter(Boolean)
    : [];

  if ((!question && !sourceUrl) || !dashboardTitle) {
    return null;
  }

  return {
    question: question || sourceUrl,
    dashboardTitle,
    ...(searchQuery ? { searchQuery } : {}),
    ...(sourceUrl ? { sourceUrl } : {}),
    ...(contextSummary ? { contextSummary } : {}),
    ...(rejectedUrls.length ? { rejectedUrls } : {}),
    ...(rejectedDomains.length ? { rejectedDomains } : {}),
  };
};

const readRequest = (req: VercelRequest): DashboardSourceRequest | null => {
  try {
    return normalizeRequest(req.body);
  } catch {
    return null;
  }
};

const normalizeSupabaseUrl = (url: string): string => url.replace(/\/+$/, "");

const readResponseJson = async (response: Response): Promise<unknown> => {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
};

const getBearerToken = (req: VercelRequest): string => {
  const authorization = getHeader(req.headers, "authorization");
  const match = authorization.match(/^Bearer\s+(.+)$/i);

  return match?.[1]?.trim() || "";
};

const verifyUser = async (accessToken: string): Promise<void> => {
  const supabaseUrl = normalizeSupabaseUrl(getEnv("SUPABASE_URL"));
  const anonKey = getEnv("SUPABASE_ANON_KEY");

  if (!supabaseUrl || !anonKey) {
    throw new Error("not_configured");
  }

  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    method: "GET",
    headers: {
      apikey: anonKey,
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
  });
  const payload = await readResponseJson(response);

  if (!response.ok || !isObject(payload) || typeof payload.id !== "string") {
    throw new Error("not_authenticated");
  }
};

const requireAuthInProduction = async (req: VercelRequest): Promise<void> => {
  if (getEnv("NODE_ENV") !== "production") {
    return;
  }

  const accessToken = getBearerToken(req);
  if (!accessToken) {
    throw new Error("not_authenticated");
  }

  await verifyUser(accessToken);
};

const extractQuestionTerms = (value: string): string[] => {
  const matches = value.match(/[a-z0-9][a-z0-9.+#-]*/gi) || [];
  const terms = matches
    .map((term) => term.toLowerCase())
    .filter((term) => term.length > 1 && !QUERY_STOPWORDS.has(term));

  return Array.from(new Set(terms));
};

const selectMissingTerms = ({
  question,
  contextSummary,
}: DashboardSourceRequest): string[] => {
  const context = (contextSummary || "").toLowerCase();

  return extractQuestionTerms(question)
    .filter((term) => !context.includes(term))
    .slice(0, 4);
};

const formatTerm = (term: string): string =>
  term.length <= 4 ? term : `${term[0].toUpperCase()}${term.slice(1)}`;

/**
 * The contiguous thing a definition question is about, e.g. "modus tollens"
 * from "what is modus tollens". Scoring individual terms cannot tell "Modus
 * tollens" from "Modus ponendo tollens" - both contain `modus` and `tollens`,
 * but they are different inference rules, and the second one is the wrong
 * answer. Word order is the only thing that separates them.
 *
 * Returns "" for anything that is not a definition question. Falling back to
 * the whole question was actively harmful: for "why did the Berlin Wall fall
 * in 1989" it handed the bonus to a blog whose title restated the question
 * verbatim, over the Imperial War Museum. Mirroring the question back is what
 * SEO pages are built to do, so it is close to an anti-signal.
 */
const getFocusPhrase = (question: string): string => {
  const normalized = question
    .toLowerCase()
    .replace(/[^a-z0-9\s.+#-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const match = normalized.match(
    /^(?:what\s+(?:is|are|was|were)|who\s+(?:is|was)|define|explain)\s+(?:the\s+|a\s+|an\s+)?(.+)$/,
  );

  return match ? match[1].trim() : "";
};

const normalizeForPhraseMatch = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s.+#-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const getDefinitionFocusTerms = (question: string): string[] | null => {
  const normalized = question.toLowerCase().replace(/\s+/g, " ").trim();
  const match = normalized.match(
    /^(?:what\s+(?:is|are)|define|explain)\s+(.+?)(?:\?|$)/i,
  );
  if (!match) {
    return null;
  }

  const focusTerms = extractQuestionTerms(match[1]);
  return focusTerms.length > 0 ? focusTerms.slice(0, 3) : null;
};

const buildFallbackSearchQuery = (request: DashboardSourceRequest): string => {
  if (request.searchQuery) {
    return request.searchQuery.length > MAX_QUERY_CHARS
      ? request.searchQuery.slice(0, MAX_QUERY_CHARS).trim()
      : request.searchQuery;
  }

  const definitionFocusTerms = getDefinitionFocusTerms(request.question);
  if (definitionFocusTerms) {
    const query = `What is ${definitionFocusTerms
      .map(formatTerm)
      .join(" ")} official overview`;
    return query.length > MAX_QUERY_CHARS
      ? query.slice(0, MAX_QUERY_CHARS).trim()
      : query;
  }

  // missingTerms are extracted from the question, so repeating them in front
  // of it only duplicated words the query already had: "why did the Berlin
  // Wall fall in 1989" went out as "why did Berlin wall why did the Berlin
  // Wall fall in 1989 Cold War Europe". Only terms the question does not
  // already spell out are worth prepending.
  const questionText = request.question.toLowerCase();
  const missingTerms = selectMissingTerms(request)
    .filter((term) => !questionText.includes(term))
    .map(formatTerm);
  // "comparison" used to be appended to every non-definition question. On a
  // question that is not comparing anything it changes what the search engine
  // looks for: "current CDC guidance on when to see a doctor for a fever"
  // became a request for a fever comparison article and returned COVID
  // infection-control pages instead of the guidance asked for. Only add it
  // when the student is actually asking to compare things.
  const wantsComparison = COMPARISON_CUE_PATTERN.test(request.question);
  // The dashboard title is disambiguation for a question too short to stand on
  // its own. Appended to a already-specific question it just adds off-topic
  // words: "how does CRISPR Cas9 edit genes" plus "Molecular biology" returned
  // pages that matched the phrase "molecular biology" - a Stack Exchange
  // thread and a paper on poplar drought resistance - instead of how Cas9
  // works.
  const questionIsSpecific = extractQuestionTerms(request.question).length >= 4;
  const query = [
    missingTerms.length > 0 ? missingTerms.join(" ") : "",
    request.question,
    wantsComparison ? "comparison" : "",
    questionIsSpecific ? "" : request.dashboardTitle,
  ]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  return query.length > MAX_QUERY_CHARS
    ? query.slice(0, MAX_QUERY_CHARS).trim()
    : query;
};

const firstString = (...values: unknown[]): string => {
  for (const value of values) {
    const text = normalizeText(value);
    if (text) {
      return text;
    }
  }

  return "";
};

const getDomain = (value: string): string => {
  try {
    return new URL(value).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
};

// A dedupe/cache key, not a displayable URL: scheme and "www." are dropped so
// Tavily returning both an http and https (or www/non-www) copy of the same
// page collapses to one candidate instead of spending two of the three
// extract slots on a literal duplicate.
const normalizeUrl = (value: string): string => {
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    return `${host}${url.pathname}${url.search}`.toLowerCase();
  } catch {
    return value.trim().toLowerCase();
  }
};

const assertReadableHttpUrl = (value: string): string => {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("unsupported_content");
    }
    url.hash = "";
    return url.toString();
  } catch {
    throw new Error("unsupported_content");
  }
};

const compactTerm = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9]/g, "");

// True only when the domain is plausibly the home of *this* term, e.g.
// "docker" -> docs.docker.com, "kubernetes" -> kubernetes.io.
//
// This used to also return true for any domain carrying a docs/developer/
// help/support label, a clause that ignored `term` entirely. That made every
// such domain "official" for every question: asking what Docker is scored
// developer.apple.com exactly as official as docs.docker.com, so a big
// domain-trust bonus landed on a site with nothing to do with the topic.
// Generic doc-shaped domains are still rewarded, separately and much more
// weakly, by docsScore in qualityScoreCandidate.
//
// The 3-char floor keeps short terms from matching by accident: at 2 chars,
// "go" would make google.com look like Go's official site.
const domainLooksOfficialForTerm = (domain: string, term: string): boolean => {
  const compact = compactTerm(term);
  if (!compact || compact.length < 3) {
    return false;
  }

  return compactTerm(domain).includes(compact);
};

const isRejectedSource = (
  source: Pick<DashboardSource | TavilyCandidate, "url">,
  request: DashboardSourceRequest,
): boolean => {
  const normalizedUrl = normalizeUrl(source.url);
  const domain = getDomain(source.url);
  const rejectedUrls = (request.rejectedUrls || []).map(normalizeUrl);
  const rejectedDomains = (request.rejectedDomains || []).map((item) =>
    item.toLowerCase().replace(/^www\./, ""),
  );

  return (
    NON_TEXT_SOURCE_DOMAINS.some(
      (blocked) => domain === blocked || domain.endsWith(`.${blocked}`),
    ) ||
    rejectedUrls.includes(normalizedUrl) ||
    rejectedDomains.some(
      (rejected) => domain === rejected || domain.endsWith(`.${rejected}`),
    )
  );
};

const extractedTextCoversQuestion = (
  text: string,
  questionTerms: string[],
): boolean => {
  if (questionTerms.length === 0) {
    return true;
  }

  const normalizedText = text.toLowerCase();
  const coveredTerms = questionTerms.filter((term) =>
    normalizedText.includes(term),
  );
  return coveredTerms.length >= Math.min(2, questionTerms.length);
};

// missingTerms deliberately excludes terms the dashboard already covers, so
// that e.g. "compare n8n and Rundeck to Ansible and Terraform" on an n8n
// dashboard ranks Ansible/Terraform coverage above more n8n/Rundeck content -
// the student asked about the new tools, not a rehash of what is already on
// the dashboard. Keep that scoping; do not widen it to every question term.
const qualityScoreCandidate = (
  source: TavilyCandidate,
  missingTerms: string[],
  question: string,
): number => {
  const domain = getDomain(source.url);
  const title = source.title.toLowerCase();
  const haystack = `${source.title} ${source.snippet}`.toLowerCase();
  const coverageScore = missingTerms.reduce(
    (score, term) => score + (haystack.includes(term) ? 20 : 0),
    0,
  );
  const titleScore = missingTerms.reduce(
    (score, term) => score + (title.includes(term) ? 15 : 0),
    0,
  );
  // Lowered from 90/25: at the old weight, any single matching official/docs
  // domain outscored every plausible topical-coverage total on its own, so a
  // domain-trust match could bury a strongly on-topic candidate elsewhere in
  // the ranked list. It is still a meaningful bonus (roughly 1.5-2 matched
  // terms' worth), just no longer an automatic override.
  //
  // Checked against every question term, not only the missing ones: the
  // official site for a topic is often named after a thing the dashboard
  // already covers. On a Docker dashboard "docker" is not a missing term, yet
  // docs.docker.com is still the site that should win a Docker question.
  const officialTerms = extractQuestionTerms(question);
  const officialScore = officialTerms.some((term) =>
    domainLooksOfficialForTerm(domain, term),
  )
    ? 50
    : 0;
  // A general, topic-independent authority signal. Without it a university or
  // government page carries no more weight than a vendor blog, so
  // chemed.chem.purdue.edu lost to a paywalled aggregator and a Caltech
  // explainer ranked below a quantum-computing vendor's marketing blog. Sized
  // below officialScore so a topic's own official site still outranks a
  // merely reputable third party writing about it.
  const authorityScore =
    ACADEMIC_DOMAIN_PATTERN.test(domain) ||
    REFERENCE_DOMAINS.some(
      (reference) => domain === reference || domain.endsWith(`.${reference}`),
    )
      ? 30
      : 0;
  // Word order. Individual-term scoring rates "Modus ponendo tollens" exactly
  // as highly as "Modus tollens" for a modus tollens question - both contain
  // both terms - so a page about a different inference rule can win. Requiring
  // the phrase contiguously separates them.
  const focusPhrase = getFocusPhrase(question);
  const phraseScore =
    focusPhrase.includes(" ") &&
    normalizeForPhraseMatch(source.title).includes(focusPhrase)
      ? 35
      : 0;
  // Gated on already having *some* topical match: a "docs."/"developer."/
  // "help." subdomain is rewarded purely by shape, with no check that the
  // site itself is about the topic. Ungated, developer.apple.com scored the
  // same docs bonus as docs.docker.com for a Docker question, purely because
  // both subdomains say "developer". Requiring coverage/title/official
  // relevance first means the bonus only sweetens a candidate already shown
  // to be on-topic - it cannot manufacture relevance out of a domain label.
  const hasTopicalMatch =
    coverageScore > 0 || titleScore > 0 || officialScore > 0 || phraseScore > 0;
  const docsScore =
    hasTopicalMatch &&
    OFFICIAL_DOMAIN_HINTS.some((hint) => domain.split(".").includes(hint))
      ? 15
      : 0;
  // The penalty exists to bury SEO listicles that hijack a plain factual
  // question. But when the student is actually asking about pricing, reviews,
  // or alternatives, the pages that answer them legitimately carry exactly
  // these words in their titles - penalising those buries every correct
  // result. Only treat the words as spam when the question did not ask for
  // them.
  const questionWantsTheseTerms = LOW_QUALITY_TITLE_PATTERNS.test(question);
  const seoPenalty =
    !questionWantsTheseTerms && LOW_QUALITY_TITLE_PATTERNS.test(title)
      ? -80
      : 0;
  // Tavily's own relevance score (0..1) reflects real semantic fit to the
  // query, but at weight 1 it could barely nudge anything - a fraction of a
  // point next to 15-20 point term bonuses. Weighted up, it becomes a real
  // tiebreaker between candidates that score identically on the keyword
  // heuristics above (e.g. three same-domain pages that all match the same
  // missing terms), instead of leaving those ties to array order.
  const relevanceScore = (source.score || 0) * 20;

  return (
    coverageScore +
    titleScore +
    officialScore +
    authorityScore +
    phraseScore +
    docsScore +
    seoPenalty +
    relevanceScore
  );
};

const parseTavilyCandidates = (
  payload: unknown,
  searchQuery: string,
  request: DashboardSourceRequest,
): TavilyCandidate[] => {
  if (!isObject(payload) || !Array.isArray(payload.results)) {
    throw new Error("fetch_failed");
  }

  const sources: TavilyCandidate[] = [];

  for (const result of payload.results.filter(isObject)) {
    if (!isObject(result)) {
      continue;
    }

    const url = firstString(result.url);
    const title = firstString(result.title, url);
    const snippet = firstString(
      result.content,
      result.snippet,
      result.description,
    );

    if (!url || !title) {
      continue;
    }

    const source = {
      url,
      title,
      snippet,
      searchQuery,
      ...(typeof result.score === "number" ? { score: result.score } : {}),
      ...(normalizeText(result.favicon)
        ? { favicon: normalizeText(result.favicon) }
        : {}),
    };

    if (!isRejectedSource(source, request)) {
      sources.push(source);
    }
  }

  return sources;
};

// 429 is deliberately absent. A rate limit is not transient the way a 502 is:
// retrying 400ms later almost always returns 429 again, and it spends a
// second call against the Tavily quota to learn nothing.
const RETRYABLE_STATUS_CODES = new Set([500, 502, 503, 504]);
const RETRY_BACKOFF_MS = 400;

// A single transient 5xx or network blip from Tavily should not surface as
// "web search failed" to the student. One retry after a short backoff
// catches that without meaningfully slowing down the common success path.
const fetchWithRetry = async (
  url: string,
  init: RequestInit,
): Promise<Response> => {
  try {
    const response = await fetch(url, init);
    if (!RETRYABLE_STATUS_CODES.has(response.status)) {
      return response;
    }
    if (init.signal?.aborted) {
      return response;
    }
  } catch (error) {
    if (init.signal?.aborted) {
      throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, RETRY_BACKOFF_MS));
    return fetch(url, init);
  }

  await new Promise((resolve) => setTimeout(resolve, RETRY_BACKOFF_MS));
  return fetch(url, init);
};

const searchCacheKey = (
  searchQuery: string,
  request: DashboardSourceRequest,
): string => {
  const rejectedDomains = (request.rejectedDomains || [])
    .map((domain) => domain.toLowerCase().replace(/^www\./, ""))
    .sort()
    .join(",");

  return `${searchQuery.toLowerCase()}|blocked:${rejectedDomains}`;
};

const readSearchCandidates = async (
  request: DashboardSourceRequest,
  apiKey: string,
  signal: AbortSignal,
): Promise<{ searchQuery: string; candidates: TavilyCandidate[] }> => {
  const searchQuery = buildFallbackSearchQuery(request);
  const cacheKey = searchCacheKey(searchQuery, request);
  const cached = searchCandidateCache.get(cacheKey);
  if (cached) {
    return { searchQuery, candidates: cached };
  }

  const rejectedDomains = (request.rejectedDomains || [])
    .map((item) => item.toLowerCase().replace(/^www\./, ""))
    .filter(Boolean);
  const response = await fetchWithRetry(TAVILY_SEARCH_ENDPOINT, {
    method: "POST",
    signal,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      query: searchQuery,
      search_depth: "basic",
      max_results: SEARCH_CANDIDATE_COUNT,
      include_raw_content: false,
      include_answer: false,
      include_favicon: true,
      ...(rejectedDomains.length ? { exclude_domains: rejectedDomains } : {}),
    }),
  });
  const payload = await readResponseJson(response);

  if (!response.ok) {
    throw new Error("fetch_failed");
  }

  const candidates = parseTavilyCandidates(payload, searchQuery, request);
  searchCandidateCache.set(cacheKey, candidates);

  return { searchQuery, candidates };
};

const parseExtractedTextByUrl = (
  payload: unknown,
): Map<string, ExtractedSourceText> => {
  if (!isObject(payload) || !Array.isArray(payload.results)) {
    throw new Error("fetch_failed");
  }

  const extracted = new Map<string, ExtractedSourceText>();
  for (const result of payload.results.filter(isObject)) {
    const url = firstString(result.url);
    const text = firstString(
      result.raw_content,
      result.content,
      result.text,
    ).slice(0, MAX_TEXT_CHARS);

    if (!url || text.length < MIN_SOURCE_TEXT_CHARS) {
      continue;
    }

    extracted.set(normalizeUrl(url), {
      text,
      title: firstString(result.title),
      fetchedAt: Date.now(),
    });
  }

  return extracted;
};

const extractSelectedCandidates = async (
  candidates: TavilyCandidate[],
  apiKey: string,
  signal: AbortSignal,
): Promise<Map<string, ExtractedSourceText>> => {
  const extracted = new Map<string, ExtractedSourceText>();
  const urlsToExtract: string[] = [];

  candidates.forEach((candidate) => {
    const normalizedUrl = normalizeUrl(candidate.url);
    const cached = extractedUrlCache.get(normalizedUrl);
    if (cached) {
      extracted.set(normalizedUrl, cached);
      return;
    }

    urlsToExtract.push(candidate.url);
  });

  if (urlsToExtract.length === 0) {
    return extracted;
  }

  const response = await fetchWithRetry(TAVILY_EXTRACT_ENDPOINT, {
    method: "POST",
    signal,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      urls: urlsToExtract.slice(0, MAX_EXTRACT_URLS),
      extract_depth: "basic",
    }),
  });
  const payload = await readResponseJson(response);

  if (!response.ok) {
    throw new Error("fetch_failed");
  }

  const extractedFromResponse = parseExtractedTextByUrl(payload);
  extractedFromResponse.forEach((value, normalizedUrl) => {
    extractedUrlCache.set(normalizedUrl, value);
    extracted.set(normalizedUrl, value);
  });

  return extracted;
};

// Twice MIN_SOURCE_TEXT_CHARS. A search snippet is lower-signal than an
// extracted page, so it has to carry more than the bare minimum before it is
// worth citing - but the bar stays low enough that an ordinary Tavily
// snippet (a couple of sentences of prose) still qualifies.
const MIN_SNIPPET_FALLBACK_CHARS = MIN_SOURCE_TEXT_CHARS * 2;
// Two batches of MAX_EXTRACT_URLS (6 of the up to 12 ranked candidates)
// before giving up. Bounded so a bad question does not chain through every
// candidate Tavily returned.
const MAX_EXTRACT_BATCHES = 2;
const MAX_SOURCES_PER_DOMAIN = 2;

/**
 * Pushes a domain's third and later pages behind everything else, so one site
 * cannot take every slot. Wikipedia supplied two near-identical pages for the
 * same chord and used two of the three slots on them; three answers from one
 * site also give the model nothing to cross-check. Demoted rather than
 * dropped, so they are still available when nothing else extracts.
 */
const demoteRepeatedDomains = (
  candidates: TavilyCandidate[],
): TavilyCandidate[] => {
  const seenPerDomain = new Map<string, number>();
  const kept: TavilyCandidate[] = [];
  const overflow: TavilyCandidate[] = [];

  candidates.forEach((candidate) => {
    const domain = getDomain(candidate.url);
    const seen = seenPerDomain.get(domain) || 0;
    seenPerDomain.set(domain, seen + 1);
    (seen < MAX_SOURCES_PER_DOMAIN ? kept : overflow).push(candidate);
  });

  return [...kept, ...overflow];
};

// Extraction can legitimately fail for a candidate (paywall, JS-only page,
// a transient block) even though Tavily's own search snippet already
// answers the question well enough to cite. Falling back to the snippet
// beats discarding a relevant, already-ranked candidate outright.
const buildSourceFromCandidate = (
  candidate: TavilyCandidate,
  extracted: ExtractedSourceText | undefined,
  questionTerms: string[],
): DashboardSource | null => {
  const usesExtractedText =
    Boolean(extracted) &&
    extractedTextCoversQuestion(
      `${candidate.title} ${candidate.snippet} ${extracted!.text}`,
      questionTerms,
    );
  const usesSnippetFallback =
    !usesExtractedText &&
    candidate.snippet.length >= MIN_SNIPPET_FALLBACK_CHARS &&
    extractedTextCoversQuestion(
      `${candidate.title} ${candidate.snippet}`,
      questionTerms,
    );

  if (!usesExtractedText && !usesSnippetFallback) {
    return null;
  }

  return {
    id: `web-source-${randomUUID()}`,
    url: candidate.url,
    title: (usesExtractedText && extracted!.title) || candidate.title,
    text: usesExtractedText ? extracted!.text : candidate.snippet,
    textOrigin: usesExtractedText ? "extracted" : "snippet",
    searchQuery: candidate.searchQuery,
    ...(typeof candidate.score === "number" ? { score: candidate.score } : {}),
    ...(candidate.favicon ? { favicon: candidate.favicon } : {}),
    fetchedAt: usesExtractedText ? extracted!.fetchedAt : Date.now(),
  };
};

const searchDashboardSource = async (
  request: DashboardSourceRequest,
): Promise<DashboardSource[]> => {
  const apiKey = getEnv("TAVILY_API_KEY");
  if (!apiKey) {
    throw new Error("missing_tavily_key");
  }

  const missingTerms = selectMissingTerms(request);
  const questionTerms = extractQuestionTerms(
    request.searchQuery || request.question,
  ).slice(0, 8);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);

  try {
    const { candidates } = await readSearchCandidates(
      request,
      apiKey,
      controller.signal,
    );
    const rankedCandidates = demoteRepeatedDomains(
      Array.from(
        new Map(
          Array.from(
            new Map(
              candidates
                .filter((candidate) => !isRejectedSource(candidate, request))
                .map((candidate) => [normalizeUrl(candidate.url), candidate]),
            ).values(),
          )
            // Same site, same headline: a redirect or alias of one article, not
            // a second source. Wikipedia returned two URLs both titled
            // "Neapolitan chord" and they took two of the three slots between
            // them, so the model got one article twice instead of two views on
            // the topic.
            .map((candidate) => [
              `${getDomain(candidate.url)}|${normalizeForPhraseMatch(candidate.title)}`,
              candidate,
            ]),
        ).values(),
      ).sort(
        (left, right) =>
          qualityScoreCandidate(right, missingTerms, request.question) -
          qualityScoreCandidate(left, missingTerms, request.question),
      ),
    );

    if (rankedCandidates.length === 0) {
      throw new Error("unsupported_content");
    }

    // A batch can fail extraction entirely while candidates just past it
    // would have worked fine. Try the next ranked batch once before failing
    // instead of discarding the rest of what Tavily already found.
    for (
      let batchIndex = 0;
      batchIndex < MAX_EXTRACT_BATCHES;
      batchIndex += 1
    ) {
      const batch = rankedCandidates.slice(
        batchIndex * MAX_EXTRACT_URLS,
        (batchIndex + 1) * MAX_EXTRACT_URLS,
      );
      if (batch.length === 0) {
        break;
      }

      const extractedByUrl = await extractSelectedCandidates(
        batch,
        apiKey,
        controller.signal,
      );
      const sources = batch
        .map((candidate) =>
          buildSourceFromCandidate(
            candidate,
            extractedByUrl.get(normalizeUrl(candidate.url)),
            questionTerms,
          ),
        )
        .filter((source): source is DashboardSource => source !== null);

      if (sources.length > 0) {
        return sources;
      }
    }

    throw new Error("unsupported_content");
  } finally {
    clearTimeout(timeout);
  }
};

const extractDashboardSourceUrl = async (
  request: DashboardSourceRequest,
): Promise<DashboardSource[]> => {
  const apiKey = getEnv("TAVILY_API_KEY");
  if (!apiKey) {
    throw new Error("missing_tavily_key");
  }
  if (!request.sourceUrl) {
    throw new Error("unsupported_content");
  }

  const sourceUrl = assertReadableHttpUrl(request.sourceUrl);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);

  try {
    const extractedByUrl = await extractSelectedCandidates(
      [
        {
          url: sourceUrl,
          title: sourceUrl,
          snippet: "",
          searchQuery: sourceUrl,
        },
      ],
      apiKey,
      controller.signal,
    );
    const extracted = extractedByUrl.get(normalizeUrl(sourceUrl));
    if (!extracted) {
      throw new Error("unsupported_content");
    }

    return [
      {
        id: `user-web-source-${randomUUID()}`,
        url: sourceUrl,
        title: extracted.title || sourceUrl,
        text: extracted.text,
        originType: "user-web",
        searchQuery: sourceUrl,
        fetchedAt: extracted.fetchedAt,
      },
    ];
  } finally {
    clearTimeout(timeout);
  }
};

const mapError = (
  error: unknown,
): { statusCode: number; response: DashboardSourceResponse } => {
  if (error instanceof Error) {
    if (error.message === "not_authenticated") {
      return {
        statusCode: 401,
        response: errorResponse(
          "not_authenticated",
          "Sign in to search for web sources.",
        ),
      };
    }

    if (error.message === "missing_tavily_key") {
      return {
        statusCode: 500,
        response: errorResponse(
          "server_error",
          "Web search is not configured.",
        ),
      };
    }

    if (error.message === "unsupported_content") {
      return {
        statusCode: 415,
        response: errorResponse(
          "unsupported_content",
          "Web search did not find a readable source.",
        ),
      };
    }

    if (error.message === "fetch_failed") {
      return {
        statusCode: 502,
        response: errorResponse("fetch_failed", "Web search failed."),
      };
    }

    if (error.name === "AbortError") {
      return {
        statusCode: 504,
        response: errorResponse("fetch_failed", "Web search timed out."),
      };
    }
  }

  return {
    statusCode: 500,
    response: errorResponse("server_error", "Could not search web sources."),
  };
};

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  const cors = applyCors(req, res);
  if (!cors.allowed) {
    json(res, 403, errorResponse("invalid_request", "Origin is not allowed."));
    return;
  }

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    json(
      res,
      405,
      errorResponse("invalid_request", "Use POST to search for sources."),
    );
    return;
  }

  const request = readRequest(req);

  if (!request) {
    json(
      res,
      400,
      errorResponse(
        "invalid_request",
        "Question and dashboard title are required.",
      ),
    );
    return;
  }

  try {
    await requireAuthInProduction(req);
    const sources = request.sourceUrl
      ? await extractDashboardSourceUrl(request)
      : await searchDashboardSource(request);
    json(res, 200, { ok: true, source: sources[0], sources });
  } catch (error) {
    const mapped = mapError(error);
    json(res, mapped.statusCode, mapped.response);
  }
}
