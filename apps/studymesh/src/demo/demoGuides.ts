import type { DemoGuideDefinition } from './types'

/**
 * What the demo reader has already declared they know.
 *
 * These are seeded into the profile context at capture time exactly as a real
 * user's declared topics would be, so the generator picks the relevant one
 * itself rather than being told which to use. That is the mechanism the demo
 * exists to show, so /try displays this list and marks the topic each guide
 * ends up leaning on.
 */
export interface DemoProfileSkill {
  /** Written exactly as a real reader would write it in their own library. */
  name: string
  /** The structure of the topic, shown under the name on /try. */
  keywords: string
}

export const DEMO_PROFILE_SKILLS: DemoProfileSkill[] = [
  {
    name: 'Practising a musical instrument',
    keywords: 'Slow reps, plateaus, muscle memory',
  },
  {
    name: 'Competitive video games',
    keywords: 'Ranking, feedback loops, meta shifts',
  },
  {
    name: 'Working in a restaurant kitchen',
    keywords: 'Stations, tickets, throughput, prep',
  },
  {
    name: 'Training at the gym',
    keywords: 'Progressive overload, recovery, form',
  },
  {
    name: 'Airport security',
    keywords: 'Queues, checkpoints, filtering, flow',
  },
]

/**
 * The five demo guides. Each pairs a topic with the declared skill its
 * generated guide leans on, so a visitor can watch the bridge being crossed.
 *
 * `prompt` is the exact string the capture was generated from, and carries no
 * hint about the lens: the connection comes from the declared profile, not from
 * the wording of the request.
 *
 * Content is loaded on demand: one webpack chunk per guide, fetched only when
 * that guide is opened.
 */
export const DEMO_GUIDES: DemoGuideDefinition[] = [
  {
    slug: 'why-you-forget',
    chipLabel: 'Why you forget',
    prompt:
      'Teach me why I forget most of what I study, and how spaced repetition fixes it.',
    capturePrompt:
      'Teach me why I forget most of what I study, and how spaced repetition fixes it. Explain it through practising a musical instrument, which I already do.',
    lensSkill: 'Practising a musical instrument',
    lensExplanation:
      'A piece you stop playing fades on a curve. Memory fades on that same curve.',
    title: 'Why you forget, and spaced repetition',
    emoji: '🎻',
    load: () =>
      import(
        /* webpackChunkName: "demo-guide-why-you-forget" */ './guides/whyYouForget'
      ).then((module) => module.default),
  },
  {
    slug: 'deliberate-practice',
    chipLabel: 'Deliberate practice',
    prompt:
      'Teach me what deliberate practice is, and why repeating something over and over stops making me better.',
    capturePrompt:
      'Teach me what deliberate practice is, and why repeating something over and over stops making me better. Explain it through competitive video games, which I already play.',
    lensSkill: 'Competitive video games',
    lensExplanation:
      'Ranked play only moves you at the edge of what you can handle. So does practice.',
    title: 'Deliberate practice',
    emoji: '🎯',
    load: () =>
      import(
        /* webpackChunkName: "demo-guide-deliberate-practice" */ './guides/deliberatePractice'
      ).then((module) => module.default),
  },
  {
    slug: 'learning-bottlenecks',
    chipLabel: 'Bottlenecks in your learning',
    prompt:
      'Teach me how to find the one thing that is actually holding my learning back, instead of working harder on everything.',
    capturePrompt:
      'Teach me how to find the one thing that is actually holding my learning back, instead of working harder on everything. Explain it through working in a restaurant kitchen, which I already know well.',
    lensSkill: 'Working in a restaurant kitchen',
    lensExplanation:
      'One slow station caps the whole kitchen. One slow skill caps all your learning.',
    title: 'Bottlenecks in your own learning',
    emoji: '🍳',
    load: () =>
      import(
        /* webpackChunkName: "demo-guide-learning-bottlenecks" */ './guides/learningBottlenecks'
      ).then((module) => module.default),
  },
  {
    slug: 'compound-interest',
    chipLabel: 'Compound interest',
    prompt:
      'Teach me how compound interest actually works, and why starting early beats saving more later.',
    capturePrompt:
      'Teach me how compound interest actually works, and why starting early beats saving more later. Explain it through training at the gym, which I already do.',
    lensSkill: 'Training at the gym',
    lensExplanation:
      'Each session builds on the gains of the last. Money compounds the same way.',
    title: 'How compound interest actually works',
    emoji: '📈',
    load: () =>
      import(
        /* webpackChunkName: "demo-guide-compound-interest" */ './guides/compoundInterest'
      ).then((module) => module.default),
  },
  {
    slug: 'immune-response',
    chipLabel: 'How your immune system works',
    prompt:
      'Teach me how my immune system fights an infection, from first contact to recovery.',
    capturePrompt:
      'Teach me how my immune system fights an infection, from first contact to recovery. Explain it through airport security, which I already understand.',
    lensSkill: 'Airport security',
    lensExplanation:
      'A fast check, a specific check, a watchlist that remembers. Your immune system too.',
    title: 'How your immune system fights an infection',
    emoji: '🛡️',
    load: () =>
      import(
        /* webpackChunkName: "demo-guide-immune-response" */ './guides/immuneResponse'
      ).then((module) => module.default),
  },
]

export const findDemoGuide = (slug?: string): DemoGuideDefinition | null =>
  DEMO_GUIDES.find((guide) => guide.slug === slug) || null
