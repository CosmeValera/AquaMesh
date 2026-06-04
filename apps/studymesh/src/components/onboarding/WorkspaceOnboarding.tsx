import React from 'react'
import { Box, Button, Paper, Stack, Typography } from '@mui/material'
import {
  STUDYMESH_ONBOARDING_EVENT,
  STUDYMESH_ONBOARDING_NOTICE_EVENT,
  STUDYMESH_ONBOARDING_RESET_EVENT,
  WorkspaceOnboardingEventDetail,
} from './onboardingEvents'

export const WORKSPACE_ONBOARDING_KEY = 'studymesh-workspace-onboarding-v1'
const LEGACY_WORKSPACE_ONBOARDING_KEY = 'aquamesh-workspace-onboarding-v1'
const OLD_DASHBOARD_ONBOARDING_KEY = 'aquamesh-dashboard-onboarding-step-v2'

export type WorkspaceOnboardingStepId =
  | 'create-dashboard'
  | 'open-widgets'
  | 'create-widget'
  | 'add-group'
  | 'select-group'
  | 'add-component'
  | 'tune-component'
  | 'save-widget'
  | 'close-widget'
  | 'add-saved-widget'
  | 'add-second-widget'
  | 'split-layout'
  | 'save-dashboard'
  | 'close-dashboard'
  | 'open-dashboard-menu'
  | 'open-saved-dashboard'
  | 'done'

type WorkspaceOnboardingStatus = 'active' | 'dismissed' | 'done'

export interface WorkspaceOnboardingState {
  status: WorkspaceOnboardingStatus
  stepId: WorkspaceOnboardingStepId
  createdWidgetId?: string
  createdWidgetName?: string
  savedDashboardId?: string
  savedDashboardName?: string
  showDone?: boolean
}

interface StepDefinition {
  id: WorkspaceOnboardingStepId
  targetId?: string
  progress: string
  instruction: (state: WorkspaceOnboardingState) => string
  actionLabel?: string
}

const stepOrder: WorkspaceOnboardingStepId[] = [
  'create-widget',
  'add-group',
  'select-group',
  'add-component',
  'tune-component',
  'save-widget',
  'close-widget',
  'create-dashboard',
  'open-widgets',
  'add-saved-widget',
  'add-second-widget',
  'split-layout',
  'save-dashboard',
  'close-dashboard',
  'open-dashboard-menu',
  'open-saved-dashboard',
  'done',
]

