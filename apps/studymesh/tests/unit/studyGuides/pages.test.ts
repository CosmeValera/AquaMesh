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
  buildStudyGuideQuickStartPrompt,
  buildStudyGuideQuickStartRelevancePrompt,
  parseStudyGuideQuickStart,
  parseStudyGuideQuickStartRelevanceDecision,
  sanitizeStudyGuideQuickStart,
} from '../../../src/studyGuides/quickStart'
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

describe('Study Guide Quick Start helpers', () => {
  it('sanitizes key idea and preserves quick summary paragraphs', () => {
    const quickStart = sanitizeStudyGuideQuickStart({
      keyIdea: `Key idea: ${Array.from(
        { length: 45 },
        (_value, index) => `word${index}`,
      ).join(' ')}`,
      quickSummary:
        'Quick summary: First paragraph explains the core model.\n\nSecond paragraph keeps a caveat about where the comparison breaks.',
    })

    expect(quickStart?.keyIdea.split(/\s+/)).toHaveLength(35)
    expect(quickStart?.keyIdea).not.toMatch(/Key idea/i)
    expect(quickStart?.quickSummary.split('\n\n')).toHaveLength(2)
  })

  it('parses generated Quick Start JSON', () => {
    const quickStart = parseStudyGuideQuickStart(
      JSON.stringify({
        keyIdea:
          'A data lake is raw object storage plus tools that organize and analyze files later.',
        quickSummary:
          'Data lakes keep source data in flexible storage before teams decide every final structure.\n\nThey differ from warehouses because cleanup and modeling can happen later, but metadata still matters.',
      }),
    )

    expect(quickStart).toMatchObject({
      keyIdea:
        'A data lake is raw object storage plus tools that organize and analyze files later.',
    })
    expect(quickStart?.quickSummary).toContain('\n\n')
  })

  it('includes selected known topic and clarity rules in Quick Start prompt', () => {
    const prompt = buildStudyGuideQuickStartPrompt({
      title: 'Data lakes',
      source: 'Data lake lesson notes.',
      relevanceDecision: {
        shouldUseKnownTopic: true,
        knownTopicsForQuickStart: ['MinIO'],
        knownTopicRelevanceReason:
          'MinIO gives a direct object-storage bridge for data lake storage.',
        targetTopicType: 'technical',
        comparisonStyle: 'direct_comparison',
      },
    })

    expect(prompt).toContain('"keyIdea"')
    expect(prompt).toContain('"quickSummary"')
    expect(prompt).toContain('Use only this selected known topic bridge')
    expect(prompt).toContain('MinIO')
    expect(prompt).toContain('where the comparison breaks')
    expect(prompt).toContain('Introduce at most 2-3 new technical terms')
    expect(prompt).not.toContain('Backend')
    expect(prompt).not.toContain('Databases')
    expect(prompt).toContain('This guide teaches')
    expect(prompt).toContain('This page explains')
    expect(prompt).toContain('You will learn')
    expect(prompt).toContain('80-120 words total')
  })

  it('asks for a neutral Quick Start when no known topic is selected', () => {
    const prompt = buildStudyGuideQuickStartPrompt({
      title: 'Data lakes',
      source: 'Data lake lesson notes.',
    })

    expect(prompt).toContain('No known topic was selected as clearly useful')
    expect(prompt).toContain('Do not force a personalized analogy')
    expect(prompt).toContain('neutral beginner-friendly explanation')
  })

  it('builds a strong-model relevance prompt with direct-comparison examples', () => {
    const prompt = buildStudyGuideQuickStartRelevancePrompt({
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
      const decision = parseStudyGuideQuickStartRelevanceDecision(
        JSON.stringify({
          shouldUseKnownTopic: true,
          knownTopicsForQuickStart: selectedTopics,
          knownTopicRelevanceReason: 'Direct same-domain bridge.',
          targetTopicType: 'technical',
          comparisonStyle: 'direct_comparison',
        }),
        knownTopics,
      )

      expect(decision.shouldUseKnownTopic).toBe(true)
      expect(decision.knownTopicsForQuickStart).toEqual(selectedTopics)
    },
  )

  it('rejects invented or unsafe known-topic relevance selections', () => {
    const decision = parseStudyGuideQuickStartRelevanceDecision(
      JSON.stringify({
        shouldUseKnownTopic: true,
        knownTopicsForQuickStart: ['Docker'],
        knownTopicRelevanceReason:
          'Tool analogy would be forced for managing junior reports.',
        targetTopicType: 'human_management',
        comparisonStyle: 'direct_comparison',
      }),
      ['parenting toddlers'],
    )

    expect(decision.shouldUseKnownTopic).toBe(false)
    expect(decision.knownTopicsForQuickStart).toEqual([])
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
