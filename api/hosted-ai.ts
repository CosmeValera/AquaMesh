import { randomUUID } from "node:crypto";

import { waitUntil } from "@vercel/functions";

import { applyCors, getHeader } from "./cors";
import { loadLocalApiEnv } from "./local-env";
import { createPartialJsonReader } from "./streamingJson";
import type {
  HostedAiGatewayPart,
  HostedAiGatewayRequest,
  HostedAiGatewayResponse,
  HostedAiPreviewEvent,
  HostedAiPodcast,
  HostedAiPodcastChapter,
  HostedAiPodcastTranscriptTurn,
  HostedAiStage,
  HostedAiStageCost,
  HostedAiStatus,
  HostedAiSurface,
} from "../apps/studymesh/src/quickCreate/ai/hostedCredits";
import {
  buildStudyGuideKnownTopicPrefilterPrompt,
  deriveStudyGuideBridgeStrength,
  normalizeStudyGuideTitle,
  parseStudyGuideKnownTopicPrefilterResult,
  parseStudyGuideQuickStart,
  sanitizeStudyGuideBridgeCorrespondences,
  sanitizeStudyGuideLearnedSkillOptions,
  sanitizeStudyGuideNextIdeas,
  sanitizeStudyGuidePageIdeas,
  sanitizeStudyGuidePlannedLessons,
  type StudyGuideNextIdea,
  type StudyGuidePageIdea,
  type StudyGuidePlannedLesson,
  STUDY_GUIDE_BRIDGE_CORRESPONDENCE_SCHEMA,
  STUDY_GUIDE_BRIDGE_MAX_CORRESPONDENCES,
  STUDY_GUIDE_KNOWN_TOPIC_PREFILTER_SCHEMA,
  STUDY_GUIDE_LEARNED_SKILL_FIELD_INSTRUCTION,
  STUDY_GUIDE_NEXT_IDEAS_INSTRUCTION,
  STUDY_GUIDE_NEXT_IDEAS_SCHEMA,
  STUDY_GUIDE_PAGE_IDEAS_INSTRUCTION,
  STUDY_GUIDE_PAGE_IDEAS_SCHEMA,
  STUDY_GUIDE_PLANNED_LESSONS_INSTRUCTION,
  STUDY_GUIDE_PLANNED_LESSONS_SCHEMA,
  trimTitleToWordBoundary,
  trimToCompleteSentenceWithinChars,
} from "../apps/studymesh/src/studyGuides/quickStart";
import {
  createAiOutputLanguageAnchor,
  createAiOutputLanguageInstruction,
  getContentLanguagePromptName,
  type StudyMeshLanguageCode,
} from "../apps/studymesh/src/language/contentLanguagePrompt";
import {
  sanitizeUserKnownTopics,
  USER_KNOWN_TOPICS_DIRECT_MAX,
} from "../apps/studymesh/src/profileContext";

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
  write?(chunk: string): unknown;
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
  /** Follow-up pages offered from this page, generated with the guide. */
  pageIdeas?: StudyGuidePageIdea[];
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
  // One more page inside a guide the reader already paid for. Its own surface
  // rather than 'quick-create' so the price can move without a migration.
  "study-page": 1,
  chat: 1,
  // Follow-up model calls inside one chat message (answer, list repair).
  // The single chat credit is charged upfront by the planner call.
  "chat-followup": 0,
  podcast: 1,
};

const HOSTED_AI_INITIAL_FREE_CREDITS = 30;
const HOSTED_AI_DAILY_FREE_CREDIT_FLOOR = 7;
// Luna now costs the same as nano, so the per-stage model split no longer buys
// anything: the cheaper models only cost quality. Nano failed the Quick Create
// quiz schema three times out of three on dense source text where luna
// succeeded on the first attempt. The per-stage env overrides are kept so a
// stage can still be pinned to a different model without a deploy.
export const DEFAULT_CEREBRAS_MODEL = "gpt-oss-120b";
export const DEFAULT_OPENAI_MODEL = "gpt-5.6-luna";
export const DEFAULT_OPENAI_STUDY_GUIDE_MODEL = "gpt-5.6-luna";
export const DEFAULT_OPENAI_SUPPORT_MODEL = "gpt-5.6-luna";
export const DEFAULT_OPENAI_FAST_MODEL = "gpt-5.6-luna";
export const DEFAULT_OPENAI_REASONING_EFFORT = "none";
export const DEFAULT_OPENAI_BRIDGE_REASONING_EFFORT = "low";
const MAX_TEXT_CHARS = 120_000;
const MIN_PODCAST_SOURCE_CHARS = 400;
export const MAX_PODCAST_SOURCE_CHARS = 24_000;
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
  "study-page",
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
  "study_guide_known_topic_prefilter",
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

// Stages that have to map a learner's known topic onto a new one. Counting and
// mapping parts with effort "none" collapsed to a single canned answer, so
// these get a small budget while every other stage stays at "none".
const REASONING_OPENAI_STAGES = new Set<HostedAiStage>([
  "study_guide_monolith",
  "study_guide_blueprint",
  "quick_start_relevance_auto",
  "quick_start_relevance_force",
]);

export const getHostedOpenAiReasoningEffort = (
  stage: HostedAiStage = "quick_create",
): string => {
  const override = getEnv("HOSTED_OPENAI_REASONING_EFFORT");
  if (override) {
    return override;
  }

  return REASONING_OPENAI_STAGES.has(stage)
    ? getEnv("HOSTED_OPENAI_BRIDGE_REASONING_EFFORT") ||
        DEFAULT_OPENAI_BRIDGE_REASONING_EFFORT
    : DEFAULT_OPENAI_REASONING_EFFORT;
};

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

/**
 * Asks the platform to keep running work after the response is done with.
 *
 * Outside Vercel there is nothing to ask, and the promise is simply awaited by
 * the caller as before, so local dev and tests behave the same.
 */
const keepAlive = (work: Promise<unknown>): void => {
  try {
    waitUntil(work);
  } catch {
    // Not running on Vercel. The caller still awaits it.
  }

  // Nothing else observes a rejection here; the caller reports it.
  void work.catch(() => undefined);
};

