import { describe, expect, it } from 'vitest'

import {
  buildEnhancedQuizPrompt,
  buildMonolithGuidePrompt,
  createMonolithGuideSchema,
  ENHANCED_STUDY_GUIDE_QUIZ_SCHEMA,
} from '../../../../../api/hosted-ai'

/**
 * The claimable skill is named in the final-quiz stage, not with the guide
 * body. That stage runs once the whole guide is written, so the namer sees the
 * finished subject, and it costs nothing extra because the call already exists.
 */
const monolithPrompt = () =>
  buildMonolithGuidePrompt({
    topic: 'beginner React',
    titleFallback: 'React',
    folderNameFallback: 'React',
    userKnownTopics: [],
  })

const quizPrompt = () =>
  buildEnhancedQuizPrompt({
    topic: 'beginner React',
    source: 'Pages about React components and state.',
    bridgeBlocks: [],
  })

describe('where the claimable skill is named', () => {
  it('asks the final-quiz stage for it', () => {
    expect(quizPrompt()).toContain('learnedSkill')
    expect(quizPrompt()).toContain('identify its subject on its own')
    expect(ENHANCED_STUDY_GUIDE_QUIZ_SCHEMA.properties).toHaveProperty(
      'learnedSkill',
    )
    expect(ENHANCED_STUDY_GUIDE_QUIZ_SCHEMA.required).toContain('learnedSkill')
  })

  it('no longer asks the guide-body stage for it', () => {
    expect(monolithPrompt()).not.toContain('learnedSkillOptions')

    const schema = createMonolithGuideSchema(false)
    expect(schema.properties).not.toHaveProperty('learnedSkillOptions')
    expect(schema.required).not.toContain('learnedSkillOptions')
  })

  it('keeps asking the guide-body stage for the follow-up ideas', () => {
    // They need the pages as they are written, so they stay in the monolith.
    expect(monolithPrompt()).toContain('nextGuideIdeas')
    expect(createMonolithGuideSchema(false).required).toContain(
      'nextGuideIdeas',
    )
  })
})
