import React, { useEffect, useState } from 'react'
import {
  Box,
  Button,
  Container,
  Grid,
  Paper,
  Stack,
  Typography,
  useTheme,
} from '@mui/material'
import { alpha } from '@mui/material/styles'
import { useLocation, useNavigate } from 'react-router-dom'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline'
import KeyIcon from '@mui/icons-material/Key'
import MemoryIcon from '@mui/icons-material/Memory'
import PsychologyIcon from '@mui/icons-material/Psychology'
import QuizIcon from '@mui/icons-material/Quiz'
import RouteIcon from '@mui/icons-material/Route'
import StyleIcon from '@mui/icons-material/Style'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'

const guideExamples = [
  {
    label: 'Exam',
    prompt: "Teach me photosynthesis for tomorrow's test.",
    title: 'Photosynthesis Study Guide',
    lessons: [
      ['01', 'Big picture', 'Light, water, CO2, glucose'],
      ['02', 'Light reactions', 'diagram walkthrough'],
      ['03', 'Calvin cycle', 'worked examples'],
      ['04', 'Test review', 'practice + weak spots'],
    ],
    chat: [
      ['AI Chat', 'You missed Calvin cycle inputs twice. Want a quick drill?'],
      ['Practice', 'Create 5 questions on my weak spots.'],
      ['Guide update', 'Added a review page before final practice.'],
    ],
  },
  {
    label: 'Language',
    prompt: 'Teach me Spanish past tenses from scratch.',
    title: 'Spanish Past Tenses',
    lessons: [
      ['01', 'Preterite', 'finished actions'],
      ['02', 'Imperfect', 'habits and background'],
      ['03', 'Contrast', 'which tense fits?'],
      ['04', 'Speaking drill', 'adaptive prompts'],
    ],
    chat: [
      ['AI Chat', 'You are mixing preterite triggers with imperfect context.'],
      ['Flashcards', 'Make cards for tense triggers.'],
      ['Guide update', 'Added a mistake-fixing practice page.'],
    ],
  },
  {
    label: 'Skill',
    prompt: 'Help me understand derivatives and limits.',
    title: 'Calculus Foundations',
    lessons: [
      ['01', 'Limits', 'intuition before rules'],
      ['02', 'Derivative meaning', 'slope and rate of change'],
      ['03', 'Rules', 'worked problems'],
      ['04', 'Weak spots', 'targeted practice'],
    ],
    chat: [
      ['AI Chat', 'Chain rule needs more practice before mixed problems.'],
      ['Explain', 'Explain chain rule simpler.'],
      ['Guide update', 'Added a slower example section.'],
    ],
  },
]

const adaptiveSignals = [
  {
    title: 'Strengthen weak spots',
    body: 'StudyMesh can turn mistakes and confusion into focused practice instead of more generic review.',
    icon: <TrendingUpIcon />,
  },
  {
    title: 'Grow the guide as you learn',
    body: 'Ask for clearer notes, extra examples, quizzes, flashcards, or review pages and keep building the path.',
    icon: <AutoAwesomeIcon />,
  },
  {
    title: 'Keep AI beside the lesson',
    body: 'Chat stays grounded in the Study Guide, so follow-up help fits the page you are studying.',
    icon: <ChatBubbleOutlineIcon />,
  },
]

const studyActions = [
  ['Ask for a simpler explanation', <PsychologyIcon fontSize="small" />],
  ['Create a quiz from this lesson', <QuizIcon fontSize="small" />],
  ['Turn this into flashcards', <StyleIcon fontSize="small" />],
  ['Add targeted review practice', <TrendingUpIcon fontSize="small" />],
]

const aiModes = [
  {
    title: 'Hosted AI',
    body: 'Start quickly with Study Credits and no setup.',
    icon: <AutoAwesomeIcon />,
  },
  {
    title: 'Own API key',
    body: 'Use Gemini or Cerebras when you want direct provider control.',
    icon: <KeyIcon />,
  },
  {
    title: 'Local AI',
    body: 'Use browser-local AI where available for private, free generation.',
    icon: <MemoryIcon />,
  },
]

