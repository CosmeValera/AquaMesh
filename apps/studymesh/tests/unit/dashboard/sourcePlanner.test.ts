import { describe, expect, it } from 'vitest'

import {
  applyDashboardChatSourcePolicy,
  fallbackDashboardChatSourcePlan,
  type DashboardChatSourcePlan,
} from '../../../src/dashboardChat/sourcePlanner'

const plan = (
  selectedSources: DashboardChatSourcePlan['selectedSources'],
): DashboardChatSourcePlan => ({
  selectedSources,
  shouldSearchWeb: selectedSources.includes('web'),
  searchQuery: 'anatomy systems',
  answerStyleHint: 'Be concise.',
  exactAnswerCount: null,
})

describe('dashboard chat source policy', () => {
  it('grounds questions about guide contents in the Study Guide', () => {
    expect(
      applyDashboardChatSourcePolicy(
        'What organ systems are mentioned in the guide?',
        [],
        plan(['general']),
      ),
    ).toMatchObject({
      selectedSources: ['study-guide'],
      shouldSearchWeb: false,
    })
  })

  it('keeps general knowledge as fallback for Auto web searches', () => {
    expect(
      applyDashboardChatSourcePolicy(
        'Find the current anatomy terminology.',
        [],
        plan(['web']),
      ).selectedSources,
    ).toEqual(['web', 'general'])
  })

  it('uses Web Search in Auto when the student explicitly asks to search online', () => {
    expect(
      applyDashboardChatSourcePolicy(
        'Search online for 100 skeletal muscle names.',
        [],
        plan(['general']),
      ),
    ).toMatchObject({
      selectedSources: ['general', 'web'],
      shouldSearchWeb: true,
    })
  })

  it('combines guide and general knowledge for comparisons beyond the guide', () => {
    expect(
      applyDashboardChatSourcePolicy(
        'Compare the systems in the guide with the complete standard list.',
        [],
        plan(['general']),
      ).selectedSources,
    ).toEqual(['study-guide', 'general'])
  })

  it('does not alter explicit source selection', () => {
    expect(
      applyDashboardChatSourcePolicy(
        'What is in the guide?',
        ['general'],
        plan(['general']),
      ).selectedSources,
    ).toEqual(['general'])
  })
})

describe('fallback exact answer count', () => {
  it('detects a bare exact-list request', () => {
    expect(
      fallbackDashboardChatSourcePlan('Tell me the names of 10 bones.', [])
        .exactAnswerCount,
    ).toBe(10)
  })

  it('detects a Spanish exact-list request', () => {
    expect(
      fallbackDashboardChatSourcePlan('Dame los nombres de 5 huesos.', [])
        .exactAnswerCount,
    ).toBe(5)
  })

  it('skips exact-list mode when explanations are requested', () => {
    expect(
      fallbackDashboardChatSourcePlan(
        'Give me 3 examples and explain each one.',
        [],
      ).exactAnswerCount,
    ).toBeNull()
  })

  it('ignores counts outside the supported range', () => {
    expect(
      fallbackDashboardChatSourcePlan('List 999 facts.', []).exactAnswerCount,
    ).toBeNull()
  })
})
