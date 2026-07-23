/// <reference types="@testing-library/jest-dom" />
import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import StudyGuidePageEditor from '../../../src/components/Dasboard/StudyGuidePageEditor'
import {
  CONTENT_LANGUAGE_SETTINGS_KEY,
  type InterfaceLanguageCode,
} from '../../../src/language/contentLanguage'
import { InterfaceLanguageProvider } from '../../../src/language/interfaceLanguage'

const tiptapMock = vi.hoisted(() => {
  const state = {
    markdown: '',
    options: null as null | {
      content: string
      onUpdate?: (payload: { editor: unknown }) => void
    },
    setContent: vi.fn((content: string) => {
      state.markdown = content
      return true
    }),
  }

  const chainCommands = {
    focus: vi.fn(() => chainCommands),
    undo: vi.fn(() => chainCommands),
    redo: vi.fn(() => chainCommands),
    toggleHeading: vi.fn(() => chainCommands),
    toggleBold: vi.fn(() => chainCommands),
    toggleItalic: vi.fn(() => chainCommands),
    toggleCode: vi.fn(() => chainCommands),
    toggleBulletList: vi.fn(() => chainCommands),
    toggleOrderedList: vi.fn(() => chainCommands),
    toggleTaskList: vi.fn(() => chainCommands),
    toggleBlockquote: vi.fn(() => chainCommands),
    setHorizontalRule: vi.fn(() => chainCommands),
    extendMarkRange: vi.fn(() => chainCommands),
    setLink: vi.fn(() => chainCommands),
    unsetLink: vi.fn(() => chainCommands),
    insertTable: vi.fn(() => chainCommands),
    run: vi.fn(() => true),
  }

  const editor = {
    get isEmpty() {
      return !state.markdown
    },
    commands: {
      setContent: state.setContent,
    },
    chain: vi.fn(() => chainCommands),
    can: vi.fn(() => ({
      undo: () => true,
      redo: () => true,
    })),
    isActive: vi.fn(() => false),
    getAttributes: vi.fn(() => ({})),
    getMarkdown: vi.fn(() => state.markdown),
  }

  return { state, editor }
})

vi.mock('@tiptap/react', () => ({
  useEditor: vi.fn((options) => {
    tiptapMock.state.options = options
    tiptapMock.state.markdown = options.content
    return tiptapMock.editor
  }),
  EditorContent: ({ editor }: { editor: unknown }) => {
    const attributes = tiptapMock.state.options?.editorProps?.attributes || {}

    return (
      <div
        role="textbox"
        aria-label={attributes['aria-label'] || 'Page body'}
        data-placeholder={
          tiptapMock.state.options?.extensions
            ?.find(
              (extension: { name?: string }) =>
                extension.name === 'Placeholder',
            )
            ?.placeholder?.({ editor: tiptapMock.editor }) || undefined
        }
        contentEditable
        suppressContentEditableWarning
        onInput={(event) => {
          tiptapMock.state.markdown = event.currentTarget.textContent || ''
          tiptapMock.state.options?.onUpdate?.({ editor })
        }}
      />
    )
  },
}))

vi.mock('@tiptap/starter-kit', () => ({
  default: { configure: vi.fn(() => ({ name: 'StarterKit' })) },
}))

vi.mock('@tiptap/markdown', () => ({
  Markdown: { configure: vi.fn(() => ({ name: 'Markdown' })) },
}))

vi.mock('@tiptap/extension-link', () => ({
  Link: { configure: vi.fn(() => ({ name: 'Link' })) },
}))

vi.mock('@tiptap/extension-placeholder', () => ({
  Placeholder: {
    configure: vi.fn((options) => ({ name: 'Placeholder', ...options })),
  },
}))

vi.mock('@tiptap/extension-list', () => ({
  TaskItem: { configure: vi.fn(() => ({ name: 'TaskItem' })) },
  TaskList: { name: 'TaskList' },
}))

vi.mock('@tiptap/extension-table', () => ({
  TableKit: { configure: vi.fn(() => ({ name: 'TableKit' })) },
}))

