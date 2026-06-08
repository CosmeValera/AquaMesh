import Stripe = require('stripe')

type JsonObject = Record<string, unknown>

interface VercelRequest {
  method?: string
  headers: Record<string, string | string[] | undefined>
  body?: unknown
}

interface VercelResponse {
  setHeader(name: string, value: string): void
  status(code: number): VercelResponse
  json(body: JsonObject): void
  end(): void
}

interface SupabaseUser {
  id: string
}

interface HostedAiPurchase {
  purchaseId?: string
  purchase_id?: string
}

const REFILL_CURRENCY = 'eur'
const CREDIT_PACKS = [
  {
    id: 'starter',
    credits: 80,
    priceCents: 200,
    envName: 'STRIPE_STUDY_CREDITS_PRICE_ID_2_EUR',
  },
  {
    id: 'popular',
    credits: 250,
    priceCents: 500,
    envName: 'STRIPE_STUDY_CREDITS_PRICE_ID_5_EUR',
  },
  {
    id: 'value',
    credits: 550,
    priceCents: 1000,
    envName: 'STRIPE_STUDY_CREDITS_PRICE_ID_10_EUR',
  },
  {
    id: 'max',
    credits: 1200,
    priceCents: 2000,
    envName: 'STRIPE_STUDY_CREDITS_PRICE_ID_20_EUR',
  },
] as const

const getEnv = (name: string): string => process.env[name]?.trim() || ''

const getHeader = (req: VercelRequest, name: string): string => {
  const match = Object.entries(req.headers).find(
    ([key]) => key.toLowerCase() === name.toLowerCase(),
  )?.[1]

  return Array.isArray(match) ? match[0] || '' : match || ''
}

const json = (
  res: VercelResponse,
  statusCode: number,
  body: JsonObject,
): void => {
  res.status(statusCode).json(body)
}

const errorResponse = (code: string, message: string): JsonObject => ({
  ok: false,
  error: { code, message },
})

const isObject = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const getRequestedPack = (body: unknown): (typeof CREDIT_PACKS)[number] => {
  const packId =
    isObject(body) && typeof body.packId === 'string' ? body.packId : 'popular'
  const pack = CREDIT_PACKS.find((candidate) => candidate.id === packId)

  if (!pack) {
    throw new Error('Invalid Study Credits pack.')
  }

  return pack
}

const normalizeSupabaseUrl = (url: string): string => url.replace(/\/+$/, '')

const supabaseFetch = async (
  path: string,
  token: string,
  init: RequestInit = {},
): Promise<Response> => {
  const supabaseUrl = normalizeSupabaseUrl(getEnv('SUPABASE_URL'))

  return fetch(`${supabaseUrl}${path}`, {
    ...init,
    headers: {
      apikey: token,
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      ...(init.headers || {}),
    },
  })
}

const readResponseJson = async (response: Response): Promise<unknown> => {
  const text = await response.text()
  if (!text) {
    return null
  }

  try {
    return JSON.parse(text)
  } catch {
    return { message: text }
  }
}

const getSupabaseErrorMessage = (payload: unknown): string => {
  if (isObject(payload)) {
    if (typeof payload.message === 'string') {
      return payload.message
    }

    if (typeof payload.details === 'string') {
      return payload.details
    }
  }

  return 'Supabase request failed.'
}

const getBearerToken = (req: VercelRequest): string => {
  const authorization = getHeader(req, 'authorization')
  return authorization.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() || ''
}

const verifyUser = async (accessToken: string): Promise<SupabaseUser> => {
  const response = await supabaseFetch(
    '/auth/v1/user',
    getEnv('SUPABASE_ANON_KEY'),
    {
      method: 'GET',
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    },
  )
  const payload = await readResponseJson(response)

  if (!response.ok || !isObject(payload) || typeof payload.id !== 'string') {
    throw new Error('not_authenticated')
  }

  return { id: payload.id }
}

const callSupabaseRpc = async <T>(
  rpcName: string,
  body: JsonObject,
): Promise<T> => {
  const response = await supabaseFetch(
    `/rest/v1/rpc/${rpcName}`,
    getEnv('SUPABASE_SERVICE_ROLE_KEY'),
    {
      method: 'POST',
      body: JSON.stringify(body),
    },
  )
  const payload = await readResponseJson(response)

  if (!response.ok) {
    throw new Error(getSupabaseErrorMessage(payload))
  }

  return payload as T
}

