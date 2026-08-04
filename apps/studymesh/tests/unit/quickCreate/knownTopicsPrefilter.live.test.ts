// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { generateStudyGuideQuickStartWithAi } from '../../../src/quickCreate/ai/provider'
import { STRONG_AI_PROVIDERS } from '../../../src/quickCreate/ai/strongProviders'
import type { AiStudyPathDraft } from '../../../src/quickCreate/ai/strongGeneration'
import {
  resolveStudyGuideKnowledgeContextPlan,
  type StudyGuideQuickStartRelevanceDecision,
} from '../../../src/studyGuides/quickStart'
import { USER_KNOWN_TOPICS_DIRECT_MAX } from '../../../src/profileContext'

// strongProviders.ts calls window.setTimeout; the node test environment (used
// here so the native fetch/AbortController stay in the same realm) has no
// window global, so alias it to globalThis.
if (!('window' in globalThis)) {
  Object.assign(globalThis, { window: globalThis })
}

/**
 * These tests make real network calls to the Gemini API using GEMINI_API_KEY
 * from the environment. They exist to verify the known-topic prefilter/select
 * pipeline against a live model, not as part of the normal fast unit suite.
 * They silently skip (not fail) when no key is present, which is also what
 * keeps them inert in CI and on any machine that hasn't exported the key.
 */
const apiKey = process.env.GEMINI_API_KEY?.trim()
const { defaultModel } = STRONG_AI_PROVIDERS.gemini

const SENSIBLE_UNRELATED_TOPICS = [
  'Cooking', 'Baking', 'Gardening', 'Photography', 'Guitar', 'Piano', 'Chess',
  'Yoga', 'Running', 'Swimming', 'Painting', 'Sculpture', 'Poetry',
  'Novel writing', 'Astronomy', 'Geology', 'Marine biology', 'Genetics',
  'Neuroscience', 'Philosophy', 'Ancient Rome', 'World War II',
  'French Revolution', 'Renaissance art', 'Jazz music', 'Classical music',
  'Wine tasting', 'Coffee brewing', 'Woodworking', 'Knitting', 'Pottery',
  'Investing', 'Personal finance', 'Real estate', 'Tax planning',
  'Public speaking', 'Negotiation', 'Leadership', 'Marketing', 'Copywriting',
  'SEO', 'Graphic design', 'UX design', 'Typography', 'Film editing',
  'Screenwriting', 'Acting', 'Stand-up comedy', 'Meditation', 'Nutrition',
  'Weightlifting', 'Rock climbing', 'Surfing', 'Skiing', 'Sailing',
  'Beekeeping', 'Fermentation', 'Herbalism', 'Astrology', 'Tarot',
  'Mythology', 'Linguistics', 'Etymology', 'Sign language', 'Calligraphy',
  'Origami', 'Board games', 'Card magic', 'Bird watching',
  'Butterfly identification', 'Mushroom foraging', 'Home brewing',
  'Cheese making', 'Bread baking', 'Sushi making', 'Barbecue techniques',
  'Cocktail mixing', 'Tea ceremony', 'Meditation retreats', 'Tai chi',
  'Martial arts', 'Fencing', 'Archery', 'Horseback riding', 'Falconry',
  'Astrophysics', 'Quantum mechanics', 'Organic chemistry',
  'Evolutionary biology', 'Anthropology', 'Sociology', 'Political theory',
  'Economics', 'Game theory', 'Statistics', 'Probability theory',
  'Number theory', 'Topology', 'Cryptography basics', 'Robotics',
  '3D printing', 'Electronics repair', 'Car mechanics',
  'Motorcycle maintenance', 'Home renovation', 'Interior design',
  'Landscape architecture', 'Urban planning', 'Sustainable agriculture',
  'Permaculture', 'Composting', 'Solar power basics', 'Wind energy',
  'Climate science', 'Oceanography', 'Volcanology', 'Paleontology',
  'Archaeology', 'Egyptology', 'Numismatics', 'Philately', 'Genealogy',
  'Handwriting analysis', 'Speed reading', 'Memory techniques', 'Debate',
  'Chess openings', 'Go (board game)', 'Poker strategy', 'Bridge (card game)',
  'Crossword puzzles', 'Sudoku', 'Escape rooms', 'Geocaching',
  'Model trains', 'RC cars', 'Drone flying', 'Amateur radio', 'Podcasting',
  'Voice acting', 'Stand-up paddleboarding', 'Ice skating',
  'Figure skating', 'Ballet', 'Modern dance', 'Salsa dancing',
  'Ballroom dancing', 'Pottery glazing', 'Leatherworking', 'Blacksmithing',
  'Watchmaking', 'Perfumery', 'Candle making', 'Soap making',
  'Upholstery', 'Stained glass art', 'Mosaic art', 'Street art',
  'Comic book art', 'Animation basics', 'Puppetry', 'Ventriloquism',
  'Juggling', 'Unicycling', 'Parkour', 'Slacklining', 'Kite flying',
  'Model rocketry', 'Metal detecting', 'Freshwater fishing', 'Fly tying',
  'Bonsai', 'Terrariums', 'Houseplant care', 'Aquascaping',
]

