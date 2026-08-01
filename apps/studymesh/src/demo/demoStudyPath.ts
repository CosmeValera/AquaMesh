import type { StudyPathContainerState } from '../state/store'
import { refreshPageNumbers } from '../studyGuides/pages'
import type { DemoBonusActionId, DemoBonusPage, DemoGuideContent } from './types'

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
 * Rebuilds the study path for a returning visitor by replaying the bonus pages
 * they already created, in the order the guide declares them.
 */
export const buildDemoStudyPath = (
  content: DemoGuideContent,
  unlocked: DemoBonusActionId[],
  selectedIndex = 0,
): StudyPathContainerState => {
  const restored = content.bonusPages
    .filter((bonus) => unlocked.includes(bonus.actionId))
    .reduce(
      (studyPath, bonus) => appendDemoBonusPage(studyPath, bonus.page),
      content.studyPath,
    )

  return refreshPageNumbers({ ...restored, selectedIndex })
}
