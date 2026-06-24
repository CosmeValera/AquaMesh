import { describe, expect, it } from 'vitest'

import {
  appendStudyGuideMarkdownPage,
  deleteStudyGuidePage,
  getStudyGuideCreationSourceText,
  getStudyGuidePageMarkdown,
  reorderStudyGuidePage,
  stripDuplicateStudyGuideMarkdownTitle,
} from '../../../src/studyGuides/pages'
import {
  applyStudyGuideTldrToWidgets,
  buildStudyGuideTldrRelevancePrompt,
  buildStudyGuideTldrPrompt,
  parseStudyGuideTldrRelevanceDecision,
  sanitizeStudyGuideTldr,
  STUDY_GUIDE_TLDR_PROP,
} from '../../../src/studyGuides/tldr'
import type {
  StudyPathContainerState,
  StudyPathDashboardItem,
} from '../../../src/state/store'

const makePage = (
  name: string,
  text: string,
  createdBy: StudyPathDashboardItem['createdBy'],
): StudyPathDashboardItem => ({
  name,
  createdBy,
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
            props: {
              title: name,
              markdown: text,
            },
          },
        ],
      },
    },
  },
})

describe('getStudyGuideCreationSourceText', () => {
  it('includes generated, manual, and chat pages but excludes quick-create pages', () => {
    const studyPath: StudyPathContainerState = {
      pathId: 'guide-1',
      title: 'Biology',
      folderName: 'Biology',
      selectedIndex: 0,
      pinnedDashboardKeys: [],
      dashboards: [
        makePage('Lesson one', 'Generated lesson source', 'generator'),
        makePage('Manual note', 'Manual page source', 'manual'),
        makePage('Chat note', 'Chat page source', 'chat'),
        makePage('Old quiz', 'Recursive quiz source', 'quickCreate'),
      ],
    }

    const source = getStudyGuideCreationSourceText(studyPath)

    expect(source).toContain('# Lesson one')
    expect(source).toContain('Generated lesson source')
    expect(source).toContain('# Manual note')
    expect(source).toContain('Manual page source')
    expect(source).toContain('# Chat note')
    expect(source).toContain('Chat page source')
    expect(source).not.toContain('Old quiz')
    expect(source).not.toContain('Recursive quiz source')
    expect(source.indexOf('# Lesson one')).toBeLessThan(
      source.indexOf('# Manual note'),
    )
    expect(source.indexOf('# Manual note')).toBeLessThan(
      source.indexOf('# Chat note'),
    )
  })
})

describe('appendStudyGuideMarkdownPage', () => {
  it('keeps a new manual page body empty for the WYSIWYG editor', () => {
    const studyPath: StudyPathContainerState = {
      pathId: 'guide-1',
      title: 'Biology',
      folderName: 'Biology',
      selectedIndex: 0,
      pinnedDashboardKeys: [],
      dashboards: [],
    }

    const next = appendStudyGuideMarkdownPage(studyPath, {
      title: 'Untitled page',
      markdown: '',
      source: 'manual',
    })

    expect(getStudyGuidePageMarkdown(next.dashboards[0])).toBe('')
  })

  it('strips a duplicate leading heading that matches the page title', () => {
    expect(
      stripDuplicateStudyGuideMarkdownTitle(
        '# Cell Biology\n\nCells have membranes.',
        'Cell Biology',
      ),
    ).toBe('Cells have membranes.')
  })
})

