import React from 'react'
import { createEvent, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import StudyGuidePagesPanel from '../../../../src/components/Dasboard/StudyGuidePagesPanel'
import type { StudyPathContainerState } from '../../../../src/state/store'

const deleteHostedAiPodcastAudioMock = vi.hoisted(() => vi.fn())

vi.mock('../../../../src/quickCreate/ai', () => ({
  deleteHostedAiPodcastAudio: deleteHostedAiPodcastAudioMock,
}))

const createStudyPath = (): StudyPathContainerState => ({
  pathId: 'guide-1',
  title: 'Biology',
  folderName: 'Biology',
  selectedIndex: 1,
  dashboards: [
    {
      name: 'Core lesson',
      layout: { type: 'row' },
      dashboardKey: 'core',
      dashboardIndex: 1,
      dashboardCount: 3,
      folderName: 'Biology',
      createdBy: 'generator',
      deletable: false,
    },
    {
      name: '02 - Manual note',
      layout: { type: 'row' },
      dashboardKey: 'manual',
      dashboardIndex: 2,
      dashboardCount: 3,
      folderName: 'Biology',
      createdBy: 'manual',
      deletable: true,
    },
    {
      name: '03 - Quiz',
      layout: { type: 'row' },
      dashboardKey: 'quiz',
      dashboardIndex: 3,
      dashboardCount: 3,
      folderName: 'Biology',
      createdBy: 'quickCreate',
      deletable: true,
    },
  ],
})

const createStudyPathWithPodcastPage = (): StudyPathContainerState => {
  const studyPath = createStudyPath()
  return {
    ...studyPath,
    dashboards: studyPath.dashboards.map((page) =>
      page.dashboardKey === 'manual'
        ? {
            ...page,
            layout: {
              type: 'row',
              config: {
                customProps: {
                  components: [
                    {
                      id: 'podcast-player',
                      type: 'PodcastBlock',
                      props: {
                        podcast: {
                          audioPath:
                            'user-1/guide-1/podcast-audio-to-delete.mp3',
                        },
                      },
                    },
                  ],
                },
              },
            },
          }
        : page,
    ),
  }
}

const createDataTransfer = (index: number) => ({
  effectAllowed: 'none',
  dropEffect: 'none',
  setData: vi.fn(),
  getData: vi.fn(() => String(index)),
})

const setPageRowRects = () => {
  screen.getAllByTestId(/^study-guide-page-row-/).forEach((row, index) => {
    vi.spyOn(row, 'getBoundingClientRect').mockReturnValue({
      top: 100 + index * 100,
      bottom: 160 + index * 100,
      left: 0,
      right: 240,
      width: 240,
      height: 60,
      x: 0,
      y: 100 + index * 100,
      toJSON: () => ({}),
    })
  })
}

const dragOverAt = (
  element: HTMLElement,
  clientY: number,
  dataTransfer: ReturnType<typeof createDataTransfer>,
) => {
  const event = createEvent.dragOver(element, { dataTransfer })
  Object.defineProperty(event, 'clientY', { value: clientY })
  fireEvent(element, event)
}

const dropAt = (
  element: HTMLElement,
  clientY: number,
  dataTransfer: ReturnType<typeof createDataTransfer>,
) => {
  const event = createEvent.drop(element, { dataTransfer })
  Object.defineProperty(event, 'clientY', { value: clientY })
  fireEvent(element, event)
}

describe('StudyGuidePagesPanel', () => {
  beforeEach(() => {
    deleteHostedAiPodcastAudioMock.mockReset()
    deleteHostedAiPodcastAudioMock.mockResolvedValue(undefined)
  })

  it('collapses, opens, selects pages, and only exposes deletable trash actions', () => {
    const onStudyPathChange = vi.fn()

    render(
      <StudyGuidePagesPanel
        studyPath={createStudyPath()}
        onStudyPathChange={onStudyPathChange}
        variant="desktop"
      />,
    )

    expect(
      screen.queryByLabelText('Delete page: Core lesson'),
    ).not.toBeInTheDocument()
    expect(
      screen.getByLabelText('Delete page: Manual note'),
    ).toBeInTheDocument()
    expect(screen.queryByText('03 - Quiz')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /^03 Quiz$/ }))
    expect(onStudyPathChange).toHaveBeenCalledWith(
      expect.objectContaining({ selectedIndex: 2 }),
    )

    fireEvent.click(screen.getByLabelText('Close Pages panel'))
    expect(screen.getByLabelText('Open Pages panel')).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('Open Pages panel'))
    expect(
      screen.getByTestId('study-guide-pages-panel-desktop'),
    ).toBeInTheDocument()
  })

  it('uses the full panel as a drop target and inserts before the nearest row', () => {
    const onStudyPathChange = vi.fn()
    const dataTransfer = createDataTransfer(2)

    render(
      <StudyGuidePagesPanel
        studyPath={createStudyPath()}
        onStudyPathChange={onStudyPathChange}
        variant="desktop"
      />,
    )
    setPageRowRects()
    const panel = screen.getByTestId('study-guide-pages-panel-desktop')

    fireEvent.dragStart(screen.getByLabelText('Drag page to reorder: Quiz'), {
      dataTransfer,
    })
    dragOverAt(panel, 80, dataTransfer)
    expect(screen.getByTestId('study-guide-page-row-0')).toHaveAttribute(
      'data-drop-before',
      'true',
    )
    dropAt(panel, 80, dataTransfer)

    const nextStudyPath = onStudyPathChange.mock.calls[0][0]
    expect(
      nextStudyPath.dashboards.map(
        (page: { dashboardKey: string }) => page.dashboardKey,
      ),
    ).toEqual(['quiz', 'core', 'manual'])
    expect(
      nextStudyPath.dashboards[nextStudyPath.selectedIndex].dashboardKey,
    ).toBe('manual')
    expect(screen.getByTestId('study-guide-page-row-0')).not.toHaveAttribute(
      'data-drop-before',
    )
  })

  it('accepts footer drops and adjusts downward insertion indexes', () => {
    const onStudyPathChange = vi.fn()
    const dataTransfer = createDataTransfer(0)

    render(
      <StudyGuidePagesPanel
        studyPath={createStudyPath()}
        onStudyPathChange={onStudyPathChange}
        variant="desktop"
      />,
    )
    setPageRowRects()
    const panel = screen.getByTestId('study-guide-pages-panel-desktop')

    fireEvent.dragStart(
      screen.getByLabelText('Drag page to reorder: Core lesson'),
      {
        dataTransfer,
      },
    )
    dragOverAt(panel, 500, dataTransfer)
    expect(screen.getByTestId('study-guide-page-end-slot')).toHaveAttribute(
      'data-drop-active',
      'true',
    )
    dropAt(panel, 500, dataTransfer)

    expect(
      onStudyPathChange.mock.calls[0][0].dashboards.map(
        (page: { dashboardKey: string }) => page.dashboardKey,
      ),
    ).toEqual(['manual', 'quiz', 'core'])
  })

  it('clears insertion state when drag ends without dropping', () => {
    const dataTransfer = createDataTransfer(1)

    render(
      <StudyGuidePagesPanel
        studyPath={createStudyPath()}
        onStudyPathChange={vi.fn()}
        variant="desktop"
      />,
    )
    setPageRowRects()
    const handle = screen.getByLabelText('Drag page to reorder: Manual note')
    const row = screen.getByTestId('study-guide-page-row-1')

    fireEvent.dragStart(handle, { dataTransfer })
    dragOverAt(
      screen.getByTestId('study-guide-pages-panel-desktop'),
      190,
      dataTransfer,
    )
    expect(row).toHaveAttribute('data-drop-before', 'true')

    fireEvent.dragEnd(handle, { dataTransfer })
    expect(row).not.toHaveAttribute('data-drop-before')
  })

  it('resizes the desktop Pages panel from its right border', () => {
    render(
      <StudyGuidePagesPanel
        studyPath={createStudyPath()}
        onStudyPathChange={vi.fn()}
        variant="desktop"
      />,
    )
    const panel = screen.getByTestId('study-guide-pages-panel-desktop')

    fireEvent.mouseDown(screen.getByLabelText('Resize Pages panel'), {
      clientX: 248,
    })
    fireEvent.mouseMove(window, { clientX: 348 })
    fireEvent.mouseUp(window)

    expect(panel).toHaveStyle({ width: '348px' })
  })

  it('uses arrows on mobile and supports immediate delete and Add Page', () => {
    const onStudyPathChange = vi.fn()
    const onAddPage = vi.fn()

    render(
      <StudyGuidePagesPanel
        studyPath={createStudyPath()}
        onStudyPathChange={onStudyPathChange}
        onAddPage={onAddPage}
        variant="mobile"
      />,
    )

    expect(
      screen.queryByLabelText('Drag page to reorder: Quiz'),
    ).not.toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('Move page up: Quiz'))
    expect(onStudyPathChange.mock.calls[0][0].dashboards[1].dashboardKey).toBe(
      'quiz',
    )

    fireEvent.click(screen.getByLabelText('Delete page: Manual note'))
    expect(onStudyPathChange.mock.calls[1][0].dashboards).toHaveLength(2)

    fireEvent.click(screen.getByRole('button', { name: 'Add Page' }))
    expect(onAddPage).toHaveBeenCalledOnce()
  })

  it('requests podcast audio deletion when a podcast page is deleted', () => {
    const onStudyPathChange = vi.fn()

    render(
      <StudyGuidePagesPanel
        studyPath={createStudyPathWithPodcastPage()}
        onStudyPathChange={onStudyPathChange}
        variant="mobile"
      />,
    )

    fireEvent.click(screen.getByLabelText('Delete page: Manual note'))

    expect(deleteHostedAiPodcastAudioMock).toHaveBeenCalledWith(
      'user-1/guide-1/podcast-audio-to-delete.mp3',
    )
    expect(onStudyPathChange.mock.calls[0][0].dashboards).toHaveLength(2)
  })
})

