import type { StudyPathContainerState } from '../state/store'
import { refreshPageNumbers } from '../studyGuides/pages'
import type { DemoBonusPage, DemoGuideContent } from './types'

/**
 * Appends a prepared page the same way a real Quick Create does, so page
 * numbering, the page count stamped on every page, and selecting the new page
 * all behave exactly as they do in the app.
 */
export const appendDemoBonusPage = (
  studyPath: StudyPathContainerState,
  page: DemoBonusPage['page'],
): StudyPathContainerState => {
  const alreadyPresent = studyPath.dashboards.some(
    (dashboard) => dashboard.dashboardKey === page.dashboardKey,
  )

  if (alreadyPresent) {
    return studyPath
  }

  return refreshPageNumbers({
    ...studyPath,
    dashboards: [...studyPath.dashboards, page],
    selectedIndex: studyPath.dashboards.length,
  })
}

/**
 * The study path for a freshly opened demo guide, always starting on its
 * first page: the demo does not persist progress across visits.
 */
export const buildDemoStudyPath = (
  content: DemoGuideContent,
): StudyPathContainerState =>
  refreshPageNumbers({ ...content.studyPath, selectedIndex: 0 })
