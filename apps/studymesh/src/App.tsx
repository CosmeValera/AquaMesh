import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Box, CssBaseline } from '@mui/material'
import { ThemeProvider } from '@mui/material/styles'
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useSearchParams,
  useLocation,
} from 'react-router-dom'

import TopNavBar from './components/topnavbar/TopNavBar'
import Main from './components/Main'
import Dashboards from './components/Dasboard/Dashboard'
import WorkspaceOnboarding from './components/onboarding/WorkspaceOnboarding'
import WorkspaceStudioShell from './components/workspace/WorkspaceStudioShell'
import DashboardProvider from './components/Dasboard/DashboardProvider'
import LayoutProvider from './components/Layout/LayoutProvider'
import StudyMeshLanding from './components/landing/StudyMeshLanding'
import SRSFAB from './SRSFAB'
import { useWorkspaceActions } from './customHooks/useWorkspaceActions'
import LocalAiDebugPanel from './components/debug/LocalAiDebugPanel'
import { cancelAllLocalAiSessions } from './studyPack/ai'
import {
  AuthCallbackPage,
  LoginPage,
  ResetPasswordPage,
  SignupPage,
  UpdatePasswordPage,
} from './auth'
import { AuthProvider, RequireAuth } from './auth/AuthProvider'
import CloudWorkspaceSync from './cloud/CloudWorkspaceSync'

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

const WorkspacePage = () => {
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()
  const {
    openCreateWidget,
    openCreateStudyPack,
    openCreateStudyPath,
    openOperationsExample,
    openMathExample,
    openTutorialExample,
  } = useWorkspaceActions()
  const handledActionRef = useRef<string | null>(null)

  useEffect(() => {
    const action = searchParams.get('action')

    if (!action || handledActionRef.current === action) {
      return
    }

    handledActionRef.current = action

    if (action === 'create-widget') {
      openCreateWidget()
    } else if (action === 'create-study-path') {
      openCreateStudyPath()
    } else if (
      action === 'create-from-notes' ||
      action === 'create-study-pack'
    ) {
      openCreateStudyPack()
    } else if (action === 'open-operations-example') {
      openOperationsExample()
    } else if (action === 'open-math-example') {
      openMathExample()
    } else if (action === 'open-tutorial-example') {
      openTutorialExample()
    } else if (action === 'add-widget') {
      openCreateWidget()
    }

    setSearchParams({}, { replace: true })
  }, [
    openCreateWidget,
    openCreateStudyPack,
    openCreateStudyPath,
    openOperationsExample,
    openMathExample,
    openTutorialExample,
    searchParams,
    setSearchParams,
  ])

  return (
    <Box
      sx={{
        height: '100dvh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <TopNavBar
        open={menuOpen}
        setOpen={setMenuOpen}
        creationHost="external"
      />
      <Main
        sx={{
          position: 'relative',
          flex: 1,
          minHeight: 0,
          height: 'auto',
          marginTop: 0,
          overflow: 'hidden',
          p: 0,
        }}
      >
        <WorkspaceStudioShell>
          <Dashboards />
        </WorkspaceStudioShell>
        <WorkspaceOnboarding />
        <SRSFAB />
      </Main>
    </Box>
  )
}

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
          <DashboardProvider>
            <LayoutProvider>
              <Routes>
                <Route path="/" element={<StudyMeshLanding />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/signup" element={<SignupPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                <Route
                  path="/auth/callback"
                  element={<AuthCallbackPage />}
                />
                <Route
                  path="/account/update-password"
                  element={<UpdatePasswordPage />}
                />
                <Route
                  path="/workspace"
                  element={
                    <RequireAuth>
                      <WorkspacePage />
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
