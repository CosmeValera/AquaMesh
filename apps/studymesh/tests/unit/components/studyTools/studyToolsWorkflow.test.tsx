import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  StudyToolsProvider,
  useStudyTools,
} from '../../../../src/components/studyTools'
import { PrivateChatTool } from '../../../../src/components/studyTools/tools/SimpleTools'

const Probe = ({ chat = false }: { chat?: boolean }) => {
  const { openTool, state } = useStudyTools()
  return (
    <>
      <button onClick={() => openTool('canvas')}>Open Canvas</button>
      <button onClick={() => openTool('private-chat')}>Toggle Private Chat</button>
      <output aria-label="tools state">{JSON.stringify(state)}</output>
      {chat && <PrivateChatTool />}
    </>
  )
}

describe('study tools workflows', () => {
  beforeEach(() => {
    vi.mocked(window.localStorage.getItem).mockReturnValue(null)
    vi.mocked(window.localStorage.setItem).mockImplementation(() => undefined)
  })

  it('keeps Private Chat enabled after sending a message', async () => {
    const user = userEvent.setup()
    render(
      <StudyToolsProvider>
        <Probe chat />
      </StudyToolsProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'Toggle Private Chat' }))
    await user.type(screen.getByPlaceholderText('Message yourself...'), 'Remember this')
    await user.click(screen.getByRole('button', { name: 'Send private message' }))

    const state = JSON.parse(screen.getByLabelText('tools state').textContent || '{}')
    expect(state.privateChat.enabled).toBe(true)
    expect(state.privateChat.messages[0].content).toBe('Remember this')
  })

  it('stagger-adds Canvas cards and keeps arrow keys inside inline text', async () => {
    const user = userEvent.setup()
    render(
      <StudyToolsProvider>
        <Probe />
      </StudyToolsProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'Open Canvas' }))
    await user.click(screen.getAllByRole('button', { name: 'Add note' })[0])
    await user.type(screen.getByPlaceholderText('Write on this card...'), 'abc')
    await user.keyboard('{ArrowLeft}')
    await user.click(screen.getByRole('button', { name: 'Add note' }))

    const state = JSON.parse(screen.getByLabelText('tools state').textContent || '{}')
    expect(state.canvas.items).toHaveLength(2)
    expect(state.canvas.items[0].content).toBe('abc')
    expect(state.canvas.items[0].x).not.toBe(state.canvas.items[1].x)
    expect(state.canvas.items[1].x).toBeGreaterThan(
      state.canvas.items[0].x + state.canvas.items[0].width,
    )
  })
})
