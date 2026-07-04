import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
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
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined'
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined'
import CheckIcon from '@mui/icons-material/Check'
import SpaOutlinedIcon from '@mui/icons-material/SpaOutlined'

import StudyMeshFooter from './StudyMeshFooter'
import LandingTopNav, { scrollToLandingSection } from './LandingTopNav'

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

const landingSurfaceBackground = [
  `radial-gradient(circle at 50% 11%, ${alpha(
    brand.sky,
    0.075,
  )}, transparent 24%)`,
  `radial-gradient(circle at 82% 43%, ${alpha(
    brand.blue,
    0.045,
  )}, transparent 18%)`,
  `radial-gradient(circle at 18% 70%, ${alpha(
    brand.mint,
    0.035,
  )}, transparent 20%)`,
  'linear-gradient(180deg, #FFFFFF 0%, #FFFFFF 100%)',
].join(', ')

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

const growingGuideBenefits = [
  'Starts with 5 organized pages',
  'Ask AI Chat for more',
  'New pages are added automatically',
]

const growingGuidePages = [
  '01 The Water Cycle',
  '02 Evaporation',
  '03 Condensation',
  '04 Cloud Growth',
  '05 Precipitation',
  '06 Review Pack',
]

type ContextTopic = {
  id: string
  label: string
  contextLabel: string
  contextAnswer: string
  icon: React.ReactNode
  color: string
  tone: string
  visualSrc: string
}

const contextQuestion = 'What is a trade-off?'

const noContextTradeoffAnswer =
  'A trade-off is when improving one thing usually means giving up something else.'

const contextTopics: ContextTopic[] = [
  {
    id: 'photography',
    label: 'Photography',
    contextLabel: 'Photography',
    contextAnswer:
      'Think of exposure settings: a wider aperture gives more light and blurrier backgrounds, but less of the scene stays sharp.',
    icon: <CameraAltOutlinedIcon />,
    color: '#008A78',
    tone: brand.mintSoft,
    visualSrc: '/images/landing/context-photography.jpg',
  },
  {
    id: 'gaming',
    label: 'Gaming',
    contextLabel: 'Gaming',
    contextAnswer:
      'Think of a character build: more damage may mean less defense, less speed, or fewer healing options.',
    icon: <SportsEsportsOutlinedIcon />,
    color: '#356BF6',
    tone: '#EAF0FF',
    visualSrc: '/images/landing/context-gaming.jpg',
  },
  {
    id: 'fitness',
    label: 'Fitness',
    contextLabel: 'Fitness',
    contextAnswer:
      'Think of training volume: doing more sets can build more muscle, but it also increases fatigue and recovery needs.',
    icon: <FitnessCenterOutlinedIcon />,
    color: '#7A4BC2',
    tone: '#F1ECFF',
    visualSrc: '/images/landing/context-fitness.jpg',
  },
  {
    id: 'cooking',
    label: 'Cooking',
    contextLabel: 'Cooking',
    contextAnswer:
      'Think of heat: higher heat can brown food faster, but it also makes it easier to burn the outside before the inside cooks.',
    icon: <RestaurantOutlinedIcon />,
    color: '#E05AD8',
    tone: '#FFF0FC',
    visualSrc: '/images/landing/context-cooking.jpg',
  },
  {
    id: 'books',
    label: 'Books',
    contextLabel: 'Books',
    contextAnswer:
      'Think of pacing: adding more detail can make a world richer, but it can also slow the story down.',
    icon: <MenuBookOutlinedIcon />,
    color: '#E68000',
    tone: '#FFF4E2',
    visualSrc: '/images/landing/context-books.jpg',
  },
  {
    id: 'investing',
    label: 'Investing',
    contextLabel: 'Investing',
    contextAnswer:
      'Think of risk and return: chasing higher potential gains usually means accepting more uncertainty.',
    icon: <TrendingUpOutlinedIcon />,
    color: '#7B45C8',
    tone: '#F2ECFF',
    visualSrc: '/images/landing/context-investing.jpg',
  },
  {
    id: 'law',
    label: 'Law',
    contextLabel: 'Law',
    contextAnswer:
      'Think of rights and safety: stronger enforcement may improve security, but it can also limit personal freedom.',
    icon: <AccountBalanceOutlinedIcon />,
    color: '#CC202A',
    tone: '#FFF0F1',
    visualSrc: '/images/landing/context-law.jpg',
  },
  {
    id: 'physics',
    label: 'Physics',
    contextLabel: 'Physics',
    contextAnswer:
      'Think of energy and precision: pushing a system harder can increase output, but it may also create more heat, waste, or instability.',
    icon: <ScienceOutlinedIcon />,
    color: '#D82E2E',
    tone: '#FFF0F0',
    visualSrc: '/images/landing/context-physics.jpg',
  },
  {
    id: 'music',
    label: 'Music',
    contextLabel: 'Music',
    contextAnswer:
      'Think of song arrangement: adding more layers can make the track richer, but too many can make it feel crowded.',
    icon: <MusicNoteOutlinedIcon />,
    color: '#A8790B',
    tone: '#FFF7E1',
    visualSrc: '/images/landing/context-music.jpg',
  },
  {
    id: 'tech',
    label: 'Tech',
    contextLabel: 'Tech',
    contextAnswer:
      'Think of software design: optimizing for speed can make code harder to read, test, or maintain.',
    icon: <CodeOutlinedIcon />,
    color: '#154397',
    tone: '#EAF1FF',
    visualSrc: '/images/landing/context-tech.jpg',
  },
]