const quickAnswers = [
  {
    question: 'What is StudyMesh for?',
    answer:
      'StudyMesh helps students create AI study guides for any learning goal, then keep studying with interactive practice and AI support.',
  },
  {
    question: 'Where do quizzes and flashcards fit?',
    answer:
      'They are part of the Study Guide learning loop. Ask AI chat for practice, flashcards, clearer notes, or review pages while studying.',
  },
  {
    question: 'What does adapt with you mean?',
    answer:
      'Study Guides grow as you learn, reinforce weak spots, and keep the next practice tied to what you need.',
  },
]

const navItems = [
  ['Features', '#features'],
  ['Pricing', '/pricing'],
]

const StudyMeshLanding = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const theme = useTheme()
  const [activeExample, setActiveExample] = useState(0)
  const currentExample = guideExamples[activeExample]
  const landingCanvasColor = theme.palette.background.default

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
      sx={{
        minHeight: '100dvh',
        bgcolor: landingCanvasColor,
        color: 'text.primary',
        overflowX: 'clip',
      }}
    >
      <Box
        component="header"
        sx={{
          borderBottom: '1px solid',
          borderColor: alpha(theme.palette.divider, 0.56),
          bgcolor: alpha(landingCanvasColor, 0.86),
          backdropFilter: 'blur(18px)',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        <Container
          maxWidth="lg"
          sx={{
            height: 72,
            display: 'grid',
            gridTemplateColumns: { xs: '1fr auto', md: '1fr auto 1fr' },
            alignItems: 'center',
            columnGap: 2,
          }}
        >
          <Button
            variant="text"
            onClick={() => navigate('/')}
            sx={{
              justifySelf: 'start',
              minWidth: 'auto',
              p: 0,
              color: 'text.primary',
              textTransform: 'none',
              '&:hover': { bgcolor: 'transparent' },
            }}
          >
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Box
                component="img"
                src="/logo.png"
                alt="StudyMesh logo"
                sx={{ width: 36, height: 36, display: 'block' }}
              />
              <Typography variant="h6" fontWeight={900}>
                StudyMesh
              </Typography>
            </Stack>
          </Button>
          <Stack
            component="nav"
            direction="row"
            spacing={4}
            alignItems="center"
            justifyContent="center"
            sx={{ display: { xs: 'none', md: 'flex' } }}
          >
            {navItems.map(([label, href]) => (
              <Button
                key={label}
                href={href}
                variant="text"
                sx={{
                  minWidth: 'auto',
                  px: 0,
                  color: alpha(theme.palette.text.primary, 0.78),
                  textTransform: 'none',
                  fontWeight: 800,
                  fontSize: '0.98rem',
                  '&:hover': {
                    bgcolor: 'transparent',
                    color: 'primary.main',
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
              borderRadius: 999,
              px: { xs: 2, sm: 3 },
              py: 1.05,
              color: 'primary.dark',
              borderColor: alpha(theme.palette.primary.main, 0.32),
              bgcolor: alpha(theme.palette.background.paper, 0.72),
              boxShadow: `0 10px 24px ${alpha(theme.palette.common.black, 0.08)}`,
              textTransform: 'none',
              fontWeight: 900,
              '&:hover': {
                borderColor: alpha(theme.palette.primary.main, 0.5),
                bgcolor: alpha(theme.palette.primary.main, 0.08),
              },
            }}
          >
            Create a Study Guide
          </Button>
        </Container>
      </Box>

      <Box component="main" sx={{ bgcolor: landingCanvasColor }}>
        <Box
          sx={{
            position: 'relative',
            minHeight: { xs: 'calc(100dvh - 72px)', md: 'calc(100dvh - 72px)' },
            display: 'flex',
            alignItems: 'center',
            py: { xs: 6, md: 9 },
            overflow: 'hidden',
            bgcolor: landingCanvasColor,
          }}
        >
          <Container maxWidth="xl" sx={{ position: 'relative', zIndex: 1 }}>
            <Stack
              spacing={{ xs: 3, md: 4 }}
              alignItems="center"
              textAlign="center"
              sx={{ mx: 'auto', maxWidth: 1360 }}
            >
              <Typography
                variant="h1"
                sx={{
                  maxWidth: { xs: 960, md: 1120 },
                  fontFamily:
                    '"Readex Pro", "Inter", "Segoe UI", Arial, sans-serif',
                  fontWeight: 500,
                  fontSize: {
                    xs: '3rem',
                    sm: '4.4rem',
                    md: '5.2rem',
                  },
                  lineHeight: { xs: 1.1, md: 1 },
                  letterSpacing: 0,
                  pb: '0.08em',
                  color: 'text.primary',
                  textWrap: 'balance',
                  '@keyframes studyMeshHeroGradientShift': {
                    '0%': { backgroundPosition: '0% center' },
                    '50%': { backgroundPosition: '95% center' },
                    '100%': { backgroundPosition: '0% center' },
                  },
                }}
              >
                <Box
                  component="span"
                  sx={{
                    display: { xs: 'inline', md: 'block' },
                    overflow: 'visible',
                    background:
                      'linear-gradient(90deg, rgb(33, 150, 243), rgb(0, 196, 154), rgb(33, 150, 243))',
                    backgroundSize: '190% auto',
                    backgroundClip: 'text',
                    WebkitBackgroundClip: 'text',
                    color: 'transparent',
                    WebkitTextFillColor: 'transparent',
                    lineHeight: { xs: 1.12, md: 1.06 },
                    pb: { xs: '0.06em', md: '0.12em' },
                    mb: { xs: 0, md: '-0.04em' },
                    animation:
                      'studyMeshHeroGradientShift 4s ease infinite',
                  }}
                >
                  Study guides
                </Box>
                <Box
                  component="span"
                  sx={{
                    display: { xs: 'inline', md: 'block' },
                    color: 'text.primary',
                    lineHeight: { xs: 1.1, md: 1.02 },
                    WebkitTextFillColor: 'currentColor',
                  }}
                >
                  <Box
                    component="span"
                    sx={{ display: { xs: 'inline', md: 'none' } }}
                  >
                    {' '}
                  </Box>
                  that grow with you.
                </Box>
              </Typography>
              <Typography
                variant="h5"
                component="p"
                sx={{
                  maxWidth: 880,
                  color: alpha(theme.palette.text.primary, 0.8),
                  fontFamily:
                    '"Readex Pro", "Inter", "Segoe UI", Arial, sans-serif',
                  lineHeight: 1.55,
                  fontWeight: 300,
                  fontSize: { xs: '1.1rem', md: '1.42rem' },
                }}
              >
                Build interactive study guides with AI, then keep learning as they adapt with you.
              </Typography>
              <Stack spacing={2.75} alignItems="center">
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={{ xs: 1, sm: 1.5 }}
                  alignItems="center"
                  justifyContent="center"
                >
                  <Button
                    variant="contained"
                    size="large"
                    endIcon={<ArrowForwardIcon />}
                    onClick={openCreateStudyGuide}
                    sx={{
                      minHeight: 58,
                      px: 5,
                      borderRadius: 999,
                      textTransform: 'none',
                      fontWeight: 950,
                      fontSize: '1.05rem',
                      bgcolor: 'primary.dark',
                      boxShadow: `0 18px 36px ${alpha(theme.palette.primary.dark, 0.2)}`,
                      '&:hover': { bgcolor: 'primary.main' },
                    }}
                  >
                    Create a Study Guide
                  </Button>
                  <Button
                    href="#features"
                    variant="text"
                    endIcon={<ArrowForwardIcon />}
                    sx={{
                      minHeight: 48,
                      px: 1,
                      color: alpha(theme.palette.text.primary, 0.78),
                      textTransform: 'none',
                      fontWeight: 850,
                      '&:hover': {
                        bgcolor: 'transparent',
                        color: 'primary.main',
                      },
                    }}
                  >
                    See how it works
                  </Button>
                </Stack>
                <Typography
                  variant="overline"
                  sx={{
                    color: alpha(theme.palette.text.primary, 0.58),
                    fontWeight: 500,
                    letterSpacing: '0.22em',
                  }}
                >
                  Free to start · No credit card required
                </Typography>
              </Stack>
            </Stack>
          </Container>
        </Box>

        <Container maxWidth="lg">
          <Box
            id="features"
            sx={{
              pt: { xs: 4, md: 6 },
              pb: { xs: 5, md: 7 },
              scrollMarginTop: 88,
            }}
          >
            <Grid container spacing={2.5} alignItems="center">
              <Grid item xs={12} md={4}>
                <Stack spacing={1}>
                  <Typography
                    variant="overline"
                    fontWeight={950}
                    color="primary.main"
                  >
                    See it grow
                  </Typography>
                  <Typography variant="h4" component="h2" fontWeight={950}>
                    From goal to guide to practice
                  </Typography>
                  <Typography color="text.secondary">
                    A Study Guide starts as a path, then grows with targeted
                    practice, review pages, and AI help while you learn.
                  </Typography>
                </Stack>
              </Grid>
              <Grid item xs={12} md={8}>
                <Stack spacing={1.25}>
                  <ProductPreview
                    example={currentExample}
                    themeMode={theme.palette.mode}
                  />
                  <Stack
                    direction="row"
                    spacing={1}
                    justifyContent={{ xs: 'center', md: 'flex-end' }}
                    flexWrap="wrap"
                    useFlexGap
                  >
                    {guideExamples.map((example, index) => (
                      <Button
                        key={example.label}
                        size="small"
                        variant={
                          activeExample === index ? 'contained' : 'outlined'
                        }
                        onClick={() => setActiveExample(index)}
                        sx={{ borderRadius: 999, textTransform: 'none' }}
                      >
                        {example.label}
                      </Button>
                    ))}
                  </Stack>
                </Stack>
              </Grid>
            </Grid>
          </Box>

          <Box
            id="how-it-works"
            sx={{ py: { xs: 5, md: 8 }, scrollMarginTop: 88 }}
          >
            <Stack spacing={1} textAlign="center" alignItems="center" mb={3}>
              <Typography
                variant="overline"
                fontWeight={950}
                color="primary.main"
              >
                How StudyMesh Works
              </Typography>
              <Typography variant="h3" component="h2" fontWeight={950}>
                One prompt becomes a learning loop
              </Typography>
              <Typography
                variant="body1"
                color="text.secondary"
                sx={{ maxWidth: 760 }}
              >
                Start with what you want to learn. StudyMesh turns it into a
                guided path that keeps adapting while you study.
              </Typography>
            </Stack>

            <Grid container spacing={2.5}>
              {[
                [
                  '01',
                  'Start with a goal',
                  'Tell StudyMesh the subject, exam, skill, or confusion you want to work through.',
                ],
                [
                  '02',
                  'Study an interactive guide',
                  'Move through lessons, examples, checkpoints, quizzes, flashcards, and review pages.',
                ],
                [
                  '03',
                  'Adapt the next step',
                  'Ask for stronger practice, easier explanations, or targeted review when the guide needs to change.',
                ],
              ].map(([number, title, body]) => (
                <Grid item xs={12} md={4} key={number}>
                  <Paper
                    elevation={0}
                    sx={{
                      height: '100%',
                      p: 2.5,
                      borderRadius: 2,
                      border: '1px solid',
                      borderColor: alpha(theme.palette.primary.main, 0.18),
                      bgcolor: 'background.paper',
                    }}
                  >
                    <Stack spacing={1.25}>
                      <Box
                        sx={{
                          width: 42,
                          height: 42,
                          borderRadius: 1.5,
                          display: 'grid',
                          placeItems: 'center',
                          bgcolor: alpha(theme.palette.primary.main, 0.1),
                          color: 'primary.main',
                          fontWeight: 950,
                        }}
                      >
                        {number}
                      </Box>
                      <Typography variant="h5" fontWeight={950}>
                        {title}
                      </Typography>
                      <Typography color="text.secondary">{body}</Typography>
                    </Stack>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </Box>

          <Box
            id="pricing"
            sx={{ py: { xs: 5, md: 8 }, scrollMarginTop: 88 }}
          >
            <Grid container spacing={4} alignItems="center">
              <Grid item xs={12} md={5}>
                <Stack spacing={1.5}>
                  <Typography
                    variant="overline"
                    fontWeight={950}
                    color="primary.main"
                  >
                    Adaptive Study
                  </Typography>
                  <Typography variant="h3" component="h2" fontWeight={950}>
                    Keep learning as the guide adapts with you
                  </Typography>
                  <Typography
                    color="text.secondary"
                    sx={{ fontSize: '1.05rem' }}
                  >
                    Weak spots become practice, questions become new
                    explanations, and the Study Guide keeps growing around what
                    you need next.
                  </Typography>
                </Stack>
              </Grid>
              <Grid item xs={12} md={7}>
                <Grid container spacing={2}>
                  {adaptiveSignals.map((item) => (
                    <Grid item xs={12} sm={4} key={item.title}>
                      <Paper
                        elevation={0}
                        sx={{
                          height: '100%',
                          p: 2.25,
                          borderRadius: 2,
                          border: '1px solid',
                          borderColor: alpha(theme.palette.success.main, 0.22),
                          bgcolor: alpha(theme.palette.success.main, 0.06),
                        }}
                      >
                        <Stack spacing={1.25}>
                          <Box
                            sx={{
                              width: 38,
                              height: 38,
                              borderRadius: 1.25,
                              display: 'grid',
                              placeItems: 'center',
                              color: '#007C66',
                              bgcolor: alpha('#00A878', 0.12),
                            }}
                          >
                            {item.icon}
                          </Box>
                          <Typography fontWeight={950}>{item.title}</Typography>
                          <Typography variant="body2" color="text.secondary">
                            {item.body}
                          </Typography>
                        </Stack>
                      </Paper>
                    </Grid>
                  ))}
                </Grid>
              </Grid>
            </Grid>
          </Box>

          <Box sx={{ py: { xs: 5, md: 8 } }}>
            <Paper
              elevation={0}
              sx={{
                p: { xs: 2.5, md: 4 },
                borderRadius: 3,
                border: '1px solid',
                borderColor: alpha(theme.palette.primary.main, 0.2),
                bgcolor:
                  theme.palette.mode === 'dark'
                    ? alpha(theme.palette.background.paper, 0.72)
                    : '#F7FBFA',
              }}
            >
              <Grid container spacing={3} alignItems="center">
                <Grid item xs={12} md={5}>
                  <Stack spacing={1.25}>
                    <Typography
                      variant="overline"
                      fontWeight={950}
                      color="primary.main"
                    >
                      AI Chat
                    </Typography>
                    <Typography variant="h3" component="h2" fontWeight={950}>
                      Practice lives inside the Study Guide
                    </Typography>
                    <Typography color="text.secondary">
                      Quizzes, flashcards, clearer notes, and review practice
                      are part of the adaptive learning flow inside the guide.
                    </Typography>
                  </Stack>
                </Grid>
                <Grid item xs={12} md={7}>
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: {
                        xs: '1fr',
                        sm: 'repeat(2, minmax(0, 1fr))',
                      },
                      gap: 1.25,
                    }}
                  >
                    {studyActions.map(([label, icon]) => (
                      <Paper
                        key={label as string}
                        elevation={0}
                        sx={{
                          p: 1.5,
                          borderRadius: 2,
                          border: '1px solid',
                          borderColor: alpha(theme.palette.primary.main, 0.16),
                          bgcolor: 'background.paper',
                        }}
                      >
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Box
                            sx={{
                              width: 32,
                              height: 32,
                              borderRadius: 1,
                              display: 'grid',
                              placeItems: 'center',
                              bgcolor: alpha(theme.palette.primary.main, 0.1),
                              color: 'primary.main',
                            }}
                          >
                            {icon}
                          </Box>
                          <Typography fontWeight={900}>
                            {label as string}
                          </Typography>
                        </Stack>
                      </Paper>
                    ))}
                  </Box>
                </Grid>
              </Grid>
            </Paper>
          </Box>

          <Box sx={{ py: { xs: 5, md: 8 } }}>
            <Stack spacing={1} textAlign="center" alignItems="center" mb={3}>
              <Typography
                variant="overline"
                fontWeight={950}
                color="primary.main"
              >
                AI Options
              </Typography>
              <Typography variant="h3" component="h2" fontWeight={950}>
                Choose the AI setup that fits you
              </Typography>
              <Typography
                color="text.secondary"
                sx={{ maxWidth: 720, fontSize: '1.05rem' }}
              >
                Start fast, bring your own key, or use local AI when available.
                The Study Guide flow stays the same.
              </Typography>
            </Stack>
            <Grid container spacing={2}>
              {aiModes.map((mode) => (
                <Grid item xs={12} md={4} key={mode.title}>
                  <Paper
                    elevation={0}
                    sx={{
                      height: '100%',
                      p: 2.5,
                      borderRadius: 2,
                      border: '1px solid',
                      borderColor: 'divider',
                      bgcolor: 'background.paper',
                    }}
                  >
                    <Stack spacing={1.25}>
                      <Box
                        sx={{
                          width: 40,
                          height: 40,
                          borderRadius: 1.25,
                          display: 'grid',
                          placeItems: 'center',
                          bgcolor: alpha(theme.palette.primary.main, 0.1),
                          color: 'primary.main',
                        }}
                      >
                        {mode.icon}
                      </Box>
                      <Typography variant="h6" fontWeight={950}>
                        {mode.title}
                      </Typography>
                      <Typography color="text.secondary">
                        {mode.body}
                      </Typography>
                    </Stack>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </Box>

          <Box sx={{ py: { xs: 5, md: 8 } }}>
            <Typography variant="h3" component="h2" fontWeight={950} mb={3}>
              Quick answers
            </Typography>
            <Grid container spacing={2}>
              {quickAnswers.map((item) => (
                <Grid item xs={12} md={4} key={item.question}>
                  <Paper
                    elevation={0}
                    sx={{
                      height: '100%',
                      p: 2.5,
                      borderRadius: 2,
                      border: '1px solid',
                      borderColor: 'divider',
                      bgcolor: 'background.paper',
                    }}
                  >
                    <Typography variant="h6" fontWeight={950} mb={1}>
                      {item.question}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {item.answer}
                    </Typography>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </Box>

          <Paper
            elevation={0}
            sx={{
              mb: 8,
              p: { xs: 3, sm: 4 },
              borderRadius: 2,
              bgcolor: 'primary.dark',
              color: 'primary.contrastText',
              textAlign: 'center',
            }}
          >
            <Typography variant="h3" component="h2" fontWeight={950} mb={1}>
              Ready to build your next Study Guide?
            </Typography>
            <Typography
              sx={{
                color: alpha(theme.palette.primary.contrastText, 0.82),
                mb: 3,
                maxWidth: 720,
                mx: 'auto',
              }}
            >
              Start with a topic. Let StudyMesh create the guide. Keep learning
              as it adapts with you.
            </Typography>
            <Button
              variant="contained"
              size="large"
              onClick={openCreateStudyGuide}
              sx={{
                borderRadius: 1,
                textTransform: 'none',
                bgcolor: 'primary.main',
                color: 'primary.contrastText',
                fontWeight: 950,
                '&:hover': { bgcolor: 'primary.light' },
              }}
            >
              Create a Study Guide
            </Button>
          </Paper>
        </Container>
      </Box>
    </Box>
  )
}

interface ProductPreviewProps {
  example: (typeof guideExamples)[number]
  muted?: boolean
  themeMode: 'light' | 'dark'
}

const ProductPreview = ({
  example,
  muted = false,
  themeMode,
}: ProductPreviewProps) => {
  const borderColor =
    themeMode === 'dark' ? 'rgba(148,163,184,0.24)' : '#DCE7F1'
  const paperColor = themeMode === 'dark' ? 'rgba(15,23,42,0.94)' : '#FFFFFF'

  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 1.25, sm: 1.5 },
        borderRadius: 3,
        border: '1px solid',
        borderColor,
        bgcolor: paperColor,
        boxShadow: muted
          ? 'none'
          : themeMode === 'dark'
            ? '0 28px 70px rgba(0,0,0,0.38)'
            : '0 28px 70px rgba(30,64,175,0.16)',
      }}
    >
      <Stack spacing={1.25}>
        <Stack direction="row" spacing={1} alignItems="center">
          <RouteIcon color="primary" />
          <Box sx={{ minWidth: 0 }}>
            <Typography fontWeight={950} noWrap>
              {example.title}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
              Prompt: {example.prompt}
            </Typography>
          </Box>
        </Stack>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr 0.88fr' },
            gap: 1,
          }}
        >
          <Stack spacing={0.75}>
            {example.lessons.map(([number, title, detail]) => (
              <Box
                key={number}
                sx={{
                  p: 1,
                  borderRadius: 1.5,
                  border: '1px solid',
                  borderColor: 'divider',
                  bgcolor: (theme) => alpha(theme.palette.primary.main, 0.06),
                }}
              >
                <Stack direction="row" spacing={1} alignItems="center">
                  <Box
                    sx={{
                      width: 30,
                      height: 30,
                      borderRadius: 1,
                      display: 'grid',
                      placeItems: 'center',
                      bgcolor: (theme) =>
                        alpha(theme.palette.primary.main, 0.12),
                      color: 'primary.main',
                      fontSize: '0.78rem',
                      fontWeight: 950,
                      flex: '0 0 auto',
                    }}
                  >
                    {number}
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography fontWeight={950} noWrap>
                      {title}
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      noWrap
                      sx={{ display: 'block' }}
                    >
                      {detail}
                    </Typography>
                  </Box>
                </Stack>
              </Box>
            ))}
          </Stack>
          <Stack
            spacing={0.75}
            sx={{
              p: 1,
              borderRadius: 2,
              bgcolor: (theme) => alpha(theme.palette.success.main, 0.08),
              border: '1px solid',
              borderColor: (theme) => alpha(theme.palette.success.main, 0.18),
            }}
          >
            <Stack direction="row" spacing={0.75} alignItems="center">
              <ChatBubbleOutlineIcon sx={{ color: '#007C66' }} />
              <Typography fontWeight={950}>Adaptive AI Chat</Typography>
            </Stack>
            {example.chat.map(([label, text], index) => (
              <Box
                key={`${label}-${text}`}
                sx={{
                  p: 1,
                  borderRadius: 1.25,
                  bgcolor:
                    index === 1 ? alpha('#00A878', 0.14) : 'background.paper',
                  border: '1px solid',
                  borderColor: alpha('#00A878', index === 1 ? 0.28 : 0.16),
                }}
              >
                <Typography
                  variant="caption"
                  color={index === 1 ? '#007C66' : 'text.secondary'}
                  fontWeight={950}
                >
                  {label}
                </Typography>
                <Typography
                  variant="body2"
                  fontWeight={index === 1 ? 900 : 700}
                >
                  {text}
                </Typography>
              </Box>
            ))}
          </Stack>
        </Box>
      </Stack>
    </Paper>
  )
}

export default StudyMeshLanding
