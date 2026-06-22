import { randomUUID } from "node:crypto";

import { applyCors, getHeader } from "./cors";
import { loadLocalApiEnv } from "./local-env";
import type {
  HostedAiGatewayPart,
  HostedAiGatewayRequest,
  HostedAiGatewayResponse,
  HostedAiStatus,
  HostedAiSurface,
} from "../apps/studymesh/src/quickCreate/ai/hostedCredits";

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
  json(body: HostedAiGatewayResponse): void;
  end(): void;
}

interface SupabaseUser {
  id: string;
}

interface HostedAiUsageStart {
  status?: unknown;
  usageId?: string;
  usage_id?: string;
  event_id?: string;
}

type HostedAiUsageRequest = HostedAiGatewayRequest & {
  requestId: string;
};

interface CerebrasChatCompletion {
  choices?: Array<{
    message?: {
      content?: string | Array<{ text?: string; type?: string }>;
    };
    text?: string;
  }>;
  error?: {
    code?: string;
    message?: string;
    type?: string;
  };
}

const HOSTED_AI_CREDIT_COSTS: Record<HostedAiSurface, number> = {
  "study-guide": 2,
  "quick-create": 1,
  chat: 1,
};

const HOSTED_AI_INITIAL_FREE_CREDITS = 20;
const HOSTED_AI_DAILY_FREE_CREDITS = 5;
export const DEFAULT_CEREBRAS_MODEL = "gpt-oss-120b";
const MAX_TEXT_CHARS = 120_000;
const CEREBRAS_CHAT_COMPLETIONS_URL =
  "https://api.cerebras.ai/v1/chat/completions";

const VALID_SURFACES = new Set<HostedAiSurface>([
  "study-guide",
  "quick-create",
  "chat",
]);

const getEnv = (name: string): string => process.env[name]?.trim() || "";

export const getHostedCerebrasModel = (): string =>
  getEnv("HOSTED_CEREBRAS_MODEL") || DEFAULT_CEREBRAS_MODEL;

const json = (
  res: VercelResponse,
  statusCode: number,
  body: HostedAiGatewayResponse,
): void => {
  res.status(statusCode).json(body);
};

const errorResponse = (
  code: HostedAiGatewayResponse["error"]["code"],
  message: string,
): HostedAiGatewayResponse => ({
  ok: false,
  error: { code, message },
});

const isObject = (value: unknown): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const normalizeRequest = (body: unknown): HostedAiGatewayRequest | null => {
  if (typeof body === "string") {
    try {
      return normalizeRequest(JSON.parse(body) as unknown);
    } catch {
      return null;
    }
  }

  if (!isObject(body) || typeof body.action !== "string") {
    return null;
  }

  return body as unknown as HostedAiGatewayRequest;
};

const getBearerToken = (req: VercelRequest): string => {
  const authorization = getHeader(req.headers, "authorization");
  const match = authorization.match(/^Bearer\s+(.+)$/i);

  return match?.[1]?.trim() || "";
};

const normalizeSupabaseUrl = (url: string): string => url.replace(/\/+$/, "");

const supabaseFetch = async (
  path: string,
  token: string,
  init: RequestInit = {},
): Promise<Response> => {
  const supabaseUrl = normalizeSupabaseUrl(getEnv("SUPABASE_URL"));
  const url = `${supabaseUrl}${path}`;

  return fetch(url, {
    ...init,
    headers: {
      apikey: token,
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      ...(init.headers || {}),
    },
  });
};

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

const getSupabaseErrorMessage = (payload: unknown): string => {
  if (isObject(payload)) {
    const message = payload.message;
    const details = payload.details;

    if (typeof message === "string") {
      return message;
    }

    if (typeof details === "string") {
      return details;
    }
  }

  return "Supabase request failed.";
};

const verifyUser = async (accessToken: string): Promise<SupabaseUser> => {
  const anonKey = getEnv("SUPABASE_ANON_KEY");
  const response = await supabaseFetch("/auth/v1/user", anonKey, {
    method: "GET",
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
  });
  const payload = await readResponseJson(response);

  if (!response.ok || !isObject(payload) || typeof payload.id !== "string") {
    throw new Error("not_authenticated");
  }

  return { id: payload.id };
};