const preloadedContextImages: HTMLImageElement[] = []

const preloadContextImages = () => {
  if (preloadedContextImages.length > 0 || typeof Image === 'undefined') {
    return
  }

  contextTopics.forEach((topic) => {
    const image = new Image()
    image.decoding = 'async'
    image.src = topic.visualSrc
    preloadedContextImages.push(image)

    if (typeof image.decode === 'function') {
      void image.decode().catch(() => undefined)
    }
  })
}

const countInlineLines = (element: HTMLElement) => {
  const lineTops = new Set<number>()

  Array.from(element.getClientRects()).forEach((rect) => {
    if (rect.width <= 0 || rect.height <= 0) {
      return
    }

    lineTops.add(Math.round(rect.top))
  })

  return lineTops.size
}

const useHeroHeadlineWrapMode = () => {
  const phraseRef = useRef<HTMLSpanElement | null>(null)
  const [phraseWraps, setPhraseWraps] = useState(false)

  useLayoutEffect(() => {
    const phrase = phraseRef.current

    if (!phrase || typeof window === 'undefined') {
      return
    }

    let frameId: number | null = null
    let disposed = false

    const measure = () => {
      frameId = null
      if (disposed) {
        return
      }

      const wraps = countInlineLines(phrase) > 1
      setPhraseWraps((current) => (current === wraps ? current : wraps))
    }

    const measureOnce = () => {
      if (disposed || frameId !== null) {
        return
      }

      if (typeof window.requestAnimationFrame === 'function') {
        frameId = window.requestAnimationFrame(measure)
        return
      }

      measure()
    }

    const fonts = 'fonts' in document ? document.fonts : null
    if (fonts) {
      void fonts.ready.then(measureOnce)
    } else {
      measureOnce()
    }

    return () => {
      disposed = true

      if (
        frameId !== null &&
        typeof window.cancelAnimationFrame === 'function'
      ) {
        window.cancelAnimationFrame(frameId)
      }
    }
  }, [])

  return { phraseRef, phraseWraps }
}