const stepDefinitions: Record<WorkspaceOnboardingStepId, StepDefinition> = {
  // Widget building steps
  'create-widget': {
    id: 'create-widget',
    targetId: 'dashboard-widget-create',
    progress: 'Step 1 of 3: Create a widget',
    instruction: () => 'Click Create Widget from the top menu.',
  },
  'add-group': {
    id: 'add-group',
    targetId: 'palette-item-FieldSet',
    progress: 'Step 1 of 3: Create a widget',
    instruction: () => 'Add a Grouped Section to start a reusable widget.',
  },
  'select-group': {
    id: 'select-group',
    targetId: 'component-target-control',
    progress: 'Step 1 of 3: Create a widget',
    instruction: () =>
      'Select the group target so the next block lands inside it.',
  },
  'add-component': {
    id: 'add-component',
    targetId: 'palette-item-Label',
    progress: 'Step 1 of 3: Create a widget',
    instruction: () =>
      'Add a Display Text inside the active group (click the item).',
  },
  'tune-component': {
    id: 'tune-component',
    targetId: 'component-edit-control',
    progress: 'Step 1 of 3: Create a widget',
    instruction: () => 'Edit a block, then save the component settings.',
  },
  'save-widget': {
    id: 'save-widget',
    targetId: 'widget-editor-save',
    progress: 'Step 1 of 3: Create a widget',
    instruction: () => 'Save the widget so it can be reused in dashboards.',
  },
  'close-widget': {
    id: 'close-widget',
    targetId: 'close-create-widget',
    progress: 'Step 1 of 3: Create a widget',
    instruction: (state) =>
      `Close Create Widget${
        state.createdWidgetName
          ? ` with "${state.createdWidgetName}" saved`
          : ''
      }.`,
  },

  // Dashboard building steps
  'create-dashboard': {
    id: 'create-dashboard',
    targetId: 'create-dashboard',
    progress: 'Step 2 of 3: Create a dashboard',
    instruction: () => 'Click Create Dashboard from the top menu.',
  },
  'open-widgets': {
    id: 'open-widgets',
    targetId: 'dashboard-editor-widgets',
    progress: 'Step 2 of 3: Create a dashboard',
    instruction: () => 'Open Widgets in the dashboard editor.',
    actionLabel: 'Widgets',
  },
  'add-saved-widget': {
    id: 'add-saved-widget',
    targetId: 'dashboard-widget-saved',
    progress: 'Step 2 of 3: Create a dashboard',
    instruction: (state) =>
      `Add ${state.createdWidgetName || 'your saved widget'} to the dashboard.`,
  },
  'add-second-widget': {
    id: 'add-second-widget',
    targetId: 'dashboard-editor-widgets',
    progress: 'Step 2 of 3: Create a dashboard',
    instruction: () => 'Add one more widget so the dashboard has two tabs.',
    actionLabel: 'Widgets',
  },
  'split-layout': {
    id: 'split-layout',
    targetId: 'flexlayout-tab',
    progress: 'Step 2 of 3: Create a dashboard',
    instruction: (state) =>
      `Grab a widget tab, for example '${
        state.createdWidgetName || 'your saved widget'
      }', and drag it into a new area to split the layout.`,
  },
  'save-dashboard': {
    id: 'save-dashboard',
    targetId: 'dashboard-editor-save',
    progress: 'Step 2 of 3: Create a dashboard',
    instruction: (state) =>
      `Save the dashboard '${
        state.savedDashboardName || 'your saved dashboard'
      }' so it appears in Dashboards.`,
  },
  'close-dashboard': {
    id: 'close-dashboard',
    targetId: 'dashboard-editor-close',
    progress: 'Step 2 of 3: Create a dashboard',
    instruction: () => 'Close the dashboard editor.',
    actionLabel: 'Close',
  },

  // Dashboard opening steps
  'open-dashboard-menu': {
    id: 'open-dashboard-menu',
    targetId: 'topnav-dashboards',
    progress: 'Step 3 of 3: Open the dashboard',
    instruction: () => 'Open Dashboards from the top menu.',
  },
  'open-saved-dashboard': {
    id: 'open-saved-dashboard',
    targetId: 'topnav-saved-dashboard',
    progress: 'Step 3 of 3: Open the dashboard',
    instruction: (state) =>
      `Open the Dashboard you just created '${
        state.savedDashboardName || 'your saved dashboard'
      }' from this menu.`,
  },
  done: {
    id: 'done',
    progress: 'Complete',
    instruction: () =>
      'Dashboard opened in the workspace. You have completed the onboarding! 🥳',
  },
}

const activeDefaultState: WorkspaceOnboardingState = {
  status: 'active',
  stepId: 'create-widget',
}

const dismissedDefaultState: WorkspaceOnboardingState = {
  status: 'dismissed',
  stepId: 'create-widget',
}

export const createInitialWorkspaceOnboardingState =
  (): WorkspaceOnboardingState => activeDefaultState

const readStoredState = (): WorkspaceOnboardingState => {
  if (typeof window === 'undefined') {
    return dismissedDefaultState
  }

  try {
    const saved =
      window.localStorage.getItem(WORKSPACE_ONBOARDING_KEY) ||
      window.localStorage.getItem(LEGACY_WORKSPACE_ONBOARDING_KEY)
    if (saved) {
      return { ...activeDefaultState, ...JSON.parse(saved) }
    }

    if (window.localStorage.getItem(OLD_DASHBOARD_ONBOARDING_KEY) === 'done') {
      return { ...activeDefaultState, status: 'done', stepId: 'done' }
    }
  } catch (error) {
    console.error('Failed to read workspace onboarding state', error)
  }

  return dismissedDefaultState
}

const getNextStep = (stepId: WorkspaceOnboardingStepId) =>
  stepOrder[Math.min(stepOrder.indexOf(stepId) + 1, stepOrder.length - 1)]

