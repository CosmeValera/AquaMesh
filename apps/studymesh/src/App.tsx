import React, { useEffect, useMemo, useRef, useState } from 'react'
import { CssBaseline } from '@mui/material'
import { ThemeProvider } from '@mui/material/styles'
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from 'react-router-dom'

import DashboardProvider from './components/Dasboard/DashboardProvider'
import LayoutProvider from './components/Layout/LayoutProvider'
import StudyMeshLanding from './components/landing/StudyMeshLanding'
import StudyMeshPricingPage from './components/landing/StudyMeshPricingPage'
import LocalAiDebugPanel from './components/debug/LocalAiDebugPanel'
import { cancelAllLocalAiSessions } from './quickCreate/ai'
import {
  AuthCallbackPage,
  LoginPage,
  ResetPasswordPage,
  SignupPage,
  UpdatePasswordPage,
} from './auth'
import { AuthProvider, RequireAuth } from './auth/AuthProvider'
import CloudWorkspaceSync from './cloud/CloudWorkspaceSync'
import StudyGuidesPage from './components/studyGuides/StudyGuidesPage'
import GuideWorkspacePage from './components/studyGuides/GuideWorkspacePage'
import HostedAiCheckoutReturn from './components/hostedAi/HostedAiCheckoutReturn'
import KnowledgeContextOnboarding from './components/profile/KnowledgeContextOnboarding'

import { createStudyMeshTheme } from './theme'
import { AccentColorProvider } from './theme/AccentColorContext'
import {
  accentColorOptions,
  applyAccentCssVariables,
  getAccentColorById,
  readStoredAccentColorId,
  writeStoredAccentColorId,
} from './theme/accentColors'
import { ThemeModeProvider, useThemeMode } from './theme/ThemeModeContext'
import { PrimeReactProvider } from 'primereact/api'
import 'primeflex/primeflex.css'
import 'primeicons/primeicons.css'
import 'primereact/resources/themes/lara-light-green/theme.css'
import 'primereact/resources/primereact.min.css'

import '../../../style/themes/studymesh-theme/theme.scss'

import './variables.scss'
import './hide-overlay.scss'

const AppShell = () => {
  const { mode } = useThemeMode()
  const location = useLocation()
  const previousPathRef = useRef(location.pathname)
  const [accentColorId, setAccentColorId] = useState(readStoredAccentColorId)
  const accentColor = useMemo(
    () => getAccentColorById(accentColorId),
    [accentColorId],
  )
  const theme = useMemo(
    () => createStudyMeshTheme(mode, accentColorId),
    [accentColorId, mode],
  )

  useEffect(() => {
    writeStoredAccentColorId(accentColorId)
    applyAccentCssVariables(accentColor)
  }, [accentColor, accentColorId])

  useEffect(() => {
    if (previousPathRef.current !== location.pathname) {
      cancelAllLocalAiSessions()
      previousPathRef.current = location.pathname
    }
  }, [location.pathname])

  const accentColorContextValue = useMemo(
    () => ({
      accentColorId,
      accentColor,
      setAccentColorId,
      options: accentColorOptions,
    }),
    [accentColor, accentColorId],
  )

  return (
    <AccentColorProvider value={accentColorContextValue}>
      <ThemeProvider theme={theme}>
        <PrimeReactProvider value={{ ripple: true }}>
          <CssBaseline />
          <LocalAiDebugPanel />
          <CloudWorkspaceSync />
          <HostedAiCheckoutReturn />
          <KnowledgeContextOnboarding />
          <DashboardProvider>
            <LayoutProvider>
              <Routes>
                <Route path="/" element={<StudyMeshLanding />} />
                <Route path="/pricing" element={<StudyMeshPricingPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/signup" element={<SignupPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                <Route path="/auth/callback" element={<AuthCallbackPage />} />
                <Route
                  path="/account/update-password"
                  element={<UpdatePasswordPage />}
                />
                <Route
                  path="/study-guides"
                  element={
                    <RequireAuth>
                      <StudyGuidesPage />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/workspace"
                  element={
                    <Navigate
                      to={{
                        pathname: '/study-guides',
                        search: location.search,
                      }}
                      replace
                    />
                  }
                />
                <Route
                  path="/workspace/:studyGuideId"
                  element={
                    <RequireAuth>
                      <GuideWorkspacePage />
                    </RequireAuth>
                  }
                />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </LayoutProvider>
          </DashboardProvider>
        </PrimeReactProvider>
      </ThemeProvider>
    </AccentColorProvider>
  )
}

const App = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ThemeModeProvider>
          <AppShell />
        </ThemeModeProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
