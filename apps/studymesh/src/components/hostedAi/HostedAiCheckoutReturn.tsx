import React from 'react'
import { Alert, Snackbar } from '@mui/material'
import { useLocation, useNavigate } from 'react-router-dom'

import { useAuth } from '../../auth/AuthProvider'
import { confirmHostedAiCreditCheckout } from '../../studyPack/ai'

interface CheckoutNotice {
  severity: 'error' | 'success' | 'info'
  message: string
}

const HostedAiCheckoutReturn = () => {
  const auth = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const handledReturnRef = React.useRef('')
  const [notice, setNotice] = React.useState<CheckoutNotice | null>(null)

  React.useEffect(() => {
    if (auth.loading || !auth.user) {
      return
    }

    const searchParams = new URLSearchParams(location.search)
    const result = searchParams.get('credits')
    const sessionId = searchParams.get('session_id') || ''
    const returnKey = `${result || ''}:${sessionId}`

    if (!result || handledReturnRef.current === returnKey) {
      return
    }

    handledReturnRef.current = returnKey
    searchParams.delete('credits')
    searchParams.delete('session_id')

    const clearCheckoutParams = () => {
      const search = searchParams.toString()
      navigate(
        {
          pathname: location.pathname,
          search: search ? `?${search}` : '',
        },
        { replace: true },
      )
    }

    if (result === 'cancel') {
      setNotice({
        severity: 'info',
        message: 'Study Credits checkout was cancelled.',
      })
      clearCheckoutParams()
      return
    }

    if (result !== 'success' || !sessionId) {
      clearCheckoutParams()
      return
    }

    void confirmHostedAiCreditCheckout(sessionId)
      .then(() => {
        setNotice({
          severity: 'success',
          message: 'Payment confirmed. Study Credits added.',
        })
      })
      .catch((error: unknown) => {
        setNotice({
          severity: 'error',
          message:
            error instanceof Error
              ? error.message
              : 'Payment succeeded, but Study Credits could not be confirmed.',
        })
      })
      .finally(clearCheckoutParams)
  }, [auth.loading, auth.user, location.pathname, location.search, navigate])

  return (
    <Snackbar
      open={Boolean(notice)}
      autoHideDuration={8000}
      onClose={() => setNotice(null)}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
    >
      <Alert
        severity={notice?.severity || 'info'}
        onClose={() => setNotice(null)}
        variant="filled"
      >
        {notice?.message || ''}
      </Alert>
    </Snackbar>
  )
}

export default HostedAiCheckoutReturn
