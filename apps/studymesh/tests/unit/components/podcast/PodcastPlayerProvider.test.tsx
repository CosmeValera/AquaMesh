import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { PodcastPlayerProvider } from '../../../../src/components/podcast/PodcastPlayerProvider'
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
    vi.mocked(getHostedAiPodcastAudioUrl).mockResolvedValue(
      'https://audio.test/podcast.mp3',
    )
    vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockResolvedValue()
    vi.spyOn(window.HTMLMediaElement.prototype, 'pause').mockImplementation(
      () => undefined,
    )
  })

  it('opens podcasts in the floating player', async () => {
    renderPodcastBlock()

    fireEvent.click(screen.getByRole('button', { name: 'Listen' }))

    expect(await screen.findByTestId('floating-podcast-player')).toBeVisible()
    expect(screen.getAllByText('Podcast: Biology').length).toBeGreaterThan(0)
    await waitFor(() => {
      expect(getHostedAiPodcastAudioUrl).toHaveBeenCalledWith(
        'user-1/guide-1/podcast-biology.mp3',
      )
    })
    await waitFor(() => {
      expect(window.HTMLMediaElement.prototype.play).toHaveBeenCalled()
    })
  })

  it('keeps the floating podcast player after the podcast block unmounts', async () => {
    const podcast = createPodcast('Podcast: Chemistry')
    const { rerender } = renderPodcastBlock(podcast)

    fireEvent.click(screen.getByRole('button', { name: 'Listen' }))
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

  it('closes the floating podcast player', async () => {
    renderPodcastBlock(createPodcast('Podcast: History'))

    fireEvent.click(screen.getByRole('button', { name: 'Listen' }))
    expect(await screen.findByTestId('floating-podcast-player')).toBeVisible()

    fireEvent.click(
      screen.getByRole('button', { name: 'Close podcast player' }),
    )

    expect(screen.queryByTestId('floating-podcast-player')).not.toBeInTheDocument()
    expect(window.HTMLMediaElement.prototype.pause).toHaveBeenCalled()
  })
})
