import { describe, expect, it } from 'vitest'

import {
  buildStudyGuidePagePrompt,
  consumeStudyGuidePlannedLesson,
  deriveStudyGuidePageIdeas,
  parseStudyGuideGrowthPageResponse,
  readStudyGuideGrowthLabel,
  readStudyGuideGrowthParentKey,
} from '../../../src/studyGuides/pageGrowth'
import {
  buildStudyGuideTopicPrompt,
  sanitizeStudyGuidePageIdeas,
  sanitizeStudyGuidePlannedLessons,
  STUDY_GUIDE_PAGE_IDEA_AXES,
} from '../../../src/studyGuides/studyGuideTitles'
import type {
  StudyPathContainerState,
  StudyPathDashboardItem,
} from '../../../src/state/store'

const makePage = (
  name: string,
  markdown: string,
  dashboardKey: string,
): StudyPathDashboardItem => ({
  name,
  dashboardKey,
  dashboardIndex: 1,
  dashboardCount: 1,
  folderName: 'Sleep',
  createdBy: 'generator',
  layout: {
    type: 'tab',
    name,
    component: 'CustomWidget',
    config: {
      customProps: {
        components: [
          {
            id: `${name}-notes`,
            type: 'MarkdownBlock',
            props: { title: name, markdown },
          },
        ],
      },
    },
  },
})

const makeGuide = (): StudyPathContainerState => ({
  pathId: 'guide-1',
  title: 'Why you dream',
  folderName: 'Why you dream',
  contentLanguage: 'es',
  selectedIndex: 0,
  pinnedDashboardKeys: [],
  plannedLessons: [
    { title: 'Sleep debt', summary: 'Plan around a missed night.' },
    { title: 'Dream recall', summary: 'Remember more of a dream.' },
  ],
  dashboards: [
    makePage(
      'REM sleep',
      '## Adenosine build-up\n\nAdenosine accumulates while awake.\n\n## Sleep pressure\n\nPressure peaks at night.',
      'page-1',
    ),
    makePage('Sleep cycles', 'Cycles repeat about every 90 minutes.', 'page-2'),
  ],
})

