/// <reference types="@testing-library/jest-dom" />
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'

/**
 * The captured guide data is produced separately, so the registry is mocked and
 * this suite owns its own tiny guide. What is exercised here is the demo shell:
 * the real workspace and the real chat panel driven entirely from frozen data,
 * with nothing allowed to reach the network.
 */
const demoFixture = vi.hoisted(() => {
  const pathId = 'demo-sample-guide'
  const folderName = 'Sample guide'

  const pageLayout = (
    pageKey: string,
    title: string,
    blocks: Array<Record<string, unknown>>,
  ) => ({
    type: 'row',
    name: title,
    children: [
      {
        type: 'tabset',
        children: [
          {
            type: 'tab',
            name: title,
            component: 'CustomWidget',
            config: {
              customProps: {
                studyPathId: pathId,
                studyPathTitle: folderName,
                studyPathDashboardKey: pageKey,
                studyPathDashboardName: title,
                components: [
                  {
                    id: `${pageKey}-title`,
                    type: 'Label',
                    props: { text: title, variant: 'h6', fontWeight: 700 },
                  },
                  ...blocks,
                ],
              },
            },
          },
        ],
      },
    ],
  })

  const page = (
    index: number,
    title: string,
    blocks: Array<Record<string, unknown>>,
  ) => {
    const pageKey = `${pathId}-page-${index}`

    return {
      id: pageKey,
      name: title,
      dashboardKey: pageKey,
      dashboardIndex: index,
      dashboardCount: 3,
      folderName,
      layout: pageLayout(pageKey, title, blocks),
    }
  }

  const lessonPage = (index: number, title: string, markdown: string) =>
    page(index, title, [
      {
        id: `${pathId}-page-${index}-markdown`,
        type: 'MarkdownBlock',
        props: { title, markdown },
      },
    ])

  const quizPage = page(4, 'Practice quiz', [
    {
      id: `${pathId}-page-4-quiz`,
      type: 'QuizCarouselBlock',
      props: {
        title: 'Practice quiz',
        items: [
          {
            question: 'When is the best moment to review a fading skill?',
            options: [
              'Right after the first session',
              'Just before you would forget it',
            ],
            correctIndex: 1,
          },
        ],
      },
    },
  ])

  const content = {
    studyPath: {
      pathId,
      title: folderName,
      folderName,
      selectedIndex: 0,
      dashboards: [
        lessonPage(
          1,
          'Why practice fades',
          'Retrieval strength decays without review.',
        ),
        lessonPage(
          2,
          'Spacing the reviews',
          'The second review is what stops the decay.',
        ),
        lessonPage(
          3,
          'Building the routine',
          'A weekly slot keeps the schedule honest.',
        ),
      ],
    },
    bonusPages: [{ actionId: 'quiz', durationMs: 250, page: quizPage }],
    chat: [
      {
        id: 'chip-1',
        chip: 'How does this apply to guitar?',
        question: 'How does spaced repetition apply to practising guitar?',
        answer: 'Space your scale drills the way you space your reviews.',
        answerDelayMs: 250,
      },
    ],
  }

  return {
    slug: 'sample-guide',
    guide: {
      slug: 'sample-guide',
      chipLabel: 'Sample guide',
      prompt: 'Teach me why I forget what I practise.',
      title: folderName,
      emoji: '🐇',
      load: vi.fn(async () => content),
    },
  }
})

const authState = vi.hoisted(() => ({
  current: { user: null as { is_anonymous?: boolean } | null, loading: false },
}))

vi.mock('../../../../src/demo/demoGuides', () => ({
  DEMO_GUIDES: [demoFixture.guide],
  findDemoGuide: (slug?: string) =>
    slug === demoFixture.guide.slug ? demoFixture.guide : null,
}))

vi.mock('../../../../src/auth/AuthProvider', () => ({
  useAuth: () => authState.current,
}))

import DemoGuidePage from '../../../../src/components/demo/DemoGuidePage'

const LocationProbe = () => {
  const location = useLocation()
  return <div data-testid="location">{location.pathname}</div>
}

const fetchSpy = vi.fn()
let originalFetch: typeof globalThis.fetch

const renderDemoGuidePage = (path = `/try/${demoFixture.slug}`) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <LocationProbe />
      <Routes>
        <Route path="/try" element={<div>Demo create page</div>} />
        <Route path="/try/:demoSlug" element={<DemoGuidePage />} />
        <Route path="/login" element={<div>Login page</div>} />
        <Route path="/signup" element={<div>Signup page</div>} />
        <Route path="/study-guides" element={<div>My guides</div>} />
      </Routes>
    </MemoryRouter>,
  )

/** The first lesson body, which only exists in the frozen capture. */
const findFirstLesson = () =>
  screen.findByText('Retrieval strength decays without review.')

