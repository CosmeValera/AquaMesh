/// <reference types="@testing-library/jest-dom" />
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { CssBaseline } from '@mui/material'
import { ThemeProvider } from '@mui/material/styles'
import { MemoryRouter, useLocation } from 'react-router-dom'

import StudyMeshLanding from '../../../../src/components/landing/StudyMeshLanding'
import { createStudyMeshTheme } from '../../../../src/theme'
import {
  HOSTED_AI_CREDIT_PACKS,
  HOSTED_AI_INITIAL_FREE_CREDITS,
  STUDY_CREDITS_LABEL,
} from '../../../../src/quickCreate/ai'

const LocationProbe = () => {
  const location = useLocation()
  return (
    <output data-testid="location">
      {location.pathname}
      {location.search}
    </output>
  )
}

const renderLanding = () => {
  const theme = createStudyMeshTheme('dark', 'rose')

  return render(
    <MemoryRouter initialEntries={['/']}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <StudyMeshLanding />
        <LocationProbe />
      </ThemeProvider>
    </MemoryRouter>,
  )
}

const makeRect = (top: number): DOMRect => ({
  bottom: top + 48,
  height: 48,
  left: 0,
  right: 100,
  toJSON: () => ({}),
  top,
  width: 100,
  x: 0,
  y: top,
})

const makeRectList = (...rects: DOMRect[]): DOMRectList =>
  Object.assign([...rects], {
    item: (index: number) => rects[index] ?? null,
  }) as unknown as DOMRectList

const mockHeroWrapProbeLines = (lineTops: number[]) => {
  vi.spyOn(HTMLElement.prototype, 'getClientRects').mockImplementation(
    function getClientRects() {
      if (this.getAttribute('data-testid') === 'hero-headline-wrap-probe') {
        return makeRectList(...lineTops.map(makeRect))
      }

      return makeRectList(makeRect(0))
    },
  )
}

