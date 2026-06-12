import { nanoid } from 'nanoid'

import type {
  DashboardLayout,
  StudyPathContainerState,
  StudyPathDashboardItem,
} from '../state/store'
import type { ComponentData } from '../components/WidgetEditor/types/types'
import type { QuickCreateWidgetRecord } from '../quickCreate'
import { createQuickCreateDashboardLayout } from '../quickCreate'

export type StudyGuidePageSource = 'manual' | 'chat' | 'quickCreate'

const makePageKey = (studyPathId: string) =>
  `${studyPathId}-page-${Date.now()}-${nanoid(6)}`

const MAX_STUDY_GUIDE_CREATION_SOURCE_LENGTH = 24000

const normalizeComparableTitle = (value: string): string =>
  value
    .trim()
    .replace(/^\d+\s*[-.)]\s+/, '')
    .replace(/\s+/g, ' ')
    .toLowerCase()

export const stripDuplicateStudyGuideMarkdownTitle = (
  markdown: string,
  title: string,
): string => {
  const normalizedTitle = normalizeComparableTitle(title)
  if (!normalizedTitle) {
    return markdown
  }

  const normalizedMarkdown = markdown.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const lines = normalizedMarkdown.split('\n')
  const firstContentIndex = lines.findIndex((line) => line.trim())
  if (firstContentIndex < 0) {
    return ''
  }

  const firstLine = lines[firstContentIndex].trim()
  const headingMatch = firstLine.match(/^#{1,6}\s+(.+)$/)
  const firstLineTitle = headingMatch?.[1] || firstLine
  if (normalizeComparableTitle(firstLineTitle) !== normalizedTitle) {
    return markdown
  }

  return lines
    .slice(firstContentIndex + 1)
    .join('\n')
    .replace(/^\n+/, '')
}

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

const visitLayoutComponents = (
  layout: DashboardLayout | undefined,
  visitor: (component: ComponentData) => ComponentData,
): DashboardLayout | undefined => {
  if (!layout) {
    return layout
  }

  const customProps = layout.config?.customProps
  const components = Array.isArray(customProps?.components)
    ? (customProps.components as ComponentData[]).map(visitor)
    : customProps?.components

  return {
    ...layout,
    config: layout.config
      ? {
          ...layout.config,
          customProps: customProps
            ? {
                ...customProps,
                components,
              }
            : customProps,
        }
      : layout.config,
    children: layout.children?.map((child) =>
      visitLayoutComponents(child, visitor) as DashboardLayout,
    ),
  }
}

const findMarkdownComponent = (
  layout: DashboardLayout | undefined,
): ComponentData | null => {
  let match: ComponentData | null = null
  visitLayoutComponents(layout, (component) => {
    if (!match && component.type === 'MarkdownBlock') {
      match = component
    }

    return component
  })

  return match
}

export const getStudyGuidePageMarkdown = (
  page: StudyPathDashboardItem | undefined,
): string => {
  const markdownComponent = findMarkdownComponent(page?.layout)
  const markdown = markdownComponent?.props?.markdown
  return typeof markdown === 'string'
    ? stripDuplicateStudyGuideMarkdownTitle(markdown, page?.name || '')
    : ''
}

export const isEditableMarkdownStudyGuidePage = (
  page: StudyPathDashboardItem | undefined,
): boolean =>
  Boolean(page?.deletable) &&
  (page?.createdBy === 'manual' ||
    page?.createdBy === 'chat' ||
    page?.createdBy === 'quickCreate') &&
  Boolean(findMarkdownComponent(page?.layout))

export const updateStudyGuideMarkdownPage = (
  studyPath: StudyPathContainerState,
  dashboardKey: string,
  {
    title,
    markdown,
  }: {
    title: string
    markdown: string
  },
): StudyPathContainerState =>
  refreshPageNumbers({
    ...studyPath,
    dashboards: studyPath.dashboards.map((dashboard) => {
      if (dashboard.dashboardKey !== dashboardKey) {
        return dashboard
      }

      const safeTitle = title.trim() || dashboard.name || 'Untitled page'
      const safeMarkdown = stripDuplicateStudyGuideMarkdownTitle(
        markdown,
        safeTitle,
      )
      const nextLayout = visitLayoutComponents(dashboard.layout, (component) => {
        if (component.type === 'MarkdownBlock') {
          return {
            ...component,
            props: {
              ...component.props,
              title: safeTitle,
              markdown: safeMarkdown,
              studyPathDashboardName: safeTitle,
            },
          }
        }

        if (component.type === 'Label') {
          return {
            ...component,
            props: {
              ...component.props,
              text: safeTitle,
            },
          }
        }

        return component
      })

      return {
        ...dashboard,
        name: safeTitle,
        layout: nextLayout || dashboard.layout,
      }
    }),
  })

export const getStudyGuidePageText = (
  page: StudyPathDashboardItem | undefined,
): string => {
  if (!page) {
    return ''
  }

  const chunks: string[] = [page.name]
  visitLayoutComponents(page.layout, (component) => {
    Object.values(component.props || {}).forEach((value) => {
      if (typeof value === 'string') {
        chunks.push(value)
      } else if (
        Array.isArray(value) &&
        value.every((item) => typeof item === 'string')
      ) {
        chunks.push(value.join('\n'))
      }
    })

    return component
  })

  return chunks
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .join('\n\n')
}

export const getStudyGuideCreationSourceText = (
  studyPath: StudyPathContainerState,
): string => {
  const source = studyPath.dashboards
    .filter((page) => page.createdBy !== 'quickCreate')
    .map((page) => {
      const text = getStudyGuidePageText(page)
      return text ? `# ${page.name}\n\n${text}` : ''
    })
    .filter(Boolean)
    .join('\n\n---\n\n')

  if (source.length <= MAX_STUDY_GUIDE_CREATION_SOURCE_LENGTH) {
    return source
  }

  return `${source
    .slice(0, MAX_STUDY_GUIDE_CREATION_SOURCE_LENGTH)
    .trimEnd()}\n\n[Study Guide source truncated]`
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
  const safeMarkdown = stripDuplicateStudyGuideMarkdownTitle(
    markdown.trim(),
    safeTitle,
  )
  const page: StudyPathDashboardItem = {
    name: safeTitle,
    layout: createMarkdownStudyGuidePageLayout({
      studyPath,
      pageKey,
      title: safeTitle,
      markdown: safeMarkdown,
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

export const appendStudyGuideWidgetPage = (
  studyPath: StudyPathContainerState,
  {
    title,
    widgets,
    layoutMode = 'tabs',
    source,
  }: {
    title: string
    widgets: QuickCreateWidgetRecord[]
    layoutMode?: 'smart' | 'tabs' | 'orchestrator'
    source: StudyGuidePageSource
  },
): StudyPathContainerState => {
  const pageKey = makePageKey(studyPath.pathId)
  const pageCount = studyPath.dashboards.length + 1
  const pageIndex = pageCount
  const safeTitle = title.trim() || `Page ${pageIndex}`
  const page: StudyPathDashboardItem = {
    name: safeTitle,
    layout: createQuickCreateDashboardLayout(widgets, { mode: layoutMode }),
    dashboardKey: pageKey,
    dashboardIndex: pageIndex,
    dashboardCount: pageCount,
    folderName: studyPath.folderName,
    dashboardPurpose: source === 'quickCreate' ? 'practice' : 'lesson',
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
