import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import StudyBlockView from '../../../../src/components/study/StudyBlockView'
import StudyGuideLinearLayout from '../../../../src/components/Dasboard/StudyGuideLinearLayout'
import {
  LEARNED_TOPIC_PROMPTS_STORAGE_KEY,
  PROFILE_CONTEXT_STORAGE_KEY,
  readProfileContext,
  saveProfileContext,
} from '../../../../src/profileContext'
import { START_NEXT_STUDY_GUIDE_EVENT } from '../../../../src/components/workspace/workspaceEvents'

/**
 * The guide's topic is earned at the end of a quiz rather than handed out for
 * having opened every page. These cover the three score bands and the two ways
 * the offer stays suppressed.
 *
 * Option labels are deliberately neutral: the quiz feedback copy includes the
 * strings "Right answer" and "Wrong answer", so using those as options would
 * make every text query ambiguous.
 */
const QUESTION_COUNT = 4

const NEXT_GUIDE_IDEAS = [
  { label: 'Queueing theory', prompt: 'Teach me how queueing theory works.' },
  { label: 'Little law', prompt: 'Teach me how Little’s law works.' },
]

const quizProps = () => ({
  title: 'Bottlenecks quiz',
  studyPathId: 'guide-1',
  studyPathTitle: 'Bottlenecks',
  studyPathDashboardKey: 'review',
  studyPathNextGuideIdeas: NEXT_GUIDE_IDEAS,
  items: Array.from({ length: QUESTION_COUNT }, (_, index) => ({
    question: `Question ${index + 1}?`,
    options: ['Alpha', 'Beta'],
    correctIndex: 0,
  })),
})

/** Answers the first `correctAnswers` questions with Alpha and the rest Beta. */
const completeQuiz = async (correctAnswers: number) => {
  for (let index = 0; index < QUESTION_COUNT; index += 1) {
    fireEvent.click(
      await screen.findByText(index < correctAnswers ? 'Alpha' : 'Beta'),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
  }
}

const renderQuiz = () =>
  render(<StudyBlockView type="QuizCarouselBlock" props={quizProps()} />)

/**
 * The real path a reader takes. Guides are generated with the quiz carousel
 * carrying no study path props of its own, so the view has to hand the guide
 * identity down or the offer never appears.
 */
const renderQuizInsideGuidePage = () => {
  const { studyPathId, studyPathTitle, studyPathDashboardKey, ...blockProps } =
    quizProps()
  void studyPathId
  void studyPathTitle
  void studyPathDashboardKey

  return render(
    <StudyGuideLinearLayout
      studyPathContext={{
        studyPathId: 'guide-1',
        studyPathTitle: 'Bottlenecks',
        studyPathDashboardKey: 'review',
      }}
      layout={{
        type: 'row',
        children: [
          {
            type: 'tabset',
            children: [
              {
                type: 'tab',
                component: 'CustomWidget',
                config: {
                  customProps: {
                    components: [
                      {
                        id: 'quiz-block',
                        type: 'QuizCarouselBlock',
                        props: blockProps,
                      },
                    ],
                  },
                },
              },
            ],
          },
        ],
      }}
    />,
  )
}

describe('learned topic offer at the end of a quiz', () => {
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
    vi.mocked(localStorage.removeItem).mockImplementation((key: string) => {
      delete storage[key]
    })
    vi.mocked(window.matchMedia).mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
  })

  it('offers the topic on its own above the confident score', async () => {
    renderQuiz()
    await completeQuiz(4)

    const addButton = await screen.findByRole('button', {
      name: 'Add to what I know',
    })
    // 100%: nothing to warn about, so no note rides along with the button.
    expect(
      screen.queryByText(/another pass over the pages/i),
    ).not.toBeInTheDocument()
    expect(readProfileContext()).toBeNull()

    fireEvent.click(addButton)

    await waitFor(() => {
      expect(readProfileContext()?.specificKnowledge).toEqual(['Bottlenecks'])
    })
    expect(JSON.parse(storage[LEARNED_TOPIC_PROMPTS_STORAGE_KEY])).toEqual({
      'guide-1': 'added',
    })
    expect(screen.getByText(/is part of what you know now/i)).toBeInTheDocument()
  })

  it('offers the topic with a revise note inside the middle band', async () => {
    renderQuiz()
    await completeQuiz(2)

    expect(
      await screen.findByRole('button', { name: 'Add to what I know' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/another pass over the pages/i)).toBeInTheDocument()
  })

  it('offers nothing below the score floor', async () => {
    renderQuiz()
    await completeQuiz(1)

    expect(await screen.findByText(/quiz complete/i)).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Add to what I know' }),
    ).not.toBeInTheDocument()
    expect(storage[PROFILE_CONTEXT_STORAGE_KEY]).toBeUndefined()
  })

  it('stays quiet when the topic is already declared knowledge', async () => {
    saveProfileContext({
      roles: [],
      broadKnowledge: [],
      specificKnowledge: ['bottlenecks'],
    })

    renderQuiz()
    await completeQuiz(4)

    expect(await screen.findByText(/quiz complete/i)).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Add to what I know' }),
    ).not.toBeInTheDocument()
  })

  it('offers the topic for a quiz that carries no study path props of its own', async () => {
    // Regression: generated guides build the quiz carousel without them, so
    // reading the guide identity off the block alone showed nothing at all.
    renderQuizInsideGuidePage()
    await completeQuiz(4)

    fireEvent.click(
      await screen.findByRole('button', { name: 'Add to what I know' }),
    )

    await waitFor(() => {
      expect(readProfileContext()?.specificKnowledge).toEqual(['Bottlenecks'])
    })
  })

  it('stays quiet once the guide has already resolved its offer', async () => {
    storage[LEARNED_TOPIC_PROMPTS_STORAGE_KEY] = JSON.stringify({
      'guide-1': 'dismissed',
    })

    renderQuiz()
    await completeQuiz(4)

    expect(await screen.findByText(/quiz complete/i)).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Add to what I know' }),
    ).not.toBeInTheDocument()
  })
})

