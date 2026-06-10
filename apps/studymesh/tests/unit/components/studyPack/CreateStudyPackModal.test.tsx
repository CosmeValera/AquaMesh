/// <reference types="@testing-library/jest-dom" />
import React from 'react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import CreateStudyPackModal from '../../../../src/components/studyPack/CreateStudyPackModal'
import { createStudyPackOrchestratorWidgets } from '../../../../src/studyPack'
import { extractRawNotesFromImage } from '../../../../src/studyPack/imageOcr'
import {
  extractRawNotesWithAi,
  extractNotesFromImageWithLocalLanguageModel,
  generateStudyPackWithAi,
  readStudyPackAiSettings,
  resolveStudyPackAiCredentials,
} from '../../../../src/studyPack/ai'
import {
  extractTextFromPdf,
  extractTextFromPptx,
} from '../../../../src/studyPack/documentExtraction'

vi.mock('../../../../src/studyPack/imageOcr', () => ({
  extractRawNotesFromImage: vi.fn(),
}))

vi.mock('../../../../src/studyPack/ai', () => ({
  STUDY_PACK_AI_SETTINGS_CHANGED_EVENT:
    'studymesh-study-pack-ai-settings-changed',
  cancelAllLocalAiSessions: vi.fn(),
  applyStudyMaterialResourceTypeToDraft: vi.fn(
    (draft, packId, resourceType) => {
      if (resourceType === 'improvedNotes') {
        return {
          ...draft,
          objects: [
            {
              id: `${packId}-improved-notes-1`,
              kind: 'markdown',
              title: 'Expand on this',
              sourceLine: 1,
              tags: [],
              markdown: draft.rawNotes || 'Expand on this',
            },
          ],
        }
      }

      if (resourceType === 'flashcards') {
        return {
          ...draft,
          objects: draft.objects.filter(
            (object: { kind: string }) =>
              object.kind === 'qa' || object.kind === 'reveal',
          ),
        }
      }

      if (resourceType === 'quiz') {
        return {
          ...draft,
          objects: draft.objects.filter(
            (object: { kind: string }) => object.kind === 'quiz',
          ),
        }
      }

      return draft
    },
  ),
  extractRawNotesWithAi: vi.fn(),
  extractNotesFromImageWithLocalLanguageModel: vi.fn(),
  generateStudyPackWithAi: vi.fn(),
  isStrongAiProvider: vi.fn((provider: string) =>
    ['gemini', 'cerebras'].includes(provider),
  ),
  readStudyPackAiSettings: vi.fn(() => ({
    provider: 'hosted',
    apiToken: '',
    model: 'gemini-test',
  })),
  resolveStudyPackAiCredentials: vi.fn(() => ({
    provider: 'hosted',
    apiToken: '',
    model: 'gemini-test',
    tokenSource: 'none',
  })),
}))

vi.mock('../../../../src/studyPack/documentExtraction', () => ({
  extractTextFromPdf: vi.fn(),
  extractTextFromPptx: vi.fn(),
}))

vi.mock('../../../../src/studyPack', async () => {
  const actual = await vi.importActual<
    typeof import('../../../../src/studyPack')
  >('../../../../src/studyPack')

  return {
    ...actual,
    createStudyPackWidgets: vi.fn(),
    createStudyPackOrchestratorWidgets: vi.fn(() => [
      {
        name: 'Study Pack Source',
        components: [],
        category: 'Study Pack',
        tags: ['study-pack', 'source', 'text'],
        description: 'Original study notes rendered as Markdown.',
        version: '1.0',
        author: 'StudyMesh',
      },
    ]),
    createStudyPackSmartWidgetGroups: vi.fn((pack) => {
      const objects = pack.objects.filter(
        (object: { kind: string }) =>
          object.kind !== 'note' && object.kind !== 'markdown',
      )

      return objects.length > 0
        ? [{ name: `${pack.title} Generated`, objects }]
        : []
    }),
  }
})

