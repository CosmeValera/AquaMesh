import { describe, expect, it } from 'vitest'

import {
  buildStudyGuideKnownTopicPrefilterPrompt,
  parseStudyGuideKnownTopicPrefilterResult,
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
