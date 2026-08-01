import React from 'react'
import { Box, Button, Container, Stack, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import { useNavigate } from 'react-router-dom'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'

const navBrand = {
  header: 'rgba(255, 255, 255, 0.82)',
  ink: '#071127',
  line: '#D9E5F3',
  blue: '#1150D8',
  blueDark: '#0D3FAE',
  sky: '#12A7E8',
  surface: '#FFFFFF',
}

const navItems = [
  ['Why RabbitHole', '#why'],
  ['What you get', '#what'],
  ['How it works', '#how'],
  ['FAQ', '#faq'],
  ['Pricing', '/pricing'],
]

export const scrollToLandingSection = (
  hash: string,
  behavior: ScrollBehavior = 'smooth',
) => {
  if (!hash.startsWith('#')) {
    return false
  }

  const target = document.getElementById(hash.slice(1))
  if (!target) {
    return false
  }

  const headerHeight =
    document.querySelector('header')?.getBoundingClientRect().height ?? 88
  const top =
    target.getBoundingClientRect().top + window.scrollY - headerHeight - 16

  window.scrollTo({ behavior, top: Math.max(0, top) })
  return true
}

type LandingTopNavProps = {
  sectionHrefPrefix?: '' | '/'
}

const LandingTopNav = ({ sectionHrefPrefix = '' }: LandingTopNavProps) => {
  const navigate = useNavigate()

  const getNavHref = (href: string) => {
    return href.startsWith('#') ? `${sectionHrefPrefix}${href}` : href
  }

  const openGuestTrial = () => {
    navigate('/try')
  }

  const handleNavClick = (
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
      component="header"
      sx={{
        position: 'sticky',
        top: 0,
        zIndex: 1200,
        borderBottom: `1px solid ${alpha(navBrand.line, 0.32)}`,
        bgcolor: navBrand.header,
        backdropFilter: 'blur(16px)',
      }}
    >
      <Container
        maxWidth={false}
        sx={{
          width: 'min(100%, 1512px)',
          height: { xs: 72, md: 88 },
          display: 'grid',
          gridTemplateColumns: { xs: 'auto 1fr auto', md: '1fr auto 1fr' },
          alignItems: 'center',
          columnGap: { xs: 1.25, sm: 2 },
          px: { xs: 2.25, sm: 4, lg: 5.5 },
          mx: 'auto',
        }}
      >
        <Button
          variant="text"
          onClick={() => navigate('/')}
          sx={{
            justifySelf: 'start',
            minWidth: 'auto',
            p: 0,
            color: navBrand.ink,
            textTransform: 'none',
            '&:hover': { bgcolor: 'transparent' },
            '&:focus-visible': {
              outline: `3px solid ${alpha(navBrand.sky, 0.28)}`,
              outlineOffset: 6,
            },
          }}
        >
          <Stack direction="row" spacing={1.75} alignItems="center">
            <Box
              component="img"
              src="/logo.png"
              alt="RabbitHole logo"
              sx={{
                width: { xs: 36, sm: 43 },
                height: { xs: 36, sm: 43 },
                display: 'block',
              }}
            />
            <Typography
              component="span"
              sx={{
                display: { xs: 'none', sm: 'block' },
                color: navBrand.ink,
                fontWeight: 700,
                fontSize: { sm: '1.35rem', md: '1.45rem' },
                letterSpacing: 0,
              }}
            >
              RabbitHole
            </Typography>
          </Stack>
        </Button>

        <Stack
          component="nav"
          direction="row"
          spacing={{ xs: 2, md: 2.6, lg: 3.4 }}
          alignItems="center"
          justifyContent="center"
        >
          {navItems.map(([label, href]) => (
            <Button
              key={label}
              href={getNavHref(href)}
              onClick={(event) => handleNavClick(event, href)}
              variant="text"
              sx={{
                display: {
                  xs: label === 'Pricing' ? 'inline-flex' : 'none',
                  // FAQ only appears once there is room for the full rail.
                  md: label === 'FAQ' ? 'none' : 'inline-flex',
                  lg: 'inline-flex',
                },
                minWidth: 'auto',
                px: 0,
                whiteSpace: 'nowrap',
                color: navBrand.ink,
                textTransform: 'none',
                fontWeight: 700,
                fontSize: { md: '0.95rem', lg: '1rem' },
                '&:hover': {
                  bgcolor: 'transparent',
                  color: navBrand.blue,
                },
              }}
            >
              {label}
            </Button>
          ))}
        </Stack>

        <Button
          variant="outlined"
          endIcon={<ArrowForwardIcon />}
          onClick={openGuestTrial}
          sx={{
            justifySelf: 'end',
            minHeight: { xs: 44, sm: 52 },
            minWidth: { xs: 92, sm: 'auto' },
            px: { xs: 1.8, sm: 3.2 },
            borderRadius: 999,
            borderColor: alpha(navBrand.blue, 0.42),
            bgcolor: alpha(navBrand.surface, 0.82),
            color: navBrand.blueDark,
            boxShadow: `0 14px 34px ${alpha(navBrand.blue, 0.1)}`,
            textTransform: 'none',
            fontWeight: 700,
            fontSize: { xs: '0.95rem', sm: '1rem' },
            '&:hover': {
              borderColor: navBrand.blue,
              bgcolor: navBrand.surface,
              boxShadow: `0 16px 36px ${alpha(navBrand.blue, 0.16)}`,
            },
            '& .MuiButton-endIcon': {
              ml: 1.15,
              display: { xs: 'none', sm: 'inherit' },
            },
          }}
        >
          <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
            Try it
          </Box>
          <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>
            Try it
          </Box>
        </Button>
      </Container>
    </Box>
  )
}

export default LandingTopNav
