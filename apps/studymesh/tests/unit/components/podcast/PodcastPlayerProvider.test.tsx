import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  PodcastPlayerProvider,
  isStaticPodcastAudioPath,
} from '../../../../src/components/podcast/PodcastPlayerProvider'
import StudyBlockView from '../../../../src/components/study/StudyBlockView'
import { getHostedAiPodcastAudioUrl } from '../../../../src/quickCreate/ai'

vi.mock('../../../../src/quickCreate/ai', () => ({
  getHostedAiPodcastAudioUrl: vi.fn(),
}))

const createPodcast = (title = 'Podcast: Biology') => ({
  id: 'podcast-1',
  title,
  description: 'Short recap.',
  audioPath: `user-1/guide-1/${title.toLowerCase().replace(/\W+/g, '-')}.mp3`,
  mimeType: 'audio/mpeg',
  transcriptTurns: [{ speaker: 'hostA', text: 'Welcome.' }],
  chapters: [],
  sourceTitle: 'Biology',
  sourceScope: 'currentPage',
  createdAt: '2026-01-01T00:00:00.000Z',
})

const renderPodcastBlock = (podcast = createPodcast()) =>
  render(
    <MemoryRouter initialEntries={['/workspace/guide-1']}>
      <PodcastPlayerProvider>
        <StudyBlockView type="PodcastBlock" props={{ podcast }} />
      </PodcastPlayerProvider>
    </MemoryRouter>,
  )

