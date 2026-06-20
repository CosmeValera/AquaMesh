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
const LOW_QUALITY_TITLE_PATTERNS =
  /alternative|alternatives|market share|reviews?|pricing|competitors?|software comparison|top \d+/i;
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
  "lesson",
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
  const contextSummary = normalizeText(body.contextSummary);
  const rejectedUrls = Array.isArray(body.rejectedUrls)
    ? body.rejectedUrls.map(normalizeText).filter(Boolean)
    : [];
  const rejectedDomains = Array.isArray(body.rejectedDomains)
    ? body.rejectedDomains.map(normalizeText).filter(Boolean)
    : [];

  if (!question || !dashboardTitle) {
    return null;
  }

  return {
    question,
    dashboardTitle,
    ...(contextSummary ? { contextSummary } : {}),
    ...(rejectedUrls.length ? { rejectedUrls } : {}),
    ...(rejectedDomains.length ? { rejectedDomains } : {}),
  };
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
  const definitionFocusTerms = getDefinitionFocusTerms(request.question);
  if (definitionFocusTerms) {
    const query = `What is ${definitionFocusTerms
      .map(formatTerm)
      .join(" ")} official overview`;
    return query.length > MAX_QUERY_CHARS
      ? query.slice(0, MAX_QUERY_CHARS).trim()
      : query;
  }

  const missingTerms = selectMissingTerms(request).map(formatTerm);
  const query = [
    missingTerms.length > 0 ? `${missingTerms.join(" ")} comparison` : "",
    request.question,
    request.dashboardTitle,
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

const normalizeUrl = (value: string): string => {
  try {
    const url = new URL(value);
    url.hash = "";
    return url.toString().toLowerCase();
  } catch {
    return value.trim().toLowerCase();
  }
};

const compactTerm = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9]/g, "");

const domainLooksOfficialForTerm = (domain: string, term: string): boolean => {
  const compactDomain = compactTerm(domain);
  const compact = compactTerm(term);
  if (!compact || compact.length < 2) {
    return false;
  }

  return (
    compactDomain.includes(compact) ||
    OFFICIAL_DOMAIN_HINTS.some((hint) => domain.split(".").includes(hint))
  );
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
    rejectedUrls.includes(normalizedUrl) ||
    rejectedDomains.some(
      (rejected) => domain === rejected || domain.endsWith(`.${rejected}`),
    )
  );
};

const qualityScoreCandidate = (
  source: TavilyCandidate,
  missingTerms: string[],
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
  const officialScore = missingTerms.some((term) =>
    domainLooksOfficialForTerm(domain, term),
  )
    ? 90
    : 0;
  const docsScore = OFFICIAL_DOMAIN_HINTS.some((hint) =>
    domain.split(".").includes(hint),
  )
    ? 25
    : 0;
  const seoPenalty = LOW_QUALITY_TITLE_PATTERNS.test(title) ? -80 : 0;

  return (
    coverageScore +
    titleScore +
    officialScore +
    docsScore +
    seoPenalty +
    (source.score || 0)
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
    const snippet = firstString(result.content, result.snippet, result.description);

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
  const response = await fetch(TAVILY_SEARCH_ENDPOINT, {
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
    const text = firstString(result.raw_content, result.content, result.text).slice(
      0,
      MAX_TEXT_CHARS,
    );

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

  const response = await fetch(TAVILY_EXTRACT_ENDPOINT, {
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

const searchDashboardSource = async (
  request: DashboardSourceRequest,
): Promise<DashboardSource[]> => {
  const apiKey = getEnv("TAVILY_API_KEY");
  if (!apiKey) {
    throw new Error("missing_tavily_key");
  }

  const missingTerms = selectMissingTerms(request);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);

  try {
    const { candidates } = await readSearchCandidates(
      request,
      apiKey,
      controller.signal,
    );
    const selectedCandidates = Array.from(
      new Map(
        candidates
          .filter((candidate) => !isRejectedSource(candidate, request))
          .map((candidate) => [normalizeUrl(candidate.url), candidate]),
      ).values(),
    )
      .sort(
        (left, right) =>
          qualityScoreCandidate(right, missingTerms) -
          qualityScoreCandidate(left, missingTerms),
      )
      .slice(0, MAX_EXTRACT_URLS);

    if (selectedCandidates.length === 0) {
      throw new Error("unsupported_content");
    }

    const extractedByUrl = await extractSelectedCandidates(
      selectedCandidates,
      apiKey,
      controller.signal,
    );
    const sources = selectedCandidates
      .map((candidate): DashboardSource | null => {
        const extracted = extractedByUrl.get(normalizeUrl(candidate.url));
        if (!extracted) {
          return null;
        }

        return {
          id: `web-source-${randomUUID()}`,
          url: candidate.url,
          title: extracted.title || candidate.title,
          text: extracted.text,
          searchQuery: candidate.searchQuery,
          ...(typeof candidate.score === "number"
            ? { score: candidate.score }
            : {}),
          ...(candidate.favicon ? { favicon: candidate.favicon } : {}),
          fetchedAt: extracted.fetchedAt,
        };
      })
      .filter((source): source is DashboardSource => source !== null);

    if (sources.length === 0) {
      throw new Error("unsupported_content");
    }

    return sources;
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

  try {
    await requireAuthInProduction(req);
    const request = normalizeRequest(req.body);

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

    const sources = await searchDashboardSource(request);
    json(res, 200, { ok: true, source: sources[0], sources });
  } catch (error) {
    const mapped = mapError(error);
    json(res, mapped.statusCode, mapped.response);
  }
}
