import { isSupabaseConfigured, supabase } from '../auth/supabaseClient'

export interface DashboardExternalSource {
  id: string
  url: string
  title: string
  text: string
  searchQuery: string
  score?: number
  favicon?: string
  fetchedAt: number
}

export interface DashboardExternalSourceLookupRequest {
  question: string
  dashboardTitle: string
  contextSummary?: string
  rejectedUrls?: string[]
  rejectedDomains?: string[]
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
  request: DashboardExternalSourceLookupRequest,
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
