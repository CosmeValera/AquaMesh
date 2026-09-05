export const OPEN_DASHBOARD_CHAT_EVENT = 'studymesh:open-dashboard-chat'
export const PREFILL_DASHBOARD_CHAT_EVENT = 'studymesh:prefill-dashboard-chat'
export const CLOSE_DASHBOARD_CHAT_EVENT = 'studymesh:close-dashboard-chat'
export const CLOSE_CREATE_STUDIO_EVENT = 'studymesh:close-create-studio'
/**
 * The learner prompt and the claimed skill stay separate all the way to
 * generation: only the prompt decides the guide's content language.
 */
export interface StartNextStudyGuideRequest {
  prompt: string
  knownSkill?: string
}

/** Detail: { prompts }. Sent by a finished quiz, handled by the top nav bar. */
export const START_NEXT_STUDY_GUIDE_EVENT = 'studymesh:start-next-study-guide'

/** Shared by the event listener and the route state that carries it onward. */
export const normalizeStartNextStudyGuideRequests = (
  value: unknown,
): StartNextStudyGuideRequest[] => {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((entry) => {
      const record = entry && typeof entry === 'object' ? entry : {}
      const prompt = String(
        (record as StartNextStudyGuideRequest).prompt || '',
      ).trim()
      const knownSkill = String(
        (record as StartNextStudyGuideRequest).knownSkill || '',
      ).trim()
      return knownSkill ? { prompt, knownSkill } : { prompt }
    })
    .filter((entry) => entry.prompt)
}
export const WORKSPACE_DASHBOARD_TABS_SLOT_ID =
  'studymesh-workspace-dashboard-tabs-slot'
