import { isSupabaseConfigured, supabase } from '../auth/supabaseClient'

export type DashboardExternalSourceOriginType = 'web' | 'user-text' | 'user-web'

export interface DashboardExternalSource {
  id: string
  url: string
  title: string
  text: string
  originType?: DashboardExternalSourceOriginType
  trimmed?: boolean
  guidePageDraft?: DashboardExternalSourcePageDraft
  guidePageDraftStatus?: 'pending' | 'ready' | 'failed'
  guidePageDraftError?: string
  normalizedUrl?: string
  domain?: string
  summary?: string
  coveredEntities?: string[]
  searchQuery: string
  usedInAnswer?: boolean
  score?: number
  favicon?: string
  fetchedAt: number
}

export interface DashboardExternalSourcePageDraft {
  title: string
  markdown: string
  generatedAt: number
}

export interface DashboardExternalSourceLookupRequest {
  question: string
  dashboardTitle: string
  searchQuery?: string
  contextSummary?: string
  rejectedUrls?: string[]
  rejectedDomains?: string[]
}

export interface DashboardExternalSourceUrlRequest {
  url: string
  dashboardTitle: string
}

interface DashboardSourceResponse {
  ok: boolean
  source?: DashboardExternalSource
  sources?: DashboardExternalSource[]
  error?: {
    code: string
    message: string
  }
}

const DASHBOARD_SOURCE_ENDPOINT = '/api/dashboard-source'

const getAccessToken = async (): Promise<string> => {
  if (!isSupabaseConfigured) {
    return ''
  }

  const { data } = await supabase.auth.getSession()
  return data.session?.access_token || ''
}

const parseResponse = async (
  response: Response,
): Promise<DashboardSourceResponse> => {
  try {
    return (await response.json()) as DashboardSourceResponse
  } catch {
    return {
      ok: false,
      error: {
        code: 'server_error',
        message: `Source fetch returned an unreadable response (${response.status}).`,
      },
    }
  }
}

export const fetchDashboardExternalSource = async (
  request:
    | DashboardExternalSourceLookupRequest
    | DashboardExternalSourceUrlRequest,
): Promise<DashboardExternalSource[]> => {
  const accessToken = await getAccessToken()
  const response = await fetch(DASHBOARD_SOURCE_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify(request),
  })
  const payload = await parseResponse(response)

  const sources = payload.sources || (payload.source ? [payload.source] : [])

  if (!response.ok || !payload.ok || sources.length === 0) {
    throw new Error(
      payload.error?.message || `Could not add source (${response.status}).`,
    )
  }

  return sources
}
