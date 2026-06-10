import { nanoid } from 'nanoid'

import type {
  DashboardLayout,
  StudyPathContainerState,
  StudyPathDashboardItem,
} from '../state/store'
import type { ComponentData } from '../components/WidgetEditor/types/types'

export type StudyGuidePageSource = 'manual' | 'chat' | 'quickCreate'

const makePageKey = (studyPathId: string) =>
  `${studyPathId}-page-${Date.now()}-${nanoid(6)}`

const withStudyPathProps = (
  studyPath: StudyPathContainerState,
  pageKey: string,
  title: string,
  index: number,
  count: number,
  props: Record<string, unknown>,
) => ({
  ...props,
  studyPathId: studyPath.pathId,
  studyPathTitle: studyPath.title,
  studyPathDashboardKey: pageKey,
  studyPathDashboardName: title,
  studyPathDashboardIndex: index,
  studyPathDashboardCount: count,
  studyPathFolderName: studyPath.folderName,
})

export const createMarkdownStudyGuidePageLayout = ({
  studyPath,
  pageKey,
  title,
  markdown,
  pageIndex,
  pageCount,
}: {
  studyPath: StudyPathContainerState
  pageKey: string
  title: string
  markdown: string
  pageIndex: number
  pageCount: number
}): DashboardLayout => {
  const components: ComponentData[] = [
    {
      id: `${pageKey}-title`,
      type: 'Label',
      props: {
        text: title,
        variant: 'h6',
        fontWeight: 700,
        gutterBottom: true,
      },
    },
    {
      id: `${pageKey}-markdown`,
      type: 'MarkdownBlock',
      props: withStudyPathProps(
        studyPath,
        pageKey,
        title,
        pageIndex,
        pageCount,
        {
          __blockType: 'MarkdownBlock',
          title,
          markdown,
        },
      ),
    },
  ]

  return {
    type: 'row',
    weight: 100,
    children: [
      {
        type: 'tabset',
        weight: 100,
        active: true,
        selected: 0,
        children: [
          {
            type: 'tab',
            name: title,
            component: 'CustomWidget',
            config: {
              customProps: {
                widgetId: `${pageKey}-widget`,
                components,
              },
            },
          },
        ],
      },
    ],
  }
}

const refreshPageNumbers = (
  studyPath: StudyPathContainerState,
): StudyPathContainerState => {
  const count = studyPath.dashboards.length
  return {
    ...studyPath,
    dashboards: studyPath.dashboards.map((dashboard, index) => ({
      ...dashboard,
      dashboardIndex: index + 1,
      dashboardCount: count,
    })),
    selectedIndex: Math.min(
      Math.max(studyPath.selectedIndex || 0, 0),
      Math.max(count - 1, 0),
    ),
  }
}

export const appendStudyGuideMarkdownPage = (
  studyPath: StudyPathContainerState,
  {
    title,
    markdown,
    source,
  }: {
    title: string
    markdown: string
    source: StudyGuidePageSource
  },
): StudyPathContainerState => {
  const pageKey = makePageKey(studyPath.pathId)
  const pageCount = studyPath.dashboards.length + 1
  const pageIndex = pageCount
  const safeTitle = title.trim() || `Page ${pageIndex}`
  const page: StudyPathDashboardItem = {
    name: safeTitle,
    layout: createMarkdownStudyGuidePageLayout({
      studyPath,
      pageKey,
      title: safeTitle,
      markdown: markdown.trim() || `# ${safeTitle}`,
      pageIndex,
      pageCount,
    }),
    dashboardKey: pageKey,
    dashboardIndex: pageIndex,
    dashboardCount: pageCount,
    folderName: studyPath.folderName,
    dashboardPurpose: 'lesson',
    createdBy: source,
    deletable: true,
  }

  return refreshPageNumbers({
    ...studyPath,
    dashboards: [...studyPath.dashboards, page],
    selectedIndex: pageIndex - 1,
  })
}

export const reorderStudyGuidePage = (
  studyPath: StudyPathContainerState,
  fromIndex: number,
  toIndex: number,
): StudyPathContainerState => {
  if (
    fromIndex < 0 ||
    fromIndex >= studyPath.dashboards.length ||
    toIndex < 0 ||
    toIndex >= studyPath.dashboards.length ||
    fromIndex === toIndex
  ) {
    return studyPath
  }

  const dashboards = [...studyPath.dashboards]
  const [page] = dashboards.splice(fromIndex, 1)
  dashboards.splice(toIndex, 0, page)

  return refreshPageNumbers({
    ...studyPath,
    dashboards,
    selectedIndex: toIndex,
  })
}

export const deleteStudyGuidePage = (
  studyPath: StudyPathContainerState,
  dashboardKey: string,
): StudyPathContainerState => {
  const target = studyPath.dashboards.find(
    (dashboard) => dashboard.dashboardKey === dashboardKey,
  )
  if (!target?.deletable || studyPath.dashboards.length <= 1) {
    return studyPath
  }

  const targetIndex = studyPath.dashboards.findIndex(
    (dashboard) => dashboard.dashboardKey === dashboardKey,
  )
  const dashboards = studyPath.dashboards.filter(
    (dashboard) => dashboard.dashboardKey !== dashboardKey,
  )

  return refreshPageNumbers({
    ...studyPath,
    dashboards,
    selectedIndex: Math.min(studyPath.selectedIndex, targetIndex),
  })
}
