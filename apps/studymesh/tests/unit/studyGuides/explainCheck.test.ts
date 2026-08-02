import { beforeEach, describe, expect, it, vi } from 'vitest'

const callHostedAiModel = vi.fn()
const callStrongAiModel = vi.fn()
const callLocalLanguageModel = vi.fn()
const readQuickCreateAiSettings = vi.fn()
const resolveQuickCreateAiCredentials = vi.fn()

vi.mock('../../../src/quickCreate/ai/hostedClient', () => ({
  callHostedAiModel: (...args: unknown[]) => callHostedAiModel(...args),
}))

vi.mock('../../../src/quickCreate/ai/strongProviders', async () => {
  const actual = await vi.importActual<
    typeof import('../../../src/quickCreate/ai/strongProviders')
  >('../../../src/quickCreate/ai/strongProviders')

  return {
    ...actual,
    callStrongAiModel: (...args: unknown[]) => callStrongAiModel(...args),
  }
})

vi.mock('../../../src/quickCreate/ai/localLanguageModel', () => ({
  callLocalLanguageModel: (...args: unknown[]) =>
    callLocalLanguageModel(...args),
}))

vi.mock('../../../src/quickCreate/ai/settings', () => ({
  readQuickCreateAiSettings: () => readQuickCreateAiSettings(),
  resolveQuickCreateAiCredentials: (...args: unknown[]) =>
    resolveQuickCreateAiCredentials(...args),
}))

import {
  countExplanationWords,
  EXPLAIN_MAX_WORDS,
  EXPLAIN_MIN_WORDS,
  gradeGuideExplanation,
  parseExplainCheckResult,
  resolveExplainCheckCost,
} from '../../../src/studyGuides/explainCheck'
import { hasFreeExplainAttempt } from '../../../src/studyGuides/mastery'

const passResponse = JSON.stringify({
  verdict: 'pass',
  feedback: 'That is the idea.',
  corrections: [],
  suggestion: '',
})

const explanationOf = (words: number) =>
  Array.from({ length: words }, (_value, index) => `word${index}`).join(' ')

const gradeRobots = (explanation = explanationOf(EXPLAIN_MIN_WORDS)) =>
  gradeGuideExplanation({
    studyGuideId: 'guide-1',
    topic: 'Robots',
    source: 'A robot senses, decides and acts.',
    explanation,
  })

describe('explain check', () => {
  let storage: Record<string, string>

  beforeEach(() => {
    storage = {}
    vi.mocked(localStorage.getItem).mockImplementation(
      (key: string) => storage[key] ?? null,
    )
    vi.mocked(localStorage.setItem).mockImplementation(
      (key: string, value: string) => {
        storage[key] = value
      },
    )
    callHostedAiModel.mockReset().mockResolvedValue(passResponse)
    callStrongAiModel.mockReset().mockResolvedValue(passResponse)
    callLocalLanguageModel.mockReset().mockResolvedValue(passResponse)
    readQuickCreateAiSettings
      .mockReset()
      .mockReturnValue({ provider: 'hosted' })
    resolveQuickCreateAiCredentials
      .mockReset()
      .mockReturnValue({ apiToken: 'token', model: 'model' })
  })

  it('counts words the way the limits are written', () => {
    expect(countExplanationWords('  ')).toBe(0)
    expect(countExplanationWords('a robot  senses and acts')).toBe(5)
  })

  it('refuses explanations outside the Duolingo-sized window', async () => {
    await expect(
      gradeRobots(explanationOf(EXPLAIN_MIN_WORDS - 1)),
    ).rejects.toThrow(/between/i)
    await expect(
      gradeRobots(explanationOf(EXPLAIN_MAX_WORDS + 1)),
    ).rejects.toThrow(/between/i)
    expect(callHostedAiModel).not.toHaveBeenCalled()
  })

  it('spends the one free hosted call, then charges the next attempt', async () => {
    const first = await gradeRobots()

    expect(first.cost).toBe('free')
    expect(callHostedAiModel.mock.calls[0][0]).toMatchObject({
      surface: 'mastery-check',
      stage: 'study_guide_mastery_check',
    })
    expect(hasFreeExplainAttempt('guide-1')).toBe(false)

    const second = await gradeRobots()

    expect(second.cost).toBe('credit')
    expect(callHostedAiModel.mock.calls[1][0]).toMatchObject({
      surface: 'quick-create',
    })
  })

  it('keeps the free call per guide rather than per learner', async () => {
    await gradeRobots()

    expect(hasFreeExplainAttempt('guide-2')).toBe(true)
  })

  it('never spends a hosted call on a bring-your-own provider', async () => {
    readQuickCreateAiSettings.mockReturnValue({ provider: 'gemini' })

    const result = await gradeRobots()

    expect(result.cost).toBe('free')
    expect(callHostedAiModel).not.toHaveBeenCalled()
    expect(callStrongAiModel).toHaveBeenCalledTimes(1)
    expect(hasFreeExplainAttempt('guide-1')).toBe(true)
  })

  it('runs the check locally without any hosted call', async () => {
    readQuickCreateAiSettings.mockReturnValue({ provider: 'local' })

    const result = await gradeRobots()

    expect(result.passed).toBe(true)
    expect(callLocalLanguageModel).toHaveBeenCalledTimes(1)
    expect(callHostedAiModel).not.toHaveBeenCalled()
  })

  it('prices a retry only where a hosted call is actually charged', () => {
    expect(resolveExplainCheckCost('hosted', true)).toBe('free')
    expect(resolveExplainCheckCost('hosted', false)).toBe('credit')
    expect(resolveExplainCheckCost('gemini', false)).toBe('free')
    expect(resolveExplainCheckCost('local', false)).toBe('free')
  })

  it('reads a fenced answer and drops half-written corrections', () => {
    const result = parseExplainCheckResult(
      '```json\n' +
        JSON.stringify({
          verdict: 'retry',
          feedback: 'Almost.',
          corrections: [
            { quote: 'robots think', better: 'robots follow rules', why: 'no' },
            { quote: 'only this', better: '', why: 'dropped' },
          ],
          suggestion: 'A robot senses, decides and acts.',
        }) +
        '\n```',
    )

    expect(result.passed).toBe(false)
    expect(result.corrections).toHaveLength(1)
    expect(result.corrections[0].better).toBe('robots follow rules')
    expect(result.suggestion).toBe('A robot senses, decides and acts.')
  })

  it('rejects an answer that is not an object', () => {
    expect(() => parseExplainCheckResult('nope')).toThrow()
  })
})
