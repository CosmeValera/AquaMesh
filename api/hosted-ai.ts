import { randomUUID } from "node:crypto";

import { applyCors, getHeader } from "./cors";
import { loadLocalApiEnv } from "./local-env";
import type {
  HostedAiGatewayPart,
  HostedAiGatewayRequest,
  HostedAiGatewayResponse,
  HostedAiPodcast,
  HostedAiPodcastChapter,
  HostedAiPodcastTranscriptTurn,
  HostedAiStage,
  HostedAiStageCost,
  HostedAiStatus,
  HostedAiSurface,
} from "../apps/studymesh/src/quickCreate/ai/hostedCredits";
import {
  buildStudyGuideKnowledgeBridgeBlocksPrompt,
  buildStudyGuideQuickStartPrompt,
  buildStudyGuideQuickStartRelevancePrompt,
  ensureForcedStudyGuideQuickStartRelevanceDecision,
  parseStudyGuideKnowledgeBridgeBlocks,
  parseStudyGuideQuickStart,
  parseStudyGuideQuickStartRelevanceDecision,
  resolveStudyGuideKnowledgeContextPlan,
  STUDY_GUIDE_KNOWLEDGE_BRIDGE_BLOCKS_SCHEMA,
  STUDY_GUIDE_QUICK_START_RELEVANCE_SCHEMA,
  STUDY_GUIDE_QUICK_START_SCHEMA,
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
const SUPPORT_STAGE_SOURCE_MAX_CHARS = 4_500;
const MIN_PODCAST_SOURCE_CHARS = 400;
const MAX_PODCAST_SOURCE_CHARS = 24_000;
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
  "You don't have enough Study Credits for this action. Add more credits or switch AI provider, then try again.";

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
    error.name =
      response.status === 429 ||
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
  if (surface === "chat") {
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

const hasInlineData = (part: HostedAiGatewayPart): boolean =>
  Boolean(part.inline_data) ||
  Object.prototype.hasOwnProperty.call(part, "inlineData");

const buildPrompt = (parts: HostedAiGatewayPart[]): string =>
  parts
    .map((part) => (typeof part.text === "string" ? part.text.trim() : ""))
    .filter(Boolean)
    .join("\n\n");

const textArraySchema = { type: "ARRAY", items: { type: "STRING" } };

const ENHANCED_STUDY_GUIDE_BLUEPRINT_SCHEMA = {
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
    pages: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          title: { type: "STRING" },
          keyFacts: textArraySchema,
          conciseNotes: { type: "STRING" },
          examplesNeeded: textArraySchema,
          quizSkills: textArraySchema,
        },
        required: [
          "title",
          "keyFacts",
          "conciseNotes",
          "examplesNeeded",
          "quizSkills",
        ],
      },
    },
  },
  required: ["title", "folderName", "emoji", "quickStart", "pages"],
};

const ENHANCED_STUDY_GUIDE_PAGE_SCHEMA = {
  type: "OBJECT",
  properties: {
    title: { type: "STRING" },
    summary: { type: "STRING" },
    rawNotes: { type: "STRING" },
  },
  required: ["title", "summary", "rawNotes"],
};

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

