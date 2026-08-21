import { describe, expect, it } from 'vitest'

import {
  buildStudyGuideKnownTopicPrefilterPrompt,
  deriveStudyGuideBridgeStrength,
  parseStudyGuideKnownTopicPrefilterResult,
  parseStudyGuideQuickStart,
  parseStudyGuideQuickStartRelevanceDecision,
  resolveStudyGuideKnowledgeContextPlan,
  sanitizeStudyGuideBridgeCorrespondences,
  STUDY_GUIDE_KNOWN_TOPIC_PREFILTER_MAX,
} from '../../../src/studyGuides/quickStart'
import { USER_KNOWN_TOPICS_DIRECT_MAX } from '../../../src/profileContext'

const topicsOfLength = (length: number): string[] =>
  Array.from({ length }, (_, index) => `Topic ${index + 1}`)

describe('study guide known-topic prefilter plan', () => {
  it('only requests a prefilter pass once known topics exceed the direct-call cap', () => {
    const atLimit = resolveStudyGuideKnowledgeContextPlan(
      topicsOfLength(USER_KNOWN_TOPICS_DIRECT_MAX),
    )
    const overLimit = resolveStudyGuideKnowledgeContextPlan(
      topicsOfLength(USER_KNOWN_TOPICS_DIRECT_MAX + 1),
    )

    expect(atLimit.shouldRunKnownTopicPrefilter).toBe(false)
    expect(overLimit.shouldRunKnownTopicPrefilter).toBe(true)
    expect(overLimit.topics).toHaveLength(USER_KNOWN_TOPICS_DIRECT_MAX + 1)
  })

  it('builds a prefilter prompt that lists every candidate and never invents one', () => {
    const prompt = buildStudyGuideKnownTopicPrefilterPrompt({
      title: 'Kubernetes networking',
      prompt: 'Teach me Kubernetes networking',
      candidateTopics: ['MinIO', 'Postgres', 'Cooking'],
    })

    expect(prompt).toContain('MinIO, Postgres, Cooking')
    expect(prompt).toContain('Never invent a topic')
    expect(prompt).toContain('Kubernetes networking')
  })
})

describe('parseStudyGuideKnownTopicPrefilterResult', () => {
  const candidates = topicsOfLength(60)

  it('keeps only candidates the model actually selected, case-insensitively', () => {
    const result = parseStudyGuideKnownTopicPrefilterResult(
      JSON.stringify({
        selectedTopics: ['topic 3', 'Topic 10', 'Not A Real Topic'],
      }),
      candidates,
    )

    expect(result).toEqual(['Topic 3', 'Topic 10'])
  })

  it('caps the narrowed list at the prefilter max', () => {
    const result = parseStudyGuideKnownTopicPrefilterResult(
      JSON.stringify({ selectedTopics: candidates }),
      candidates,
    )

    expect(result).toHaveLength(STUDY_GUIDE_KNOWN_TOPIC_PREFILTER_MAX)
    expect(result).toEqual(
      candidates.slice(0, STUDY_GUIDE_KNOWN_TOPIC_PREFILTER_MAX),
    )
  })

  it('falls back to the first candidates when the response is unusable', () => {
    expect(parseStudyGuideKnownTopicPrefilterResult('not json', candidates)).toEqual(
      candidates.slice(0, STUDY_GUIDE_KNOWN_TOPIC_PREFILTER_MAX),
    )
    expect(
      parseStudyGuideKnownTopicPrefilterResult(
        JSON.stringify({ selectedTopics: [] }),
        candidates,
      ),
    ).toEqual(candidates.slice(0, STUDY_GUIDE_KNOWN_TOPIC_PREFILTER_MAX))
  })
})

describe('Quick Start bridge topics', () => {
  it('keeps bridgeTopics when the AI response includes them', () => {
    const quickStart = parseStudyGuideQuickStart(
      JSON.stringify({
        keyIdea: 'Kubernetes networking mirrors Docker container networking.',
        quickSummary: 'First paragraph.\n\nSecond paragraph.',
        bridgeTopics: ['Docker containers', 'Linux networking basics'],
      }),
    )

    expect(quickStart?.bridgeTopics).toEqual([
      'Docker containers',
      'Linux networking basics',
    ])
  })

  it('omits bridgeTopics entirely when none were provided', () => {
    const quickStart = parseStudyGuideQuickStart(
      JSON.stringify({
        keyIdea: 'A neutral explanation with no learner-context bridge.',
        quickSummary: 'First paragraph.\n\nSecond paragraph.',
      }),
    )

    expect(quickStart?.bridgeTopics).toBeUndefined()
  })

  it('caps bridgeTopics at 2, matching the relevance-decision cap', () => {
    const quickStart = parseStudyGuideQuickStart(
      JSON.stringify({
        keyIdea: 'A key idea.',
        quickSummary: 'First paragraph.\n\nSecond paragraph.',
        bridgeTopics: ['One', 'Two', 'Three'],
      }),
    )

    expect(quickStart?.bridgeTopics).toEqual(['One', 'Two'])
  })
})

