import React from 'react'
import { useLocation } from 'react-router-dom'

import { useAuth } from '../../auth/AuthProvider'
import { CLOUD_SYNC_STATUS_EVENT } from '../../cloud/CloudWorkspaceSync'
import { readProfileContext } from '../../profileContext'
import KnowledgeContextDialog from './KnowledgeContextDialog'

const KnowledgeContextOnboarding = () => {
  const { user, loading } = useAuth()
  const location = useLocation()
  const [open, setOpen] = React.useState(false)
  const [cloudReady, setCloudReady] = React.useState(false)

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
    if (loading || !user || !cloudReady) {
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
    if (!profileContext) {
      setOpen(true)
    }
  }, [cloudReady, loading, location.pathname, user])

  return (
    <KnowledgeContextDialog
      open={open}
      initialContext={readProfileContext()}
      surface="onboarding"
      onClose={() => setOpen(false)}
    />
  )
}

export default KnowledgeContextOnboarding