const callSupabaseRpc = async <T>(
  rpcName: string,
  body: JsonObject,
): Promise<T> => {
  const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");
  const response = await supabaseFetch(
    `/rest/v1/rpc/${rpcName}`,
    serviceRoleKey,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );
  const payload = await readResponseJson(response);

  if (!response.ok) {
    const message = getSupabaseErrorMessage(payload);
    const error = new Error(message);
    error.name = response.status === 429 ? "rate_limited" : "rpc_error";
    throw error;
  }

  return payload as T;
};

const normalizeStatus = (value: unknown): HostedAiStatus => {
  const source = Array.isArray(value) ? value[0] : value;
  const statusSource =
    isObject(source) && isObject(source.status) ? source.status : source;

  if (!isObject(statusSource)) {
    return {
      available: true,
      accountReady: true,
      introSeen: false,
      studyCredits: 0,
      dailyFreeCredits: HOSTED_AI_DAILY_FREE_CREDITS,
      initialFreeCredits: HOSTED_AI_INITIAL_FREE_CREDITS,
      costs: HOSTED_AI_CREDIT_COSTS,
    };
  }

  const studyCredits =
    typeof statusSource.studyCredits === "number"
      ? statusSource.studyCredits
      : typeof statusSource.study_credits === "number"
        ? statusSource.study_credits
        : typeof statusSource.study_credit_balance === "number"
          ? statusSource.study_credit_balance
          : 0;

  return {
    available:
      typeof statusSource.available === "boolean"
        ? statusSource.available
        : true,
    accountReady:
      typeof statusSource.accountReady === "boolean"
        ? statusSource.accountReady
        : typeof statusSource.account_ready === "boolean"
          ? statusSource.account_ready
          : true,
    introSeen:
      typeof statusSource.introSeen === "boolean"
        ? statusSource.introSeen
        : typeof statusSource.intro_seen === "boolean"
          ? statusSource.intro_seen
          : false,
    studyCredits,
    nextDailyRefillAt:
      typeof statusSource.nextDailyRefillAt === "string"
        ? statusSource.nextDailyRefillAt
        : typeof statusSource.next_daily_refill_at === "string"
          ? statusSource.next_daily_refill_at
          : undefined,
    dailyFreeCredits:
      typeof statusSource.dailyFreeCredits === "number"
        ? statusSource.dailyFreeCredits
        : HOSTED_AI_DAILY_FREE_CREDITS,
    initialFreeCredits:
      typeof statusSource.initialFreeCredits === "number"
        ? statusSource.initialFreeCredits
        : HOSTED_AI_INITIAL_FREE_CREDITS,
    costs: HOSTED_AI_CREDIT_COSTS,
    message:
      typeof statusSource.message === "string"
        ? statusSource.message
        : undefined,
  };
};

const getHostedStatus = async (userId: string): Promise<HostedAiStatus> => {
  const payload = await callSupabaseRpc<unknown>(
    "hosted_ai_get_or_create_account",
    {
      p_owner_id: userId,
    },
  );

  return normalizeStatus(payload);
};

const markIntroSeen = async (userId: string): Promise<HostedAiStatus> => {
  const payload = await callSupabaseRpc<unknown>("hosted_ai_mark_intro_seen", {
    p_owner_id: userId,
  });

  return normalizeStatus(payload);
};

const startHostedUsage = async (
  userId: string,
  request: HostedAiUsageRequest,
  model: string,
): Promise<{ status: HostedAiStatus; usageId?: string }> => {
  const surface = request.surface as HostedAiSurface;
  const payload = await callSupabaseRpc<HostedAiUsageStart>(
    "hosted_ai_begin_usage",
    {
      p_owner_id: userId,
      p_request_id: request.requestId,
      p_surface: surface,
      p_provider: "cerebras",
      p_model: model,
      p_metadata: {
        requestedCredits: HOSTED_AI_CREDIT_COSTS[surface],
      },
    },
  );

  return {
    status: normalizeStatus(payload),
    usageId: payload?.usageId || payload?.usage_id || payload?.event_id,
  };
};

