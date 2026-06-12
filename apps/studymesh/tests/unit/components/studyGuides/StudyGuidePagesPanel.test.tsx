import React from 'react'
import { createEvent, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import StudyGuidePagesPanel from '../../../../src/components/Dasboard/StudyGuidePagesPanel'
import type { StudyPathContainerState } from '../../../../src/state/store'

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
      name: 'Manual note',
      layout: { type: 'row' },
      dashboardKey: 'manual',
      dashboardIndex: 2,
      dashboardCount: 3,
      folderName: 'Biology',
      createdBy: 'manual',
      deletable: true,
    },
    {
      name: 'Quiz',
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
      screen.queryByLabelText('Delete Core lesson'),
    ).not.toBeInTheDocument()
    expect(screen.getByLabelText('Delete Manual note')).toBeInTheDocument()

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

    fireEvent.dragStart(screen.getByLabelText('Drag Quiz to reorder'), {
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

    fireEvent.dragStart(screen.getByLabelText('Drag Core lesson to reorder'), {
      dataTransfer,
    })
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
    const handle = screen.getByLabelText('Drag Manual note to reorder')
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
      screen.queryByLabelText('Drag Quiz to reorder'),
    ).not.toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('Move Quiz up'))
    expect(onStudyPathChange.mock.calls[0][0].dashboards[1].dashboardKey).toBe(
      'quiz',
    )

    fireEvent.click(screen.getByLabelText('Delete Manual note'))
    expect(onStudyPathChange.mock.calls[1][0].dashboards).toHaveLength(2)

    fireEvent.click(screen.getByRole('button', { name: 'Add Page' }))
    expect(onAddPage).toHaveBeenCalledOnce()
  })
})