describe('Study Guide TLDR helpers', () => {
  it('clamps TLDR text to 120 words and removes labels', () => {
    const text = `## TLDR\nTL;DR: ${Array.from(
      { length: 140 },
      (_value, index) => `word${index}`,
    ).join(' ')}`

    const tldr = sanitizeStudyGuideTldr(text)

    expect(tldr.split(/\s+/)).toHaveLength(120)
    expect(tldr).not.toMatch(/TL;?DR|##/)
  })

  it('assigns one TLDR only to the first page Markdown block', () => {
    const widgets = [
      {
        components: [
          { id: 'title', type: 'Label', props: { text: 'Lesson' } },
          { id: 'notes', type: 'MarkdownBlock', props: { markdown: 'Body' } },
          {
            id: 'extra',
            type: 'MarkdownBlock',
            props: { markdown: 'More', studyGuideTldr: 'old' },
          },
        ],
      },
    ]

    const firstPage = applyStudyGuideTldrToWidgets(widgets, 'Guide TLDR.', true)
    const secondPage = applyStudyGuideTldrToWidgets(
      firstPage,
      'Guide TLDR.',
      false,
    )

    expect(firstPage[0].components[1].props[STUDY_GUIDE_TLDR_PROP]).toBe(
      'Guide TLDR.',
    )
    expect(
      firstPage[0].components[2].props[STUDY_GUIDE_TLDR_PROP],
    ).toBeUndefined()
    expect(
      secondPage[0].components[1].props[STUDY_GUIDE_TLDR_PROP],
    ).toBeUndefined()
  })

  it('includes selected known topic and clarity rules in TLDR prompt', () => {
    const prompt = buildStudyGuideTldrPrompt({
      title: 'Data lakes',
      source: 'Data lake lesson notes.',
      relevanceDecision: {
        shouldUseKnownTopic: true,
        knownTopicsForTldr: ['MinIO'],
        knownTopicRelevanceReason:
          'MinIO gives a direct object-storage bridge for data lake storage.',
        targetTopicType: 'technical',
        comparisonStyle: 'direct_comparison',
      },
    })

    expect(prompt).toContain('Start with the simplest useful mental model')
    expect(prompt).toContain('Use only this selected known topic bridge: MinIO')
    expect(prompt).toContain('where the comparison breaks')
    expect(prompt).toContain('Introduce at most 2-3 new terms')
    expect(prompt).not.toContain('Backend')
    expect(prompt).not.toContain('Databases')
    expect(prompt).toContain('This guide teaches')
    expect(prompt).toContain('This page explains')
    expect(prompt).toContain('You will learn')
    expect(prompt).toContain('Target 80-120 words')
  })

  it('asks for a neutral explanation when no known topic is selected', () => {
    const prompt = buildStudyGuideTldrPrompt({
      title: 'Data lakes',
      source: 'Data lake lesson notes.',
    })

    expect(prompt).toContain('No known topic was selected as clearly useful')
    expect(prompt).toContain('Do not force a personalized analogy')
    expect(prompt).toContain('neutral simple explanation')
  })

  it('builds a strong-model relevance prompt with direct-comparison examples', () => {
    const prompt = buildStudyGuideTldrRelevancePrompt({
      title: 'GraphQL',
      prompt: 'graphql',
      source: 'GraphQL lets clients request fields from a schema.',
      userKnownTopics: ['REST API', 'Docker'],
    })

    expect(prompt).toContain('Goal: reduce learner cognitive effort')
    expect(prompt).toContain('Prefer same-domain direct comparisons')
    expect(prompt).toContain(
      'Target "GraphQL", known ["REST API", "Docker"]: select REST API only',
    )
    expect(prompt).toContain(
      'Target "Managing very junior reports", known ["Docker"]: select none',
    )
    expect(prompt).toContain('Target "Data lakes", known ["MinIO"]')
  })

  it.each([
    ['Vue', ['React'], ['React']],
    ['Zustand', ['Redux'], ['Redux']],
    ['Kubernetes', ['Docker'], ['Docker']],
    ['GraphQL', ['REST API', 'Docker'], ['REST API']],
    ['Data lakes', ['MinIO'], ['MinIO']],
  ])(
    'parses relevance decision for %s without inventing topics',
    (_title, knownTopics, selectedTopics) => {
      const decision = parseStudyGuideTldrRelevanceDecision(
        JSON.stringify({
          shouldUseKnownTopic: true,
          knownTopicsForTldr: selectedTopics,
          knownTopicRelevanceReason: 'Direct same-domain bridge.',
          targetTopicType: 'technical',
          comparisonStyle: 'direct_comparison',
        }),
        knownTopics,
      )

      expect(decision.shouldUseKnownTopic).toBe(true)
      expect(decision.knownTopicsForTldr).toEqual(selectedTopics)
    },
  )

  it('rejects invented or unsafe known-topic relevance selections', () => {
    const decision = parseStudyGuideTldrRelevanceDecision(
      JSON.stringify({
        shouldUseKnownTopic: true,
        knownTopicsForTldr: ['Docker'],
        knownTopicRelevanceReason:
          'Tool analogy would be forced for managing junior reports.',
        targetTopicType: 'human_management',
        comparisonStyle: 'direct_comparison',
      }),
      ['parenting toddlers'],
    )

    expect(decision.shouldUseKnownTopic).toBe(false)
    expect(decision.knownTopicsForTldr).toEqual([])
    expect(decision.targetTopicType).toBe('human_management')
  })
})

describe('Study Guide page management', () => {
  const makeStudyPath = (): StudyPathContainerState => ({
    pathId: 'guide-1',
    title: 'Biology',
    folderName: 'Biology',
    selectedIndex: 1,
    pinnedDashboardKeys: [],
    dashboards: [
      {
        ...makePage('Generated lesson', 'Core lesson', 'generator'),
        dashboardKey: 'generated',
        dashboardIndex: 1,
        dashboardCount: 3,
        folderName: 'Biology',
        deletable: false,
      },
      {
        ...makePage('Manual note', 'My note', 'manual'),
        dashboardKey: 'manual',
        dashboardIndex: 2,
        dashboardCount: 3,
        folderName: 'Biology',
        deletable: true,
      },
      {
        ...makePage('Quiz', 'Practice', 'quickCreate'),
        dashboardKey: 'quiz',
        dashboardIndex: 3,
        dashboardCount: 3,
        folderName: 'Biology',
        deletable: true,
      },
    ],
  })

  it('protects generated pages from deletion', () => {
    const studyPath = makeStudyPath()

    expect(deleteStudyGuidePage(studyPath, 'generated')).toBe(studyPath)
  })

  it('keeps the selected page open when another page moves or is deleted', () => {
    const reordered = reorderStudyGuidePage(makeStudyPath(), 2, 0)

    expect(reordered.dashboards.map((page) => page.dashboardKey)).toEqual([
      'quiz',
      'generated',
      'manual',
    ])
    expect(reordered.dashboards[reordered.selectedIndex].dashboardKey).toBe(
      'manual',
    )

    const deleted = deleteStudyGuidePage(reordered, 'quiz')

    expect(deleted.dashboards.map((page) => page.dashboardIndex)).toEqual([
      1, 2,
    ])
    expect(deleted.dashboards[deleted.selectedIndex].dashboardKey).toBe(
      'manual',
    )
  })

  it('selects the nearest remaining page after deleting the current page', () => {
    const deleted = deleteStudyGuidePage(makeStudyPath(), 'manual')

    expect(deleted.dashboards[deleted.selectedIndex].dashboardKey).toBe('quiz')
  })
})