const normalizeEnhancedBlueprint = (
  value: unknown,
  fallbackTitle: string,
  fallbackFolderName: string,
): EnhancedStudyGuideBlueprint => {
  const record = isObject(value) ? value : {};
  const pages = Array.isArray(record.pages) ? record.pages : [];
  const normalizedPages = pages.slice(0, 3).map((page, index) => {
    const pageRecord = isObject(page) ? page : {};
    return {
      title:
        stringValue(pageRecord.title) ||
        `${String(index + 1).padStart(2, "0")} - Lesson ${index + 1}`,
      keyFacts: Array.isArray(pageRecord.keyFacts)
        ? pageRecord.keyFacts.map(stringValue).filter(Boolean).slice(0, 12)
        : [],
      conciseNotes: stringValue(pageRecord.conciseNotes),
      examplesNeeded: Array.isArray(pageRecord.examplesNeeded)
        ? pageRecord.examplesNeeded.map(stringValue).filter(Boolean).slice(0, 6)
        : [],
      quizSkills: Array.isArray(pageRecord.quizSkills)
        ? pageRecord.quizSkills.map(stringValue).filter(Boolean).slice(0, 6)
        : [],
    };
  });
  const quickStart = parseStudyGuideQuickStart(
    JSON.stringify(isObject(record.quickStart) ? record.quickStart : {}),
  );

  if (normalizedPages.length !== 3 || !quickStart) {
    const error = new Error(
      "Hosted AI returned an unusable Study Guide blueprint.",
    );
    error.name = "provider_error";
    throw error;
  }

  return {
    title: stringValue(record.title) || fallbackTitle,
    folderName: stringValue(record.folderName) || fallbackFolderName,
    emoji: stringValue(record.emoji).slice(0, 8) || "📘",
    quickStart,
    pages: normalizedPages,
  };
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

const buildEnhancedBlueprintPrompt = ({
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
}): string => `Create an enhanced compact factual blueprint for a StudyMesh Study Guide.

Return strict JSON only:
{
  "title": "...",
  "folderName": "...",
  "emoji": "one emoji",
  "quickStart": { "keyIdea": "...", "quickSummary": "two short paragraphs" },
  "pages": [
    {
      "title": "01 - ...",
      "keyFacts": ["fact"],
      "conciseNotes": "90-110 words",
      "examplesNeeded": ["example"],
      "quizSkills": ["skill"]
    }
  ]
}

Rules:
- ${createAiOutputLanguageInstruction(outputLanguage)}
- Exactly 3 pages.
- The blueprint model owns facts and structure; a cheaper model will only expand this blueprint.
- keyFacts must contain exactly 8 precise, conservative facts per page, each one compact sentence with no filler words.
- conciseNotes must be 90-110 words, packed with facts, without restating keyFacts.
- examplesNeeded must contain at most 2 entries per page.
- quizSkills must contain exactly 2 entries per page.
- Maximize factual density per word; never pad or repeat.
- quickStart is blueprint-owned: explain the concept directly, not the guide structure.
- quickSummary target is 60-85 words. Every paragraph must end with a complete sentence.
- If close to a word target, finish the current sentence cleanly instead of ending mid-thought.
- Prefer a shorter complete sentence over using the whole word budget.
- Learner context candidates: ${userKnownTopics.length ? userKnownTopics.join(", ") : "none"}.
- Include comparison material in keyFacts/conciseNotes when a learner context candidate clearly reduces confusion.
- Do not force irrelevant analogies inside the pages, but prepare useful bridge material when there is a good context match.
- For programming, framework, DevOps, IaC, config, or command-line topics, examplesNeeded must request at least one real minimal code/config/command snippet.
- Never ask for placeholder snippets. Forbidden examples include "example_resource", "arguments would go here", "component logic goes here", "configuration would go here", and "pseudo-code placeholder".
- For non-code topics, examplesNeeded should request concrete examples, timelines, scenarios, or comparisons instead of code.
- Include enough final quiz skills for a 6-question application quiz.

Title fallback: ${titleFallback}
Folder fallback: ${folderNameFallback}
Learner request/topic:
${topic}`;

const buildEnhancedPagePrompt = ({
  topic,
  blueprint,
  page,
  outputLanguage,
}: {
  topic: string;
  blueprint: EnhancedStudyGuideBlueprint;
  page: EnhancedStudyGuideBlueprintPage;
  outputLanguage?: StudyMeshLanguageCode;
}): string => `Expand one Study Guide page using only this enhanced mini-authored blueprint.

Return strict JSON only:
{ "title": "...", "summary": "one preview sentence", "rawNotes": "Markdown lesson notes" }

Rules:
- ${createAiOutputLanguageInstruction(outputLanguage)}
- Write 280-360 words.
- Finish every paragraph and the final line as a complete sentence.
- If close to the word target, finish the current sentence cleanly instead of ending mid-thought.
- Do not end rawNotes with a comma, colon, "and", "or", "but", "because", "while", or an unfinished list.
- Do not add facts not present or directly implied by keyFacts/conciseNotes/examplesNeeded.
- Add connective explanation, examples, and learner-friendly structure.
- If examplesNeeded requests code/config/commands, include a real fenced snippet with a language tag.
- Never write placeholder snippets or placeholder comments like "arguments would go here", "component logic goes here", or "configuration would go here".
- If the blueprint does not provide enough detail for a real snippet, use a concrete prose example instead of fake code.
- Do not include quiz questions in rawNotes.

Topic: ${topic}

Full blueprint:
${JSON.stringify(blueprint, null, 2)}

Page blueprint:
${JSON.stringify(page, null, 2)}`;

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
  index: number,
): HostedAiPodcastTranscriptTurn | null => {
  if (!isObject(value)) {
    return null;
  }

  const speaker = value.speaker === "hostB" ? "hostB" : "hostA";
  const text = safePodcastText(value.text, 700);
  if (!text) {
    return null;
  }

  return {
    speaker: index % 2 === 0 ? speaker : speaker,
    text,
  };
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
    ? parsed.transcriptTurns
        .map(normalizePodcastTurn)
        .filter((turn): turn is HostedAiPodcastTranscriptTurn => Boolean(turn))
        .slice(0, 18)
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
    `The previous podcast script was rejected because it was not in ${getContentLanguagePromptName(outputLanguage)}.`,
    `Rewrite it now in ${getContentLanguagePromptName(outputLanguage)} only.`,
    "Keep the same JSON schema and keep only facts present in the source.",
    "Rejected transcript:",
    getPodcastTranscriptText(script),
  ].join("\n\n");

