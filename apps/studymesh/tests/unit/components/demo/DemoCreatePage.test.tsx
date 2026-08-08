/// <reference types="@testing-library/jest-dom" />
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'

import { DEMO_GENERATION_MS } from '../../../../src/demo/types'

/**
 * The captured guide data is produced separately, so the registry is mocked
 * here: this suite is about the /try surface, not about any one guide.
 */
const demoGuideFixtures = vi.hoisted(() =>
  ['one', 'two', 'three', 'four', 'five'].map((name, index) => ({
    slug: `sample-${name}`,
    chipLabel: `Sample ${name}`,
    prompt: `Teach me sample ${name}.`,
    lensSkill: `Context ${name}`,
    lensExplanation: `Context ${name} explains sample ${name}.`,
    title: `Sample ${name}`,
    emoji: '🐇',
    load: vi.fn(async () => ({
      studyPath: { pathId: `demo-sample-${name}`, dashboards: [], index },
      bonusPages: [],
      chat: [],
    })),
  })),
)

const demoSkillFixtures = vi.hoisted(() =>
  ['one', 'two', 'three', 'four', 'five'].map((name) => ({
    name: `Context ${name}`,
    keywords: `Keywords ${name}`,
  })),
)

const authState = vi.hoisted(() => ({
  current: { user: null as { is_anonymous?: boolean } | null, loading: false },
}))

vi.mock('../../../../src/demo/demoGuides', () => ({
  DEMO_GUIDES: demoGuideFixtures,
  DEMO_PROFILE_SKILLS: demoSkillFixtures,
  findDemoGuide: (slug?: string) =>
    demoGuideFixtures.find((guide) => guide.slug === slug) || null,
}))

vi.mock('../../../../src/auth/AuthProvider', () => ({
  useAuth: () => authState.current,
}))

import DemoCreatePage, {
  DEMO_MATCH_MS,
} from '../../../../src/components/demo/DemoCreatePage'

const LocationProbe = () => {
  const location = useLocation()
  return <div data-testid="location">{location.pathname}</div>
}

const renderDemoCreatePage = () =>
  render(
    <MemoryRouter initialEntries={['/try']}>
      <LocationProbe />
      <Routes>
        <Route path="/try" element={<DemoCreatePage />} />
        <Route path="/try/:demoSlug" element={<div>Sample guide open</div>} />
        <Route path="/study-guides" element={<div>My guides</div>} />
        <Route path="/signup" element={<div>Signup page</div>} />
      </Routes>
    </MemoryRouter>,
  )

// The prompt panel takes no click, so it has no accessible name to query by.
const getPromptPanel = () => screen.getByTestId('demo-prompt-panel')

