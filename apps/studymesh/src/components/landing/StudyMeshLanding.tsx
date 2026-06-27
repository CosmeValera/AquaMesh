import React, { useEffect } from 'react'
import { Box, Button, Container, Stack, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import { useLocation, useNavigate } from 'react-router-dom'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import BoltIcon from '@mui/icons-material/Bolt'
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined'
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined'
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined'
import CheckIcon from '@mui/icons-material/Check'

const brand = {
  canvas: '#FBFDFE',
  header: 'rgba(255, 255, 255, 0.82)',
  ink: '#071127',
  muted: '#5B6680',
  faint: '#AAB5C9',
  line: '#D9E5F3',
  blue: '#1150D8',
  blueDark: '#0D3FAE',
  sky: '#12A7E8',
  mint: '#11C9A3',
  aqua: '#80E1D6',
  lavender: '#EEF0FF',
  mintSoft: '#DDF9EF',
  skySoft: '#E4F4FF',
}

const navItems = [
  ['Features', '#features'],
  ['Pricing', '/pricing'],
]

const timelineItems = [
  {
    label: (
      <>
        20 sec {'\u00b7'} Key idea
      </>
    ),
    body: 'The essence, in a glance.',
    icon: <BoltIcon />,
    tone: brand.mintSoft,
    color: '#008A78',
  },
  {
    label: (
      <>
        60 sec {'\u00b7'} Idea summary
      </>
    ),
    body: 'The details, made simple.',
    icon: <DescriptionOutlinedIcon />,
    tone: brand.skySoft,
    color: brand.blue,
  },
  {
    label: (
      <>
        5 pages {'\u00b7'} Full guide
      </>
    ),
    body: "Go deep when you're ready.",
    icon: <MenuBookOutlinedIcon />,
    tone: brand.lavender,
    color: '#3444C8',
  },
]

const featureItems = [
  {
    title: 'Goal to guide',
    body: 'Start with what you want to learn and get a guided path instead of a blank workspace.',
  },
  {
    title: 'Practice on demand',
    body: 'Ask for quizzes, flashcards, examples, or clearer notes from the guide you are studying.',
  },
  {
    title: 'Keeps context',
    body: 'StudyMesh connects new concepts to the ideas already active in your workspace.',
  },
]

const StudyMeshLanding = () => {
  const location = useLocation()
  const navigate = useNavigate()

  const openCreateStudyGuide = () => {
    navigate('/study-guides?create=1')
  }

  useEffect(() => {
    if (!location.hash) {
      return
    }

    window.requestAnimationFrame(() => {
      document
        .getElementById(location.hash.slice(1))
        ?.scrollIntoView({ block: 'start' })
    })
  }, [location.hash])

  return (
    <Box
      data-testid="studymesh-landing"
      sx={{
        minHeight: '100dvh',
        bgcolor: brand.canvas,
        color: brand.ink,
        overflowX: 'clip',
        fontFamily: '"Readex Pro", "Inter", "Segoe UI", Arial, sans-serif',
      }}
    >
      <Box
        component="header"
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          borderBottom: `1px solid ${alpha(brand.line, 0.32)}`,
          bgcolor: brand.header,
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
              color: brand.ink,
              textTransform: 'none',
              '&:hover': { bgcolor: 'transparent' },
              '&:focus-visible': {
                outline: `3px solid ${alpha(brand.sky, 0.28)}`,
                outlineOffset: 6,
              },
            }}
          >
            <Stack direction="row" spacing={1.35} alignItems="center">
              <Box
                component="img"
                src="/logo.png"
                alt="StudyMesh logo"
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
                  color: brand.ink,
                  fontWeight: 700,
                  fontSize: { sm: '1.35rem', md: '1.45rem' },
                  letterSpacing: 0,
                }}
              >
                StudyMesh
              </Typography>
            </Stack>
          </Button>

          <Stack
            component="nav"
            direction="row"
            spacing={{ xs: 2, md: 4.6 }}
            alignItems="center"
            justifyContent="center"
          >
            {navItems.map(([label, href]) => (
              <Button
                key={label}
                href={href}
                variant="text"
                sx={{
                  display: {
                    xs: label === 'Pricing' ? 'inline-flex' : 'none',
                    sm: 'inline-flex',
                  },
                  minWidth: 'auto',
                  px: 0,
                  color: brand.ink,
                  textTransform: 'none',
                  fontWeight: 700,
                  fontSize: '1rem',
                  '&:hover': {
                    bgcolor: 'transparent',
                    color: brand.blue,
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
            onClick={openCreateStudyGuide}
            sx={{
              justifySelf: 'end',
              minHeight: { xs: 44, sm: 52 },
              minWidth: { xs: 92, sm: 'auto' },
              px: { xs: 1.8, sm: 3.2 },
              borderRadius: 999,
              borderColor: alpha(brand.blue, 0.42),
              bgcolor: alpha('#FFFFFF', 0.82),
              color: brand.blueDark,
              boxShadow: `0 14px 34px ${alpha(brand.blue, 0.1)}`,
              textTransform: 'none',
              fontWeight: 700,
              fontSize: { xs: '0.95rem', sm: '1rem' },
              '&:hover': {
                borderColor: brand.blue,
                bgcolor: '#FFFFFF',
                boxShadow: `0 16px 36px ${alpha(brand.blue, 0.16)}`,
              },
              '& .MuiButton-endIcon': {
                ml: 1.15,
                display: { xs: 'none', sm: 'inherit' },
              },
            }}
          >
            <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
              Create a Study Guide
            </Box>
            <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>
              Create
            </Box>
          </Button>
        </Container>
      </Box>

      <Box component="main">
        <Box
          sx={{
            position: 'relative',
            minHeight: { xs: 'auto', lg: 'calc(100dvh - 88px)' },
            pt: { xs: 6.5, sm: 6.5, md: 9.5 },
            pb: { xs: 7, md: 8 },
            overflow: 'hidden',
          }}
        >
          <DecorativeHeroLayer />

          <Container
            maxWidth={false}
            sx={{
              position: 'relative',
              zIndex: 1,
              width: 'min(100%, 1512px)',
              px: { xs: 2.25, sm: 4, lg: 5.5 },
            }}
          >
            <Stack
              spacing={{ xs: 2.4, md: 3.1 }}
              alignItems="center"
              textAlign="center"
              sx={{ mx: 'auto' }}
            >
              <Box sx={{ position: 'relative', display: 'inline-block' }}>
                <Typography
                  variant="h1"
                  sx={{
                    maxWidth: 1060,
                    color: brand.ink,
                    fontWeight: 700,
                    fontSize: {
                      xs: '3.45rem',
                      sm: '4.55rem',
                      md: '6.6rem',
                    },
                    lineHeight: { xs: 1.04, md: 0.98 },
                    letterSpacing: 0,
                    textWrap: 'balance',
                  }}
                >
                  <Box
                    component="span"
                    sx={{
                      display: 'block',
                      overflow: 'visible',
                      pb: '0.16em',
                      mb: '-0.16em',
                      background: `linear-gradient(90deg, ${brand.mint} 8%, ${brand.sky} 88%)`,
                      backgroundClip: 'text',
                      WebkitBackgroundClip: 'text',
                      color: 'transparent',
                      WebkitTextFillColor: 'transparent',
                    }}
                  >
                    Study guides
                  </Box>
                  <Box component="span" sx={{ display: 'block' }}>
                    that grow with you.
                  </Box>
                </Typography>
                <Box
                  aria-hidden="true"
                  sx={{
                    position: 'absolute',
                    left: { xs: '4%', md: '10%' },
                    right: { xs: '4%', md: '8%' },
                    bottom: { xs: -8, sm: -8, md: -7 },
                    height: { xs: 7, sm: 9, md: 12 },
                    borderRadius: 999,
                    background: `linear-gradient(90deg, ${alpha(
                      brand.mint,
                      0.82,
                    )}, ${alpha(brand.sky, 0.78)})`,
                    transform: 'rotate(-1deg)',
                    zIndex: -1,
                    boxShadow: `0 2px 0 ${alpha(brand.blue, 0.1)}`,
                  }}
                />
              </Box>

              <Typography
                variant="h5"
                component="p"
                sx={{
                  maxWidth: 760,
                  color: brand.muted,
                  lineHeight: 1.48,
                  fontWeight: 400,
                  fontSize: { xs: '1.18rem', md: '1.42rem' },
                  letterSpacing: 0,
                }}
              >
                StudyMesh builds adaptive study guides by connecting new
                concepts to the ideas you already understand.
              </Typography>

              <Stack spacing={2.3} alignItems="center" sx={{ pt: 1 }}>
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={{ xs: 1.25, sm: 2 }}
                  alignItems="center"
                  justifyContent="center"
                >
                  <Button
                    variant="contained"
                    size="large"
                    endIcon={<ArrowForwardIcon />}
                    onClick={openCreateStudyGuide}
                    sx={{
                      minHeight: 70,
                      minWidth: { xs: 276, sm: 386 },
                      px: { xs: 3.2, sm: 5.5 },
                      borderRadius: 999,
                      bgcolor: brand.blue,
                      color: '#FFFFFF',
                      boxShadow: `0 20px 42px ${alpha(brand.blue, 0.28)}`,
                      textTransform: 'none',
                      fontWeight: 700,
                      fontSize: { xs: '1.07rem', sm: '1.15rem' },
                      '&:hover': {
                        bgcolor: brand.blueDark,
                        boxShadow: `0 22px 46px ${alpha(brand.blue, 0.34)}`,
                      },
                      '& .MuiButton-endIcon': { ml: 1.1 },
                    }}
                  >
                    Create a Study Guide
                  </Button>
                  <Button
                    href="#features"
                    variant="text"
                    endIcon={<ArrowForwardIcon />}
                    sx={{
                      minHeight: 50,
                      px: { xs: 1, sm: 1.5 },
                      color: brand.blueDark,
                      textTransform: 'none',
                      fontWeight: 700,
                      fontSize: '1.02rem',
                      position: 'relative',
                      '&:hover': {
                        bgcolor: 'transparent',
                        color: brand.blue,
                      },
                      '&::after': {
                        content: '""',
                        position: 'absolute',
                        left: 12,
                        right: 28,
                        bottom: 5,
                        height: 3,
                        borderRadius: 999,
                        bgcolor: alpha(brand.mint, 0.55),
                        transform: 'rotate(-2deg)',
                      },
                    }}
                  >
                    See how it works
                  </Button>
                </Stack>

                <Typography
                  variant="overline"
                  sx={{
                    color: '#7E8AA1',
                    fontWeight: 400,
                    letterSpacing: '0.28em',
                    fontSize: { xs: '0.68rem', sm: '0.78rem' },
                  }}
                >
                  Free to start {'\u00b7'} No credit card required
                </Typography>
              </Stack>

              <HeroTimeline />
            </Stack>
          </Container>
        </Box>

        <Box
          id="features"
          sx={{
            scrollMarginTop: 104,
            borderTop: `1px solid ${alpha(brand.line, 0.7)}`,
            bgcolor: '#FFFFFF',
            py: { xs: 5, md: 7 },
          }}
        >
          <Container maxWidth="lg">
            <Stack spacing={3.2} alignItems="center" textAlign="center">
              <Stack spacing={1} alignItems="center">
                <Typography
                  variant="overline"
                  sx={{
                    color: brand.blue,
                    fontWeight: 700,
                    letterSpacing: '0.14em',
                  }}
                >
                  Features
                </Typography>
                <Typography
                  variant="h2"
                  sx={{
                    maxWidth: 760,
                    color: brand.ink,
                    fontWeight: 700,
                    fontSize: { xs: '2rem', md: '3.2rem' },
                    lineHeight: 1.08,
                    letterSpacing: 0,
                  }}
                >
                  One prompt becomes a study path you can keep improving.
                </Typography>
              </Stack>

              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
                  gap: 2,
                  width: '100%',
                }}
              >
                {featureItems.map((item) => (
                  <Box
                    key={item.title}
                    sx={{
                      minHeight: 174,
                      p: 2.6,
                      border: `1px solid ${brand.line}`,
                      borderRadius: 2,
                      bgcolor: brand.canvas,
                      textAlign: 'left',
                    }}
                  >
                    <Stack spacing={1}>
                      <Box
                        sx={{
                          width: 38,
                          height: 38,
                          borderRadius: '50%',
                          display: 'grid',
                          placeItems: 'center',
                          color: brand.blue,
                          bgcolor: brand.skySoft,
                        }}
                      >
                        <AutoAwesomeIcon fontSize="small" />
                      </Box>
                      <Typography
                        variant="h6"
                        sx={{ color: brand.ink, fontWeight: 700 }}
                      >
                        {item.title}
                      </Typography>
                      <Typography sx={{ color: brand.muted, lineHeight: 1.55 }}>
                        {item.body}
                      </Typography>
                    </Stack>
                  </Box>
                ))}
              </Box>
            </Stack>
          </Container>
        </Box>

        <Box sx={{ bgcolor: brand.canvas, py: { xs: 5, md: 7 } }}>
          <Container maxWidth="md">
            <Stack spacing={2.4} alignItems="center" textAlign="center">
              <Typography
                variant="h2"
                sx={{
                  color: brand.ink,
                  fontWeight: 700,
                  fontSize: { xs: '2rem', md: '3.1rem' },
                  lineHeight: 1.08,
                }}
              >
                Ready to build your next Study Guide?
              </Typography>
              <Typography sx={{ color: brand.muted, fontSize: '1.08rem' }}>
                Start with a topic. Let StudyMesh create the guide. Keep
                learning as it adapts with you.
              </Typography>
              <Button
                variant="contained"
                size="large"
                endIcon={<ArrowForwardIcon />}
                onClick={openCreateStudyGuide}
                sx={{
                  minHeight: 54,
                  px: 4,
                  borderRadius: 999,
                  bgcolor: brand.blue,
                  color: '#FFFFFF',
                  textTransform: 'none',
                  fontWeight: 700,
                  '&:hover': { bgcolor: brand.blueDark },
                }}
              >
                Create a Study Guide
              </Button>
            </Stack>
          </Container>
        </Box>
      </Box>
    </Box>
  )
}

const HeroTimeline = () => {
  return (
    <Box
      aria-label="Study guide creation timeline"
      sx={{
        width: 'min(100%, 980px)',
        pt: { xs: 2.3, md: 3.2 },
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
        gap: { xs: 2.2, md: 3.2 },
        alignItems: 'start',
      }}
    >
      {timelineItems.map((item, index) => (
        <Box key={`timeline-${index}`} sx={{ position: 'relative' }}>
          {index < timelineItems.length - 1 && (
            <Box
              aria-hidden="true"
              sx={{
                display: { xs: 'none', sm: 'block' },
                position: 'absolute',
                top: 35,
                left: '62%',
                width: '72%',
                height: 0,
                borderTop: `2px dashed ${alpha(brand.faint, 0.64)}`,
                '&::before, &::after': {
                  content: '""',
                  position: 'absolute',
                  top: -5,
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  bgcolor: alpha(brand.faint, 0.8),
                },
                '&::before': { left: -5 },
                '&::after': { right: -5 },
              }}
            />
          )}
          <Stack spacing={1.25} alignItems="center">
            <Box
              sx={{
                width: 70,
                height: 70,
                borderRadius: '50%',
                display: 'grid',
                placeItems: 'center',
                bgcolor: item.tone,
                color: item.color,
                border: `1px solid ${alpha(item.color, 0.12)}`,
                boxShadow: `0 10px 28px ${alpha(item.color, 0.12)}`,
                '& svg': { fontSize: 33 },
              }}
            >
              {item.icon}
            </Box>
            <Stack spacing={0.45} alignItems="center">
              <Typography
                sx={{
                  color: brand.ink,
                  fontWeight: 700,
                  fontSize: '1rem',
                }}
              >
                {item.label}
              </Typography>
              <Typography sx={{ color: brand.muted, fontSize: '0.92rem' }}>
                {item.body}
              </Typography>
            </Stack>
          </Stack>
        </Box>
      ))}
    </Box>
  )
}

const DecorativeHeroLayer = () => (
  <Box aria-hidden="true">
    <Box
      sx={{
        position: 'absolute',
        inset: 0,
        background:
          'radial-gradient(circle at 50% 44%, rgba(17, 201, 163, 0.12), transparent 29%), radial-gradient(circle at 62% 36%, rgba(18, 167, 232, 0.14), transparent 24%)',
      }}
    />
    <Box
      sx={{
        display: { xs: 'none', md: 'block' },
        position: 'absolute',
        left: -42,
        bottom: 96,
        width: 124,
        height: 330,
        opacity: 0.5,
        backgroundImage:
          'linear-gradient(#BFD4E9 1px, transparent 1px), linear-gradient(90deg, #BFD4E9 1px, transparent 1px)',
        backgroundSize: '28px 28px',
        transform: 'rotate(-7deg)',
        borderRadius: 2,
        filter: 'blur(0.2px)',
      }}
    />
    <Box
      sx={{
        display: { xs: 'none', sm: 'grid' },
        position: 'absolute',
        left: { sm: '4%', lg: '8.5%' },
        top: { sm: '17%', lg: '18%' },
        width: { sm: 58, lg: 82 },
        height: { sm: 58, lg: 82 },
        placeItems: 'center',
        color: alpha(brand.blue, 0.23),
        '&::before, &::after': {
          content: '""',
          position: 'absolute',
          width: { sm: 74, lg: 104 },
          height: { sm: 27, lg: 38 },
          border: `2px solid ${alpha(brand.blue, 0.22)}`,
          borderRadius: '50%',
        },
        '&::before': { transform: 'rotate(27deg)' },
        '&::after': { transform: 'rotate(-27deg)' },
      }}
    >
      <Box
        sx={{
          width: 13,
          height: 13,
          borderRadius: '50%',
          border: `2px solid ${alpha(brand.blue, 0.28)}`,
        }}
      />
    </Box>
    <Box
      sx={{
        display: { xs: 'none', lg: 'block' },
        position: 'absolute',
        right: { sm: '4%', lg: '8%' },
        top: { sm: '15%', lg: '16%' },
        width: { sm: 104, lg: 136 },
        height: { sm: 104, lg: 136 },
        border: `1.5px solid ${alpha(brand.mint, 0.35)}`,
        borderRadius: 1,
        transform: 'rotate(10deg)',
        color: alpha('#469B93', 0.45),
        p: 2,
        fontSize: { sm: '0.78rem', lg: '1.04rem' },
        lineHeight: 1.85,
        boxShadow: `0 18px 36px ${alpha(brand.mint, 0.1)}`,
      }}
    >
      <Stack spacing={0.3}>
        {['Focus', 'Plan', 'Progress'].map((item) => (
          <Stack key={item} direction="row" spacing={0.9} alignItems="center">
            <CheckIcon sx={{ fontSize: 18 }} />
            <Box component="span">{item}</Box>
          </Stack>
        ))}
      </Stack>
    </Box>
    <LightbulbOutlinedIcon
      sx={{
        display: { xs: 'none', lg: 'block' },
        position: 'absolute',
        right: { sm: '8%', lg: '10.5%' },
        top: { sm: '54%', lg: '52%' },
        fontSize: { sm: 56, lg: 78 },
        color: alpha(brand.blue, 0.2),
        filter: `drop-shadow(0 8px 14px ${alpha(brand.blue, 0.08)})`,
      }}
    />
    <AutoAwesomeIcon
      sx={{
        display: { xs: 'none', md: 'block' },
        position: 'absolute',
        left: '11%',
        top: '45%',
        fontSize: 26,
        color: alpha(brand.mint, 0.45),
      }}
    />
    <AutoAwesomeIcon
      sx={{
        display: { xs: 'none', md: 'block' },
        position: 'absolute',
        right: '16%',
        top: '65%',
        fontSize: 23,
        color: alpha(brand.mint, 0.42),
      }}
    />
  </Box>
)

export default StudyMeshLanding