describe('CreateStudyPackModal create from notes flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(readStudyPackAiSettings).mockReturnValue({
    provider: 'hosted',
      apiToken: '',
      model: 'gemini-test',
    })
    vi.mocked(resolveStudyPackAiCredentials).mockReturnValue({
      provider: 'hosted',
      apiToken: '',
      model: 'gemini-test',
      tokenSource: 'none',
    })
    vi.mocked(generateStudyPackWithAi).mockResolvedValue({
      title: 'AI Study Pack',
      sourceFormat: 'text',
      concepts: [],
      objects: [
        {
          id: 'ai-quiz-1',
          kind: 'quiz',
          quizMode: 'shortAnswer',
          sourceLine: 1,
          tags: [],
          question: 'What did AI find?',
          options: [],
          correctIndex: 0,
          answer: 'A grounded answer',
          explanation: '',
        },
      ],
      warnings: [],
    })
    vi.mocked(extractRawNotesWithAi).mockResolvedValue(
      'AI extracted handwritten notes',
    )
    vi.mocked(extractNotesFromImageWithLocalLanguageModel).mockRejectedValue(
      new Error('Local image unavailable'),
    )
    vi.mocked(extractRawNotesFromImage).mockResolvedValue(
      'Quiz:: What is OCR? | Image text extraction',
    )
    vi.mocked(extractTextFromPdf).mockResolvedValue({
      text: '# PDF Notes\n\n## Page 1\n\nQuiz:: PDF? | Selectable text',
      warnings: [],
    })
    vi.mocked(extractTextFromPptx).mockResolvedValue({
      text: '# Slide Notes\n\n## Slide 1\n\nQuiz:: PPTX? | Slide text',
      warnings: [],
    })
    URL.createObjectURL = vi.fn(() => 'blob:study-notes')
    URL.revokeObjectURL = vi.fn()
  })

  const pasteNotes = (value: string) => {
    fireEvent.click(screen.getByRole('button', { name: /^copied text$/i }))
    fireEvent.change(screen.getByRole('textbox', { name: /^copied text$/i }), {
      target: { value },
    })
  }

  const selectResource = (name: string | RegExp = /quiz/i) => {
    fireEvent.click(screen.getByRole('button', { name }))
  }

  const selectImageSource = () => {
    selectResource()
    expect(
      screen.getByRole('heading', { name: /^add sources$/i }),
    ).toBeInTheDocument()
  }

  const getImageFileInput = () =>
    document.querySelector(
      'input[type="file"][accept*=".png"]',
    ) as HTMLInputElement

  const getTextFileInput = () =>
    document.querySelector(
      'input[type="file"][accept*=".txt"]',
    ) as HTMLInputElement

  const getPdfFileInput = () =>
    document.querySelector(
      'input[type="file"][accept*=".pdf"]',
    ) as HTMLInputElement

  const getPowerPointFileInput = () =>
    document.querySelector(
      'input[type="file"][accept*=".pptx"]',
    ) as HTMLInputElement

  const makeTextFile = (contents: string, name: string, type: string) => {
    const file = new File([contents], name, { type })
    Object.defineProperty(file, 'text', {
      value: vi.fn().mockResolvedValue(contents),
    })
    return file
  }

  it('presents a simple Create from notes source choice and no AI Tutor controls', () => {
    render(
      <CreateStudyPackModal open onClose={vi.fn()} onCreatePack={vi.fn()} />,
    )

    expect(screen.getByText('Create from notes')).toBeInTheDocument()
    expect(screen.getByText('Choose resource')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /expand on this/i }))
    expect(screen.getByRole('button', { name: /flashcards/i }))
    expect(screen.getByRole('button', { name: /quiz/i }))
    expect(screen.getByRole('button', { name: /medium/i }))
    expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled()
    expect(
      screen.getByRole('heading', { name: /^add sources$/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /upload files/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /^copied text$/i }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('textbox', { name: /^paste notes$/i }),
    ).not.toBeInTheDocument()
    expect(screen.getByText('Text')).toBeInTheDocument()
    expect(screen.getByText('Images')).toBeInTheDocument()
    expect(screen.getByText('PDF')).toBeInTheDocument()
    expect(screen.getByText('PPTX')).toBeInTheDocument()
    expect(screen.queryByText(/AI Tutor/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Target amount/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/^Practice$/i)).not.toBeInTheDocument()
  })

  it('creates a dashboard from pasted notes with a compact review screen', async () => {
    const onCreatePack = vi.fn()
    render(
      <CreateStudyPackModal
        open
        onClose={vi.fn()}
        onCreatePack={onCreatePack}
      />,
    )

    pasteNotes('Quiz:: What is derivative? | Rate of change')
    selectResource()
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))

    expect(await screen.findByText('1 study blocks')).toBeInTheDocument()
    expect(screen.getByText('1 sections')).toBeInTheDocument()
    expect(screen.getByText('Notes Dashboard Quiz')).toBeInTheDocument()
    expect(
      screen.queryByDisplayValue('Derivative quiz'),
    ).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /create dashboard/i }))

    expect(createStudyPackOrchestratorWidgets).toHaveBeenCalledWith(
      expect.objectContaining({ sourceFormat: 'text' }),
      expect.objectContaining({
        forceQuizBlockComponent: true,
        focusedResourceType: 'quiz',
        includeSourceWidget: false,
        includeSummaryChart: false,
        rawSource: 'Quiz:: What is derivative? | Rate of change',
        widgetGroups: [
          expect.objectContaining({
            name: 'Notes Dashboard Quiz',
            objects: expect.arrayContaining([
              expect.objectContaining({ kind: 'quiz' }),
            ]),
          }),
        ],
      }),
    )
    expect(onCreatePack).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Notes Dashboard',
        layoutMode: 'tabs',
        folderName: 'Quizzes',
      }),
    )
  })

  it('uses configured AI generation for text notes without exposing AI Tutor mode', async () => {
    vi.mocked(readStudyPackAiSettings).mockReturnValue({
      provider: 'gemini',
      apiToken: 'settings-token',
      model: 'gemini-test',
    })
    vi.mocked(resolveStudyPackAiCredentials).mockReturnValue({
      provider: 'gemini',
      apiToken: 'settings-token',
      model: 'gemini-test',
      tokenSource: 'settings',
    })

    render(
      <CreateStudyPackModal open onClose={vi.fn()} onCreatePack={vi.fn()} />,
    )

    pasteNotes('Photosynthesis happens in chloroplasts.')
    selectResource()
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))

    await waitFor(() => {
      expect(generateStudyPackWithAi).toHaveBeenCalledWith(
        expect.objectContaining({
          apiToken: 'settings-token',
          model: 'gemini-test',
          rawNotes: 'Photosynthesis happens in chloroplasts.',
          resourceType: 'quiz',
          detailLevel: 'medium',
          promptMode: false,
        }),
      )
    })
    expect(await screen.findByText('AI Study Pack Quiz')).toBeInTheDocument()
  })

  it('combines multiple uploaded text files', async () => {
    render(
      <CreateStudyPackModal open onClose={vi.fn()} onCreatePack={vi.fn()} />,
    )

    const first = makeTextFile(
      'Quiz:: One? | First answer',
      'one.md',
      'text/markdown',
    )
    const second = makeTextFile(
      'Quiz:: Two? | Second answer',
      'two.txt',
      'text/plain',
    )
    fireEvent.change(getTextFileInput(), {
      target: { files: [first, second] },
    })

    expect(await screen.findByText('one.md')).toBeInTheDocument()
    expect(screen.getByText('two.txt')).toBeInTheDocument()
  })

  it('appends text files uploaded in separate batches', async () => {
    render(
      <CreateStudyPackModal open onClose={vi.fn()} onCreatePack={vi.fn()} />,
    )

    const first = makeTextFile('Quiz:: One? | A', 'one.md', 'text/markdown')
    const second = makeTextFile('Quiz:: Two? | B', 'two.md', 'text/markdown')
    fireEvent.change(getTextFileInput(), { target: { files: [first] } })
    await screen.findByText('one.md')

    fireEvent.change(getTextFileInput(), { target: { files: [second] } })

    expect(await screen.findByText('two.md')).toBeInTheDocument()
  })

  it('accepts mixed source uploads from the unified source input', async () => {
    render(
      <CreateStudyPackModal open onClose={vi.fn()} onCreatePack={vi.fn()} />,
    )

    const text = makeTextFile('Quiz:: Text? | A', 'notes.md', 'text/markdown')
    const pdf = new File(['pdf'], 'reading.pdf', { type: 'application/pdf' })
    const image = new File(['image'], 'board.png', { type: 'image/png' })
    vi.mocked(extractTextFromPdf).mockResolvedValueOnce({
      text: '# Reading\n\nQuiz:: PDF? | B',
      warnings: [],
    })

    fireEvent.change(getTextFileInput(), {
      target: { files: [text, pdf, image] },
    })

    expect(await screen.findByText('notes.md')).toBeInTheDocument()
    expect(screen.getByText('reading.pdf')).toBeInTheDocument()
    expect(extractTextFromPdf).not.toHaveBeenCalled()
    expect(screen.getByAltText('board.png')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /extract notes/i }),
    ).toBeInTheDocument()
  })

  it('shows Gemini elapsed and estimated Create from notes timing capped at 99%', async () => {
    vi.useFakeTimers()
    vi.mocked(readStudyPackAiSettings).mockReturnValue({
      provider: 'gemini',
      apiToken: 'settings-token',
      model: 'gemini-test',
    })
    vi.mocked(resolveStudyPackAiCredentials).mockReturnValue({
      provider: 'gemini',
      apiToken: 'settings-token',
      model: 'gemini-test',
      tokenSource: 'settings',
    })
    vi.mocked(generateStudyPackWithAi).mockImplementation(
      () => new Promise(() => undefined),
    )

    render(
      <CreateStudyPackModal open onClose={vi.fn()} onCreatePack={vi.fn()} />,
    )

    pasteNotes('Photosynthesis happens in chloroplasts.')
    selectResource()
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))

    expect(screen.getByText(/estimated total 1m/i)).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(60 * 1000)
    })

    expect(screen.getByText(/elapsed 1m/i)).toBeInTheDocument()
    expect(screen.getByText('99%')).toBeInTheDocument()
    expect(screen.queryByText('100%')).not.toBeInTheDocument()
    expect(screen.getByText(/remaining 0s/i)).toBeInTheDocument()

    vi.useRealTimers()
  })

  it('extracts image notes before parsing the dashboard', async () => {
    render(
      <CreateStudyPackModal open onClose={vi.fn()} onCreatePack={vi.fn()} />,
    )

    selectImageSource()
    expect(screen.getByText(/drop notes here/i)).toBeInTheDocument()

    const image = new File(['image-bytes'], 'lecture.png', {
      type: 'image/png',
    })
    fireEvent.change(getImageFileInput(), { target: { files: [image] } })
    fireEvent.click(screen.getByRole('button', { name: /extract notes/i }))

    await waitFor(() => {
      expect(extractRawNotesFromImage).toHaveBeenCalledWith(
        image,
        expect.any(Function),
      )
    })
    expect(generateStudyPackWithAi).not.toHaveBeenCalled()
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /continue/i }),
      ).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    expect(generateStudyPackWithAi).toHaveBeenCalledWith(
      expect.objectContaining({
        rawNotes: expect.stringMatching(/# lecture[\s\S]*Quiz:: What is OCR/i),
      }),
    )
  })

  it('extracts multiple images and allows removing thumbnails', async () => {
    render(
      <CreateStudyPackModal open onClose={vi.fn()} onCreatePack={vi.fn()} />,
    )

    selectImageSource()
    const first = new File(['first-image'], 'first.png', {
      type: 'image/png',
    })
    const second = new File(['second-image'], 'second.png', {
      type: 'image/png',
    })
    fireEvent.change(getImageFileInput(), {
      target: { files: [first, second] },
    })

    expect(screen.getByAltText('first.png')).toBeInTheDocument()
    expect(screen.getByAltText('second.png')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /remove first.png/i }))
    fireEvent.click(screen.getByRole('button', { name: /extract notes/i }))

    await waitFor(() => {
      expect(extractRawNotesFromImage).toHaveBeenCalledTimes(1)
      expect(extractRawNotesFromImage).toHaveBeenCalledWith(
        second,
        expect.any(Function),
      )
    })
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /continue/i }),
      ).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    expect(generateStudyPackWithAi).toHaveBeenCalledWith(
      expect.objectContaining({
        rawNotes: expect.stringMatching(/# second[\s\S]*Quiz:: What is OCR/i),
      }),
    )
  })

  it('accumulates images selected in separate batches', async () => {
    render(
      <CreateStudyPackModal open onClose={vi.fn()} onCreatePack={vi.fn()} />,
    )

    selectImageSource()
    const first = new File(['first-image'], 'first.png', {
      type: 'image/png',
    })
    const second = new File(['second-image'], 'second.png', {
      type: 'image/png',
    })
    fireEvent.change(getImageFileInput(), { target: { files: [first] } })
    fireEvent.change(getImageFileInput(), { target: { files: [second] } })

    expect(screen.getByAltText('first.png')).toBeInTheDocument()
    expect(screen.getByAltText('second.png')).toBeInTheDocument()
  })

  it('uses Gemini image extraction when configured', async () => {
    vi.mocked(readStudyPackAiSettings).mockReturnValue({
      provider: 'gemini',
      apiToken: 'settings-token',
      model: 'gemini-test',
    })
    vi.mocked(resolveStudyPackAiCredentials).mockReturnValue({
      provider: 'gemini',
      apiToken: 'settings-token',
      model: 'gemini-test',
      tokenSource: 'settings',
    })

    render(
      <CreateStudyPackModal open onClose={vi.fn()} onCreatePack={vi.fn()} />,
    )

    selectImageSource()
    const image = new File(['image-bytes'], 'handwritten.png', {
      type: 'image/png',
    })
    fireEvent.change(getImageFileInput(), { target: { files: [image] } })
    fireEvent.click(screen.getByRole('button', { name: /extract notes/i }))

    await waitFor(() => {
      expect(extractRawNotesWithAi).toHaveBeenCalledWith(
        expect.objectContaining({
          apiToken: 'settings-token',
          model: 'gemini-test',
          image,
        }),
      )
    })
    expect(extractRawNotesFromImage).not.toHaveBeenCalled()
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /continue/i }),
      ).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    expect(generateStudyPackWithAi).toHaveBeenCalledWith(
      expect.objectContaining({
        rawNotes: expect.stringMatching(/# handwritten[\s\S]*AI extracted/i),
      }),
    )
  })

  it('rejects unsupported image files before OCR', async () => {
    render(
      <CreateStudyPackModal open onClose={vi.fn()} onCreatePack={vi.fn()} />,
    )

    selectImageSource()
    const unsupported = new File(['svg-bytes'], 'diagram.svg', {
      type: 'image/svg+xml',
    })
    fireEvent.change(getImageFileInput(), { target: { files: [unsupported] } })

    expect(
      await screen.findByText(/use text, image, pdf, or \.pptx source files/i),
    ).toBeInTheDocument()
    expect(extractRawNotesFromImage).not.toHaveBeenCalled()
  })

  it('extracts selectable text from multiple PDFs', async () => {
    render(
      <CreateStudyPackModal open onClose={vi.fn()} onCreatePack={vi.fn()} />,
    )

    const first = new File(['pdf-1'], 'chapter-one.pdf', {
      type: 'application/pdf',
    })
    const second = new File(['pdf-2'], 'chapter-two.pdf', {
      type: 'application/pdf',
    })
    vi.mocked(extractTextFromPdf)
      .mockResolvedValueOnce({
        text: '# Chapter One\n\n## Page 1\n\nQuiz:: One? | A',
        warnings: [],
      })
      .mockResolvedValueOnce({
        text: '# Chapter Two\n\n## Page 1\n\nQuiz:: Two? | B',
        warnings: [],
      })

    fireEvent.change(getPdfFileInput(), {
      target: { files: [first, second] },
    })

    expect(await screen.findByText('chapter-one.pdf')).toBeInTheDocument()
    expect(screen.getByText('chapter-two.pdf')).toBeInTheDocument()
    expect(extractTextFromPdf).not.toHaveBeenCalled()
    selectResource()
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))

    await waitFor(() => {
      expect(extractTextFromPdf).toHaveBeenCalledWith(first)
      expect(extractTextFromPdf).toHaveBeenCalledWith(second)
    })
    expect(await screen.findByText('1 study blocks')).toBeInTheDocument()
  })

  it('appends PDFs uploaded in separate batches', async () => {
    render(
      <CreateStudyPackModal open onClose={vi.fn()} onCreatePack={vi.fn()} />,
    )

    const first = new File(['pdf-1'], 'one.pdf', { type: 'application/pdf' })
    const second = new File(['pdf-2'], 'two.pdf', { type: 'application/pdf' })
    vi.mocked(extractTextFromPdf)
      .mockResolvedValueOnce({
        text: '# One\n\n## Page 1\n\nQuiz:: One? | A',
        warnings: [],
      })
      .mockResolvedValueOnce({
        text: '# Two\n\n## Page 1\n\nQuiz:: Two? | B',
        warnings: [],
      })

    fireEvent.change(getPdfFileInput(), { target: { files: [first] } })
    await screen.findByText('one.pdf')
    fireEvent.change(getPdfFileInput(), { target: { files: [second] } })

    expect(await screen.findByText('two.pdf')).toBeInTheDocument()
    selectResource()
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    await waitFor(() => {
      expect(extractTextFromPdf).toHaveBeenCalledTimes(2)
    })
  })

  it('extracts slide text from PPTX and rejects legacy PPT', async () => {
    render(
      <CreateStudyPackModal open onClose={vi.fn()} onCreatePack={vi.fn()} />,
    )

    const ppt = new File(['legacy'], 'lecture.ppt', {
      type: 'application/vnd.ms-powerpoint',
    })
    fireEvent.change(getPowerPointFileInput(), { target: { files: [ppt] } })

    expect(
      await screen.findByText(/legacy \.ppt files are not supported/i),
    ).toBeInTheDocument()

    const pptx = new File(['pptx'], 'lecture.pptx', {
      type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    })
    fireEvent.change(getPowerPointFileInput(), { target: { files: [pptx] } })

    expect(await screen.findByText('lecture.pptx')).toBeInTheDocument()
    expect(extractTextFromPptx).not.toHaveBeenCalled()
    selectResource()
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))

    await waitFor(() => {
      expect(extractTextFromPptx).toHaveBeenCalledWith(pptx)
    })
    expect(await screen.findByText('1 study blocks')).toBeInTheDocument()
  })

  it('appends PPTX files uploaded in separate batches', async () => {
    render(
      <CreateStudyPackModal open onClose={vi.fn()} onCreatePack={vi.fn()} />,
    )

    const first = new File(['pptx-1'], 'one.pptx', {
      type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    })
    const second = new File(['pptx-2'], 'two.pptx', {
      type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    })
    vi.mocked(extractTextFromPptx)
      .mockResolvedValueOnce({
        text: '# One Slides\n\n## Slide 1\n\nQuiz:: One? | A',
        warnings: [],
      })
      .mockResolvedValueOnce({
        text: '# Two Slides\n\n## Slide 1\n\nQuiz:: Two? | B',
        warnings: [],
      })

    fireEvent.change(getPowerPointFileInput(), { target: { files: [first] } })
    await screen.findByText('one.pptx')
    fireEvent.change(getPowerPointFileInput(), {
      target: { files: [second] },
    })

    expect(await screen.findByText('two.pptx')).toBeInTheDocument()
    selectResource()
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    await waitFor(() => {
      expect(extractTextFromPptx).toHaveBeenCalledTimes(2)
    })
  })

  it('previews CSV sources as a source table dashboard', async () => {
    render(
      <CreateStudyPackModal open onClose={vi.fn()} onCreatePack={vi.fn()} />,
    )

    pasteNotes('Rule,Formula\nPower,nx^(n-1)')
    selectResource()
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))

    expect(await screen.findByText('Quiz')).toBeInTheDocument()
    expect(generateStudyPackWithAi).toHaveBeenCalled()
  })
})
