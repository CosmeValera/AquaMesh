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
  buildStudyGuideKnowledgeBridgeBlocksPrompt,
  buildStudyGuideQuickStartPrompt,
  buildStudyGuideQuickStartRelevancePrompt,
  ensureForcedStudyGuideQuickStartRelevanceDecision,
  parseStudyGuideKnowledgeBridgeBlocks,
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

    // An unbroken overrun is kept whole rather than chopped mid-sentence.
    expect(quickStart?.keyIdea.split(/\s+/)).toHaveLength(45)
    expect(quickStart?.keyIdea).toMatch(/word44$/)
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

  it('never cuts the key idea mid-sentence when the model overruns the word cap', () => {
    const quickStart = sanitizeStudyGuideQuickStart({
      keyIdea:
        'Photosynthesis is the process by which plants, algae, and some bacteria use light energy to convert carbon dioxide and water into glucose, releasing oxygen as a by-product. In plants, it occurs mainly in chloroplasts, where pigments absorb light.',
      quickSummary: 'Light drives the reaction.\n\nThe Calvin cycle follows.',
    })

    expect(quickStart?.keyIdea).toMatch(/by-product\.$/)
    expect(quickStart?.keyIdea).not.toMatch(/where$/)
  })

  it('completes a slightly-over-cap single-sentence key idea instead of clipping it', () => {
    const words = Array.from(
      { length: 38 },
      (_value, index) => `word${index}`,
    ).join(' ')
    const quickStart = sanitizeStudyGuideQuickStart({
      keyIdea: `${words} end.`,
      quickSummary: 'Light drives the reaction.\n\nThe Calvin cycle follows.',
    })

    expect(quickStart?.keyIdea).toMatch(/end\.$/)
  })

  it('preserves a complete Quick Start sentence when summary is slightly long', () => {
    const sentenceOne = Array.from(
      { length: 120 },
      (_value, index) => `word${index}`,
    ).join(' ')
    const quickStart = sanitizeStudyGuideQuickStart({
      keyIdea: 'A short complete key idea.',
      quickSummary: `${sentenceOne} final sentence.`,
    })

    expect(quickStart?.quickSummary).toMatch(/final sentence\.$/)
  })

  it('includes selected known topic and clarity rules in Quick Start prompt', () => {
    const prompt = buildStudyGuideQuickStartPrompt({
      title: 'Target concept',
      source: 'Target concept lesson notes.',
      relevanceDecision: {
        shouldUseKnownTopic: true,
        knownTopicsForQuickStart: ['Specific related concept'],
        knownTopicRelevanceReason:
          'Specific related concept gives a direct same-domain bridge for the target concept.',
        targetTopicType: 'technical',
        bridgeStrength: 'strong',
        bridgeStrategy: 'direct_comparison',
      },
    })

    expect(prompt).toContain('"keyIdea"')
    expect(prompt).toContain('"quickSummary"')
    expect(prompt).toContain('Candidate known topic bridge(s)')
    expect(prompt).toContain('Specific related concept')
    expect(prompt).toContain('Bridge strength: strong')
    expect(prompt).toContain('Bridge strategy: direct_comparison')
    expect(prompt).toContain('the selected known topic must lead')
    expect(prompt).toContain('where the comparison breaks')
    expect(prompt).toContain('keyIdea introduces at most 1 technical term')
    expect(prompt).toContain('Introduce at most 2-3 new technical terms')
    expect(prompt).toContain('Good bridge shape')
    expect(prompt).toContain('Bad bridge shape')
    expect(prompt).toContain('This guide teaches')
    expect(prompt).toContain('This page explains')
    expect(prompt).toContain('You will learn')
    expect(prompt).toContain('under 100 words total')
    expect(prompt).toContain('Every quickSummary paragraph must end')
    expect(prompt).toContain('finish the current sentence cleanly')
  })

  it('upgrades a declined relevance decision for the forced context path', () => {
    const declined = {
      shouldUseKnownTopic: false,
      knownTopicsForQuickStart: [],
      knownTopicRelevanceReason: 'No strong bridge.',
      targetTopicType: 'technical' as const,
      bridgeStrength: 'none' as const,
      bridgeStrategy: 'none' as const,
    }

    expect(
      ensureForcedStudyGuideQuickStartRelevanceDecision(declined, []),
    ).toBeUndefined()

    const single = ensureForcedStudyGuideQuickStartRelevanceDecision(declined, [
      'Rundeck',
    ])
    expect(single).toMatchObject({
      shouldUseKnownTopic: true,
      knownTopicsForQuickStart: ['Rundeck'],
      bridgeStrength: 'weak',
      bridgeStrategy: 'light_reference',
    })

    const multiple = ensureForcedStudyGuideQuickStartRelevanceDecision(
      declined,
      ['Rundeck', 'Docker', 'Ansible'],
    )
    expect(multiple?.shouldUseKnownTopic).toBe(true)
    expect(multiple?.knownTopicsForQuickStart).toEqual([
      'Rundeck',
      'Docker',
      'Ansible',
    ])

    const accepted = {
      ...declined,
      shouldUseKnownTopic: true,
      knownTopicsForQuickStart: ['Docker'],
    }
    expect(
      ensureForcedStudyGuideQuickStartRelevanceDecision(accepted, [
        'Rundeck',
        'Docker',
      ]),
    ).toBe(accepted)
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

  it('keeps forced weak bridges caveated and secondary in Quick Start prompt', () => {
    const prompt = buildStudyGuideQuickStartPrompt({
      title: 'New technical topic',
      source: 'The new technical topic coordinates work asynchronously.',
      bridgeMode: 'force',
      relevanceDecision: {
        shouldUseKnownTopic: true,
        knownTopicsForQuickStart: ['Known request pattern'],
        knownTopicRelevanceReason:
          'Known request pattern is only useful as a contrast.',
        targetTopicType: 'technical',
        bridgeStrength: 'weak',
        bridgeStrategy: 'light_reference',
      },
    })

    expect(prompt).toContain('Bridge mode: force')
    expect(prompt).toContain('keep keyIdea neutral')
    expect(prompt).toContain('explain the topic directly first')
    expect(prompt).toContain('state where the comparison breaks')
  })

  it('builds a strong-model relevance prompt with generic bridge rules', () => {
    const prompt = buildStudyGuideQuickStartRelevancePrompt({
      title: 'New topic',
      prompt: 'new topic',
      source: 'The new topic solves a specific learning problem.',
      userKnownTopics: ['Broad category', 'Specific related topic'],
    })

    expect(prompt).toContain('Goal: reduce learner cognitive effort')
    expect(prompt).toContain('Prefer same-domain direct comparisons')
    expect(prompt).toContain('Prefer specific topics over broad categories')
    expect(prompt).toContain('Generic examples')
    expect(prompt).toContain(
      'Target "narrow domain topic", known ["broad category", "specific related topic"]',
    )
    expect(prompt).not.toContain('Kafka')
    expect(prompt).not.toContain('Valencian')
    expect(prompt).not.toContain('Catalan')
    expect(prompt).not.toContain('Vue')
    expect(prompt).not.toContain('React')
  })

  it('builds a forced relevance prompt without hardcoded topic pairs', () => {
    const prompt = buildStudyGuideQuickStartRelevancePrompt({
      title: 'New topic',
      prompt: 'new topic',
      source: 'The new topic needs a beginner-friendly mental model.',
      userKnownTopics: ['Known request pattern', 'Broad category'],
      bridgeMode: 'force',
    })

    expect(prompt).toContain('Bridge mode: force')
    expect(prompt).toContain('the closest useful bridge')
    expect(prompt).toContain('bridgeStrength "weak"')
    expect(prompt).toContain('do not use hidden hardcoded topic-pair rules')
  })

  it.each([
    ['New library', ['Known library'], ['Known library'], 'direct_comparison'],
    [
      'New protocol',
      ['Broad technical category', 'Specific related protocol'],
      ['Specific related protocol'],
      'direct_comparison',
    ],
    [
      'New biological process',
      ['Known mechanical process'],
      ['Known mechanical process'],
      'analogy_skeleton',
    ],
  ])(
    'parses strong relevance decision for %s without inventing topics',
    (_title, knownTopics, selectedTopics, bridgeStrategy) => {
      const decision = parseStudyGuideQuickStartRelevanceDecision(
        JSON.stringify({
          shouldUseKnownTopic: true,
          knownTopicsForQuickStart: selectedTopics,
          knownTopicRelevanceReason: 'Direct same-domain bridge.',
          targetTopicType: 'technical',
          bridgeStrength: 'strong',
          bridgeStrategy,
        }),
        knownTopics,
      )

      expect(decision.shouldUseKnownTopic).toBe(true)
      expect(decision.knownTopicsForQuickStart).toEqual(selectedTopics)
      expect(decision.bridgeStrength).toBe('strong')
      expect(decision.bridgeStrategy).toBe(bridgeStrategy)
    },
  )

  it('normalizes weak bridge decisions to light references', () => {
    const decision = parseStudyGuideQuickStartRelevanceDecision(
      JSON.stringify({
        shouldUseKnownTopic: true,
        knownTopicsForQuickStart: ['Databases'],
        knownTopicRelevanceReason:
          'Databases are only a light contrast for data lakes.',
        targetTopicType: 'technical',
        bridgeStrength: 'weak',
        bridgeStrategy: 'direct_comparison',
      }),
      ['Databases'],
    )

    expect(decision.shouldUseKnownTopic).toBe(true)
    expect(decision.bridgeStrength).toBe('weak')
    expect(decision.bridgeStrategy).toBe('light_reference')
  })

  it('builds an analogy-skeleton Quick Start prompt for strong structural bridges', () => {
    const prompt = buildStudyGuideQuickStartPrompt({
      title: 'How does the eye focus light?',
      source:
        'The cornea bends light first, the crystalline lens changes shape, the pupil controls light entry, and the retina receives the image.',
      relevanceDecision: {
        shouldUseKnownTopic: true,
        knownTopicsForQuickStart: ['photography'],
        knownTopicRelevanceReason:
          'Camera optics map clearly to eye optics and refractive errors.',
        targetTopicType: 'general',
        bridgeStrength: 'strong',
        bridgeStrategy: 'analogy_skeleton',
      },
    })

    expect(prompt).toContain('Bridge strategy: analogy_skeleton')
    expect(prompt).toContain('start from the known topic')
    expect(prompt).toContain('sustain the mapping through the explanation')
    expect(prompt).toContain('then briefly say where the analogy breaks')
  })

  it('rejects invented or unsafe known-topic relevance selections', () => {
    const decision = parseStudyGuideQuickStartRelevanceDecision(
      JSON.stringify({
        shouldUseKnownTopic: true,
        knownTopicsForQuickStart: ['Docker'],
        knownTopicRelevanceReason:
          'Tool analogy would be forced for managing junior reports.',
        targetTopicType: 'human_management',
        bridgeStrength: 'strong',
        bridgeStrategy: 'direct_comparison',
      }),
      ['parenting toddlers'],
    )

    expect(decision.shouldUseKnownTopic).toBe(false)
    expect(decision.knownTopicsForQuickStart).toEqual([])
    expect(decision.targetTopicType).toBe('human_management')
    expect(decision.bridgeStrength).toBe('none')
    expect(decision.bridgeStrategy).toBe('none')
  })

  it('builds and parses optional knowledge bridge blocks', () => {
    const relevanceDecision = {
      shouldUseKnownTopic: true,
      knownTopicsForQuickStart: ['Event-driven architecture'],
      knownTopicRelevanceReason:
        'Event streams are a direct bridge for Kafka topics.',
      targetTopicType: 'technical' as const,
      bridgeStrength: 'strong' as const,
      bridgeStrategy: 'direct_comparison' as const,
    }
    const prompt = buildStudyGuideKnowledgeBridgeBlocksPrompt({
      title: 'Kafka',
      prompt: 'Kafka',
      dashboards: [
        {
          title: '01 - Event streams',
          summary: 'Topics store event streams.',
          rawNotes: 'Kafka topics keep ordered event records.',
        },
      ],
      relevanceDecision,
    })

    expect(prompt).toContain(
      'Create optional knowledge-context bridge note blocks',
    )
    expect(prompt).toContain(
      'Selected known topic bridge: Event-driven architecture',
    )
    expect(prompt).toContain('dashboardIndex: 0')

    const blocks = parseStudyGuideKnowledgeBridgeBlocks(
      JSON.stringify({
        blocks: [
          {
            dashboardIndex: 0,
            title: 'Events you already know',
            body: 'Kafka topics are event streams, but they also retain ordered records so consumers can replay from offsets.',
          },
          {
            dashboardIndex: 0,
            title: 'Duplicate ignored',
            body: 'This should be skipped because the dashboard already has a bridge.',
          },
          {
            dashboardIndex: 9,
            title: 'Out of range',
            body: 'This should be skipped.',
          },
        ],
      }),
      1,
    )

    expect(blocks).toEqual([
      {
        dashboardIndex: 0,
        title: 'Events you already know',
        body: 'Kafka topics are event streams, but they also retain ordered records so consumers can replay from offsets.',
      },
    ])
  })

  it('never ends an over-long bridge body mid-word', () => {
    const sentence =
      'Kafka topics retain ordered records so consumers can replay them later. '
    const [block] = parseStudyGuideKnowledgeBridgeBlocks(
      JSON.stringify({
        blocks: [
          {
            dashboardIndex: 0,
            title: 'Events you already know',
            body: `${sentence.repeat(12)}A trailing caveat closes the note.`,
          },
        ],
      }),
      1,
    )

    expect(block.body.length).toBeGreaterThan(0)
    expect(block.body).toMatch(/[.!?]$/)
  })

  it('filters parsed bridge blocks to eligible dashboard indexes', () => {
    const blocks = parseStudyGuideKnowledgeBridgeBlocks(
      JSON.stringify({
        blocks: [
          {
            dashboardIndex: 0,
            title: 'First page',
            body: 'This should not be placed on the first page.',
          },
          {
            dashboardIndex: 1,
            title: 'Quiz page',
            body: 'This should not be placed on a quiz page.',
          },
          {
            dashboardIndex: 2,
            title: 'Plain lesson page',
            body: 'This page can receive a concise bridge note.',
          },
        ],
      }),
      3,
      [2],
    )

    expect(blocks).toEqual([
      {
        dashboardIndex: 2,
        title: 'Plain lesson page',
        body: 'This page can receive a concise bridge note.',
      },
    ])
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
