import React from 'react'
import { Alert, Snackbar } from '@mui/material'

import type { DashboardLayout } from '../../state/store'
import {
  STUDYMESH_ONBOARDING_NOTICE_EVENT,
  STUDYMESH_ONBOARDING_RESET_EVENT,
} from './onboardingEvents'

export const WORKSPACE_ONBOARDING_KEY = 'studymesh-workspace-onboarding-v1'

export const countDashboardNodes = (
  layout?: DashboardLayout,
): { tabCount: number; tabsetCount: number } => {
  if (!layout) {
    return { tabCount: 0, tabsetCount: 0 }
  }

  const current = {
    tabCount: layout.type === 'tab' ? 1 : 0,
    tabsetCount: layout.type === 'tabset' ? 1 : 0,
  }

  return (layout.children || []).reduce((total, child) => {
    const next = countDashboardNodes(child)
    return {
      tabCount: total.tabCount + next.tabCount,
      tabsetCount: total.tabsetCount + next.tabsetCount,
    }
  }, current)
}

const WorkspaceOnboarding = () => {
  const [notice, setNotice] = React.useState('')

  React.useEffect(() => {
    const handleNotice = (event: Event) => {
      const detail = (event as CustomEvent<{ message?: string }>).detail
      setNotice(detail?.message || '')
    }
    const handleReset = () => setNotice('')

    window.addEventListener(STUDYMESH_ONBOARDING_NOTICE_EVENT, handleNotice)
    window.addEventListener(STUDYMESH_ONBOARDING_RESET_EVENT, handleReset)

    return () => {
      window.removeEventListener(STUDYMESH_ONBOARDING_NOTICE_EVENT, handleNotice)
      window.removeEventListener(STUDYMESH_ONBOARDING_RESET_EVENT, handleReset)
    }
  }, [])

  return (
    <Snackbar
      open={Boolean(notice)}
      autoHideDuration={3200}
      onClose={() => setNotice('')}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
    >
      <Alert severity="info" variant="filled" onClose={() => setNotice('')}>
        {notice}
      </Alert>
    </Snackbar>
  )
}

export default WorkspaceOnboarding
