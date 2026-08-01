import { randomUUID } from "node:crypto";

import { getClientIp, hashClientIp } from "./client-ip";
import { applyCors, getHeader } from "./cors";
import { loadLocalApiEnv } from "./local-env";
import type {
  HostedAiGatewayPart,
  HostedAiGatewayRequest,
  HostedAiGatewayResponse,
  HostedAiGuestAllowance,
  HostedAiPodcast,
  HostedAiPodcastChapter,
  HostedAiPodcastTranscriptTurn,
  HostedAiStage,
  HostedAiStageCost,
  HostedAiStatus,
  HostedAiSurface,
} from "../apps/studymesh/src/quickCreate/ai/hostedCredits";
import {
  parseStudyGuideQuickStart,
  trimTitleToWordBoundary,
  trimToCompleteSentenceWithinChars,
} from "../apps/studymesh/src/studyGuides/quickStart";
import {
  createAiOutputLanguageInstruction,
  getContentLanguagePromptName,
  type StudyMeshLanguageCode,
} from "../apps/studymesh/src/language/contentLanguagePrompt";
import { sanitizeUserKnownTopics } from "../apps/studymesh/src/profileContext";

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
  isAnonymous: boolean;
}

// A guest is an anonymous Supabase session. The hashed address is the only
// network-level identity we keep; raw addresses never leave this process.
interface GuestContext {
  ipHash: string;
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

const getHostedRequestText = (request: HostedAiGatewayRequest): string =>
  (request.parts || [])
    .map((part) => (typeof part.text === "string" ? part.text : ""))
    .filter(Boolean)
    .join("\n\n");

type HostedTextProvider = "cerebras" | "openai";

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string | Array<{ text?: string; type?: string }>;
    };
    text?: string;
  }>;
  output?: Array<{
    type?: string;
    content?: Array<{ text?: string; type?: string }>;
  }>;
  error?: {
    code?: string;
    message?: string;
    type?: string;
  };
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    input_tokens?: number;
    output_tokens?: number;
    prompt_tokens_details?: {
      cached_tokens?: number;
    };
    input_tokens_details?: {
      cached_tokens?: number;
    };
  };
}

interface EnhancedStudyGuideBlueprintPage {
  title: string;
  keyFacts: string[];
  conciseNotes: string;
  examplesNeeded: string[];
  quizSkills: string[];
}

interface EnhancedStudyGuideBlueprint {
  title: string;
  folderName: string;
  emoji: string;
  quickStart: NonNullable<HostedAiGatewayResponse["quickStart"]>;
  pages: EnhancedStudyGuideBlueprintPage[];
}

interface EnhancedStudyGuidePage {
  title: string;
  summary: string;
  rawNotes: string;
}

interface EnhancedStudyGuideQuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  skillTested: string;
}

const HOSTED_AI_CREDIT_COSTS: Record<HostedAiSurface, number> = {
  "study-guide": 3,
  "quick-create": 1,
  chat: 1,
  // Follow-up model calls inside one chat message (answer, list repair).
  // The single chat credit is charged upfront by the planner call.
  "chat-followup": 0,
  podcast: 1,
};

const HOSTED_AI_INITIAL_FREE_CREDITS = 30;
const HOSTED_AI_DAILY_FREE_CREDIT_FLOOR = 7;
export const DEFAULT_CEREBRAS_MODEL = "gpt-oss-120b";
export const DEFAULT_OPENAI_MODEL = "gpt-5.4-mini";
export const DEFAULT_OPENAI_STUDY_GUIDE_MODEL = "gpt-5.6-luna";
export const DEFAULT_OPENAI_SUPPORT_MODEL = "gpt-5.4-mini";
export const DEFAULT_OPENAI_FAST_MODEL = "gpt-5.4-nano";
export const DEFAULT_OPENAI_REASONING_EFFORT = "none";
const MAX_TEXT_CHARS = 120_000;
const MIN_PODCAST_SOURCE_CHARS = 400;
const MAX_PODCAST_SOURCE_CHARS = 24_000;
const MAX_PODCAST_TURNS = 18;
const MAX_PODCAST_AUDIO_BYTES = 15_000_000;
const PODCAST_TTS_MONTHLY_CHARACTER_CAP = 225_000;
const PODCAST_RETAINED_AUDIO_COUNT = 5;
const PODCAST_AUDIO_CANDIDATE_RETENTION_DAYS = 30;
const PODCAST_EXPIRED_CLEANUP_LIMIT = 20;
const UNREAL_SPEECH_API_BASE = "https://api.v8.unrealspeech.com";
const UNREAL_SPEECH_DEFAULT_VOICE_ID = "Sierra";
const UNREAL_SPEECH_DEFAULT_HOST_B_VOICE_ID = "Daniel";
const UNREAL_SPEECH_POLL_ATTEMPTS = 30;
const UNREAL_SPEECH_POLL_DELAY_MS = 2_000;
const UNREAL_SPEECH_SEGMENT_CONCURRENCY = 3;
const UNREAL_SPEECH_LANGUAGE_VOICES: Partial<
  Record<
    StudyMeshLanguageCode,
    Record<HostedAiPodcastTranscriptTurn["speaker"], string>
  >
> = {
  en: {
    hostA: UNREAL_SPEECH_DEFAULT_VOICE_ID,
    hostB: UNREAL_SPEECH_DEFAULT_HOST_B_VOICE_ID,
  },
  es: { hostA: "ef_dora", hostB: "em_alex" },
  fr: { hostA: "ff_siwis", hostB: "ff_siwis" },
  it: { hostA: "if_sara", hostB: "im_nicola" },
  pt: { hostA: "pf_dora", hostB: "pm_alex" },
  hi: { hostA: "hf_alpha", hostB: "hm_omega" },
  zh: { hostA: "zf_xiaobei", hostB: "zm_yunjian" },
  ja: { hostA: "jf_alpha", hostB: "jm_kumo" },
};
const CEREBRAS_CHAT_COMPLETIONS_URL =
  "https://api.cerebras.ai/v1/chat/completions";
const OPENAI_CHAT_COMPLETIONS_URL =
  "https://api.openai.com/v1/chat/completions";
const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";

const VALID_SURFACES = new Set<HostedAiSurface>([
  "study-guide",
  "quick-create",
  "chat",
  "chat-followup",
  "podcast",
]);

const getEnv = (name: string): string => process.env[name]?.trim() || "";
const numberEnv = (name: string): number | undefined => {
  const raw = getEnv(name);
  if (!raw) {
    return undefined;
  }

  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : undefined;
};

// Guest trial ceilings. An anonymous JWT is mintable straight against Supabase,
// so nothing the caller sends can be trusted and every cap has to be applied
// here or in the database.
const DEFAULT_GUEST_STUDY_GUIDES_PER_IP_PER_DAY = 12;
const DEFAULT_GUEST_ACCOUNTS_PER_IP_PER_DAY = 5;
const DEFAULT_GUEST_STUDY_GUIDES_GLOBAL_PER_DAY = 300;
const DEFAULT_GUEST_MAX_PROMPT_CHARS = 4_000;
const DEFAULT_GUEST_MAX_TIMEOUT_MS = 60_000;

const GUEST_LIMIT_MESSAGE =
  "You've used your 3 free Quick Guides. Create a free account to keep them and get 30 Carrots.";
const GUEST_SURFACE_MESSAGE =
  "Guest accounts can only create Quick Guides. Create a free account to unlock this.";
const GUEST_PROMPT_TOO_LONG_MESSAGE =
  "Guest Quick Guide prompts are limited. Create a free account for longer prompts.";
const GUEST_TRIAL_DISABLED_MESSAGE =
  "Guest Quick Guides are turned off right now. Create a free account to keep going.";
const GUEST_NETWORK_UNAVAILABLE_MESSAGE =
  "Guest Quick Guides are unavailable from this connection. Create a free account to keep going.";

// The DB raises these two verbatim. They are the only messages that may map to
// guest_limit_reached; the network ceilings deliberately stay rate_limited.
const GUEST_LIMIT_RAISE_PATTERN =
  /guest quick guide limit reached|guest accounts can only create/i;

const guestLimit = (name: string, fallback: number): number =>
  numberEnv(name) ?? fallback;

const isGuestTrialEnabled = (): boolean =>
  !/^(false|0|off|no)$/i.test(getEnv("GUEST_TRIAL_ENABLED"));

export const getHostedCerebrasModel = (): string =>
  getEnv("HOSTED_CEREBRAS_MODEL") || DEFAULT_CEREBRAS_MODEL;

export const getHostedTextProvider = (): HostedTextProvider =>
  getEnv("HOSTED_AI_TEXT_PROVIDER").toLowerCase() === "openai"
    ? "openai"
    : "cerebras";

export const getHostedOpenAiModel = (): string =>
  getEnv("HOSTED_OPENAI_MODEL") || DEFAULT_OPENAI_MODEL;

const BLUEPRINT_OPENAI_STAGES = new Set<HostedAiStage>([
  "study_guide_blueprint",
  "study_guide_monolith",
]);

const SUPPORT_OPENAI_STAGES = new Set<HostedAiStage>([
  "study_guide_main",
  "quick_start_fallback",
  "quick_start_personalized",
  "quick_start_relevance_auto",
  "quick_start_relevance_force",
  "quick_start_forced_bridge",
  "knowledge_bridge_blocks",
]);

export const getHostedOpenAiModelForStage = (stage: HostedAiStage): string => {
  if (BLUEPRINT_OPENAI_STAGES.has(stage)) {
    return (
      getEnv("HOSTED_OPENAI_STUDY_GUIDE_MODEL") ||
      getEnv("HOSTED_OPENAI_MODEL") ||
      DEFAULT_OPENAI_STUDY_GUIDE_MODEL
    );
  }

  if (SUPPORT_OPENAI_STAGES.has(stage)) {
    return (
      getEnv("HOSTED_OPENAI_SUPPORT_MODEL") ||
      getEnv("HOSTED_OPENAI_MODEL") ||
      DEFAULT_OPENAI_SUPPORT_MODEL
    );
  }

  return (
    getEnv("HOSTED_OPENAI_FAST_MODEL") ||
    getEnv("HOSTED_OPENAI_MODEL") ||
    DEFAULT_OPENAI_FAST_MODEL
  );
};

export const getHostedOpenAiReasoningEffort = (): string =>
  getEnv("HOSTED_OPENAI_REASONING_EFFORT") || DEFAULT_OPENAI_REASONING_EFFORT;

export const isOpenAiResponsesModel = (model: string): boolean =>
  model.includes("luna");

export const getHostedTextModel = (
  provider: HostedTextProvider = getHostedTextProvider(),
  stage: HostedAiStage = "quick_create",
): string =>
  provider === "openai"
    ? getHostedOpenAiModelForStage(stage)
    : getHostedCerebrasModel();

const getHostedUsageModelLabel = (
  provider: HostedTextProvider,
  model: string,
): string => `${provider}:${model}`;

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
const INSUFFICIENT_STUDY_CREDITS_MESSAGE =
  "You don't have enough Carrots for this action. Add more Carrots or switch AI provider, then try again.";

const isObject = (value: unknown): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const stringValue = (value: unknown): string =>
  typeof value === "string" ? value.trim() : "";

