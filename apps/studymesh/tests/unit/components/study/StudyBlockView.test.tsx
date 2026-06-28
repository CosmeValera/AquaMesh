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
                    'This means crossing an expanse, not a multi-stage trip.',
                },
                {
                  option: 'Un periple',
                  explanation:
                    'This is the term for a long journey with stages.',
                },
              ],
            },
          ],
        }}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Hint' }))
    expect(
      screen.getByText('Think about a journey with several stops.'),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Une traversee' }))

    expect(
      screen.getByText(
        'This means crossing an expanse, not a multi-stage trip.',
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByText('This is the term for a long journey with stages.'),
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
})
