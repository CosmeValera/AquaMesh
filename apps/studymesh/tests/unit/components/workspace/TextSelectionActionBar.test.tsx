import React, { useRef } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import TextSelectionActionBar from '../../../../src/components/workspace/TextSelectionActionBar'
import { PREFILL_DASHBOARD_CHAT_EVENT } from '../../../../src/components/workspace/workspaceEvents'

const PAGE_TEXT = 'Each session burns tokens in two places.'

const Host = ({
  enabled = true,
  onAskAi,
  onGrowPage,
  growPageCreditCost,
}: {
  enabled?: boolean
  onAskAi?: (question: string) => void
  onGrowPage?: (selection: string) => void
  growPageCreditCost?: number
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null)

  return (
    <div>
      <div ref={containerRef} data-testid="page">
        <p>{PAGE_TEXT}</p>
      </div>
      <TextSelectionActionBar
        containerRef={containerRef}
        scopeKey="guide-1:page-1"
        enabled={enabled}
        contextLabel="Token budgets"
        onAskAi={onAskAi}
        onGrowPage={onGrowPage}
        growPageCreditCost={growPageCreditCost}
      />
    </div>
  )
}

const removeAllRanges = vi.fn()

const selectPageText = (text: string) => {
  const paragraph = screen.getByTestId('page').querySelector('p')
  const textNode = paragraph?.firstChild as Text
  const start = textNode.data.indexOf(text)
  const range = document.createRange()
  range.setStart(textNode, start)
  range.setEnd(textNode, start + text.length)

  vi.spyOn(window, 'getSelection').mockReturnValue({
    isCollapsed: false,
    rangeCount: 1,
    getRangeAt: () => range,
    removeAllRanges,
  } as unknown as Selection)

  fireEvent.pointerUp(document)
}

const showActionBar = async (text = 'burns tokens') => {
  selectPageText(text)
  await waitFor(() =>
    expect(screen.getByTestId('text-selection-action-bar')).toBeInTheDocument(),
  )
}

describe('TextSelectionActionBar', () => {
  const store = new Map<string, string>()

  beforeEach(() => {
    store.clear()
    removeAllRanges.mockClear()
    vi.spyOn(window.localStorage, 'getItem').mockImplementation(
      (key: string) => store.get(key) ?? null,
    )
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(
      (key: string, value: string) => {
        store.set(key, value)
      },
    )
  })

  it('offers highlight, send to AI chat, and copy for the selected text', async () => {
    render(<Host />)
    await showActionBar()

    expect(
      screen.getByRole('button', { name: 'Highlight' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Send to AI Chat' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Copy' })).toBeInTheDocument()
    // Growing a page is offered only where a guide can actually take one.
    expect(
      screen.queryByTestId('text-selection-grow-page'),
    ).not.toBeInTheDocument()
  })

  it('turns the selected text into the seed for a new page', async () => {
    const onGrowPage = vi.fn()
    render(<Host onGrowPage={onGrowPage} growPageCreditCost={1} />)
    await showActionBar()

    const growPage = screen.getByRole('button', {
      name: 'Dig into this (1)',
    })
    fireEvent.click(growPage)

    expect(onGrowPage).toHaveBeenCalledWith('burns tokens')
    await waitFor(() =>
      expect(
        screen.queryByTestId('text-selection-action-bar'),
      ).not.toBeInTheDocument(),
    )
  })

  it('stays hidden while the page is being edited', async () => {
    render(<Host enabled={false} />)
    selectPageText('burns tokens')

    await waitFor(() =>
      expect(
        screen.queryByTestId('text-selection-action-bar'),
      ).not.toBeInTheDocument(),
    )
  })

  it('stores a highlight anchored to the selected occurrence', async () => {
    render(<Host />)
    await showActionBar()

    fireEvent.click(screen.getByRole('button', { name: 'Highlight' }))

    expect(
      JSON.parse(store.get('studymesh-text-highlights-v1') || '{}'),
    ).toMatchObject({
      'guide-1:page-1': [{ text: 'burns tokens', occurrence: 0 }],
    })
    expect(removeAllRanges).toHaveBeenCalled()
  })

  it('offers to remove the highlight when the selection is already highlighted', async () => {
    store.set(
      'studymesh-text-highlights-v1',
      JSON.stringify({
        'guide-1:page-1': [
          { id: 'a', text: 'burns tokens', occurrence: 0, createdAt: 1 },
        ],
      }),
    )
    render(<Host />)
    await showActionBar('session burns')

    fireEvent.click(screen.getByRole('button', { name: 'Remove highlight' }))

    expect(
      JSON.parse(store.get('studymesh-text-highlights-v1') || '{}'),
    ).toEqual({})
  })

  it('sends the selection to the dashboard chat through the ask handler', async () => {
    const onAskAi = vi.fn()
    render(<Host onAskAi={onAskAi} />)
    await showActionBar()

    fireEvent.click(screen.getByRole('button', { name: 'Send to AI Chat' }))

    expect(onAskAi).toHaveBeenCalledWith(
      "I am reading the page 'Token budgets' in this study guide.\n\nThis is the part I selected:\n\n'burns tokens'\n\nHelp me understand it.",
    )
  })

  it('falls back to the prefill chat event when no ask handler is given', async () => {
    const prefilled = vi.fn()
    window.addEventListener(PREFILL_DASHBOARD_CHAT_EVENT, prefilled)
    render(<Host />)
    await showActionBar()

    fireEvent.click(screen.getByRole('button', { name: 'Send to AI Chat' }))
    window.removeEventListener(PREFILL_DASHBOARD_CHAT_EVENT, prefilled)

    expect(prefilled).toHaveBeenCalledTimes(1)
    expect(
      (prefilled.mock.calls[0][0] as CustomEvent<{ content: string }>).detail
        .content,
    ).toContain("'burns tokens'")
  })

  it('copies the selection and confirms it in place', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })

    render(<Host />)
    await showActionBar()

    fireEvent.click(screen.getByRole('button', { name: 'Copy' }))

    expect(writeText).toHaveBeenCalledWith('burns tokens')
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Copied' }),
      ).toBeInTheDocument(),
    )
  })
})
