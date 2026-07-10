import { describe, expect, it } from 'vitest'

import {
  applyDashboardChatSourcePolicy,
  type DashboardChatSourcePlan,
} from '../../../src/dashboardChat/sourcePlanner'

const plan = (
  selectedSources: DashboardChatSourcePlan['selectedSources'],
): DashboardChatSourcePlan => ({
  selectedSources,
  shouldSearchWeb: selectedSources.includes('web'),
  searchQuery: 'anatomy systems',
  answerStyleHint: 'Be concise.',
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
