import { describe, expect, it } from 'vitest'

import {
  applyHostedPreviewEvent,
  buildHostedPreviewRows,
  describeHostedPreviewStep,
  hasHostedPreviewSignal,
  hostedPreviewPercent,
  makeHostedPreviewFromSnapshot,
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
    // Blank still shows the full shape: title, key idea, 3 pages, final quiz.
    expect(buildHostedPreviewRows(afterReset, t)).toHaveLength(6)
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

describe('rebuilding a checklist from a gateway snapshot', () => {
  it('matches what watching the same events live would have produced', () => {
    const live = replay(TIMELINE)
    const snapshot = {
      title: live.title,
      emoji: live.emoji,
      keyIdea: live.keyIdea,
      bridgeTopics: live.bridgeTopics,
      pages: live.pages,
      stage: live.stage,
    }

    const resumed = makeHostedPreviewFromSnapshot(snapshot, 1000)

    expect(resumed).toEqual(live)
    expect(buildHostedPreviewRows(resumed, t)).toEqual(
      buildHostedPreviewRows(live, t),
    )
    expect(hostedPreviewPercent(resumed)).toBe(hostedPreviewPercent(live))
  })

  it('keeps the original start time so elapsed does not restart', () => {
    const resumed = makeHostedPreviewFromSnapshot({ title: 'Kept' }, 12345)

    expect(resumed.startedAt).toBe(12345)
  })

  it('reports no signal for a blank snapshot, so the bar can fall back', () => {
    expect(hasHostedPreviewSignal(makeHostedPreviewFromSnapshot({}, 0))).toBe(
      false,
    )
    expect(hasHostedPreviewSignal(makeHostedPreviewFromSnapshot(undefined, 0))).toBe(
      false,
    )
    expect(
      hasHostedPreviewSignal(makeHostedPreviewFromSnapshot({ title: 'x' }, 0)),
    ).toBe(true)
  })

  it('shows the pages still to come as placeholders', () => {
    // The checklist declares its whole shape up front, so rows never appear
    // out of nowhere between 'Key idea' and 'Final quiz'.
    const resumed = makeHostedPreviewFromSnapshot(
      { title: 'Half a guide', pages: [{ title: 'One', done: true }] },
      0,
    )

    expect(resumed.keyIdea).toBe('')
    expect(resumed.bridgeTopics).toEqual([])
    expect(resumed.pages).toEqual([{ title: 'One', done: true }])
    expect(buildHostedPreviewRows(resumed, t).map((row) => row.label)).toEqual([
      'Half a guide',
      'studyGuides.preview.keyIdea',
      'One',
      'studyGuides.preview.page 2',
      'studyGuides.preview.page 3',
      'studyGuides.preview.finalQuiz',
    ])
    expect(
      buildHostedPreviewRows(resumed, t).filter((row) => row.done),
    ).toHaveLength(2)
  })

  it('keeps advancing from a snapshot when live events resume', () => {
    const resumed = makeHostedPreviewFromSnapshot(
      { title: 'Guide', pages: [{ title: 'One', done: true }] },
      0,
    )
    const advanced = applyHostedPreviewEvent(resumed, {
      type: 'pageTitle',
      index: 1,
      title: 'Two',
    })

    expect(advanced.pages).toEqual([
      { title: 'One', done: true },
      { title: 'Two', done: false },
    ])
    expect(advanced.startedAt).toBe(0)
  })
})

describe('the checklist declares its whole shape up front', () => {
  it('lists every page before any of them has arrived', () => {
    const rows = buildHostedPreviewRows(makeHostedPreview(0), t)

    expect(rows.map((row) => row.label)).toEqual([
      'studyGuides.preview.naming',
      'studyGuides.preview.keyIdea',
      'studyGuides.preview.page 1',
      'studyGuides.preview.page 2',
      'studyGuides.preview.page 3',
      'studyGuides.preview.finalQuiz',
    ])
    expect(rows.every((row) => !row.done)).toBe(true)
  })

  it('reserves a bridge row only when a bridge is possible', () => {
    const withBridge = makeHostedPreview(0, { expectsBridge: true })
    const withoutBridge = makeHostedPreview(0, { expectsBridge: false })

    expect(buildHostedPreviewRows(withBridge, t).map((row) => row.id)).toContain(
      'bridge',
    )
    expect(
      buildHostedPreviewRows(withoutBridge, t).map((row) => row.id),
    ).not.toContain('bridge')
  })

  it('stops reserving the bridge once a page landed without one', () => {
    // The bridge always precedes page 1, so no bridge by then means none exists
    // and the row should not sit pending forever.
    const afterPage = applyHostedPreviewEvent(
      makeHostedPreview(0, { expectsBridge: true }),
      { type: 'page', index: 0, title: 'One', summary: 'x' },
    )

    expect(buildHostedPreviewRows(afterPage, t).map((row) => row.id)).not.toContain(
      'bridge',
    )
  })

  it('never changes the number of rows as the real pages arrive', () => {
    const initial = buildHostedPreviewRows(
      makeHostedPreview(1000, { expectsBridge: true }),
      t,
    ).length

    TIMELINE.forEach((_event, index) => {
      const rows = buildHostedPreviewRows(
        TIMELINE.slice(0, index + 1).reduce(
          applyHostedPreviewEvent,
          makeHostedPreview(1000, { expectsBridge: true }),
        ),
        t,
      )
      expect(rows).toHaveLength(initial)
    })
  })
})