const StudyMeshLanding = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const { phraseRef, phraseWraps } = useHeroHeadlineWrapMode()

  const openCreateStudyGuide = () => {
    navigate('/study-guides?create=1')
  }

  useEffect(() => {
    preloadContextImages()
  }, [])

  useEffect(() => {
    if (!location.hash) {
      return
    }

    window.requestAnimationFrame(() => {
      scrollToLandingSection(location.hash, 'auto')
    })
  }, [location.hash])

  return (
    <Box
      data-testid="studymesh-landing"
      sx={{
        minHeight: '100dvh',
        bgcolor: '#FFFFFF',
        color: brand.ink,
        overflowX: 'clip',
        fontFamily: '"Readex Pro", "Inter", "Segoe UI", Arial, sans-serif',
      }}
    >
      <LandingTopNav />

      <Box
        component="main"
        sx={{
          background: landingSurfaceBackground,
        }}
      >
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
              <Box
                data-testid="hero-headline-underline-host"
                data-underline-mode={phraseWraps ? 'wrapped' : 'full'}
                sx={{ position: 'relative', display: 'inline-block' }}
              >
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
                    <Box
                      ref={phraseRef}
                      component="span"
                      data-testid="hero-headline-wrap-probe"
                      sx={{ display: 'inline' }}
                    >
                      that grow{' '}
                      <Box
                        component="span"
                        data-testid="hero-headline-with-you"
                        sx={{
                          position: 'relative',
                          display: 'inline-block',
                          whiteSpace: 'nowrap',
                          zIndex: 0,
                          '&::after': {
                            content: '""',
                            display: phraseWraps ? 'block' : 'none',
                            position: 'absolute',
                            left: '-0.05em',
                            right: '-0.02em',
                            bottom: { xs: '-0.04em', md: '-0.03em' },
                            height: { xs: 7, sm: 9, md: 12 },
                            borderRadius: 999,
                            background: `linear-gradient(90deg, ${alpha(
                              brand.mint,
                              0.82,
                            )}, ${alpha(brand.sky, 0.78)})`,
                            transform: 'rotate(-1deg)',
                            zIndex: -1,
                            boxShadow: `0 2px 0 ${alpha(brand.blue, 0.1)}`,
                          },
                        }}
                      >
                        with you.
                      </Box>
                    </Box>
                  </Box>
                </Typography>
                <Box
                  aria-hidden="true"
                  data-testid="hero-full-underline"
                  sx={{
                    display: phraseWraps ? 'none' : 'block',
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
                    href="#knowledge-context"
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

        <GrowingGuidesSection />

        <Box
          sx={{
            bgcolor: 'transparent',
            pt: { xs: 5.5, md: 8, lg: 9 },
            pb: { xs: 5, md: 7 },
          }}
        >
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
                Ready to build your Study Guide?
              </Typography>
              <Typography sx={{ color: brand.muted, fontSize: '1.08rem' }}>
                Start with a topic. Let StudyMesh create a guide tailored for you and see it grow.
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
      <StudyMeshFooter />
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

const GrowingGuidesSection = () => (
  <Box
    sx={{
      position: 'relative',
      bgcolor: 'transparent',
      pt: { xs: 7, md: 8, lg: 9 },
      pb: { xs: 2, md: 3.5 },
      overflow: 'hidden',
    }}
  >
    <Container
      id="growing-guide"
      maxWidth="lg"
      sx={{ position: 'relative', scrollMarginTop: { xs: 88, md: 104 } }}
    >
      <Box
        sx={{
          display: { xs: 'none', lg: 'flex' },
          justifyContent: 'center',
          mb: 4.2,
        }}
      >
        <GrowingGuidesLabel />
      </Box>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: '0.74fr 1.26fr' },
          gap: { xs: 4, md: 4.8, lg: 2.6 },
          alignItems: { xs: 'stretch', lg: 'start' },
        }}
      >
        <Stack
          spacing={2.4}
          alignItems={{ xs: 'center', lg: 'flex-start' }}
          textAlign={{ xs: 'center', lg: 'left' }}
          sx={{ pt: { lg: 2.25 } }}
        >
          <Box sx={{ display: { xs: 'block', lg: 'none' } }}>
            <GrowingGuidesLabel />
          </Box>
          <Stack spacing={1.35}>
            <Typography
              variant="h2"
              sx={{
                maxWidth: 540,
                color: brand.ink,
                fontWeight: 800,
                fontSize: { xs: '2.2rem', md: '2.85rem' },
                lineHeight: 1.06,
                letterSpacing: 0,
                textWrap: 'balance',
            }}
          >
              Your guide doesn't stop at page{' '}
              <Box
                component="span"
                sx={{
                  background: `linear-gradient(90deg, ${brand.sky}, ${brand.mint})`,
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  color: 'transparent',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                5.
              </Box>
            </Typography>
            <Typography
              sx={{
                maxWidth: 540,
                color: '#64719B',
                fontSize: { xs: '1rem', md: '1.14rem' },
                lineHeight: 1.62,
              }}
            >
              Every guide starts with 5 focused pages. Ask for more depth,
              examples or exercises, and StudyMesh adds new content
              instantly.
            </Typography>
          </Stack>

          <Stack
            spacing={1.1}
            sx={{ width: '100%', maxWidth: { xs: 420, lg: 420 } }}
          >
            {growingGuideBenefits.map((benefit) => (
              <Stack
                key={benefit}
                direction="row"
                spacing={1.2}
                alignItems="center"
                sx={{
                  p: 1.25,
                  justifyContent: { xs: 'center', lg: 'flex-start' },
                  borderRadius: 2,
                  border: `1px solid ${alpha(brand.line, 0.82)}`,
                  bgcolor: alpha('#FFFFFF', 0.82),
                  boxShadow: `0 12px 34px ${alpha(brand.blueDark, 0.05)}`,
                }}
              >
                <Box
                  sx={{
                    width: 30,
                    height: 30,
                    flex: '0 0 auto',
                    borderRadius: '50%',
                    display: 'grid',
                    placeItems: 'center',
                    color: '#008A78',
                    bgcolor: alpha(brand.mint, 0.14),
                  }}
                >
                  <CheckIcon sx={{ fontSize: 18 }} />
                </Box>
                <Typography sx={{ color: brand.ink, fontWeight: 800 }}>
                  {benefit}
                </Typography>
              </Stack>
            ))}
          </Stack>
        </Stack>

        <GrowingGuidesMockup />
      </Box>
    </Container>
  </Box>
)

const GrowingGuidesLabel = () => (
  <Box
    sx={{
      display: 'inline-flex',
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
    <Stack direction="row" spacing={0.8} alignItems="center">
      <SpaOutlinedIcon sx={{ fontSize: 16 }} />
      <Box component="span">GROWING GUIDES</Box>
    </Stack>
  </Box>
)

const GrowingGuidesMockup = () => (
  <Box
    aria-label="Growing study guide product preview"
    sx={{
      position: 'relative',
      minHeight: { xs: 610, lg: 630 },
      overflow: 'visible',
    }}
  >
    <GrowingGuideConversation />
    <GrowingGuideLayerStack />
    <GrowingGuideCreationArrow />
    <GrowingGuideSparkle left="3%" top="68%" />
    <GrowingGuideSparkle left="93%" top="40%" />
    <GrowingGuideSparkle left="87%" top="58%" size={24} />
  </Box>
)

const GrowingGuideLayerStack = () => (
  <Box
    sx={{
      position: 'absolute',
      top: { xs: 204, lg: 188 },
      right: { xs: 6, lg: 8 },
      left: { xs: 6, lg: 'auto' },
      width: { xs: 'auto', lg: 640 },
      height: { xs: 390, lg: 470 },
    }}
  >
    <Box
      aria-hidden="true"
      sx={{
        display: { xs: 'none', lg: 'block' },
        position: 'absolute',
        left: 28,
        right: 76,
        bottom: 34,
        height: 92,
        borderRadius: '32px 32px 28px 28px',
        bgcolor: alpha(brand.sky, 0.055),
        boxShadow: `0 30px 70px ${alpha(brand.blue, 0.09)}`,
        transform: 'skewX(-13deg) rotate(3deg)',
      }}
    />
    {growingGuidePages.map((page, index) => (
      <GrowingGuideLayerCard
        key={page}
        page={page}
        index={index}
        isNewPage={index === growingGuidePages.length - 1}
      />
    ))}
  </Box>
)

const GrowingGuideLayerCard = ({
  page,
  index,
  isNewPage,
}: {
  page: string
  index: number
  isNewPage: boolean
}) => (
  <Box
    sx={{
      position: 'absolute',
      top: { xs: isNewPage ? 0 : 220 + (index - 1) * -40, lg: 'auto' },
      bottom: { xs: 'auto', lg: 70 },
      left: {
        xs: isNewPage ? 0 : 14 + index * 4,
        lg: 8 + index * 28,
      },
      right: { xs: isNewPage ? 0 : 14 - index * 2, lg: 'auto' },
      width: {
        xs: isNewPage ? '100%' : `calc(100% - ${24 + index * 3}px)`,
        lg: 520,
      },
      minHeight: {
        xs: isNewPage ? 126 : 52,
        lg: isNewPage ? 392 : 82 + index * 50,
      },
      height: {
        xs: 'auto',
        lg: isNewPage ? 392 : 82 + index * 50,
      },
      zIndex: 30 - index,
      p: isNewPage ? { xs: 1.25, lg: 1.45 } : { xs: 1.05, lg: 1.15 },
      borderRadius: isNewPage ? 2 : 1.6,
      border: `1px solid ${
        isNewPage ? alpha(brand.mint, 0.5) : alpha(brand.line, 0.78)
      }`,
      bgcolor: isNewPage ? alpha('#F5FFFC', 0.96) : alpha('#FFFFFF', 0.94),
      boxShadow: isNewPage
        ? `22px 22px 0 ${alpha(brand.mint, 0.08)}, 0 28px 68px ${alpha(
            brand.mint,
            0.17,
          )}`
        : `18px 18px 0 ${alpha(brand.blue, 0.026 + index * 0.006)}, 0 18px 52px ${alpha(
            brand.blueDark,
            0.055,
          )}`,
      transform: {
        xs: 'none',
        lg: `rotate(${isNewPage ? 1.2 : 1.65 - index * 0.44}deg)`,
      },
    }}
  >
    <Stack
      direction="row"
      spacing={1.1}
      alignItems="center"
      sx={{
        position: 'relative',
        zIndex: 1,
      }}
    >
      <Box
        sx={{
          width: isNewPage ? 42 : 34,
          height: isNewPage ? 42 : 34,
          flex: '0 0 auto',
          borderRadius: 1.2,
          display: 'grid',
          placeItems: 'center',
          color: isNewPage ? '#008A78' : brand.blue,
          bgcolor: isNewPage ? alpha(brand.mint, 0.13) : alpha(brand.sky, 0.08),
          fontWeight: 900,
        }}
      >
        {page.slice(0, 2)}
      </Box>
      <Typography
        sx={{
          flex: 1,
          minWidth: 0,
          color: isNewPage ? '#008A78' : brand.ink,
          fontWeight: 900,
          fontSize: isNewPage
            ? { xs: '1.02rem', lg: '1.12rem' }
            : { xs: '0.82rem', lg: '0.95rem' },
          lineHeight: 1.25,
        }}
      >
        {page.slice(3)}
      </Typography>
      {isNewPage ? (
        <Box
          sx={{
            px: 1,
            py: 0.52,
            borderRadius: 999,
            color: '#FFFFFF',
            bgcolor: '#0BB894',
            fontWeight: 900,
            fontSize: '0.78rem',
            boxShadow: `0 12px 28px ${alpha(brand.mint, 0.28)}`,
          }}
        >
          New
        </Box>
      ) : (
        <Box
          aria-hidden="true"
          sx={{
            display: { xs: 'none', lg: 'grid' },
            width: 28,
            height: 28,
            borderRadius: 1,
            placeItems: 'center',
            color: alpha(brand.blue, 0.72),
            bgcolor: alpha(brand.sky, 0.06),
            '& svg': { fontSize: 17 },
          }}
        >
          <DescriptionOutlinedIcon />
        </Box>
      )}
    </Stack>
    {isNewPage && (
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: { xs: 0.7, lg: 0.9 },
          mt: 1.25,
          position: 'relative',
          zIndex: 1,
        }}
      >
        {['Quizzes', 'Flashcards', 'Practice'].map((item, itemIndex) => (
          <Box
            key={item}
            sx={{
              minHeight: 46,
              p: 0.9,
              borderRadius: 1.2,
              border: `1px solid ${alpha(brand.line, 0.72)}`,
              bgcolor: alpha('#FFFFFF', 0.86),
              display: 'flex',
              alignItems: 'center',
              gap: 0.75,
              color: brand.ink,
              fontWeight: 850,
              fontSize: { xs: '0.72rem', lg: '0.78rem' },
            }}
          >
            <Box
              sx={{
                width: 22,
                height: 22,
                borderRadius: 0.8,
                display: 'grid',
                placeItems: 'center',
                color: '#008A78',
                bgcolor: alpha(brand.mint, 0.1),
                fontWeight: 900,
              }}
            >
              { itemIndex + 1}
            </Box>
            {item}
          </Box>
        ))}
      </Box>
    )}
  </Box>
)

const GrowingGuideConversation = () => (
  <Box
    sx={{
      position: 'absolute',
      right: { xs: 0, lg: 4 },
      top: { xs: 0, lg: 18 },
      width: { xs: '100%', lg: 390 },
      zIndex: 42,
    }}
  >
    <Box
      sx={{
        ml: { xs: 0, lg: 5 },
        p: { xs: 1.35, lg: 1.55 },
        borderRadius: 2,
        border: `1px solid ${alpha(brand.line, 0.86)}`,
        bgcolor: alpha('#FFFFFF', 0.92),
        boxShadow: `0 18px 48px ${alpha(brand.blueDark, 0.12)}`,
      }}
    >
      <Stack direction="row" spacing={1.2} alignItems="center">
        <Typography
          sx={{
            color: brand.blueDark,
            flex: 1,
            fontWeight: 800,
            fontSize: { xs: '0.84rem', lg: '0.9rem' },
            lineHeight: 1.45,
          }}
        >
          Can you add more practice exercises on this topic?
        </Typography>
        <Box
          sx={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            display: 'grid',
            placeItems: 'center',
            color: brand.blue,
            bgcolor: alpha(brand.sky, 0.12),
            fontWeight: 900,
          }}
        >
          U
        </Box>
      </Stack>
    </Box>
    <Box
      sx={{
        width: { xs: '92%', lg: '86%' },
        mt: 1,
        p: { xs: 1.35, lg: 1.55 },
        borderRadius: 2,
        border: `1px solid ${alpha(brand.line, 0.86)}`,
        bgcolor: '#FFFFFF',
        boxShadow: `0 18px 48px ${alpha(brand.blueDark, 0.12)}`,
      }}
    >
      <Stack direction="row" spacing={1.1} alignItems="flex-start">
        <Box
          sx={{
            width: 32,
            height: 32,
            flex: '0 0 auto',
            borderRadius: '50%',
            display: 'grid',
            placeItems: 'center',
            color: brand.blue,
            bgcolor: brand.skySoft,
          }}
        >
          <AutoAwesomeIcon sx={{ fontSize: 17 }} />
        </Box>
        <Typography
          sx={{
            color: brand.ink,
            fontWeight: 850,
            fontSize: { xs: '0.84rem', lg: '0.9rem' },
            lineHeight: 1.48,
          }}
        >
          Done! I added <Box component="span" sx={{ color: '#008A78' }}>06 Review Pack</Box>{' '}
          with quizzes, flashcards, and practice.
        </Typography>
      </Stack>
    </Box>
  </Box>
)

const GrowingGuideCreationArrow = () => (
  <Box
    component="svg"
    aria-hidden="true"
    viewBox="0 0 260 180"
    sx={{
      display: { xs: 'none', lg: 'block' },
      position: 'absolute',
      right: -12,
      top: 128,
      width: 260,
      height: 180,
      zIndex: 41,
      overflow: 'visible',
    }}
  >
    <defs>
      <marker
        id="growingGuideArrow"
        markerHeight="10"
        markerWidth="10"
        orient="auto"
        refX="8"
        refY="5"
      >
        <path d="M0,0 L10,5 L0,10 Z" fill={alpha(brand.mint, 0.82)} />
      </marker>
    </defs>
    <path
      d="M84 28 C132 10 184 12 226 58"
      fill="none"
      markerEnd="url(#growingGuideArrow)"
      stroke={alpha(brand.mint, 0.54)}
      strokeLinecap="round"
      strokeWidth="3"
    />
  </Box>
)

const GrowingGuideSparkle = ({
  left,
  top,
  size = 20,
}: {
  left: string
  top: string
  size?: number
}) => (
  <AutoAwesomeIcon
    aria-hidden="true"
    sx={{
      display: { xs: 'none', lg: 'block' },
      position: 'absolute',
      left,
      top,
      fontSize: size,
      color: alpha(size > 20 ? brand.blue : brand.mint, 0.35),
    }}
  />
)

const ContextComparisonSection = () => {
  const [activeIndex, setActiveIndex] = useState(0)
  const topicsRowRef = useRef<HTMLDivElement | null>(null)
  const edgeScrollFrameRef = useRef<number | null>(null)
  const edgeScrollDirectionRef = useRef(0)
  const activeTopic = contextTopics[activeIndex]

  const stopEdgeScroll = useCallback(() => {
    if (edgeScrollFrameRef.current !== null) {
      window.cancelAnimationFrame(edgeScrollFrameRef.current)
      edgeScrollFrameRef.current = null
    }

    edgeScrollDirectionRef.current = 0
  }, [])

  const scrollTopicRowByEdge = useCallback(
    (direction: -1 | 1) => {
      const row = topicsRowRef.current

      if (!row) {
        stopEdgeScroll()
        return
      }

      const maxScrollLeft = row.scrollWidth - row.clientWidth
      const canScrollRight = direction > 0 && row.scrollLeft < maxScrollLeft
      const canScrollLeft = direction < 0 && row.scrollLeft > 0

      if (!canScrollRight && !canScrollLeft) {
        stopEdgeScroll()
        return
      }

      row.scrollBy({ left: direction * 6, behavior: 'auto' })
    },
    [stopEdgeScroll],
  )

  const startEdgeScroll = useCallback(
    (direction: -1 | 1) => {
      if (
        edgeScrollFrameRef.current !== null &&
        edgeScrollDirectionRef.current === direction
      ) {
        return
      }

      stopEdgeScroll()
      edgeScrollDirectionRef.current = direction

      const tick = () => {
        scrollTopicRowByEdge(direction)

        if (edgeScrollDirectionRef.current === direction) {
          edgeScrollFrameRef.current = window.requestAnimationFrame(tick)
        }
      }

      tick()
    },
    [scrollTopicRowByEdge, stopEdgeScroll],
  )

  const handleTopicRowPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const row = topicsRowRef.current

      if (!row || row.scrollWidth <= row.clientWidth) {
        stopEdgeScroll()
        return
      }

      const rect = row.getBoundingClientRect()
      const edgeSize = Math.min(92, rect.width * 0.22)
      const nearLeftEdge = event.clientX - rect.left <= edgeSize
      const nearRightEdge = rect.right - event.clientX <= edgeSize

      if (nearRightEdge) {
        startEdgeScroll(1)
        return
      }

      if (nearLeftEdge) {
        startEdgeScroll(-1)
        return
      }

      stopEdgeScroll()
    },
    [startEdgeScroll, stopEdgeScroll],
  )

  useEffect(() => stopEdgeScroll, [stopEdgeScroll])

  const selectTopic = (index: number) => {
    setActiveIndex(index)
  }

  return (
    <Box
      sx={{
        position: 'relative',
        py: { xs: 5.5, md: 8 },
        bgcolor: 'transparent',
        overflow: 'hidden',
      }}
    >
      <Container
        id="knowledge-context"
        maxWidth="lg"
        sx={{ position: 'relative', scrollMarginTop: { xs: 88, md: 104 } }}
      >
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
              KNOWLEDGE BRIDGE
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
              Same question. Adapted answer.
            </Typography>
            <Typography
              sx={{
                maxWidth: 760,
                color: '#64719B',
                fontSize: { xs: '1rem', md: '1.18rem' },
                lineHeight: 1.58,
              }}
            >
              Choose what you already know, watch the explanation change.
            </Typography>
          </Stack>

          <Box
            sx={{
              width: '100%',
              maxWidth: 850,
              mx: 'auto',
              overflow: 'visible',
            }}
          >
            <Box
              ref={topicsRowRef}
              aria-label="Knowledge context topics"
              onPointerCancel={stopEdgeScroll}
              onPointerLeave={stopEdgeScroll}
              onPointerMove={handleTopicRowPointerMove}
              onPointerUp={stopEdgeScroll}
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: 'repeat(10, minmax(104px, 1fr))',
                },
                gap: { xs: 1.35, md: 1.7 },
                width: '100%',
                overflowX: 'auto',
                py: 0.8,
                px: 0,
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
                        selected ? alpha(topic.color, 0.82) : alpha(brand.line, 0.82)
                      }`,
                      borderRadius: 2,
                      boxShadow: selected
                        ? `inset 0 0 0 2px ${alpha(
                            topic.color,
                            0.08,
                          )}, inset 0 0 36px ${alpha(topic.color, 0.14)}`
                        : 'none',
                      textTransform: 'none',
                      fontWeight: 800,
                      transition:
                        'transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease',
                      '&:hover': {
                        bgcolor: selected ? alpha(topic.color, 0.11) : '#FFFFFF',
                        borderColor: alpha(topic.color, 0.42),
                        transform: 'translateY(-2px)',
                        boxShadow: selected
                          ? `inset 0 0 0 2px ${alpha(
                              topic.color,
                              0.1,
                            )}, inset 0 0 42px ${alpha(topic.color, 0.18)}`
                          : `inset 0 0 28px ${alpha(topic.color, 0.08)}`,
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
          </Box>

          <Box
            sx={{
              width: '100%',
              display: 'grid',
              placeItems: 'center',
              mt: 0.6,
            }}
          >
            <FeaturedContextCard
              topic={activeTopic}
            />
          </Box>

          <KnowledgeContextEvidence />
        </Stack>
      </Container>
    </Box>
  )
}

const KnowledgeContextEvidence = () => (
  <Box
    component="a"
    href="https://www.uni-trier.de/fileadmin/fb1/prof/PSY/PAE/Team/Schneider/SimonsmeierEtAl2021.pdf"
    target="_blank"
    rel="noreferrer"
    aria-label="Read Domain-specific prior knowledge and learning: A meta-analysis"
    sx={{
      position: 'relative',
      zIndex: 2,
      width: { xs: '100%', md: '74%' },
      maxWidth: 860,
      p: { xs: 2.2, md: 3.1 },
      borderRadius: 2,
      border: `1px solid ${alpha(brand.line, 0.95)}`,
      bgcolor: alpha('#FFFFFF', 0.96),
      boxShadow: `0 24px 64px ${alpha(brand.blueDark, 0.1)}`,
      color: 'inherit',
      display: 'block',
      overflow: 'hidden',
      textAlign: 'left',
      textDecoration: 'none',
      transition: 'border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease',
      '&:hover': {
        borderColor: alpha(brand.blueDark, 0.28),
        boxShadow: `0 28px 72px ${alpha(brand.blueDark, 0.15)}`,
        transform: 'translateY(-1px)',
      },
      '&:focus-visible': {
        outline: `3px solid ${alpha(brand.sky, 0.35)}`,
        outlineOffset: 3,
      },
    }}
  >
    <Box
      sx={{
        maxWidth: 780,
      }}
    >
      <Typography
        sx={{
          color: brand.blueDark,
          fontWeight: 900,
          fontSize: '0.74rem',
          letterSpacing: 0,
          lineHeight: 1,
          mb: 1,
          textTransform: 'uppercase',
        }}
      >
        The science
      </Typography>
      <Typography
        sx={{
          m: 0,
          color: brand.ink,
          fontSize: { xs: '1.02rem', md: '1.12rem' },
          fontWeight: 500,
          lineHeight: 1.5,
        }}
      >
        A meta-analysis in Educational Psychologist found that prior knowledge shapes how learners understand new information.
      </Typography>
      <Typography
        sx={{
          mt: 1.05,
          color: '#7C89AD',
          fontSize: '0.86rem',
          lineHeight: 1.45,
        }}
      >
        Bianca A. Simonsmeier, Maja Flaig, Anne Deiglmayr, Lennart Schalk & Michael Schneider, 2021
      </Typography>
    </Box>
  </Box>
)

const FeaturedContextCard = ({
  topic,
}: {
  topic: ContextTopic
}) => (
  <Box
    sx={{
      position: 'relative',
      zIndex: 2,
      width: { xs: '100%', md: '74%' },
      maxWidth: 860,
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
        gridTemplateColumns: { xs: '1fr', md: '1.55fr 0.9fr' },
        gap: { xs: 2.2, md: 3 },
        alignItems: 'center',
      }}
    >
      <Stack spacing={2.2}>
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
            Because you know {topic.contextLabel}
          </Box>
        </Stack>
        <Box
          sx={{
            display: 'inline-flex',
            alignSelf: 'flex-start',
            px: 1.45,
            py: 0.65,
            borderRadius: 1,
            color: brand.blueDark,
            bgcolor: alpha(brand.sky, 0.08),
            border: `1px solid ${alpha(brand.sky, 0.16)}`,
            fontWeight: 800,
            fontSize: '0.94rem',
          }}
        >
          Same question: {contextQuestion}
        </Box>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
            gap: 1.3,
          }}
        >
          <ContextAnswerPanel
            label="Without context"
            answer={noContextTradeoffAnswer}
          />
          <ContextAnswerPanel
            label={`With ${topic.contextLabel} context`}
            answer={topic.contextAnswer}
            topic={topic}
          />
        </Box>
      </Stack>
      <ContextVisual topic={topic} />
    </Box>
  </Box>
)

const ContextAnswerPanel = ({
  label,
  answer,
  topic,
}: {
  label: string
  answer: string
  topic?: ContextTopic
}) => {
  const accent = topic?.color ?? brand.faint

  return (
    <Box
      sx={{
        p: { xs: 1.45, md: 1.6 },
        minHeight: { xs: 'auto', sm: 172 },
        borderRadius: 1.4,
        border: `1px solid ${alpha(accent, topic ? 0.38 : 0.28)}`,
        bgcolor: topic ? alpha(accent, 0.065) : '#FFFFFF',
        boxShadow: topic ? `0 16px 38px ${alpha(accent, 0.1)}` : 'none',
      }}
    >
      <Typography
        sx={{
          color: topic ? topic.color : '#64719B',
          fontWeight: 900,
          fontSize: '0.78rem',
          lineHeight: 1,
          textTransform: 'uppercase',
          letterSpacing: 0,
          mb: 1,
        }}
      >
        {label}
      </Typography>
      <Typography sx={{ color: brand.ink, fontSize: '0.98rem', lineHeight: 1.62 }}>
        {answer}
      </Typography>
    </Box>
  )
}

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
    component="img"
    src={topic.visualSrc}
    alt=""
    loading="eager"
    decoding="sync"
    sx={{
      minHeight: { xs: 180, md: 226 },
      width: '100%',
      height: { xs: 210, md: 252 },
      borderRadius: 2,
      display: { xs: 'none', sm: 'block' },
      objectFit: 'contain',
      bgcolor: '#FFFFFF',
      boxShadow: `0 22px 52px ${alpha(topic.color, 0.12)}`,
    }}
  />
)

const DecorativeHeroLayer = () => (
  <Box aria-hidden="true">
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
    <circle cx="33" cy="26" r="3.2" fill="#91B3FF" opacity="0.58" />
    <circle cx="56" cy="96" r="3.2" fill="#91B3FF" opacity="0.72" />
    <circle cx="112" cy="45" r="3.2" fill="#91B3FF" opacity="0.62" />
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
