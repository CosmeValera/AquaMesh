import type {
  DashboardLayout,
  StudyPathContainerState,
  StudyPathDashboardItem,
} from '../state/store'

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const collectPodcastAudioPathsFromComponents = (
  components: unknown,
): string[] => {
  if (!Array.isArray(components)) {
    return []
  }

  return components
    .map((component) => {
      if (!isObjectRecord(component) || component.type !== 'PodcastBlock') {
        return ''
      }

      const props = isObjectRecord(component.props) ? component.props : undefined
      const podcast = isObjectRecord(props?.podcast) ? props?.podcast : undefined
      return typeof podcast?.audioPath === 'string' ? podcast.audioPath : ''
    })
    .filter(Boolean)
}

const collectPodcastAudioPathsFromLayout = (
  layout?: DashboardLayout,
): string[] => {
  if (!layout) {
    return []
  }

  const customProps = layout.config?.customProps
  const ownPaths = collectPodcastAudioPathsFromComponents(
    customProps?.components,
  )
  const childPaths = (layout.children || []).flatMap((child) =>
    collectPodcastAudioPathsFromLayout(child),
  )

  return [...ownPaths, ...childPaths]
}

export const collectPodcastAudioPathsFromPage = (
  page: StudyPathDashboardItem,
): string[] => [...new Set(collectPodcastAudioPathsFromLayout(page.layout))]

export const collectPodcastAudioPathsFromStudyPath = (
  studyPath: Pick<StudyPathContainerState, 'dashboards'>,
): string[] => [
  ...new Set(
    studyPath.dashboards.flatMap((page) => collectPodcastAudioPathsFromPage(page)),
  ),
]
