import { nanoid } from 'nanoid'

import type {
  DashboardLayout,
  StudyGuidePageIdea,
  StudyPathContainerState,
  StudyPathDashboardItem,
} from '../state/store'
import type { ComponentData } from '../components/WidgetEditor/types/types'
import type { QuickCreateWidgetRecord } from '../quickCreate'
import { createQuickCreateDashboardLayout } from '../quickCreate'

export type StudyGuidePageSource =
  | 'manual'
  | 'chat'
  | 'quickCreate'
  | 'expanded'

/**
 * How deep a page may sit below a root page. A rabbit hole should go somewhere,
 * but "2.1.1.1" stops reading as a number and the pages panel runs out of
 * indent, so three levels is the cap.
 */
export const STUDY_GUIDE_PAGE_MAX_DEPTH = 3

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

  const normalizedMarkdown = markdown
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
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

/**
 * The pages array is flat and depth-first, so a page is only really a child
 * when its parent is one of the pages it sits under. Anything else - a dragged
 * page that jumped out of its parent, a parent that was deleted, an over-deep
 * chain - is demoted to a root page here rather than left to render wrong.
 *
 * Returns the depth per page alongside the repaired list, because every caller
 * that needs one needs the other.
 */
const resolveStudyGuidePageTree = (
  dashboards: StudyPathDashboardItem[],
): { dashboards: StudyPathDashboardItem[]; depths: Map<string, number> } => {
  const depths = new Map<string, number>()
  let ancestors: string[] = []

  const resolved = dashboards.map((dashboard) => {
    const parentDepth = dashboard.parentPageKey
      ? ancestors.indexOf(dashboard.parentPageKey)
      : -1
    const depth = parentDepth < 0 ? 0 : parentDepth + 1
    const keepsParent = depth > 0 && depth < STUDY_GUIDE_PAGE_MAX_DEPTH + 1

    depths.set(dashboard.dashboardKey, keepsParent ? depth : 0)
    ancestors = keepsParent
      ? [...ancestors.slice(0, depth), dashboard.dashboardKey]
      : [dashboard.dashboardKey]

    if (keepsParent || !dashboard.parentPageKey) {
      return dashboard
    }

    const rootPage = { ...dashboard }
    delete rootPage.parentPageKey
    return rootPage
  })

  return { dashboards: resolved, depths }
}

