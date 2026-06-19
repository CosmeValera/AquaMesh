export const STUDY_GUIDE_PAGE_LINK_SCHEME = 'studymesh-page:'
export const OPEN_STUDY_GUIDE_PAGE_LINK_EVENT =
  'studymesh:open-study-guide-page-link'

export interface OpenStudyGuidePageLinkDetail {
  dashboardKey: string
}

export const createStudyGuidePageHref = (dashboardKey: string): string =>
  `${STUDY_GUIDE_PAGE_LINK_SCHEME}${encodeURIComponent(dashboardKey)}`

export const readStudyGuidePageHref = (
  href: string,
): OpenStudyGuidePageLinkDetail | null => {
  if (!href.startsWith(STUDY_GUIDE_PAGE_LINK_SCHEME)) {
    return null
  }

  const dashboardKey = decodeURIComponent(
    href.slice(STUDY_GUIDE_PAGE_LINK_SCHEME.length),
  )

  return dashboardKey ? { dashboardKey } : null
}
