import { getHeader } from "./cors";
import { loadLocalApiEnv } from "./local-env";

loadLocalApiEnv();

type JsonObject = Record<string, unknown>;

interface VercelRequest {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
}

interface VercelResponse {
  status(code: number): VercelResponse;
  json(body: PodcastAudioCleanupResponse): void;
  end(): void;
}

interface ExpiredPodcastAudioRow {
  ownerId: string;
  audioPath: string;
}

interface ExpiredStudyGuideRow {
  ownerId: string;
  id: string;
  studyPath: unknown;
}

interface PodcastAudioCleanupResponse {
  ok: boolean;
  deletedCount?: number;
  deletedStudyGuideCount?: number;
  deletedStudyGuidePodcastAudioCount?: number;
  deletedPodcastAudioCount?: number;
  purgedGuestAccountCount?: number;
  error?: {
    code: "not_authorized" | "not_configured" | "invalid_request" | "server_error";
    message: string;
  };
}

type PodcastAudioDeletedReason =
  | "expired"
  | "study-guide-expired"
  | "study-guide-deleted";

const STUDY_GUIDE_RETAINED_COUNT = 50;
const PODCAST_AUDIO_RETAINED_COUNT = 5;
const RETENTION_CANDIDATE_DAYS = 30;
const CLEANUP_BATCH_SIZE = 100;
const CLEANUP_MAX_BATCHES = 10;
const GUEST_PURGE_BATCH_SIZE = 200;
const GUEST_PURGE_RETENTION_DAYS = 30;

const getEnv = (name: string): string => process.env[name]?.trim() || "";

const numberEnv = (name: string): number | undefined => {
  const raw = getEnv(name);
  if (!raw) {
    return undefined;
  }

  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : undefined;
};

const normalizeSupabaseUrl = (url: string): string => url.replace(/\/+$/, "");

const isObject = (value: unknown): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const readResponseText = async (response: Response): Promise<string> => {
  try {
    return await response.text();
  } catch {
    return "";
  }
};

const readResponseJson = async (response: Response): Promise<unknown> => {
  const text = await readResponseText(response);
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { message: text };
  }
};

const errorResponse = (
  code: NonNullable<PodcastAudioCleanupResponse["error"]>["code"],
  message: string,
): PodcastAudioCleanupResponse => ({
  ok: false,
  error: { code, message },
});

const getPodcastBucket = (): string =>
  getEnv("PODCAST_AUDIO_BUCKET") || "study-guide-podcasts";

const getCleanupSecret = (): string =>
  getEnv("PODCAST_CLEANUP_SECRET") || getEnv("CRON_SECRET");

const hasValidCronAuth = (req: VercelRequest): boolean => {
  const secret = getCleanupSecret();
  const authorization = getHeader(req.headers, "authorization");

  return Boolean(secret) && authorization === `Bearer ${secret}`;
};

const getSupabaseConfig = (): { supabaseUrl: string; serviceKey: string } => {
  const supabaseUrl = normalizeSupabaseUrl(getEnv("SUPABASE_URL"));
  const serviceKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    throw new Error("not_configured");
  }

  return { supabaseUrl, serviceKey };
};