const finishHostedUsage = async (
  userId: string,
  requestId: string,
  status: "succeeded" | "failed",
  errorCode?: string,
  errorMessage?: string,
): Promise<HostedAiStatus | undefined> => {
  const payload = await callSupabaseRpc<unknown>("hosted_ai_finish_usage", {
    p_owner_id: userId,
    p_request_id: requestId,
    p_status: status,
    p_provider_call_count: 1,
    p_error_code: errorCode || null,
    p_error_message: errorMessage || null,
    p_metadata: {},
  });

  return normalizeStatus(payload);
};

const validateGenerateRequest = (
  request: HostedAiGatewayRequest,
): HostedAiGatewayResponse | null => {
  if (!request.surface || !VALID_SURFACES.has(request.surface)) {
    return errorResponse("invalid_request", "Invalid hosted AI surface.");
  }

  if (!Array.isArray(request.parts) || request.parts.length === 0) {
    return errorResponse(
      "invalid_request",
      "Hosted AI generate requires text parts.",
    );
  }

  for (const part of request.parts) {
    if (hasInlineData(part)) {
      return errorResponse(
        "invalid_request",
        "Hosted AI does not accept image input.",
      );
    }
  }

  const textLength = request.parts.reduce((total, part) => {
    return total + (typeof part.text === "string" ? part.text.length : 0);
  }, 0);

  if (textLength <= 0) {
    return errorResponse(
      "invalid_request",
      "Hosted AI generate requires text content.",
    );
  }

  if (textLength > MAX_TEXT_CHARS) {
    return errorResponse("invalid_request", "Hosted AI prompt is too large.");
  }

  return null;
};

const hasInlineData = (part: HostedAiGatewayPart): boolean =>
  Boolean(part.inline_data) ||
  Object.prototype.hasOwnProperty.call(part, "inlineData");

const buildPrompt = (parts: HostedAiGatewayPart[]): string =>
  parts
    .map((part) => (typeof part.text === "string" ? part.text.trim() : ""))
    .filter(Boolean)
    .join("\n\n");

const convertSchemaType = (type: unknown): string | undefined => {
  if (typeof type !== "string") {
    return undefined;
  }

  const lower = type.toLowerCase();
  return lower === "number" ? "number" : lower;
};

const toJsonSchema = (schema: unknown): unknown => {
  if (Array.isArray(schema)) {
    return schema.map(toJsonSchema);
  }

  if (!schema || typeof schema !== "object") {
    return schema;
  }

  const record = schema as Record<string, unknown>;
  const next: Record<string, unknown> = {};

  Object.entries(record).forEach(([key, value]) => {
    if (key === "type") {
      const type = convertSchemaType(value);
      if (type) {
        next.type = type;
      }
      return;
    }

    next[key] = toJsonSchema(value);
  });

  if (next.type === "object") {
    next.additionalProperties = false;
  }

  return next;
};

