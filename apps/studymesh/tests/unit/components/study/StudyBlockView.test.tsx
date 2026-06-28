import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import StudyBlockView from '../../../../src/components/study/StudyBlockView'

describe('StudyBlockView quiz feedback', () => {
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
    fireEvent.click(screen.getByRole('button', { name: 'Une traversee' }))

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

    fireEvent.click(screen.getByRole('button', { name: 'Une traversee' }))
    fireEvent.click(screen.getByRole('button', { name: 'Explain' }))

    expect(onAskAi).toHaveBeenCalledWith(
      "I am taking a quiz on this material and was given this question: 'Which term best describes a long journey that includes many different tourist stops or stages along the way?'\n\nI chose this as the answer: 'Une traversee'\n\nThat answer was incorrect. The correct answer is 'Un periple'\n\nHelp me understand why my answer was incorrect.",
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

    fireEvent.click(screen.getByRole('button', { name: 'Une traversee' }))
    fireEvent.click(screen.getByRole('button', { name: 'Un periple' }))
    expect(screen.getByText('Correct 0')).toBeInTheDocument()
    expect(screen.getByText('Wrong 1')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))

    expect(screen.getByText('You did it! Quiz complete.')).toBeInTheDocument()
    expect(screen.getByText('Skipped')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Retake quiz' }))
    expect(
      screen.queryByText('You did it! Quiz complete.'),
    ).not.toBeInTheDocument()
    expect(screen.getByText('Answered 0/2')).toBeInTheDocument()
  })
})