describe('DemoGuidePage', () => {
  beforeEach(() => {
    authState.current = { user: null, loading: false }
    // The real chat panel scrolls its transcript on every new message, and
    // jsdom has no scrollTo: without this the deferred scroll surfaces as an
    // unhandled error after the test has already passed.
    HTMLElement.prototype.scrollTo = vi.fn()
    // The page rail, the breadcrumb and the desktop split all key off `lg`.
    vi.mocked(window.matchMedia).mockImplementation((query) => ({
      matches: query.includes('min-width'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
    originalFetch = globalThis.fetch
    globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('renders the captured lesson pages without making a single request', async () => {
    renderDemoGuidePage()

    expect(await findFirstLesson()).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /^01 Why practice fades$/ }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /^02 Spacing the reviews$/ }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /^03 Building the routine$/ }),
    ).toBeInTheDocument()

    // The composer is a label, not an affordance: it says why it is off and
    // takes no click, rather than opening something the demo cannot honour.
    const composer = screen.getByTestId('dashboard-chat-composer')
    expect(
      within(composer).getByPlaceholderText('Disabled for demo'),
    ).toBeDisabled()
    fireEvent.click(composer)
    expect(screen.queryByTestId('demo-signup-nudge')).not.toBeInTheDocument()

    // The whole point of the canned demo: zero API, zero auth.
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('sends an unknown slug back to the demo create page', () => {
    renderDemoGuidePage('/try/not-a-prepared-guide')

    expect(screen.getByText('Demo create page')).toBeInTheDocument()
    expect(screen.getByTestId('location')).toHaveTextContent('/try')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('takes the breadcrumb back to the demo create page', async () => {
    renderDemoGuidePage()
    await findFirstLesson()

    fireEvent.click(screen.getByText('Sample guides'))

    expect(screen.getByTestId('location')).toHaveTextContent('/try')
    expect(screen.getByText('Demo create page')).toBeInTheDocument()
  })

  it('runs the prepared Quick Create quiz and appends its page', async () => {
    renderDemoGuidePage()
    await findFirstLesson()

    fireEvent.click(screen.getByRole('button', { name: /^Create$/i }))

    // Hosted AI is the default provider, so without the demo opt-out every
    // action in this menu would price itself in Carrots the visitor cannot
    // spend and does not have.
    expect(
      document.querySelectorAll(
        'img[src="/images/study-credits/study-credit.png"]',
      ),
    ).toHaveLength(0)

    fireEvent.click(screen.getByRole('button', { name: /^Quiz$/i }))

    expect(
      await screen.findByTestId('dashboard-chat-quick-create-task-quiz'),
    ).toBeInTheDocument()

    expect(
      await screen.findByText(
        'When is the best moment to review a fading skill?',
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Just before you would forget it'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /^04 Practice quiz$/ }),
    ).toBeInTheDocument()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('answers a prepared chat chip after a pending bubble', async () => {
    renderDemoGuidePage()
    await findFirstLesson()

    fireEvent.click(
      screen.getByRole('button', { name: 'How does this apply to guitar?' }),
    )

    expect(await screen.findByText(/Replying/)).toBeInTheDocument()
    expect(
      await screen.findByText(
        'Space your scale drills the way you space your reviews.',
      ),
    ).toBeInTheDocument()
    expect(screen.queryByText(/Replying/)).not.toBeInTheDocument()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('swaps the banner for the end-of-guide call to action on the last page', async () => {
    renderDemoGuidePage()
    await findFirstLesson()

    expect(screen.getByTestId('demo-banner-sample')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Next page' }))
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }))

    expect(screen.getByTestId('demo-banner-end')).toHaveTextContent(
      "That's the whole sample.",
    )
    expect(screen.queryByTestId('demo-banner-sample')).not.toBeInTheDocument()

    // Paging back to re-read something has not un-shown them the sample, so
    // the closing message and its two ways out stay put.
    fireEvent.click(screen.getByRole('button', { name: 'Previous page' }))
    fireEvent.click(screen.getByRole('button', { name: 'Previous page' }))

    expect(screen.getByTestId('demo-banner-end')).toBeInTheDocument()
    expect(screen.queryByTestId('demo-banner-sample')).not.toBeInTheDocument()
  })

  it('offers a way out only once the sample has been seen through', async () => {
    renderDemoGuidePage()
    await findFirstLesson()

    expect(
      screen.queryByTestId('demo-banner-try-another'),
    ).not.toBeInTheDocument()
    expect(screen.queryByTestId('demo-banner-log-in')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Next page' }))
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }))

    fireEvent.click(screen.getByTestId('demo-banner-try-another'))
    expect(screen.getByTestId('location')).toHaveTextContent('/try')
  })

  it('sends the closing log-in button to the login page', async () => {
    renderDemoGuidePage()
    await findFirstLesson()

    fireEvent.click(screen.getByRole('button', { name: 'Next page' }))
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }))

    fireEvent.click(screen.getByTestId('demo-banner-log-in'))

    expect(screen.getByTestId('location')).toHaveTextContent('/login')
  })

})
