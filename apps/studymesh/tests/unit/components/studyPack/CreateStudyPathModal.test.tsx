/// <reference types="@testing-library/jest-dom" />
import React from 'react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import CreateStudyPathModal from '../../../../src/components/studyPack/CreateStudyPathModal'
import {
  readStudyPackAiSettings,
  resolveStudyPackAiCredentials,
} from '../../../../src/studyPack/ai'

vi.mock('../../../../src/studyPack/ai', async () => {
  const actual = await vi.importActual<
    typeof import('../../../../src/studyPack/ai')
  >('../../../../src/studyPack/ai')

  return {
    ...actual,
    readStudyPackAiSettings: vi.fn(() => ({
      provider: 'gemini',
      apiToken: 'test-token',
      model: 'gemini-test',
    })),
    resolveStudyPackAiCredentials: vi.fn(() => ({
      provider: 'gemini',
      apiToken: 'test-token',
      model: 'gemini-test',
      tokenSource: 'settings',
    })),
  }
})

const makeDashboard = (index: number, dashboardCount: number) => {
  const label = `Lesson ${index}`

  return {
    title: `${String(index).padStart(2, '0')} - ${label}`,
    summary: `${label} preview`,
    rawNotes: `${label} explains French subjunctive rules with examples, contrasts, and mistakes so the lesson has grounding.`,
    sourceSummary: {
      title: `${label} source summary`,
      bullets: [`${label} source summary bullet.`],
    },
    conceptRecap: {
      title: `${label} concept recap`,
      sections: [
        {
          title: `${label} concept recap/list`,
          bullets: [`${label} recap bullet.`],
          example: `${label} example.`,
        },
      ],
    },
    practice: {
      shortAnswer: [
        {
          question: `Complete a new ${label.toLowerCase()} example with the correct form.`,
          expectedAnswer: `${label} answer`,
          explanation: `${label} short-answer explanation.`,
        },
      ],
      multipleChoice: [
        {
          question: `Which option applies ${label.toLowerCase()} in a new context?`,
          options: [
            `${label} correct`,
            `${label} distractor A`,
            `${label} distractor B`,
          ],
          correctOptionIndex: 0,
          explanation: `${label} multiple-choice explanation.`,
        },
      ],
    },
    flashcards: [
      {
        front: `When do you use ${label.toLowerCase()}?`,
        back: `Use ${label.toLowerCase()} for the matching rule.`,
      },
    ],
    layoutArchetype:
      index % 3 === 1
        ? 'learnPracticeTabs'
        : index % 3 === 2
          ? 'splitReferenceExercise'
          : 'overviewReview',
    dashboardPurpose: index === 1 ? 'overview' : 'lesson',
    practiceType: index === 1 ? 'quiz' : 'mixed',
  }
}

const mockGeminiDashboards = (dashboardCount: number) => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    title: 'French Subjunctive Path',
                    folderName: 'French Subjunctive Path',
                    dashboards: Array.from(
                      { length: dashboardCount },
                      (_value, index) =>
                        makeDashboard(index + 1, dashboardCount),
                    ),
                  }),
                },
              ],
            },
          },
        ],
      }),
    }),
  )
}

const generatePath = async (amount?: 'Compact' | 'Deep') => {
  render(<CreateStudyPathModal open onClose={vi.fn()} onCreatePath={vi.fn()} />)

  if (amount) {
    fireEvent.mouseDown(screen.getByRole('combobox', { name: /path depth/i }))
    fireEvent.click(
      screen.getByRole('option', { name: new RegExp(amount, 'i') }),
    )
  }

  fireEvent.change(
    screen.getByRole('textbox', { name: /what should StudyMesh teach/i }),
    {
      target: { value: 'Teach French subjunctive' },
    },
  )
  fireEvent.click(screen.getByRole('button', { name: /generate study guide/i }))
}

