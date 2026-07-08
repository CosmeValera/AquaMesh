import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import StudyBlockView from '../../../../src/components/study/StudyBlockView'

describe('StudyBlockView quiz feedback', () => {
  beforeEach(() => {
    const storage = new Map<string, string>()
    vi.mocked(window.localStorage.getItem).mockImplementation(
      (key) => storage.get(key) ?? null,
    )
    vi.mocked(window.localStorage.setItem).mockImplementation((key, value) => {
      storage.set(key, value)
    })
    vi.mocked(window.localStorage.removeItem).mockImplementation((key) => {
      storage.delete(key)
    })
    vi.mocked(window.localStorage.clear).mockImplementation(() => {
      storage.clear()
    })
    window.localStorage.clear()
  })

  it('renders markdown and code-like identifiers inside context bridge notes', () => {
    const { container } = render(
      <StudyBlockView
        type="StudyNoteBlock"
        props={{
          contextBridge: true,
          title: 'React **useState** vs Vue ref/reactive',
          text: 'Use **state**, *effects*, `setCount`, ref(), and count.value as examples.',
          suggestedTypes: [],
        }}
      />,
    )

    expect(screen.getByText('Context Bridge')).toBeInTheDocument()
    expect(container.querySelector('strong')?.textContent).toBe('useState')
    expect(container.querySelector('em')?.textContent).toBe('effects')
    expect(
      [...container.querySelectorAll('code')].map((node) => node.textContent),
    ).toEqual(expect.arrayContaining(['setCount', 'ref()', 'count.value']))
    expect(container.textContent).not.toContain('**')
  })

  it('lets markdown task checkboxes toggle and persist locally', () => {
    const props = {
      title: 'Task notes',
      markdown: '- [ ] Read the page\n- [x] Review the quiz',
      studyPathId: 'guide-1',
      studyPathDashboardKey: 'page-1',
    }
    const { unmount } = render(
      <StudyBlockView type="MarkdownBlock" props={props} />,
    )

    const readCheckbox = screen.getByRole('checkbox', {
      name: 'Read the page',
    })
    const reviewCheckbox = screen.getByRole('checkbox', {
      name: 'Review the quiz',
    })
    expect(readCheckbox).not.toBeChecked()
    expect(reviewCheckbox).toBeChecked()

    fireEvent.click(readCheckbox)
    fireEvent.click(reviewCheckbox)
    expect(readCheckbox).toBeChecked()
    expect(reviewCheckbox).not.toBeChecked()

    unmount()
    render(<StudyBlockView type="MarkdownBlock" props={props} />)

    expect(
      screen.getByRole('checkbox', { name: 'Read the page' }),
    ).toBeChecked()
    expect(
      screen.getByRole('checkbox', { name: 'Review the quiz' }),
    ).not.toBeChecked()
  })

  it('keeps interactive list checks across remounts', () => {
    const props = {
      title: 'Practice checklist',
      items: 'Create quiz\nAsk AI chat',
      interactiveChecklist: true,
      studyPathId: 'guide-1',
      studyPathDashboardKey: 'page-2',
    }
    const { unmount } = render(
      <StudyBlockView type="ListBlock" props={props} />,
    )

    fireEvent.click(screen.getByRole('checkbox', { name: 'Create quiz' }))
    expect(screen.getByRole('checkbox', { name: 'Create quiz' })).toBeChecked()

    unmount()
    render(<StudyBlockView type="ListBlock" props={props} />)

    expect(screen.getByRole('checkbox', { name: 'Create quiz' })).toBeChecked()
    expect(
      screen.getByRole('checkbox', { name: 'Ask AI chat' }),
    ).not.toBeChecked()
  })

  it('renders markdown inside quiz questions, options, and feedback', () => {
    const { container } = render(
      <StudyBlockView
        type="QuizBlock"
        props={{
          question: 'How does **state** update?',
          options: ['**setState** changes state', '`useState` stores state'],
          correctIndex: 1,
          answer: '`useState` stores state',
          explanation: '**useState** keeps local component state.',
          optionFeedback: [
            {
              option: '**setState** changes state',
              explanation: 'Incorrect - class-style **state** helper.',
            },
            {
              option: '`useState` stores state',
              explanation: 'Correct - hook-based `state` helper.',
            },
          ],
        }}
      />,
    )

    fireEvent.click(
      screen.getByRole('button', { name: 'A. setState changes state' }),
    )

    expect(container.textContent).not.toContain('**')
    expect(
      [...container.querySelectorAll('strong')].map((node) => node.textContent),
    ).toEqual(expect.arrayContaining(['state', 'setState', 'useState']))
    expect(
      [...container.querySelectorAll('code')].map((node) => node.textContent),
    ).toEqual(expect.arrayContaining(['useState', 'state']))
  })

  it('cleans malformed markdown artifacts in focused quiz cards', () => {
    const { container } = render(
      <StudyBlockView
        type="QuizCarouselBlock"
        props={{
          title: 'Core topics',
          items: [
            {
              question: 'How would you apply - **State in a new example?',
              options: [
                '- **State (useState)**: Local data that triggers re-renders.',
                '- JSX: Syntax that blends HTML-like markup.',
              ],
              correctIndex: 0,
              answer: 'State (useState)',
            },
          ],
        }}
      />,
    )

    expect(
      screen.getByText('How would you apply State in a new example?'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', {
        name: /A\. State \(useState\)\s*: Local data/,
      }),
    ).toBeInTheDocument()
    expect(container.textContent).not.toContain('**')
    expect(container.textContent).not.toContain('A. -')
  })

  it('shows hints before answering and option feedback after answering', () => {
    render(
      <StudyBlockView
        type="QuizCarouselBlock"
        props={{
          title: 'Travel vocabulary',
          items: [
            {
              question:
                'Which term best describes a long trip with many stages?',
              options: ['Une traversee', 'Un periple', 'Une escapade'],
              correctIndex: 1,
              answer: 'Un periple',
              explanation: 'Un periple means a long multi-stage journey.',
              hint: 'Think about a journey with several stops.',
              optionFeedback: [
                {
                  option: 'Une traversee',
                  explanation:
                    'Incorrect - this means crossing an expanse, not a multi-stage trip.',
                },
                {
                  option: 'Un periple',
                  explanation:
                    'Correct - this is the term for a long journey with stages.',
                },
              ],
            },
            {
              question: 'Which term describes a stop during air travel?',
              options: ['Une escale', 'Une ascension', 'Une escapade'],
              correctIndex: 0,
              answer: 'Une escale',
              explanation: 'Une escale is a stopover.',
              hint: 'Think of a stop before the final destination.',
            },
          ],
        }}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Hint' }))
    expect(
      screen.getByText('Think about a journey with several stops.'),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(
      screen.queryByText('Think about a journey with several stops.'),
    ).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Previous' }))
    expect(
      screen.getByRole('button', { name: /A\. Une traversee/ }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /B\. Un periple/ }),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /A\. Une traversee/ }))

    expect(
      screen.getByText(
        'this means crossing an expanse, not a multi-stage trip.',
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByText('this is the term for a long journey with stages.'),
    ).toBeInTheDocument()
  })

  it('sends incorrect quiz attempts to AI chat with the expected prompt', () => {
    const onAskAi = vi.fn()

    render(
      <StudyBlockView
        type="QuizCarouselBlock"
        onAskAi={onAskAi}
        props={{
          title: 'Travel vocabulary',
          items: [
            {
              question:
                'Which term best describes a long journey that includes many different tourist stops or stages along the way?',
              options: ['Une traversee', 'Un periple', 'Une escapade'],
              correctIndex: 1,
              answer: 'Un periple',
              explanation: 'Un periple means a long multi-stage journey.',
            },
          ],
        }}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /A\. Une traversee/ }))
    const explainButton = screen.getByRole('button', { name: /Explain/ })
    expect(explainButton).toHaveTextContent('Explain')
    expect(explainButton).not.toHaveTextContent('1')
    fireEvent.click(explainButton)

    expect(onAskAi).toHaveBeenCalledWith(
      "I am taking a quiz on this material and was given this question: 'Which term best describes a long journey that includes many different tourist stops or stages along the way?'\n\nI chose this as the answer: 'Une traversee'\n\nThat answer was incorrect. The correct answer is 'Un periple'\n\nHelp me understand why my answer was incorrect.",
    )
  })

  it('sends turned flashcards to AI chat with the expected prompt', () => {
    const onAskAi = vi.fn()

    render(
      <StudyBlockView
        type="FlashcardBlock"
        onAskAi={onAskAi}
        props={{
          front: 'Terraform provider',
          back: 'A plugin that lets Terraform talk to a specific platform API.',
        }}
      />,
    )

    fireEvent.click(screen.getByText('Terraform provider'))
    fireEvent.click(screen.getByRole('button', { name: /Explain/ }))

    expect(onAskAi).toHaveBeenCalledWith(
      "I am studying this material with a flashcard.\n\nThe flashcard prompt is: 'Terraform provider'\n\nThe answer is: 'A plugin that lets Terraform talk to a specific platform API.'\n\nHelp me understand this answer and why it matches the prompt.",
    )
  })

  it('locks answered questions and shows completion results with retake', () => {
    render(
      <StudyBlockView
        type="QuizCarouselBlock"
        props={{
          title: 'Travel vocabulary',
          items: [
            {
              question:
                'Which term best describes a long trip with many stages?',
              options: ['Une traversee', 'Un periple', 'Une escapade'],
              correctIndex: 1,
              answer: 'Un periple',
              explanation: 'Un periple means a long multi-stage journey.',
            },
            {
              question: 'Which term describes a stop during air travel?',
              options: ['Une escale', 'Une ascension', 'Une escapade'],
              correctIndex: 0,
              answer: 'Une escale',
              explanation: 'Une escale is a stopover.',
            },
          ],
        }}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /A\. Une traversee/ }))
    fireEvent.click(screen.getByRole('button', { name: /B\. Un periple/ }))
    expect(screen.getByText('Not quite')).toBeInTheDocument()
    expect(screen.getByText('Right answer')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    fireEvent.click(screen.getByRole('button', { name: /A\. Une escale/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))

    expect(screen.getByText('You did it! Quiz complete.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Retake quiz' }))
    expect(
      screen.queryByText('You did it! Quiz complete.'),
    ).not.toBeInTheDocument()
    expect(
      screen.getByText(
        'Which term best describes a long trip with many stages?',
      ),
    ).toBeInTheDocument()
  })

  it('restores focused quiz progress after the quiz page remounts', () => {
    const props = {
      title: 'Travel vocabulary',
      items: [
        {
          question: 'Which term best describes a long trip with many stages?',
          options: ['Une traversee', 'Un periple', 'Une escapade'],
          correctIndex: 1,
          answer: 'Un periple',
          explanation: 'Un periple means a long multi-stage journey.',
        },
        {
          question: 'Which term describes a stop during air travel?',
          options: ['Une escale', 'Une ascension', 'Une escapade'],
          correctIndex: 0,
          answer: 'Une escale',
          explanation: 'Une escale is a stopover.',
        },
      ],
    }

    const firstRender = render(
      <StudyBlockView type="QuizCarouselBlock" props={props} />,
    )

    fireEvent.click(screen.getByRole('button', { name: /B\. Un periple/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    firstRender.unmount()

    render(<StudyBlockView type="QuizCarouselBlock" props={props} />)

    expect(
      screen.getByText('Which term describes a stop during air travel?'),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Previous' }))

    expect(
      screen.getByText(
        'Which term best describes a long trip with many stages?',
      ),
    ).toBeInTheDocument()
    expect(screen.getByText("That's right")).toBeInTheDocument()
  })

  it('restores focused flashcard progress after the flashcard page remounts', async () => {
    const props = {
      title: 'Terraform flashcards',
      items: [
        {
          question: 'Provider',
          answer: 'A plugin that talks to a platform API.',
        },
        {
          question: 'State',
          answer: 'A record of managed infrastructure.',
        },
        {
          question: 'Workspace',
          answer: 'An isolated state environment.',
        },
      ],
    }

    const firstRender = render(
      <StudyBlockView type="FlashcardCarouselBlock" props={props} />,
    )

    fireEvent.click(screen.getByText('Provider'))
    fireEvent.click(screen.getByRole('button', { name: 'Correct answer' }))
    await waitFor(() => expect(screen.getByText('State')).toBeInTheDocument())
    fireEvent.click(screen.getByText('State'))
    fireEvent.click(screen.getByRole('button', { name: 'Wrong answer' }))
    await waitFor(() =>
      expect(screen.getByText('Workspace')).toBeInTheDocument(),
    )
    fireEvent.click(screen.getByText('Workspace'))
    firstRender.unmount()

    render(<StudyBlockView type="FlashcardCarouselBlock" props={props} />)

    expect(screen.getByText('3 / 3')).toBeInTheDocument()
    expect(screen.getByText('Answered 2/3')).toBeInTheDocument()
    expect(screen.getByText('Known 1')).toBeInTheDocument()
    expect(screen.getByText('Missed 1')).toBeInTheDocument()
    expect(
      screen.getByText('An isolated state environment.'),
    ).toBeInTheDocument()
  })

  it('grades consecutive flashcards when the same grade button is clicked rapidly', () => {
    render(
      <StudyBlockView
        type="FlashcardCarouselBlock"
        props={{
          title: 'Terraform flashcards',
          items: [
            {
              question: 'Provider',
              answer: 'A plugin that talks to a platform API.',
            },
            {
              question: 'State',
              answer: 'A record of managed infrastructure.',
            },
            {
              question: 'Workspace',
              answer: 'An isolated state environment.',
            },
          ],
        }}
      />,
    )

    const correctButton = screen.getByRole('button', {
      name: 'Correct answer',
    })
    fireEvent.click(correctButton)
    fireEvent.click(correctButton)

    expect(screen.getByText('Workspace')).toBeInTheDocument()
    expect(screen.getByText('Answered 2/3')).toBeInTheDocument()
    expect(screen.getByText('Known 2')).toBeInTheDocument()
  })

  it('shows flashcard completion results with retake', async () => {
    render(
      <StudyBlockView
        type="FlashcardCarouselBlock"
        props={{
          title: 'Terraform flashcards',
          items: [
            {
              question: 'Provider',
              answer: 'A plugin that talks to a platform API.',
            },
            {
              question: 'State',
              answer: 'A record of managed infrastructure.',
            },
          ],
        }}
      />,
    )

    fireEvent.click(screen.getByText('Provider'))
    fireEvent.click(screen.getByRole('button', { name: 'Correct answer' }))
    await waitFor(() => expect(screen.getByText('State')).toBeInTheDocument())
    fireEvent.click(screen.getByText('State'))
    fireEvent.click(screen.getByRole('button', { name: 'Wrong answer' }))

    await waitFor(() =>
      expect(screen.getByText('Flashcards complete.')).toBeInTheDocument(),
    )
    expect(screen.getByText('Known')).toBeInTheDocument()
    expect(screen.getByText('Missed')).toBeInTheDocument()
    expect(screen.getByText('Skipped')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Practice again' }))
    expect(
      screen.getByRole('menuitem', { name: 'Only cards that you missed' }),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('menuitem', { name: 'All cards' }))
    expect(screen.queryByText('Flashcards complete.')).not.toBeInTheDocument()
    expect(screen.getByText('1 / 2')).toBeInTheDocument()
    expect(screen.getByText('Answered 0/2')).toBeInTheDocument()
    expect(screen.getByText('Provider')).toBeInTheDocument()
  })

  it('offers same cards when practicing a reduced flashcard stack', async () => {
    render(
      <StudyBlockView
        type="FlashcardCarouselBlock"
        props={{
          title: 'Terraform flashcards',
          items: [
            {
              question: 'Provider',
              answer: 'A plugin that talks to a platform API.',
            },
            {
              question: 'State',
              answer: 'A record of managed infrastructure.',
            },
            {
              question: 'Workspace',
              answer: 'An isolated state environment.',
            },
          ],
        }}
      />,
    )

    fireEvent.click(screen.getByText('Provider'))
    fireEvent.click(screen.getByRole('button', { name: 'Correct answer' }))
    await waitFor(() => expect(screen.getByText('State')).toBeInTheDocument())
    fireEvent.click(screen.getByText('State'))
    fireEvent.click(screen.getByRole('button', { name: 'Wrong answer' }))
    await waitFor(() =>
      expect(screen.getByText('Workspace')).toBeInTheDocument(),
    )
    fireEvent.click(screen.getByText('Workspace'))
    fireEvent.click(screen.getByRole('button', { name: 'Correct answer' }))

    await waitFor(() =>
      expect(screen.getByText('Flashcards complete.')).toBeInTheDocument(),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Practice again' }))
    expect(screen.queryByRole('menuitem', { name: 'Same cards' })).toBeNull()
    fireEvent.click(
      screen.getByRole('menuitem', { name: 'Only cards that you missed' }),
    )

    expect(screen.getByText('1 / 1')).toBeInTheDocument()
    expect(screen.getByText('State')).toBeInTheDocument()
    fireEvent.click(screen.getByText('State'))
    fireEvent.click(screen.getByRole('button', { name: 'Wrong answer' }))

    await waitFor(() =>
      expect(screen.getByText('Flashcards complete.')).toBeInTheDocument(),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Practice again' }))
    expect(
      screen.getByRole('menuitem', { name: 'All cards' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('menuitem', { name: 'Same cards' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('menuitem', { name: 'Only cards that you missed' }),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Same cards' }))

    expect(screen.getByText('1 / 1')).toBeInTheDocument()
    expect(screen.getByText('Answered 0/1')).toBeInTheDocument()
    expect(screen.getByText('State')).toBeInTheDocument()
  })
})
