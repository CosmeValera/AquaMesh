import React from 'react'
import { Box, Button, Container, Stack, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import { Link as RouterLink } from 'react-router-dom'

import { scrollToLandingSection } from './LandingTopNav'

const footerBrand = {
  surface: '#FFFFFF',
  neutral: '#F2F4F7',
  neutralDeep: '#E9EDF3',
  ink: '#071127',
  muted: '#5B6680',
  line: '#D7DDE7',
  blue: '#1150D8',
  blueDark: '#0D3FAE',
  sky: '#12A7E8',
  mint: '#11C9A3',
}

const footerLinks = [
  ['Knowledge bridge', '#knowledge-context'],
  ['Growing guides', '#growing-guide'],
  ['Pricing', '/pricing'],
] as const

const startLinks = [
  ['Quick Guides', '/study-guides'],
  ['Sign in', '/login'],
] as const

type StudyMeshFooterProps = {
  sectionHrefPrefix?: '' | '/'
}

const StudyMeshFooter = ({ sectionHrefPrefix = '' }: StudyMeshFooterProps) => {
  const year = new Date().getFullYear()

  const getFooterHref = (href: string) => {
    return href.startsWith('#') ? `${sectionHrefPrefix}${href}` : href
  }

  const handleSectionClick = (
    event: React.MouseEvent<HTMLElement>,
    href: string,
  ) => {
    if (sectionHrefPrefix !== '' || !href.startsWith('#')) {
      return
    }

    event.preventDefault()
    if (scrollToLandingSection(href)) {
      window.history.pushState(null, '', href)
    }
  }

  return (
    <Box
      component="footer"
      data-testid="studymesh-footer"
      sx={{
        borderTop: `1px solid ${alpha(footerBrand.line, 0.9)}`,
        bgcolor: footerBrand.neutral,
        background: `linear-gradient(180deg, ${footerBrand.neutral} 0%, ${footerBrand.neutralDeep} 100%)`,
        color: footerBrand.ink,
      }}
    >
      <Container
        maxWidth={false}
        sx={{
          width: 'min(100%, 1512px)',
          px: { xs: 2.25, sm: 4, lg: 5.5 },
          py: { xs: 3.4, md: 4.4 },
        }}
      >
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              sm: '1.2fr 0.8fr',
              lg: '1.25fr 0.56fr 0.48fr 0.72fr',
            },
            gap: { xs: 2.8, sm: 3.5, lg: 5.5 },
            alignItems: 'start',
          }}
        >
          <Stack spacing={1.2} alignItems="flex-start">
            <Button
              component={RouterLink}
              to="/"
              variant="text"
              sx={{
                minWidth: 'auto',
                p: 0,
                color: footerBrand.ink,
                textTransform: 'none',
                '&:hover': { bgcolor: 'transparent' },
                '&:focus-visible': {
                  outline: `3px solid ${alpha(footerBrand.sky, 0.28)}`,
                  outlineOffset: 6,
                },
              }}
            >
              <Stack direction="row" spacing={1} alignItems="center">
                <Box
                  component="img"
                  src="/logo.png"
                  alt="StudyMesh logo"
                  sx={{
                    width: 34,
                    height: 34,
                    display: 'block',
                  }}
                />
                <Typography
                  component="span"
                  sx={{
                    color: footerBrand.ink,
                    fontWeight: 800,
                    fontSize: '1.12rem',
                    letterSpacing: 0,
                  }}
                >
                  StudyMesh
                </Typography>
              </Stack>
            </Button>
            <Typography
              sx={{
                maxWidth: 360,
                color: footerBrand.muted,
                fontSize: '0.94rem',
                lineHeight: 1.55,
              }}
            >
              Quick guides that connect new ideas to what you already know.
            </Typography>
            <Stack
              direction="row"
              spacing={0.8}
              alignItems="center"
              sx={{
                color: footerBrand.blueDark,
                fontSize: '0.78rem',
                fontWeight: 850,
              }}
            >
              <Box
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  bgcolor: footerBrand.mint,
                  boxShadow: `0 0 0 4px ${alpha(footerBrand.mint, 0.12)}`,
                }}
              />
              <Box component="span">Free to start</Box>
              <Box
                component="span"
                sx={{ color: alpha(footerBrand.muted, 0.6) }}
              >
                ·
              </Box>
              <Box component="span">No credit card required</Box>
            </Stack>
          </Stack>

          <Stack component="nav" spacing={1} aria-label="Footer product">
            <Typography
              variant="overline"
              sx={{
                color: footerBrand.muted,
                fontWeight: 900,
                letterSpacing: '0.12em',
                lineHeight: 1,
              }}
            >
              Product
            </Typography>
            <Stack spacing={0.35} alignItems="flex-start">
              {footerLinks.map(([label, href]) => (
                <Button
                  key={label}
                  href={getFooterHref(href)}
                  onClick={(event) => handleSectionClick(event, href)}
                  variant="text"
                  sx={{
                    minWidth: 'auto',
                    px: 0,
                    py: 0.25,
                    color: footerBrand.ink,
                    textTransform: 'none',
                    fontWeight: 720,
                    fontSize: '0.92rem',
                    '&:hover': {
                      bgcolor: 'transparent',
                      color: footerBrand.blue,
                    },
                  }}
                >
                  {label}
                </Button>
              ))}
            </Stack>
          </Stack>

          <Stack
            component="nav"
            spacing={1}
            alignItems="flex-start"
            aria-label="Footer start"
          >
            <Typography
              variant="overline"
              sx={{
                color: footerBrand.muted,
                fontWeight: 900,
                letterSpacing: '0.12em',
                lineHeight: 1,
              }}
            >
              Start
            </Typography>
            <Stack spacing={0.35} alignItems="flex-start">
              {startLinks.map(([label, href]) => (
                <Button
                  key={label}
                  component={RouterLink}
                  to={href}
                  variant="text"
                  sx={{
                    minWidth: 'auto',
                    px: 0,
                    py: 0.25,
                    color: footerBrand.ink,
                    textTransform: 'none',
                    fontWeight: 720,
                    fontSize: '0.92rem',
                    '&:hover': {
                      bgcolor: 'transparent',
                      color: footerBrand.blue,
                    },
                  }}
                >
                  {label}
                </Button>
              ))}
            </Stack>
          </Stack>

          <Stack
            spacing={1.25}
            alignItems="flex-start"
            sx={{
              pl: { lg: 3.2 },
              borderLeft: {
                xs: 'none',
                lg: `1px solid ${alpha(footerBrand.line, 0.9)}`,
              },
            }}
          >
            <Typography
              sx={{
                color: footerBrand.ink,
                fontSize: '1rem',
                fontWeight: 850,
                lineHeight: 1.25,
              }}
            >
              Build first, refine with chat.
            </Typography>
            <Typography
              sx={{
                maxWidth: 280,
                color: footerBrand.muted,
                fontSize: '0.9rem',
                lineHeight: 1.5,
              }}
            >
              Start from a learning goal and let StudyMesh shape the guide.
            </Typography>
            <Button
              component={RouterLink}
              to="/study-guides?create=1"
              variant="contained"
              endIcon={<ArrowForwardIcon />}
              sx={{
                minHeight: 42,
                px: 2.2,
                borderRadius: 999,
                bgcolor: footerBrand.blue,
                color: footerBrand.surface,
                boxShadow: `0 12px 28px ${alpha(footerBrand.blue, 0.18)}`,
                textTransform: 'none',
                fontWeight: 850,
                fontSize: '0.92rem',
                '&:hover': {
                  bgcolor: footerBrand.blueDark,
                  boxShadow: `0 14px 32px ${alpha(footerBrand.blue, 0.24)}`,
                },
                '& .MuiButton-endIcon': {
                  ml: 0.9,
                },
              }}
            >
              Create a Quick Guide
            </Button>
          </Stack>
        </Box>

        <Box
          sx={{
            mt: { xs: 3, md: 3.8 },
            pt: 1.8,
            borderTop: `1px solid ${alpha(footerBrand.line, 0.72)}`,
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            justifyContent: 'space-between',
            gap: 1,
          }}
        >
          <Typography sx={{ color: footerBrand.muted, fontSize: '0.88rem' }}>
            © {year} StudyMesh. Built for focused learning.
          </Typography>
          <Typography sx={{ color: footerBrand.muted, fontSize: '0.88rem' }}>
            Study guides · Quick Create · AI Chat
          </Typography>
        </Box>
      </Container>
    </Box>
  )
}

export default StudyMeshFooter
