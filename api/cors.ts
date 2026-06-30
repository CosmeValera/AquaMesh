type HeaderMap = Record<string, string | string[] | undefined>

interface CorsRequest {
  headers: HeaderMap
}

interface CorsResponse {
  setHeader(name: string, value: string): void
}

export interface CorsCheck {
  allowed: boolean
  origin: string
}

const LOCALHOST_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:8080',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
  'http://127.0.0.1:8080',
]

const getEnv = (name: string): string => process.env[name]?.trim() || ''

export const getHeader = (headers: HeaderMap, name: string): string => {
  const match = Object.entries(headers).find(
    ([key]) => key.toLowerCase() === name.toLowerCase(),
  )?.[1]

  return Array.isArray(match) ? match[0] || '' : match || ''
}

const normalizeOrigin = (origin: string): string => origin.replace(/\/+$/, '')

const isLocalDevelopmentOrigin = (origin: string): boolean => {
  try {
    const url = new URL(origin)
    return (
      (url.protocol === 'http:' || url.protocol === 'https:') &&
      (url.hostname === 'localhost' || url.hostname === '127.0.0.1')
    )
  } catch {
    return false
  }
}

export const getAllowedOrigins = (): Set<string> => {
  const origins = new Set<string>()
  const appUrl = getEnv('STUDYMESH_APP_URL')
  const configured = getEnv('STUDYMESH_ALLOWED_ORIGINS')

  if (appUrl) {
    origins.add(normalizeOrigin(appUrl))
  }

  configured
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
    .forEach((origin) => origins.add(normalizeOrigin(origin)))

  if (getEnv('NODE_ENV') !== 'production') {
    LOCALHOST_ORIGINS.forEach((origin) => origins.add(origin))
  }

  return origins
}

export const applyCors = (
  req: CorsRequest,
  res: CorsResponse,
): CorsCheck => {
  const origin = normalizeOrigin(getHeader(req.headers, 'origin'))
  const allowedOrigins = getAllowedOrigins()
  const allowed =
    !origin ||
    allowedOrigins.has(origin) ||
    (getEnv('NODE_ENV') !== 'production' && isLocalDevelopmentOrigin(origin))

  res.setHeader('vary', 'Origin')
  res.setHeader('access-control-allow-methods', 'POST, OPTIONS')
  res.setHeader('access-control-allow-headers', 'authorization, content-type')

  if (origin && allowed) {
    res.setHeader('access-control-allow-origin', origin)
  }

  return { allowed, origin }
}
