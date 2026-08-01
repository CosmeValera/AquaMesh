import type { DemoGuideDefinition } from './types'

/**
 * The five demo guides. Each one is a topic paired with a lens the reader is
 * likely to already have, so the demo demonstrates the knowledge bridge rather
 * than only showing the interface.
 *
 * `prompt` is the exact string the capture was generated from, so the locked
 * field on /try shows what really produced the guide.
 *
 * Content is loaded on demand: one webpack chunk per guide, fetched only when
 * that guide is opened.
 */
export const DEMO_GUIDES: DemoGuideDefinition[] = [
  {
    slug: 'why-you-forget',
    chipLabel: 'Why you forget',
    prompt:
      'Teach me why I forget most of what I study and how spaced repetition fixes it. I already practise a musical instrument.',
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
      'Teach me what deliberate practice is and why repetition alone stops working. I already play competitive games and grind ranked.',
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
      'Teach me how to find the one thing that is actually holding my learning back. I already know how a busy restaurant kitchen works.',
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
      'Teach me how compound interest actually works and why starting early beats saving more later. I already train at the gym.',
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
      'Teach me how my immune system fights an infection, from first contact to recovery. I already know how airport security works.',
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
