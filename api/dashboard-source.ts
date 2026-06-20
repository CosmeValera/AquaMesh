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
const SEARCH_TIMEOUT_MS = 30_000;
const MAX_QUERY_CHARS = 280;
const MAX_TEXT_CHARS = 60_000;
const MIN_SOURCE_TEXT_CHARS = 80;
const MAX_SEARCH_QUERIES = 6;
const MAX_RETURNED_SOURCES = 6;
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

const buildFallbackSearchQuery = (request: DashboardSourceRequest): string => {
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

const buildSearchQueries = (request: DashboardSourceRequest): string[] => {
  const missingTerms = selectMissingTerms(request);
  const questionTerms = extractQuestionTerms(request.question);
  const focusTerms = missingTerms.length > 0 ? missingTerms : questionTerms;
  const queries: string[] = [];

  focusTerms.forEach((term) => {
    queries.push(`${formatTerm(term)} official documentation`);
    queries.push(`${formatTerm(term)} docs`);
  });

  if (focusTerms.length > 1) {
    for (let index = 0; index < focusTerms.length - 1; index += 1) {
      for (let nextIndex = index + 1; nextIndex < focusTerms.length; nextIndex += 1) {
        queries.push(
          `${formatTerm(focusTerms[index])} ${formatTerm(
            focusTerms[nextIndex],
          )} integration official docs`,
        );
      }
    }
    queries.push(`${focusTerms.map(formatTerm).join(" ")} comparison official docs`);
  }

  queries.push(buildFallbackSearchQuery(request));

  return Array.from(new Set(queries))
    .filter(Boolean)
    .slice(0, MAX_SEARCH_QUERIES);
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
  source: Pick<DashboardSource, "url">,
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

const qualityScoreSource = (
  source: DashboardSource,
  missingTerms: string[],
): number => {
  const domain = getDomain(source.url);
  const title = source.title.toLowerCase();
  const haystack = `${source.title} ${source.text}`.toLowerCase();
  const coverageScore = missingTerms.reduce(
    (score, term) => score + (haystack.includes(term) ? 10 : 0),
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

  return coverageScore + officialScore + docsScore + seoPenalty + (source.score || 0);
};

const parseTavilySources = (
  payload: unknown,
  searchQuery: string,
  missingTerms: string[] = [],
  request: DashboardSourceRequest,
): DashboardSource[] => {
  if (!isObject(payload) || !Array.isArray(payload.results)) {
    throw new Error("fetch_failed");
  }

  const readableResults = payload.results.filter(isObject);
  const titleFocusedResults = missingTerms.length
    ? readableResults.filter((result) => {
        const title = firstString(result.title).toLowerCase();
        return missingTerms.some((term) => title.includes(term));
      })
    : [];

  const sources: DashboardSource[] = [];

  for (const result of titleFocusedResults.length
    ? titleFocusedResults
    : readableResults) {
    if (!isObject(result)) {
      continue;
    }

    const url = firstString(result.url);
    const title = firstString(result.title, url);
    const text = firstString(result.raw_content, result.content).slice(
      0,
      MAX_TEXT_CHARS,
    );

    const haystack = `${title} ${text}`.toLowerCase();
    const matchesMissingTerms =
      missingTerms.length === 0 ||
      missingTerms.some((term) => haystack.includes(term));

    if (
      !url ||
      !title ||
      text.length < MIN_SOURCE_TEXT_CHARS ||
      !matchesMissingTerms
    ) {
      continue;
    }

    const source = {
      id: `web-source-${randomUUID()}`,
      url,
      title,
      text,
      searchQuery,
      ...(typeof result.score === "number" ? { score: result.score } : {}),
      ...(normalizeText(result.favicon)
        ? { favicon: normalizeText(result.favicon) }
        : {}),
      fetchedAt: Date.now(),
    };

    if (!isRejectedSource(source, request)) {
      sources.push(source);
    }
  }

  return sources;
};

const searchDashboardSource = async (
  request: DashboardSourceRequest,
): Promise<DashboardSource[]> => {
  const apiKey = getEnv("TAVILY_API_KEY");
  if (!apiKey) {
    throw new Error("missing_tavily_key");
  }

  const searchQueries = buildSearchQueries(request);
  const missingTerms = selectMissingTerms(request);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);

  try {
    const searchResults = await Promise.allSettled(
      searchQueries.map(async (searchQuery) => {
      const response = await fetch(TAVILY_SEARCH_ENDPOINT, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          query: searchQuery,
          search_depth: "basic",
          max_results: 5,
          include_raw_content: "text",
          include_answer: false,
        }),
      });
      const payload = await readResponseJson(response);

      if (!response.ok) {
        return [];
      }

        return parseTavilySources(payload, searchQuery, missingTerms, request);
      }),
    );

    if (
      controller.signal.aborted &&
      searchResults.every((result) => result.status === "rejected")
    ) {
      throw new DOMException("Search timed out.", "AbortError");
    }

    const candidates = searchResults.flatMap((result) =>
      result.status === "fulfilled" ? result.value : [],
    );
    const deduped = Array.from(
      new Map(candidates.map((source) => [normalizeUrl(source.url), source])).values(),
    )
      .sort(
        (left, right) =>
          qualityScoreSource(right, missingTerms) -
          qualityScoreSource(left, missingTerms),
      )
      .slice(0, MAX_RETURNED_SOURCES);

    if (deduped.length === 0) {
      throw new Error("unsupported_content");
    }

    return deduped;
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