describe('DemoCreatePage', () => {
  beforeEach(() => {
    authState.current = { user: null, loading: false }
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows the whole context library and every prepared topic upfront', () => {
    renderDemoCreatePage()

    expect(getPromptPanel()).toHaveTextContent(/pick a topic above/i)

    const chipLabels = demoGuideFixtures.map((guide) => guide.chipLabel)
    const chips = screen
      .getAllByRole('button')
      .filter((button) => chipLabels.includes(button.textContent || ''))

    expect(chips).toHaveLength(5)
    demoSkillFixtures.forEach((skill) => {
      expect(screen.getByText(skill.name)).toBeInTheDocument()
      expect(screen.getByText(skill.keywords)).toBeInTheDocument()
    })
    expect(screen.queryByText(/auto-matched/i)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /create guide/i })).toBeDisabled()
  })

  it('fills the locked prompt and enables Create when a topic is picked', () => {
    vi.useFakeTimers()
    renderDemoCreatePage()

    fireEvent.click(screen.getByRole('button', { name: 'Sample two' }))

    expect(getPromptPanel()).toHaveTextContent(demoGuideFixtures[1].prompt)
    // Create waits for the match to settle, so the guide can never open before
    // the context it is explained through has been shown.
    expect(screen.getByRole('button', { name: /create guide/i })).toBeDisabled()

    act(() => {
      vi.advanceTimersByTime(DEMO_MATCH_MS)
    })

    expect(screen.getByRole('button', { name: /create guide/i })).toBeEnabled()
  })

  it('runs the context match before it reveals the matched context', () => {
    vi.useFakeTimers()
    renderDemoCreatePage()

    fireEvent.click(screen.getByRole('button', { name: 'Sample four' }))

    expect(screen.getByText(/ranking your contexts/i)).toBeInTheDocument()
    expect(screen.queryByText(/auto-matched/i)).not.toBeInTheDocument()
    expect(getPromptPanel()).not.toHaveTextContent(/explained through/i)

    act(() => {
      vi.advanceTimersByTime(DEMO_MATCH_MS)
    })

    expect(screen.queryByText(/ranking your contexts/i)).not.toBeInTheDocument()
    expect(screen.getByText(/auto-matched/i)).toBeInTheDocument()
    expect(
      screen.getByText(`Matched: ${demoGuideFixtures[3].lensSkill}`),
    ).toBeInTheDocument()
    expect(
      screen.getByText(demoGuideFixtures[3].lensExplanation),
    ).toBeInTheDocument()
    expect(getPromptPanel()).toHaveTextContent(/explained through/i)
  })

  it('restarts the match when the visitor switches topic', () => {
    vi.useFakeTimers()
    renderDemoCreatePage()

    fireEvent.click(screen.getByRole('button', { name: 'Sample four' }))
    act(() => {
      vi.advanceTimersByTime(DEMO_MATCH_MS)
    })
    expect(screen.getByText(/auto-matched/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Sample one' }))

    expect(screen.getByText(/ranking your contexts/i)).toBeInTheDocument()
    expect(screen.queryByText(/auto-matched/i)).not.toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(DEMO_MATCH_MS)
    })

    expect(
      screen.getByText(`Matched: ${demoGuideFixtures[0].lensSkill}`),
    ).toBeInTheDocument()
  })

  it('runs the fake generation and then opens the sample guide', () => {
    vi.useFakeTimers()
    renderDemoCreatePage()

    fireEvent.click(screen.getByRole('button', { name: 'Sample three' }))
    act(() => {
      vi.advanceTimersByTime(DEMO_MATCH_MS)
    })
    fireEvent.click(screen.getByRole('button', { name: /create guide/i }))

    expect(screen.getByText(/generating your guide/i)).toBeInTheDocument()
    expect(demoGuideFixtures[2].load).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('location')).toHaveTextContent('/try')
    expect(screen.queryByText('Sample guide open')).not.toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(DEMO_GENERATION_MS)
    })

    expect(screen.getByTestId('location')).toHaveTextContent(
      '/try/sample-three',
    )
    expect(screen.getByText('Sample guide open')).toBeInTheDocument()
  })

  it('does not navigate when the page unmounts mid-generation', () => {
    vi.useFakeTimers()
    const view = renderDemoCreatePage()

    fireEvent.click(screen.getByRole('button', { name: 'Sample one' }))
    act(() => {
      vi.advanceTimersByTime(DEMO_MATCH_MS)
    })
    fireEvent.click(screen.getByRole('button', { name: /create guide/i }))
    view.unmount()

    expect(() => {
      act(() => {
        vi.advanceTimersByTime(DEMO_GENERATION_MS)
      })
    }).not.toThrow()
  })

  it('leaves the prompt panel inert', () => {
    renderDemoCreatePage()

    const panel = getPromptPanel()
    expect(panel.tagName).toBe('DIV')
    expect(panel).not.toHaveAttribute('role')

    fireEvent.click(panel)

    expect(screen.queryByTestId('demo-signup-nudge')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /sign up free/i }),
    ).not.toBeInTheDocument()
  })

  it('highlights Create guide only once the match has settled', () => {
    vi.useFakeTimers()
    renderDemoCreatePage()

    const createButton = () =>
      screen.getByRole('button', { name: /create guide/i })
    expect(createButton()).not.toHaveAttribute('data-cta-ready')

    fireEvent.click(screen.getByRole('button', { name: 'Sample two' }))
    // Still ranking: pointing at Create before it works would be a dead end.
    expect(createButton()).not.toHaveAttribute('data-cta-ready')

    act(() => {
      vi.advanceTimersByTime(DEMO_MATCH_MS)
    })
    expect(createButton()).toHaveAttribute('data-cta-ready', 'true')

    fireEvent.click(createButton())
    expect(createButton()).not.toHaveAttribute('data-cta-ready')
  })

  it('sends a signed-in visitor to their own guides', () => {
    authState.current = { user: { is_anonymous: false }, loading: false }

    renderDemoCreatePage()

    expect(screen.getByText('My guides')).toBeInTheDocument()
  })
})
