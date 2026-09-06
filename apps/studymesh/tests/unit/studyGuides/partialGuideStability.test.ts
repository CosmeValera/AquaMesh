import { describe, expect, it } from 'vitest'

import { buildEnhancedStudyGuideText } from '../../../../../api/hosted-ai'
import { generateStudyPathWithAi } from '../../../src/quickCreate/ai/strongGeneration'

/**
 * The gate for reading page 1 early.
 *
 * A learner opens the guide at ~18s with one page, then pages 2 and 3 arrive.
 * That is only safe if page 1 comes out of a one-page build IDENTICAL to how it
 * comes out of the finished three-page build. If it does not, the learner is
 * reading something that will change under them, and the whole idea is wrong.
 *
 * The specific hazard: every per-page field in `buildEnhancedStudyGuideText` is
 * chosen by `index === pages.length - 1`. In a one-page guide that makes page 1
 * the last page, which would hand it the final-review treatment and the quiz.
 * Only the genuinely last page ever carries those.
 */

const PAGES = [
  {
    title: 'What a sourdough starter is',
    summary: 'A living culture of wild yeast and bacteria.',
    rawNotes: 'Flour and water, left to catch what is already in the air.',
    pageIdeas: [],
  },
  {
    title: 'Feeding and rising',
    summary: 'Why it doubles, and when.',
    rawNotes: 'Discard, feed, wait. Temperature sets the pace.',
    pageIdeas: [],
  },
  {
    title: 'Acidity and judgement',
    summary: 'Reading smell and texture.',
    rawNotes: 'Sour means hungry. Domed means ready.',
    pageIdeas: [],
  },
]

const BLUEPRINT = {
  title: 'How a Sourdough Starter Works',
  folderName: 'Baking',
  emoji: '🍞',
  quickStart: {
    keyIdea: 'A starter is a culture you feed so it can raise bread for you.',
    quickSummary: 'Wild yeast makes gas; bacteria make the sour.',
  },
  pages: PAGES.map((page) => ({
    title: page.title,
    keyFacts: [],
    conciseNotes: '',
    examplesNeeded: [],
    quizSkills: [],
  })),
}

const QUESTIONS = Array.from({ length: 6 }).map((_item, index) => ({
  question: `Question ${index + 1}?`,
  options: ['A', 'B', 'C', 'D'],
  correctIndex: 0,
  explanation: 'Because A.',
  skillTested: 'sourdough',
}))

/** Runs a guide text through the real client parse, as the hosted path does. */
const parseGuideText = (text: string) =>
  generateStudyPathWithAi({
    apiToken: '',
    model: 'test-model',
    strongProvider: 'cerebras',
    // Mirrors the hosted branch in quickCreate/ai/provider.ts.
    singleRequest: true,
    studyGuideProfile: 'lean',
    strongTransport: async () => text,
    title: 'Study Guide',
    folderName: '',
    prompt: 'Teach me how a sourdough starter works',
  })

const buildText = (pageCount: number, isComplete: boolean) =>
  buildEnhancedStudyGuideText({
    blueprint: BLUEPRINT,
    pages: PAGES.slice(0, pageCount),
    questions: isComplete ? QUESTIONS : [],
    quickStart: BLUEPRINT.quickStart,
    isComplete,
  })

describe('a partial Study Guide is a stable prefix of the finished one', () => {
  it('does not promote page 1 to the final page in a one-page build', () => {
    const partial = JSON.parse(buildText(1, false))

    expect(partial.dashboards).toHaveLength(1)
    expect(partial.dashboards[0]).toMatchObject({
      title: PAGES[0].title,
      dashboardPurpose: 'lesson',
      practiceType: 'none',
      contentMode: 'conceptLesson',
      practice: { multipleChoice: [] },
    })
  })

  it('still gives the finished guide its final-page quiz', () => {
    const complete = JSON.parse(buildText(3, true))

    expect(complete.dashboards).toHaveLength(3)
    expect(complete.dashboards[0]).toMatchObject({
      dashboardPurpose: 'lesson',
      practiceType: 'none',
    })
    expect(complete.dashboards[2]).toMatchObject({
      dashboardPurpose: 'finalReview',
      practiceType: 'quiz',
      contentMode: 'synthesisReview',
    })
    expect(complete.dashboards[2].practice.multipleChoice).toHaveLength(6)
  })

  it('emits an identical page 1 whether one page or three are written', () => {
    const partial = JSON.parse(buildText(1, false))
    const complete = JSON.parse(buildText(3, true))

    // The whole early-reading idea rests on this line.
    expect(partial.dashboards[0]).toEqual(complete.dashboards[0])
    expect(partial.title).toBe(complete.title)
    expect(partial.quickStart).toEqual(complete.quickStart)
  })

  /**
   * This is why a partial guide must NOT go through generateStudyPathWithAi.
   *
   * That path treats a guide with fewer than three dashboards as broken model
   * output and repairs it, substituting deterministic filler pages
   * (strongGeneration.ts:2726-2733, lean step names at :2453). The repair is
   * right for a bad generation and wrong for a guide that is simply not
   * finished yet: the learner would be handed two invented pages.
   */
  it('is padded with invented pages by the repair path, so avoid it', async () => {
    const draft = await parseGuideText(buildText(1, false))

    expect(draft.dashboards).toHaveLength(3)
    expect(draft.dashboards[0].title).toBe(PAGES[0].title)
    // Pages 2 and 3 are fabricated, not the real pages 2 and 3.
    expect(draft.dashboards[1].title).not.toBe(PAGES[1].title)
    expect(draft.dashboards[1].rawNotes).toContain('Study this section of')
  })

  it('parses the finished guide into its three real pages', async () => {
    const draft = await parseGuideText(buildText(3, true))

    expect(draft.dashboards.map((dashboard) => dashboard.title)).toEqual(
      PAGES.map((page) => page.title),
    )
    expect(draft.quickStart?.keyIdea).toBe(BLUEPRINT.quickStart.keyIdea)
  })
})
