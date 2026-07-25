import { describe, expect, it } from 'vitest'

import {
  buildPodcastScriptPrompt,
  normalizePodcastSourceText,
} from '../../../../../api/hosted-ai'

describe('normalizePodcastSourceText', () => {
  it('reduces a URL to a sayable host', () => {
    // The exact literal a live episode read out loud, scheme and path included.
    const normalized = normalizePodcastSourceText(
      'the resource location, like https://api.example.com/v1/users.',
    )

    expect(normalized).toContain('api dot example dot com')
    expect(normalized).not.toContain('https://')
    expect(normalized).not.toContain('/v1/users')
  })

  it('turns a grouped numeral into a rounded spoken magnitude', () => {
    expect(normalizePodcastSourceText('2^20 = 1,048,576')).toBe(
      '2^20 = about 1.05 million',
    )
  })

  it('keeps small grouped numerals as plain digits', () => {
    // Under ten thousand only the separator is a problem; the value is easy to say.
    expect(normalizePodcastSourceText('you invest $1,000 today')).toBe(
      'you invest $1000 today',
    )
  })

  it('leaves decimals a formula depends on untouched', () => {
    // Rounding these was tried and reverted: over the real compound-interest
    // guide it produced `\frac{about 0.07}{12}` and `1000(about 1.01)^{36}`,
    // and 1.01^36 is about 1.43, not the 1240.90 the same paragraph states.
    const source = 'A \\approx 1000(1.0060417)^{36} with \\frac{0.0725}{12}'

    expect(normalizePodcastSourceText(source)).toBe(source)
  })

  it('does not stack a hedge the source already had', () => {
    expect(normalizePodcastSourceText('roughly 1,048,576 bytes')).toBe(
      'roughly 1.05 million bytes',
    )
    expect(normalizePodcastSourceText('e ≈ 1,048,576')).toBe('e ≈ 1.05 million')
    // LaTeX writes the same hedge as a command rather than a character.
    expect(normalizePodcastSourceText('n \\approx 1,048,576')).toBe(
      'n \\approx 1.05 million',
    )
  })

  it('normalizes the source the real prompt embeds', () => {
    // Guards the wiring, not the regexes: the prompt must carry treated source.
    const prompt = buildPodcastScriptPrompt({
      sourceTitle: 'http-requests_basics',
      sourceText: 'Call https://api.example.com/v1/users for 1,048,576 bytes.',
      outputLanguage: undefined,
    })

    expect(prompt).toContain('api dot example dot com')
    expect(prompt).toContain('about 1.05 million')
    expect(prompt).not.toContain('1,048,576')
  })
})