const buildPodcastScriptPrompt = ({
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
        `Hard rule for this podcast: title, description, chapters, and every transcript turn must be in ${getContentLanguagePromptName(outputLanguage)}.`,
        "If the source contains another language or mixed languages, explain it in the required output language; never switch to Portuguese, English, or any third language unless that is the required output language.",
      ].join(" ")
    : "Write the podcast in the same language as the source.";

  return [
    "Create a short StudyMesh educational podcast script from ONLY the provided Study Guide source.",
    languageInstruction,
    "Return strict JSON with: title, description, transcriptTurns, chapters.",
    "transcriptTurns must use speakers hostA and hostB only.",
    "Target 520-850 spoken words, 10-18 short turns, warm but focused two-host dialogue. Alternate hostA and hostB when natural.",
    "Do not invent facts. Do not mention web lookup. Do not cite sources unless the source text already contains them.",
    "If the source is thin, still create the best concise recap from available content without adding outside facts.",
    `Source title: ${sourceTitle}`,
    "Source:",
    sourceText,
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

    if (/insufficient|credit|quota/i.test(message)) {
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

const generateEnhancedHostedStudyGuide = async ({
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
  metadataFlags.generationStrategy = "enhanced_4_plus_2_v1";

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
  const knowledgeContextPlan =
    resolveStudyGuideKnowledgeContextPlan(safeKnownTopics);

  let blueprint: EnhancedStudyGuideBlueprint;
  try {
    blueprint = normalizeEnhancedBlueprint(
      parseJsonRecord(
        await callStage("study_guide_blueprint", {
          ...usageRequest,
          responseSchema: ENHANCED_STUDY_GUIDE_BLUEPRINT_SCHEMA,
          parts: [
            {
              text: buildEnhancedBlueprintPrompt({
                topic,
                titleFallback,
                folderNameFallback,
                userKnownTopics: safeKnownTopics,
                outputLanguage: usageRequest.outputLanguage,
              }),
            },
          ],
        }),
      ),
      titleFallback,
      folderNameFallback,
    );
  } catch (error) {
    metadataFlags.blueprintUnusable = true;
    throw error;
  }

  const pages: EnhancedStudyGuidePage[] = [];
  for (const page of blueprint.pages) {
    try {
      pages.push(
        normalizeEnhancedPage(
          parseJsonRecord(
            await callStage("study_guide_page_expand", {
              ...usageRequest,
              responseSchema: ENHANCED_STUDY_GUIDE_PAGE_SCHEMA,
              parts: [
                {
                  text: buildEnhancedPagePrompt({
                    topic,
                    blueprint,
                    page,
                    outputLanguage: usageRequest.outputLanguage,
                  }),
                },
              ],
            }),
          ),
          page.title,
        ),
      );
    } catch (error) {
      metadataFlags.pageExpansionUnusable = true;
      throw error;
    }
  }

  let quickStart = blueprint.quickStart;
  let bridgeBlocks: HostedAiGatewayResponse["bridgeBlocks"] = [];
  let relevanceDecision:
    | ReturnType<typeof parseStudyGuideQuickStartRelevanceDecision>
    | undefined;
  let relevanceDecisionFailed = false;
  const baseSource = buildEnhancedGuideSource({ topic, blueprint, pages });
  const supportSource = baseSource.slice(0, SUPPORT_STAGE_SOURCE_MAX_CHARS);

  if (knowledgeContextPlan.shouldRunAutoRelevance) {
    try {
      relevanceDecision = parseStudyGuideQuickStartRelevanceDecision(
        await callStage("quick_start_relevance_auto", {
          ...usageRequest,
          responseSchema: STUDY_GUIDE_QUICK_START_RELEVANCE_SCHEMA,
          parts: [
            {
              text: buildStudyGuideQuickStartRelevancePrompt({
                title: blueprint.title,
                prompt: topic,
                source: supportSource,
                userKnownTopics: safeKnownTopics,
                bridgeMode: "auto",
                outputLanguage: usageRequest.outputLanguage,
              }),
            },
          ],
        }),
        safeKnownTopics,
      );
    } catch {
      metadataFlags.quickStartRelevanceSkipped = true;
      relevanceDecisionFailed = true;
    }
  }

  if (
    relevanceDecision?.shouldUseKnownTopic &&
    relevanceDecision.knownTopicsForQuickStart.length
  ) {
    try {
      const personalizedQuickStart = parseStudyGuideQuickStart(
        await callStage("quick_start_personalized", {
          ...usageRequest,
          responseSchema: STUDY_GUIDE_QUICK_START_SCHEMA,
          parts: [
            {
              text: buildStudyGuideQuickStartPrompt({
                title: blueprint.title,
                source: supportSource,
                relevanceDecision,
                bridgeMode: "auto",
                outputLanguage: usageRequest.outputLanguage,
              }),
            },
          ],
        }),
      );

      if (personalizedQuickStart) {
        metadataFlags.quickStartPersonalizedRewriteUsed = true;
        quickStart = personalizedQuickStart;
      }
    } catch {
      metadataFlags.quickStartPersonalizedRewriteSkipped = true;
    }

    const eligibleDashboard = pages[1];
    if (eligibleDashboard) {
      try {
        bridgeBlocks = parseStudyGuideKnowledgeBridgeBlocks(
          await callStage("knowledge_bridge_blocks", {
            ...usageRequest,
            responseSchema: STUDY_GUIDE_KNOWLEDGE_BRIDGE_BLOCKS_SCHEMA,
            parts: [
              {
                text: buildStudyGuideKnowledgeBridgeBlocksPrompt({
                  title: blueprint.title,
                  prompt: topic,
                  dashboards: [
                    {
                      dashboardIndex: 1,
                      title: eligibleDashboard.title,
                      summary: eligibleDashboard.summary,
                      rawNotes: eligibleDashboard.rawNotes,
                    },
                  ],
                  relevanceDecision,
                  bridgeMode: "auto",
                  outputLanguage: usageRequest.outputLanguage,
                }),
              },
            ],
          }),
          pages.length,
          [1],
        );
      } catch {
        bridgeBlocks = [];
        metadataFlags.knowledgeBridgeSkipped = true;
      }
    }
  } else if (knowledgeContextPlan.topics.length && !relevanceDecisionFailed) {
    try {
      const forcedRelevanceDecision =
        ensureForcedStudyGuideQuickStartRelevanceDecision(
          relevanceDecision,
          safeKnownTopics,
        );

      if (forcedRelevanceDecision) {
        const forcedBridge = parseStudyGuideQuickStart(
          await callStage("quick_start_forced_bridge", {
            ...usageRequest,
            responseSchema: STUDY_GUIDE_QUICK_START_SCHEMA,
            parts: [
              {
                text: buildStudyGuideQuickStartPrompt({
                  title: blueprint.title,
                  source: supportSource,
                  relevanceDecision: forcedRelevanceDecision,
                  bridgeMode: "force",
                  outputLanguage: usageRequest.outputLanguage,
                }),
              },
            ],
          }),
        );

        if (forcedBridge) {
          quickStart = { ...quickStart, forcedBridge };
        }
      }
    } catch {
      metadataFlags.forcedBridgeSkipped = true;
    }
  }

  const sourceWithQuickStart = buildEnhancedGuideSource({
    topic,
    blueprint: { ...blueprint, quickStart },
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
): Promise<HostedAiGatewayResponse> => {
  const invalid = validateGenerateRequest(request);

  if (invalid) {
    return invalid;
  }

  const provider = getHostedTextProvider();
  const mainStage: HostedAiStage = includeQuickStart
    ? "study_guide_blueprint"
    : request.stage || getStageForSurface(request.surface as HostedAiSurface);
  const model = getHostedTextModelForStage(provider, mainStage);
  const usageModel = getHostedUsageModelLabel(provider, model);
  const requestId = randomUUID();
  const usageRequest = { ...request, requestId };
  const started = await startHostedUsage(
    userId,
    usageRequest,
    provider,
    usageModel,
  );
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
      const enhanced = await generateEnhancedHostedStudyGuide({
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

    return { ok: true, text, status };
  } catch (error) {
    const mapped = mapFailure(error);
    metadataFlags.providerCallCount = providerCallCount;

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
          `Hosted AI returned a podcast outside ${getContentLanguagePromptName(request.outputLanguage)}.`,
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

    if (request.action === "generateWithQuickStart") {
      const response = await handleGenerate(user.id, request, true);
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
