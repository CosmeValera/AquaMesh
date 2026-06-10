import React from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import WidgetManagementModal from '../../../../src/components/WidgetEditor/components/dialogs/WidgetLibrary'
import { CustomWidget } from '../../../../src/components/WidgetEditor/WidgetStorage'

const createWidget = (
  id: string,
  name: string,
  category = 'Quick Create',
): CustomWidget => ({
  id,
  name,
  category,
  components: [
    {
      id: `${id}-label`,
      type: 'Label',
      props: { text: name },
    },
  ],
  createdAt: '2026-05-19T10:00:00.000Z',
  updatedAt: '2026-05-19T10:00:00.000Z',
  tags: [],
  description: '',
  version: '1.0',
  author: 'StudyMesh',
})

describe('WidgetLibrary bulk actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('lets users choose which saved widgets delete all removes', async () => {
    const onDelete = vi.fn()
    const widgets = [
      createWidget('study-1', 'Vocabulary Cards', 'Quick Create'),
      createWidget('study-2', 'Grammar Quiz', 'Quick Create'),
      createWidget('chart-1', 'Progress Chart', 'Dashboard'),
    ]

    render(
      <WidgetManagementModal
        open
        onClose={vi.fn()}
        widgets={widgets}
        onPreview={vi.fn()}
        onEdit={vi.fn()}
        onDelete={onDelete}
      />,
    )

    expect(screen.getByText('Vocabulary Cards')).toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', { name: /delete all saved widgets/i }),
    )

    const deleteDialog = await screen.findByRole('dialog', {
      name: /delete all saved widgets/i,
    })
    expect(within(deleteDialog).getByText('Quick Create')).toBeInTheDocument()
    expect(within(deleteDialog).getByText('Dashboard')).toBeInTheDocument()
    expect(
      within(deleteDialog).getByText('Vocabulary Cards'),
    ).toBeInTheDocument()

    fireEvent.click(
      within(deleteDialog).getByRole('checkbox', {
        name: /select grammar quiz/i,
      }),
    )
    fireEvent.click(
      within(deleteDialog).getByRole('button', { name: /delete selected/i }),
    )

    expect(onDelete).toHaveBeenCalledTimes(2)
    expect(onDelete).toHaveBeenCalledWith('study-1')
    expect(onDelete).toHaveBeenCalledWith('chart-1')
    expect(onDelete).not.toHaveBeenCalledWith('study-2')
  })
})