describe('PodcastPlayerProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getHostedAiPodcastAudioUrl).mockResolvedValue(
      'https://audio.test/podcast.mp3',
    )
    vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockResolvedValue()
    vi.spyOn(window.HTMLMediaElement.prototype, 'pause').mockImplementation(
      () => undefined,
    )
  })

  it('autoplays the page podcast player after loading', async () => {
    renderPodcastBlock()

    expect(screen.getByTestId('podcast-page-player')).toBeVisible()
    expect(screen.getAllByText('Podcast: Biology').length).toBeGreaterThan(0)
    await waitFor(() => {
      expect(getHostedAiPodcastAudioUrl).toHaveBeenCalledWith(
        'user-1/guide-1/podcast-biology.mp3',
      )
    })
    expect(screen.queryByTestId('floating-podcast-player')).not.toBeInTheDocument()
    await waitFor(() => {
      expect(window.HTMLMediaElement.prototype.play).toHaveBeenCalled()
    })
  })

  it('opens a synced mini-player from the page player', async () => {
    renderPodcastBlock()

    await waitFor(() => {
      expect(getHostedAiPodcastAudioUrl).toHaveBeenCalled()
    })
    fireEvent.click(screen.getByRole('button', { name: 'Open player' }))

    expect(screen.getByTestId('floating-podcast-player')).toBeVisible()
    expect(screen.getAllByText('Podcast: Biology').length).toBeGreaterThan(1)
    expect(screen.getByText('Playing in mini player')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Bring player here' })).toBeVisible()
    expect(
      within(screen.getByTestId('podcast-page-player')).queryByRole('button', {
        name: 'Play',
      }),
    ).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Play' }))
    await waitFor(() => {
      expect(window.HTMLMediaElement.prototype.play).toHaveBeenCalled()
    })
  })

  it('brings the mini-player controls back to the page without stopping', async () => {
    renderPodcastBlock()

    await waitFor(() => {
      expect(getHostedAiPodcastAudioUrl).toHaveBeenCalled()
    })
    fireEvent.click(screen.getByRole('button', { name: 'Open player' }))
    expect(screen.getByTestId('floating-podcast-player')).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: 'Bring player here' }))

    expect(screen.queryByTestId('floating-podcast-player')).not.toBeInTheDocument()
    expect(
      within(screen.getByTestId('podcast-page-player')).getByRole('button', {
        name: 'Play',
      }),
    ).toBeVisible()
    expect(window.HTMLMediaElement.prototype.pause).not.toHaveBeenCalled()
  })

  it('keeps the floating podcast player after the podcast block unmounts', async () => {
    const podcast = createPodcast('Podcast: Chemistry')
    const { rerender } = renderPodcastBlock(podcast)

    await waitFor(() => {
      expect(getHostedAiPodcastAudioUrl).toHaveBeenCalled()
    })
    fireEvent.click(screen.getByRole('button', { name: 'Open player' }))
    expect(await screen.findByTestId('floating-podcast-player')).toBeVisible()

    rerender(
      <MemoryRouter initialEntries={['/workspace/guide-1']}>
        <PodcastPlayerProvider>
          <StudyBlockView
            type="StudyNoteBlock"
            props={{ title: 'Other page', text: 'Keep studying.' }}
          />
        </PodcastPlayerProvider>
      </MemoryRouter>,
    )

    expect(screen.getByTestId('floating-podcast-player')).toBeVisible()
    expect(screen.getByText('Podcast: Chemistry')).toBeInTheDocument()
  })

  it('hides the mini-player without stopping while the page player is mounted', async () => {
    renderPodcastBlock(createPodcast('Podcast: History'))

    await waitFor(() => {
      expect(getHostedAiPodcastAudioUrl).toHaveBeenCalled()
    })
    fireEvent.click(screen.getByRole('button', { name: 'Open player' }))
    expect(await screen.findByTestId('floating-podcast-player')).toBeVisible()

    fireEvent.click(
      screen.getByRole('button', { name: 'Close podcast player' }),
    )

    expect(screen.queryByTestId('floating-podcast-player')).not.toBeInTheDocument()
    expect(screen.getByTestId('podcast-page-player')).toBeVisible()
    expect(
      within(screen.getByTestId('podcast-page-player')).getByRole('button', {
        name: 'Play',
      }),
    ).toBeVisible()
    expect(window.HTMLMediaElement.prototype.pause).not.toHaveBeenCalled()
  })

  it('auto-claims a new podcast page when no mini-player is pinned', async () => {
    const firstPodcast = createPodcast('Podcast: Biology')
    const secondPodcast = createPodcast('Podcast: Algebra')
    const { rerender } = renderPodcastBlock(firstPodcast)

    await waitFor(() => {
      expect(getHostedAiPodcastAudioUrl).toHaveBeenCalledWith(
        'user-1/guide-1/podcast-biology.mp3',
      )
    })

    rerender(
      <MemoryRouter initialEntries={['/workspace/guide-1']}>
        <PodcastPlayerProvider>
          <StudyBlockView type="PodcastBlock" props={{ podcast: secondPodcast }} />
        </PodcastPlayerProvider>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(getHostedAiPodcastAudioUrl).toHaveBeenCalledWith(
        'user-1/guide-1/podcast-algebra.mp3',
      )
    })
    expect(screen.queryByTestId('floating-podcast-player')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Switch to this podcast' }),
    ).not.toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Open player' })).toBeEnabled()
    })
  })

  it('lets the mini-player move around the viewport', async () => {
    const rectSpy = vi.spyOn(
      window.HTMLElement.prototype,
      'getBoundingClientRect',
    )
    rectSpy.mockReturnValue({
      x: 100,
      y: 100,
      left: 100,
      top: 100,
      right: 480,
      bottom: 300,
      width: 380,
      height: 200,
      toJSON: () => ({}),
    } as DOMRect)
    renderPodcastBlock()

    await waitFor(() => {
      expect(getHostedAiPodcastAudioUrl).toHaveBeenCalled()
    })
    fireEvent.click(screen.getByRole('button', { name: 'Open player' }))
    const miniPlayer = screen.getByTestId('floating-podcast-player')
    const dragHandle = screen.getByRole('button', {
      name: 'Move podcast player',
    })

    const downEvent = new Event('pointerdown', { bubbles: true })
    Object.defineProperties(downEvent, {
      button: { value: 0 },
      clientX: { value: 200 },
      clientY: { value: 150 },
      pointerId: { value: 1 },
      pointerType: { value: 'mouse' },
    })
    fireEvent(dragHandle, downEvent)
    await waitFor(() => {
      expect(miniPlayer).toHaveStyle({ left: '100px', top: '100px' })
    })
    const moveEvent = new Event('pointermove', { bubbles: true })
    Object.defineProperties(moveEvent, {
      clientX: { value: 260 },
      clientY: { value: 190 },
      pointerId: { value: 1 },
      pointerType: { value: 'mouse' },
    })
    fireEvent(dragHandle, moveEvent)
    fireEvent.pointerUp(dragHandle, { pointerId: 1, pointerType: 'mouse' })

    expect(miniPlayer).toHaveStyle({ left: '160px', top: '140px' })
    rectSpy.mockRestore()
  })

  it('stops after closing the mini-player when no page player remains', async () => {
    const podcast = createPodcast('Podcast: History')
    const { rerender } = renderPodcastBlock(podcast)

    await waitFor(() => {
      expect(getHostedAiPodcastAudioUrl).toHaveBeenCalled()
    })
    fireEvent.click(screen.getByRole('button', { name: 'Open player' }))
    expect(await screen.findByTestId('floating-podcast-player')).toBeVisible()

    rerender(
      <MemoryRouter initialEntries={['/workspace/guide-1']}>
        <PodcastPlayerProvider>
          <StudyBlockView
            type="StudyNoteBlock"
            props={{ title: 'Other page', text: 'Keep studying.' }}
          />
        </PodcastPlayerProvider>
      </MemoryRouter>,
    )

    fireEvent.click(
      screen.getByRole('button', { name: 'Close podcast player' }),
    )

    await waitFor(() => {
      expect(window.HTMLMediaElement.prototype.pause).toHaveBeenCalled()
    })
    expect(screen.queryByTestId('floating-podcast-player')).not.toBeInTheDocument()
  })

  it('preserves the current mini-player and prepares a different podcast page', async () => {
    const firstPodcast = createPodcast('Podcast: Biology')
    const secondPodcast = createPodcast('Podcast: Algebra')
    const { rerender } = renderPodcastBlock(firstPodcast)

    await waitFor(() => {
      expect(getHostedAiPodcastAudioUrl).toHaveBeenCalledTimes(1)
    })
    fireEvent.click(screen.getByRole('button', { name: 'Open player' }))

    rerender(
      <MemoryRouter initialEntries={['/workspace/guide-1']}>
        <PodcastPlayerProvider>
          <StudyBlockView type="PodcastBlock" props={{ podcast: secondPodcast }} />
        </PodcastPlayerProvider>
      </MemoryRouter>,
    )

    expect(screen.getByTestId('floating-podcast-player')).toBeVisible()
    expect(screen.getByTestId('floating-podcast-player')).toHaveTextContent(
      'Podcast: Biology',
    )
    expect(
      screen.getByRole('button', { name: 'Switch to this podcast' }),
    ).toBeVisible()
    await waitFor(() => {
      expect(getHostedAiPodcastAudioUrl).toHaveBeenCalledWith(
        'user-1/guide-1/podcast-algebra.mp3',
      )
    })
  })
})

