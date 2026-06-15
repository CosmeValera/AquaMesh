import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  CompanionPanel,
  StudyToolsProvider,
  useStudyTools,
} from '../../../../src/components/studyTools'

const Probe = () => {
  const { activeMode, state } = useStudyTools()
  return (
    <>
      <output aria-label="active mode">{activeMode}</output>
      <output aria-label="tools state">{JSON.stringify(state)}</output>
      <CompanionPanel aiChat={<div>Dashboard AI</div>} onClose={vi.fn()} />
    </>
  )
}

describe('Companion and study tools workflows', () => {
  beforeEach(() => {
    vi.mocked(window.localStorage.getItem).mockReturnValue(null)
    vi.mocked(window.localStorage.setItem).mockImplementation(() => undefined)
  })

  const switchMode = async (name: string) => {
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Switch Companion mode' }))
    await user.click(screen.getByRole('menuitem', { name: new RegExp(name, 'i') }))
    return user
  }

  it('defaults to AI Chat and switches to Quick Capture', async () => {
    render(
      <StudyToolsProvider>
        <Probe />
      </StudyToolsProvider>,
    )

    expect(screen.getByLabelText('active mode')).toHaveTextContent('ai-chat')
    const user = await switchMode('Quick Capture')
    await user.type(screen.getByPlaceholderText('Message yourself...'), 'Remember this')
    await user.click(screen.getByRole('button', { name: 'Save quick capture' }))

    const state = JSON.parse(screen.getByLabelText('tools state').textContent || '{}')
    expect(screen.getByLabelText('active mode')).toHaveTextContent('quick-capture')
    expect(state.quickCapture.messages[0].content).toBe('Remember this')
  })

  it('edits Canvas in the panel and maximizes the same Canvas instance', async () => {
    render(
      <StudyToolsProvider>
        <Probe />
      </StudyToolsProvider>,
    )

    const user = await switchMode('Canvas')
    await user.click(screen.getAllByRole('button', { name: 'Add note' })[0])
    await user.type(screen.getByPlaceholderText('Write on this card...'), 'abc')
    await user.click(screen.getByRole('button', { name: 'Maximize Canvas' }))

    expect(screen.getByRole('button', { name: 'Restore Canvas to Study Tools' })).toBeInTheDocument()
    const state = JSON.parse(screen.getByLabelText('tools state').textContent || '{}')
    expect(state.canvas.items[0].content).toBe('abc')
  })
})
