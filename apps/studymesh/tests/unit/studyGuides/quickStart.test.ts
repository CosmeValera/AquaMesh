import { describe, expect, it } from 'vitest'

import {
  buildStudyGuideKnownTopicPrefilterPrompt,
  parseStudyGuideKnownTopicPrefilterResult,
  parseStudyGuideQuickStart,
  parseStudyGuideQuickStartRelevanceDecision,
  resolveStudyGuideKnowledgeContextPlan,
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

describe('relevance decision weakFitReason', () => {
  const candidates = ['Ansible notes']

  it('keeps weakFitReason when bridgeStrength is weak', () => {
    const decision = parseStudyGuideQuickStartRelevanceDecision(
      JSON.stringify({
        shouldUseKnownTopic: true,
        knownTopicsForQuickStart: ['Ansible notes'],
        knownTopicRelevanceReason: 'Loosely related config-management tooling.',
        weakFitReason: 'Different domain, only shares vocabulary.',
        targetTopicType: 'technical',
        bridgeStrength: 'weak',
        bridgeStrategy: 'light_reference',
      }),
      candidates,
    )

    expect(decision.weakFitReason).toBe('Different domain, only shares vocabulary.')
  })

  it('drops weakFitReason when bridgeStrength is strong', () => {
    const decision = parseStudyGuideQuickStartRelevanceDecision(
      JSON.stringify({
        shouldUseKnownTopic: true,
        knownTopicsForQuickStart: ['Ansible notes'],
        knownTopicRelevanceReason: 'Directly comparable automation tooling.',
        weakFitReason: 'This should be ignored for a strong bridge.',
        targetTopicType: 'technical',
        bridgeStrength: 'strong',
        bridgeStrategy: 'direct_comparison',
      }),
      candidates,
    )

    expect(decision.weakFitReason).toBeUndefined()
  })
})
