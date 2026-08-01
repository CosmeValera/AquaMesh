import { createHash, createHmac } from 'node:crypto'

import { getHeader } from './cors'

type HeaderMap = Record<string, string | string[] | undefined>

const IP_CHARACTERS = /^[0-9a-f.:]+$/
const IPV4_MAPPED = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/
const IPV4 = /^\d{1,3}(?:\.\d{1,3}){3}$/

const getEnv = (name: string): string => process.env[name]?.trim() || ''

const stripPort = (value: string): string => {
  if (value.startsWith('[')) {
    const closing = value.indexOf(']')
    return closing === -1 ? value.slice(1) : value.slice(1, closing)
  }

  const parts = value.split(':')

  // Only `host:port` is unambiguous. A bare IPv6 address has more than one
  // colon, so splitting it here would truncate a real address.
  return parts.length === 2 ? parts[0] : value
}

const normalizeHextet = (value: string): string =>
  value.replace(/^0+(?=.)/, '') || '0'

// One device legitimately rotates addresses inside its assigned prefix, so
// counting per address would let a single visitor mint unlimited trials.
const toIpv6Prefix = (value: string): string => {
  const compressedIndex = value.indexOf('::')
  let hextets: string[]

  if (compressedIndex === -1) {
    hextets = value.split(':')
  } else {
    const head = value.slice(0, compressedIndex)
    const tail = value.slice(compressedIndex + 2)
    const headParts = head ? head.split(':') : []
    const tailParts = tail ? tail.split(':') : []
    const missing = Math.max(8 - headParts.length - tailParts.length, 0)
    hextets = [
      ...headParts,
      ...Array.from({ length: missing }, () => '0'),
      ...tailParts,
    ]
  }

  return `${hextets.slice(0, 4).map(normalizeHextet).join(':')}::`
}

const normalizeIp = (value: string): string => {
  const candidate = stripPort(value.trim()).toLowerCase()

  if (!candidate || !IP_CHARACTERS.test(candidate)) {
    return ''
  }

  const mapped = candidate.match(IPV4_MAPPED)
  if (mapped) {
    return mapped[1]
  }

  if (!candidate.includes(':')) {
    return IPV4.test(candidate) ? candidate : ''
  }

  return toIpv6Prefix(candidate)
}

/**
 * Resolves the caller's address for guest rate limiting.
 *
 * On Vercel `x-vercel-forwarded-for` and `x-real-ip` are platform set and
 * cannot be spoofed by the caller, and `x-forwarded-for` is rewritten so the
 * first hop is the real client. Behind any other proxy this precedence needs
 * review. Returns an empty string when no address can be trusted.
 */
export const getClientIp = (headers: HeaderMap): string => {
  const candidates = [
    getHeader(headers, 'x-vercel-forwarded-for'),
    getHeader(headers, 'x-real-ip'),
    getHeader(headers, 'x-forwarded-for').split(',')[0] || '',
  ]

  for (const candidate of candidates) {
    const normalized = normalizeIp(candidate)

    if (normalized) {
      return normalized
    }
  }

  return ''
}

/**
 * Hashes an address before it reaches Postgres. Raw addresses are never stored
 * or logged; rotating `GUEST_IP_HASH_SECRET` resets the daily counters.
 */
export const hashClientIp = (ip: string): string => {
  if (!ip) {
    return ''
  }

  const secret = getEnv('GUEST_IP_HASH_SECRET')

  if (!secret) {
    return createHash('sha256').update(`studymesh-guest:${ip}`).digest('hex')
  }

  return createHmac('sha256', secret).update(ip).digest('hex')
}