describe('StudyGuidePagesPanel growth', () => {
  const createGrowableStudyPath = (): StudyPathContainerState => {
    const studyPath = createStudyPath()
    return {
      ...studyPath,
      selectedIndex: 0,
      plannedLessons: [
        { title: 'Cell signalling', summary: 'Trace one signal end to end.' },
      ],
      // Depth-first order: a dug-out page sits directly behind its parent.
      dashboards: [
        studyPath.dashboards[0],
        {
          name: 'Why membranes leak',
          layout: { type: 'row' },
          dashboardKey: 'dug-out',
          dashboardIndex: 2,
          dashboardCount: 4,
          folderName: 'Biology',
          createdBy: 'expanded',
          deletable: true,
          parentPageKey: 'core',
        },
        ...studyPath.dashboards.slice(1),
      ],
    }
  }

  it('numbers a dug-out page under its parent', () => {
    render(
      <StudyGuidePagesPanel
        studyPath={createGrowableStudyPath()}
        onStudyPathChange={vi.fn()}
        variant="desktop"
      />,
    )

    expect(
      screen.getByRole('button', { name: /^01\.1 Why membranes leak$/ }),
    ).toBeInTheDocument()
  })

  it('shows a page as a root page once it no longer sits under its parent', () => {
    const studyPath = createGrowableStudyPath()

    render(
      <StudyGuidePagesPanel
        studyPath={{
          ...studyPath,
          dashboards: [
            studyPath.dashboards[0],
            ...studyPath.dashboards.slice(2),
            studyPath.dashboards[1],
          ],
        }}
        onStudyPathChange={vi.fn()}
        variant="desktop"
      />,
    )

    expect(
      screen.getByRole('button', { name: /^04 Why membranes leak$/ }),
    ).toBeInTheDocument()
  })

  it('offers continuing the guide, digging into the page, and a blank page', () => {
    const onGrowPage = vi.fn()
    const onAddPage = vi.fn()

    render(
      <StudyGuidePagesPanel
        studyPath={createGrowableStudyPath()}
        onStudyPathChange={vi.fn()}
        onAddPage={onAddPage}
        onGrowPage={onGrowPage}
        growPageCreditCost={1}
        variant="desktop"
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Add Page' }))

    expect(screen.getByText('Next: Cell signalling')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('study-guide-add-page-continue'))
    expect(onGrowPage).toHaveBeenCalledWith({
      kind: 'continue',
      lesson: {
        title: 'Cell signalling',
        summary: 'Trace one signal end to end.',
      },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Add Page' }))
    fireEvent.click(screen.getByRole('button', { name: /Blank page/ }))
    expect(onAddPage).toHaveBeenCalled()
  })

  it('grows a page from a written prompt and keeps the button disabled until then', () => {
    const onGrowPage = vi.fn()

    render(
      <StudyGuidePagesPanel
        studyPath={createGrowableStudyPath()}
        onStudyPathChange={vi.fn()}
        onGrowPage={onGrowPage}
        variant="desktop"
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Add Page' }))
    const submit = screen.getByRole('button', { name: /Create page/ })
    expect(submit).toBeDisabled()

    fireEvent.change(
      screen.getByPlaceholderText('What should the new page cover?'),
      { target: { value: 'How ion channels open' } },
    )
    fireEvent.click(screen.getByRole('button', { name: /Create page/ }))

    // No source page: a page the reader asked for by name is a lesson of its
    // own and goes last, not into the open page's branch.
    expect(onGrowPage).toHaveBeenCalledWith({
      kind: 'prompt',
      prompt: 'How ion channels open',
    })
  })

  it('shows every page being written and stays open for more', () => {
    render(
      <StudyGuidePagesPanel
        studyPath={createGrowableStudyPath()}
        onStudyPathChange={vi.fn()}
        onGrowPage={vi.fn()}
        growingPages={[
          {
            id: 'grow-1',
            label: 'Cell signalling',
            startedAt: Date.now(),
            lessonTitle: 'Cell signalling',
          },
          {
            id: 'grow-2',
            label: 'How ion channels open',
            startedAt: Date.now(),
          },
        ]}
        variant="desktop"
      />,
    )

    const progress = screen.getAllByTestId('study-guide-growing-page')

    expect(progress).toHaveLength(2)
    expect(progress[0]).toHaveTextContent('Writing the new page...')
    expect(progress[0]).toHaveTextContent('Cell signalling')
    expect(progress[1]).toHaveTextContent('How ion channels open')
    // Several pages can be queued at once, so the button never locks.
    expect(screen.getByRole('button', { name: 'Add Page' })).not.toBeDisabled()
  })

  it('does not offer a planned lesson that is already being written', () => {
    render(
      <StudyGuidePagesPanel
        studyPath={createGrowableStudyPath()}
        onStudyPathChange={vi.fn()}
        onGrowPage={vi.fn()}
        growingPages={[
          {
            id: 'grow-1',
            label: 'Cell signalling',
            startedAt: Date.now(),
            lessonTitle: 'Cell signalling',
          },
        ]}
        variant="desktop"
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Add Page' }))

    expect(
      screen.queryByTestId('study-guide-add-page-continue'),
    ).not.toBeInTheDocument()
  })

  it('keeps the old blank-page behaviour when growth is not wired up', () => {
    const onAddPage = vi.fn()

    render(
      <StudyGuidePagesPanel
        studyPath={createGrowableStudyPath()}
        onStudyPathChange={vi.fn()}
        onAddPage={onAddPage}
        variant="desktop"
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Add Page' }))

    expect(onAddPage).toHaveBeenCalled()
    expect(
      screen.queryByTestId('study-guide-add-page-menu'),
    ).not.toBeInTheDocument()
  })
})
