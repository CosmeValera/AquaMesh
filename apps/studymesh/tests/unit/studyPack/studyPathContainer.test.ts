import { describe, expect, it } from 'vitest'

import { createStudyPathContainerState } from '../../../src/components/Dasboard/studyPathContainer'
import { DashboardLayout } from '../../../src/state/store'

const createStudyPathComponentProps = (index: number) => ({
  studyPathId: 'study-path-algebra',
  studyPathTitle: 'Algebra Study Guide',
  studyPathDashboardKey: `study-path-algebra-${index}`,
  studyPathDashboardName: `Lesson ${index}`,
  studyPathDashboardIndex: index,
  studyPathDashboardCount: 3,
  studyPathFolderName: 'Algebra',
  studyPathDashboardPurpose: 'lesson',
  studyPathPracticeType: 'mixed',
})

const createStudyPathLayout = (index: number): DashboardLayout => ({
  type: 'row',
  children: [
    {
      type: 'tabset',
      children: [
        {
          type: 'tab',
          name: `Lesson ${index}`,
          component: 'CustomWidget',
          config: {
            customProps: {
              widgetId: `widget-${index}`,
              ...createStudyPathComponentProps(index),
              components: [],
            },
          },
        },
      ],
    },
  ],
})

describe('createStudyPathContainerState', () => {
  it('groups ordered Study Guide dashboards into a single container model', () => {
    const container = createStudyPathContainerState([
      {
        id: 'lesson-2',
        name: 'Lesson 2',
        folder: 'Algebra',
        layout: createStudyPathLayout(2),
        createdAt: '2026-05-14T10:02:00.000Z',
      },
      {
        id: 'lesson-1',
        name: 'Lesson 1',
        folder: 'Algebra',
        layout: createStudyPathLayout(1),
        createdAt: '2026-05-14T10:01:00.000Z',
      },
      {
        id: 'lesson-3',
        name: 'Lesson 3',
        folder: 'Algebra',
        layout: createStudyPathLayout(3),
        createdAt: '2026-05-14T10:03:00.000Z',
      },
    ])

    expect(container).toMatchObject({
      pathId: 'study-path-algebra',
      title: 'Algebra Study Guide',
      folderName: 'Algebra',
      selectedIndex: 0,
    })
    expect(container?.dashboards.map((dashboard) => dashboard.name)).toEqual([
      'Lesson 1',
      'Lesson 2',
      'Lesson 3',
    ])
    expect(container?.dashboards[0]).toMatchObject({
      dashboardPurpose: 'lesson',
      practiceType: 'mixed',
    })
  })

  it('does not containerize unrelated dashboards', () => {
    const container = createStudyPathContainerState([
      {
        id: 'lesson-1',
        name: 'Lesson 1',
        folder: 'Algebra',
        layout: createStudyPathLayout(1),
      },
      {
        id: 'custom-dashboard',
        name: 'Custom Dashboard',
        folder: 'Custom',
        layout: { type: 'row', children: [] },
      },
    ])

    expect(container).toBeNull()
  })
})
