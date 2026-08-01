import { afterEach, describe, expect, it, vi } from 'vitest'

import { getClientIp, hashClientIp } from '../../../../../api/client-ip'

describe('guest client IP resolution', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('prefers the platform set header over forwarded hops', () => {
    expect(
      getClientIp({
        'x-vercel-forwarded-for': '9.9.9.9',
        'x-real-ip': '8.8.8.8',
        'x-forwarded-for': '1.2.3.4, 5.6.7.8',
      }),
    ).toBe('9.9.9.9')
  })

  it('falls back to x-real-ip and then the first forwarded hop', () => {
    expect(
      getClientIp({
        'x-real-ip': '8.8.8.8',
        'x-forwarded-for': '1.2.3.4, 5.6.7.8',
      }),
    ).toBe('8.8.8.8')
    expect(getClientIp({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8' })).toBe(
      '1.2.3.4',
    )
  })

  it('reads header names case insensitively and unwraps array values', () => {
    expect(getClientIp({ 'X-Forwarded-For': ['1.2.3.4', '5.6.7.8'] })).toBe(
      '1.2.3.4',
    )
  })

  it('strips an IPv4 port', () => {
    expect(getClientIp({ 'x-real-ip': '1.2.3.4:5678' })).toBe('1.2.3.4')
  })

  it('truncates a bracketed IPv6 address with a port to its /64 prefix', () => {
    expect(getClientIp({ 'x-real-ip': '[2001:db8:1:2::5]:443' })).toBe(
      '2001:db8:1:2::',
    )
  })

  it('does not truncate a bare IPv6 address through the port stripper', () => {
    expect(getClientIp({ 'x-real-ip': '2001:db8:1:2:3:4:5:6' })).toBe(
      '2001:db8:1:2::',
    )
  })

  it('normalizes equivalent IPv6 spellings to the same prefix', () => {
    expect(
      getClientIp({ 'x-real-ip': '2001:0db8:0001:0002:0000:0000:0000:0001' }),
    ).toBe(getClientIp({ 'x-real-ip': '2001:db8:1:2::1' }))
  })

  it('unwraps IPv4 mapped addresses instead of bucketing them together', () => {
    expect(getClientIp({ 'x-real-ip': '::ffff:1.2.3.4' })).toBe('1.2.3.4')
    expect(getClientIp({ 'x-real-ip': '::ffff:5.6.7.8' })).toBe('5.6.7.8')
  })

  it('returns an empty string for missing or unparseable addresses', () => {
    expect(getClientIp({})).toBe('')
    expect(getClientIp({ 'x-real-ip': 'not-an-address' })).toBe('')
    expect(getClientIp({ 'x-forwarded-for': ' , 5.6.7.8' })).toBe('')
    expect(getClientIp({ 'x-real-ip': '999.1.1' })).toBe('')
  })
})

describe('guest client IP hashing', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('is stable for the same address and secret', () => {
    vi.stubEnv('GUEST_IP_HASH_SECRET', 'secret-one')

    expect(hashClientIp('1.2.3.4')).toBe(hashClientIp('1.2.3.4'))
    expect(hashClientIp('1.2.3.4')).not.toBe(hashClientIp('5.6.7.8'))
  })

  it('changes when the secret is rotated', () => {
    vi.stubEnv('GUEST_IP_HASH_SECRET', 'secret-one')
    const first = hashClientIp('1.2.3.4')

    vi.stubEnv('GUEST_IP_HASH_SECRET', 'secret-two')

    expect(hashClientIp('1.2.3.4')).not.toBe(first)
  })

  it('never returns a hash for an empty address', () => {
    vi.stubEnv('GUEST_IP_HASH_SECRET', 'secret-one')

    expect(hashClientIp('')).toBe('')
  })

  it('still hashes without a configured secret', () => {
    vi.stubEnv('GUEST_IP_HASH_SECRET', '')

    expect(hashClientIp('1.2.3.4')).toMatch(/^[0-9a-f]{64}$/)
  })
})