describe('static demo podcast audio', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getHostedAiPodcastAudioUrl).mockResolvedValue(
      'https://audio.test/podcast.mp3',
    )
    vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockResolvedValue()
    vi.spyOn(window.HTMLMediaElement.prototype, 'pause').mockImplementation(
      () => undefined,
    )
  })

  it('matches only the demo audio prefix', () => {
    expect(isStaticPodcastAudioPath('/demo/audio/why-you-forget.mp3')).toBe(true)
    expect(
      isStaticPodcastAudioPath(
        '2f1b8a6c-1c2f-4c6e-9a1d-0b7d6f3e5a11/guide-1/podcast-1.mp3',
      ),
    ).toBe(false)
    expect(isStaticPodcastAudioPath('/')).toBe(false)
    expect(isStaticPodcastAudioPath('/demo/audio')).toBe(false)
    expect(isStaticPodcastAudioPath('demo/audio/why-you-forget.mp3')).toBe(false)
    expect(
      isStaticPodcastAudioPath('http://example.com/demo/audio/clip.mp3'),
    ).toBe(false)
    expect(isStaticPodcastAudioPath('blob:/demo/audio/clip.mp3')).toBe(false)
    expect(isStaticPodcastAudioPath('data:audio/mpeg;base64,AAAA')).toBe(false)
  })

  it('plays a static demo path without asking the gateway to sign it', async () => {
    const podcast = {
      ...createPodcast('Podcast: Why you forget'),
      audioPath: '/demo/audio/why-you-forget.mp3',
    }
    const { container } = renderPodcastBlock(podcast)

    await waitFor(() => {
      expect(container.querySelector('audio')).toHaveAttribute(
        'src',
        '/demo/audio/why-you-forget.mp3',
      )
    })
    expect(getHostedAiPodcastAudioUrl).not.toHaveBeenCalled()
    await waitFor(() => {
      expect(
        within(screen.getByTestId('podcast-page-player')).getByRole('button', {
          name: 'Play',
        }),
      ).toBeEnabled()
    })
    expect(getHostedAiPodcastAudioUrl).not.toHaveBeenCalled()
  })

  it('still signs a real podcast audio path exactly once', async () => {
    renderPodcastBlock(createPodcast('Podcast: Biology'))

    await waitFor(() => {
      expect(getHostedAiPodcastAudioUrl).toHaveBeenCalledTimes(1)
    })
    expect(getHostedAiPodcastAudioUrl).toHaveBeenCalledWith(
      'user-1/guide-1/podcast-biology.mp3',
    )
  })
})
