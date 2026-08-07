import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../../../src/components/study/StudyBlockView', () => ({
  __esModule: true,
  default: ({ type }: { type: string }) => (
    <div data-testid={`block-${type}`}>{type}</div>
  ),
  isStudyBlockType: () => true,
}))

import StudyGuideLinearLayout from '../../../src/components/Dasboard/StudyGuideLinearLayout'
import type { DashboardLayout } from '../../../src/state/store'

const lessonThenQuizLayout: DashboardLayout = {
  type: 'row',
  children: [
    {
      type: 'tabset',
      children: [
        {
          type: 'tab',
          config: {
            customProps: {
              components: [
                { id: 'title', type: 'Label', props: { text: 'Lesson' } },
                {
                  id: 'body',
                  type: 'MarkdownBlock',
                  props: { markdown: 'Some lesson text' },
                },
              ],
            },
          },
        },
      ],
    },
    {
      type: 'tabset',
      children: [
        {
          type: 'tab',
          config: {
            customProps: {
              components: [{ id: 'quiz', type: 'QuizCarouselBlock', props: {} }],
            },
          },
        },
      ],
    },
  ],
}

const lessonOnlyLayout: DashboardLayout = {
  type: 'row',
  children: [
    {
      type: 'tabset',
      children: [
        {
          type: 'tab',
          config: {
            customProps: {
              components: [
                { id: 'title', type: 'Label', props: { text: 'Lesson' } },
                {
                  id: 'body',
                  type: 'MarkdownBlock',
                  props: { markdown: 'Some lesson text' },
                },
              ],
            },
          },
        },
      ],
    },
  ],
}

describe('StudyGuideLinearLayout render props', () => {
  it('wraps the quiz card via renderQuizGroup, after the lesson card', () => {
    render(
      <StudyGuideLinearLayout
        layout={lessonThenQuizLayout}
        renderQuizGroup={(quizGroup) => (
          <div data-testid="toggle">
            <div data-testid="toggle-buttons">Quiz / Explain</div>
            {quizGroup}
          </div>
        )}
        renderPageEnd={({ quizGroupRendered }) => (
          <div data-testid="page-end">
            {quizGroupRendered ? 'claim-box' : 'explain-only'}
          </div>
        )}
      />,
    )

    const lesson = screen.getByTestId('block-MarkdownBlock')
    const toggleButtons = screen.getByTestId('toggle-buttons')
    const quiz = screen.getByTestId('block-QuizCarouselBlock')
    const pageEnd = screen.getByTestId('page-end')

    // The bug this guards against: the toggle must sit right above the quiz
    // card, not above the lesson content at the top of the page.
    expect(
      lesson.compareDocumentPosition(toggleButtons) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(
      toggleButtons.compareDocumentPosition(quiz) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(pageEnd).toHaveTextContent('claim-box')
  })

  it('never invokes renderQuizGroup when the page has no quiz card', () => {
    const renderQuizGroup = vi.fn((quizGroup: React.ReactNode) => quizGroup)

    render(
      <StudyGuideLinearLayout
        layout={lessonOnlyLayout}
        renderQuizGroup={renderQuizGroup}
        renderPageEnd={({ quizGroupRendered }) => (
          <div data-testid="page-end">
            {quizGroupRendered ? 'claim-box' : 'explain-only'}
          </div>
        )}
      />,
    )

    expect(renderQuizGroup).not.toHaveBeenCalled()
    expect(screen.getByTestId('page-end')).toHaveTextContent('explain-only')
  })
})