const callSupabaseRpc = async (
  name: string,
  body: Record<string, unknown>,
): Promise<unknown> => {
  const { supabaseUrl, serviceKey } = getSupabaseConfig();
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      authorization: `Bearer ${serviceKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error("server_error");
  }

  return readResponseJson(response);
};

const retentionCutoff = (): string =>
  new Date(Date.now() - RETENTION_CANDIDATE_DAYS * 24 * 60 * 60 * 1000)
    .toISOString();

const collectPodcastAudioPaths = (value: unknown): string[] => {
  const paths = new Set<string>();

  const visit = (node: unknown): void => {
    if (!node || typeof node !== "object") {
      return;
    }

    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }

    const record = node as JsonObject;
    if (record.type === "PodcastBlock" && isObject(record.props)) {
      const podcast = record.props.podcast;
      if (isObject(podcast) && typeof podcast.audioPath === "string") {
        paths.add(podcast.audioPath);
      }
    }

    Object.values(record).forEach(visit);
  };

  visit(value);
  return [...paths];
};

const refreshStudyGuideRetentionCandidates = async (): Promise<void> => {
  await callSupabaseRpc("study_guides_refresh_retention_candidates", {
    p_keep_count: STUDY_GUIDE_RETAINED_COUNT,
  });
};

const refreshPodcastAudioRetentionCandidates = async (): Promise<void> => {
  await callSupabaseRpc("podcast_audio_refresh_retention_candidates", {
    p_keep_count: PODCAST_AUDIO_RETAINED_COUNT,
  });
};

const fetchExpiredStudyGuideRows = async (): Promise<ExpiredStudyGuideRow[]> => {
  const { supabaseUrl, serviceKey } = getSupabaseConfig();
  const query = new URLSearchParams({
    select: "owner_id,id,study_path",
    retention_candidate_at: `lte.${retentionCutoff()}`,
    order: "retention_candidate_at.asc,created_at.asc",
    limit: String(CLEANUP_BATCH_SIZE),
  });
  const response = await fetch(
    `${supabaseUrl}/rest/v1/user_study_guides?${query.toString()}`,
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
    throw new Error("server_error");
  }

  return payload
    .map((row) =>
      isObject(row) &&
      typeof row.owner_id === "string" &&
      typeof row.id === "string"
        ? {
            ownerId: row.owner_id,
            id: row.id,
            studyPath: row.study_path,
          }
        : null,
    )
    .filter((row): row is ExpiredStudyGuideRow => row !== null);
};

const fetchExpiredPodcastAudioRows = async (): Promise<
  ExpiredPodcastAudioRow[]
> => {
  const { supabaseUrl, serviceKey } = getSupabaseConfig();
  const query = new URLSearchParams({
    select: "owner_id,audio_path",
    deleted_at: "is.null",
    candidate_at: `lte.${retentionCutoff()}`,
    order: "candidate_at.asc,created_at.asc",
    limit: String(CLEANUP_BATCH_SIZE),
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
    throw new Error("server_error");
  }

  return payload
    .map((row) =>
      isObject(row) &&
      typeof row.owner_id === "string" &&
      typeof row.audio_path === "string"
        ? {
            ownerId: row.owner_id,
            audioPath: row.audio_path,
          }
        : null,
    )
    .filter((row): row is ExpiredPodcastAudioRow => row !== null);
};

const deletePodcastStorageObjects = async (paths: string[]): Promise<void> => {
  if (paths.length === 0) {
    return;
  }

  const { supabaseUrl, serviceKey } = getSupabaseConfig();
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
    throw new Error("server_error");
  }
};

const markPodcastAudioDeleted = async (
  row: ExpiredPodcastAudioRow,
  deletedReason: PodcastAudioDeletedReason,
): Promise<void> => {
  await callSupabaseRpc("podcast_audio_mark_deleted", {
    p_owner_id: row.ownerId,
    p_audio_path: row.audioPath,
    p_deleted_reason: deletedReason,
  });
};

const deleteStudyGuideRow = async (row: ExpiredStudyGuideRow): Promise<void> => {
  const { supabaseUrl, serviceKey } = getSupabaseConfig();
  const query = new URLSearchParams({
    owner_id: `eq.${row.ownerId}`,
    id: `eq.${row.id}`,
  });
  const response = await fetch(
    `${supabaseUrl}/rest/v1/user_study_guides?${query.toString()}`,
    {
      method: "DELETE",
      headers: {
        apikey: serviceKey,
        authorization: `Bearer ${serviceKey}`,
      },
    },
  );
  if (!response.ok) {
    throw new Error("server_error");
  }
};

const cleanupExpiredStudyGuides = async (): Promise<{
  deletedStudyGuideCount: number;
  deletedStudyGuidePodcastAudioCount: number;
}> => {
  let deletedStudyGuideCount = 0;
  let deletedStudyGuidePodcastAudioCount = 0;

  for (let batchIndex = 0; batchIndex < CLEANUP_MAX_BATCHES; batchIndex += 1) {
    const rows = await fetchExpiredStudyGuideRows();
    if (rows.length === 0) {
      break;
    }

    const podcastRows = rows.flatMap((row) =>
      collectPodcastAudioPaths(row.studyPath)
        .filter((audioPath) => audioPath.startsWith(`${row.ownerId}/`))
        .map((audioPath) => ({
          ownerId: row.ownerId,
          audioPath,
        })),
    );
    const uniquePodcastRows = [
      ...new Map(
        podcastRows.map((row) => [`${row.ownerId}\n${row.audioPath}`, row]),
      ).values(),
    ];

    await deletePodcastStorageObjects(
      uniquePodcastRows.map((row) => row.audioPath),
    );
    await Promise.all(
      uniquePodcastRows.map((row) =>
        markPodcastAudioDeleted(row, "study-guide-expired"),
      ),
    );
    await Promise.all(rows.map(deleteStudyGuideRow));

    deletedStudyGuideCount += rows.length;
    deletedStudyGuidePodcastAudioCount += uniquePodcastRows.length;

    if (rows.length < CLEANUP_BATCH_SIZE) {
      break;
    }
  }

  return { deletedStudyGuideCount, deletedStudyGuidePodcastAudioCount };
};

const cleanupExpiredPodcastAudio = async (): Promise<number> => {
  let deletedCount = 0;

  for (let batchIndex = 0; batchIndex < CLEANUP_MAX_BATCHES; batchIndex += 1) {
    const rows = await fetchExpiredPodcastAudioRows();
    if (rows.length === 0) {
      break;
    }

    await deletePodcastStorageObjects(rows.map((row) => row.audioPath));
    await Promise.all(
      rows.map((row) => markPodcastAudioDeleted(row, "expired")),
    );
    deletedCount += rows.length;

    if (rows.length < CLEANUP_BATCH_SIZE) {
      break;
    }
  }

  return deletedCount;
};

// Guests who never created an account are deleted with their whole cascade
// (profile, guides, hosted AI account, allowance) once they age out, and the
// hashed per-network counters are pruned over the same window.
const purgeStaleGuestAccounts = async (): Promise<number> => {
  const purged = await callSupabaseRpc("guest_purge_stale_accounts", {
    p_max: numberEnv("GUEST_PURGE_BATCH_SIZE") ?? GUEST_PURGE_BATCH_SIZE,
    p_retention_days:
      numberEnv("GUEST_PURGE_RETENTION_DAYS") ?? GUEST_PURGE_RETENTION_DAYS,
  });
  const count = typeof purged === "number" ? purged : Number(purged);

  return Number.isFinite(count) && count > 0 ? Math.trunc(count) : 0;
};

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "GET" && req.method !== "POST") {
    res
      .status(405)
      .json(errorResponse("invalid_request", "Use GET or POST for cleanup."));
    return;
  }

  if (!getCleanupSecret()) {
    res.status(500).json(
      errorResponse(
        "not_configured",
        "Podcast cleanup requires CRON_SECRET or PODCAST_CLEANUP_SECRET.",
      ),
    );
    return;
  }

  if (!hasValidCronAuth(req)) {
    res
      .status(401)
      .json(errorResponse("not_authorized", "Cleanup request is not authorized."));
    return;
  }

  try {
    await refreshStudyGuideRetentionCandidates();
    const studyGuideCleanup = await cleanupExpiredStudyGuides();
    await refreshPodcastAudioRetentionCandidates();
    const deletedPodcastAudioCount = await cleanupExpiredPodcastAudio();

    // Runs after the podcast stages so an aged-out guest's guides and MP3s go
    // through the normal cleanup path instead of being cascaded away with the
    // auth user, and stays isolated so a purge failure never discards the
    // counts the stages above already earned.
    let purgedGuestAccountCount = 0;
    try {
      purgedGuestAccountCount = await purgeStaleGuestAccounts();
    } catch {
      purgedGuestAccountCount = 0;
    }

    res.status(200).json({
      ok: true,
      deletedCount:
        studyGuideCleanup.deletedStudyGuideCount +
        studyGuideCleanup.deletedStudyGuidePodcastAudioCount +
        deletedPodcastAudioCount,
      deletedStudyGuideCount: studyGuideCleanup.deletedStudyGuideCount,
      deletedStudyGuidePodcastAudioCount:
        studyGuideCleanup.deletedStudyGuidePodcastAudioCount,
      deletedPodcastAudioCount,
      purgedGuestAccountCount,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "not_configured") {
      res
        .status(500)
        .json(errorResponse("not_configured", "Podcast storage is not configured."));
      return;
    }

    res
      .status(500)
      .json(errorResponse("server_error", "Could not clean up podcast audio."));
  }
}
