import { describe, expect, it } from 'vitest'

import {
  appendStudyGuideMarkdownPage,
  getStudyGuideCreationSourceText,
  getStudyGuidePageMarkdown,
  stripDuplicateStudyGuideMarkdownTitle,
} from '../../../src/studyGuides/pages'
import type {
  StudyPathContainerState,
  StudyPathDashboardItem,
} from '../../../src/state/store'

const makePage = (
  name: string,
  text: string,
  createdBy: StudyPathDashboardItem['createdBy'],
): StudyPathDashboardItem => ({
  name,
  createdBy,
  layout: {
    type: 'tab',
    name,
    component: 'CustomWidget',
    config: {
      customProps: {
        components: [
          {
            id: `${name}-notes`,
            type: 'MarkdownBlock',
            props: {
              title: name,
              markdown: text,
            },
          },
        ],
      },
    },
  },
})

describe('getStudyGuideCreationSourceText', () => {
  it('includes generated, manual, and chat pages but excludes quick-create pages', () => {
    const studyPath: StudyPathContainerState = {
      pathId: 'guide-1',
      title: 'Biology',
      folderName: 'Biology',
      selectedIndex: 0,
      pinnedDashboardKeys: [],
      dashboards: [
        makePage('Lesson one', 'Generated lesson source', 'generator'),
        makePage('Manual note', 'Manual page source', 'manual'),
        makePage('Chat note', 'Chat page source', 'chat'),
        makePage('Old quiz', 'Recursive quiz source', 'quickCreate'),
      ],
    }

    const source = getStudyGuideCreationSourceText(studyPath)

    expect(source).toContain('# Lesson one')
    expect(source).toContain('Generated lesson source')
    expect(source).toContain('# Manual note')
    expect(source).toContain('Manual page source')
    expect(source).toContain('# Chat note')
    expect(source).toContain('Chat page source')
    expect(source).not.toContain('Old quiz')
    expect(source).not.toContain('Recursive quiz source')
    expect(source.indexOf('# Lesson one')).toBeLessThan(
      source.indexOf('# Manual note'),
    )
    expect(source.indexOf('# Manual note')).toBeLessThan(
      source.indexOf('# Chat note'),
    )
  })
})

describe('appendStudyGuideMarkdownPage', () => {
  it('keeps a new manual page body empty for the WYSIWYG editor', () => {
    const studyPath: StudyPathContainerState = {
      pathId: 'guide-1',
      title: 'Biology',
      folderName: 'Biology',
      selectedIndex: 0,
      pinnedDashboardKeys: [],
      dashboards: [],
    }

    const next = appendStudyGuideMarkdownPage(studyPath, {
      title: 'Untitled page',
      markdown: '',
      source: 'manual',
    })

    expect(getStudyGuidePageMarkdown(next.dashboards[0])).toBe('')
  })

  it('strips a duplicate leading heading that matches the page title', () => {
    expect(
      stripDuplicateStudyGuideMarkdownTitle(
        '# Cell Biology\n\nCells have membranes.',
        'Cell Biology',
      ),
    ).toBe('Cells have membranes.')
  })
})