describe('CreateStudyPathModal Study Guide generation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(readStudyPackAiSettings).mockReturnValue({
      provider: 'gemini',
      apiToken: 'test-token',
      model: 'gemini-test',
    })
    vi.mocked(resolveStudyPackAiCredentials).mockReturnValue({
      provider: 'gemini',
      apiToken: 'test-token',
      model: 'gemini-test',
      tokenSource: 'settings',
    })
  })

  it('hides dashboard source controls when dashboard sources are disabled', () => {
    render(
      <CreateStudyPathModal
        open
        onClose={vi.fn()}
        onCreatePath={vi.fn()}
        allowDashboardSource={false}
        hasCurrentDashboardContext
        currentDashboardTitle="Biology Dashboard"
        currentDashboardContext="Dashboard notes"
      />,
    )

    expect(
      screen.queryByRole('button', { name: /current dashboard/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /prompt only/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('textbox', { name: /what should StudyMesh teach/i }),
    ).toBeRequired()
  })

  it('uses the current Cerebras provider when inline auto-generation starts', async () => {
    vi.mocked(readStudyPackAiSettings).mockReturnValue({
      provider: 'cerebras',
      apiToken: 'cerebras-token',
      model: 'gpt-oss-120b',
    })
    vi.mocked(resolveStudyPackAiCredentials).mockReturnValue({
      provider: 'cerebras',
      apiToken: 'cerebras-token',
      model: 'gpt-oss-120b',
      tokenSource: 'settings',
    })
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  title: 'Cerebras Auto Path',
                  folderName: 'Cerebras Auto Path',
                  dashboards: [makeDashboard(1, 1)],
                }),
              },
            },
          ],
        }),
      }),
    )

    render(
      <CreateStudyPathModal
        open
        onClose={vi.fn()}
        onCreatePath={vi.fn()}
        autoCreateOnGenerate
        autoGenerateRequest={{
          id: 1,
          prompt: 'Teach me Cerebras routing',
        }}
      />,
    )

    await waitFor(() =>
      expect(vi.mocked(fetch)).toHaveBeenCalledWith(
        'https://api.cerebras.ai/v1/chat/completions',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer cerebras-token',
          }),
        }),
      ),
    )
  })

  it('previews and creates balanced paths from generated lesson objects', async () => {
    const onCreatePath = vi.fn()
    mockGeminiDashboards(5)
    render(
      <CreateStudyPathModal
        open
        onClose={vi.fn()}
        onCreatePath={onCreatePath}
      />,
    )

    fireEvent.change(
      screen.getByRole('textbox', { name: /what should StudyMesh teach/i }),
      {
        target: { value: 'Teach French subjunctive' },
      },
    )
    fireEvent.click(
      screen.getByRole('button', { name: /generate study guide/i }),
    )

    await waitFor(() => {
      expect(screen.getByText('04 - Lesson 4')).toBeInTheDocument()
      expect(screen.getByText('05 - Lesson 5')).toBeInTheDocument()
    })

    const lessonFourCard = screen.getByTestId('study-path-dashboard-4')
    const lessonFiveCard = screen.getByTestId('study-path-dashboard-5')

    expect(
      within(lessonFourCard).getByText('7 study items'),
    ).toBeInTheDocument()
    expect(
      within(lessonFiveCard).getByText('7 study items'),
    ).toBeInTheDocument()
    expect(within(lessonFiveCard).getByText('lesson')).toBeInTheDocument()

    fireEvent.click(screen.getByText('AI generation debug'))
    const rawDashboardInput = screen.getByTestId(
      'study-path-debug-raw-dashboard-input',
    )
    const sanitizedInput = screen.getByTestId(
      'study-path-debug-sanitized-input-before-normalization',
    )
    const finalMapping = screen.getByTestId(
      'study-path-debug-final-studyobject-mapping',
    )
    const roleFilteredContract = screen.getByTestId(
      'study-path-debug-role-filtered-contract',
    )

    expect(roleFilteredContract).toHaveTextContent('roleFilteredContract')
    expect(rawDashboardInput).toHaveTextContent('Lesson 4 short-answer')
    expect(rawDashboardInput).toHaveTextContent('Lesson 5 concept recap/list')
    expect(sanitizedInput).toHaveTextContent('Lesson 4 short-answer')
    expect(sanitizedInput).toHaveTextContent('Lesson 5 concept recap/list')
    expect(finalMapping).not.toHaveTextContent('concept-recap')
    expect(finalMapping).toHaveTextContent('study-guide-4-short-answer')
    expect(finalMapping).toHaveTextContent('study-guide-4-multiple-choice')
    expect(finalMapping).toHaveTextContent('study-guide-4-flashcard')
    expect(finalMapping).toHaveTextContent('study-guide-5-short-answer')
    expect(finalMapping).toHaveTextContent('study-guide-5-multiple-choice')
    expect(finalMapping).toHaveTextContent('study-guide-5-flashcard')

    fireEvent.click(
      screen.getByRole('button', { name: /^create 5 dashboards$/i }),
    )

    expect(onCreatePath).toHaveBeenCalledTimes(1)
    const payload = onCreatePath.mock.calls[0][0]
    const lessonFourWidgets = JSON.stringify(payload.dashboards[3].widgets)
    const lessonFiveWidgets = JSON.stringify(payload.dashboards[4].widgets)

    expect(lessonFourWidgets).toContain('QuizCarouselBlock')
    expect(lessonFiveWidgets).toContain('QuizCarouselBlock')
    expect(lessonFourWidgets).not.toContain('FlashcardCarouselBlock')
    expect(lessonFiveWidgets).not.toContain('FlashcardCarouselBlock')
    expect(lessonFiveWidgets).not.toContain('Lesson 5 concept recap/list')
  })

  it('shows Gemini elapsed and estimated Study Guide timing capped at 99%', async () => {
    vi.useFakeTimers()
    const pendingFetch = new Promise(() => undefined)
    vi.stubGlobal(
      'fetch',
      vi.fn(() => pendingFetch),
    )

    render(
      <CreateStudyPathModal open onClose={vi.fn()} onCreatePath={vi.fn()} />,
    )

    fireEvent.change(
      screen.getByRole('textbox', { name: /what should StudyMesh teach/i }),
      {
        target: { value: 'Teach French subjunctive' },
      },
    )
    fireEvent.click(
      screen.getByRole('button', { name: /generate study guide/i }),
    )

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

  it('previews compact paths without fixed positional roles', async () => {
    mockGeminiDashboards(3)
    await generatePath('Compact')

    await waitFor(() => {
      expect(screen.getByText('03 - Lesson 3')).toBeInTheDocument()
    })

    const finalCard = screen.getByTestId('study-path-dashboard-3')
    expect(within(finalCard).getByText('lesson')).toBeInTheDocument()
    expect(within(finalCard).getByText('5 study items')).toBeInTheDocument()

    fireEvent.click(screen.getByText('AI generation debug'))
    const finalMapping = screen.getByTestId(
      'study-path-debug-final-studyobject-mapping',
    )

    expect(finalMapping).not.toHaveTextContent('concept-recap')
    expect(finalMapping).toHaveTextContent('study-guide-3-short-answer')
    expect(finalMapping).toHaveTextContent('study-guide-3-multiple-choice')
    expect(finalMapping).toHaveTextContent('study-guide-3-flashcard')
  })

  it('previews extended paths without fixed positional roles', async () => {
    mockGeminiDashboards(7)
    await generatePath('Deep')

    await waitFor(() => {
      expect(screen.getByText('06 - Lesson 6')).toBeInTheDocument()
      expect(screen.getByText('07 - Lesson 7')).toBeInTheDocument()
    })

    const lessonSixCard = screen.getByTestId('study-path-dashboard-6')
    const lessonSevenCard = screen.getByTestId('study-path-dashboard-7')

    expect(within(lessonSixCard).getByText('lesson')).toBeInTheDocument()
    expect(within(lessonSixCard).getByText('7 study items')).toBeInTheDocument()
    expect(within(lessonSevenCard).getByText('lesson')).toBeInTheDocument()
    expect(
      within(lessonSevenCard).getByText('7 study items'),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByText('AI generation debug'))
    const finalMapping = screen.getByTestId(
      'study-path-debug-final-studyobject-mapping',
    )

    expect(finalMapping).toHaveTextContent('study-guide-6-short-answer')
    expect(finalMapping).toHaveTextContent('study-guide-6-multiple-choice')
    expect(finalMapping).toHaveTextContent('study-guide-6-flashcard')
    expect(finalMapping).not.toHaveTextContent('concept-recap')
    expect(finalMapping).toHaveTextContent('study-guide-7-short-answer')
    expect(finalMapping).toHaveTextContent('study-guide-7-multiple-choice')
    expect(finalMapping).toHaveTextContent('study-guide-7-flashcard')
  })

  it('blocks Deep Study Guide when Local AI is selected', async () => {
    vi.mocked(readStudyPackAiSettings).mockReturnValue({
      provider: 'local',
      apiToken: '',
      model: 'gemini-test',
    })
    vi.mocked(resolveStudyPackAiCredentials).mockReturnValue({
      provider: 'local',
      apiToken: '',
      model: 'gemini-test',
      tokenSource: 'none',
    })
    render(
      <CreateStudyPathModal open onClose={vi.fn()} onCreatePath={vi.fn()} />,
    )

    expect(
      screen.getByText(/Super small usually takes 12-15 min/i),
    ).toBeInTheDocument()
    fireEvent.mouseDown(screen.getByRole('combobox', { name: /path depth/i }))
    expect(
      screen.getByRole('option', {
        name: /Super small - 2 lesson dashboards/i,
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('option', { name: /Compact - 3 lesson dashboards/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('option', { name: /Average - 5 lesson dashboards/i }),
    ).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /Deep/i })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
  })

  it('shows Local AI failure debug after failed Study Guide generation', async () => {
    vi.mocked(readStudyPackAiSettings).mockReturnValue({
      provider: 'local',
      apiToken: '',
      model: 'gemini-test',
    })
    vi.mocked(resolveStudyPackAiCredentials).mockReturnValue({
      provider: 'local',
      apiToken: '',
      model: 'gemini-test',
      tokenSource: 'none',
    })
    const prompt = vi
      .fn()
      .mockResolvedValueOnce(
        JSON.stringify({
          title: 'Italian B1',
          folderName: 'Italian B1',
          dashboards: [
            {
              title: '01 - Modal verbs',
              goal: 'Learn modal verbs.',
              topics: ['potere', 'dovere'],
              avoid: ['summary dashboard'],
            },
            {
              title: '02 - Practice contexts',
              goal: 'Use modal verbs in context.',
              topics: ['travel', 'study'],
              avoid: ['exercises-only dashboard'],
            },
          ],
        }),
      )
      .mockResolvedValueOnce('{"title":"Broken",')
      .mockResolvedValueOnce('{"title":"Broken again",')
      .mockResolvedValueOnce('{"title":"Broken final",')
    vi.stubGlobal('LanguageModel', {
      availability: vi.fn().mockResolvedValue('available'),
      create: vi.fn().mockResolvedValue({ prompt, destroy: vi.fn() }),
    })

    render(
      <CreateStudyPathModal open onClose={vi.fn()} onCreatePath={vi.fn()} />,
    )

    fireEvent.mouseDown(
      screen.getByRole('combobox', { name: /local ai concurrency/i }),
    )
    fireEvent.click(
      screen.getByRole('option', { name: /1 dashboard at once/i }),
    )

    fireEvent.change(
      screen.getByRole('textbox', { name: /what should StudyMesh teach/i }),
      {
        target: { value: 'Teach Italian B1 modal verbs' },
      },
    )
    fireEvent.click(
      screen.getByRole('button', { name: /generate study guide/i }),
    )

    expect(
      await screen.findByText(/could not map it into widgets/i),
    ).toBeInTheDocument()
    expect(screen.getByText('Local AI failure debug')).toBeInTheDocument()
    expect(
      screen.getByTestId('local-ai-failure-debug-raw-dashboard-response'),
    ).toHaveTextContent('{"title":"Broken final",')
    expect(
      screen.getByTestId('local-ai-failure-debug-mapping-error'),
    ).toHaveTextContent(/JSON instead of Markdown notes/i)
    expect(
      screen.getByTestId('local-ai-failure-debug-failed-attempts'),
    ).toHaveTextContent('Broken')
  })

  it('creates Local AI Study Guide dashboards with visible lesson widgets', async () => {
    vi.mocked(readStudyPackAiSettings).mockReturnValue({
      provider: 'local',
      apiToken: '',
      model: 'gemini-test',
    })
    vi.mocked(resolveStudyPackAiCredentials).mockReturnValue({
      provider: 'local',
      apiToken: '',
      model: 'gemini-test',
      tokenSource: 'none',
    })
    const onCreatePath = vi.fn()
    const sectionMarkdown = (heading: string, focus: string) => `## ${heading}

### Core meanings
- **Routine phrase**: ${focus} gives students language they can reuse in short daily situations.
- **Time marker**: choose a phrase that matches morning, evening, travel, or direction context.
- **Verb position**: keep the verb pattern clear before changing names, places, or times.

### When to use each one
- Use short examples for quick speaking practice.
- Use polite forms with staff or strangers.
- Check word order before answering practice questions.`
    const prompt = vi
      .fn()
      .mockResolvedValueOnce(
        JSON.stringify({
          title: 'German A2',
          folderName: 'German A2',
          dashboards: [
            {
              title: '01 - Everyday routines',
              goal: 'Talk about routines.',
              sections: [
                {
                  title: 'Time phrases',
                  goal: 'Explain routine time phrases.',
                },
                {
                  title: 'Separable verbs',
                  goal: 'Show routine examples and mistakes.',
                },
              ],
              avoid: ['summary dashboard'],
            },
            {
              title: '02 - Travel basics',
              goal: 'Handle travel situations.',
              sections: [
                {
                  title: 'Tickets',
                  goal: 'Explain ticket request phrases.',
                },
                {
                  title: 'Directions',
                  goal: 'Show directions examples and mistakes.',
                },
              ],
              avoid: ['exercises-only dashboard'],
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        sectionMarkdown(
          'Time phrases',
          'German A2 routines use time phrases like jeden Morgen',
        ),
      )
      .mockResolvedValueOnce(
        sectionMarkdown('Separable verbs', 'Separable verbs describe routines'),
      )
      .mockResolvedValueOnce(
        JSON.stringify({
          flashcards: [
            {
              question: 'What does jeden Morgen mean?',
              answer: 'Every morning.',
            },
            {
              question: 'Where does a separable prefix go?',
              answer: 'To the end in simple present main clauses.',
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        JSON.stringify({
          quizzes: [
            {
              question: 'Which phrase means every morning?',
              options: ['jeden Morgen', 'gestern Abend', 'naechste Woche'],
              correctIndex: 0,
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        sectionMarkdown('Tickets', 'German A2 travel uses ticket requests'),
      )
      .mockResolvedValueOnce(
        sectionMarkdown('Directions', 'Direction phrases help find stations'),
      )
      .mockResolvedValueOnce(
        JSON.stringify({
          flashcards: [
            {
              question: 'What should travel requests be?',
              answer: 'Polite and short.',
            },
            {
              question: 'What is the lesson focus?',
              answer: 'Tickets and directions.',
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        JSON.stringify({
          quizzes: [
            {
              question: 'What is useful in travel situations?',
              options: ['directions', 'advanced poetry', 'chemical symbols'],
              correctIndex: 0,
            },
          ],
        }),
      )
    vi.stubGlobal('LanguageModel', {
      availability: vi.fn().mockResolvedValue('available'),
      create: vi.fn().mockResolvedValue({ prompt, destroy: vi.fn() }),
    })

    render(
      <CreateStudyPathModal
        open
        onClose={vi.fn()}
        onCreatePath={onCreatePath}
      />,
    )

    fireEvent.mouseDown(
      screen.getByRole('combobox', { name: /local ai concurrency/i }),
    )
    fireEvent.click(
      screen.getByRole('option', { name: /1 dashboard at once/i }),
    )

    fireEvent.change(
      screen.getByRole('textbox', { name: /what should StudyMesh teach/i }),
      {
        target: { value: 'German A2' },
      },
    )
    fireEvent.click(
      screen.getByRole('button', { name: /generate study guide/i }),
    )

    await waitFor(() => {
      expect(screen.getByText('02 - Travel basics')).toBeInTheDocument()
    })

    fireEvent.click(
      screen.getByRole('button', { name: /^create 2 dashboards$/i }),
    )

    expect(onCreatePath).toHaveBeenCalledTimes(1)
    const payload = onCreatePath.mock.calls[0][0]
    const firstDashboardWidgets = JSON.stringify(payload.dashboards[0].widgets)

    expect(firstDashboardWidgets).toContain('Lesson')
    expect(firstDashboardWidgets).toContain(
      'German A2 routines use time phrases',
    )
    expect(firstDashboardWidgets).not.toContain('QuizCarouselBlock')
    expect(firstDashboardWidgets).not.toContain('FlashcardCarouselBlock')
    expect(firstDashboardWidgets).not.toContain('"Chart"')
    expect(firstDashboardWidgets).not.toContain('Summary')
  })
})
