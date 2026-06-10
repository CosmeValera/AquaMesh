/// <reference types="@testing-library/jest-dom" />
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import StudyBlockView from '../../../../src/components/WidgetEditor/components/preview/StudyBlockView'

describe('StudyBlockView', () => {
  beforeEach(() => {
    const storage = new Map<string, string>()
    vi.mocked(localStorage.getItem).mockImplementation(
      (key: string) => storage.get(key) || null,
    )
    vi.mocked(localStorage.setItem).mockImplementation(
      (key: string, value: string) => {
        storage.set(key, value)
      },
    )
    vi.mocked(localStorage.removeItem).mockImplementation((key: string) => {
      storage.delete(key)
    })
    vi.mocked(localStorage.clear).mockImplementation(() => storage.clear())
  })

  it('renders ListBlock items generated from quick creates', () => {
    render(
      <StudyBlockView
        type="ListBlock"
        props={{
          title: 'factory system changed work',
          items: 'time clocks / shifts\nrepetitive jobs\nwomen + kids working',
          ordered: false,
          interactiveChecklist: false,
        }}
      />,
    )

    expect(screen.getByText('factory system changed work')).toBeInTheDocument()
    expect(screen.getByText('time clocks / shifts')).toBeInTheDocument()
    expect(screen.getByText('repetitive jobs')).toBeInTheDocument()
    expect(screen.getByText('women + kids working')).toBeInTheDocument()
  })

  it('does not render duplicate review prompt text as the reason', () => {
    render(
      <StudyBlockView
        type="ReviewPromptBlock"
        props={{
          title: 'Review later',
          prompt:
            'need memorize: laissez-faire = gov stays out of business mostly.',
          reason:
            'need memorize: laissez-faire = gov stays out of business mostly.',
          status: 'needsReview',
        }}
      />,
    )

    expect(
      screen.getAllByText(
        'need memorize: laissez-faire = gov stays out of business mostly.',
      ),
    ).toHaveLength(1)
  })

  it('shows Study Guide quiz results without filled red or green buttons', () => {
    render(
      <StudyBlockView
        type="QuizBlock"
        props={{
          question: 'When is the subjunctive used?',
          quizMode: 'multipleChoice',
          options: ['Only for past events', 'For doubt or emotion'],
          correctIndex: 1,
          answer: 'For doubt or emotion',
          explanation: 'The subjunctive expresses doubt, wish, or emotion.',
        }}
      />,
    )

    const wrongButton = screen.getByRole('button', {
      name: 'Only for past events',
    })
    fireEvent.click(wrongButton)

    expect(wrongButton).toHaveClass('MuiButton-outlined')
  })

  it('renders flashcard carousel with one card and grade counters', () => {
    render(
      <StudyBlockView
        type="FlashcardCarouselBlock"
        props={{
          title: 'History Flashcards',
          items: [
            {
              question: 'What changed factory work?',
              answer: 'Time clocks and shifts',
              title: 'Factory work',
            },
            {
              question: 'What did workers repeat?',
              answer: 'Small specialized tasks',
              title: 'Specialization',
            },
          ],
        }}
      />,
    )

    expect(screen.getByText('What changed factory work?')).toBeInTheDocument()
    expect(
      screen.queryByText('What did workers repeat?'),
    ).not.toBeInTheDocument()

    fireEvent.click(screen.getByText('What changed factory work?'))
    expect(screen.getByText('Time clocks and shifts')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Known' }))
    expect(screen.getByText('Known 1')).toBeInTheDocument()
    expect(screen.getByText('Missed 0')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByText('What did workers repeat?')).toBeInTheDocument()
  })

  it('renders quiz carousel with multiple-choice items only', () => {
    render(
      <StudyBlockView
        type="QuizCarouselBlock"
        props={{
          title: 'Mixed Quiz',
          items: [
            {
              quizMode: 'multipleChoice',
              question: 'Which one is correct?',
              options: ['Wrong option', 'Correct option'],
              correctIndex: 1,
              answer: 'Correct option',
              explanation: 'Second option is right.',
            },
            {
              quizMode: 'shortAnswer',
              question: 'What is the key term?',
              options: [],
              correctIndex: 0,
              answer: 'industrialization',
              explanation: 'That is the process.',
            },
          ],
        }}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Wrong option' }))
    expect(screen.getByText('Answered 1/1')).toBeInTheDocument()
    expect(screen.getByText('Correct 0')).toBeInTheDocument()
    expect(screen.getByText('Wrong 1')).toBeInTheDocument()

    expect(screen.queryByText('What is the key term?')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Answer')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
  })

  it('renders markdown thematic breaks as horizontal rules', () => {
    render(
      <StudyBlockView
        type="MarkdownBlock"
        props={{
          markdown:
            'First section\n\n---\n\nSecond section\n\n***\n\nThird section\n\n- - -\n\nFourth section',
        }}
      />,
    )

    expect(screen.getByText('First section')).toBeInTheDocument()
    expect(screen.getByText('Second section')).toBeInTheDocument()
    expect(screen.getByText('Third section')).toBeInTheDocument()
    expect(screen.getByText('Fourth section')).toBeInTheDocument()
    expect(screen.getAllByRole('separator')).toHaveLength(3)
    expect(screen.queryByText('---')).not.toBeInTheDocument()
    expect(screen.queryByText('***')).not.toBeInTheDocument()
    expect(screen.queryByText('- - -')).not.toBeInTheDocument()
  })
})