const countDashboardNodes = (
  layout: unknown,
): { tabCount: number; tabsetCount: number } => {
  if (!layout || typeof layout !== 'object') {
    return { tabCount: 0, tabsetCount: 0 }
  }

  const node = layout as { type?: string; children?: unknown[] }
  const childCounts = (node.children || []).reduce(
    (counts, child) => {
      const next = countDashboardNodes(child)
      return {
        tabCount: counts.tabCount + next.tabCount,
        tabsetCount: counts.tabsetCount + next.tabsetCount,
      }
    },
    { tabCount: 0, tabsetCount: 0 },
  )

  return {
    tabCount: childCounts.tabCount + (node.type === 'tab' ? 1 : 0),
    tabsetCount: childCounts.tabsetCount + (node.type === 'tabset' ? 1 : 0),
  }
}

const shouldAdvance = (
  stepId: WorkspaceOnboardingStepId,
  detail: WorkspaceOnboardingEventDetail,
) => {
  switch (stepId) {
    case 'create-dashboard':
      return detail.type === 'dashboard-editor-opened'
    case 'open-widgets':
      return detail.type === 'widgets-menu-opened'
    case 'create-widget':
      return detail.type === 'widget-editor-opened'
    case 'add-group':
      return (
        detail.type === 'component-added' &&
        ['FieldSet', 'FlexBox', 'GridBox'].includes(detail.componentType || '')
      )
    case 'select-group':
      return detail.type === 'container-selected'
    case 'add-component':
      return (
        detail.type === 'component-added' &&
        detail.componentType !== 'FieldSet' &&
        detail.componentType !== 'FlexBox' &&
        detail.componentType !== 'GridBox'
      )
    case 'tune-component':
      return detail.type === 'component-edit-saved'
    case 'save-widget':
      return detail.type === 'widget-saved'
    case 'close-widget':
      return detail.type === 'widget-editor-closed'
    case 'add-saved-widget':
      return detail.type === 'saved-widget-added'
    case 'add-second-widget':
      return (
        detail.type === 'dashboard-layout-changed' &&
        (detail.tabCount || 0) >= 2
      )
    case 'split-layout':
      return (
        detail.type === 'dashboard-layout-changed' &&
        (detail.tabCount || 0) >= 2 &&
        (detail.tabsetCount || 0) >= 2
      )
    case 'save-dashboard':
      return detail.type === 'dashboard-saved'
    case 'close-dashboard':
      return detail.type === 'dashboard-editor-closed'
    case 'open-dashboard-menu':
      return detail.type === 'dashboard-menu-opened'
    case 'open-saved-dashboard':
      return detail.type === 'saved-dashboard-opened'
    default:
      return false
  }
}

export const reduceWorkspaceOnboardingState = (
  state: WorkspaceOnboardingState,
  detail: WorkspaceOnboardingEventDetail,
): WorkspaceOnboardingState => {
  if (state.status !== 'active' || !shouldAdvance(state.stepId, detail)) {
    return state
  }

  const nextStep = getNextStep(state.stepId)
  const nextState: WorkspaceOnboardingState = {
    ...state,
    stepId: nextStep,
    showDone: nextStep === 'done',
  }

  if (detail.type === 'widget-saved') {
    nextState.createdWidgetId = detail.widgetId
    nextState.createdWidgetName = detail.widgetName
  }

  if (detail.type === 'dashboard-saved') {
    nextState.savedDashboardId = detail.dashboardId
    nextState.savedDashboardName = detail.dashboardName
  }

  if (nextStep === 'done') {
    nextState.status = 'done'
  }

  return nextState
}

const getTarget = (targetId?: string, state?: WorkspaceOnboardingState) => {
  if (!targetId || typeof document === 'undefined') {
    return null
  }

  if (targetId === 'topnav-saved-dashboard') {
    return document.querySelector(
      `[data-onboarding-id="${targetId}"][data-dashboard-id="${
        state?.savedDashboardId || ''
      }"]`,
    ) as HTMLElement | null
  }

  if (targetId === 'dashboard-widget-saved') {
    return document.querySelector(
      `[data-onboarding-id="${targetId}"][data-widget-id="${
        state?.createdWidgetId || ''
      }"]`,
    ) as HTMLElement | null
  }

  if (targetId === 'component-edit-control') {
    const matches = document.querySelectorAll(
      `[data-onboarding-id="${targetId}"]`,
    )

    return (matches[1] || matches[0] || null) as HTMLElement | null
  }

  return document.querySelector(
    `[data-onboarding-id="${targetId}"]`,
  ) as HTMLElement | null
}

