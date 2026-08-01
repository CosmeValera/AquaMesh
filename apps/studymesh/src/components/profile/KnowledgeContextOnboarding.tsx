import React from 'react'
import { useLocation } from 'react-router-dom'

import { useAuth } from '../../auth/AuthProvider'
import { CLOUD_SYNC_STATUS_EVENT } from '../../cloud/CloudWorkspaceSync'
import { getAllUserKnownTopics, readProfileContext } from '../../profileContext'
import { KnowledgeContextOnboardingDialog } from './KnowledgeContextDialog'

const KnowledgeContextOnboarding = () => {
  const { user, loading } = useAuth()
  const location = useLocation()
  const [open, setOpen] = React.useState(false)
  const [cloudReady, setCloudReady] = React.useState(false)
  const dismissedForWindowRef = React.useRef(false)

  React.useEffect(() => {
    const handleCloudStatus = (event: Event) => {
      const detail = (event as CustomEvent<{ status?: string }>).detail
      if (detail?.status === 'synced' || detail?.status === 'error') {
        setCloudReady(true)
      }
    }
    const fallback = window.setTimeout(() => setCloudReady(true), 1500)

    window.addEventListener(CLOUD_SYNC_STATUS_EVENT, handleCloudStatus)

    return () => {
      window.clearTimeout(fallback)
      window.removeEventListener(CLOUD_SYNC_STATUS_EVENT, handleCloudStatus)
    }
  }, [])

  React.useEffect(() => {
    // Guests always have an empty topic list, so this would pop on every trial.
    if (loading || !user || !cloudReady || user.is_anonymous === true) {
      setOpen(false)
      return
    }

    if (
      location.pathname === '/login' ||
      location.pathname === '/signup' ||
      location.pathname.startsWith('/auth/')
    ) {
      return
    }

    const profileContext = readProfileContext()
    if (
      !dismissedForWindowRef.current &&
      getAllUserKnownTopics(profileContext).length === 0
    ) {
      setOpen(true)
    }
  }, [cloudReady, loading, location.pathname, user])

  return (
    <KnowledgeContextOnboardingDialog
      open={open}
      initialContext={readProfileContext()}
      onClose={() => {
        dismissedForWindowRef.current = true
        setOpen(false)
      }}
    />
  )
}

export default KnowledgeContextOnboarding
