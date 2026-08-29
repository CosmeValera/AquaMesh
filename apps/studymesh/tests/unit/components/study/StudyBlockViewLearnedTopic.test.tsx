import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import StudyBlockView from '../../../../src/components/study/StudyBlockView'
import StudyGuideLinearLayout from '../../../../src/components/Dasboard/StudyGuideLinearLayout'
import {
  PROFILE_CONTEXT_STORAGE_KEY,
  readProfileContext,
  saveProfileContext,
} from '../../../../src/profileContext'
import { START_NEXT_STUDY_GUIDE_EVENT } from '../../../../src/components/workspace/workspaceEvents'

/**
 * The guide's topic is earned at the end of a quiz rather than handed out for
 * having opened every page. A guide always shows the same single skill and the
 * same follow-ups; what is already done is disabled, never hidden.
 *
 * Option labels are deliberately neutral: the quiz feedback copy includes the
 * strings "Right answer" and "Wrong answer", so using those as options would
 * make every text query ambiguous.
 */
const QUESTION_COUNT = 4

const NEXT_GUIDE_IDEAS = [
  {
    axis: 'curiosity',
    label: 'Why queues stall',
    prompt: 'Teach me why queues stall.',
  },
  {
    axis: 'utility',
    label: 'Measuring throughput',
    prompt: 'Teach me how to measure throughput.',
  },
]