describe('StudyMeshLanding', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders the rebranded fixed-light hero and timeline', () => {
    renderLanding()

    expect(
      screen.getByText(/for people learning five unrelated things at once/i),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', {
        name: /explain it with something i already get/i,
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/tell rabbithole what you already know/i),
    ).toHaveTextContent(/quizzes and exercises you can actually practice on/i)
    expect(
      screen.getByText(/not a chat thread\. a guide you keep\./i),
    ).toBeInTheDocument()
    expect(screen.getByTestId('hero-differentiator')).toHaveTextContent(
      /a chat gives you an answer\. rabbithole gives you a guide/i,
    )
    expect(screen.getByText(/no account needed to try/i)).toHaveTextContent(
      /free to start/i,
    )
    expect(screen.getAllByText(/20 sec/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/key idea/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/60 sec/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/idea summary/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/5 pages/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/full guide/i).length).toBeGreaterThan(0)
    expect(
      screen.getByRole('heading', {
        name: /same question\. adapted answer\./i,
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        /choose what you already know, watch the explanation change/i,
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /photography/i }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /gaming/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /tech/i })).toBeInTheDocument()
    expect(screen.getAllByText(/what is a bottleneck/i).length).toBeGreaterThan(
      0,
    )
    expect(
      screen.getByText(/the one step that limits the whole system/i),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/indoors, your slow kit lens is the bottleneck/i),
    ).toBeInTheDocument()
    expect(screen.getByText(/with photography context/i)).toBeInTheDocument()
    expect(
      screen.getByRole('link', {
        name: /read domain-specific prior knowledge and learning/i,
      }),
    ).toHaveAttribute(
      'href',
      'https://www.uni-trier.de/fileadmin/fb1/prof/PSY/PAE/Team/Schneider/SimonsmeierEtAl2021.pdf',
    )
    expect(
      screen.getByText(
        /prior knowledge shapes how learners understand new information/i,
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', {
        name: /your guide doesn't stop at page 5/i,
      }),
    ).toBeInTheDocument()
    expect(screen.getByText(/the water cycle/i)).toBeInTheDocument()
    expect(screen.getByText(/evaporation/i)).toBeInTheDocument()
    expect(screen.getByText(/condensation/i)).toBeInTheDocument()
    expect(screen.getByText(/cloud growth/i)).toBeInTheDocument()
    expect(screen.getByText(/precipitation/i)).toBeInTheDocument()
    expect(screen.getAllByText(/review pack/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/^new$/i)).toBeInTheDocument()
    expect(
      screen.getByText(/can you add more practice exercises on this topic/i),
    ).toBeInTheDocument()
    expect(screen.getByText(/done! i added/i)).toBeInTheDocument()

    expect(
      getComputedStyle(screen.getByTestId('studymesh-landing')).color,
    ).toBe('rgb(7, 17, 39)')

    const footer = screen.getByTestId('studymesh-footer')
    expect(footer).toBeInTheDocument()
    expect(
      within(footer).getByText(
        /new topics explained through what you already know/i,
      ),
    ).toBeInTheDocument()
    expect(
      within(footer).getByRole('link', { name: /why rabbithole/i }),
    ).toHaveAttribute('href', '#why')
    expect(
      within(footer).getByRole('link', { name: /what you get/i }),
    ).toHaveAttribute('href', '#what')
    expect(
      within(footer).getByRole('link', { name: /how it works/i }),
    ).toHaveAttribute('href', '#how')
    expect(
      within(footer).getByRole('link', { name: /knowledge bridge/i }),
    ).toHaveAttribute('href', '#knowledge-context')
    expect(within(footer).getByRole('link', { name: /faq/i })).toHaveAttribute(
      'href',
      '#faq',
    )
    expect(
      within(footer).getByRole('link', { name: /see a guide/i }),
    ).toHaveAttribute('href', '/try')
    // The footer's own CTA is for returning users; the demo is reached from
    // the Start list above it and from the in-page CTAs.
    expect(
      within(footer).getByRole('link', { name: /^log in$/i }),
    ).toHaveAttribute('href', '/login')
  })

  it('states honestly where a chat assistant wins and when to open RabbitHole', () => {
    renderLanding()

    expect(
      screen.getByRole('heading', {
        name: /you already have chatgpt/i,
      }),
    ).toBeInTheDocument()

    const comparison = screen.getByTestId('landing-comparison')
    expect(
      within(comparison).getByText(/one answer, right now/i),
    ).toBeInTheDocument()
    expect(
      within(comparison).getByText(/finding it again next week/i),
    ).toBeInTheDocument()
    expect(within(comparison).getByText(/practising it/i)).toBeInTheDocument()
    expect(
      within(comparison).getByText(/who picks the angle/i),
    ).toBeInTheDocument()
    expect(within(comparison).getByText(/going deeper/i)).toBeInTheDocument()
    expect(
      within(comparison).getAllByText(/^chatgpt$/i).length,
    ).toBeGreaterThan(0)
    expect(
      within(comparison).getAllByText(/^rabbithole$/i).length,
    ).toBeGreaterThan(0)
    expect(
      within(comparison).getByText(/page 03 is still page 03/i),
    ).toBeInTheDocument()
    expect(
      within(comparison).getByText(
        /ask for more and the guide grows\. page 06 appears and stays/i,
      ),
    ).toBeInTheDocument()

    expect(within(comparison).getByText(/what it costs/i)).toBeInTheDocument()
    expect(
      within(comparison).getByText(/no subscription\./i),
    ).toBeInTheDocument()

    expect(screen.getByTestId('landing-trigger-line')).toHaveTextContent(
      /use rabbithole for the one you keep looking up/i,
    )
  })

  it('walks the visitor through the why, what and how stages in order', () => {
    renderLanding()

    const stageOrder = ['01', '02', '03', '04', '05']
    stageOrder.forEach((step) => {
      expect(screen.getAllByText(step).length).toBeGreaterThan(0)
    })

    const headings = screen
      .getAllByRole('heading', { level: 2 })
      .map((heading) => heading.textContent ?? '')

    const whyIndex = headings.findIndex((text) =>
      /you already have chatgpt/i.test(text),
    )
    const whatIndex = headings.findIndex((text) =>
      /a whole study workspace out/i.test(text),
    )
    const howIndex = headings.findIndex((text) => /three steps/i.test(text))
    const accessIndex = headings.findIndex((text) =>
      /you can start without an account/i.test(text),
    )
    const faqIndex = headings.findIndex((text) =>
      /the questions people actually ask/i.test(text),
    )

    expect(whyIndex).toBeGreaterThanOrEqual(0)
    expect(whatIndex).toBeGreaterThan(whyIndex)
    expect(howIndex).toBeGreaterThan(whatIndex)
    expect(accessIndex).toBeGreaterThan(howIndex)
    expect(faqIndex).toBeGreaterThan(accessIndex)
  })

  it('lists what a single prompt actually produces', () => {
    renderLanding()

    const outputs = screen.getByTestId('landing-study-outputs')
    expect(
      within(outputs).getByText(/a guide with real pages/i),
    ).toBeInTheDocument()
    expect(within(outputs).getByText(/^quizzes$/i)).toBeInTheDocument()
    expect(within(outputs).getByText(/^flashcards$/i)).toBeInTheDocument()
    expect(within(outputs).getByText(/^exercises$/i)).toBeInTheDocument()
    expect(within(outputs).getByText(/podcast episodes/i)).toBeInTheDocument()
    expect(
      within(outputs).getByText(/dashboards you can rearrange/i),
    ).toBeInTheDocument()
  })

  it('explains the three creation steps, starting with the known-topics list', () => {
    renderLanding()

    const steps = screen.getByTestId('landing-how-it-works')
    expect(
      within(steps).getByText(/say what you already know/i),
    ).toBeInTheDocument()
    expect(
      within(steps).getByText(/ask for what you want to learn/i),
    ).toBeInTheDocument()
    expect(
      within(steps).getByText(/practise it, then push it further/i),
    ).toBeInTheDocument()
  })

  it('answers why to register and what it costs without hardcoding the economics', () => {
    renderLanding()

    const access = screen.getByTestId('landing-access')
    expect(within(access).getByText(/^no account$/i)).toBeInTheDocument()
    expect(within(access).getByText(/^free account$/i)).toBeInTheDocument()
    expect(within(access).getByText(/^your own ai$/i)).toBeInTheDocument()
    expect(
      within(access).getByText(
        new RegExp(
          `${HOSTED_AI_INITIAL_FREE_CREDITS} ${STUDY_CREDITS_LABEL} to start`,
          'i',
        ),
      ),
    ).toBeInTheDocument()

    expect(
      within(access).getByRole('link', { name: /try it now/i }),
    ).toHaveAttribute('href', '/try')
    expect(
      within(access).getByRole('link', { name: /create a free account/i }),
    ).toHaveAttribute('href', '/signup')
    expect(
      within(access).getByRole('link', { name: /see the full pricing/i }),
    ).toHaveAttribute('href', '/pricing')

    expect(screen.getByTestId('landing-access-footnote')).toHaveTextContent(
      new RegExp(`packs start at ${HOSTED_AI_CREDIT_PACKS[0].label}`, 'i'),
    )
  })

  it('answers the differentiation objections in the FAQ and publishes them as structured data', () => {
    renderLanding()

    const faq = screen.getByTestId('landing-faq')
    expect(
      within(faq).getByText(/what is actually different here/i),
    ).toBeInTheDocument()
    expect(within(faq).getByText(/why should i register/i)).toBeInTheDocument()
    expect(
      within(faq).getByText(/why would i pay for this/i),
    ).toBeInTheDocument()
    expect(
      within(faq).getByText(/could i not just prompt a chat/i),
    ).toBeInTheDocument()

    const structuredData = document.head.querySelector(
      'script[data-landing-faq="true"]',
    )
    expect(structuredData).not.toBeNull()

    const parsed = JSON.parse(structuredData?.textContent ?? '{}')
    expect(parsed['@type']).toBe('FAQPage')
    expect(parsed.mainEntity.length).toBeGreaterThan(3)
  })

  it('shows the finished topic being suggested for the known-topics lens', () => {
    renderLanding()

    expect(
      screen.getByRole('heading', {
        name: /what you learn here becomes part of the lens/i,
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/offers to add that topic to what you already know/i),
    ).toBeInTheDocument()

    const lens = screen.getByLabelText('Known topics lens preview', {
      exact: true,
    })
    expect(within(lens).getByText(/what you already know/i)).toBeInTheDocument()
    expect(within(lens).getByText('Cooking')).toBeInTheDocument()
    expect(within(lens).getByText('Bottlenecks')).toBeInTheDocument()
    expect(
      within(lens).getByText(/add it to what you know\?/i),
    ).toBeInTheDocument()
  })

  it('switches knowledge context examples from the landing carousel', () => {
    renderLanding()

    expect(
      screen.getByText(/indoors, your slow kit lens is the bottleneck/i),
    ).toBeInTheDocument()
    expect(screen.getAllByText(/what is a bottleneck/i).length).toBeGreaterThan(
      0,
    )

    fireEvent.click(screen.getByRole('button', { name: /gaming/i }))

    expect(screen.getByRole('button', { name: /gaming/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(
      screen.getByText(/your damage is the bottleneck on that boss/i),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/the one step that limits the whole system/i),
    ).toBeInTheDocument()
  })

  it('scrolls the knowledge context topic row via the left/right arrow buttons', () => {
    renderLanding()

    const topicsRow = screen.getByLabelText('Knowledge context topics', {
      exact: true,
    })
    const scrollBy = vi.fn()

    Object.defineProperties(topicsRow, {
      clientWidth: { configurable: true, value: 600 },
      scrollBy: { configurable: true, value: scrollBy },
      scrollLeft: { configurable: true, value: 240, writable: true },
      scrollWidth: { configurable: true, value: 1200 },
    })
    fireEvent.scroll(topicsRow)

    const scrollRightButton = screen.getByRole('button', {
      name: /scroll knowledge context topics right/i,
    })
    const scrollLeftButton = screen.getByRole('button', {
      name: /scroll knowledge context topics left/i,
    })

    expect(scrollRightButton).toBeEnabled()
    expect(scrollLeftButton).toBeEnabled()

    fireEvent.click(scrollRightButton)

    expect(scrollBy).toHaveBeenLastCalledWith({
      behavior: 'smooth',
      left: 480,
    })

    fireEvent.click(scrollLeftButton)

    expect(scrollBy).toHaveBeenLastCalledWith({
      behavior: 'smooth',
      left: -480,
    })
  })

  it('keeps the full hero underline when the second headline phrase fits on one line', async () => {
    mockHeroWrapProbeLines([100])
    renderLanding()

    await waitFor(() => {
      expect(
        screen.getByTestId('hero-headline-underline-host'),
      ).toHaveAttribute('data-underline-mode', 'full')
    })
    expect(screen.getByTestId('hero-full-underline')).toBeInTheDocument()
  })

  it('moves the hero underline to the closing phrase when the second headline phrase wraps', async () => {
    mockHeroWrapProbeLines([100, 158])
    renderLanding()

    await waitFor(() => {
      expect(
        screen.getByTestId('hero-headline-underline-host'),
      ).toHaveAttribute('data-underline-mode', 'wrapped')
    })
    expect(
      screen.getByTestId('hero-headline-underline-phrase'),
    ).toHaveTextContent('already get.')
  })

  // A link, not an in-app route change: /try is its own page, so it loads
  // fresh at the top instead of swapping in at the current scroll position.
  it('sends the hero CTA to the no-account demo page', () => {
    renderLanding()

    expect(
      screen.getAllByRole('link', { name: /^try it$/i })[0],
    ).toHaveAttribute('href', '/try')
  })
})
