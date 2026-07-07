import { Readable } from 'node:stream'

import Stripe = require('stripe')

import { loadLocalApiEnv } from './local-env'

loadLocalApiEnv()

type JsonObject = Record<string, unknown>

interface VercelRequest extends Readable {
  method?: string
  headers: Record<string, string | string[] | undefined>
  body?: unknown
}

interface VercelResponse {
  status(code: number): VercelResponse
  json(body: JsonObject): void
  send(body: string): void
  end(): void
}

interface CheckoutSession {
  id: string
  client_reference_id?: string | null
  payment_status?: string | null
  amount_total?: number | null
  currency?: string | null
  payment_intent?: string | { id?: string | null } | null
  metadata?: Record<string, string> | null
  line_items?: {
    data?: Array<{
      price?: string | { id?: string | null } | null
    }>
  }
}

interface StripeEvent {
  id: string
  type: string
  data: {
    object: CheckoutSession
  }
}

const REFILL_CURRENCY = 'eur'
const CREDIT_PACKS = [
  {
    id: 'starter',
    credits: 150,
    priceCents: 200,
    envName: 'STRIPE_STUDY_CREDITS_PRICE_ID_2_EUR',
  },
  {
    id: 'popular',
    credits: 450,
    priceCents: 500,
    envName: 'STRIPE_STUDY_CREDITS_PRICE_ID_5_EUR',
  },
  {
    id: 'value',
    credits: 1000,
    priceCents: 1000,
    envName: 'STRIPE_STUDY_CREDITS_PRICE_ID_10_EUR',
  },
] as const

export const config = {
  api: {
    bodyParser: false,
  },
}

const getEnv = (name: string): string => process.env[name]?.trim() || ''

const getHeader = (req: VercelRequest, name: string): string => {
  const match = Object.entries(req.headers).find(
    ([key]) => key.toLowerCase() === name.toLowerCase(),
  )?.[1]

  return Array.isArray(match) ? match[0] || '' : match || ''
}

const isObject = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const normalizeSupabaseUrl = (url: string): string => url.replace(/\/+$/, '')

const readRawBody = async (req: VercelRequest): Promise<Buffer> => {
  const chunks: Buffer[] = []

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }

  return Buffer.concat(chunks)
}

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

const createStripe = (): Stripe.Stripe =>
  new Stripe(getEnv('STRIPE_SECRET_KEY'), {
    apiVersion: '2026-05-27.dahlia',
  })

const getLineItemPriceId = (session: CheckoutSession): string => {
  const lineItem = session.line_items?.data?.[0]
  const price = lineItem?.price
  return typeof price === 'string' ? price : price?.id || ''
}

const getPackForSession = (session: CheckoutSession) => {
  const metadataPackId = session.metadata?.pack_id
  const metadataPack = CREDIT_PACKS.find((pack) => pack.id === metadataPackId)
  if (metadataPack) {
    return metadataPack
  }

  const priceId = getLineItemPriceId(session)
  return CREDIT_PACKS.find((pack) => getEnv(pack.envName) === priceId)
}

const retrieveSession = async (
  stripe: Stripe.Stripe,
  sessionId: string,
): Promise<CheckoutSession> =>
  (await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ['line_items.data.price'],
  })) as CheckoutSession

const validatePaidSession = (session: CheckoutSession) => {
  const pack = getPackForSession(session)

  if (!pack) {
    throw new Error(
      'Checkout Session price does not match Study Credits refill.',
    )
  }

  if (session.payment_status !== 'paid') {
    throw new Error('Checkout Session is not paid.')
  }

  if (!session.client_reference_id) {
    throw new Error('Checkout Session is missing purchase reference.')
  }

  if (
    session.metadata?.credits &&
    Number(session.metadata.credits) !== pack.credits
  ) {
    throw new Error('Checkout Session credits do not match Study Credits refill.')
  }

  if (
    session.metadata?.expected_amount &&
    Number(session.metadata.expected_amount) !== pack.priceCents
  ) {
    throw new Error(
      'Checkout Session metadata amount does not match Study Credits refill.',
    )
  }

  if (session.amount_total !== pack.priceCents) {
    throw new Error(
      'Checkout Session amount does not match Study Credits refill.',
    )
  }

  if ((session.currency || '').toLowerCase() !== REFILL_CURRENCY) {
    throw new Error(
      'Checkout Session currency does not match Study Credits refill.',
    )
  }

  return pack
}

const handlePaidSession = async (
  stripe: Stripe.Stripe,
  event: StripeEvent,
): Promise<void> => {
  const sourceSession = event.data.object
  const session = await retrieveSession(stripe, sourceSession.id)

  const pack = validatePaidSession(session)

  await callSupabaseRpc('hosted_ai_mark_credit_purchase_paid', {
    p_purchase_id: session.client_reference_id,
    p_stripe_checkout_session_id: session.id,
    p_stripe_payment_intent_id:
      typeof session.payment_intent === 'string'
        ? session.payment_intent
        : session.payment_intent?.id || null,
    p_expected_credits: pack.credits,
    p_expected_amount: pack.priceCents,
    p_expected_currency: REFILL_CURRENCY,
    p_metadata: {
      stripeEventId: event.id,
      packId: pack.id,
    },
  })
}

const handleTerminalSession = async (
  event: StripeEvent,
  status: 'failed' | 'expired',
): Promise<void> => {
  const session = event.data.object
  const purchaseId =
    session.client_reference_id || session.metadata?.purchase_id

  if (!purchaseId) {
    throw new Error('Checkout Session is missing purchase reference.')
  }

  await callSupabaseRpc('hosted_ai_mark_credit_purchase_terminal', {
    p_purchase_id: purchaseId,
    p_stripe_checkout_session_id: session.id,
    p_status: status,
    p_metadata: {
      stripeEventId: event.id,
    },
  })
}

const ensureConfigured = (): string[] =>
  [
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    ...CREDIT_PACKS.map((pack) => pack.envName),
  ].filter((name) => !getEnv(name))

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: { code: 'invalid_request' } })
    return
  }

  const missing = ensureConfigured()
  if (missing.length > 0) {
    res.status(500).json({
      ok: false,
      error: {
        code: 'not_configured',
        message: `Stripe webhook is missing server configuration: ${missing.join(', ')}.`,
      },
    })
    return
  }

  const stripe = createStripe()
  const signature = getHeader(req, 'stripe-signature')

  let event: StripeEvent
  try {
    event = stripe.webhooks.constructEvent(
      await readRawBody(req),
      signature,
      getEnv('STRIPE_WEBHOOK_SECRET'),
    ) as StripeEvent
  } catch (error) {
    res
      .status(400)
      .send(
        error instanceof Error
          ? `Webhook signature error: ${error.message}`
          : 'Webhook signature error.',
      )
    return
  }

  try {
    if (
      event.type === 'checkout.session.completed' ||
      event.type === 'checkout.session.async_payment_succeeded'
    ) {
      await handlePaidSession(stripe, event)
    } else if (event.type === 'checkout.session.async_payment_failed') {
      await handleTerminalSession(event, 'failed')
    } else if (event.type === 'checkout.session.expired') {
      await handleTerminalSession(event, 'expired')
    }

    res.status(200).json({ ok: true })
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: {
        code: 'webhook_error',
        message:
          error instanceof Error
            ? error.message
            : 'Stripe webhook handling failed.',
      },
    })
  }
}
