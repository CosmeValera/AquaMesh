import { describe, expect, it } from 'vitest'

import {
  applyHostedPreviewEvent,
  buildHostedPreviewRows,
  describeHostedPreviewStep,
  hostedPreviewPercent,
  makeHostedPreview,
} from '../../../src/studyGuides/hostedPreview'
import type { HostedAiPreviewEvent } from '../../../src/quickCreate/ai/hostedCredits'

// Real order, taken from a live hosted generation.
const TIMELINE: HostedAiPreviewEvent[] = [
  { type: 'stage', stage: 'monolith' },
  { type: 'meta', title: 'How a Sourdough Starter Works', emoji: '🍞' },
  {
    type: 'quickStart',
    keyIdea: 'A starter is a living culture of wild yeast and bacteria.',
    quickSummary: 'Feed it flour and water, and it raises bread for you.',
  },
  {
    type: 'bridge',
    title: 'From Proofing to Starter Activity',
    body: 'You already judge dough by how it rises.',
    topics: ['cooking'],
  },
  { type: 'pageTitle', index: 0, title: 'The Living Mixture' },
  { type: 'page', index: 0, title: 'The Living Mixture', summary: 'Wild yeast.' },
  { type: 'pageTitle', index: 1, title: 'Feeding and Rising' },
  { type: 'page', index: 1, title: 'Feeding and Rising', summary: 'Schedules.' },
  { type: 'pageTitle', index: 2, title: 'Acidity and Judgment' },
  { type: 'page', index: 2, title: 'Acidity and Judgment', summary: 'Taste.' },
  { type: 'stage', stage: 'quiz' },
]

const replay = (events: HostedAiPreviewEvent[]) =>
  events.reduce(applyHostedPreviewEvent, makeHostedPreview(1000))

const t = ((key: string) => key) as Parameters<typeof buildHostedPreviewRows>[1]

describe('hosted Study Guide preview state', () => {
  it('builds the whole checklist from the event stream', () => {
    const rows = buildHostedPreviewRows(replay(TIMELINE), t)

    expect(rows.map((row) => row.label)).toEqual([
      '🍞 How a Sourdough Starter Works',
      'studyGuides.preview.keyIdea',
      'studyGuides.preview.bridge: cooking',
      'The Living Mixture',
      'Feeding and Rising',
      'Acidity and Judgment',
      'studyGuides.preview.finalQuiz',
    ])
    expect(rows.filter((row) => row.done)).toHaveLength(6)
  })

  it('shows a page as pending between its title and its body', () => {
    const upToSecondTitle = replay(TIMELINE.slice(0, 7))
    const rows = buildHostedPreviewRows(upToSecondTitle, t)

    expect(rows.find((row) => row.label === 'The Living Mixture')?.done).toBe(
      true,
    )
    expect(rows.find((row) => row.label === 'Feeding and Rising')?.done).toBe(
      false,
    )
    expect(describeHostedPreviewStep(upToSecondTitle, t)).toBe(
      'Feeding and Rising',
    )
  })

  it('names the step being worked on, for the collapsed card', () => {
    expect(describeHostedPreviewStep(makeHostedPreview(0), t)).toBe(
      'studyGuides.preview.naming',
    )
    expect(describeHostedPreviewStep(replay(TIMELINE.slice(0, 2)), t)).toBe(
      'studyGuides.preview.keyIdea',
    )
    expect(describeHostedPreviewStep(replay(TIMELINE), t)).toBe(
      'studyGuides.preview.finalQuiz',
    )
  })

  it('reports progress that only ever moves forward', () => {
    let previous = -1
    TIMELINE.forEach((_event, index) => {
      const percent = hostedPreviewPercent(replay(TIMELINE.slice(0, index + 1)))
      expect(percent).toBeGreaterThanOrEqual(previous)
      expect(percent).toBeLessThanOrEqual(95)
      previous = percent
    })

    expect(hostedPreviewPercent(makeHostedPreview(0))).toBe(0)
    expect(previous).toBeGreaterThan(70)
  })

  it('drops everything previewed when the model call is retried', () => {
    const afterReset = applyHostedPreviewEvent(replay(TIMELINE), {
      type: 'reset',
    })

    expect(afterReset).toEqual(makeHostedPreview(1000))
    expect(buildHostedPreviewRows(afterReset, t)).toHaveLength(3)
  })

  it('keeps a page title when only the finished page carries no title', () => {
    const state = [
      { type: 'pageTitle', index: 0, title: 'Kept' },
      { type: 'page', index: 0, title: '', summary: 'Body.' },
    ].reduce(
      applyHostedPreviewEvent,
      makeHostedPreview(0),
    )

    expect(state.pages[0]).toEqual({ title: 'Kept', done: true })
  })

  it('tolerates a page arriving out of order', () => {
    const state = applyHostedPreviewEvent(makeHostedPreview(0), {
      type: 'page',
      index: 2,
      title: 'Third',
      summary: 'Body.',
    })

    expect(state.pages).toHaveLength(3)
    expect(state.pages[2]).toEqual({ title: 'Third', done: true })
    expect(state.pages[0]).toEqual({ title: '', done: false })
  })
})