export const refreshPageNumbers = (
  studyPath: StudyPathContainerState,
): StudyPathContainerState => {
  const count = studyPath.dashboards.length
  const { dashboards } = resolveStudyGuidePageTree(studyPath.dashboards)
  return {
    ...studyPath,
    dashboards: dashboards.map((dashboard, index) => ({
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

/** Depth per page, 0 for a root page. Repairs a broken tree on the way. */
export const getStudyGuidePageDepths = (
  studyPath: StudyPathContainerState,
): Map<string, number> => resolveStudyGuidePageTree(studyPath.dashboards).depths

/**
 * Reader-facing page numbers: root pages keep the two-digit "01, 02, 03" the
 * guide has always shown, and a page dug out of page 3 reads "03.1". Computed,
 * never stored, so reordering cannot leave a stale number behind.
 */
export const getStudyGuidePageNumberLabels = (
  studyPath: StudyPathContainerState,
): Map<string, string> => {
  const depths = getStudyGuidePageDepths(studyPath)
  const labels = new Map<string, string>()
  const counters: number[] = []

  studyPath.dashboards.forEach((dashboard) => {
    const depth = depths.get(dashboard.dashboardKey) || 0
    counters.length = depth + 1
    counters[depth] = (counters[depth] || 0) + 1
    labels.set(
      dashboard.dashboardKey,
      counters
        .map((counter, level) =>
          level === 0
            ? String(counter || 1).padStart(2, '0')
            : String(counter || 1),
        )
        .join('.'),
    )
  })

  return labels
}

/** A page plus every page dug out of it, in reading order. */
export const getStudyGuideSubtreeKeys = (
  studyPath: StudyPathContainerState,
  dashboardKey: string,
): string[] => {
  const depths = getStudyGuidePageDepths(studyPath)
  const startIndex = studyPath.dashboards.findIndex(
    (dashboard) => dashboard.dashboardKey === dashboardKey,
  )
  if (startIndex < 0) {
    return []
  }

  const rootDepth = depths.get(dashboardKey) || 0
  const keys = [dashboardKey]

  for (
    let index = startIndex + 1;
    index < studyPath.dashboards.length;
    index += 1
  ) {
    const dashboard = studyPath.dashboards[index]
    if ((depths.get(dashboard.dashboardKey) || 0) <= rootDepth) {
      break
    }

    keys.push(dashboard.dashboardKey)
  }

  return keys
}

/** Whether another page can still be dug out of this one. */
export const canNestStudyGuidePageUnder = (
  studyPath: StudyPathContainerState,
  parentPageKey: string,
): boolean => {
  const depth = getStudyGuidePageDepths(studyPath).get(parentPageKey)
  return depth !== undefined && depth < STUDY_GUIDE_PAGE_MAX_DEPTH
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
    children: layout.children?.map(
      (child) => visitLayoutComponents(child, visitor) as DashboardLayout,
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
    page?.createdBy === 'quickCreate' ||
    page?.createdBy === 'expanded') &&
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
      const nextLayout = visitLayoutComponents(
        dashboard.layout,
        (component) => {
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
        },
      )

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
  // Quick Create results are excluded to stop generated practice feeding back
  // into generation. Grown lesson pages are real content, so they stay in:
  // without them a later expansion would re-teach what it already added.
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

/**
 * Where a new page lands. Without a parent it goes last, which is what a
 * continuation of the syllabus wants. With one it goes directly behind that
 * page and everything already dug out of it, so a page born from a fragment
 * sits where the question came up instead of at the end of the guide.
 */
const resolveStudyGuidePagePlacement = (
  studyPath: StudyPathContainerState,
  parentPageKey?: string,
): { insertIndex: number; parentPageKey?: string } => {
  if (!parentPageKey || !canNestStudyGuidePageUnder(studyPath, parentPageKey)) {
    return { insertIndex: studyPath.dashboards.length }
  }

  const subtree = getStudyGuideSubtreeKeys(studyPath, parentPageKey)
  const lastKey = subtree[subtree.length - 1]
  const lastIndex = studyPath.dashboards.findIndex(
    (dashboard) => dashboard.dashboardKey === lastKey,
  )

  return { insertIndex: lastIndex + 1, parentPageKey }
}

const placeStudyGuidePage = (
  studyPath: StudyPathContainerState,
  page: StudyPathDashboardItem,
  insertIndex: number,
): StudyPathContainerState =>
  refreshPageNumbers({
    ...studyPath,
    dashboards: [
      ...studyPath.dashboards.slice(0, insertIndex),
      page,
      ...studyPath.dashboards.slice(insertIndex),
    ],
    selectedIndex: insertIndex,
  })

export const appendStudyGuideMarkdownPage = (
  studyPath: StudyPathContainerState,
  {
    title,
    markdown,
    source,
    parentPageKey: requestedParentKey,
    pageIdeas,
    guidePrompt,
  }: {
    title: string
    markdown: string
    source: StudyGuidePageSource
    /** Set to dig this page out of another one instead of appending it. */
    parentPageKey?: string
    pageIdeas?: StudyGuidePageIdea[]
    guidePrompt?: string
  },
): StudyPathContainerState => {
  const pageKey = makePageKey(studyPath.pathId)
  const pageCount = studyPath.dashboards.length + 1
  const { insertIndex, parentPageKey } = resolveStudyGuidePagePlacement(
    studyPath,
    requestedParentKey,
  )
  const pageIndex = insertIndex + 1
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
    contentLanguage: studyPath.contentLanguage,
    contentLanguageSource: studyPath.contentLanguageSource,
    createdBy: source,
    deletable: true,
    ...(parentPageKey ? { parentPageKey } : {}),
    ...(pageIdeas?.length ? { pageIdeas } : {}),
    ...(guidePrompt ? { guidePrompt } : {}),
  }

  return placeStudyGuidePage(studyPath, page, insertIndex)
}

export const appendStudyGuideWidgetPage = (
  studyPath: StudyPathContainerState,
  {
    title,
    widgets,
    layoutMode = 'tabs',
    source,
    parentPageKey: requestedParentKey,
    pageIdeas,
    dashboardPurpose,
  }: {
    title: string
    widgets: QuickCreateWidgetRecord[]
    layoutMode?: 'smart' | 'tabs' | 'orchestrator'
    source: StudyGuidePageSource
    /** Set to dig this page out of another one instead of appending it. */
    parentPageKey?: string
    pageIdeas?: StudyGuidePageIdea[]
    dashboardPurpose?: StudyPathDashboardItem['dashboardPurpose']
  },
): StudyPathContainerState => {
  const pageKey = makePageKey(studyPath.pathId)
  const pageCount = studyPath.dashboards.length + 1
  const { insertIndex, parentPageKey } = resolveStudyGuidePagePlacement(
    studyPath,
    requestedParentKey,
  )
  const pageIndex = insertIndex + 1
  const safeTitle = title.trim() || `Page ${pageIndex}`
  const page: StudyPathDashboardItem = {
    name: safeTitle,
    layout: createQuickCreateDashboardLayout(widgets, { mode: layoutMode }),
    dashboardKey: pageKey,
    dashboardIndex: pageIndex,
    dashboardCount: pageCount,
    folderName: studyPath.folderName,
    dashboardPurpose:
      dashboardPurpose || (source === 'quickCreate' ? 'practice' : 'lesson'),
    contentLanguage: studyPath.contentLanguage,
    contentLanguageSource: studyPath.contentLanguageSource,
    createdBy: source,
    deletable: true,
    ...(parentPageKey ? { parentPageKey } : {}),
    ...(pageIdeas?.length ? { pageIdeas } : {}),
  }

  return placeStudyGuidePage(studyPath, page, insertIndex)
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

  const selectedPageKey =
    studyPath.dashboards[studyPath.selectedIndex]?.dashboardKey
  // Dragging a page takes the pages dug out of it along: leaving them behind
  // would strand them under whichever page happened to end up above them.
  const movedKeys = new Set(
    getStudyGuideSubtreeKeys(
      studyPath,
      studyPath.dashboards[fromIndex].dashboardKey,
    ),
  )
  const moved = studyPath.dashboards.filter((dashboard) =>
    movedKeys.has(dashboard.dashboardKey),
  )
  const remaining = studyPath.dashboards.filter(
    (dashboard) => !movedKeys.has(dashboard.dashboardKey),
  )
  const insertIndex = Math.min(
    Math.max(toIndex > fromIndex ? toIndex - moved.length + 1 : toIndex, 0),
    remaining.length,
  )
  const dashboards = [
    ...remaining.slice(0, insertIndex),
    ...moved,
    ...remaining.slice(insertIndex),
  ]

  // refreshPageNumbers demotes the moved page to a root page when the drop
  // took it out from under its parent, so the drag needs no rule of its own.
  return refreshPageNumbers({
    ...studyPath,
    dashboards,
    selectedIndex: Math.max(
      dashboards.findIndex(
        (dashboard) => dashboard.dashboardKey === selectedPageKey,
      ),
      0,
    ),
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
  const selectedPageKey =
    studyPath.dashboards[studyPath.selectedIndex]?.dashboardKey
  // Children are promoted into the deleted page's slot, never deleted with it:
  // one click on a parent must not take a branch of the guide with it.
  const dashboards = studyPath.dashboards
    .filter((dashboard) => dashboard.dashboardKey !== dashboardKey)
    .map((dashboard) =>
      dashboard.parentPageKey === dashboardKey
        ? { ...dashboard, parentPageKey: target.parentPageKey }
        : dashboard,
    )
  const selectedIndex =
    selectedPageKey === dashboardKey
      ? Math.min(targetIndex, dashboards.length - 1)
      : Math.max(
          dashboards.findIndex(
            (dashboard) => dashboard.dashboardKey === selectedPageKey,
          ),
          0,
        )

  return refreshPageNumbers({
    ...studyPath,
    dashboards,
    selectedIndex,
  })
}