describe('StudyGuidePageEditor', () => {
  let storage: Record<string, string>

  beforeEach(() => {
    storage = {}
    vi.mocked(localStorage.getItem).mockImplementation(
      (key: string) => storage[key] ?? null,
    )
    vi.mocked(localStorage.setItem).mockImplementation(
      (key: string, value: string) => {
        storage[key] = value
      },
    )
    vi.useFakeTimers()
    tiptapMock.state.markdown = ''
    tiptapMock.state.options = null
    tiptapMock.state.setContent.mockClear()
    tiptapMock.editor.chain().setLink.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const renderEditor = (language: InterfaceLanguageCode = 'en') => {
    storage[CONTENT_LANGUAGE_SETTINGS_KEY] = JSON.stringify({
      interfaceLanguage: language,
      defaultContentLanguage: language,
      autoDetectAiLanguage: true,
    })

    return render(
      <InterfaceLanguageProvider>
        <StudyGuidePageEditor title="" markdown="" onChange={vi.fn()} />
      </InterfaceLanguageProvider>,
    )
  }

  it('autosaves rich text edits as Markdown', () => {
    const onChange = vi.fn()
    render(
      <StudyGuidePageEditor
        title="Cell biology"
        markdown="Initial notes"
        onChange={onChange}
      />,
    )

    const body = screen.getByRole('textbox', { name: 'Page body' })
    body.textContent = '## Mitosis'
    fireEvent.input(body)
    vi.advanceTimersByTime(450)

    expect(onChange).toHaveBeenCalledWith('Cell biology', '## Mitosis')
  })

  it('autosaves Markdown source edits and reparses source when returning rich', () => {
    const onChange = vi.fn()
    render(
      <StudyGuidePageEditor
        title="Chemistry"
        markdown="Old notes"
        onChange={onChange}
      />,
    )

    fireEvent.click(screen.getByRole('tab', { name: /source/i }))
    fireEvent.change(screen.getByLabelText('Markdown source'), {
      target: { value: '## Bonds\n\n- Ionic\n- Covalent' },
    })
    vi.advanceTimersByTime(450)

    expect(onChange).toHaveBeenCalledWith(
      'Chemistry',
      '## Bonds\n\n- Ionic\n- Covalent',
    )

    fireEvent.click(screen.getByRole('tab', { name: /rich text/i }))

    expect(tiptapMock.state.setContent).toHaveBeenCalledWith(
      '## Bonds\n\n- Ionic\n- Covalent',
      expect.objectContaining({
        contentType: 'markdown',
        emitUpdate: false,
      }),
    )
  })

  it('autosaves page title changes with current Markdown', () => {
    const onChange = vi.fn()
    render(
      <StudyGuidePageEditor
        title="Draft"
        markdown="Body"
        onChange={onChange}
      />,
    )

    fireEvent.change(screen.getByLabelText('Page title'), {
      target: { value: 'Finished page' },
    })
    vi.advanceTimersByTime(450)

    expect(onChange).toHaveBeenCalledWith('Finished page', 'Body')
  })

  it('inserts a table with the selected row and column count', () => {
    render(
      <StudyGuidePageEditor title="Tables" markdown="" onChange={vi.fn()} />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Insert table' }))
    fireEvent.change(screen.getByLabelText('Rows'), {
      target: { value: '5' },
    })
    fireEvent.change(screen.getByLabelText('Columns'), {
      target: { value: '4' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Insert table' }))

    expect(tiptapMock.editor.chain).toHaveBeenCalled()
    expect(tiptapMock.editor.chain().insertTable).toHaveBeenCalledWith({
      rows: 5,
      cols: 4,
      withHeaderRow: true,
    })
  })

  it('links selected text to another Study Guide page', () => {
    render(
      <StudyGuidePageEditor
        title="Current page"
        markdown="See review"
        onChange={vi.fn()}
        pageLinks={[{ title: 'Review page', dashboardKey: 'review' }]}
      />,
    )

    fireEvent.click(
      screen.getByRole('button', { name: 'Link Quick Guide page' }),
    )
    fireEvent.click(screen.getByRole('menuitem', { name: 'Review page' }))

    expect(tiptapMock.editor.chain().setLink).toHaveBeenCalledWith({
      href: 'studymesh-page:review',
    })
  })

  it('localizes page editor labels and placeholders', () => {
    renderEditor('fr')

    expect(screen.getByLabelText('Titre de la page')).toBeInTheDocument()
    expect(
      screen.getByRole('textbox', { name: 'Corps de la page' }),
    ).toHaveAttribute('data-placeholder', 'Commencez à écrire des notes...')
    expect(
      screen.getByRole('tab', { name: /texte enrichi/i }),
    ).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /source/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Gras' })).toBeInTheDocument()
  })
})
