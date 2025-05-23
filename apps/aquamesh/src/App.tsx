import React, { useState } from 'react'
import { Box, CssBaseline } from '@mui/material'
import { ThemeProvider } from '@mui/material/styles'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'

import TopNavBar from './components/topnavbar/TopNavBar'
import Main from './components/Main'
import Dashboards from './components/Dasboard/Dashboard'
import DashboardProvider from './components/Dasboard/DashboardProvider'
import LayoutProvider from './components/Layout/LayoutProvider'
import Login from './components/auth/Login'

import theme from './theme'
import { PrimeReactProvider } from 'primereact/api'
import 'primeflex/primeflex.css'
import 'primeicons/primeicons.css'
import 'primereact/resources/themes/lara-light-green/theme.css'
import 'primereact/resources/primereact.min.css'

import '../../../style/themes/aquamesh-theme/theme.scss'

import './variables.scss'
import './hide-overlay.scss'

// Protected route component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const userData = localStorage.getItem('userData')
  
  if (!userData) {
    return <Navigate to="/login" replace />
  }
  
  return <>{children}</>
}

const MainPage = () => {
  const [menuOpen, setMenuOpen] = useState(false)
  
  return (
    <Box sx={{ overflowX: 'hidden', height: '100dvh' }}>
      <TopNavBar open={menuOpen} setOpen={setMenuOpen} />
      <Main
        mt={8}
        sx={{ position: 'relative' }}
      >
        <Dashboards />
      </Main>
    </Box>
  )
}

const App = () => {
  return (
    <BrowserRouter>
      <ThemeProvider theme={theme}>
        <PrimeReactProvider value={{ ripple: true }}>
          <CssBaseline />
          <DashboardProvider>
            <LayoutProvider>
              <CssBaseline />
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/" element={
                  <ProtectedRoute>
                    <MainPage />
                  </ProtectedRoute>
                } />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </LayoutProvider>
          </DashboardProvider>
        </PrimeReactProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}
export default App