describe('follow-up guides offered after the topic is claimed', () => {
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
    vi.mocked(localStorage.removeItem).mockImplementation((key: string) => {
      delete storage[key]
    })
  })

  it('stays hidden until the topic is claimed, because the bridge needs it', async () => {
    renderQuiz()
    await completeQuiz(4)

    expect(
      await screen.findByRole('button', { name: 'Add to what I know' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Queueing theory' }),
    ).not.toBeInTheDocument()
  })

  it('asks for the next guide with the claimed skill named as the bridge', async () => {
    const startNextGuide = vi.fn()
    window.addEventListener(START_NEXT_STUDY_GUIDE_EVENT, startNextGuide)

    renderQuiz()
    await completeQuiz(4)
    fireEvent.click(
      await screen.findByRole('button', { name: 'Add to what I know' }),
    )
    fireEvent.click(
      await screen.findByRole('button', { name: 'Queueing theory' }),
    )

    expect(startNextGuide).toHaveBeenCalledTimes(1)
    expect(
      (startNextGuide.mock.calls[0][0] as CustomEvent<{ prompt: string }>)
        .detail.prompt,
    ).toBe(
      'Teach me how queueing theory works.\n\nExplain it through Bottlenecks, which I know.',
    )

    window.removeEventListener(START_NEXT_STUDY_GUIDE_EVENT, startNextGuide)
  })

  it('shows nothing extra for a guide generated without follow-up ideas', async () => {
    const { studyPathNextGuideIdeas, ...props } = quizProps()
    void studyPathNextGuideIdeas
    render(<StudyBlockView type="QuizCarouselBlock" props={props} />)
    await completeQuiz(4)
    fireEvent.click(
      await screen.findByRole('button', { name: 'Add to what I know' }),
    )

    expect(
      await screen.findByText(/is part of what you know now/i),
    ).toBeInTheDocument()
    expect(
      screen.queryByText('Learn something new on top of it'),
    ).not.toBeInTheDocument()
  })
})