describe('Study Guide growth seeds', () => {
  it('appends a continuation and digs the other seeds in under their page', () => {
    expect(
      readStudyGuideGrowthParentKey({
        kind: 'continue',
        lesson: { title: 'Sleep debt', summary: '' },
      }),
    ).toBeUndefined()
    expect(
      readStudyGuideGrowthParentKey({
        kind: 'fragment',
        sourcePageKey: 'page-1',
        selection: 'adenosine',
      }),
    ).toBe('page-1')
    // A page the reader asked for by name is its own lesson, so it goes last
    // rather than into whichever page happened to be open.
    expect(
      readStudyGuideGrowthParentKey({
        kind: 'prompt',
        prompt: 'tell me about naps',
      }),
    ).toBeUndefined()
  })

  it('labels the page being written from whichever seed started it', () => {
    expect(
      readStudyGuideGrowthLabel({
        kind: 'continue',
        lesson: { title: 'Sleep debt', summary: '' },
      }),
    ).toBe('Sleep debt')
    expect(
      readStudyGuideGrowthLabel({
        kind: 'fragment',
        sourcePageKey: 'page-1',
        selection: '  adenosine   builds  up  ',
      }),
    ).toBe('adenosine builds up')
    expect(
      readStudyGuideGrowthLabel({
        kind: 'prompt',
        prompt: 'x'.repeat(80),
      }),
    ).toHaveLength(50)
  })

  it('lists the existing pages and bans repeating them', () => {
    const prompt = buildStudyGuidePagePrompt(
      makeGuide(),
      { kind: 'continue', lesson: makeGuide().plannedLessons![0] },
      'es',
    )

    expect(prompt).toContain('- REM sleep')
    expect(prompt).toContain('- Sleep cycles')
    expect(prompt).toContain('Do not repeat what the pages listed below')
    expect(prompt).toContain(
      'Write the next lesson of this guide: "Sleep debt"',
    )
  })

  it('sends the source page content only when a seed digs into one', () => {
    const guide = makeGuide()
    const fragment = buildStudyGuidePagePrompt(
      guide,
      {
        kind: 'fragment',
        sourcePageKey: 'page-1',
        selection: 'Adenosine accumulates while awake',
      },
      'es',
    )
    const continuation = buildStudyGuidePagePrompt(
      guide,
      { kind: 'continue', lesson: guide.plannedLessons![0] },
      'es',
    )

    expect(fragment).toContain('The page this comes from is "REM sleep"')
    expect(fragment).toContain('Adenosine accumulates while awake')
    expect(continuation).not.toContain('The page this comes from is')
  })

  it('never re-applies the guide-wide known-skill bridge to a single page', () => {
    const prompt = buildStudyGuidePagePrompt(
      makeGuide(),
      { kind: 'prompt', prompt: 'why do naps help' },
      'es',
    )

    expect(prompt).not.toContain('which I already know')
  })

  it('rejects an empty or too-short page and keeps a usable one', () => {
    expect(() =>
      parseStudyGuideGrowthPageResponse('{"title":"","markdown":""}', 'Naps'),
    ).toThrow()
    expect(() =>
      parseStudyGuideGrowthPageResponse(
        '{"title":"Naps","markdown":"Too short."}',
        'Naps',
      ),
    ).toThrow()

    const body = Array.from({ length: 70 }, (_, index) => `word${index}`).join(
      ' ',
    )
    const parsed = parseStudyGuideGrowthPageResponse(
      JSON.stringify({ title: 'Naps', markdown: `# Naps\n\n${body}` }),
      'Fallback',
    )

    expect(parsed.title).toBe('Naps')
    expect(parsed.markdown.startsWith('# Naps\n\n')).toBe(true)
    // The model's own heading is stripped so the title is never doubled.
    expect(parsed.markdown.match(/# Naps/g)).toHaveLength(1)
  })

  it('drops a planned lesson once it has been turned into a page', () => {
    const guide = makeGuide()

    expect(
      consumeStudyGuidePlannedLesson(guide, guide.plannedLessons![0]),
    ).toEqual([{ title: 'Dream recall', summary: 'Remember more of a dream.' }])
    expect(
      consumeStudyGuidePlannedLesson(
        { ...guide, plannedLessons: [guide.plannedLessons![0]] },
        guide.plannedLessons![0],
      ),
    ).toBeUndefined()
  })
})

describe('Study Guide page ideas', () => {
  it('prefers the ideas generated with the guide', () => {
    const guide = makeGuide()
    guide.dashboards[0].pageIdeas = [
      { axis: 'mechanism', label: 'Adenosine', prompt: 'How does it bind?' },
    ]

    expect(deriveStudyGuidePageIdeas(guide, 'page-1')).toEqual(
      guide.dashboards[0].pageIdeas,
    )
  })

  it('derives one idea per axis from the page headings when none were generated', () => {
    const ideas = deriveStudyGuidePageIdeas(makeGuide(), 'page-1')

    expect(ideas.map((idea) => idea.axis)).toEqual([
      ...STUDY_GUIDE_PAGE_IDEA_AXES,
    ])
    expect(ideas[0].label).toContain('Adenosine build-up')
    expect(ideas[1].label).toContain('Sleep pressure')
  })

  it('falls back to the page title when a page has no headings', () => {
    const ideas = deriveStudyGuidePageIdeas(makeGuide(), 'page-2')

    expect(ideas).toHaveLength(STUDY_GUIDE_PAGE_IDEA_AXES.length)
    ideas.forEach((idea) => {
      expect(idea.label).toContain('Sleep cycles')
    })
  })
})

describe('Study Guide growth contracts', () => {
  it('keeps one page idea per axis and tolerates a missing axis', () => {
    expect(
      sanitizeStudyGuidePageIdeas([
        { axis: 'mechanism', label: 'How it works', prompt: 'Show me how.' },
        { axis: 'mechanism', label: 'Again', prompt: 'Show me again.' },
        { label: 'No axis', prompt: 'Explain this.' },
        { axis: 'limit', label: 'Where it breaks', prompt: 'Show the limit.' },
      ]),
    ).toEqual([
      { axis: 'mechanism', label: 'How it works', prompt: 'Show me how.' },
      { label: 'No axis', prompt: 'Explain this.' },
      { axis: 'limit', label: 'Where it breaks', prompt: 'Show the limit.' },
    ])
    expect(sanitizeStudyGuidePageIdeas('nope')).toEqual([])
  })

  it('keeps planned lessons in the order the model returned and drops repeats', () => {
    expect(
      sanitizeStudyGuidePlannedLessons([
        { title: 'Sleep debt', summary: 'Plan around a missed night.' },
        { title: 'sleep debt', summary: 'Duplicate.' },
        { title: '', summary: 'No title.' },
        { title: 'Dream recall', summary: 'Remember more.' },
      ]),
    ).toEqual([
      { title: 'Sleep debt', summary: 'Plan around a missed night.' },
      { title: 'Dream recall', summary: 'Remember more.' },
    ])
    expect(sanitizeStudyGuidePlannedLessons(null)).toEqual([])
  })
})

describe('Study Guide topic prompt', () => {
  it('keeps the subject the page sits in, so the new guide is not too broad', () => {
    expect(
      buildStudyGuideTopicPrompt('Confirmation delays', 'en', 'Bitcoin'),
    ).toBe('Teach me Confirmation delays, in the context of Bitcoin.')
    expect(
      buildStudyGuideTopicPrompt('Retrasos de confirmación', 'es', 'Bitcoin'),
    ).toBe('Enséñame Retrasos de confirmación, en el contexto de Bitcoin.')
  })

  it('drops the context when it adds nothing', () => {
    expect(buildStudyGuideTopicPrompt('Cell signalling', 'en')).toBe(
      'Teach me Cell signalling.',
    )
    expect(buildStudyGuideTopicPrompt('Bitcoin', 'en', 'bitcoin')).toBe(
      'Teach me Bitcoin.',
    )
    // An unknown locale falls back to English rather than to no prompt.
    expect(buildStudyGuideTopicPrompt('Cell signalling', 'it')).toBe(
      'Teach me Cell signalling.',
    )
    expect(buildStudyGuideTopicPrompt('   ', 'en')).toBe('')
  })
})

describe('Study Guide page guide prompt', () => {
  const body = Array.from({ length: 70 }, (_, index) => `word${index}`).join(
    ' ',
  )

  it('keeps a guide prompt that names the real subject', () => {
    const parsed = parseStudyGuideGrowthPageResponse(
      JSON.stringify({
        title: 'Inside confirmation delays',
        markdown: body,
        guidePrompt: 'Teach me how Bitcoin transaction confirmation works.',
      }),
      'Fallback',
    )

    expect(parsed.guidePrompt).toBe(
      'Teach me how Bitcoin transaction confirmation works.',
    )
  })

  it('drops a guide prompt that only echoes the page title', () => {
    const parsed = parseStudyGuideGrowthPageResponse(
      JSON.stringify({
        title: 'Inside confirmation delays',
        markdown: body,
        guidePrompt: 'Inside confirmation delays.',
      }),
      'Fallback',
    )

    expect(parsed.guidePrompt).toBeUndefined()
  })
})
