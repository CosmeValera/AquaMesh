/// <reference types="@testing-library/jest-dom" />
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import StudyBlockView, {
  renderMarkdown,
} from '../../../../src/components/WidgetEditor/components/preview/StudyBlockView'
import { OPEN_STUDY_GUIDE_PAGE_LINK_EVENT } from '../../../../src/studyGuides/pageLinks'

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

  it('renders safe Markdown links without requiring http URLs', () => {
    render(
      <StudyBlockView
        type="MarkdownBlock"
        props={{
          markdown: '[asdf](asd)',
        }}
      />,
    )

    const link = screen.getByRole('link', { name: 'asdf' })
    expect(link).toHaveAttribute('href', 'asd')
    expect(screen.queryByText('[asdf](asd)')).not.toBeInTheDocument()
  })

  it('opens internal Study Guide page links without leaving the app', () => {
    const handler = vi.fn()
    window.addEventListener(OPEN_STUDY_GUIDE_PAGE_LINK_EVENT, handler)

    render(
      <StudyBlockView
        type="MarkdownBlock"
        props={{
          markdown: '[Page 2](studymesh-page:page-2)',
        }}
      />,
    )

    fireEvent.click(screen.getByRole('link', { name: 'Page 2' }))

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: { dashboardKey: 'page-2' },
      }),
    )

    window.removeEventListener(OPEN_STUDY_GUIDE_PAGE_LINK_EVENT, handler)
  })

  it('renders numbered internal citation links without showing raw URLs', () => {
    render(
      <StudyBlockView
        type="MarkdownBlock"
        props={{
          markdown: 'Use this source [1](studymesh-page:page-1).',
        }}
      />,
    )

    expect(screen.getByRole('link', { name: '1' })).toHaveAttribute(
      'href',
      'studymesh-page:page-1',
    )
    expect(screen.getByRole('link', { name: '1' })).toHaveAttribute(
      'data-link-kind',
      'study-guide-citation',
    )
    expect(screen.queryByText(/studymesh-page/)).not.toBeInTheDocument()
  })

  it('renders adjacent citation markers as separate citation controls', () => {
    render(
      <div>
        {renderMarkdown(
          'Decision checklist (quick guide)\u202f1. Workflow\u202f13. Triggers\u202f1 3. Tools 2[4]. More [5].',
          {
            renderCitation: (citationNumber, key) => (
              <button key={key} type="button">
                Source {citationNumber}
              </button>
            ),
          },
        )}
      </div>,
    )

    expect(screen.getAllByRole('button', { name: 'Source 1' })).toHaveLength(3)
    expect(screen.getByRole('button', { name: 'Source 2' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Source 3' })).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'Source 4' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Source 5' })).toBeInTheDocument()
    expect(screen.queryByText('2[4]')).not.toBeInTheDocument()
  })

  it('hides duplicate Study Guide page titles from Markdown blocks', () => {
    render(
      <StudyBlockView
        type="MarkdownBlock"
        props={{
          title: 'Cell Biology',
          studyPathId: 'guide-1',
          markdown: '# Cell Biology\n\nCells have membranes.',
        }}
      />,
    )

    expect(screen.queryByText('Cell Biology')).not.toBeInTheDocument()
    expect(screen.getByText('Cells have membranes.')).toBeInTheDocument()
  })
})