const getBaseUrl = (req: VercelRequest): string => {
  const origin = getHeader(req, 'origin')
  if (origin) {
    return origin.replace(/\/+$/, '')
  }

  const host = getHeader(req, 'x-forwarded-host') || getHeader(req, 'host')
  const protocol = getHeader(req, 'x-forwarded-proto') || 'https'
  return `${protocol}://${host}`.replace(/\/+$/, '')
}

const ensureConfigured = (): string[] =>
  [
    'STRIPE_SECRET_KEY',
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    ...CREDIT_PACKS.map((pack) => pack.envName),
  ].filter((name) => !getEnv(name))

const createStripe = (): Stripe.Stripe =>
  new Stripe(getEnv('STRIPE_SECRET_KEY'), {
    apiVersion: '2026-05-27.dahlia',
  })

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  res.setHeader('access-control-allow-origin', '*')
  res.setHeader('access-control-allow-methods', 'POST, OPTIONS')
  res.setHeader('access-control-allow-headers', 'authorization, content-type')

  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  if (req.method !== 'POST') {
    json(res, 405, errorResponse('invalid_request', 'Use POST for billing.'))
    return
  }

  const missing = ensureConfigured()
  if (missing.length > 0) {
    json(
      res,
      500,
      errorResponse(
        'not_configured',
        `Study Credits billing is missing server configuration: ${missing.join(', ')}.`,
      ),
    )
    return
  }

  const accessToken = getBearerToken(req)
  if (!accessToken) {
    json(
      res,
      401,
      errorResponse('not_authenticated', 'Sign in to buy Study Credits.'),
    )
    return
  }

  try {
    const user = await verifyUser(accessToken)
    const pack = getRequestedPack(req.body)
    const purchase = await callSupabaseRpc<HostedAiPurchase>(
      'hosted_ai_create_credit_purchase',
      {
        p_owner_id: user.id,
        p_expected_credits: pack.credits,
        p_expected_amount: pack.priceCents,
        p_expected_currency: REFILL_CURRENCY,
        p_metadata: {
          packId: pack.id,
        },
      },
    )
    const purchaseId = purchase.purchaseId || purchase.purchase_id
    if (!purchaseId) {
      throw new Error('Credit purchase RPC did not return a purchase id.')
    }

    const baseUrl = getBaseUrl(req)
    const automaticTaxEnabled = getEnv('STRIPE_AUTOMATIC_TAX') === 'true'
    const session = await createStripe().checkout.sessions.create({
      mode: 'payment',
      client_reference_id: purchaseId,
      line_items: [
        {
          price: getEnv(pack.envName),
          quantity: 1,
        },
      ],
      success_url: `${baseUrl}/workspace?credits=success`,
      cancel_url: `${baseUrl}/workspace?credits=cancel`,
      automatic_tax: {
        enabled: automaticTaxEnabled,
      },
      metadata: {
        purchase_id: purchaseId,
        owner_id: user.id,
        pack_id: pack.id,
        credits: String(pack.credits),
        expected_amount: String(pack.priceCents),
        expected_currency: REFILL_CURRENCY,
      },
    })

    await callSupabaseRpc('hosted_ai_attach_checkout_session', {
      p_purchase_id: purchaseId,
      p_owner_id: user.id,
      p_stripe_checkout_session_id: session.id,
      p_metadata: {
        automaticTaxEnabled,
      },
    })

    json(res, 200, { ok: true, checkoutUrl: session.url })
  } catch (error) {
    if (error instanceof Error && error.message === 'not_authenticated') {
      json(
        res,
        401,
        errorResponse('not_authenticated', 'Sign in to buy Study Credits.'),
      )
      return
    }

    if (
      error instanceof Error &&
      error.message === 'Invalid Study Credits pack.'
    ) {
      json(res, 400, errorResponse('invalid_request', error.message))
      return
    }

    json(
      res,
      500,
      errorResponse(
        'payment_error',
        error instanceof Error
          ? error.message
          : 'Could not start Stripe Checkout.',
      ),
    )
  }
}
