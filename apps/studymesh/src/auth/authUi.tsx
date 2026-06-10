import React from 'react'
import {
  Box,
  Button,
  Container,
  Divider,
  Paper,
  Stack,
  Typography,
} from '@mui/material'
import SchoolOutlinedIcon from '@mui/icons-material/SchoolOutlined'
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'
import { Link as RouterLink } from 'react-router-dom'

export const AUTH_CARD_MAX_WIDTH = 440
export const PASSWORD_MIN_LENGTH = 8

type AuthPageFrameProps = {
  title: string
  subtitle: string
  children: React.ReactNode
  footer?: React.ReactNode
  showBackLink?: boolean
}

export const AuthPageFrame = ({
  title,
  subtitle,
  children,
  footer,
  showBackLink = true,
}: AuthPageFrameProps) => {
  return (
    <Box
      sx={{
        minHeight: '100dvh',
        bgcolor: 'background.default',
        display: 'flex',
        alignItems: { xs: 'stretch', sm: 'center' },
        py: { xs: 0, sm: 4 },
      }}
    >
      <Container
        maxWidth="sm"
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          px: { xs: 0, sm: 3 },
        }}
      >
        <Paper
          elevation={0}
          sx={{
            width: '100%',
            maxWidth: AUTH_CARD_MAX_WIDTH,
            minHeight: { xs: '100dvh', sm: 'auto' },
            borderRadius: { xs: 0, sm: 3 },
            border: { xs: 0, sm: 1 },
            borderColor: 'divider',
            px: { xs: 3, sm: 4 },
            py: { xs: 4, sm: 4 },
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
          }}
        >
          <Stack spacing={3}>
            <Stack spacing={2}>
              {showBackLink ? (
                <Button
                  component={RouterLink}
                  to="/"
                  startIcon={<ArrowBackRoundedIcon />}
                  sx={{ alignSelf: 'flex-start' }}
                >
                  Home
                </Button>
              ) : null}
              <Stack spacing={1.5} alignItems="flex-start">
                <Box
                  sx={{
                    width: 48,
                    height: 48,
                    borderRadius: 2,
                    display: 'grid',
                    placeItems: 'center',
                    bgcolor: 'primary.main',
                    color: 'primary.contrastText',
                  }}
                >
                  <SchoolOutlinedIcon />
                </Box>
                <Box>
                  <Typography variant="h4" component="h1" fontWeight={800}>
                    {title}
                  </Typography>
                  <Typography variant="body1" color="text.secondary">
                    {subtitle}
                  </Typography>
                </Box>
              </Stack>
            </Stack>
            {children}
            {footer ? (
              <>
                <Divider />
                {footer}
              </>
            ) : null}
          </Stack>
        </Paper>
      </Container>
    </Box>
  )
}

export const getRedirectPath = (search: string) => {
  const redirect = new URLSearchParams(search).get('redirect')

  if (!redirect || !redirect.startsWith('/') || redirect.startsWith('//')) {
    return '/study-guides'
  }

  return redirect
}

export const getAuthRedirectUrl = (path: string) => {
  const safePath = path.startsWith('/') ? path : `/${path}`
  return `${window.location.origin}${safePath}`
}

export const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message) {
    return error.message
  }

  return fallback
}