const callCerebras = async (
  request: HostedAiGatewayRequest,
  model: string,
): Promise<string> => {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    Math.min(Math.max(request.timeoutMs || 60_000, 5_000), 120_000),
  );

  const body: JsonObject = {
    model,
    messages: [
      {
        role: "user",
        content: buildPrompt(request.parts || []),
      },
    ],
    temperature: 0.2,
    max_completion_tokens: 8192,
  };

  if (request.responseSchema) {
    body.response_format = {
      type: "json_schema",
      json_schema: {
        name: "studymesh_response",
        strict: true,
        schema: toJsonSchema(request.responseSchema),
      },
    };
  }

  try {
    const response = await fetch(CEREBRAS_CHAT_COMPLETIONS_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        authorization: `Bearer ${getEnv("HOSTED_CEREBRAS_API_KEY")}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const payload = (await readResponseJson(
      response,
    )) as CerebrasChatCompletion;

    if (!response.ok) {
      const message =
        payload?.error?.message ||
        (isObject(payload) && typeof payload.message === "string"
          ? payload.message
          : "Cerebras hosted AI request failed.");
      const error = new Error(message);
      error.name =
        response.status === 429 || /rate limit|quota|limit/i.test(message)
          ? "rate_limited"
          : "provider_error";
      throw error;
    }

    const content = payload.choices?.[0]?.message?.content;
    const text =
      typeof content === "string"
        ? content
        : Array.isArray(content)
          ? content.map((part) => part.text || "").join("")
          : payload.choices?.[0]?.text || "";

    if (!text.trim()) {
      const error = new Error("Cerebras returned an empty response.");
      error.name = "provider_error";
      throw error;
    }

    return text;
  } finally {
    clearTimeout(timeout);
  }
};

const ensureConfigured = (): HostedAiGatewayResponse | null => {
  const required = [
    "HOSTED_CEREBRAS_API_KEY",
    "SUPABASE_URL",
    "SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
  ];
  const missing = required.filter((name) => !getEnv(name));

  if (missing.length > 0) {
    return errorResponse(
      "not_configured",
      `Hosted AI gateway is missing server configuration: ${missing.join(", ")}.`,
    );
  }

  return null;
};

const mapFailure = (
  error: unknown,
): { statusCode: number; response: HostedAiGatewayResponse } => {
  if (error instanceof Error) {
    const message = error.message || "Hosted AI gateway failed.";

    if (error.message === "not_authenticated") {
      return {
        statusCode: 401,
        response: errorResponse(
          "not_authenticated",
          "Sign in to use hosted AI.",
        ),
      };
    }

    if (error.name === "rate_limited") {
      return {
        statusCode: 429,
        response: errorResponse("rate_limited", message),
      };
    }

    if (error.name === "rpc_error") {
      return {
        statusCode: 500,
        response: errorResponse(
          "server_error",
          `Hosted AI database error: ${message}`,
        ),
      };
    }

    if (/insufficient|credit|quota/i.test(message)) {
      return {
        statusCode: 402,
        response: errorResponse("insufficient_credits", message),
      };
    }

    if (error.name === "provider_error") {
      return {
        statusCode: 502,
        response: errorResponse("provider_error", message),
      };
    }
  }

  return {
    statusCode: 500,
    response: errorResponse("server_error", "Hosted AI gateway failed."),
  };
};

const handleGenerate = async (
  userId: string,
  request: HostedAiGatewayRequest,
): Promise<HostedAiGatewayResponse> => {
  const invalid = validateGenerateRequest(request);

  if (invalid) {
    return invalid;
  }

  const model = getHostedCerebrasModel();
  const requestId = randomUUID();
  const usageRequest = { ...request, requestId };
  const started = await startHostedUsage(userId, usageRequest, model);

  try {
    const text = await callCerebras(usageRequest, model);
    const status =
      (await finishHostedUsage(userId, requestId, "succeeded").catch(
        () => undefined,
      )) || started.status;

    return { ok: true, text, status };
  } catch (error) {
    const mapped = mapFailure(error);

    await finishHostedUsage(
      userId,
      requestId,
      "failed",
      mapped.response.error?.code,
      mapped.response.error?.message,
    ).catch(() => undefined);

    throw error;
  }
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
    json(res, 405, errorResponse("invalid_request", "Use POST for hosted AI."));
    return;
  }

  const missingConfig = ensureConfigured();

  if (missingConfig) {
    json(res, 500, missingConfig);
    return;
  }

  const request = normalizeRequest(req.body);

  if (!request) {
    json(
      res,
      400,
      errorResponse("invalid_request", "Invalid hosted AI request."),
    );
    return;
  }

  const accessToken = getBearerToken(req);

  if (!accessToken) {
    json(
      res,
      401,
      errorResponse("not_authenticated", "Sign in to use hosted AI."),
    );
    return;
  }

  try {
    const user = await verifyUser(accessToken);

    if (request.action === "status") {
      json(res, 200, { ok: true, status: await getHostedStatus(user.id) });
      return;
    }

    if (request.action === "markIntroSeen") {
      json(res, 200, { ok: true, status: await markIntroSeen(user.id) });
      return;
    }

    if (request.action === "generate") {
      const response = await handleGenerate(user.id, request);
      json(res, 200, response);
      return;
    }

    json(
      res,
      400,
      errorResponse("invalid_request", "Unknown hosted AI action."),
    );
  } catch (error) {
    const mapped = mapFailure(error);
    json(res, mapped.statusCode, mapped.response);
  }
}
