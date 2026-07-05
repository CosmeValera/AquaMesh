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
  STUDY_GUIDE_KNOWLEDGE_BRIDGE_BLOCKS_SCHEMA,
  STUDY_GUIDE_QUICK_START_RELEVANCE_SCHEMA,
  STUDY_GUIDE_QUICK_START_SCHEMA,
} from "../apps/studymesh/src/studyGuides/quickStart";
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
  podcast: 1,
};

const HOSTED_AI_INITIAL_FREE_CREDITS = 20;
export const DEFAULT_CEREBRAS_MODEL = "gpt-oss-120b";
const MAX_TEXT_CHARS = 120_000;
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
const CEREBRAS_CHAT_COMPLETIONS_URL =
  "https://api.cerebras.ai/v1/chat/completions";

const VALID_SURFACES = new Set<HostedAiSurface>([
  "study-guide",
  "quick-create",
  "chat",
  "podcast",
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
  providerCallCount = 1,
): Promise<HostedAiStatus | undefined> => {
  const payload = await callSupabaseRpc<unknown>("hosted_ai_finish_usage", {
    p_owner_id: userId,
    p_request_id: requestId,
    p_status: status,
    p_provider_call_count: providerCallCount,
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
    typeof value.startTurn === "number" ? value.startTurn : Number(value.startTurn);
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
        .map((chapter) => normalizePodcastChapter(chapter, transcriptTurns.length))
        .filter((chapter): chapter is HostedAiPodcastChapter => Boolean(chapter))
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

const wordsInPodcastScript = (script: PodcastScript): number =>
  script.transcriptTurns.reduce(
    (total, turn) => total + (turn.text.match(/\S+/g)?.length || 0),
    0,
  );

const estimatePodcastDurationSeconds = (script: PodcastScript): number =>
  Math.max(120, Math.min(300, Math.round((wordsInPodcastScript(script) / 155) * 60)));

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
    ? `Write the podcast in language code "${outputLanguage}".`
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

const getPodcastVoiceIds = (): Record<
  HostedAiPodcastTranscriptTurn["speaker"],
  string
> => ({
  hostA:
    getEnv("UNREAL_SPEECH_HOST_A_VOICE_ID") ||
    getEnv("UNREAL_SPEECH_VOICE_ID") ||
    UNREAL_SPEECH_DEFAULT_VOICE_ID,
  hostB:
    getEnv("UNREAL_SPEECH_HOST_B_VOICE_ID") ||
    UNREAL_SPEECH_DEFAULT_HOST_B_VOICE_ID,
});

const getPodcastSpeechSegments = (
  script: PodcastScript,
): PodcastSpeechSegment[] => {
  const voiceIds = getPodcastVoiceIds();

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
  const source = isObject(payload) && isObject(payload.SynthesisTask)
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
  const source = isObject(payload) && isObject(payload.SynthesisTask)
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
  const source = isObject(payload) && isObject(payload.SynthesisTask)
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

const downloadUnrealSpeechAudio = async (outputUri: string): Promise<Buffer> => {
  const response = await fetch(outputUri, { method: "GET" });
  if (!response.ok) {
    const message =
      (await readResponseText(response)) || "Could not download podcast audio.";
    const error = new Error(message);
    error.name = response.status === 429 ? "rate_limited" : "provider_error";
    throw error;
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const prefix = buffer.toString("utf8", 0, Math.min(buffer.length, 256)).trim();
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
  const taskOutputUri = outputUri || !taskId
    ? ""
    : await waitForUnrealSpeechOutputUri(taskId);

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
    const error = new Error("Unreal Speech returned no podcast audio segments.");
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
): Promise<PodcastAudioGenerationResult> => {
  const segments = getPodcastSpeechSegments(script);
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

const getExpiredPodcastAudioPaths = async (userId: string): Promise<string[]> => {
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
  includeQuickStart = false,
): Promise<HostedAiGatewayResponse> => {
  const invalid = validateGenerateRequest(request);

  if (invalid) {
    return invalid;
  }

  const model = getHostedCerebrasModel();
  const requestId = randomUUID();
  const usageRequest = { ...request, requestId };
  const started = await startHostedUsage(userId, usageRequest, model);
  let providerCallCount = 1;

  try {
    const text = await callCerebras(usageRequest, model);
    let quickStart: HostedAiGatewayResponse["quickStart"] | undefined;
    let bridgeBlocks: HostedAiGatewayResponse["bridgeBlocks"] | undefined;

    if (includeQuickStart) {
      const safeKnownTopics = sanitizeUserKnownTopics(
        request.quickStartOptions?.userKnownTopics,
      );
      const relevanceDecision = safeKnownTopics.length
        ? parseStudyGuideQuickStartRelevanceDecision(
            await callCerebras(
              {
                ...usageRequest,
                responseSchema: STUDY_GUIDE_QUICK_START_RELEVANCE_SCHEMA,
                parts: [
                  {
                    text: buildStudyGuideQuickStartRelevancePrompt({
                      title: "Study Guide",
                      prompt: getHostedRequestText(request),
                      source: text,
                      userKnownTopics: safeKnownTopics,
                      bridgeMode: "auto",
                      outputLanguage: request.outputLanguage,
                    }),
                  },
                ],
              },
              model,
            ).finally(() => {
              providerCallCount += 1;
            }),
            safeKnownTopics,
          )
        : undefined;

      quickStart = parseStudyGuideQuickStart(
        await callCerebras(
          {
            ...usageRequest,
            responseSchema: STUDY_GUIDE_QUICK_START_SCHEMA,
            parts: [
              {
                text: buildStudyGuideQuickStartPrompt({
                  title: "Study Guide",
                  source: text,
                  relevanceDecision,
                  bridgeMode: "auto",
                  outputLanguage: request.outputLanguage,
                }),
              },
            ],
          },
          model,
        ).finally(() => {
          providerCallCount += 1;
        }),
      );

      if (
        quickStart &&
        safeKnownTopics.length &&
        !(
          relevanceDecision?.shouldUseKnownTopic &&
          relevanceDecision.knownTopicsForQuickStart.length
        )
      ) {
        try {
          const forcedRelevanceDecision =
            parseStudyGuideQuickStartRelevanceDecision(
              await callCerebras(
                {
                  ...usageRequest,
                  responseSchema: STUDY_GUIDE_QUICK_START_RELEVANCE_SCHEMA,
                  parts: [
                    {
                      text: buildStudyGuideQuickStartRelevancePrompt({
                        title: "Study Guide",
                        prompt: getHostedRequestText(request),
                        source: text,
                        userKnownTopics: safeKnownTopics,
                        bridgeMode: "force",
                        outputLanguage: request.outputLanguage,
                      }),
                    },
                  ],
                },
                model,
              ).finally(() => {
                providerCallCount += 1;
              }),
              safeKnownTopics,
            );
          const safeForcedRelevanceDecision =
            ensureForcedStudyGuideQuickStartRelevanceDecision(
              forcedRelevanceDecision,
              safeKnownTopics,
            );

          if (safeForcedRelevanceDecision) {
            const forcedBridge = parseStudyGuideQuickStart(
              await callCerebras(
                {
                  ...usageRequest,
                  responseSchema: STUDY_GUIDE_QUICK_START_SCHEMA,
                  parts: [
                    {
                      text: buildStudyGuideQuickStartPrompt({
                        title: "Study Guide",
                        source: text,
                        relevanceDecision: safeForcedRelevanceDecision,
                        bridgeMode: "force",
                        outputLanguage: request.outputLanguage,
                      }),
                    },
                  ],
                },
                model,
              ).finally(() => {
                providerCallCount += 1;
              }),
            );

            if (forcedBridge) {
              quickStart = { ...quickStart, forcedBridge };
            }
          }
        } catch {
          // Optional alternate explanation should not fail the Study Guide.
        }
      }

      if (
        relevanceDecision?.shouldUseKnownTopic &&
        relevanceDecision.knownTopicsForQuickStart.length
      ) {
        const guideRecord = parseJsonRecord(text);
        const dashboards = Array.isArray(guideRecord?.dashboards)
          ? guideRecord.dashboards
              .filter((dashboard): dashboard is JsonObject =>
                isObject(dashboard),
              )
              .map((dashboard, index) => ({
                dashboardIndex: index,
                title: stringValue(dashboard.title),
                summary: stringValue(dashboard.summary),
                rawNotes: stringValue(dashboard.rawNotes),
                dashboardRole: stringValue(dashboard.dashboardRole),
                practiceType: stringValue(dashboard.practiceType),
              }))
          : [];
        const eligibleDashboards = dashboards.filter((dashboard) => {
          const role = dashboard.dashboardRole || "normal";
          return (
            dashboard.dashboardIndex > 0 &&
            role === "normal" &&
            dashboard.practiceType === "none"
          );
        });

        if (eligibleDashboards.length) {
          try {
            bridgeBlocks = parseStudyGuideKnowledgeBridgeBlocks(
              await callCerebras(
                {
                  ...usageRequest,
                  responseSchema: STUDY_GUIDE_KNOWLEDGE_BRIDGE_BLOCKS_SCHEMA,
                  parts: [
                    {
                      text: buildStudyGuideKnowledgeBridgeBlocksPrompt({
                        title:
                          stringValue(guideRecord?.folderName) || "Study Guide",
                        prompt: getHostedRequestText(request),
                        dashboards: eligibleDashboards,
                        relevanceDecision,
                        bridgeMode: "auto",
                        outputLanguage: request.outputLanguage,
                      }),
                    },
                  ],
                },
                model,
              ).finally(() => {
                providerCallCount += 1;
              }),
              dashboards.length,
              eligibleDashboards.map((dashboard) => dashboard.dashboardIndex),
            );
          } catch {
            bridgeBlocks = [];
          }
        }
      }
    }
    if (includeQuickStart && !quickStart) {
      const error = new Error("Hosted AI returned no Study Guide Quick Start.");
      error.name = "provider_error";
      throw error;
    }

    const status =
      (await finishHostedUsage(
        userId,
        requestId,
        "succeeded",
        undefined,
        undefined,
        providerCallCount,
      ).catch(() => undefined)) || started.status;

    return { ok: true, text, quickStart, bridgeBlocks, status };
  } catch (error) {
    const mapped = mapFailure(error);

    await finishHostedUsage(
      userId,
      requestId,
      "failed",
      mapped.response.error?.code,
      mapped.response.error?.message,
      providerCallCount,
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
    (options.sourceScope !== "studyGuide" && options.sourceScope !== "currentPage")
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

  const model = getHostedCerebrasModel();
  const requestId = randomUUID();
  const usageRequest = { ...request, surface: "podcast" as const, requestId };
  const started = await startHostedUsage(userId, usageRequest, model);
  let providerCallCount = 1;

  try {
    const sourceText = buildPrompt(request.parts || []).slice(
      0,
      MAX_PODCAST_SOURCE_CHARS,
    );
    const sourceTitle = safePodcastText(
      request.podcastOptions?.sourceTitle,
      100,
    );
    const scriptText = await callCerebras(
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
      model,
    );
    const script = normalizePodcastScript(scriptText, sourceTitle);
    const characterCount = getPodcastTtsCharacterCount(script);
    await reservePodcastTtsCharacters(userId, characterCount);
    const audio = await generatePodcastAudioFromScript(script);
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
      durationSeconds: estimatePodcastDurationSeconds(script),
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
