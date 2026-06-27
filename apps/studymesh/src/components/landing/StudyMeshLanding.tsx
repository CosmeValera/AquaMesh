import React, { useEffect, useState } from 'react'
import { Box, Button, Container, Stack, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import { useLocation, useNavigate } from 'react-router-dom'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import BoltIcon from '@mui/icons-material/Bolt'
import CameraAltOutlinedIcon from '@mui/icons-material/CameraAltOutlined'
import SportsEsportsOutlinedIcon from '@mui/icons-material/SportsEsportsOutlined'
import FitnessCenterOutlinedIcon from '@mui/icons-material/FitnessCenterOutlined'
import RestaurantOutlinedIcon from '@mui/icons-material/RestaurantOutlined'
import TrendingUpOutlinedIcon from '@mui/icons-material/TrendingUpOutlined'
import AccountBalanceOutlinedIcon from '@mui/icons-material/AccountBalanceOutlined'
import ScienceOutlinedIcon from '@mui/icons-material/ScienceOutlined'
import MusicNoteOutlinedIcon from '@mui/icons-material/MusicNoteOutlined'
import CodeOutlinedIcon from '@mui/icons-material/CodeOutlined'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import SwapHorizIcon from '@mui/icons-material/SwapHoriz'
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined'
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined'
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

type ContextTopic = {
  id: string
  label: string
  question: string
  contextLabel: string
  contextAnswer: string
  noContextAnswer: string
  icon: React.ReactNode
  color: string
  tone: string
}

const contextTopics: ContextTopic[] = [
  {
    id: 'photography',
    label: 'Photography',
    question: 'How does the human eye work?',
    contextLabel: 'Photography',
    contextAnswer:
      'Think of a living camera: the pupil controls exposure, the lens focuses, the retina captures light, and the brain processes the image.',
    noContextAnswer:
      'The human eye works by taking in light, focusing it onto the retina, and sending signals to the brain, which turns them into vision.',
    icon: <CameraAltOutlinedIcon />,
    color: '#008A78',
    tone: brand.mintSoft,
  },
  {
    id: 'gaming',
    label: 'Gaming',
    question: 'What is inflation?',
    contextLabel: 'Gaming',
    contextAnswer:
      'Think of a game economy: if everyone gets more coins but shop prices rise too, each coin buys less.',
    noContextAnswer:
      'Inflation means prices rise across the economy, so the same amount of money buys fewer goods and services over time.',
    icon: <SportsEsportsOutlinedIcon />,
    color: '#356BF6',
    tone: '#EAF0FF',
  },
  {
    id: 'fitness',
    label: 'Fitness',
    question: 'What is muscle memory?',
    contextLabel: 'Fitness',
    contextAnswer:
      'Like repeating a lift until the movement feels smoother, your nervous system learns the pattern and recalls it faster next time.',
    noContextAnswer:
      'Muscle memory is the way repeated practice helps your brain and nervous system perform a movement more easily later.',
    icon: <FitnessCenterOutlinedIcon />,
    color: '#7A4BC2',
    tone: '#F1ECFF',
  },
  {
    id: 'cooking',
    label: 'Cooking',
    question: 'What is a chemical reaction?',
    contextLabel: 'Cooking',
    contextAnswer:
      'It is like browning onions: heat changes the ingredients into new compounds with different color, smell, and flavor.',
    noContextAnswer:
      'A chemical reaction happens when substances rearrange their atoms and form new substances with different properties.',
    icon: <RestaurantOutlinedIcon />,
    color: '#E05AD8',
    tone: '#FFF0FC',
  },
  {
    id: 'books',
    label: 'Books',
    question: 'What is foreshadowing?',
    contextLabel: 'Books',
    contextAnswer:
      'It is a clue planted early in a story so a later event feels earned instead of random.',
    noContextAnswer:
      'Foreshadowing is a storytelling technique where hints suggest what may happen later.',
    icon: <MenuBookOutlinedIcon />,
    color: '#E68000',
    tone: '#FFF4E2',
  },
  {
    id: 'investing',
    label: 'Investing',
    question: 'What is compound growth?',
    contextLabel: 'Investing',
    contextAnswer:
      'It works like reinvesting gains: each new gain can also start earning, so progress can accelerate over time.',
    noContextAnswer:
      'Compound growth happens when growth is added back to the starting amount, making later growth build on earlier growth.',
    icon: <TrendingUpOutlinedIcon />,
    color: '#7B45C8',
    tone: '#F2ECFF',
  },
  {
    id: 'law',
    label: 'Law',
    question: 'What is precedent?',
    contextLabel: 'Law',
    contextAnswer:
      'It is like a previous ruling becoming a guide: future decisions use it as a reference when the facts are similar.',
    noContextAnswer:
      'A precedent is an earlier decision or example that influences how similar cases or choices are handled later.',
    icon: <AccountBalanceOutlinedIcon />,
    color: '#CC202A',
    tone: '#FFF0F1',
  },
  {
    id: 'physics',
    label: 'Physics',
    question: 'What is an atom?',
    contextLabel: 'Physics',
    contextAnswer:
      'Think of matter as built from tiny units: atoms are the small structures whose parts determine how materials behave.',
    noContextAnswer:
      'An atom is a tiny unit of matter made from a nucleus and surrounding electrons.',
    icon: <ScienceOutlinedIcon />,
    color: '#D82E2E',
    tone: '#FFF0F0',
  },
  {
    id: 'music',
    label: 'Music',
    question: 'What is rhythm?',
    contextLabel: 'Music',
    contextAnswer:
      'Rhythm is the timing pattern that makes notes feel organized, like the beat that tells a song how to move.',
    noContextAnswer:
      'Rhythm is the pattern of sounds and silences over time.',
    icon: <MusicNoteOutlinedIcon />,
    color: '#A8790B',
    tone: '#FFF7E1',
  },
  {
    id: 'tech',
    label: 'Tech',
    question: 'What is an API?',
    contextLabel: 'Tech',
    contextAnswer:
      'Think of it as a contract between apps: one system sends a request, the other returns data or performs an action through a defined interface.',
    noContextAnswer:
      'An API is a way for software systems to communicate through defined requests and responses.',
    icon: <CodeOutlinedIcon />,
    color: '#154397',
    tone: '#EAF1FF',
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
            overflow: 'visible',
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

        <ContextComparisonSection />

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
        <Box
          key={`timeline-${index}`}
          sx={{ position: 'relative' }}
        >
          {index < timelineItems.length - 1 && (
            <Box
              aria-hidden="true"
              sx={{
                display: { xs: 'none', sm: 'block' },
                position: 'absolute',
                top: 35,
                left: '74%',
                width: '54%',
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
              tabIndex={0}
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
                transition:
                  'transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease',
                '& svg': {
                  fontSize: 33,
                  transition: 'filter 180ms ease',
                },
                '&:hover': {
                  transform: 'translateY(-3px)',
                  borderColor: alpha(item.color, 0.28),
                  boxShadow: `0 0 0 8px ${alpha(item.color, 0.09)}, 0 18px 40px ${alpha(
                    item.color,
                    0.26,
                  )}`,
                },
                '&:hover svg': {
                  filter: `drop-shadow(0 0 8px ${alpha(item.color, 0.48)})`,
                },
                '&:focus-visible': {
                  outline: `3px solid ${alpha(item.color, 0.34)}`,
                  outlineOffset: 4,
                },
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

const ContextComparisonSection = () => {
  const [activeIndex, setActiveIndex] = useState(0)
  const [showContext, setShowContext] = useState(true)
  const activeTopic = contextTopics[activeIndex]
  const previousTopic =
    contextTopics[(activeIndex - 1 + contextTopics.length) % contextTopics.length]
  const nextTopic = contextTopics[(activeIndex + 1) % contextTopics.length]
  const visibleAnswer = showContext
    ? activeTopic.contextAnswer
    : activeTopic.noContextAnswer

  const selectTopic = (index: number) => {
    setActiveIndex(index)
    setShowContext(true)
  }

  const moveTopic = (direction: -1 | 1) => {
    const nextIndex =
      (activeIndex + direction + contextTopics.length) % contextTopics.length
    selectTopic(nextIndex)
  }

  return (
    <Box
      sx={{
        position: 'relative',
        py: { xs: 5.5, md: 8 },
        bgcolor: '#FFFFFF',
        borderTop: `1px solid ${alpha(brand.line, 0.62)}`,
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(circle at 18% 14%, ${alpha(
            brand.sky,
            0.13,
          )}, transparent 27%), radial-gradient(circle at 82% 22%, ${alpha(
            brand.mint,
            0.13,
          )}, transparent 28%), radial-gradient(circle at 50% 78%, ${alpha(
            brand.blue,
            0.08,
          )}, transparent 36%)`,
          pointerEvents: 'none',
        },
      }}
    >
      <Container maxWidth="lg" sx={{ position: 'relative' }}>
        <Stack spacing={3.2} alignItems="center" textAlign="center">
          <Stack spacing={1.15} alignItems="center">
            <Box
              sx={{
                px: 2,
                py: 0.65,
                borderRadius: 999,
                color: '#008A78',
                bgcolor: alpha(brand.mint, 0.13),
                fontWeight: 800,
                fontSize: '0.82rem',
                lineHeight: 1,
                letterSpacing: 0,
              }}
            >
              KNOWLEDGE CONTEXT
            </Box>
            <Typography
              variant="h2"
              sx={{
                maxWidth: 880,
                color: brand.ink,
                fontWeight: 800,
                fontSize: { xs: '2rem', md: '3.05rem' },
                lineHeight: 1.08,
                letterSpacing: 0,
              }}
            >
              Same question. More personal explanation.
            </Typography>
            <Typography
              sx={{
                maxWidth: 760,
                color: '#64719B',
                fontSize: { xs: '1rem', md: '1.18rem' },
                lineHeight: 1.58,
              }}
            >
              StudyMesh adapts the same answer to knowledge you already have.
            </Typography>
          </Stack>

          <Box
            aria-label="Knowledge context topics"
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: 'repeat(10, minmax(104px, 1fr))',
                lg: 'repeat(10, minmax(0, 1fr))',
              },
              gap: { xs: 1.35, md: 1.7 },
              width: '100%',
              overflowX: { xs: 'auto', lg: 'visible' },
              pb: { xs: 0.5, lg: 0 },
              px: { xs: 0.25, md: 0 },
              scrollbarWidth: 'none',
              '&::-webkit-scrollbar': { display: 'none' },
            }}
          >
            {contextTopics.map((topic, index) => {
              const selected = index === activeIndex

              return (
                <Button
                  key={topic.id}
                  aria-pressed={selected}
                  onClick={() => selectTopic(index)}
                  sx={{
                    minWidth: 0,
                    height: { xs: 102, md: 118 },
                    p: 1.15,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1,
                    color: selected ? topic.color : brand.ink,
                    bgcolor: selected ? alpha(topic.color, 0.08) : '#FFFFFF',
                    border: `1px solid ${
                      selected ? alpha(topic.color, 0.72) : alpha(brand.line, 0.82)
                    }`,
                    borderRadius: 2,
                    boxShadow: selected
                      ? `0 18px 44px ${alpha(topic.color, 0.16)}`
                      : `0 12px 38px ${alpha(brand.blueDark, 0.05)}`,
                    textTransform: 'none',
                    fontWeight: 800,
                    transition:
                      'transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease',
                    '&:hover': {
                      bgcolor: selected ? alpha(topic.color, 0.11) : '#FFFFFF',
                      borderColor: alpha(topic.color, 0.42),
                      transform: 'translateY(-2px)',
                      boxShadow: `0 18px 46px ${alpha(topic.color, 0.14)}`,
                    },
                  }}
                >
                  <Box
                    sx={{
                      width: 44,
                      height: 44,
                      borderRadius: '50%',
                      display: 'grid',
                      placeItems: 'center',
                      color: topic.color,
                      bgcolor: topic.tone,
                      boxShadow: `0 10px 28px ${alpha(topic.color, 0.13)}`,
                      '& svg': { fontSize: 25 },
                    }}
                  >
                    {topic.icon}
                  </Box>
                  <Box component="span">{topic.label}</Box>
                </Button>
              )
            })}
          </Box>

          <Box
            sx={{
              position: 'relative',
              width: '100%',
              minHeight: { xs: 390, md: 430 },
              display: 'grid',
              placeItems: 'center',
              mt: 0.6,
            }}
          >
            <CarouselArrow
              label="Show previous knowledge context"
              side="left"
              onClick={() => moveTopic(-1)}
            />
            <CarouselArrow
              label="Show next knowledge context"
              side="right"
              onClick={() => moveTopic(1)}
            />
            <PreviewContextCard topic={previousTopic} side="left" />
            <PreviewContextCard topic={nextTopic} side="right" />
            <FeaturedContextCard
              topic={activeTopic}
              answer={visibleAnswer}
              showContext={showContext}
              onToggleContext={() => setShowContext((value) => !value)}
            />
          </Box>

          <Stack direction="row" spacing={1.45} aria-label="Context carousel page">
            {contextTopics.slice(0, 5).map((topic, index) => (
              <Box
                key={topic.id}
                aria-hidden="true"
                sx={{
                  width: index === activeIndex ? 15 : 11,
                  height: 11,
                  borderRadius: 999,
                  bgcolor:
                    index === activeIndex ? activeTopic.color : '#D9DEEB',
                  transition: 'all 160ms ease',
                }}
              />
            ))}
          </Stack>

          <Box
            sx={{
              width: { xs: '100%', md: '76%' },
              p: { xs: 2, md: 2.4 },
              borderRadius: 2,
              border: `1px solid ${alpha(brand.mint, 0.42)}`,
              bgcolor: alpha('#F5FFFC', 0.76),
              boxShadow: `0 24px 70px ${alpha(brand.blueDark, 0.08)}`,
              textAlign: 'left',
            }}
          >
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
              <Box
                sx={{
                  width: 62,
                  height: 62,
                  flex: '0 0 auto',
                  borderRadius: '50%',
                  display: 'grid',
                  placeItems: 'center',
                  color: brand.blue,
                  bgcolor: '#FFFFFF',
                  boxShadow: `0 16px 42px ${alpha(brand.blueDark, 0.12)}`,
                  '& svg': { fontSize: 30 },
                }}
              >
                <AutoAwesomeIcon />
              </Box>
              <Box>
                <Typography sx={{ color: brand.ink, fontWeight: 800, fontSize: '1.08rem' }}>
                  The same question becomes clearer with the right context.
                </Typography>
                <Typography sx={{ color: '#64719B', lineHeight: 1.55 }}>
                  When StudyMesh knows what you already understand, it can explain
                  new ideas in a simpler, more intuitive way.
                </Typography>
              </Box>
            </Stack>
          </Box>
        </Stack>
      </Container>
    </Box>
  )
}

const FeaturedContextCard = ({
  topic,
  answer,
  showContext,
  onToggleContext,
}: {
  topic: ContextTopic
  answer: string
  showContext: boolean
  onToggleContext: () => void
}) => (
  <Box
    sx={{
      position: 'relative',
      zIndex: 2,
      width: { xs: '100%', md: '68%' },
      maxWidth: 760,
      p: { xs: 2.2, md: 3.2 },
      borderRadius: 2,
      border: `1px solid ${alpha(brand.line, 0.95)}`,
      bgcolor: alpha('#FFFFFF', 0.94),
      boxShadow: `0 28px 80px ${alpha(brand.blueDark, 0.14)}`,
      textAlign: 'left',
    }}
  >
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: '1.45fr 0.95fr' },
        gap: { xs: 2.2, md: 3 },
        alignItems: 'center',
      }}
    >
      <Stack spacing={2}>
        <Stack direction="row" spacing={1.2} alignItems="center">
          <ContextIcon topic={topic} size={52} />
          <Box
            sx={{
              px: 1.35,
              py: 0.55,
              borderRadius: 999,
              color: topic.color,
              bgcolor: alpha(topic.color, 0.12),
              fontWeight: 800,
            }}
          >
            {showContext ? topic.contextLabel : 'No context'}
          </Box>
        </Stack>
        <Typography
          variant="h3"
          sx={{
            color: brand.ink,
            fontWeight: 800,
            fontSize: { xs: '1.45rem', md: '1.95rem' },
            lineHeight: 1.16,
            letterSpacing: 0,
          }}
        >
          {topic.question}
        </Typography>
        <Typography sx={{ color: brand.ink, fontSize: '1.04rem', lineHeight: 1.72 }}>
          {answer}
        </Typography>
        <Button
          variant="outlined"
          onClick={onToggleContext}
          startIcon={<SwapHorizIcon />}
          sx={{
            alignSelf: 'flex-start',
            px: 2.1,
            py: 0.9,
            borderRadius: 1,
            color: brand.ink,
            borderColor: alpha(brand.blue, 0.18),
            bgcolor: '#FFFFFF',
            fontWeight: 800,
            textTransform: 'none',
            '&:hover': {
              borderColor: alpha(topic.color, 0.44),
              bgcolor: alpha(topic.color, 0.07),
            },
          }}
        >
          {showContext ? 'Show without context' : `Show ${topic.contextLabel} context`}
        </Button>
      </Stack>
      <ContextVisual topic={topic} />
    </Box>
  </Box>
)

const PreviewContextCard = ({
  topic,
  side,
}: {
  topic: ContextTopic
  side: 'left' | 'right'
}) => (
  <Box
    aria-hidden="true"
    sx={{
      display: { xs: 'none', md: 'block' },
      position: 'absolute',
      top: '50%',
      [side]: 24,
      width: '31%',
      minHeight: 255,
      p: 2.4,
      borderRadius: 2,
      border: `1px solid ${alpha(brand.line, 0.74)}`,
      bgcolor: alpha('#FFFFFF', 0.74),
      boxShadow: `0 22px 62px ${alpha(brand.blueDark, 0.08)}`,
      transform: `translateY(-50%) scale(0.93)`,
      opacity: 0.82,
      textAlign: 'left',
      overflow: 'hidden',
    }}
  >
    <Stack spacing={1.4}>
      <Stack direction="row" spacing={1} alignItems="center">
        <ContextIcon topic={topic} size={42} />
        <Typography sx={{ color: brand.ink, fontWeight: 800 }}>
          {topic.label}
        </Typography>
      </Stack>
      <Typography sx={{ color: brand.ink, fontWeight: 800, fontSize: '1.05rem' }}>
        {topic.question}
      </Typography>
      <Typography sx={{ color: '#59668A', lineHeight: 1.62 }}>
        {topic.contextAnswer}
      </Typography>
    </Stack>
  </Box>
)

const CarouselArrow = ({
  side,
  label,
  onClick,
}: {
  side: 'left' | 'right'
  label: string
  onClick: () => void
}) => (
  <Button
    aria-label={label}
    onClick={onClick}
    sx={{
      position: 'absolute',
      zIndex: 3,
      top: '50%',
      [side]: { xs: side === 'left' ? 4 : 'auto', md: 0 },
      right: { xs: side === 'right' ? 4 : 'auto', md: side === 'right' ? 0 : 'auto' },
      minWidth: 0,
      width: { xs: 44, md: 54 },
      height: { xs: 44, md: 54 },
      p: 0,
      borderRadius: '50%',
      color: brand.ink,
      bgcolor: '#FFFFFF',
      border: `1px solid ${alpha(brand.line, 0.9)}`,
      boxShadow: `0 14px 34px ${alpha(brand.blueDark, 0.12)}`,
      transform: 'translateY(-50%)',
      '&:hover': {
        bgcolor: brand.skySoft,
        borderColor: alpha(brand.blue, 0.3),
      },
    }}
  >
    {side === 'left' ? <ChevronLeftIcon /> : <ChevronRightIcon />}
  </Button>
)

const ContextIcon = ({
  topic,
  size,
}: {
  topic: ContextTopic
  size: number
}) => (
  <Box
    sx={{
      width: size,
      height: size,
      flex: '0 0 auto',
      borderRadius: '50%',
      display: 'grid',
      placeItems: 'center',
      color: topic.color,
      bgcolor: topic.tone,
      boxShadow: `0 12px 30px ${alpha(topic.color, 0.14)}`,
      '& svg': { fontSize: Math.round(size * 0.54) },
    }}
  >
    {topic.icon}
  </Box>
)

const ContextVisual = ({ topic }: { topic: ContextTopic }) => (
  <Box
    aria-hidden="true"
    sx={{
      minHeight: { xs: 180, md: 226 },
      borderRadius: 2,
      position: 'relative',
      overflow: 'hidden',
      bgcolor: '#DDE5EE',
      background:
        topic.id === 'photography'
          ? 'linear-gradient(135deg, #E8EEF4 0%, #A7B1BE 42%, #F7FAFC 100%)'
          : `radial-gradient(circle at 52% 44%, ${alpha(
              topic.color,
              0.22,
            )}, transparent 28%), linear-gradient(135deg, #F8FBFF, ${topic.tone})`,
      boxShadow: `inset 0 0 0 1px ${alpha('#FFFFFF', 0.72)}`,
      display: 'grid',
      placeItems: 'center',
    }}
  >
    {topic.id === 'photography' ? (
      <>
        <Box
          sx={{
            position: 'absolute',
            width: '72%',
            height: '48%',
            left: '14%',
            top: '34%',
            borderRadius: '16px 16px 24px 24px',
            bgcolor: '#121723',
            boxShadow: `0 28px 48px ${alpha('#050B16', 0.3)}`,
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            width: '44%',
            aspectRatio: '1',
            borderRadius: '50%',
            left: '28%',
            top: '24%',
            background:
              'radial-gradient(circle at 50% 50%, #071127 0 22%, #0E554F 23% 32%, #D7821F 33% 37%, #121723 38% 57%, #2D3441 58% 72%, #080D17 73% 100%)',
            boxShadow: `0 0 0 10px ${alpha('#FFFFFF', 0.1)}, 0 18px 36px ${alpha(
              '#000000',
              0.32,
            )}`,
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            width: '34%',
            height: '16%',
            left: '19%',
            top: '26%',
            borderRadius: '12px 12px 4px 4px',
            bgcolor: '#252B36',
          }}
        />
      </>
    ) : (
      <Box
        sx={{
          width: 96,
          height: 96,
          borderRadius: '50%',
          display: 'grid',
          placeItems: 'center',
          color: topic.color,
          bgcolor: alpha('#FFFFFF', 0.78),
          boxShadow: `0 20px 52px ${alpha(topic.color, 0.18)}`,
          '& svg': { fontSize: 52 },
        }}
      >
        {topic.icon}
      </Box>
    )}
  </Box>
)

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
    <DecorativeAtom />
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
    <DecorativeLightbulb />
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

const DecorativeAtom = () => (
  <Box
    component="svg"
    viewBox="0 0 132 112"
    aria-hidden="true"
    sx={{
      display: { xs: 'none', sm: 'block' },
      position: 'absolute',
      left: { sm: '4%', lg: '8.5%' },
      top: { sm: '17%', lg: '18%' },
      width: { sm: 76, lg: 116 },
      height: { sm: 64, lg: 98 },
      overflow: 'visible',
      filter: `drop-shadow(0 12px 20px ${alpha(brand.blue, 0.1)})`,
    }}
  >
    <defs>
      <linearGradient id="decorativeAtomStroke" x1="0" x2="1" y1="0" y2="1">
        <stop offset="0%" stopColor="#7CA6FF" />
        <stop offset="100%" stopColor="#B8CCFF" />
      </linearGradient>
    </defs>
    <g
      fill="none"
      stroke="url(#decorativeAtomStroke)"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2.2"
      opacity="0.58"
    >
      <ellipse cx="66" cy="56" rx="58" ry="18" />
      <ellipse cx="66" cy="56" rx="58" ry="18" transform="rotate(58 66 56)" />
      <ellipse cx="66" cy="56" rx="58" ry="18" transform="rotate(-58 66 56)" />
    </g>
    <circle
      cx="66"
      cy="56"
      r="7"
      fill="#FFFFFF"
      stroke="#91B3FF"
      strokeWidth="2"
      opacity="0.72"
    />
    <circle cx="103" cy="41" r="3.2" fill="#91B3FF" opacity="0.72" />
    <circle cx="41" cy="24" r="3" fill="#91B3FF" opacity="0.58" />
    <circle cx="78" cy="91" r="3.4" fill="#91B3FF" opacity="0.62" />
  </Box>
)

const DecorativeLightbulb = () => (
  <Box
    component="svg"
    viewBox="0 0 96 112"
    aria-hidden="true"
    sx={{
      display: { xs: 'none', lg: 'block' },
      position: 'absolute',
      right: { sm: '8%', lg: '10.5%' },
      top: { sm: '54%', lg: '52%' },
      width: { sm: 58, lg: 82 },
      height: { sm: 68, lg: 96 },
      overflow: 'visible',
      filter: `drop-shadow(0 14px 24px ${alpha(brand.blue, 0.1)})`,
    }}
  >
    <g
      fill="none"
      stroke="#9DB7F6"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="4.6"
      opacity="0.58"
    >
      <path d="M48 10c-18 0-32 14-32 32 0 11 5 19 13 26 5 5 7 9 7 17h24c0-8 2-12 7-17 8-7 13-15 13-26 0-18-14-32-32-32Z" />
      <path d="M37 87h22" />
      <path d="M39 100h18" />
      <path d="M37 48c5 4 9 6 11 18 2-12 6-14 11-18" />
      <path d="M35 44c4 0 6 2 6 5s-2 5-5 5" opacity="0.5" />
      <path d="M61 44c-4 0-6 2-6 5s2 5 5 5" opacity="0.5" />
    </g>
    <g stroke="#9DB7F6" strokeLinecap="round" strokeWidth="2.4" opacity="0.44">
      <path d="M48 0v8" />
      <path d="M16 14l6 6" />
      <path d="M80 14l-6 6" />
      <path d="M0 44h8" />
      <path d="M88 44h8" />
    </g>
  </Box>
)

export default StudyMeshLanding