const RELEVANT_NETWORKING_TOPICS = [
  'Docker containers',
  'Linux networking basics',
  'DNS resolution',
  'Load balancer design',
  'TCP/IP fundamentals',
  'Reverse proxy setup',
  'Container orchestration',
  'Cloud VPC design',
]

const buildGarbageTopics = (count: number): string[] =>
  Array.from({ length: count }, (_, index) => {
    const junk = ['asfd', 'qwerty', 'zxcv', 'lorem', 'blah', 'foo', 'xyzz']
    return `${junk[index % junk.length]}${index}${(index * 7919) % 99991}`
  })

const draft: AiStudyPathDraft = {
  title: 'Kubernetes networking',
  folderName: 'Kubernetes networking',
  dashboards: [],
  warnings: [],
}

const PROMPT =
  'Teach me how Kubernetes networking works: pod-to-pod traffic, service discovery, and load balancing.'

const runQuickStart = async (userKnownTopics: string[]) => {
  let decision: StudyGuideQuickStartRelevanceDecision | undefined
  const quickStart = await generateStudyGuideQuickStartWithAi({
    provider: 'gemini',
    apiToken: apiKey || '',
    model: defaultModel,
    title: draft.title,
    prompt: PROMPT,
    draft,
    userKnownTopics,
    onRelevanceDecision: (nextDecision) => {
      decision = nextDecision
    },
  })
  return { quickStart, decision }
}

const expectNoInventedTopics = (
  decision: StudyGuideQuickStartRelevanceDecision | undefined,
  candidateTopics: string[],
) => {
  if (!decision?.knownTopicsForQuickStart?.length) {
    return
  }
  const candidateKeys = new Set(candidateTopics.map((topic) => topic.toLowerCase()))
  decision.knownTopicsForQuickStart.forEach((topic) => {
    expect(candidateKeys.has(topic.toLowerCase())).toBe(true)
  })
}

describe.skipIf(!apiKey)('known-topic AI pipeline (live Gemini calls)', () => {
  it('at or under the direct-call cap: runs a single selection call, no prefilter', async () => {
    const topics = [...RELEVANT_NETWORKING_TOPICS, ...SENSIBLE_UNRELATED_TOPICS.slice(0, 12)]
    expect(topics.length).toBeLessThanOrEqual(USER_KNOWN_TOPICS_DIRECT_MAX)

    const plan = resolveStudyGuideKnowledgeContextPlan(topics)
    expect(plan.shouldRunKnownTopicPrefilter).toBe(false)

    const { quickStart, decision } = await runQuickStart(topics)

    expect(quickStart.keyIdea?.trim()).toBeTruthy()
    expect(quickStart.quickSummary?.trim()).toBeTruthy()
    expectNoInventedTopics(decision, topics)

    console.log(
      '[direct-call, 20 topics] shouldUseKnownTopic=%s knownTopicsForQuickStart=%o',
      decision?.shouldUseKnownTopic,
      decision?.knownTopicsForQuickStart,
    )
    console.log('[direct-call] keyIdea:', quickStart.keyIdea)
  }, 90_000)

  it('over the cap with mostly-garbage topics: prefilters without inventing, still resolves', async () => {
    const topics = [...buildGarbageTopics(195), ...RELEVANT_NETWORKING_TOPICS]
    expect(topics.length).toBeGreaterThan(USER_KNOWN_TOPICS_DIRECT_MAX)

    const plan = resolveStudyGuideKnowledgeContextPlan(topics)
    expect(plan.shouldRunKnownTopicPrefilter).toBe(true)

    const { quickStart, decision } = await runQuickStart(topics)

    expect(quickStart.keyIdea?.trim()).toBeTruthy()
    expect(quickStart.quickSummary?.trim()).toBeTruthy()
    expectNoInventedTopics(decision, topics)

    console.log(
      '[garbage-heavy, %d topics] shouldUseKnownTopic=%s knownTopicsForQuickStart=%o',
      topics.length,
      decision?.shouldUseKnownTopic,
      decision?.knownTopicsForQuickStart,
    )
    console.log('[garbage-heavy] keyIdea:', quickStart.keyIdea)
  }, 120_000)

  it('over the cap with 200+ sensible but mostly-unrelated topics: narrows to the genuinely relevant ones', async () => {
    const topics = [...SENSIBLE_UNRELATED_TOPICS, ...RELEVANT_NETWORKING_TOPICS]
    expect(topics.length).toBeGreaterThan(USER_KNOWN_TOPICS_DIRECT_MAX)

    const plan = resolveStudyGuideKnowledgeContextPlan(topics)
    expect(plan.shouldRunKnownTopicPrefilter).toBe(true)

    const { quickStart, decision } = await runQuickStart(topics)

    expect(quickStart.keyIdea?.trim()).toBeTruthy()
    expect(quickStart.quickSummary?.trim()).toBeTruthy()
    expectNoInventedTopics(decision, topics)

    console.log(
      '[sensible-heavy, %d topics] shouldUseKnownTopic=%s knownTopicsForQuickStart=%o',
      topics.length,
      decision?.shouldUseKnownTopic,
      decision?.knownTopicsForQuickStart,
    )
    console.log('[sensible-heavy] keyIdea:', quickStart.keyIdea)
  }, 120_000)
})