const parseJsonRecord = (value: string): JsonObject | null => {
  try {
    const parsed = JSON.parse(value) as unknown;
    return isObject(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

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

const readRequest = (req: VercelRequest): HostedAiGatewayRequest | null => {
  try {
    return normalizeRequest(req.body);
  } catch {
    return null;
  }
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

const readResponseText = async (response: Response): Promise<string> => {
  try {
    return await response.text();
  } catch {
    return "";
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

  return { id: payload.id, isAnonymous: payload.is_anonymous === true };
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
    // The guest check runs first on purpose: the allowance raise says "Quick
    // Guide limit reached", which the rate-limit pattern below would swallow.
    // The IP ceilings start with "Too many " and are meant to fall through to
    // rate_limited, so an abuser cannot tell which cap they hit.
    error.name = GUEST_LIMIT_RAISE_PATTERN.test(message)
      ? "guest_limit_reached"
      : response.status === 429 ||
        /retry limit|rate limit|too many|monthly free podcast audio limit reached/i.test(
          message,
        )
      ? "rate_limited"
      : "rpc_error";
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
      initialFreeCredits: HOSTED_AI_INITIAL_FREE_CREDITS,
      dailyFreeCreditFloor: HOSTED_AI_DAILY_FREE_CREDIT_FLOOR,
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
  const nextDailyRefillAt =
    typeof statusSource.nextDailyRefillAt === "string"
      ? statusSource.nextDailyRefillAt
      : typeof statusSource.next_daily_refill_at === "string"
      ? statusSource.next_daily_refill_at
      : undefined;

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
    initialFreeCredits:
      typeof statusSource.initialFreeCredits === "number"
        ? statusSource.initialFreeCredits
        : HOSTED_AI_INITIAL_FREE_CREDITS,
    dailyFreeCreditFloor:
      typeof statusSource.dailyFreeCreditFloor === "number"
        ? statusSource.dailyFreeCreditFloor
        : typeof statusSource.daily_free_credit_floor === "number"
        ? statusSource.daily_free_credit_floor
        : HOSTED_AI_DAILY_FREE_CREDIT_FLOOR,
    nextDailyRefillAt,
    costs: HOSTED_AI_CREDIT_COSTS,
    message:
      typeof statusSource.message === "string"
        ? statusSource.message
        : undefined,
  };
};

const readNumberField = (
  source: JsonObject,
  ...keys: string[]
): number | undefined => {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }

  return undefined;
};

const normalizeGuestAllowance = (
  value: unknown,
): HostedAiGuestAllowance | undefined => {
  const source = Array.isArray(value) ? value[0] : value;

  if (!isObject(source)) {
    return undefined;
  }

  const allowed = readNumberField(
    source,
    "study_guides_allowed",
    "studyGuidesAllowed",
  );
  const used = readNumberField(source, "study_guides_used", "studyGuidesUsed");

  if (allowed === undefined) {
    return undefined;
  }

  return {
    allowed,
    used: used || 0,
    remaining: Math.max(allowed - (used || 0), 0),
  };
};

const readGuestAllowance = async (
  userId: string,
): Promise<HostedAiGuestAllowance | undefined> =>
  normalizeGuestAllowance(
    await callSupabaseRpc<unknown>("guest_get_allowance", {
      p_owner_id: userId,
    }),
  );

// Read-only, and deliberately first: an exhausted guest must fail before the
// network budget is spent. hosted_ai_begin_usage stays the only writer of the
// counter, so this check can never charge a guide on its own.
const assertGuestAllowanceAvailable = async (userId: string): Promise<void> => {
  const allowance = await readGuestAllowance(userId);

  if (allowance && allowance.remaining <= 0) {
    const error = new Error(GUEST_LIMIT_MESSAGE);
    error.name = "guest_limit_reached";
    throw error;
  }
};

const reserveGuestIpBudget = async (
  ipHash: string,
  userId: string,
): Promise<void> => {
  if (!ipHash) {
    return;
  }

  await callSupabaseRpc<unknown>("guest_ip_reserve_study_guide", {
    p_ip_hash: ipHash,
    p_owner_id: userId,
    p_daily_guide_limit: guestLimit(
      "GUEST_STUDY_GUIDES_PER_IP_PER_DAY",
      DEFAULT_GUEST_STUDY_GUIDES_PER_IP_PER_DAY,
    ),
    p_daily_guest_limit: guestLimit(
      "GUEST_ACCOUNTS_PER_IP_PER_DAY",
      DEFAULT_GUEST_ACCOUNTS_PER_IP_PER_DAY,
    ),
    p_global_daily_guide_limit: guestLimit(
      "GUEST_STUDY_GUIDES_GLOBAL_PER_DAY",
      DEFAULT_GUEST_STUDY_GUIDES_GLOBAL_PER_DAY,
    ),
  });
};

const getHostedStatus = async (
  userId: string,
  isAnonymous = false,
): Promise<HostedAiStatus> => {
  const payload = await callSupabaseRpc<unknown>(
    "hosted_ai_get_or_create_account",
    {
      p_owner_id: userId,
    },
  );
  const status = normalizeStatus(payload);

  if (!isAnonymous) {
    return status;
  }

  const guest = await readGuestAllowance(userId);

  return guest ? { ...status, guest } : status;
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
  provider: HostedTextProvider,
  model: string,
): Promise<{ status: HostedAiStatus; usageId?: string }> => {
  const surface = request.surface as HostedAiSurface;
  const payload = await callSupabaseRpc<HostedAiUsageStart>(
    "hosted_ai_begin_usage",
    {
      p_owner_id: userId,
      p_request_id: request.requestId,
      p_surface: surface,
      p_provider: provider,
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
  providerCallCount = 1,
  metadata: JsonObject = {},
): Promise<HostedAiStatus | undefined> => {
  const payload = await callSupabaseRpc<unknown>("hosted_ai_finish_usage", {
    p_owner_id: userId,
    p_request_id: requestId,
    p_status: status,
    p_provider_call_count: providerCallCount,
    p_error_code: errorCode || null,
    p_error_message: errorMessage || null,
    p_metadata: metadata,
  });

  return normalizeStatus(payload);
};

const getStageForSurface = (surface: HostedAiSurface): HostedAiStage => {
  if (surface === "chat" || surface === "chat-followup") {
    return "chat";
  }

  if (surface === "quick-create") {
    return "quick_create";
  }

  if (surface === "podcast") {
    return "podcast_script";
  }

  return "study_guide_main";
};

const getHostedTextModelForStage = (
  provider: HostedTextProvider,
  stage: HostedAiStage,
): string => getHostedTextModel(provider, stage);

const createUsageMetadata = (
  stageCosts: HostedAiStageCost[],
  extra: JsonObject = {},
): JsonObject => {
  const estimatedCostUsdTotal = stageCosts.reduce(
    (total, stage) => total + (stage.estimatedCostUsd || 0),
    0,
  );
  const promptCharacterCountTotal = stageCosts.reduce(
    (total, stage) => total + stage.promptCharacters,
    0,
  );
  const responseCharacterCountTotal = stageCosts.reduce(
    (total, stage) => total + stage.responseCharacters,
    0,
  );

  return {
    ...extra,
    estimatedCostUsdTotal: Number(estimatedCostUsdTotal.toFixed(8)),
    promptCharacterCountTotal,
    responseCharacterCountTotal,
    stageCosts,
  };
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

// Guests get exactly one door: the Study Guide quick-start flow, whose schema
// and page count are chosen server side. Plain `generate` passes the caller's
// responseSchema straight to the provider, which would hand out a free
// structured-output oracle, so it stays closed no matter what the surface says.
const validateGuestRequest = (
  request: HostedAiGatewayRequest,
): { statusCode: number; response: HostedAiGatewayResponse } | null => {
  if (
    request.action !== "generateWithQuickStart" ||
    request.surface !== "study-guide"
  ) {
    return {
      statusCode: 403,
      response: errorResponse("invalid_request", GUEST_SURFACE_MESSAGE),
    };
  }

  const promptCharacters = (request.parts || []).reduce(
    (total, part) =>
      total + (typeof part.text === "string" ? part.text.length : 0),
    0,
  );

  if (
    promptCharacters >
    guestLimit("GUEST_MAX_PROMPT_CHARS", DEFAULT_GUEST_MAX_PROMPT_CHARS)
  ) {
    return {
      statusCode: 400,
      response: errorResponse("invalid_request", GUEST_PROMPT_TOO_LONG_MESSAGE),
    };
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

const textArraySchema = { type: "ARRAY", items: { type: "STRING" } };

const ENHANCED_STUDY_GUIDE_QUIZ_SCHEMA = {
  type: "OBJECT",
  properties: {
    questions: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          question: { type: "STRING" },
          options: textArraySchema,
          correctIndex: { type: "NUMBER" },
          explanation: { type: "STRING" },
          skillTested: { type: "STRING" },
        },
        required: [
          "question",
          "options",
          "correctIndex",
          "explanation",
          "skillTested",
        ],
      },
    },
  },
  required: ["questions"],
};

const extractPromptField = (prompt: string, label: string): string => {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = prompt.match(new RegExp(`${escaped}:\\s*([^\\n]+)`, "i"));
  return match?.[1]?.trim() || "";
};

const extractHostedStudyGuideTopic = (requestText: string): string => {
  const match = requestText.match(/User request\/topic:\s*([\s\S]+)$/i);
  return (match?.[1] || requestText).trim().slice(0, 4000);
};

const normalizeEnhancedPage = (
  value: unknown,
  fallbackTitle: string,
): EnhancedStudyGuidePage => {
  const record = isObject(value) ? value : {};
  const rawNotes = stringValue(record.rawNotes);
  if (!rawNotes) {
    const error = new Error("Hosted AI returned an unusable Study Guide page.");
    error.name = "provider_error";
    throw error;
  }

  return {
    title: stringValue(record.title) || fallbackTitle,
    summary: stringValue(record.summary) || `${fallbackTitle} lesson notes.`,
    rawNotes,
  };
};

const hashQuizSeed = (value: string): number => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }
  return hash >>> 0;
};

export const shuffleQuizQuestionOptions = (
  question: EnhancedStudyGuideQuizQuestion,
): EnhancedStudyGuideQuizQuestion => {
  const order = question.options.map((_, index) => index);
  let seed = hashQuizSeed(question.question);
  for (let index = order.length - 1; index > 0; index -= 1) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const swapIndex = seed % (index + 1);
    [order[index], order[swapIndex]] = [order[swapIndex], order[index]];
  }

  return {
    ...question,
    options: order.map((optionIndex) => question.options[optionIndex]),
    correctIndex: order.indexOf(question.correctIndex),
  };
};

const normalizeEnhancedQuizQuestions = (
  value: unknown,
): EnhancedStudyGuideQuizQuestion[] => {
  const record = isObject(value) ? value : {};
  const questions = Array.isArray(record.questions) ? record.questions : [];
  const normalized = questions.slice(0, 6).map((question) => {
    const questionRecord = isObject(question) ? question : {};
    const options = Array.isArray(questionRecord.options)
      ? questionRecord.options.map(stringValue).filter(Boolean).slice(0, 3)
      : [];
    return {
      question: stringValue(questionRecord.question),
      options,
      correctIndex:
        typeof questionRecord.correctIndex === "number"
          ? Math.trunc(questionRecord.correctIndex)
          : 0,
      explanation: stringValue(questionRecord.explanation),
      skillTested: stringValue(questionRecord.skillTested),
    };
  });

  if (
    normalized.length !== 6 ||
    normalized.some(
      (question) =>
        !question.question ||
        question.options.length !== 3 ||
        question.correctIndex < 0 ||
        question.correctIndex > 2 ||
        !question.explanation,
    )
  ) {
    const error = new Error("Hosted AI returned an unusable final quiz.");
    error.name = "provider_error";
    throw error;
  }

  return normalized.map(shuffleQuizQuestionOptions);
};

const buildEnhancedGuideSource = ({
  topic,
  blueprint,
  pages,
}: {
  topic: string;
  blueprint: EnhancedStudyGuideBlueprint;
  pages: EnhancedStudyGuidePage[];
}): string =>
  [
    `Learner request: ${topic}`,
    `Guide topic: ${blueprint.title}`,
    `Quick Start: ${blueprint.quickStart.keyIdea}\n${blueprint.quickStart.quickSummary}`,
    ...pages.map((page, index) =>
      [`Page ${index + 1}: ${page.title}`, page.rawNotes].join("\n"),
    ),
  ].join("\n\n---\n\n");

const buildEnhancedQuizPrompt = ({
  topic,
  source,
  bridgeBlocks,
  outputLanguage,
}: {
  topic: string;
  source: string;
  bridgeBlocks: HostedAiGatewayResponse["bridgeBlocks"];
  outputLanguage?: StudyMeshLanguageCode;
}): string => `Create 6 strong multiple-choice questions for the final page of this Study Guide.

Return strict JSON only:
{
  "questions": [
    {
      "question": "...",
      "options": ["...", "...", "..."],
      "correctIndex": 0,
      "explanation": "...",
      "skillTested": "..."
    }
  ]
}

Rules:
- ${createAiOutputLanguageInstruction(outputLanguage)}
- Create exactly 6 questions.
- Each question has exactly 3 options.
- Avoid literal recall of copied sentences.
- Prefer application, comparison, error diagnosis, prediction, or transfer.
- Do not ask "According to the page..." or "Which statement is directly stated...".
- Every question must be answerable from the guide.
- Keep explanations short and specific.

Topic: ${topic}

Guide:
${source.slice(0, 18000)}

Context bridge notes:
${JSON.stringify(bridgeBlocks || [], null, 2)}`;

const createMinimalSourceSummary = (
  page: EnhancedStudyGuidePage,
  blueprintPage: EnhancedStudyGuideBlueprintPage,
) => ({
  title: `${page.title} source summary`,
  bullets: (blueprintPage.keyFacts.length
    ? blueprintPage.keyFacts
    : [page.summary]
  ).slice(0, 3),
});

const createMinimalConceptRecap = (
  page: EnhancedStudyGuidePage,
  blueprintPage: EnhancedStudyGuideBlueprintPage,
) => ({
  title: `${page.title} concept recap`,
  sections: [
    {
      title: "Core ideas",
      bullets: (blueprintPage.keyFacts.length
        ? blueprintPage.keyFacts
        : [page.summary]
      ).slice(0, 4),
      example: blueprintPage.examplesNeeded[0] || "",
    },
  ],
});

const createQuizPractice = (questions: EnhancedStudyGuideQuizQuestion[]) => ({
  multipleChoice: questions.map((question) => ({
    question: question.question,
    options: question.options,
    correctOptionIndex: question.correctIndex,
    explanation: question.explanation,
    hint: question.skillTested || "Use the guide's examples and comparisons.",
    optionFeedback: question.options.map((option, index) => ({
      option,
      explanation:
        index === question.correctIndex
          ? question.explanation
          : "This option misses the guide's main distinction.",
    })),
  })),
});

const buildEnhancedStudyGuideText = ({
  blueprint,
  pages,
  questions,
  quickStart,
}: {
  blueprint: EnhancedStudyGuideBlueprint;
  pages: EnhancedStudyGuidePage[];
  questions: EnhancedStudyGuideQuizQuestion[];
  quickStart: NonNullable<HostedAiGatewayResponse["quickStart"]>;
}): string =>
  JSON.stringify({
    title: blueprint.title,
    folderName: blueprint.folderName,
    emoji: blueprint.emoji,
    quickStart,
    dashboards: pages.map((page, index) => ({
      title: page.title,
      summary: page.summary,
      rawNotes: page.rawNotes,
      dashboardPurpose: index === pages.length - 1 ? "finalReview" : "lesson",
      practiceType: index === pages.length - 1 ? "quiz" : "none",
      layoutReason:
        index === pages.length - 1
          ? "Final Study Guide page includes one source-grounded quiz."
          : "Lean Study Guide lesson page.",
      contentMode:
        index === pages.length - 1 ? "synthesisReview" : "conceptLesson",
      sourceSummary: createMinimalSourceSummary(
        page,
        blueprint.pages[index] || blueprint.pages[0],
      ),
      conceptRecap: createMinimalConceptRecap(
        page,
        blueprint.pages[index] || blueprint.pages[0],
      ),
      practice:
        index === pages.length - 1
          ? createQuizPractice(questions)
          : { multipleChoice: [] },
      flashcards: [],
    })),
  });

const convertSchemaType = (type: unknown): string | undefined => {
  if (typeof type !== "string") {
    return undefined;
  }

  const lower = type.toLowerCase();
  return lower === "number" ? "number" : lower;
};

const toJsonSchema = (
  schema: unknown,
  options: { requireAllObjectProperties?: boolean } = {},
): unknown => {
  if (Array.isArray(schema)) {
    return schema.map((item) => toJsonSchema(item, options));
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

    next[key] = toJsonSchema(value, options);
  });

  if (next.type === "object") {
    next.additionalProperties = false;
    if (options.requireAllObjectProperties && isObject(next.properties)) {
      next.required = Object.keys(next.properties);
    }
  }

  return next;
};

const getChatCompletionConfig = (
  provider: HostedTextProvider,
): { url: string; apiKey: string; label: string } =>
  provider === "openai"
    ? {
        url: OPENAI_CHAT_COMPLETIONS_URL,
        apiKey: getEnv("HOSTED_OPENAI_API_KEY"),
        label: "OpenAI",
      }
    : {
        url: CEREBRAS_CHAT_COMPLETIONS_URL,
        apiKey: getEnv("HOSTED_CEREBRAS_API_KEY"),
        label: "Cerebras",
      };

const extractChatCompletionText = (payload: ChatCompletionResponse): string => {
  const content = payload.choices?.[0]?.message?.content;

  return typeof content === "string"
    ? content
    : Array.isArray(content)
    ? content.map((part) => part.text || "").join("")
    : payload.choices?.[0]?.text || "";
};

const extractResponsesApiText = (payload: ChatCompletionResponse): string =>
  (payload.output || [])
    .filter((item) => item?.type === "message")
    .flatMap((item) => (Array.isArray(item.content) ? item.content : []))
    .map((part) => (typeof part?.text === "string" ? part.text : ""))
    .join("");

const getDefaultOpenAiInputPrice = (model: string): number =>
  model.includes("nano") ? 0.2 : model.includes("luna") ? 0.9975 : 0.75;

const getDefaultOpenAiCachedInputPrice = (model: string): number =>
  model.includes("nano") ? 0.02 : model.includes("luna") ? 0.09975 : 0.075;

const getDefaultOpenAiOutputPrice = (model: string): number =>
  model.includes("nano") ? 1.25 : model.includes("luna") ? 5.985 : 4.5;

const getModelPriceEnvSuffix = (model: string): string =>
  model
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const getTokenPricePerMillion = (
  provider: HostedTextProvider,
  model: string,
  kind: "INPUT" | "CACHED_INPUT" | "OUTPUT",
): number => {
  if (provider !== "openai") {
    return 0;
  }

  const suffix = getModelPriceEnvSuffix(model);
  const configured =
    numberEnv(`HOSTED_OPENAI_${suffix}_${kind}_MTOK_USD`) ??
    numberEnv(`HOSTED_OPENAI_${kind}_MTOK_USD`);
  if (configured !== undefined) {
    return configured;
  }

  if (kind === "INPUT") {
    return getDefaultOpenAiInputPrice(model);
  }

  if (kind === "CACHED_INPUT") {
    return getDefaultOpenAiCachedInputPrice(model);
  }

  return getDefaultOpenAiOutputPrice(model);
};

const estimateStageCostUsd = (
  provider: HostedTextProvider,
  model: string,
  inputTokens: number,
  cachedInputTokens: number,
  outputTokens: number,
): number | undefined => {
  if (inputTokens <= 0 && outputTokens <= 0) {
    return undefined;
  }

  const uncachedInputTokens = Math.max(0, inputTokens - cachedInputTokens);
  const cost =
    (uncachedInputTokens * getTokenPricePerMillion(provider, model, "INPUT")) /
      1_000_000 +
    (cachedInputTokens *
      getTokenPricePerMillion(provider, model, "CACHED_INPUT")) /
      1_000_000 +
    (outputTokens * getTokenPricePerMillion(provider, model, "OUTPUT")) /
      1_000_000;

  return Number(cost.toFixed(8));
};

const readUsageNumber = (
  source: ChatCompletionResponse["usage"],
  ...keys: string[]
): number | undefined => {
  for (const key of keys) {
    const value = source?.[key as keyof NonNullable<typeof source>];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }

  return undefined;
};

const createStageCost = ({
  stage,
  provider,
  model,
  payload,
  prompt,
  text,
}: {
  stage: HostedAiStage;
  provider: HostedTextProvider;
  model: string;
  payload: ChatCompletionResponse;
  prompt: string;
  text: string;
}): HostedAiStageCost => {
  const usage = payload.usage;
  const inputTokens = readUsageNumber(usage, "prompt_tokens", "input_tokens");
  const outputTokens = readUsageNumber(
    usage,
    "completion_tokens",
    "output_tokens",
  );
  const totalTokens = readUsageNumber(usage, "total_tokens");
  const cachedInputTokens =
    usage?.prompt_tokens_details?.cached_tokens ??
    usage?.input_tokens_details?.cached_tokens;
  const estimatedCostUsd = estimateStageCostUsd(
    provider,
    model,
    inputTokens || 0,
    cachedInputTokens || 0,
    outputTokens || 0,
  );

  return {
    stage,
    provider,
    model,
    promptCharacters: prompt.length,
    responseCharacters: text.length,
    ...(inputTokens !== undefined ? { inputTokens } : {}),
    ...(cachedInputTokens !== undefined ? { cachedInputTokens } : {}),
    ...(outputTokens !== undefined ? { outputTokens } : {}),
    ...(totalTokens !== undefined ? { totalTokens } : {}),
    ...(estimatedCostUsd !== undefined ? { estimatedCostUsd } : {}),
  };
};

interface HostedTextModelResult {
  text: string;
  stageCost: HostedAiStageCost;
}

const callHostedTextModel = async (
  request: HostedAiGatewayRequest,
  provider: HostedTextProvider,
  model: string,
  stage: HostedAiStage,
): Promise<HostedTextModelResult> => {
  const config = getChatCompletionConfig(provider);
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    Math.min(Math.max(request.timeoutMs || 60_000, 5_000), 120_000),
  );
  const prompt = buildPrompt(request.parts || []);
  const useResponsesApi =
    provider === "openai" && isOpenAiResponsesModel(model);

  const body: JsonObject = useResponsesApi
    ? {
        model,
        input: prompt,
        reasoning: { effort: getHostedOpenAiReasoningEffort() },
        max_output_tokens: 8192,
      }
    : {
        model,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.2,
        max_completion_tokens: 8192,
      };

  if (request.responseSchema) {
    const jsonSchema = {
      name: "studymesh_response",
      strict: true,
      schema: toJsonSchema(request.responseSchema, {
        requireAllObjectProperties: provider === "openai",
      }),
    };
    if (useResponsesApi) {
      body.text = { format: { type: "json_schema", ...jsonSchema } };
    } else {
      body.response_format = { type: "json_schema", json_schema: jsonSchema };
    }
  }

  try {
    const response = await fetch(
      useResponsesApi ? OPENAI_RESPONSES_URL : config.url,
      {
        method: "POST",
        signal: controller.signal,
        headers: {
          authorization: `Bearer ${config.apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
      },
    );
    const payload = (await readResponseJson(
      response,
    )) as ChatCompletionResponse;

    if (!response.ok) {
      const message =
        payload?.error?.message ||
        (isObject(payload) && typeof payload.message === "string"
          ? payload.message
          : `${config.label} hosted AI request failed.`);
      const error = new Error(message);
      error.name =
        response.status === 429 || /rate limit|quota|limit/i.test(message)
          ? "rate_limited"
          : "provider_error";
      throw error;
    }

    const text = useResponsesApi
      ? extractResponsesApiText(payload)
      : extractChatCompletionText(payload);

    if (!text.trim()) {
      const error = new Error(`${config.label} returned an empty response.`);
      error.name = "provider_error";
      throw error;
    }

    return {
      text,
      stageCost: createStageCost({
        stage,
        provider,
        model,
        payload,
        prompt,
        text,
      }),
    };
  } finally {
    clearTimeout(timeout);
  }
};

interface PodcastScript {
  title: string;
  description: string;
  transcriptTurns: HostedAiPodcastTranscriptTurn[];
  chapters: HostedAiPodcastChapter[];
}

const PODCAST_SCRIPT_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    description: { type: "string" },
    transcriptTurns: {
      type: "array",
      items: {
        type: "object",
        properties: {
          speaker: { type: "string" },
          text: { type: "string" },
        },
        required: ["speaker", "text"],
      },
    },
    chapters: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          startTurn: { type: "integer" },
        },
        required: ["title", "startTurn"],
      },
    },
  },
  required: ["title", "description", "transcriptTurns", "chapters"],
};

const safePodcastText = (value: unknown, maxLength: number): string =>
  stringValue(value).replace(/\s+/g, " ").slice(0, maxLength).trim();

const parseJsonFromText = (value: string): JsonObject | null => {
  const trimmed = value.trim();
  const direct = parseJsonRecord(trimmed);
  if (direct) {
    return direct;
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  if (fenced) {
    return parseJsonRecord(fenced.trim());
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return parseJsonRecord(trimmed.slice(firstBrace, lastBrace + 1));
  }

  return null;
};

const normalizePodcastTurn = (
  value: unknown,
): HostedAiPodcastTranscriptTurn | null => {
  if (!isObject(value)) {
    return null;
  }

  const speaker = value.speaker === "hostB" ? "hostB" : "hostA";
  const text = safePodcastText(value.text, 700);
  if (!text) {
    return null;
  }

  return { speaker, text };
};

const normalizePodcastChapter = (
  value: unknown,
  turnCount: number,
): HostedAiPodcastChapter | null => {
  if (!isObject(value)) {
    return null;
  }

  const title = safePodcastText(value.title, 90);
  const rawStartTurn =
    typeof value.startTurn === "number"
      ? value.startTurn
      : Number(value.startTurn);
  const startTurn = Number.isFinite(rawStartTurn)
    ? Math.max(0, Math.min(turnCount - 1, Math.floor(rawStartTurn)))
    : 0;

  return title ? { title, startTurn } : null;
};

// Overflow used to be `.slice(0, MAX_PODCAST_TURNS)`, which dropped the tail. A
// real episode came back ending mid-thought on a question the other host never
// answered, because the closing turns were cut. Keep the closing turn and shed
// from the middle instead, where a listener is least likely to notice the seam.
export const capPodcastTurns = (
  turns: HostedAiPodcastTranscriptTurn[],
): HostedAiPodcastTranscriptTurn[] => {
  if (turns.length <= MAX_PODCAST_TURNS) {
    return turns;
  }

  const closing = turns[turns.length - 1];
  const head = turns.slice(0, MAX_PODCAST_TURNS - 1);
  // Cutting the middle can land the same voice on both sides of the seam, so
  // shed one more turn rather than have a host answer themselves.
  if (head.length > 0 && head[head.length - 1].speaker === closing.speaker) {
    head.pop();
  }

  return [...head, closing];
};

// Each speaker gets its own TTS voice, so two consecutive turns from the same
// host are heard as one continuous block and the turn-taking cue disappears. A
// live episode came back with three such seams once the prompt asked for short
// question turns: the model parks a question next to the turn that just answered
// the previous one, and the same voice ends up answering itself and then asking.
//
// Asking the prompt for alternation is what already failed, and the labels carry
// no meaning of their own — they only pick a voice — so re-anchoring them on the
// opening speaker fixes the audio without changing a word anyone says. Adjacency
// is what makes "the other host" resolve correctly, and this preserves it.
export const alternatePodcastSpeakers = (
  turns: HostedAiPodcastTranscriptTurn[],
): HostedAiPodcastTranscriptTurn[] => {
  const opening = turns[0]?.speaker === "hostB" ? "hostB" : "hostA";
  const other = opening === "hostA" ? "hostB" : "hostA";

  return turns.map((turn, index) => {
    const speaker = index % 2 === 0 ? opening : other;
    return speaker === turn.speaker ? turn : { ...turn, speaker };
  });
};

const normalizePodcastScript = (
  text: string,
  fallbackTitle: string,
): PodcastScript => {
  const parsed = parseJsonFromText(text);
  if (!parsed) {
    const error = new Error("Hosted AI returned an unreadable podcast script.");
    error.name = "provider_error";
    throw error;
  }

  const transcriptTurns = Array.isArray(parsed.transcriptTurns)
    ? // After the cap, not before: shedding turns from the middle would otherwise
      // put two of the same voice back together at the seam.
      alternatePodcastSpeakers(
        capPodcastTurns(
          parsed.transcriptTurns
            .map((turn) => normalizePodcastTurn(turn))
            .filter((turn): turn is HostedAiPodcastTranscriptTurn =>
              Boolean(turn),
            ),
        ),
      )
    : [];

  if (transcriptTurns.length < 4) {
    const error = new Error("Hosted AI returned too little podcast dialogue.");
    error.name = "provider_error";
    throw error;
  }

  const chapters = Array.isArray(parsed.chapters)
    ? parsed.chapters
        .map((chapter) =>
          normalizePodcastChapter(chapter, transcriptTurns.length),
        )
        .filter((chapter): chapter is HostedAiPodcastChapter =>
          Boolean(chapter),
        )
        .slice(0, 6)
    : [];

  return {
    title: safePodcastText(parsed.title, 100) || `Podcast: ${fallbackTitle}`,
    description:
      safePodcastText(parsed.description, 240) ||
      "Short Study Guide audio recap.",
    transcriptTurns,
    chapters: chapters.length ? chapters : [{ title: "Recap", startTurn: 0 }],
  };
};

const getPodcastTranscriptText = (script: PodcastScript): string =>
  script.transcriptTurns.map((turn) => turn.text).join("\n\n");

const countPodcastLanguageMarkers = (text: string, markers: RegExp[]): number =>
  markers.reduce(
    (total, marker) => total + (text.match(marker)?.length || 0),
    0,
  );

const detectPodcastScriptLanguage = (
  text: string,
): StudyMeshLanguageCode | undefined => {
  const normalized = ` ${text.toLowerCase().normalize("NFC")} `;
  const scores: Partial<Record<StudyMeshLanguageCode, number>> = {
    es: countPodcastLanguageMarkers(normalized, [
      /\b(el|la|los|las|un|una|de|del|que|para|con|por|como|esto|esta|este|energía|células|lección)\b/g,
      /[áéíóúñ¿¡]/g,
    ]),
    pt: countPodcastLanguageMarkers(normalized, [
      /\b(o|a|os|as|um|uma|de|do|da|que|para|com|por|como|isso|essa|este|energia|células|lição)\b/g,
      /[ãõç]/g,
    ]),
    fr: countPodcastLanguageMarkers(normalized, [
      /\b(le|la|les|un|une|des|de|du|que|pour|avec|par|comme|cela|cette|énergie|cellules|leçon)\b/g,
      /[àâçéèêëîïôûùüÿœ]/g,
    ]),
    it: countPodcastLanguageMarkers(normalized, [
      /\b(il|lo|la|gli|le|un|una|di|che|per|con|come|questo|questa|energia|cellule|lezione)\b/g,
      /[àèéìíîòóù]/g,
    ]),
    en: countPodcastLanguageMarkers(normalized, [
      /\b(the|and|that|with|for|this|these|those|energy|cells|lesson|today|study|guide)\b/g,
    ]),
  };
  const best = Object.entries(scores).sort(
    ([, left], [, right]) => (right || 0) - (left || 0),
  )[0] as [StudyMeshLanguageCode, number] | undefined;

  return best && best[1] >= 4 ? best[0] : undefined;
};

const podcastScriptMatchesOutputLanguage = (
  script: PodcastScript,
  outputLanguage: StudyMeshLanguageCode | undefined,
): boolean => {
  if (!outputLanguage) {
    return true;
  }

  const detected = detectPodcastScriptLanguage(
    [script.title, script.description, getPodcastTranscriptText(script)].join(
      "\n\n",
    ),
  );

  return !detected || detected === outputLanguage;
};

const buildPodcastLanguageRetryPrompt = ({
  script,
  outputLanguage,
  sourceTitle,
  sourceText,
}: {
  script: PodcastScript;
  outputLanguage: StudyMeshLanguageCode;
  sourceTitle: string;
  sourceText: string;
}): string =>
  [
    buildPodcastScriptPrompt({ sourceTitle, sourceText, outputLanguage }),
    `The previous podcast script was rejected because it was not in ${getContentLanguagePromptName(
      outputLanguage,
    )}.`,
    `Rewrite it now in ${getContentLanguagePromptName(outputLanguage)} only.`,
    "Keep the same JSON schema and keep only facts present in the source.",
    "Rejected transcript:",
    getPodcastTranscriptText(script),
  ].join("\n\n");

// Trim a rounded figure back down: 1.00 reads as 1, 1.10 as 1.1.
const trimTrailingZeros = (value: string): string =>
  value.includes(".") ? value.replace(/0+$/, "").replace(/\.$/, "") : value;

const roundForSpeech = (value: number, decimals = 2): string =>
  trimTrailingZeros(value.toFixed(decimals));

const GROUPED_NUMERAL_PATTERN = /\d{1,3}(?:,\d{3})+/g;
const URL_PATTERN = /https?:\/\/[^\s<>()[\]"'`]+/gi;

/**
 * Rewrite the listening hazards out of the podcast source before the model sees
 * them.
 *
 * Measured over four live generations (two topics, before and after a prompt
 * change, the last pair pinned to identical source text): the fast model applies
 * rules that *substitute* one token for another — an arrow becomes "leads to",
 * "x^2" becomes "x squared" — with no misses. It does not apply rules that
 * require *transforming* a value before speaking it. Asked to round, it instead
 * read 1.0060417 out digit by digit; asked to speak addresses as words, it read
 * a URL verbatim. Every residual artifact was a literal copied straight out of
 * the source, and the same literals leaked again from the same source on a
 * second pass, so more prompt wording is not the lever.
 *
 * Doing the transformation here leaves nothing to copy.
 *
 * Deliberately limited to URLs and comma-grouped numerals. Rounding long decimals
 * was tried and removed: run over the real guide sources it rewrote
 * `\frac{0.0725}{12}` and `1000(1.0060417)^{36}` into `about 0.07` and
 * `about 1.01`, which puts English inside a LaTeX command and, worse, is false —
 * 1.01^36 is about 1.43, not the 1240.90 the same paragraph states. A figure a
 * formula depends on cannot be rounded without changing the claim, so those stay
 * verbatim and the prompt handles them.
 */
export const normalizePodcastSourceText = (sourceText: string): string =>
  sourceText
    .replace(URL_PATTERN, (url) => {
      // A host is sayable once the dots are words; a scheme and path never are.
      const host = url.replace(/^https?:\/\//i, "").split(/[/?#]/)[0];
      return host.replace(/\./g, " dot ").replace(/[-_]+/g, " ").trim();
    })
    .replace(GROUPED_NUMERAL_PATTERN, (numeral) => {
      const value = Number(numeral.replace(/,/g, ""));
      if (!Number.isFinite(value)) {
        return numeral;
      }
      if (value >= 1_000_000_000) {
        return `about ${roundForSpeech(value / 1_000_000_000)} billion`;
      }
      if (value >= 1_000_000) {
        return `about ${roundForSpeech(value / 1_000_000)} million`;
      }
      if (value >= 10_000) {
        return `about ${roundForSpeech(value / 1_000, 0)} thousand`;
      }
      // Under ten thousand the digits are already easy to say; only the
      // separator has to go, since it is what the model echoes.
      return String(value);
    })
    // The source often already hedges the figure it states. Rounding it a second
    // time must not produce "roughly about" or "≈ about".
    .replace(/\b(about|roughly|approximately|around)\s+about\b/gi, "$1")
    // Only signs that already mean "approximately". A plain "=" must keep the
    // hedge, or rounding would restate an equation as an exact one.
    .replace(/(≈|~)\s*about\b/g, "$1")
    // LaTeX spells the same idea as a command, so the character-class rule above
    // misses it and the source reads "approximately about 1.05 million".
    .replace(/\\(approx|sim)\s*about\b/g, "\\$1");

export const buildPodcastScriptPrompt = ({
  sourceTitle,
  sourceText,
  outputLanguage,
}: {
  sourceTitle: string;
  sourceText: string;
  outputLanguage: HostedAiGatewayRequest["outputLanguage"];
}): string => {
  const languageInstruction = outputLanguage
    ? [
        createAiOutputLanguageInstruction(outputLanguage),
        `Hard rule for this podcast: title, description, chapters, and every transcript turn must be in ${getContentLanguagePromptName(
          outputLanguage,
        )}.`,
        "If the source contains another language or mixed languages, explain it in the required output language; never switch to Portuguese, English, or any third language unless that is the required output language.",
      ].join(" ")
    : "Write the podcast in the same language as the source.";

  return [
    "Create a short RabbitHole educational podcast script from ONLY the provided Study Guide source.",
    languageInstruction,
    "Return strict JSON with: title, description, transcriptTurns, chapters.",
    // A live episode opened a turn with "Quick question for you, hostA", so the
    // schema line has to say the labels are metadata, not names the hosts use.
    "transcriptTurns must use speakers hostA and hostB only. Those labels are metadata; never speak them inside a turn.",
    "Target 520-850 spoken words across 10-18 turns, warm but focused two-host dialogue. 520 words is a hard minimum; keep going until the script reaches it. Alternate hostA and hostB when natural.",
    "Do not invent facts. Do not mention web lookup. Do not cite sources unless the source text already contains them.",
    "If the source is thin, still create the best concise recap from available content without adding outside facts.",
    "This script is read aloud by text-to-speech, so write every turn to be heard, not read.",
    "Do not use emojis or decorative symbols.",
    "Never leave symbols as symbols. Say arrows, ampersands, and similar marks as words in the podcast's language, for example \"leads to\" for an arrow and \"and\" for an ampersand.",
    "Express math in spoken words instead of notation: \"x squared\" rather than \"x^2\", \"the square root of two\" rather than a root symbol, \"fifty percent\" rather than \"50%\".",
    "Punctuation is never spoken, so it cannot group anything. Never use parentheses or brackets to group an expression; carry every grouping with words. Say \"the quantity x plus h, squared\" instead of \"(x plus h) squared\", and \"all over h\" instead of a fraction bar. When an expression could be heard two ways, restate it more explicitly.",
    "Whenever anything is applied to a sum or difference, whether a function, a derivative, or an operation, first say the podcast language's phrase for \"the quantity\", then the sum. Without it the listener hears the sum as a separate term: \"the derivative of f of x plus g of x\" is heard as the derivative of f of x, plus g of x. All examples in these rules are written in English only to show the pattern; always translate the wording into the podcast's language and never copy an English phrase into a script in another language.",
    "Whenever an exponent is more than a single symbol, use the podcast language's phrase for \"raised to the power of\" rather than its short form for \"to the\". The short form makes \"x to the n minus one\" ambiguous, because it is equally heard as x to the n, minus one.",
    "Never state more than two decimal places, in digits or in spoken words. Name well-known constants and round them: say \"e, roughly two point seven\" and \"pi, roughly three point one four\". Never write \"2.71828\", \"3.14159\", \"two point seven one eight\", or \"three point one four one\". Round or approximate any long figure, for example \"roughly 1.2 million\". Keep ordinary numbers, short counts, and dates as normal spoken words; simplify numbers, never drop them.",
    "Write abbreviations out as words instead of dotted forms, in the podcast's language, for example \"in the afternoon\" instead of \"p.m.\", \"for example\" instead of \"e.g.\", and \"and so on\" instead of \"etc.\".",
    "Speak every title, term, file name, and address as ordinary words. Never read a slug or identifier literally: say \"derivatives in calculus\" instead of \"derivatives-calculus\", and expand hyphenated, underscored, or camelCase names into natural speech.",
    "Keep each turn under about 600 characters. If a spoken-out explanation runs long, split it across turns instead of packing one turn.",
    // The enumerated ban below was already in place when a live turn said "The
    // notes mention that ...", so listing more nouns is not what was missing. The
    // added sentence names the construction instead: attributing a fact to
    // anything at all is what has to stop, whatever the thing is called.
    "The hosts are explaining what they already know, not reading from a handout. Never say \"the guide\", \"the source\", \"the document\", \"the notes\", or any equivalent phrase in the podcast's language; state the idea directly as their own explanation. Never attribute a fact to any written thing at all: no \"it says\", \"they mention\", \"according to\", or similar. Every statement is simply what the host knows.",
    // Three wordings have now asked for questions by describing what a question
    // does — "one per chapter", "a genuine question answered in the next turn",
    // "at least three exchanges" — and live runs landed at 2, 1, and 0. The last
    // run showed why: turns opened "I want to check the model" and "Quick check
    // time", the shape of a question beat rendered as a statement. The model can
    // produce the beat but not judge whether it asked something. So this asks for
    // the one property it can check on its own output, a trailing question mark,
    // and says outright that the turn costs no material, since the word floor
    // above is what makes a question feel expensive.
    "Make it a real conversation, not alternating lectures. At least three turns before the closing turn must end with a question mark, each one asking the other host something specific about what was just said, and the very next turn must answer it. A question turn can be a single short sentence and does not have to add new material. Hosts react to each other, and turn lengths vary instead of trading near-identical blocks.",
    "Never write more than 18 turns; the episode is cut there. Land the ending inside that budget and finish on a closing turn that restates the main takeaway. Do not end on a question.",
    "Restate each key result once in different words later in the script, because a listener cannot re-read a line.",
    "Prefer natural spoken phrasing and avoid anything that would feel disruptive to a listener.",
    `Source title: ${sourceTitle}`,
    "Source:",
    // Normalized here rather than at the call site so the language retry, which
    // rebuilds this prompt, gets the same treated source.
    normalizePodcastSourceText(sourceText),
  ].join("\n\n");
};

interface PodcastAudioGenerationResult {
  audioBuffer: Buffer;
  mimeType: string;
  characterCount: number;
  providerCallCount: number;
}

interface PodcastSpeechSegment {
  speaker: HostedAiPodcastTranscriptTurn["speaker"];
  text: string;
  voiceId: string;
}

const getLanguageVoiceEnv = (
  speaker: HostedAiPodcastTranscriptTurn["speaker"],
  language: StudyMeshLanguageCode | undefined,
): string => {
  if (!language) {
    return "";
  }

  const host = speaker === "hostB" ? "HOST_B" : "HOST_A";
  return getEnv(`UNREAL_SPEECH_${host}_VOICE_ID_${language.toUpperCase()}`);
};

const getPodcastVoiceIds = (
  language: StudyMeshLanguageCode | undefined,
): Record<HostedAiPodcastTranscriptTurn["speaker"], string> => {
  const languageVoices =
    language && UNREAL_SPEECH_LANGUAGE_VOICES[language]
      ? UNREAL_SPEECH_LANGUAGE_VOICES[language]
      : UNREAL_SPEECH_LANGUAGE_VOICES.en;

  return {
    hostA:
      getLanguageVoiceEnv("hostA", language) ||
      (language === "en" ? getEnv("UNREAL_SPEECH_HOST_A_VOICE_ID") : "") ||
      (language === "en" ? getEnv("UNREAL_SPEECH_VOICE_ID") : "") ||
      languageVoices?.hostA ||
      UNREAL_SPEECH_DEFAULT_VOICE_ID,
    hostB:
      getLanguageVoiceEnv("hostB", language) ||
      (language === "en" ? getEnv("UNREAL_SPEECH_HOST_B_VOICE_ID") : "") ||
      languageVoices?.hostB ||
      UNREAL_SPEECH_DEFAULT_HOST_B_VOICE_ID,
  };
};

const getPodcastSpeechSegments = (
  script: PodcastScript,
  language: StudyMeshLanguageCode | undefined,
): PodcastSpeechSegment[] => {
  const voiceIds = getPodcastVoiceIds(language);

  return script.transcriptTurns.map((turn) => ({
    speaker: turn.speaker,
    text: turn.text,
    voiceId: voiceIds[turn.speaker],
  }));
};

const getPodcastTtsCharacterCount = (script: PodcastScript): number =>
  script.transcriptTurns.reduce((total, turn) => total + turn.text.length, 0);

const getPodcastMonthlyCharacterCap = (): number => {
  const configured = Number(getEnv("PODCAST_TTS_MONTHLY_CHARACTER_CAP"));

  return Number.isFinite(configured) && configured > 0
    ? configured
    : PODCAST_TTS_MONTHLY_CHARACTER_CAP;
};

const getPodcastUsageMonth = (): string => new Date().toISOString().slice(0, 7);

const reservePodcastTtsCharacters = async (
  userId: string,
  characterCount: number,
): Promise<void> => {
  await callSupabaseRpc<unknown>("podcast_tts_reserve_monthly_usage", {
    p_owner_id: userId,
    p_usage_month: getPodcastUsageMonth(),
    p_character_count: characterCount,
    p_monthly_cap: getPodcastMonthlyCharacterCap(),
  });
};

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const getUnrealSpeechOutputUri = (payload: unknown): string => {
  const source =
    isObject(payload) && isObject(payload.SynthesisTask)
      ? payload.SynthesisTask
      : payload;
  if (!isObject(source)) {
    return "";
  }

  const outputUri = source.OutputUri || source.outputUri || source.output_uri;
  if (typeof outputUri === "string") {
    return outputUri;
  }

  if (Array.isArray(outputUri) && typeof outputUri[0] === "string") {
    return outputUri[0];
  }

  return "";
};

const getUnrealSpeechTaskStatus = (payload: unknown): string => {
  const source =
    isObject(payload) && isObject(payload.SynthesisTask)
      ? payload.SynthesisTask
      : payload;
  if (!isObject(source)) {
    return "";
  }

  return (
    stringValue(source.TaskStatus) ||
    stringValue(source.taskStatus) ||
    stringValue(source.task_status) ||
    stringValue(source.status)
  ).toLowerCase();
};

const isUnrealSpeechTaskReady = (payload: unknown): boolean => {
  const status = getUnrealSpeechTaskStatus(payload);
  return (
    !status ||
    status === "completed" ||
    status === "complete" ||
    status === "succeeded" ||
    status === "success"
  );
};

const getUnrealSpeechTaskId = (payload: unknown): string => {
  const source =
    isObject(payload) && isObject(payload.SynthesisTask)
      ? payload.SynthesisTask
      : payload;
  if (!isObject(source)) {
    return "";
  }

  return (
    stringValue(source.TaskId) ||
    stringValue(source.taskId) ||
    stringValue(source.task_id)
  );
};

const fetchUnrealSpeechTask = async (taskId: string): Promise<unknown> => {
  const response = await fetch(
    `${UNREAL_SPEECH_API_BASE}/synthesisTasks/${encodeURIComponent(taskId)}`,
    {
      method: "GET",
      headers: {
        authorization: `Bearer ${getEnv("UNREAL_SPEECH_API_KEY")}`,
      },
    },
  );
  const payload = await readResponseJson(response);

  if (!response.ok) {
    const message =
      getSupabaseErrorMessage(payload) || "Unreal Speech task lookup failed.";
    const error = new Error(message);
    error.name = response.status === 429 ? "rate_limited" : "provider_error";
    throw error;
  }

  return payload;
};

const waitForUnrealSpeechOutputUri = async (
  taskId: string,
): Promise<string> => {
  for (let attempt = 0; attempt < UNREAL_SPEECH_POLL_ATTEMPTS; attempt += 1) {
    if (attempt > 0) {
      await delay(UNREAL_SPEECH_POLL_DELAY_MS);
    }

    const payload = await fetchUnrealSpeechTask(taskId);
    const outputUri = getUnrealSpeechOutputUri(payload);
    if (outputUri && isUnrealSpeechTaskReady(payload)) {
      return outputUri;
    }
  }

  const error = new Error("Unreal Speech audio generation timed out.");
  error.name = "provider_error";
  throw error;
};

const downloadUnrealSpeechAudio = async (
  outputUri: string,
): Promise<Buffer> => {
  const response = await fetch(outputUri, { method: "GET" });
  if (!response.ok) {
    const message =
      (await readResponseText(response)) || "Could not download podcast audio.";
    const error = new Error(message);
    error.name = response.status === 429 ? "rate_limited" : "provider_error";
    throw error;
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const prefix = buffer
    .toString("utf8", 0, Math.min(buffer.length, 256))
    .trim();
  if (buffer.length === 0) {
    const error = new Error("Unreal Speech returned empty audio.");
    error.name = "provider_error";
    throw error;
  }

  if (/^<\?xml|^<Error\b|AccessDenied/i.test(prefix)) {
    const error = new Error("Unreal Speech audio file is not ready yet.");
    error.name = "provider_error";
    throw error;
  }

  const isMp3 =
    prefix.startsWith("ID3") ||
    (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0);
  if (!isMp3) {
    const error = new Error("Unreal Speech did not return a playable MP3.");
    error.name = "provider_error";
    throw error;
  }

  if (buffer.length > MAX_PODCAST_AUDIO_BYTES) {
    const error = new Error("Podcast audio is too large.");
    error.name = "provider_error";
    throw error;
  }

  return buffer;
};

const downloadUnrealSpeechAudioWithRetry = async (
  outputUri: string,
): Promise<Buffer> => {
  let lastError: unknown;

  for (let attempt = 0; attempt < UNREAL_SPEECH_POLL_ATTEMPTS; attempt += 1) {
    if (attempt > 0) {
      await delay(UNREAL_SPEECH_POLL_DELAY_MS);
    }

    try {
      return await downloadUnrealSpeechAudio(outputUri);
    } catch (error) {
      lastError = error;
      if (
        !(error instanceof Error) ||
        !/access denied|not found|forbidden|not ready/i.test(error.message)
      ) {
        throw error;
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Could not download podcast audio.");
};

const createUnrealSpeechRequestBody = (
  text: string,
  voiceId: string,
): JsonObject => {
  const model = getEnv("UNREAL_SPEECH_MODEL");
  const body: JsonObject = {
    Text: text,
    VoiceId: voiceId,
    Bitrate: "64k",
  };

  if (model) {
    body.Model = model;
  }

  return body;
};

const synthesizeUnrealSpeechMp3 = async (
  text: string,
  voiceId: string,
): Promise<Buffer> => {
  const response = await fetch(`${UNREAL_SPEECH_API_BASE}/synthesisTasks`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${getEnv("UNREAL_SPEECH_API_KEY")}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(createUnrealSpeechRequestBody(text, voiceId)),
  });
  const payload = await readResponseJson(response);

  if (!response.ok) {
    const message =
      getSupabaseErrorMessage(payload) || "Unreal Speech synthesis failed.";
    const error = new Error(message);
    error.name = response.status === 429 ? "rate_limited" : "provider_error";
    throw error;
  }

  const taskId = getUnrealSpeechTaskId(payload);
  const outputUri =
    getUnrealSpeechOutputUri(payload) && isUnrealSpeechTaskReady(payload)
      ? getUnrealSpeechOutputUri(payload)
      : "";
  const taskOutputUri =
    outputUri || !taskId ? "" : await waitForUnrealSpeechOutputUri(taskId);

  if (!outputUri && !taskOutputUri) {
    const error = new Error("Unreal Speech returned no audio URL.");
    error.name = "provider_error";
    throw error;
  }

  return downloadUnrealSpeechAudioWithRetry(outputUri || taskOutputUri);
};

const getId3v2TagSize = (buffer: Buffer): number => {
  if (buffer.length < 10 || buffer.toString("utf8", 0, 3) !== "ID3") {
    return 0;
  }

  const tagSize =
    ((buffer[6] & 0x7f) << 21) |
    ((buffer[7] & 0x7f) << 14) |
    ((buffer[8] & 0x7f) << 7) |
    (buffer[9] & 0x7f);
  const hasFooter = (buffer[5] & 0x10) === 0x10;
  const fullSize = 10 + tagSize + (hasFooter ? 10 : 0);

  return fullSize > 0 && fullSize < buffer.length ? fullSize : 0;
};

const stripLeadingId3v2Tag = (buffer: Buffer): Buffer => {
  const tagSize = getId3v2TagSize(buffer);
  return tagSize ? buffer.subarray(tagSize) : buffer;
};

const isMp3Buffer = (buffer: Buffer): boolean => {
  const withoutId3 = stripLeadingId3v2Tag(buffer);

  return (
    buffer.toString("utf8", 0, Math.min(buffer.length, 3)) === "ID3" ||
    (withoutId3.length >= 2 &&
      withoutId3[0] === 0xff &&
      (withoutId3[1] & 0xe0) === 0xe0)
  );
};

const joinPodcastMp3Segments = (segments: Buffer[]): Buffer => {
  if (!segments.length) {
    const error = new Error(
      "Unreal Speech returned no podcast audio segments.",
    );
    error.name = "provider_error";
    throw error;
  }

  const parts = segments.map((segment, index) => {
    if (!isMp3Buffer(segment)) {
      const error = new Error("Unreal Speech did not return a playable MP3.");
      error.name = "provider_error";
      throw error;
    }

    return index === 0 ? segment : stripLeadingId3v2Tag(segment);
  });
  const audioBuffer = Buffer.concat(parts);

  if (audioBuffer.length > MAX_PODCAST_AUDIO_BYTES) {
    const error = new Error("Podcast audio is too large.");
    error.name = "provider_error";
    throw error;
  }

  return audioBuffer;
};

const synthesizePodcastSegments = async (
  segments: PodcastSpeechSegment[],
): Promise<Buffer[]> => {
  const audioSegments = new Array<Buffer>(segments.length);
  let nextIndex = 0;

  const worker = async (): Promise<void> => {
    while (nextIndex < segments.length) {
      const segmentIndex = nextIndex;
      nextIndex += 1;
      const segment = segments[segmentIndex];
      audioSegments[segmentIndex] = await synthesizeUnrealSpeechMp3(
        segment.text,
        segment.voiceId,
      );
    }
  };

  await Promise.all(
    Array.from(
      { length: Math.min(UNREAL_SPEECH_SEGMENT_CONCURRENCY, segments.length) },
      () => worker(),
    ),
  );

  return audioSegments;
};

const generatePodcastAudioFromScript = async (
  script: PodcastScript,
  language: StudyMeshLanguageCode | undefined,
): Promise<PodcastAudioGenerationResult> => {
  const segments = getPodcastSpeechSegments(script, language);
  const audioSegments = await synthesizePodcastSegments(segments);

  return {
    audioBuffer: joinPodcastMp3Segments(audioSegments),
    mimeType: "audio/mpeg",
    characterCount: getPodcastTtsCharacterCount(script),
    providerCallCount: segments.length,
  };
};

const getPodcastBucket = (): string =>
  getEnv("PODCAST_AUDIO_BUCKET") || "study-guide-podcasts";

const encodeStoragePath = (path: string): string =>
  path.split("/").map(encodeURIComponent).join("/");

const podcastPathSegment = (value: string, fallback: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || fallback;

const uploadPodcastAudio = async (
  path: string,
  audio: Buffer,
): Promise<void> => {
  const supabaseUrl = normalizeSupabaseUrl(getEnv("SUPABASE_URL"));
  const serviceKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");
  const bucket = getPodcastBucket();
  const response = await fetch(
    `${supabaseUrl}/storage/v1/object/${bucket}/${encodeStoragePath(path)}`,
    {
      method: "POST",
      headers: {
        apikey: serviceKey,
        authorization: `Bearer ${serviceKey}`,
        "cache-control": "2592000",
        "content-type": "audio/mpeg",
        "x-upsert": "true",
      },
      body: audio,
    },
  );

  if (!response.ok) {
    const message =
      (await readResponseText(response)) || "Could not store podcast audio.";
    const error = new Error(message);
    error.name = "provider_error";
    throw error;
  }
};

const registerPodcastAudio = async ({
  userId,
  audioPath,
  studyGuideId,
  podcastId,
}: {
  userId: string;
  audioPath: string;
  studyGuideId: string;
  podcastId: string;
}): Promise<void> => {
  await callSupabaseRpc<unknown>("podcast_audio_register", {
    p_owner_id: userId,
    p_audio_path: audioPath,
    p_study_guide_id: studyGuideId,
    p_podcast_id: podcastId,
    p_keep_count: PODCAST_RETAINED_AUDIO_COUNT,
  });
};

const markPodcastAudioDeleted = async (
  userId: string,
  audioPath: string,
  reason: "expired" | "page-deleted",
): Promise<void> => {
  await callSupabaseRpc<unknown>("podcast_audio_mark_deleted", {
    p_owner_id: userId,
    p_audio_path: audioPath,
    p_deleted_reason: reason,
  });
};

const getExpiredPodcastAudioPaths = async (
  userId: string,
): Promise<string[]> => {
  const supabaseUrl = normalizeSupabaseUrl(getEnv("SUPABASE_URL"));
  const serviceKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");
  const cutoff = new Date(
    Date.now() - PODCAST_AUDIO_CANDIDATE_RETENTION_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
  const query = new URLSearchParams({
    select: "audio_path",
    owner_id: `eq.${userId}`,
    deleted_at: "is.null",
    candidate_at: `lte.${cutoff}`,
    order: "candidate_at.asc,created_at.asc",
    limit: String(PODCAST_EXPIRED_CLEANUP_LIMIT),
  });
  const response = await fetch(
    `${supabaseUrl}/rest/v1/podcast_audio_objects?${query.toString()}`,
    {
      method: "GET",
      headers: {
        apikey: serviceKey,
        authorization: `Bearer ${serviceKey}`,
      },
    },
  );
  const payload = await readResponseJson(response);

  if (!response.ok || !Array.isArray(payload)) {
    return [];
  }

  return payload
    .map((row) =>
      isObject(row) && typeof row.audio_path === "string" ? row.audio_path : "",
    )
    .filter(Boolean);
};

const deletePodcastStorageObjects = async (paths: string[]): Promise<void> => {
  if (paths.length === 0) {
    return;
  }

  const supabaseUrl = normalizeSupabaseUrl(getEnv("SUPABASE_URL"));
  const serviceKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");
  const bucket = getPodcastBucket();
  const response = await fetch(`${supabaseUrl}/storage/v1/object/${bucket}`, {
    method: "DELETE",
    headers: {
      apikey: serviceKey,
      authorization: `Bearer ${serviceKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ prefixes: paths }),
  });
  if (!response.ok) {
    const message =
      (await readResponseText(response)) || "Could not delete podcast audio.";
    const error = new Error(message);
    error.name = "provider_error";
    throw error;
  }
};

const cleanupExpiredPodcastAudio = async (userId: string): Promise<void> => {
  const expiredPaths = await getExpiredPodcastAudioPaths(userId);
  if (expiredPaths.length === 0) {
    return;
  }

  await deletePodcastStorageObjects(expiredPaths);
  await Promise.all(
    expiredPaths.map((path) =>
      markPodcastAudioDeleted(userId, path, "expired").catch(() => undefined),
    ),
  );
};

const assertPodcastDailyLimit = async (userId: string): Promise<void> => {
  const limit = Number(getEnv("PODCAST_MAX_GENERATIONS_PER_USER_PER_DAY") || 3);
  if (!Number.isFinite(limit) || limit <= 0) {
    return;
  }

  const supabaseUrl = normalizeSupabaseUrl(getEnv("SUPABASE_URL"));
  const serviceKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const query = new URLSearchParams({
    select: "id",
    owner_id: `eq.${userId}`,
    surface: "eq.podcast",
    created_at: `gte.${since}`,
  });
  const response = await fetch(
    `${supabaseUrl}/rest/v1/hosted_ai_usage_events?${query.toString()}`,
    {
      method: "GET",
      headers: {
        apikey: serviceKey,
        authorization: `Bearer ${serviceKey}`,
      },
    },
  );
  const payload = await readResponseJson(response);
  const count = Array.isArray(payload) ? payload.length : 0;

  if (response.ok && count >= limit) {
    const error = new Error(
      "Daily podcast generation limit reached. Try again tomorrow.",
    );
    error.name = "rate_limited";
    throw error;
  }
};

const ensurePodcastConfigured = (): HostedAiGatewayResponse | null => {
  const required = ["UNREAL_SPEECH_API_KEY"];
  const missing = required.filter((name) => !getEnv(name));

  if (missing.length > 0) {
    return errorResponse(
      "not_configured",
      `Podcast generation is missing server configuration: ${missing.join(
        ", ",
      )}.`,
    );
  }

  return null;
};

const ensureConfigured = (): HostedAiGatewayResponse | null => {
  const provider = getHostedTextProvider();
  const required = [
    provider === "openai" ? "HOSTED_OPENAI_API_KEY" : "HOSTED_CEREBRAS_API_KEY",
    "SUPABASE_URL",
    "SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
  ];
  const missing = required.filter((name) => !getEnv(name));

  if (missing.length > 0) {
    return errorResponse(
      "not_configured",
      `Hosted AI gateway is missing server configuration: ${missing.join(
        ", ",
      )}.`,
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

    // Must stay above the credits branch: GUEST_LIMIT_MESSAGE mentions Carrots,
    // so a guest out of free Quick Guides would otherwise be answered with 402
    // and the Carrot pack dialog instead of the sign-up panel.
    if (error.name === "guest_limit_reached") {
      return {
        statusCode: 403,
        response: errorResponse("guest_limit_reached", GUEST_LIMIT_MESSAGE),
      };
    }

    // Matches the message raised by the DB, which still says "insufficient Study Credits".
    // "carrots" is accepted too so the branch survives if that raise is ever reworded.
    if (/insufficient|credit|carrots|quota/i.test(message)) {
      return {
        statusCode: 402,
        response: errorResponse(
          "insufficient_credits",
          INSUFFICIENT_STUDY_CREDITS_MESSAGE,
        ),
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

    if (error.name === "provider_error") {
      if (
        /401|unauthori[sz]ed|authentication|api key|invalid key|incorrect api key/i.test(
          message,
        )
      ) {
        return {
          statusCode: 502,
          response: errorResponse("provider_auth", message),
        };
      }

      if (
        /output format|invalid json|malformed json|unreadable podcast script|too little podcast dialogue|unusable Study Guide/i.test(
          message,
        )
      ) {
        return {
          statusCode: 502,
          response: errorResponse("output_format", message),
        };
      }

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

interface NormalizedMonolithGuide {
  title: string;
  folderName: string;
  emoji: string;
  quickStart: NonNullable<HostedAiGatewayResponse["quickStart"]>;
  pages: EnhancedStudyGuidePage[];
  contextPlan?: {
    useForDefault: boolean;
    selectedTopics: string[];
    personalizedQuickStart?: NonNullable<HostedAiGatewayResponse["quickStart"]>;
    bridgeBlock?: { title: string; body: string };
  };
}

const createMonolithGuideSchema = (includeContext: boolean) => ({
  type: "OBJECT",
  properties: {
    title: { type: "STRING" },
    folderName: { type: "STRING" },
    emoji: { type: "STRING" },
    quickStart: {
      type: "OBJECT",
      properties: {
        keyIdea: { type: "STRING" },
        quickSummary: { type: "STRING" },
      },
      required: ["keyIdea", "quickSummary"],
    },
    ...(includeContext
      ? {
          contextPlan: {
            type: "OBJECT",
            properties: {
              useForDefault: { type: "BOOLEAN" },
              selectedTopics: textArraySchema,
              reason: { type: "STRING" },
              personalizedQuickStart: {
                type: "OBJECT",
                properties: {
                  keyIdea: { type: "STRING" },
                  quickSummary: { type: "STRING" },
                },
                required: ["keyIdea", "quickSummary"],
              },
              bridgeBlock: {
                type: "OBJECT",
                properties: {
                  title: { type: "STRING" },
                  body: { type: "STRING" },
                },
                required: ["title", "body"],
              },
            },
            required: [
              "useForDefault",
              "selectedTopics",
              "reason",
              "personalizedQuickStart",
              "bridgeBlock",
            ],
          },
        }
      : {}),
    pages: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          title: { type: "STRING" },
          summary: { type: "STRING" },
          rawNotes: { type: "STRING" },
        },
        required: ["title", "summary", "rawNotes"],
      },
    },
  },
  required: [
    "title",
    "folderName",
    "emoji",
    "quickStart",
    ...(includeContext ? ["contextPlan"] : []),
    "pages",
  ],
});

const buildMonolithGuidePrompt = ({
  topic,
  titleFallback,
  folderNameFallback,
  userKnownTopics,
  outputLanguage,
}: {
  topic: string;
  titleFallback: string;
  folderNameFallback: string;
  userKnownTopics: string[];
  outputLanguage?: StudyMeshLanguageCode;
}): string => `Write a complete, final RabbitHole Study Guide. This is shipped learner-facing content, not a draft or outline.

Return strict JSON only:
{
  "title": "...",
  "folderName": "...",
  "emoji": "one emoji",
  "quickStart": { "keyIdea": "one sentence, max 35 words", "quickSummary": "two short paragraphs" },${
    userKnownTopics.length
      ? `
  "contextPlan": {
    "useForDefault": true,
    "selectedTopics": ["..."],
    "reason": "...",
    "personalizedQuickStart": { "keyIdea": "...", "quickSummary": "..." },
    "bridgeBlock": { "title": "...", "body": "..." }
  },`
      : ""
  }
  "pages": [
    { "title": "01 - ...", "summary": "one preview sentence", "rawNotes": "Markdown lesson notes" }
  ]
}

Rules:
- ${createAiOutputLanguageInstruction(outputLanguage)}
- Exactly 3 pages, each 280-360 words of rawNotes in readable Markdown with short topic-specific sections.
- Precise, conservative facts only, with a beginner-friendly progression across the pages.
- Finish every paragraph and the final line of each page as a complete sentence. Never end rawNotes mid-thought.
- For programming, framework, DevOps, IaC, config, or command-line topics, include at least one real minimal fenced code/config/command snippet with a language tag.
- Never write placeholder snippets or placeholder comments like "arguments would go here", "component logic goes here", or "configuration would go here".
- For non-code topics, use concrete examples, timelines, scenarios, or comparisons instead of code.
- quickStart explains the concept itself directly and neutrally, not the guide structure. Do not write "This guide teaches...", "You will learn...", or similar framing.
- keyIdea: exactly one complete sentence, 20-35 words, ending in a period. Never write a second sentence and never run past 35 words, because keyIdea is hard-capped at 35 words downstream.
- quickSummary: 60-85 words, 2 short paragraphs, every paragraph ends with a complete sentence.
- Choose a concise, topic-specific folderName and exactly one topic-matching emoji.
- Do not include quiz questions inside rawNotes.${
  userKnownTopics.length
    ? `
- The learner already knows these candidate topics: ${userKnownTopics.join(
        ", ",
      )}.
- contextPlan.selectedTopics: always rank the candidates and choose the 1 that best reduces confusion for this topic (2 only if both are clearly relevant and same-domain). Never invent topics. Do not return [] merely because every candidate is a weak or cross-domain match; return [] only if every candidate would actively mislead, be unsafe, or be dehumanizing.
- contextPlan.useForDefault: true only when the selected candidate genuinely reduces cognitive effort through a precise, same-domain comparison; otherwise false. A weak but honest bridge still gets a selected topic with useForDefault false.
- contextPlan.personalizedQuickStart: always write this variant. It is an opt-in view the learner opens themselves, so write it even when useForDefault is false; it never replaces the neutral Quick Start unless useForDefault is true. Build it through the selected topic. If the bridge is strong, the selected topic must lead. If it is weak or cross-domain, explain the topic neutrally first, use the selected topic as one short honest contrast, and say plainly where the comparison breaks. quickSummary 60-85 words, complete sentences.
- If selectedTopics is [], still write personalizedQuickStart as a neutral beginner-friendly Quick Start with one caveat or common misconception, and invent no bridge.
- contextPlan.bridgeBlock: one short study note connecting a concept from page 2 to the selected topic, with one caveat. body under 85 words, ending with a complete sentence.
- contextPlan.reason: one sentence on why the selected topic was chosen.
- For topics involving identity, history, politics, culture, or people, keep the bridge factual and avoid reductive claims. For human or management topics, do not compare people to infrastructure, tools, or machines.`
    : ""
}

Title fallback: ${titleFallback}
Folder fallback: ${folderNameFallback}
Learner request/topic:
${topic}`;

const normalizeMonolithGuide = (
  value: unknown,
  titleFallback: string,
  folderNameFallback: string,
  safeKnownTopics: string[],
): NormalizedMonolithGuide => {
  const record = isObject(value) ? value : {};
  const pages = (Array.isArray(record.pages) ? record.pages : [])
    .slice(0, 3)
    .map((page, index) =>
      normalizeEnhancedPage(
        page,
        `${String(index + 1).padStart(2, "0")} - Lesson ${index + 1}`,
      ),
    );
  const quickStart = parseStudyGuideQuickStart(
    JSON.stringify(isObject(record.quickStart) ? record.quickStart : {}),
  );

  if (pages.length !== 3 || !quickStart) {
    const error = new Error(
      "Hosted AI returned an unusable Study Guide draft.",
    );
    error.name = "provider_error";
    throw error;
  }

  let contextPlan: NormalizedMonolithGuide["contextPlan"];
  const planRecord = isObject(record.contextPlan) ? record.contextPlan : null;
  if (planRecord && safeKnownTopics.length) {
    const knownByLower = new Map(
      safeKnownTopics.map((candidate) => [candidate.toLowerCase(), candidate]),
    );
    const selectedTopics = (
      Array.isArray(planRecord.selectedTopics) ? planRecord.selectedTopics : []
    )
      .map((candidate) =>
        knownByLower.get(stringValue(candidate).toLowerCase()),
      )
      .filter((candidate): candidate is string => Boolean(candidate))
      .slice(0, 2);
    const personalizedQuickStart =
      parseStudyGuideQuickStart(
        JSON.stringify(
          isObject(planRecord.personalizedQuickStart)
            ? planRecord.personalizedQuickStart
            : {},
        ),
      ) || undefined;
    const bridgeRecord = isObject(planRecord.bridgeBlock)
      ? planRecord.bridgeBlock
      : null;
    const bridgeTitle = trimTitleToWordBoundary(
      stringValue(bridgeRecord?.title),
      80,
    );
    const bridgeBody = trimToCompleteSentenceWithinChars(
      stringValue(bridgeRecord?.body),
      700,
    );
    contextPlan = {
      useForDefault: planRecord.useForDefault === true,
      selectedTopics,
      personalizedQuickStart,
      bridgeBlock:
        bridgeTitle && bridgeBody
          ? { title: bridgeTitle, body: bridgeBody }
          : undefined,
    };
  }

  return {
    title: stringValue(record.title) || titleFallback,
    folderName: stringValue(record.folderName) || folderNameFallback,
    emoji: stringValue(record.emoji).slice(0, 8) || "📘",
    quickStart,
    pages,
    contextPlan,
  };
};

const generateMonolithHostedStudyGuide = async ({
  usageRequest,
  callStage,
  metadataFlags,
}: {
  usageRequest: HostedAiUsageRequest;
  callStage: (
    stage: HostedAiStage,
    stageRequest: HostedAiGatewayRequest,
  ) => Promise<string>;
  metadataFlags: JsonObject;
}): Promise<{
  text: string;
  quickStart: HostedAiGatewayResponse["quickStart"];
  bridgeBlocks: HostedAiGatewayResponse["bridgeBlocks"];
}> => {
  metadataFlags.generationStrategy = "monolith_v1";

  const requestText = getHostedRequestText(usageRequest);
  const topic = extractHostedStudyGuideTopic(requestText);
  const titleFallback =
    extractPromptField(requestText, "Path title fallback") || "Study Guide";
  const folderNameFallback =
    extractPromptField(
      requestText,
      "Folder name fallback if you cannot infer a better one",
    ) || titleFallback;
  const safeKnownTopics = sanitizeUserKnownTopics(
    usageRequest.quickStartOptions?.userKnownTopics,
  );

  const monolithRequest: HostedAiGatewayRequest = {
    ...usageRequest,
    responseSchema: createMonolithGuideSchema(safeKnownTopics.length > 0),
    parts: [
      {
        text: buildMonolithGuidePrompt({
          topic,
          titleFallback,
          folderNameFallback,
          userKnownTopics: safeKnownTopics,
          outputLanguage: usageRequest.outputLanguage,
        }),
      },
    ],
  };
  const callMonolith = async (): Promise<NormalizedMonolithGuide> =>
    normalizeMonolithGuide(
      parseJsonRecord(await callStage("study_guide_monolith", monolithRequest)),
      titleFallback,
      folderNameFallback,
      safeKnownTopics,
    );

  let guide: NormalizedMonolithGuide;
  try {
    guide = await callMonolith();
  } catch (firstError) {
    metadataFlags.monolithRetryUsed = true;
    try {
      guide = await callMonolith();
    } catch {
      metadataFlags.monolithUnusable = true;
      throw firstError;
    }
  }

  let quickStart: NonNullable<HostedAiGatewayResponse["quickStart"]> =
    guide.quickStart;
  let bridgeBlocks: HostedAiGatewayResponse["bridgeBlocks"] = [];
  const contextPlan = guide.contextPlan;
  if (contextPlan?.personalizedQuickStart) {
    if (contextPlan.useForDefault && contextPlan.selectedTopics.length) {
      metadataFlags.quickStartPersonalizedRewriteUsed = true;
      quickStart = contextPlan.personalizedQuickStart;
      if (contextPlan.bridgeBlock) {
        bridgeBlocks = [{ dashboardIndex: 1, ...contextPlan.bridgeBlock }];
      }
    } else {
      // "Use my context" stays available even when the model rates every
      // candidate topic as a weak bridge; the learner decides, not the model.
      metadataFlags.forcedBridgeAvailable = true;
      quickStart = {
        ...quickStart,
        forcedBridge: contextPlan.personalizedQuickStart,
      };
    }
  }

  const blueprint: EnhancedStudyGuideBlueprint = {
    title: guide.title,
    folderName: guide.folderName,
    emoji: guide.emoji,
    quickStart,
    pages: guide.pages.map((page) => ({
      title: page.title,
      keyFacts: [],
      conciseNotes: "",
      examplesNeeded: [],
      quizSkills: [],
    })),
  };
  const pages = guide.pages;
  const sourceWithQuickStart = buildEnhancedGuideSource({
    topic,
    blueprint,
    pages,
  });
  let questions: EnhancedStudyGuideQuizQuestion[];
  try {
    questions = normalizeEnhancedQuizQuestions(
      parseJsonRecord(
        await callStage("study_guide_final_quiz", {
          ...usageRequest,
          responseSchema: ENHANCED_STUDY_GUIDE_QUIZ_SCHEMA,
          parts: [
            {
              text: buildEnhancedQuizPrompt({
                topic,
                source: sourceWithQuickStart,
                bridgeBlocks,
                outputLanguage: usageRequest.outputLanguage,
              }),
            },
          ],
        }),
      ),
    );
  } catch (error) {
    metadataFlags.finalQuizUnusable = true;
    throw error;
  }

  metadataFlags.pageCount = pages.length;
  metadataFlags.finalQuizQuestionCount = questions.length;
  metadataFlags.contextBridgeBlockCount = bridgeBlocks?.length || 0;

  return {
    text: buildEnhancedStudyGuideText({
      blueprint,
      pages,
      questions,
      quickStart,
    }),
    quickStart,
    bridgeBlocks,
  };
};

const handleGenerate = async (
  userId: string,
  request: HostedAiGatewayRequest,
  includeQuickStart = false,
  guest: GuestContext | null = null,
): Promise<HostedAiGatewayResponse> => {
  const invalid = validateGenerateRequest(request);

  if (invalid) {
    return invalid;
  }

  const surface = request.surface as HostedAiSurface;
  // Zero-cost surfaces are follow-up calls whose credit was already charged
  // by the first call of the same user action, so they skip usage billing.
  const isFreeSurface = HOSTED_AI_CREDIT_COSTS[surface] === 0;
  const provider = getHostedTextProvider();
  const mainStage: HostedAiStage = includeQuickStart
    ? "study_guide_monolith"
    : isFreeSurface
    ? getStageForSurface(surface)
    : request.stage || getStageForSurface(surface);
  const model = getHostedTextModelForStage(provider, mainStage);
  const usageModel = getHostedUsageModelLabel(provider, model);
  const requestId = randomUUID();
  const guestTimeoutMs = guestLimit(
    "GUEST_MAX_TIMEOUT_MS",
    DEFAULT_GUEST_MAX_TIMEOUT_MS,
  );
  const usageRequest = {
    ...request,
    requestId,
    // Every stage request spreads this one, so clamping here caps the whole
    // generation rather than one call of it.
    ...(guest
      ? {
          timeoutMs: Math.min(
            request.timeoutMs || guestTimeoutMs,
            guestTimeoutMs,
          ),
        }
      : {}),
  };

  if (guest) {
    await assertGuestAllowanceAvailable(userId);
    await reserveGuestIpBudget(guest.ipHash, userId);
  }

  const started = isFreeSurface
    ? { status: undefined, usageId: undefined }
    : await startHostedUsage(userId, usageRequest, provider, usageModel);
  let providerCallCount = includeQuickStart ? 0 : 1;
  const stageCosts: HostedAiStageCost[] = [];
  const metadataFlags: JsonObject = {};
  const callStage = async (
    stage: HostedAiStage,
    stageRequest: HostedAiGatewayRequest,
  ): Promise<string> => {
    const stageModel = getHostedTextModelForStage(provider, stage);
    try {
      const result = await callHostedTextModel(
        stageRequest,
        provider,
        stageModel,
        stage,
      );
      stageCosts.push(result.stageCost);
      return result.text;
    } finally {
      if (includeQuickStart) {
        providerCallCount += 1;
      }
    }
  };

  try {
    if (includeQuickStart) {
      const enhanced = await generateMonolithHostedStudyGuide({
        usageRequest,
        callStage,
        metadataFlags,
      });
      metadataFlags.providerCallCount = providerCallCount;
      const status =
        (await finishHostedUsage(
          userId,
          requestId,
          "succeeded",
          undefined,
          undefined,
          providerCallCount,
          createUsageMetadata(stageCosts, metadataFlags),
        ).catch(() => undefined)) || started.status;

      return { ok: true, ...enhanced, status };
    }

    const text = await callStage(mainStage, usageRequest);

    const status = isFreeSurface
      ? started.status
      : (await finishHostedUsage(
          userId,
          requestId,
          "succeeded",
          undefined,
          undefined,
          providerCallCount,
          createUsageMetadata(stageCosts, metadataFlags),
        ).catch(() => undefined)) || started.status;

    return { ok: true, text, status };
  } catch (error) {
    const mapped = mapFailure(error);
    metadataFlags.providerCallCount = providerCallCount;

    if (!isFreeSurface) {
      await finishHostedUsage(
        userId,
        requestId,
        "failed",
        mapped.response.error?.code,
        mapped.response.error?.message,
        providerCallCount,
        createUsageMetadata(stageCosts, {
          ...metadataFlags,
          failed: true,
          failureCode: mapped.response.error?.code,
        }),
      ).catch(() => undefined);
    }

    throw error;
  }
};

const validatePodcastRequest = (
  request: HostedAiGatewayRequest,
): HostedAiGatewayResponse | null => {
  const invalid = validateGenerateRequest({
    ...request,
    surface: "podcast",
  });
  if (invalid) {
    return invalid;
  }

  const options = request.podcastOptions;
  if (
    !options ||
    !stringValue(options.studyGuideId) ||
    !stringValue(options.sourceTitle) ||
    (options.sourceScope !== "studyGuide" &&
      options.sourceScope !== "currentPage")
  ) {
    return errorResponse(
      "invalid_request",
      "Podcast generation requires Study Guide metadata.",
    );
  }

  const sourceText = buildPrompt(request.parts || []);
  if (sourceText.length < MIN_PODCAST_SOURCE_CHARS) {
    return errorResponse(
      "invalid_request",
      "This Study Guide does not have enough source content for a podcast yet.",
    );
  }

  return ensurePodcastConfigured();
};

const handleGeneratePodcast = async (
  userId: string,
  request: HostedAiGatewayRequest,
): Promise<HostedAiGatewayResponse> => {
  const invalid = validatePodcastRequest(request);
  if (invalid) {
    return invalid;
  }

  await assertPodcastDailyLimit(userId);

  const provider = getHostedTextProvider();
  const stage: HostedAiStage = "podcast_script";
  const model = getHostedTextModelForStage(provider, stage);
  const usageModel = getHostedUsageModelLabel(provider, model);
  const requestId = randomUUID();
  const usageRequest = { ...request, surface: "podcast" as const, requestId };
  const started = await startHostedUsage(
    userId,
    usageRequest,
    provider,
    usageModel,
  );
  let providerCallCount = 1;
  const stageCosts: HostedAiStageCost[] = [];

  try {
    const sourceText = buildPrompt(request.parts || []).slice(
      0,
      MAX_PODCAST_SOURCE_CHARS,
    );
    const sourceTitle = safePodcastText(
      request.podcastOptions?.sourceTitle,
      100,
    );
    const scriptResult = await callHostedTextModel(
      {
        ...usageRequest,
        responseSchema: PODCAST_SCRIPT_SCHEMA,
        parts: [
          {
            text: buildPodcastScriptPrompt({
              sourceTitle,
              sourceText,
              outputLanguage: request.outputLanguage,
            }),
          },
        ],
      },
      provider,
      model,
      stage,
    );
    stageCosts.push(scriptResult.stageCost);
    const scriptText = scriptResult.text;
    let script = normalizePodcastScript(scriptText, sourceTitle);
    if (
      request.outputLanguage &&
      !podcastScriptMatchesOutputLanguage(script, request.outputLanguage)
    ) {
      const retryResult = await callHostedTextModel(
        {
          ...usageRequest,
          responseSchema: PODCAST_SCRIPT_SCHEMA,
          parts: [
            {
              text: buildPodcastLanguageRetryPrompt({
                script,
                outputLanguage: request.outputLanguage,
                sourceTitle,
                sourceText,
              }),
            },
          ],
        },
        provider,
        model,
        stage,
      ).finally(() => {
        providerCallCount += 1;
      });
      stageCosts.push(retryResult.stageCost);
      const retryText = retryResult.text;
      script = normalizePodcastScript(retryText, sourceTitle);

      if (!podcastScriptMatchesOutputLanguage(script, request.outputLanguage)) {
        const error = new Error(
          `Hosted AI returned a podcast outside ${getContentLanguagePromptName(
            request.outputLanguage,
          )}.`,
        );
        error.name = "provider_error";
        throw error;
      }
    }

    const characterCount = getPodcastTtsCharacterCount(script);
    await reservePodcastTtsCharacters(userId, characterCount);
    const audio = await generatePodcastAudioFromScript(
      script,
      request.outputLanguage,
    );
    providerCallCount += audio.providerCallCount;

    const podcastId = `podcast-${randomUUID()}`;
    const studyGuideId = podcastPathSegment(
      request.podcastOptions?.studyGuideId || "",
      "study-guide",
    );
    const audioPath = `${userId}/${studyGuideId}/${podcastId}.mp3`;
    await uploadPodcastAudio(audioPath, audio.audioBuffer);
    await registerPodcastAudio({
      userId,
      audioPath,
      studyGuideId,
      podcastId,
    });
    await cleanupExpiredPodcastAudio(userId).catch(() => undefined);

    const podcast: HostedAiPodcast = {
      id: podcastId,
      title: script.title,
      description: script.description,
      audioPath,
      mimeType: audio.mimeType,
      transcriptTurns: script.transcriptTurns,
      chapters: script.chapters,
      sourceTitle,
      sourceScope: request.podcastOptions?.sourceScope || "studyGuide",
      createdAt: new Date().toISOString(),
    };

    const status =
      (await finishHostedUsage(
        userId,
        requestId,
        "succeeded",
        undefined,
        undefined,
        providerCallCount,
        createUsageMetadata(stageCosts, {
          ttsCharacterCount: audio.characterCount,
        }),
      ).catch(() => undefined)) || started.status;

    return { ok: true, podcast, status };
  } catch (error) {
    const mapped = mapFailure(error);

    await finishHostedUsage(
      userId,
      requestId,
      "failed",
      mapped.response.error?.code,
      mapped.response.error?.message,
      providerCallCount,
      createUsageMetadata(stageCosts, {
        failed: true,
        failureCode: mapped.response.error?.code,
      }),
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

  const request = readRequest(req);

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
    // Everything guest related sits after the CORS, method, config, JSON and
    // bearer chain above, and a real user never reaches any of it.
    const guest: GuestContext | null = user.isAnonymous
      ? { ipHash: hashClientIp(getClientIp(req.headers)) }
      : null;

    if (guest) {
      if (!isGuestTrialEnabled()) {
        json(
          res,
          403,
          errorResponse("invalid_request", GUEST_TRIAL_DISABLED_MESSAGE),
        );
        return;
      }

      // Without a trusted address the per-network ceiling cannot be enforced,
      // and an uncapped guest funnel is worse than a refused one. Local dev and
      // the webpack proxy forward no address, so only production insists.
      if (!guest.ipHash && getEnv("NODE_ENV") === "production") {
        json(
          res,
          429,
          errorResponse("rate_limited", GUEST_NETWORK_UNAVAILABLE_MESSAGE),
        );
        return;
      }

      if (request.action !== "status") {
        const invalidGuestRequest = validateGuestRequest(request);

        if (invalidGuestRequest) {
          json(
            res,
            invalidGuestRequest.statusCode,
            invalidGuestRequest.response,
          );
          return;
        }
      }
    }

    if (request.action === "status") {
      json(res, 200, {
        ok: true,
        status: await getHostedStatus(user.id, user.isAnonymous),
      });
      return;
    }

    if (request.action === "markIntroSeen") {
      json(res, 200, { ok: true, status: await markIntroSeen(user.id) });
      return;
    }

    if (request.action === "generate") {
      const response = await handleGenerate(user.id, request, false, guest);
      json(res, 200, response);
      return;
    }

    if (request.action === "generateWithQuickStart") {
      const response = await handleGenerate(user.id, request, true, guest);
      json(res, 200, response);
      return;
    }

    if (request.action === "generatePodcast") {
      const response = await handleGeneratePodcast(user.id, request);
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