const quizProps = () => ({
  title: 'Bottlenecks quiz',
  studyPathId: 'guide-1',
  studyPathTitle: 'Bottlenecks',
  studyPathDashboardKey: 'review',
  studyPathLearnedSkillOptions: ['Flow constraints'],
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

const renderQuiz = (overrides: Record<string, unknown> = {}) =>
  render(
    <StudyBlockView
      type="QuizCarouselBlock"
      props={{ ...quizProps(), ...overrides }}
    />,
  )

/**
 * The real path a reader takes. Guides are generated with the quiz carousel
 * carrying no study path props of its own, so the view has to hand the guide
 * identity down or the offer never appears.
 */
const renderQuizInsideGuidePage = () => {
  const {
    studyPathId,
    studyPathTitle,
    studyPathLearnedSkillOptions,
    studyPathDashboardKey,
    ...blockProps
  } = quizProps()
  void studyPathId
  void studyPathDashboardKey

  return render(
    <StudyGuideLinearLayout
      studyPathContext={{
        studyPathId: 'guide-1',
        studyPathTitle,
        studyPathLearnedSkillOptions,
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

const mockLocalStorage = () => {
  const storage: Record<string, string> = {}
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

  return storage
}

describe('learned topic offer at the end of a quiz', () => {
  let storage: Record<string, string>

  beforeEach(() => {
    storage = mockLocalStorage()
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
      expect(readProfileContext()?.specificKnowledge).toEqual([
        'Flow constraints',
      ])
    })
    expect(
      screen.getByText(/is part of what you know now/i),
    ).toBeInTheDocument()
  })

  it('offers the topic with a revise note inside the middle band', async () => {
    renderQuiz()
    await completeQuiz(2)

    expect(
      await screen.findByRole('button', { name: 'Add to what I know' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/another pass over the pages/i)).toBeInTheDocument()
  })

  it('offers no skill below the score floor', async () => {
    renderQuiz()
    await completeQuiz(1)

    expect(await screen.findByText(/quiz complete/i)).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Add to what I know' }),
    ).not.toBeInTheDocument()
    expect(storage[PROFILE_CONTEXT_STORAGE_KEY]).toBeUndefined()
  })

  it('shows the claimed state instead of hiding a topic already known', async () => {
    saveProfileContext({
      roles: [],
      broadKnowledge: [],
      specificKnowledge: ['flow constraints'],
    })

    renderQuiz()
    await completeQuiz(4)

    expect(
      await screen.findByText(/is part of what you know now/i),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Add to what I know' }),
    ).toBeDisabled()
  })

  it('claims the skill the guide names, not the guide title', async () => {
    renderQuizInsideGuidePage()
    await completeQuiz(4)

    fireEvent.click(
      await screen.findByRole('button', { name: 'Add to what I know' }),
    )

    await waitFor(() => {
      expect(readProfileContext()?.specificKnowledge).toEqual([
        'Flow constraints',
      ])
    })
  })

  it('falls back to the guide title for a guide generated without a skill', async () => {
    renderQuiz({ studyPathLearnedSkillOptions: undefined })
    await completeQuiz(4)

    fireEvent.click(
      await screen.findByRole('button', { name: 'Add to what I know' }),
    )

    await waitFor(() => {
      expect(readProfileContext()?.specificKnowledge).toEqual(['Bottlenecks'])
    })
  })

  it('shows one skill even when an older guide carries several', async () => {
    renderQuiz({
      studyPathLearnedSkillOptions: [
        'Flow constraints',
        'Queue discipline',
        'Throughput limits',
      ],
    })
    await completeQuiz(4)

    expect(await screen.findByText('Flow constraints')).toBeInTheDocument()
    expect(screen.queryByText('Queue discipline')).not.toBeInTheDocument()
    expect(screen.queryByText('Throughput limits')).not.toBeInTheDocument()
  })
})

/** The cards carry both label and prompt, so the label alone locates them. */
const findIdeaCard = async (label: string) => {
  const heading = await screen.findByText(label)
  const card = heading.closest('[role="button"]')
  if (!card) {
    throw new Error(`No idea card around "${label}"`)
  }

  return card
}

const promptsFromEvent = (listener: ReturnType<typeof vi.fn>): string[] =>
  (listener.mock.calls[0][0] as CustomEvent<{ prompts: string[] }>).detail
    .prompts

const claimFlowConstraints = () =>
  saveProfileContext({
    roles: [],
    broadKnowledge: [],
    specificKnowledge: ['Flow constraints'],
  })

describe('follow-up guides offered beside the skill', () => {
  beforeEach(() => {
    mockLocalStorage()
  })

  it('stands beside the un-claimed skill instead of waiting for it', async () => {
    renderQuiz()
    await completeQuiz(4)

    expect(
      await screen.findByRole('button', { name: 'Add to what I know' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Why queues stall')).toBeInTheDocument()
  })

  it('claims the skill when guides are created from the un-claimed state', async () => {
    const startNextGuide = vi.fn()
    window.addEventListener(START_NEXT_STUDY_GUIDE_EVENT, startNextGuide)

    renderQuiz()
    await completeQuiz(4)
    fireEvent.click(await findIdeaCard('Why queues stall'))
    fireEvent.click(screen.getByRole('button', { name: /Create 1 guides/ }))

    await waitFor(() => {
      expect(readProfileContext()?.specificKnowledge).toEqual([
        'Flow constraints',
      ])
    })
    expect(promptsFromEvent(startNextGuide)[0]).toContain(
      'Explain it through Flow constraints',
    )
    expect(
      screen.getByText(/is part of what you know now/i),
    ).toBeInTheDocument()

    window.removeEventListener(START_NEXT_STUDY_GUIDE_EVENT, startNextGuide)
  })

  it('offers the ideas below the score floor without claiming or bridging', async () => {
    const startNextGuide = vi.fn()
    window.addEventListener(START_NEXT_STUDY_GUIDE_EVENT, startNextGuide)

    renderQuiz()
    await completeQuiz(1)
    fireEvent.click(await findIdeaCard('Why queues stall'))
    fireEvent.click(screen.getByRole('button', { name: /Create 1 guides/ }))

    expect(promptsFromEvent(startNextGuide)).toEqual([
      'Teach me why queues stall.',
    ])
    expect(readProfileContext()).toBeNull()

    window.removeEventListener(START_NEXT_STUDY_GUIDE_EVENT, startNextGuide)
  })

  it('drops the auto-claim note once the skill is claimed', async () => {
    renderQuiz()
    await completeQuiz(4)

    expect(
      await screen.findByText(/also adds Flow constraints to what you know/i),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Add to what I know' }))

    expect(
      screen.queryByText(/also adds Flow constraints to what you know/i),
    ).not.toBeInTheDocument()
  })

  it('is already on screen when the topic was claimed in an earlier session', async () => {
    claimFlowConstraints()

    renderQuiz()
    await completeQuiz(4)

    expect(await screen.findByText('Why queues stall')).toBeInTheDocument()
  })

  it('shows the whole prompt on the card instead of hiding it in a hover', async () => {
    claimFlowConstraints()

    renderQuiz()
    await completeQuiz(4)

    expect(
      await screen.findByText('Teach me why queues stall.'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Teach me how to measure throughput.'),
    ).toBeInTheDocument()
  })

  it('selects on click rather than creating, and only creates on the button', async () => {
    const startNextGuide = vi.fn()
    window.addEventListener(START_NEXT_STUDY_GUIDE_EVENT, startNextGuide)
    claimFlowConstraints()

    renderQuiz()
    await completeQuiz(4)
    fireEvent.click(await findIdeaCard('Why queues stall'))

    expect(startNextGuide).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: /Create 1 guides/ }))

    expect(startNextGuide).toHaveBeenCalledTimes(1)
    expect(promptsFromEvent(startNextGuide)).toEqual([
      'Teach me why queues stall.\n\nExplain it through Flow constraints, which I already know. Do not re-explain Flow constraints itself.',
    ])

    window.removeEventListener(START_NEXT_STUDY_GUIDE_EVENT, startNextGuide)
  })

  it('sends every selected idea in one event', async () => {
    const startNextGuide = vi.fn()
    window.addEventListener(START_NEXT_STUDY_GUIDE_EVENT, startNextGuide)
    claimFlowConstraints()

    renderQuiz()
    await completeQuiz(4)
    fireEvent.click(await findIdeaCard('Why queues stall'))
    fireEvent.click(await findIdeaCard('Measuring throughput'))
    fireEvent.click(screen.getByRole('button', { name: /Create 2 guides/ }))

    expect(startNextGuide).toHaveBeenCalledTimes(1)
    expect(promptsFromEvent(startNextGuide)).toHaveLength(2)

    window.removeEventListener(START_NEXT_STUDY_GUIDE_EVENT, startNextGuide)
  })

  it('cannot select an idea whose guide the reader already created', async () => {
    claimFlowConstraints()

    // The guide view resolves this against the guide store and hands it down.
    renderQuiz({
      studyPathCreatedNextIdeaPrompts: ['Teach me why queues stall.'],
    })
    await completeQuiz(4)

    const created = await findIdeaCard('Why queues stall')
    expect(created).toHaveAttribute('aria-disabled', 'true')

    fireEvent.click(created)

    expect(
      screen.getByRole('button', { name: /Create 0 guides/ }),
    ).toBeDisabled()
  })

  it('shows nothing extra for a guide generated without follow-up ideas', async () => {
    renderQuiz({ studyPathNextGuideIdeas: undefined })
    await completeQuiz(4)

    expect(
      await screen.findByRole('button', { name: 'Add to what I know' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByText('Learn something new on top of it'),
    ).not.toBeInTheDocument()
  })
})