const coachPaperSx = {
  position: 'fixed',
  top: { xs: 'auto', sm: 88 },
  bottom: { xs: 12, sm: 'auto' },
  right: { xs: 12, sm: 16 },
  left: { xs: 12, sm: 'auto' },
  width: { xs: 'auto', sm: 360 },
  zIndex: 1500,
  p: 1.5,
  borderRadius: 1,
  border: '1px solid',
  borderColor: 'primary.light',
  bgcolor: 'background.paper',
  color: 'text.primary',
} as const

const WorkspaceOnboarding = () => {
  const [state, setState] = React.useState(readStoredState)
  const [showSettingsHint, setShowSettingsHint] = React.useState(false)
  const [noticeMessage, setNoticeMessage] = React.useState<string | null>(null)
  const [doneStep, setDoneStep] = React.useState<1 | 2>(1)

  React.useEffect(() => {
    try {
      window.localStorage.setItem(
        WORKSPACE_ONBOARDING_KEY,
        JSON.stringify(state),
      )
    } catch (error) {
      console.error('Failed to save workspace onboarding state', error)
    }
  }, [state])

  React.useEffect(() => {
    const handleEvent = (event: Event) => {
      const customEvent = event as CustomEvent<WorkspaceOnboardingEventDetail>
      setState((current) =>
        reduceWorkspaceOnboardingState(current, customEvent.detail),
      )
    }
    const handleReset = () => {
      setDoneStep(1)
      setShowSettingsHint(false)
      setNoticeMessage(null)
      setState(createInitialWorkspaceOnboardingState())
    }
    const handleNotice = (event: Event) => {
      const customEvent = event as CustomEvent<{ message?: string }>
      setNoticeMessage(customEvent.detail?.message || null)
    }
    const handleWidgetStorageEvent = (event: Event) => {
      const customEvent = event as CustomEvent<{
        action?: string
        widgetId?: string
        name?: string
      }>

      if (
        customEvent.detail?.action !== 'save' &&
        customEvent.detail?.action !== 'update'
      ) {
        return
      }

      setState((current) =>
        reduceWorkspaceOnboardingState(current, {
          type: 'widget-saved',
          widgetId: customEvent.detail?.widgetId,
          widgetName: customEvent.detail?.name,
        }),
      )
    }

    window.addEventListener(STUDYMESH_ONBOARDING_EVENT, handleEvent)
    window.addEventListener(STUDYMESH_ONBOARDING_NOTICE_EVENT, handleNotice)
    window.addEventListener(STUDYMESH_ONBOARDING_RESET_EVENT, handleReset)
    document.addEventListener('widgetStorageUpdated', handleWidgetStorageEvent)
    return () => {
      window.removeEventListener(STUDYMESH_ONBOARDING_EVENT, handleEvent)
      window.removeEventListener(
        STUDYMESH_ONBOARDING_NOTICE_EVENT,
        handleNotice,
      )
      window.removeEventListener(STUDYMESH_ONBOARDING_RESET_EVENT, handleReset)
      document.removeEventListener(
        'widgetStorageUpdated',
        handleWidgetStorageEvent,
      )
    }
  }, [])

  React.useEffect(() => {
    if (!noticeMessage) {
      return
    }

    const timeout = window.setTimeout(() => setNoticeMessage(null), 2500)

    return () => {
      window.clearTimeout(timeout)
    }
  }, [noticeMessage])

  React.useEffect(() => {
    if (state.status !== 'active') return

    let timeout: number | undefined
    let highlightedTarget: HTMLElement | null = null
    let cancelled = false

    let previousOutline = ''
    let previousOutlineOffset = ''
    let previousScrollMargin = ''

    const clearHighlight = () => {
      if (!highlightedTarget) return

      highlightedTarget.style.outline = previousOutline
      highlightedTarget.style.outlineOffset = previousOutlineOffset
      highlightedTarget.style.scrollMargin = previousScrollMargin

      highlightedTarget = null
    }

    const applyHighlight = () => {
      if (cancelled) return

      const step = stepDefinitions[state.stepId]
      const target = getTarget(step.targetId, state)

      if (!step.targetId) {
        return
      }

      if (!target) {
        timeout = window.setTimeout(applyHighlight, 100)
        return
      }

      highlightedTarget = target
      previousOutline = target.style.outline
      previousOutlineOffset = target.style.outlineOffset
      previousScrollMargin = target.style.scrollMargin

      target.style.outline = '3px solid #00C49A'
      target.style.outlineOffset = '3px'
      target.style.scrollMargin = '96px'
      target.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    }

    applyHighlight()

    return () => {
      cancelled = true

      if (timeout) {
        window.clearTimeout(timeout)
      }

      clearHighlight()
    }
  }, [
    state.status,
    state.stepId,
    state.createdWidgetId,
    state.savedDashboardId,
  ])

  const userIsBuilder = React.useMemo(() => {
    try {
      const userData = window.localStorage.getItem('userData')
      if (!userData) {
        return false
      }
      const parsed = JSON.parse(userData)
      return parsed.role === 'ADMIN_ROLE'
    } catch {
      return false
    }
  }, [])

  if (noticeMessage) {
    return (
      <Paper
        elevation={8}
        aria-live="polite"
        data-testid="workspace-onboarding-notice"
        sx={coachPaperSx}
      >
        <Stack spacing={1}>
          <Box>
            <Typography
              variant="caption"
              sx={{ color: 'text.secondary', fontWeight: 700 }}
            >
              AI settings saved
            </Typography>
            <Typography variant="body2" sx={{ mt: 0.25 }}>
              {noticeMessage}
            </Typography>
          </Box>

          <Stack direction="row" justifyContent="flex-end">
            <Button
              size="small"
              variant="text"
              onClick={() => setNoticeMessage(null)}
            >
              Got it
            </Button>
          </Stack>
        </Stack>
      </Paper>
    )
  }

  if (!userIsBuilder) {
    return null
  }

  if (state.status === 'dismissed' && !showSettingsHint) {
    return null
  }

  if (showSettingsHint) {
    return (
      <Paper elevation={8} aria-live="polite" sx={coachPaperSx}>
        <Stack spacing={1}>
          <Typography variant="body2">
            You can replay the tutorial in settings whenever you want.
          </Typography>

          <Stack direction="row" justifyContent="flex-end">
            <Button
              size="small"
              variant="text"
              onClick={() => setShowSettingsHint(false)}
            >
              Got it
            </Button>
          </Stack>
        </Stack>
      </Paper>
    )
  }

  if (state.status === 'done' && !state.showDone) {
    return null
  }

  const step = stepDefinitions[state.stepId]
  const target = getTarget(step.targetId, state)

  const isDoneStep = state.stepId === 'done'

  const doneInstruction =
    doneStep === 1
      ? step.instruction(state)
      : 'Feel free to explore and build more dashboards and widgets. You can replay the tutorial in settings whenever you want.'

  const handleAction = () => {
    target?.click()
  }

  const handleSkip = () => {
    setState({ ...state, status: 'dismissed' })
    setShowSettingsHint(true)
  }
  const handleDoneNext = () => {
    setDoneStep(2)
  }

  const handleDoneGotIt = () => {
    setState((current) => ({ ...current, showDone: false }))
  }

  return (
    <Paper
      elevation={8}
      aria-live="polite"
      data-testid="workspace-onboarding-coach"
      sx={{ ...coachPaperSx, zIndex: 1301 }}
    >
      <Stack spacing={1}>
        <Box>
          <Typography
            variant="caption"
            sx={{ color: 'text.secondary', fontWeight: 700 }}
          >
            {step.progress}
          </Typography>
          <Typography variant="body2" sx={{ mt: 0.25 }}>
            {isDoneStep ? doneInstruction : step.instruction(state)}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} justifyContent="flex-end">
          {isDoneStep ? (
            doneStep === 1 ? (
              <Button size="small" variant="contained" onClick={handleDoneNext}>
                Next
              </Button>
            ) : (
              <Button
                size="small"
                variant="contained"
                onClick={handleDoneGotIt}
              >
                Got it
              </Button>
            )
          ) : (
            <Button size="small" variant="text" onClick={handleSkip}>
              Skip
            </Button>
          )}
        </Stack>
      </Stack>
    </Paper>
  )
}

export { countDashboardNodes }
export default WorkspaceOnboarding