const pair = (
  knownSide: string,
  targetSide: string,
  kind: 'part' | 'process' = 'part',
) => ({ knownSide, targetSide, carries: 'the same causal job', kind })

describe('bridge strength derivation', () => {
  it('returns none for an empty mapping', () => {
    expect(deriveStudyGuideBridgeStrength([])).toBe('none')
  })

  it('returns weak when nothing transfers over time', () => {
    expect(
      deriveStudyGuideBridgeStrength(
        sanitizeStudyGuideBridgeCorrespondences([
          pair('lock', 'receptor'),
          pair('key', 'adenosine'),
          pair('decoy key', 'caffeine'),
        ]),
      ),
    ).toBe('weak')
  })

  it('returns strong at three distinct pairs with one process', () => {
    expect(
      deriveStudyGuideBridgeStrength(
        sanitizeStudyGuideBridgeCorrespondences([
          pair('lock', 'receptor'),
          pair('key', 'adenosine'),
          pair('keys queuing at the door', 'sleep pressure', 'process'),
        ]),
      ),
    ).toBe('strong')
  })

  it('returns weak when repeated pairs collapse below the threshold', () => {
    expect(
      deriveStudyGuideBridgeStrength(
        sanitizeStudyGuideBridgeCorrespondences([
          pair('lock', 'receptor'),
          pair('lock', 'binding site'),
          pair('cylinder', 'receptor', 'process'),
        ]),
      ),
    ).toBe('weak')
  })
})

describe('bridge correspondence sanitizing', () => {
  it('drops pairs that only share a word', () => {
    expect(
      sanitizeStudyGuideBridgeCorrespondences([pair('memory', 'memory')]),
    ).toEqual([])
  })

  it('drops pairs that never say what they carry', () => {
    expect(
      sanitizeStudyGuideBridgeCorrespondences([
        { knownSide: 'lock', targetSide: 'receptor', carries: 'ok', kind: 'part' },
      ]),
    ).toEqual([])
  })

  it('defaults an unknown kind to part', () => {
    expect(
      sanitizeStudyGuideBridgeCorrespondences([
        {
          knownSide: 'lock',
          targetSide: 'receptor',
          carries: 'the same gating job',
          kind: 'whatever',
        },
      ])[0].kind,
    ).toBe('part')
  })
})

describe('relevance decision', () => {
  const candidates = ['Ansible notes']

  it('derives strong from the mapping and drops the fit caveat', () => {
    const decision = parseStudyGuideQuickStartRelevanceDecision(
      JSON.stringify({
        targetParts: ['desired state', 'converge step', 'drift'],
        knownTopicsForQuickStart: ['Ansible notes'],
        correspondences: [
          pair('playbook', 'desired state'),
          pair('task run', 'converge step', 'process'),
          pair('idempotence', 'drift correction'),
        ],
        knownTopicRelevanceReason: 'Both describe converging to a declared state.',
        breaksAt: 'this should be ignored for a strong bridge',
        targetTopicType: 'technical',
      }),
      candidates,
    )

    expect(decision.bridgeStrength).toBe('strong')
    expect(decision.bridgeStrategy).toBe('analogy_skeleton')
    expect(decision.shouldUseKnownTopic).toBe(true)
    expect(decision.weakFitReason).toBeUndefined()
  })

  it('keeps breaksAt as the fit caveat on a weak mapping', () => {
    const decision = parseStudyGuideQuickStartRelevanceDecision(
      JSON.stringify({
        targetParts: ['desired state'],
        knownTopicsForQuickStart: ['Ansible notes'],
        correspondences: [pair('playbook', 'desired state')],
        knownTopicRelevanceReason: 'Shares the declared-state idea.',
        breaksAt: 'no rollback step exists on the target side',
        targetTopicType: 'technical',
      }),
      candidates,
    )

    expect(decision.bridgeStrength).toBe('weak')
    expect(decision.weakFitReason).toBe(
      'no rollback step exists on the target side',
    )
  })

  it('declines the bridge when nothing mapped', () => {
    const decision = parseStudyGuideQuickStartRelevanceDecision(
      JSON.stringify({
        targetParts: ['desired state'],
        knownTopicsForQuickStart: ['Ansible notes'],
        correspondences: [],
        knownTopicRelevanceReason: '',
        breaksAt: '',
        targetTopicType: 'technical',
      }),
      candidates,
    )

    expect(decision.shouldUseKnownTopic).toBe(false)
    expect(decision.bridgeStrength).toBe('none')
  })

  it('ignores a strength the model tries to assert', () => {
    const decision = parseStudyGuideQuickStartRelevanceDecision(
      JSON.stringify({
        targetParts: ['desired state'],
        knownTopicsForQuickStart: ['Ansible notes'],
        correspondences: [pair('playbook', 'desired state')],
        knownTopicRelevanceReason: 'Shares the declared-state idea.',
        breaksAt: 'no rollback step on the target side',
        targetTopicType: 'technical',
        bridgeStrength: 'strong',
      }),
      candidates,
    )

    expect(decision.bridgeStrength).toBe('weak')
  })
})
