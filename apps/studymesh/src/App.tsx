import React, {
  Suspense,
  lazy,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Box, CircularProgress, CssBaseline } from '@mui/material'
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
import LocalAiDebugPanel from './components/debug/LocalAiDebugPanel'
import { cancelAllLocalAiSessions } from './quickCreate/ai'
import { AuthProvider, RequireAuth } from './auth/AuthProvider'
import CloudWorkspaceSync from './cloud/CloudWorkspaceSync'
import HostedAiCheckoutReturn from './components/hostedAi/HostedAiCheckoutReturn'
import { PodcastPlayerProvider } from './components/podcast/PodcastPlayerProvider'
import { InterfaceLanguageProvider } from './language/interfaceLanguage'

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

// The landing page is the only route a first-time visitor sees, so everything
// behind it (workspace, guide editor, auth, pricing, demo) is split out of the
// initial bundle instead of being downloaded before the hero paints.
const StudyMeshPricingPage = lazy(
  () => import('./components/landing/StudyMeshPricingPage'),
)
const DemoCreatePage = lazy(() => import('./components/demo/DemoCreatePage'))
const DemoGuidePage = lazy(() => import('./components/demo/DemoGuidePage'))
const StudyGuidesPage = lazy(
  () => import('./components/studyGuides/StudyGuidesPage'),
)
const GuideWorkspacePage = lazy(
  () => import('./components/studyGuides/GuideWorkspacePage'),
)
const LoginPage = lazy(() =>
  import('./auth').then((module) => ({ default: module.LoginPage })),
)
const SignupPage = lazy(() =>
  import('./auth').then((module) => ({ default: module.SignupPage })),
)
const ResetPasswordPage = lazy(() =>
  import('./auth').then((module) => ({ default: module.ResetPasswordPage })),
)
const AuthCallbackPage = lazy(() =>
  import('./auth').then((module) => ({ default: module.AuthCallbackPage })),
)
const UpdatePasswordPage = lazy(() =>
  import('./auth').then((module) => ({ default: module.UpdatePasswordPage })),
)

const RouteChunkFallback = () => (
  <Box
    aria-busy="true"
    sx={{
      minHeight: '100dvh',
      display: 'grid',
      placeItems: 'center',
    }}
  >
    <CircularProgress aria-label="Loading page" size={34} />
  </Box>
)

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
      <InterfaceLanguageProvider>
        <ThemeProvider theme={theme}>
          <PrimeReactProvider value={{ ripple: true }}>
            <CssBaseline />
            <LocalAiDebugPanel />
            <CloudWorkspaceSync />
            <HostedAiCheckoutReturn />
            <DashboardProvider>
              <LayoutProvider>
                <PodcastPlayerProvider>
                  <Suspense fallback={<RouteChunkFallback />}>
                    <Routes>
                      <Route path="/" element={<StudyMeshLanding />} />
                      <Route
                        path="/pricing"
                        element={<StudyMeshPricingPage />}
                      />
                      <Route path="/try" element={<DemoCreatePage />} />
                      <Route
                        path="/try/:demoSlug"
                        element={<DemoGuidePage />}
                      />
                      <Route path="/login" element={<LoginPage />} />
                      <Route path="/signup" element={<SignupPage />} />
                      <Route
                        path="/reset-password"
                        element={<ResetPasswordPage />}
                      />
                      <Route
                        path="/auth/callback"
                        element={<AuthCallbackPage />}
                      />
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
                  </Suspense>
                </PodcastPlayerProvider>
              </LayoutProvider>
            </DashboardProvider>
          </PrimeReactProvider>
        </ThemeProvider>
      </InterfaceLanguageProvider>
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
