import { describe, expect, it } from 'vitest'

import {
  buildStudyGuideKnownTopicPrefilterPrompt,
  buildStudyGuideNextIdeaPrompt,
  deriveStudyGuideBridgeStrength,
  normalizeStudyGuideTitle,
  parseStudyGuideKnownTopicPrefilterResult,
  parseStudyGuideQuickStart,
  parseStudyGuideQuickStartRelevanceDecision,
  resolveStudyGuideKnowledgeContextPlan,
  sanitizeStudyGuideBridgeCorrespondences,
  sanitizeStudyGuideLearnedSkillOptions,
  STUDY_GUIDE_LEARNED_SKILL_FIELD_INSTRUCTION,
  STUDY_GUIDE_LEARNED_SKILL_INSTRUCTION,
  sanitizeStudyGuideNextIdeas,
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
) => ({
  knownSide,
  targetSide,
  carries: 'the same causal job',
  kind,
  alsoWorksFor: 'none',
})

describe('bridge strength derivation', () => {
  it('returns none for an empty mapping', () => {
    expect(deriveStudyGuideBridgeStrength([])).toBe('none')
  })

  it('returns weak when the mapping runs out of pairs', () => {
    expect(
      deriveStudyGuideBridgeStrength(
        sanitizeStudyGuideBridgeCorrespondences([
          pair('lock', 'receptor'),
          pair('key', 'adenosine'),
          pair('decoy key', 'caffeine'),
          pair('keys queuing at the door', 'sleep pressure', 'process'),
        ]),
      ),
    ).toBe('weak')
  })

  // A mostly structural analogy still leads. Caffeine through locksmithing is
  // four static roles plus one dynamic, and it is the strongest bridge we have.
  it('returns strong for a broad mapping carrying one process', () => {
    expect(
      deriveStudyGuideBridgeStrength(
        sanitizeStudyGuideBridgeCorrespondences([
          pair("a lock's keyway", 'an adenosine receptor'),
          pair("a key's cut", "caffeine's molecular shape"),
          pair('an inserted key', 'caffeine occupying a receptor'),
          pair('a jammed lock', 'blocked adenosine signalling'),
          pair('repeated lock use', 'tolerance after repeated use', 'process'),
        ]),
      ),
    ).toBe('strong')
  })

  it('returns weak when nothing transfers over time at all', () => {
    expect(
      deriveStudyGuideBridgeStrength(
        sanitizeStudyGuideBridgeCorrespondences([
          pair('a', 'one'),
          pair('b', 'two'),
          pair('c', 'three'),
          pair('d', 'four'),
          pair('e', 'five'),
        ]),
      ),
    ).toBe('weak')
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

  // A topic sharing only a property runs out of pairs early; a real one keeps
  // going. This is the budgeting-vs-Galician case that shipped as a false strong.
  it('rejects a shared-property mapping that runs dry', () => {
    expect(
      deriveStudyGuideBridgeStrength(
        sanitizeStudyGuideBridgeCorrespondences([
          pair('budget categories', 'grammar categories'),
          pair('tracked expenses', 'vocabulary choices'),
          pair('monthly budget review', 'verb endings', 'process'),
        ]),
      ),
    ).toBe('weak')
  })
})

describe('study guide title normalizing', () => {
  it('turns a slug into spaces and capitalizes only the first word', () => {
    expect(normalizeStudyGuideTitle('caffeine-brain-effects')).toBe(
      'Caffeine brain effects',
    )
    expect(normalizeStudyGuideTitle('spaced_repetition')).toBe(
      'Spaced repetition',
    )
  })

  it('keeps the model casing of every word after the first', () => {
    expect(normalizeStudyGuideTitle('How Memory Works')).toBe('How Memory Works')
    expect(normalizeStudyGuideTitle('how memory works')).toBe('How memory works')
  })

  it('leaves real hyphenated words alone', () => {
    expect(normalizeStudyGuideTitle('e-commerce')).toBe('E-commerce')
    expect(normalizeStudyGuideTitle('Cost-Benefit Analysis')).toBe(
      'Cost-Benefit Analysis',
    )
  })

  it('collapses whitespace and handles non-strings', () => {
    expect(normalizeStudyGuideTitle('  spaced   out  ')).toBe('Spaced out')
    expect(normalizeStudyGuideTitle(undefined)).toBe('')
    expect(normalizeStudyGuideTitle(42)).toBe('')
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
          pair('drift creeping back', 'drift', 'process'),
          pair('inventory file', 'host list'),
          pair('a failed run retried', 'reconvergence', 'process'),
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

describe('follow-up guide ideas offered after the quiz', () => {
  it('keeps at most three complete ideas and drops duplicates by label', () => {
    const ideas = sanitizeStudyGuideNextIdeas([
      { label: 'Ansible roles', prompt: 'Teach me how Ansible roles work.' },
      { label: 'ansible roles', prompt: 'Teach me roles again.' },
      { label: 'Terraform state', prompt: 'Teach me how state files work.' },
      { label: 'Helm charts', prompt: 'Teach me how Helm charts work.' },
      { label: 'Kustomize', prompt: 'Teach me Kustomize overlays.' },
    ])

    expect(ideas.map((idea) => idea.label)).toEqual([
      'Ansible roles',
      'Terraform state',
      'Helm charts',
    ])
  })

  it('drops entries missing a label or a prompt instead of half-rendering them', () => {
    expect(
      sanitizeStudyGuideNextIdeas([
        { label: 'Ansible roles' },
        { prompt: 'Teach me something.' },
        { label: '   ', prompt: 'Teach me something.' },
        'Ansible roles',
        null,
      ]),
    ).toEqual([])
  })

  it('returns nothing for a provider that skipped the field', () => {
    expect(sanitizeStudyGuideNextIdeas(undefined)).toEqual([])
    expect(sanitizeStudyGuideNextIdeas('Ansible roles')).toEqual([])
  })

  it('names the claimed skill under the idea so the bridge does not guess', () => {
    expect(
      buildStudyGuideNextIdeaPrompt(
        'Teach me how Terraform state works.',
        'Explain it through Ansible playbooks, which I know.',
      ),
    ).toBe(
      'Teach me how Terraform state works.\n\nExplain it through Ansible playbooks, which I know.',
    )
  })

  it('sends the idea alone when there is no skill to bridge from', () => {
    expect(
      buildStudyGuideNextIdeaPrompt('Teach me how Terraform state works.', ''),
    ).toBe('Teach me how Terraform state works.')
    expect(buildStudyGuideNextIdeaPrompt('  ', 'Explain it through X.')).toBe('')
  })

  it('keeps a single claimable skill so a guide always shows the same one', () => {
    expect(
      sanitizeStudyGuideLearnedSkillOptions([
        '  ansible playbooks ',
        'Idempotent runs',
        'Inventory files',
      ]),
    ).toEqual(['Ansible playbooks'])
  })

  it('orders a labelled slate by axis and keeps one idea per axis', () => {
    const ideas = sanitizeStudyGuideNextIdeas([
      { axis: 'connection', label: 'Idempotent systems', prompt: 'Teach me A.' },
      { axis: 'CURIOSITY', label: 'Why runs drift', prompt: 'Teach me B.' },
      { axis: 'connection', label: 'Convergence loops', prompt: 'Teach me C.' },
      { axis: 'utility', label: 'Debugging a run', prompt: 'Teach me D.' },
    ])

    expect(ideas.map((idea) => idea.axis)).toEqual([
      'curiosity',
      'utility',
      'connection',
    ])
    // The second connection entry loses, not the first.
    expect(ideas[2].label).toBe('Idempotent systems')
  })

  it('keeps the model order when the slate is not fully labelled', () => {
    // Google local AI answers without a response schema, so it drops the axis.
    const ideas = sanitizeStudyGuideNextIdeas([
      { label: 'Debugging a run', prompt: 'Teach me A.' },
      { axis: 'curiosity', label: 'Why runs drift', prompt: 'Teach me B.' },
    ])

    expect(ideas.map((idea) => idea.label)).toEqual([
      'Debugging a run',
      'Why runs drift',
    ])
  })

  it('ignores an axis the model invented instead of dropping the idea', () => {
    const ideas = sanitizeStudyGuideNextIdeas([
      { axis: 'mechanism', label: 'Why runs drift', prompt: 'Teach me A.' },
    ])

    expect(ideas).toEqual([{ label: 'Why runs drift', prompt: 'Teach me A.' }])
  })
})

describe('claimable skill naming rules', () => {
  it('demands the subject when the concept is not unique to it', () => {
    // A React guide named its skill "Component state flow", which reads as Vue
    // or Angular just as well once it sits in a list of known topics.
    expect(STUDY_GUIDE_LEARNED_SKILL_INSTRUCTION).toContain(
      'identify its subject on its own',
    )
    expect(STUDY_GUIDE_LEARNED_SKILL_INSTRUCTION).toContain(
      'name the subject in it',
    )
  })

  it('still refuses to name the guide rather than the concept', () => {
    expect(STUDY_GUIDE_LEARNED_SKILL_INSTRUCTION).toContain('never the guide')
  })

  it('shares one wording between the array field and the hosted string', () => {
    expect(STUDY_GUIDE_LEARNED_SKILL_INSTRUCTION).toContain(
      'learnedSkillOptions:',
    )
    expect(STUDY_GUIDE_LEARNED_SKILL_FIELD_INSTRUCTION).toContain(
      'learnedSkill: one string.',
    )
    expect(STUDY_GUIDE_LEARNED_SKILL_FIELD_INSTRUCTION).toContain(
      'identify its subject on its own',
    )
  })
})
