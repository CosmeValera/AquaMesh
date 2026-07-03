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
  json(body: PodcastAudioResponse): void;
  end(): void;
}

interface SupabaseUser {
  id: string;
}

interface PodcastAudioResponse {
  ok: boolean;
  signedUrl?: string;
  expiresIn?: number;
  error?: {
    code: "not_authenticated" | "not_configured" | "invalid_request" | "server_error";
    message: string;
  };
}

const SIGNED_URL_EXPIRES_SECONDS = 60 * 60;

const getEnv = (name: string): string => process.env[name]?.trim() || "";

const json = (
  res: VercelResponse,
  statusCode: number,
  body: PodcastAudioResponse,
): void => {
  res.status(statusCode).json(body);
};

const errorResponse = (
  code: NonNullable<PodcastAudioResponse["error"]>["code"],
  message: string,
): PodcastAudioResponse => ({
  ok: false,
  error: { code, message },
});

const isObject = (value: unknown): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const readResponseJson = async (response: Response): Promise<unknown> => {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { message: text };
  }
};

const normalizeSupabaseUrl = (url: string): string => url.replace(/\/+$/, "");

const getBearerToken = (req: VercelRequest): string => {
  const authorization = getHeader(req.headers, "authorization");
  const match = authorization.match(/^Bearer\s+(.+)$/i);

  return match?.[1]?.trim() || "";
};

const getAudioPath = (body: unknown): string => {
  if (typeof body === "string") {
    try {
      return getAudioPath(JSON.parse(body) as unknown);
    } catch {
      return "";
    }
  }

  return isObject(body) && typeof body.audioPath === "string"
    ? body.audioPath.trim()
    : "";
};

const verifyUser = async (accessToken: string): Promise<SupabaseUser> => {
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

  return { id: payload.id };
};

const encodeStoragePath = (path: string): string =>
  path.split("/").map(encodeURIComponent).join("/");

const createSignedUrl = async (audioPath: string): Promise<string> => {
  const supabaseUrl = normalizeSupabaseUrl(getEnv("SUPABASE_URL"));
  const serviceKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");
  const bucket = getEnv("PODCAST_AUDIO_BUCKET") || "study-guide-podcasts";
  if (!supabaseUrl || !serviceKey) {
    throw new Error("not_configured");
  }

  const response = await fetch(
    `${supabaseUrl}/storage/v1/object/sign/${bucket}/${encodeStoragePath(
      audioPath,
    )}`,
    {
      method: "POST",
      headers: {
        apikey: serviceKey,
        authorization: `Bearer ${serviceKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ expiresIn: SIGNED_URL_EXPIRES_SECONDS }),
    },
  );
  const payload = await readResponseJson(response);

  if (!response.ok || !isObject(payload) || typeof payload.signedURL !== "string") {
    throw new Error("server_error");
  }

  if (payload.signedURL.startsWith("http")) {
    return payload.signedURL;
  }

  const signedPath = payload.signedURL.startsWith("/")
    ? payload.signedURL
    : `/${payload.signedURL}`;

  return signedPath.startsWith("/storage/v1/")
    ? `${supabaseUrl}${signedPath}`
    : `${supabaseUrl}/storage/v1${signedPath}`;
};

const mapError = (
  error: unknown,
): { statusCode: number; response: PodcastAudioResponse } => {
  if (error instanceof Error) {
    if (error.message === "not_authenticated") {
      return {
        statusCode: 401,
        response: errorResponse(
          "not_authenticated",
          "Sign in to play this podcast.",
        ),
      };
    }

    if (error.message === "not_configured") {
      return {
        statusCode: 500,
        response: errorResponse(
          "not_configured",
          "Podcast audio storage is not configured.",
        ),
      };
    }
  }

  return {
    statusCode: 500,
    response: errorResponse("server_error", "Could not open podcast audio."),
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
    json(res, 405, errorResponse("invalid_request", "Use POST for podcast audio."));
    return;
  }

  const accessToken = getBearerToken(req);
  if (!accessToken) {
    json(res, 401, errorResponse("not_authenticated", "Sign in to play this podcast."));
    return;
  }

  try {
    const user = await verifyUser(accessToken);
    const audioPath = getAudioPath(req.body);
    if (
      !audioPath ||
      audioPath.includes("..") ||
      audioPath.startsWith("/") ||
      !audioPath.startsWith(`${user.id}/`)
    ) {
      json(
        res,
        400,
        errorResponse("invalid_request", "Invalid podcast audio path."),
      );
      return;
    }

    json(res, 200, {
      ok: true,
      signedUrl: await createSignedUrl(audioPath),
      expiresIn: SIGNED_URL_EXPIRES_SECONDS,
    });
  } catch (error) {
    const mapped = mapError(error);
    json(res, mapped.statusCode, mapped.response);
  }
}