interface PreviewStream {
  emit(event: HostedAiPreviewEvent): void;
  /** True once a line went out, so headers are committed and status is 200. */
  started(): boolean;
  finish(body: HostedAiGatewayResponse): void;
}

/**
 * Writes the Study Guide preview as NDJSON, one event per line.
 *
 * Headers are held back until the first event so that anything failing before
 * the model produces output - no Carrots, bad token, provider refused - still
 * answers with its real HTTP status and today's error body.
 */
/** Ends the request the way it was started: as a stream, or as one body. */
const finishResponse = (
  res: VercelResponse,
  preview: PreviewStream | undefined,
  body: HostedAiGatewayResponse,
): void => {
  if (preview?.started()) {
    preview.finish(body);
    return;
  }

  json(res, 200, body);
};

const createPreviewStream = (res: VercelResponse): PreviewStream => {
  let started = false;
  let closed = false;

  const write = (line: JsonObject) => {
    if (closed || typeof res.write !== "function") {
      return;
    }

    try {
      if (!started) {
        started = true;
        res.setHeader("content-type", "application/x-ndjson; charset=utf-8");
        res.setHeader("cache-control", "no-store");
        // Stops any proxy in front of the function from buffering the body.
        res.setHeader("x-accel-buffering", "no");
        res.status(200);
      }

      res.write(`${JSON.stringify(line)}\n`);
    } catch {
      // The learner navigated away. Generation carries on regardless; there is
      // simply nobody left to show it to.
      closed = true;
    }
  };

  return {
    emit(event: HostedAiPreviewEvent): void {
      write(event as unknown as JsonObject);
    },

    started(): boolean {
      return started;
    },

    finish(body: HostedAiGatewayResponse): void {
      write({ type: body.ok ? "done" : "error", response: body });
      closed = true;
      try {
        res.end();
      } catch {
        // Already gone.
      }
    },
  };
};
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

/**
 * How long a job may sit in `running` before another request may take it over.
 *
 * Longer than any real generation, so a live job is never stolen; short enough
 * that a deploy or a crash mid-generation does not strand the learner.
 */
const STUDY_GUIDE_JOB_STALE_MS = 5 * 60 * 1000;
const STUDY_GUIDE_JOBS_PATH = "/rest/v1/hosted_study_guide_jobs";
const CLIENT_JOB_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

interface HostedStudyGuideJobRow {
  client_job_id: string;
  status: "running" | "succeeded" | "failed";
  result?: HostedAiGatewayResponse | null;
  error_message?: string | null;
  updated_at?: string;
}

/**
 * Client-supplied, so it is never trusted as given. It is only ever used
 * scoped to the caller's own user_id, which caps the damage of a guessed value
 * at attaching to a job that caller already owns.
 */
export const isValidClientJobId = (value: unknown): value is string =>
  typeof value === "string" && CLIENT_JOB_ID_PATTERN.test(value);

const studyGuideJobsFetch = (
  query: string,
  init: RequestInit & { prefer?: string } = {},
): Promise<Response> => {
  const { prefer, ...rest } = init;
  return supabaseFetch(
    `${STUDY_GUIDE_JOBS_PATH}${query}`,
    getEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      ...rest,
      headers: { ...(prefer ? { prefer } : {}), ...(rest.headers || {}) },
    },
  );
};

const readJobRows = async (
  response: Response,
): Promise<HostedStudyGuideJobRow[]> => {
  const payload = await readResponseJson(response);
  return Array.isArray(payload) ? (payload as HostedStudyGuideJobRow[]) : [];
};

const jobFilter = (userId: string, clientJobId: string): string =>
  `?user_id=eq.${encodeURIComponent(userId)}&client_job_id=eq.${encodeURIComponent(clientJobId)}`;

export const readStudyGuideJob = async (
  userId: string,
  clientJobId: string,
): Promise<HostedStudyGuideJobRow | undefined> => {
  const response = await studyGuideJobsFetch(
    `${jobFilter(userId, clientJobId)}&select=client_job_id,status,result,error_message,updated_at&limit=1`,
    { method: "GET" },
  );

  return (await readJobRows(response))[0];
};

export type StudyGuideJobClaim =
  | { outcome: "claimed" }
  /** Someone already finished this exact job. Nothing more is owed. */
  | { outcome: "succeeded"; response: HostedAiGatewayResponse }
  /** Still being generated, by this or another tab. */
  | { outcome: "running" };

/**
 * Takes ownership of a generation, or reports what already happened to it.
 *
 * The unique index on (user_id, client_job_id) is what makes this safe: a
 * refresh, a second tab, or a replayed request all lose the insert race and
 * attach instead of starting a second paid generation.
 */
export const claimStudyGuideJob = async (
  userId: string,
  clientJobId: string,
  prompt: string,
): Promise<StudyGuideJobClaim> => {
  const inserted = await studyGuideJobsFetch("", {
    method: "POST",
    prefer: "return=representation,resolution=ignore-duplicates",
    body: JSON.stringify({
      user_id: userId,
      client_job_id: clientJobId,
      status: "running",
      prompt: prompt.slice(0, 4000),
    }),
  });

  if ((await readJobRows(inserted)).length) {
    return { outcome: "claimed" };
  }

  const existing = await readStudyGuideJob(userId, clientJobId);

  if (!existing) {
    // The row vanished between the conflict and the read. Treat it as ours.
    return { outcome: "claimed" };
  }

  if (existing.status === "succeeded" && existing.result) {
    return { outcome: "succeeded", response: existing.result };
  }

  if (existing.status === "failed") {
    // A failed attempt must not block a real retry. Reclaiming the row rather
    // than deleting it keeps the job's identity, so this attempt's outcome has
    // somewhere to be recorded and a later replay still finds it.
    const reclaimed = await studyGuideJobsFetch(
      `${jobFilter(userId, clientJobId)}&status=eq.failed`,
      {
        method: "PATCH",
        prefer: "return=representation",
        body: JSON.stringify({
          status: "running",
          error_message: null,
          result: null,
        }),
      },
    );

    return (await readJobRows(reclaimed)).length
      ? { outcome: "claimed" }
      : { outcome: "running" };
  }

  const updatedAt = Date.parse(existing.updated_at || "");
  const isStale =
    Number.isFinite(updatedAt) && Date.now() - updatedAt > STUDY_GUIDE_JOB_STALE_MS;

  if (!isStale) {
    return { outcome: "running" };
  }

  // Nothing has touched it for long enough that its function is gone. Take it
  // over, but only by winning this conditional update.
  const stolen = await studyGuideJobsFetch(
    `${jobFilter(userId, clientJobId)}&status=eq.running&updated_at=lt.${encodeURIComponent(
      new Date(Date.now() - STUDY_GUIDE_JOB_STALE_MS).toISOString(),
    )}`,
    {
      method: "PATCH",
      prefer: "return=representation",
      body: JSON.stringify({ status: "running" }),
    },
  );

  return (await readJobRows(stolen)).length
    ? { outcome: "claimed" }
    : { outcome: "running" };
};

