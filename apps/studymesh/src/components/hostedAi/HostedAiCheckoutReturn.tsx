import React from 'react'
import { Alert, Snackbar } from '@mui/material'
import { useLocation, useNavigate } from 'react-router-dom'

import { useAuth } from '../../auth/AuthProvider'
import { confirmHostedAiCreditCheckout } from '../../quickCreate/ai'

interface CheckoutNotice {
  severity: 'error' | 'success' | 'info'
  message: string
}

const CONFETTI_COLORS = [
  '#0ea5e9',
  '#22c55e',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
]

const ConfettiCelebration = () => (
  <div
    aria-hidden="true"
    style={{
      position: 'fixed',
      inset: 0,
      overflow: 'hidden',
      pointerEvents: 'none',
      zIndex: 2000,
    }}
  >
    <style>
      {`
        @keyframes studymesh-confetti-fall {
          0% { transform: translate3d(0, -12vh, 0) rotate(0deg); opacity: 1; }
          100% { transform: translate3d(var(--drift), 110vh, 0) rotate(760deg); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .studymesh-confetti-piece { display: none; }
        }
      `}
    </style>
    {Array.from({ length: 72 }, (_, index) => (
      <span
        className="studymesh-confetti-piece"
        key={index}
        style={
          {
            position: 'absolute',
            top: 0,
            left: `${(index * 37) % 100}%`,
            width: index % 4 === 0 ? 10 : 7,
            height: index % 3 === 0 ? 16 : 10,
            borderRadius: index % 5 === 0 ? '50%' : 2,
            backgroundColor: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
            animation: `studymesh-confetti-fall ${2.4 + (index % 9) * 0.16}s ease-in ${(
              (index % 12) *
              0.06
            ).toFixed(2)}s forwards`,
            '--drift': `${((index * 29) % 180) - 90}px`,
          } as React.CSSProperties
        }
      />
    ))}
  </div>
)

const HostedAiCheckoutReturn = () => {
  const auth = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const handledReturnRef = React.useRef('')
  const [notice, setNotice] = React.useState<CheckoutNotice | null>(null)
  const [celebrating, setCelebrating] = React.useState(false)

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
        message: 'Carrots checkout was cancelled.',
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
          message: 'Payment confirmed. Carrots added.',
        })
        setCelebrating(true)
        window.setTimeout(() => setCelebrating(false), 5000)
      })
      .catch((error: unknown) => {
        setNotice({
          severity: 'error',
          message:
            error instanceof Error
              ? error.message
              : 'Payment succeeded, but Carrots could not be confirmed.',
        })
      })
      .finally(clearCheckoutParams)
  }, [auth.loading, auth.user, location.pathname, location.search, navigate])

  return (
    <>
      {celebrating ? <ConfettiCelebration /> : null}
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
    </>
  )
}

export default HostedAiCheckoutReturn
