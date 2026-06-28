/// <reference types="@testing-library/jest-dom" />
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { CssBaseline } from '@mui/material'
import { ThemeProvider } from '@mui/material/styles'
import { MemoryRouter, useLocation } from 'react-router-dom'

import StudyMeshLanding from '../../../../src/components/landing/StudyMeshLanding'
import { createStudyMeshTheme } from '../../../../src/theme'

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
      if (
        this.getAttribute('data-testid') === 'hero-headline-wrap-probe'
      ) {
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
      screen.getByRole('heading', {
        name: /study guides that grow with you/i,
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        /studymesh builds adaptive study guides by connecting new concepts/i,
      ),
    ).toBeInTheDocument()
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
      screen.getByText(/choose what you already know, watch the explanation change/i),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /photography/i }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /gaming/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /tech/i })).toBeInTheDocument()
    expect(screen.getAllByText(/what is a trade-off/i).length).toBeGreaterThan(0)
    expect(
      screen.getByText(/improving one thing usually means giving up something else/i),
    ).toBeInTheDocument()
    expect(screen.getByText(/think of exposure settings/i)).toBeInTheDocument()
    expect(screen.getByText(/with photography context/i)).toBeInTheDocument()
    expect(
      screen.getByRole('link', {
        name: /read about ausubel's meaningful learning theory/i,
      }),
    ).toHaveAttribute(
      'href',
      'https://www.structural-learning.com/post/ausubels-meaningful-learning-theory-teachers-guide',
    )
    expect(
      screen.getByText(
        /The most important factor in learning is what the learner already knows/i,
      ),
    ).toBeInTheDocument()
    expect(screen.getByText(/one question/i))
      .toBeInTheDocument()
    expect(
      screen.getByRole('heading', {
        name: /your guide doesn't stop at page 5/i,
      }),
    ).toBeInTheDocument()
    expect(screen.getByText(/docker overview/i)).toBeInTheDocument()
    expect(screen.getByText(/images and layers/i)).toBeInTheDocument()
    expect(screen.getByText(/container lifecycle/i)).toBeInTheDocument()
    expect(screen.getByText(/writing dockerfiles/i)).toBeInTheDocument()
    expect(screen.getByText(/docker compose basics/i)).toBeInTheDocument()
    expect(screen.getAllByText(/review pack/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/^new$/i)).toBeInTheDocument()
    expect(
      screen.getByText(/can you add more practice exercises on this topic/i),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/done! i added/i),
    ).toBeInTheDocument()

    expect(getComputedStyle(screen.getByTestId('studymesh-landing')).color).toBe(
      'rgb(7, 17, 39)',
    )
  })

  it('switches knowledge context examples from the landing carousel', () => {
    renderLanding()

    expect(screen.getByText(/think of exposure settings/i)).toBeInTheDocument()
    expect(screen.getAllByText(/what is a trade-off/i).length).toBeGreaterThan(0)

    fireEvent.click(
      screen.getByRole('button', { name: /show next knowledge context/i }),
    )

    expect(screen.getByRole('button', { name: /gaming/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByText(/think of a character build/i)).toBeInTheDocument()
    expect(
      screen.getByText(/improving one thing usually means giving up something else/i),
    ).toBeInTheDocument()
  })

  it('auto-scrolls the knowledge context topic row near either edge', () => {
    renderLanding()

    const topicsRow = screen.getByLabelText(/knowledge context topics/i)
    const scrollBy = vi.fn()

    Object.defineProperties(topicsRow, {
      clientWidth: { configurable: true, value: 600 },
      scrollLeft: { configurable: true, value: 240, writable: true },
      scrollWidth: { configurable: true, value: 1200 },
    })
    Object.assign(topicsRow, { scrollBy })
    vi.spyOn(topicsRow, 'getBoundingClientRect').mockReturnValue({
      bottom: 120,
      height: 120,
      left: 100,
      right: 700,
      toJSON: () => ({}),
      top: 0,
      width: 600,
      x: 100,
      y: 0,
    })
    vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(1)

    fireEvent.pointerMove(topicsRow, { clientX: 690 })

    expect(scrollBy).toHaveBeenLastCalledWith({ behavior: 'auto', left: 6 })

    fireEvent.pointerMove(topicsRow, { clientX: 110 })

    expect(scrollBy).toHaveBeenLastCalledWith({ behavior: 'auto', left: -6 })
  })

  it('keeps the full hero underline when the second headline phrase fits on one line', async () => {
    mockHeroWrapProbeLines([100])
    renderLanding()

    await waitFor(() => {
      expect(screen.getByTestId('hero-headline-underline-host')).toHaveAttribute(
        'data-underline-mode',
        'full',
      )
    })
  })

  it('moves the hero underline to with you when the second headline phrase wraps', async () => {
    mockHeroWrapProbeLines([100, 158])
    renderLanding()

    await waitFor(() => {
      expect(screen.getByTestId('hero-headline-underline-host')).toHaveAttribute(
        'data-underline-mode',
        'wrapped',
      )
    })
    expect(screen.getByTestId('hero-headline-with-you')).toHaveTextContent(
      'with you.',
    )
  })

  it('keeps the study guide CTA target unchanged', () => {
    renderLanding()

    fireEvent.click(
      screen.getAllByRole('button', { name: /create a study guide/i })[0],
    )

    expect(screen.getByTestId('location')).toHaveTextContent(
      '/study-guides?create=1',
    )
  })
})