export const finishStudyGuideJob = async (
  userId: string,
  clientJobId: string,
  outcome:
    | { status: "succeeded"; response: HostedAiGatewayResponse }
    | { status: "failed"; message: string },
): Promise<void> => {
  await studyGuideJobsFetch(jobFilter(userId, clientJobId), {
    method: "PATCH",
    body: JSON.stringify(
      outcome.status === "succeeded"
        ? { status: "succeeded", result: outcome.response, error_message: null }
        : { status: "failed", error_message: outcome.message.slice(0, 2000) },
    ),
  }).catch((error) => {
    // The guide is generated and paid for either way; failing to record it
    // only costs the learner a resume, so it must not fail the request.
    console.error("[hosted-ai] could not record job outcome", error);
  });
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

export const getStageForSurface = (surface: HostedAiSurface): HostedAiStage => {
  if (surface === "chat" || surface === "chat-followup") {
    return "chat";
  }

  if (surface === "quick-create") {
    return "quick_create";
  }

  if (surface === "study-page") {
    return "study_guide_page_expand";
  }

  if (surface === "podcast") {
    return "podcast_script";
  }

  return "study_guide_main";
};

export const getHostedTextModelForStage = (
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

export const buildPrompt = (parts: HostedAiGatewayPart[]): string =>
  parts
    .map((part) => (typeof part.text === "string" ? part.text.trim() : ""))
    .filter(Boolean)
    .join("\n\n");

const textArraySchema = { type: "ARRAY", items: { type: "STRING" } };

export const ENHANCED_STUDY_GUIDE_QUIZ_SCHEMA = {
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
    // Named here rather than with the guide body: this stage runs once the
    // whole guide is written, so the namer sees the finished subject.
    learnedSkill: { type: "STRING" },
  },
  required: ["questions", "learnedSkill"],
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

  const pageIdeas = sanitizeStudyGuidePageIdeas(record.pageIdeas);

  return {
    title: stringValue(record.title) || fallbackTitle,
    summary: stringValue(record.summary) || `${fallbackTitle} lesson notes.`,
    rawNotes,
    pageIdeas: pageIdeas.length ? pageIdeas : undefined,
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

/**
 * The claimable skill rides the final-quiz response. Read apart from the quiz
 * so a missing or unusable name never invalidates a good quiz: the guide title
 * is a working fallback downstream, a broken quiz is not.
 */
const readEnhancedQuizLearnedSkill = (value: unknown): string[] =>
  sanitizeStudyGuideLearnedSkillOptions([
    isObject(value) ? value.learnedSkill : "",
  ]);

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

export const buildEnhancedGuideSource = ({
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

export const buildEnhancedQuizPrompt = ({
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
  ],
  "learnedSkill": "..."
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
- ${STUDY_GUIDE_LEARNED_SKILL_FIELD_INSTRUCTION}

Topic: ${topic}

Guide:
${source.slice(0, 18000)}

Context bridge notes:
${JSON.stringify(bridgeBlocks || [], null, 2)}

${createAiOutputLanguageAnchor(outputLanguage)}`;

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

// plannedLessons and pageIdeas ride inside this JSON rather than over a
// transport callback: the client already parses this text, so the growth
// offers arrive with the guide and cost no extra call.
const buildEnhancedStudyGuideText = ({
  blueprint,
  pages,
  questions,
  quickStart,
  plannedLessons,
}: {
  blueprint: EnhancedStudyGuideBlueprint;
  pages: EnhancedStudyGuidePage[];
  questions: EnhancedStudyGuideQuizQuestion[];
  quickStart: NonNullable<HostedAiGatewayResponse["quickStart"]>;
  plannedLessons?: StudyGuidePlannedLesson[];
}): string =>
  JSON.stringify({
    title: blueprint.title,
    folderName: blueprint.folderName,
    emoji: blueprint.emoji,
    quickStart,
    plannedLessons: plannedLessons?.length ? plannedLessons : undefined,
    dashboards: pages.map((page, index) => ({
      title: page.title,
      summary: page.summary,
      rawNotes: page.rawNotes,
      pageIdeas: page.pageIdeas,
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

export const toJsonSchema = (
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

// Luna is priced level with nano now. These feed
// hosted_ai_usage_events.metadata.estimatedCostUsdTotal, so a stale entry here
// silently skews the cost reporting rather than failing.
const getDefaultOpenAiInputPrice = (model: string): number =>
  model.includes("nano") ? 0.2 : model.includes("luna") ? 0.2 : 0.75;

const getDefaultOpenAiCachedInputPrice = (model: string): number =>
  model.includes("nano") ? 0.02 : model.includes("luna") ? 0.02 : 0.075;

const getDefaultOpenAiOutputPrice = (model: string): number =>
  model.includes("nano") ? 1.25 : model.includes("luna") ? 1.2 : 4.5;

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

interface HostedModelCall {
  url: string;
  body: JsonObject;
  prompt: string;
  useResponsesApi: boolean;
  config: ReturnType<typeof getChatCompletionConfig>;
  controller: AbortController;
  timeout: ReturnType<typeof setTimeout>;
}

/**
 * Shared setup for both the buffered and the streamed call, so the two can
 * never drift on model, schema, reasoning effort or timeout.
 */
const buildHostedModelCall = (
  request: HostedAiGatewayRequest,
  provider: HostedTextProvider,
  model: string,
  stage: HostedAiStage,
): HostedModelCall => {
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
        reasoning: { effort: getHostedOpenAiReasoningEffort(stage) },
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

  return {
    url: useResponsesApi ? OPENAI_RESPONSES_URL : config.url,
    body,
    prompt,
    useResponsesApi,
    config,
    controller,
    timeout,
  };
};

const sendHostedModelRequest = (
  call: HostedModelCall,
  extraBody?: JsonObject,
): Promise<Response> =>
  fetch(call.url, {
    method: "POST",
    signal: call.controller.signal,
    headers: {
      authorization: `Bearer ${call.config.apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ ...call.body, ...(extraBody || {}) }),
  });

const throwProviderFailure = (
  payload: ChatCompletionResponse,
  status: number,
  label: string,
): never => {
  const message =
    payload?.error?.message ||
    (isObject(payload) && typeof payload.message === "string"
      ? payload.message
      : `${label} hosted AI request failed.`);
  const error = new Error(message);
  error.name =
    status === 429 || /rate limit|quota|limit/i.test(message)
      ? "rate_limited"
      : "provider_error";
  throw error;
};

const assertNonEmptyModelText = (text: string, label: string): void => {
  if (!text.trim()) {
    const error = new Error(`${label} returned an empty response.`);
    error.name = "provider_error";
    throw error;
  }
};

export const callHostedTextModel = async (
  request: HostedAiGatewayRequest,
  provider: HostedTextProvider,
  model: string,
  stage: HostedAiStage,
): Promise<HostedTextModelResult> => {
  const call = buildHostedModelCall(request, provider, model, stage);

  try {
    const response = await sendHostedModelRequest(call);
    const payload = (await readResponseJson(
      response,
    )) as ChatCompletionResponse;

    if (!response.ok) {
      throwProviderFailure(payload, response.status, call.config.label);
    }

    const text = call.useResponsesApi
      ? extractResponsesApiText(payload)
      : extractChatCompletionText(payload);

    assertNonEmptyModelText(text, call.config.label);

    return {
      text,
      stageCost: createStageCost({
        stage,
        provider,
        model,
        payload,
        prompt: call.prompt,
        text,
      }),
    };
  } finally {
    clearTimeout(call.timeout);
  }
};

/** Server-Sent Events arrive as `data: <json>` lines separated by blank lines. */
const readSseDataLines = function* (buffer: string): Generator<string> {
  for (const line of buffer.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("data:")) {
      yield trimmed.slice(5).trim();
    }
  }
};

/**
 * Same call as `callHostedTextModel`, read as it arrives.
 *
 * The monolith writes the guide's opening fields long before the page prose,
 * so handing each delta to the caller is what lets the creation panel show
 * real content seconds in rather than at the end. The returned result is
 * identical in shape to the buffered call, and stays the source of truth:
 * whatever the deltas were used for, the guide is built from `text`.
 */
export const callHostedTextModelStreaming = async (
  request: HostedAiGatewayRequest,
  provider: HostedTextProvider,
  model: string,
  stage: HostedAiStage,
  onDelta: (delta: string) => void,
): Promise<HostedTextModelResult> => {
  const call = buildHostedModelCall(request, provider, model, stage);

  try {
    const response = await sendHostedModelRequest(call, { stream: true });

    if (!response.ok || !response.body) {
      const payload = (await readResponseJson(
        response,
      )) as ChatCompletionResponse;
      throwProviderFailure(payload, response.status, call.config.label);
    }

    const reader = (response.body as ReadableStream<Uint8Array>).getReader();
    const decoder = new TextDecoder();
    let pending = "";
    let text = "";
    let completed: ChatCompletionResponse | undefined;

    // Frames can split mid-line, so only whole lines are ever parsed.
    const drain = (chunk: string, flush: boolean) => {
      pending += chunk;
      const lastBreak = pending.lastIndexOf("\n");
      if (lastBreak < 0 && !flush) {
        return;
      }

      const ready = flush ? pending : pending.slice(0, lastBreak + 1);
      pending = flush ? "" : pending.slice(lastBreak + 1);

      for (const data of readSseDataLines(ready)) {
        if (!data || data === "[DONE]") {
          continue;
        }

        let event: JsonObject;
        try {
          event = JSON.parse(data) as JsonObject;
        } catch {
          continue;
        }

        if (
          event.type === "response.output_text.delta" &&
          typeof event.delta === "string"
        ) {
          text += event.delta;
          onDelta(event.delta);
          continue;
        }

        if (
          event.type === "response.completed" ||
          event.type === "response.incomplete"
        ) {
          completed = event.response as ChatCompletionResponse;
          continue;
        }

        if (event.type === "response.failed" || event.type === "error") {
          const failed = (event.response ||
            event) as unknown as ChatCompletionResponse;
          throwProviderFailure(failed, response.status, call.config.label);
        }
      }
    };

    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      drain(decoder.decode(value, { stream: true }), false);
    }

    drain(decoder.decode(), true);

    // A stream that ended without any delta still carries its text in the
    // terminal frame, so fall back to it rather than failing a usable call.
    if (!text && completed) {
      text = extractResponsesApiText(completed);
    }

    assertNonEmptyModelText(text, call.config.label);

    return {
      text,
      stageCost: createStageCost({
        stage,
        provider,
        model,
        payload: completed || ({} as ChatCompletionResponse),
        prompt: call.prompt,
        text,
      }),
    };
  } finally {
    clearTimeout(call.timeout);
  }
};

interface PodcastScript {
  title: string;
  description: string;
  transcriptTurns: HostedAiPodcastTranscriptTurn[];
  chapters: HostedAiPodcastChapter[];
}

export const PODCAST_SCRIPT_SCHEMA = {
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

export const safePodcastText = (value: unknown, maxLength: number): string =>
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

export const normalizePodcastScript = (
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

export const podcastScriptMatchesOutputLanguage = (
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

export const buildPodcastLanguageRetryPrompt = ({
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
    'Never leave symbols as symbols. Say arrows, ampersands, and similar marks as words in the podcast\'s language, for example "leads to" for an arrow and "and" for an ampersand.',
    'Express math in spoken words instead of notation: "x squared" rather than "x^2", "the square root of two" rather than a root symbol, "fifty percent" rather than "50%".',
    'Punctuation is never spoken, so it cannot group anything. Never use parentheses or brackets to group an expression; carry every grouping with words. Say "the quantity x plus h, squared" instead of "(x plus h) squared", and "all over h" instead of a fraction bar. When an expression could be heard two ways, restate it more explicitly.',
    'Whenever anything is applied to a sum or difference, whether a function, a derivative, or an operation, first say the podcast language\'s phrase for "the quantity", then the sum. Without it the listener hears the sum as a separate term: "the derivative of f of x plus g of x" is heard as the derivative of f of x, plus g of x. All examples in these rules are written in English only to show the pattern; always translate the wording into the podcast\'s language and never copy an English phrase into a script in another language.',
    'Whenever an exponent is more than a single symbol, use the podcast language\'s phrase for "raised to the power of" rather than its short form for "to the". The short form makes "x to the n minus one" ambiguous, because it is equally heard as x to the n, minus one.',
    'Never state more than two decimal places, in digits or in spoken words. Name well-known constants and round them: say "e, roughly two point seven" and "pi, roughly three point one four". Never write "2.71828", "3.14159", "two point seven one eight", or "three point one four one". Round or approximate any long figure, for example "roughly 1.2 million". Keep ordinary numbers, short counts, and dates as normal spoken words; simplify numbers, never drop them.',
    'Write abbreviations out as words instead of dotted forms, in the podcast\'s language, for example "in the afternoon" instead of "p.m.", "for example" instead of "e.g.", and "and so on" instead of "etc.".',
    'Speak every title, term, file name, and address as ordinary words. Never read a slug or identifier literally: say "derivatives in calculus" instead of "derivatives-calculus", and expand hyphenated, underscored, or camelCase names into natural speech.',
    "Keep each turn under about 600 characters. If a spoken-out explanation runs long, split it across turns instead of packing one turn.",
    // The enumerated ban below was already in place when a live turn said "The
    // notes mention that ...", so listing more nouns is not what was missing. The
    // added sentence names the construction instead: attributing a fact to
    // anything at all is what has to stop, whatever the thing is called.
    'The hosts are explaining what they already know, not reading from a handout. Never say "the guide", "the source", "the document", "the notes", or any equivalent phrase in the podcast\'s language; state the idea directly as their own explanation. Never attribute a fact to any written thing at all: no "it says", "they mention", "according to", or similar. Every statement is simply what the host knows.',
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

export const generatePodcastAudioFromScript = async (
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

/** Shared with the BYO path so both normalize guide titles identically. */
export const humanizeGuideTitle = (value: unknown): string =>
  normalizeStudyGuideTitle(value);

interface NormalizedMonolithGuide {
  title: string;
  folderName: string;
  emoji: string;
  quickStart: NonNullable<HostedAiGatewayResponse["quickStart"]>;
  /** Follow-up guides offered once the learner claims the topic. */
  nextGuideIdeas: StudyGuideNextIdea[];
  /** Lessons the plan named and this guide did not write. */
  plannedLessons: StudyGuidePlannedLesson[];
  pages: EnhancedStudyGuidePage[];
  contextPlan?: {
    /** Derived from correspondences, never asserted by the model. */
    useForDefault: boolean;
    bridgeStrength: "none" | "weak" | "strong";
    selectedTopics: string[];
    personalizedQuickStart?: NonNullable<HostedAiGatewayResponse["quickStart"]>;
    reason?: string;
    bridgeBlock?: { title: string; body: string };
  };
}

export const createMonolithGuideSchema = (includeContext: boolean) => ({
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
    nextGuideIdeas: STUDY_GUIDE_NEXT_IDEAS_SCHEMA,
    plannedLessons: STUDY_GUIDE_PLANNED_LESSONS_SCHEMA,
    ...(includeContext
      ? {
          contextPlan: {
            type: "OBJECT",
            properties: {
              targetParts: textArraySchema,
              selectedTopics: textArraySchema,
              correspondences: STUDY_GUIDE_BRIDGE_CORRESPONDENCE_SCHEMA,
              reason: { type: "STRING" },
              breaksAt: { type: "STRING" },
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
              "targetParts",
              "selectedTopics",
              "correspondences",
              "reason",
              "breaksAt",
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
          pageIdeas: STUDY_GUIDE_PAGE_IDEAS_SCHEMA,
        },
        required: ["title", "summary", "rawNotes", "pageIdeas"],
      },
    },
  },
  required: [
    "title",
    "folderName",
    "emoji",
    "quickStart",
    "nextGuideIdeas",
    "plannedLessons",
    ...(includeContext ? ["contextPlan"] : []),
    "pages",
  ],
});

export const buildMonolithGuidePrompt = ({
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
  "quickStart": { "keyIdea": "one sentence, max 35 words", "quickSummary": "two short paragraphs" },
  "nextGuideIdeas": [{ "axis": "curiosity | utility | connection", "label": "...", "prompt": "..." }],
  "plannedLessons": [{ "title": "...", "summary": "..." }],${
    userKnownTopics.length
      ? `
  "contextPlan": {
    "targetParts": ["..."],
    "selectedTopics": ["..."],
    "correspondences": [{ "knownSide": "...", "targetSide": "...", "carries": "...", "kind": "part", "alsoWorksFor": "..." }],
    "reason": "...",
    "breaksAt": "...",
    "personalizedQuickStart": { "keyIdea": "...", "quickSummary": "..." },
    "bridgeBlock": { "title": "...", "body": "..." }
  },`
      : ""
  }
  "pages": [
    { "title": "01 - ...", "summary": "one preview sentence", "rawNotes": "Markdown lesson notes", "pageIdeas": [{ "axis": "mechanism | example | limit", "label": "...", "prompt": "..." }] }
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
- ${STUDY_GUIDE_NEXT_IDEAS_INSTRUCTION}
- ${STUDY_GUIDE_PAGE_IDEAS_INSTRUCTION}
- ${STUDY_GUIDE_PLANNED_LESSONS_INSTRUCTION}
- Do not include quiz questions inside rawNotes.${
  userKnownTopics.length
    ? `
- The learner already knows these candidate topics: ${userKnownTopics.join(
        ", ",
      )}.
- contextPlan.targetParts: 3-5 working parts of THIS topic, taken from the guide you just wrote: the things that act, the things acted on, and what changes over time. When the topic's content is its structure rather than a sequence, list its organizing axes, levels, and positions instead; a taxonomy or a coordinate system has working parts even though nothing moves. Short concrete noun phrases.
- contextPlan.selectedTopics: pick the 1 candidate whose own moving parts line up with the most targetParts (2 only when both add different mappings). Never invent topics. Name the closest candidate even when the overlap is small; return [] only if every candidate would actively mislead, be unsafe, or be dehumanizing.
- Cross-domain candidates are allowed and are often the best choice. A locksmith's lock and key can map onto a molecular receptor; a household budget can map onto an energy balance. Never reject a candidate for coming from a different field, for being broad, or for being everyday rather than technical.
- Once you have chosen, map that candidate as completely as you can. Work through every targetPart in turn before stopping, not only the first one or two. Extra candidates must not cost the chosen one depth.
- Then apply one bar to everything you found: a pair belongs only when knowing the known side lets the learner predict how the target side behaves. Keep every pair that clears the bar; drop the ones that do not. Search wide, then keep strictly.
- contextPlan.correspondences: up to ${STUDY_GUIDE_BRIDGE_MAX_CORRESPONDENCES} matched pairs. knownSide is the part inside the candidate topic, targetSide the part inside this guide's topic. carries states the role or causal job the pair transfers, in a few words. kind is "process" when the pair transfers something happening over time (a change, a build-up, a feedback, an adaptation) and "part" when it transfers a fixed role.
- Label kind honestly. "process" only when something changes, accumulates, decays, or feeds back over time. A fixed role or component is "part". Never label a static role as a process to make the mapping look richer.
- alsoWorksFor: does the knownSide depend on something that exists only in the selected topic? If yes, answer "none". If the knownSide is a general idea any subject could supply, name one other everyday domain that supplies it just as well.
- Worked example. "budget categories -> grammar categories" leans on the general idea of having categories, which filing cabinets and wardrobes supply too, so alsoWorksFor is "filing cabinets". "a key's cut -> a verb ending" leans on a cut, which exists only in locks and keys, so alsoWorksFor is "none".
- Worked example for the bar. "a conductor's cue -> a fault rupture" fails: knowing that a conductor cues an entrance predicts nothing about when a fault ruptures, because nothing cues one. "the runner who just handed off needs recovery before running again -> a neuron's refractory period" passes: the known side predicts that the target side cannot fire again immediately.
- Naming a shared property is not predicting behaviour. Two things being organised, coordinated, triggered, sustained, or driven by inputs is a shared property, not a mapping. Never write a pair whose two sides are the same word, or that shares only a label, a mood, or a general theme. Return [] when nothing genuinely maps.
- Prefer concrete nouns on the known side. Pairs built from abstract words like "categories", "choices", "resources", "structure", or "standards" are almost always swap-test failures.
- contextPlan.personalizedQuickStart: always write this variant, even when correspondences is []. It is an opt-in view the learner opens themselves. quickSummary 60-85 words, complete sentences.
- Let the pairs you kept decide how much weight the known topic carries. When most targetParts came away with a pair that clears the bar, the selected topic must LEAD personalizedQuickStart: state keyIdea in the known topic's vocabulary and run the strongest pairs through quickSummary. When only one or two cleared it, explain the topic directly first and bring the known topic in as one concrete comparison. When none cleared it, explain the topic directly and mention the selected topic once as a concrete point of contact; if selectedTopics is [] write a neutral Quick Start and invent no bridge. Never add a pair to reach a tier.
- In personalizedQuickStart, write as if the mapping is simply true. Never write about the comparison itself: no "the comparison", "the analogy", "this comparison is limited", "the comparison breaks down", "provides only a limited comparison", "unlike the mechanisms involved in".
- Never offer the two subjects being different kinds of thing as a limitation. Every explanation through a known topic crosses subjects; saying so teaches nothing. Any caveat must be about the topic itself: a boundary, or something a learner would get wrong.
- contextPlan.bridgeBlock: one short study note connecting a concept from page 2 to the selected topic. body under 85 words, ending with a complete sentence.
- contextPlan.reason: one short sentence on what the mapping lets the learner reuse. Only ever a reason it helps, never a caveat or a limitation.
- contextPlan.breaksAt: 6-12 words naming the first place the mapping stops being true, in terms of the two topics' own parts. Never "different fields", never "one is physical and one is biological", never any variation on the two subjects being different kinds of thing.
- For topics involving identity, history, politics, culture, or people, keep the bridge factual and avoid reductive claims. For human or management topics, do not compare people to infrastructure, tools, or machines.`
    : ""
}

Title fallback: ${titleFallback}
Folder fallback: ${folderNameFallback}
Learner request/topic:
${topic}

${createAiOutputLanguageAnchor(outputLanguage)}`;

export const normalizeMonolithGuide = (
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
    const correspondences = sanitizeStudyGuideBridgeCorrespondences(
      planRecord.correspondences,
    );
    // Strength is counted from the pairs the model listed, never taken from a
    // self-rating: asked to grade its own bridge, luna answered "weak" for
    // every candidate, including same-field ones. A named topic with no pairs
    // still keeps the opt-in view, marked weak, so the learner keeps the toggle.
    const mappedStrength = deriveStudyGuideBridgeStrength(correspondences);
    const bridgeStrength = !selectedTopics.length
      ? "none"
      : mappedStrength === "none"
        ? "weak"
        : mappedStrength;
    const breaksAt = trimTitleToWordBoundary(
      stringValue(planRecord.breaksAt),
      90,
    );
    const reason = trimTitleToWordBoundary(stringValue(planRecord.reason), 90);
    contextPlan = {
      useForDefault: bridgeStrength === "strong",
      bridgeStrength,
      selectedTopics,
      personalizedQuickStart,
      // Only a weak bridge shows a fit caveat; a strong one is not hedged.
      reason:
        bridgeStrength === "weak" ? breaksAt || reason || undefined : undefined,
      bridgeBlock:
        bridgeTitle && bridgeBody
          ? { title: bridgeTitle, body: bridgeBody }
          : undefined,
    };
  }

  return {
    title: humanizeGuideTitle(stringValue(record.title) || titleFallback),
    nextGuideIdeas: sanitizeStudyGuideNextIdeas(record.nextGuideIdeas),
    plannedLessons: sanitizeStudyGuidePlannedLessons(record.plannedLessons),
    folderName: humanizeGuideTitle(
      stringValue(record.folderName) || folderNameFallback,
    ),
    emoji: stringValue(record.emoji).slice(0, 8) || "📘",
    quickStart,
    pages,
    contextPlan,
  };
};

const readTrimmedString = (source: unknown, key: string): string => {
  if (!isObject(source)) {
    return "";
  }

  const value = source[key];
  return typeof value === "string" ? value.trim() : "";
};

/**
 * Turns the monolith's partial JSON into preview lines for the creation panel.
 *
 * Fields are announced once, in the order the model writes them, and a page is
 * only reported finished when its last schema field has landed. Nothing here
 * feeds the saved guide; it exists so the learner is not staring at a spinner.
 */
export const createMonolithPreviewEmitter = (
  onPreview: (event: HostedAiPreviewEvent) => void,
) => {
  let reader = createPartialJsonReader();
  let sentMeta = false;
  let sentQuickStart = false;
  let sentBridge = false;
  const sentPageTitles = new Set<number>();
  const sentPages = new Set<number>();

  const flush = () => {
    const snapshot = reader.snapshot();
    if (!snapshot || !isObject(snapshot.value)) {
      return;
    }

    const guide = snapshot.value as JsonObject;
    const title = readTrimmedString(guide, "title");
    const quickStart = guide.quickStart;
    const contextPlan = guide.contextPlan;

    // Held until a later field lands, so the emoji and folder ride along.
    if (!sentMeta && title && (guide.emoji || quickStart)) {
      sentMeta = true;
      onPreview({
        type: "meta",
        title,
        folderName: readTrimmedString(guide, "folderName") || undefined,
        emoji: readTrimmedString(guide, "emoji") || undefined,
      });
    }

    if (!sentQuickStart) {
      const keyIdea = readTrimmedString(quickStart, "keyIdea");
      const quickSummary = readTrimmedString(quickStart, "quickSummary");
      if (keyIdea && quickSummary) {
        sentQuickStart = true;
        onPreview({ type: "quickStart", keyIdea, quickSummary });
      }
    }

    if (!sentBridge && isObject(contextPlan)) {
      const bridgeBlock = contextPlan.bridgeBlock;
      const bridgeTitle = readTrimmedString(bridgeBlock, "title");
      const bridgeBody = readTrimmedString(bridgeBlock, "body");
      if (bridgeTitle && bridgeBody) {
        sentBridge = true;
        onPreview({
          type: "bridge",
          title: bridgeTitle,
          body: bridgeBody,
          topics: Array.isArray(contextPlan.selectedTopics)
            ? contextPlan.selectedTopics.filter(
                (topic): topic is string => typeof topic === "string",
              )
            : [],
        });
      }
    }

    if (!Array.isArray(guide.pages)) {
      return;
    }

    guide.pages.forEach((page, index) => {
      const pageTitle = readTrimmedString(page, "title");
      if (pageTitle && !sentPageTitles.has(index)) {
        sentPageTitles.add(index);
        onPreview({ type: "pageTitle", index, title: pageTitle });
      }

      // pageIdeas is the last field of a page, so its arrival means done.
      if (
        isObject(page) &&
        page.pageIdeas !== undefined &&
        !sentPages.has(index)
      ) {
        sentPages.add(index);
        onPreview({
          type: "page",
          index,
          title: pageTitle,
          summary: readTrimmedString(page, "summary"),
        });
      }
    });
  };

  return {
    onDelta(delta: string): void {
      if (reader.push(delta)) {
        flush();
      }
    },

    /** Drops everything previewed so far, for a retry of an unusable call. */
    reset(): void {
      reader = createPartialJsonReader();
      sentMeta = false;
      sentQuickStart = false;
      sentBridge = false;
      sentPageTitles.clear();
      sentPages.clear();
      onPreview({ type: "reset" });
    },
  };
};

export const generateMonolithHostedStudyGuide = async ({
  usageRequest,
  callStage,
  metadataFlags,
  onPreview,
}: {
  usageRequest: HostedAiUsageRequest;
  callStage: (
    stage: HostedAiStage,
    stageRequest: HostedAiGatewayRequest,
    onDelta?: (delta: string) => void,
  ) => Promise<string>;
  metadataFlags: JsonObject;
  onPreview?: (event: HostedAiPreviewEvent) => void;
}): Promise<{
  text: string;
  quickStart: HostedAiGatewayResponse["quickStart"];
  bridgeBlocks: HostedAiGatewayResponse["bridgeBlocks"];
  learnedSkillOptions: string[];
  nextGuideIdeas: StudyGuideNextIdea[];
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
  let safeKnownTopics = sanitizeUserKnownTopics(
    usageRequest.quickStartOptions?.userKnownTopics,
  );

  if (safeKnownTopics.length > USER_KNOWN_TOPICS_DIRECT_MAX) {
    try {
      const prefilterText = await callStage(
        "study_guide_known_topic_prefilter",
        {
          ...usageRequest,
          responseSchema: STUDY_GUIDE_KNOWN_TOPIC_PREFILTER_SCHEMA,
          parts: [
            {
              text: buildStudyGuideKnownTopicPrefilterPrompt({
                title: titleFallback,
                prompt: topic,
                candidateTopics: safeKnownTopics,
              }),
            },
          ],
        },
      );
      safeKnownTopics = parseStudyGuideKnownTopicPrefilterResult(
        prefilterText,
        safeKnownTopics,
      );
    } catch {
      metadataFlags.knownTopicPrefilterFailed = true;
      safeKnownTopics = safeKnownTopics.slice(0, USER_KNOWN_TOPICS_DIRECT_MAX);
    }
  }

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
  const previewEmitter = onPreview
    ? createMonolithPreviewEmitter(onPreview)
    : undefined;
  const callMonolith = async (): Promise<NormalizedMonolithGuide> =>
    normalizeMonolithGuide(
      parseJsonRecord(
        await callStage(
          "study_guide_monolith",
          monolithRequest,
          previewEmitter?.onDelta,
        ),
      ),
      titleFallback,
      folderNameFallback,
      safeKnownTopics,
    );

  onPreview?.({ type: "stage", stage: "monolith" });
  let guide: NormalizedMonolithGuide;
  try {
    guide = await callMonolith();
  } catch (firstError) {
    metadataFlags.monolithRetryUsed = true;
    // The first attempt's fields were previewed and are now void.
    previewEmitter?.reset();
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
  if (
    contextPlan?.personalizedQuickStart &&
    contextPlan.selectedTopics.length
  ) {
    // Both a plain and a bridged Quick Start always exist together (they come
    // from the same monolith call), so the learner can toggle either way
    // regardless of which one leads by default.
    const plainQuickStart = quickStart;
    const bridgeQuickStart = {
      ...contextPlan.personalizedQuickStart,
      bridgeTopics: contextPlan.selectedTopics,
    };
    metadataFlags.bridgeStrength = contextPlan.bridgeStrength;
    if (contextPlan.useForDefault) {
      metadataFlags.quickStartPersonalizedRewriteUsed = true;
      quickStart = { ...bridgeQuickStart, forcedBridge: plainQuickStart };
      if (contextPlan.bridgeBlock) {
        bridgeBlocks = [{ dashboardIndex: 1, ...contextPlan.bridgeBlock }];
      }
    } else {
      // "Use my context" stays available even when the model rates every
      // candidate topic as a weak bridge; the learner decides, not the model.
      metadataFlags.forcedBridgeAvailable = true;
      quickStart = {
        ...plainQuickStart,
        forcedBridge: contextPlan.reason
          ? { ...bridgeQuickStart, weakFitReason: contextPlan.reason }
          : bridgeQuickStart,
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
  let learnedSkillOptions: string[];
  onPreview?.({ type: "stage", stage: "quiz" });
  try {
    const quizRecord = parseJsonRecord(
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
    );
    questions = normalizeEnhancedQuizQuestions(quizRecord);
    learnedSkillOptions = readEnhancedQuizLearnedSkill(quizRecord);
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
      plannedLessons: guide.plannedLessons,
    }),
    quickStart,
    bridgeBlocks,
    learnedSkillOptions,
    nextGuideIdeas: guide.nextGuideIdeas,
  };
};

const handleGenerate = async (
  userId: string,
  request: HostedAiGatewayRequest,
  includeQuickStart = false,
  onPreview?: (event: HostedAiPreviewEvent) => void,
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
  const usageRequest = { ...request, requestId };
  const started = isFreeSurface
    ? { status: undefined, usageId: undefined }
    : await startHostedUsage(userId, usageRequest, provider, usageModel);
  let providerCallCount = includeQuickStart ? 0 : 1;
  const stageCosts: HostedAiStageCost[] = [];
  const metadataFlags: JsonObject = {};
  const callStage = async (
    stage: HostedAiStage,
    stageRequest: HostedAiGatewayRequest,
    onDelta?: (delta: string) => void,
  ): Promise<string> => {
    const stageModel = getHostedTextModelForStage(provider, stage);
    // Only the Responses API streams; every other transport stays buffered.
    const canStream =
      Boolean(onDelta) &&
      provider === "openai" &&
      isOpenAiResponsesModel(stageModel);
    try {
      const result = canStream
        ? await callHostedTextModelStreaming(
            stageRequest,
            provider,
            stageModel,
            stage,
            onDelta as (delta: string) => void,
          )
        : await callHostedTextModel(stageRequest, provider, stageModel, stage);
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
        onPreview,
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

  // Only the streamed action creates one, and only when the client asked.
  const preview =
    request.action === "generateWithQuickStart" &&
    request.stream === true &&
    typeof res.write === "function"
      ? createPreviewStream(res)
      : undefined;

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

    if (request.action === "studyGuideJob") {
      if (!isValidClientJobId(request.clientJobId)) {
        json(
          res,
          400,
          errorResponse("invalid_request", "Invalid job id."),
        );
        return;
      }

      const job = await readStudyGuideJob(user.id, request.clientJobId);
      json(res, 200, {
        ok: true,
        job: job
          ? {
              clientJobId: job.client_job_id,
              status: job.status,
              ...(job.status === "succeeded" && job.result
                ? { response: job.result }
                : {}),
              ...(job.error_message ? { errorMessage: job.error_message } : {}),
            }
          : undefined,
      });
      return;
    }

    if (request.action === "generateWithQuickStart") {
      const clientJobId = isValidClientJobId(request.clientJobId)
        ? request.clientJobId
        : undefined;

      if (clientJobId) {
        const claim = await claimStudyGuideJob(
          user.id,
          clientJobId,
          getHostedRequestText(request),
        );

        // Already generated and paid for. Hand back the same guide and charge
        // nothing: this is a refresh, a second tab, or a replayed request.
        if (claim.outcome === "succeeded") {
          finishResponse(res, preview, claim.response);
          return;
        }

        if (claim.outcome === "running") {
          finishResponse(res, preview, { ok: true, pending: true });
          return;
        }
      }

      const work = (async () => {
        try {
          const response = await handleGenerate(
            user.id,
            request,
            true,
            preview ? (event) => preview.emit(event) : undefined,
          );
          if (clientJobId) {
            await finishStudyGuideJob(user.id, clientJobId, {
              status: "succeeded",
              response,
            });
          }

          return response;
        } catch (error) {
          if (clientJobId) {
            await finishStudyGuideJob(user.id, clientJobId, {
              status: "failed",
              message:
                error instanceof Error ? error.message : "Generation failed.",
            });
          }

          throw error;
        }
      })();

      // Keeps the work alive past a client disconnect, so closing the tab no
      // longer throws away a guide the learner has already paid for.
      keepAlive(work);
      finishResponse(res, preview, await work);
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
    if (mapped.statusCode >= 500) {
      console.error("[hosted-ai] request failed", request.action, error);
    }

    // Once a preview line is out the status is already 200, so the failure has
    // to travel as an error line carrying the same body the client parses.
    if (preview?.started()) {
      preview.finish(mapped.response);
      return;
    }

    json(res, mapped.statusCode, mapped.response);
  }
}
