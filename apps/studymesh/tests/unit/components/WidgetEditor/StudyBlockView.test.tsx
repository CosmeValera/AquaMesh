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

  it('renders ListBlock items generated from study packs', () => {
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

  it('records Study Guide quiz attempts without filled red or green buttons', () => {
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
          studyPathId: 'french-b1',
          studyPathTitle: 'French B1',
          studyPathDashboardKey: 'french-b1-1',
          studyPathDashboardName: '01 - Content 1',
          studyPathDashboardIndex: 1,
          studyPathDashboardCount: 7,
          studyPathFolderName: 'French B1',
          studyPathItemId: 'quiz-1',
        }}
      />,
    )

    const wrongButton = screen.getByRole('button', {
      name: 'Only for past events',
    })
    fireEvent.click(wrongButton)

    expect(wrongButton).toHaveClass('MuiButton-outlined')
    expect(localStorage.getItem('studymesh-study-path-progress-v1')).toContain(
      '"missed":true',
    )
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

  it('renders quiz carousel with multiple-choice and short-answer scoring', () => {
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
    expect(screen.getByText('Answered 1/2')).toBeInTheDocument()
    expect(screen.getByText('Correct 0')).toBeInTheDocument()
    expect(screen.getByText('Wrong 1')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    fireEvent.change(screen.getByLabelText('Answer'), {
      target: { value: 'industrialization' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Check answer' }))

    expect(screen.getByText('Answered 2/2')).toBeInTheDocument()
    expect(screen.getByText('Correct 1')).toBeInTheDocument()
    expect(screen.getByText('Wrong 1')).toBeInTheDocument()
  })
})
