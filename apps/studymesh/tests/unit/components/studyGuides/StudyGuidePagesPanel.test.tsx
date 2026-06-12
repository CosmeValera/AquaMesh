import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
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

  it('reorders pages by drag on desktop', () => {
    const onStudyPathChange = vi.fn()
    const dataTransfer = {
      effectAllowed: 'none',
      dropEffect: 'none',
      setData: vi.fn(),
      getData: vi.fn(() => '2'),
    }

    render(
      <StudyGuidePagesPanel
        studyPath={createStudyPath()}
        onStudyPathChange={onStudyPathChange}
        variant="desktop"
      />,
    )

    fireEvent.dragStart(screen.getByLabelText('Drag Quiz to reorder'), {
      dataTransfer,
    })
    fireEvent.drop(
      screen.getByRole('button', { name: /^01 Core lesson$/ }).parentElement!,
      {
        dataTransfer,
      },
    )

    const nextStudyPath = onStudyPathChange.mock.calls[0][0]
    expect(
      nextStudyPath.dashboards.map(
        (page: { dashboardKey: string }) => page.dashboardKey,
      ),
    ).toEqual(['quiz', 'core', 'manual'])
    expect(
      nextStudyPath.dashboards[nextStudyPath.selectedIndex].dashboardKey,
    ).toBe('manual')
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
