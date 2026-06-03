import React, { useState } from 'react'
import {
  Box,
  Button,
  Chip,
  Container,
  Grid,
  Paper,
  Stack,
  Typography,
  useTheme,
} from '@mui/material'
import { alpha } from '@mui/material/styles'
import { useNavigate } from 'react-router-dom'
import MenuBookIcon from '@mui/icons-material/MenuBook'
import RouteIcon from '@mui/icons-material/Route'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import KeyIcon from '@mui/icons-material/Key'
import MemoryIcon from '@mui/icons-material/Memory'
import CloudQueueIcon from '@mui/icons-material/CloudQueue'
import QuizIcon from '@mui/icons-material/Quiz'
import StyleIcon from '@mui/icons-material/Style'

const mainUseCases = [
  {
    title: 'Create Study Guide',
    eyebrow: 'From a goal',
    body: 'Describe what you want to learn and StudyMesh creates an ordered path with lessons, recap, and practice dashboards.',
    icon: <RouteIcon />,
    action: 'create-study-path',
    cta: 'Start a path',
    accent: '#2196F3',
    steps: ['Prompt a topic', 'Review the path', 'Study in order'],
    inputLabel: 'Example prompt',
    input:
      'Teach me Spanish past tenses from scratch, with examples, mistakes to avoid, and practice.',
    outputLabel: 'Generated path',
    output:
      'Lesson dashboards with source notes, guided explanations, flashcards, and exercises.',
  },
  {
    title: 'Quick Create',
    eyebrow: 'From your workspace',
    body: 'Turn the current dashboard, pasted text, uploaded files, images, PDFs, or slides into focused quizzes, flashcards, or clearer notes.',
    icon: <MenuBookIcon />,
    action: 'create-from-notes',
    cta: 'Open Quick Create',
    accent: '#00A878',
    steps: ['Pick a source', 'Choose a format', 'Study the result'],
    inputLabel: 'Source options',
    input: 'Current dashboard, copied notes, screenshots, PDF, or PowerPoint deck.',
    outputLabel: 'Quick result',
    output:
      'Quiz, flashcards, expanded notes, and practice tied to the selected source.',
  },
]

const heroHighlights = [
  'Study guides from any topic',
  'Quick Create for quizzes, flashcards, and expanded notes',
  'Practice generated next to the source material',
]

const studyPathPromptExamples = [
  {
    prompt: 'Learn French B1 for my oral exam',
    dashboards: [
      ['01', 'B1 conversation warm-up', 'speaking phrases + pronunciation'],
      ['02', 'Past and future tenses', 'grammar patterns + examples'],
      ['03', 'Oral practice', 'roleplays + answer prompts'],
      ['04', 'Final speaking review', 'mixed questions + confidence check'],
    ],
  },
  {
    prompt: 'High-school calculus: derivatives and limits',
    dashboards: [
      ['01', 'Limits without panic', 'intuition + visual examples'],
      ['02', 'Derivative basics', 'rules + worked problems'],
      ['03', 'Graph interpretation', 'slopes, tangents, and meaning'],
      ['04', 'Exam practice set', 'mixed exercises + corrections'],
    ],
  },
  {
    prompt: "Biology photosynthesis for tomorrow's test",
    dashboards: [
      ['01', 'Photosynthesis big picture', 'light, water, CO₂, glucose'],
      ['02', 'Light reactions', 'chloroplast map + key steps'],
      ['03', 'Calvin cycle practice', 'inputs, outputs, and traps'],
      ['04', 'Test-night review', 'flashcards + quick quiz'],
    ],
  },
]

const notesAttachmentExamples = [
  {
    id: 'text',
    icon: '📝',
    label: 'Text notes',
    lines: ['definitions', 'teacher comments'],
    dashboards: [
      ['Clean summary', 'organized key ideas', 92],
      ['Flashcards', 'definitions + terms', 70],
    ],
  },
  {
    id: 'image',
    icon: '📸',
    label: 'Images',
    lines: ['board photo', 'diagram snapshot'],
    dashboards: [
      ['Visual recap', 'diagrams explained', 82],
      ['Image Q&A', 'labels + concepts', 62],
    ],
  },
  {
    id: 'slides',
    icon: '📊',
    label: 'Slides',
    lines: ['unit deck', 'class examples'],
    dashboards: [['Slide walkthrough', 'deck turned into lessons', 76]],
  },
  {
    id: 'pdf',
    icon: '📄',
    label: 'PDF',
    lines: ['chapter pack', 'exam guide'],
    dashboards: [['Reading guide', 'PDF highlights', 86]],
  },
]

const quickAnswers = [
  {
    question: 'What is StudyMesh for?',
    answer:
      'StudyMesh helps students turn learning goals, notes, images, and references into study guides, clean dashboards, exercises, and review material.',
  },
  {
    question: 'What should I do first?',
    answer:
      'Create a Study Guide when you want a full tutorial. Use Quick Create when you want a quiz, flashcards, or expanded notes from current material.',
  },
  {
    question: 'How are dashboards organized?',
    answer:
      'Study Guides, Quick Create results, Study Packs, and custom dashboards open in the workspace and can be reused by folder.',
  },
]

const creationFeaturePills = [
  {
    label: 'Study Guide',
    icon: <RouteIcon />,
  },
  {
    label: 'Quiz',
    icon: <QuizIcon />,
  },
  {
    label: 'Flashcards',
    icon: <StyleIcon />,
  },
  {
    label: 'Expand',
    icon: <MenuBookIcon />,
  },
]

const aiPricing = [
  {
    title: 'Fallback mode',
    price: '0€',
    label: 'Always available',
    body: 'Basic local parsing and practice generation when you just want a quick dashboard without configuring AI.',
    icon: <CheckCircleIcon />,
    features: ['No API key', 'No payment', 'Good for quick notes'],
  },
  {
    title: 'Local Gemini Nano',
    price: '0€',
    label: 'Private on-device AI',
    body: 'Run compatible local AI in the browser when available. Slower, but private and free to use.',
    icon: <MemoryIcon />,
    features: ['No server tokens', 'Runs locally', 'Best for privacy'],
  },
  {
    title: 'BYOK Gemini',
    price: '0€',
    label: 'Use your own key',
    body: 'Bring your Gemini API key and StudyMesh uses it directly for deeper study guides and notes cleanup.',
    icon: <KeyIcon />,
    features: ['Your quota', 'Your control', 'Great quality'],
  },
  {
    title: 'Hosted API tokens',
    price: '2€',
    label: 'No API keys to manage',
    body: 'Start with 5-10 free tries. If you need more, make a one-time 2€ payment for greater hourly limits.',
    icon: <CloudQueueIcon />,
    features: ['5-10 free tries', 'One-time payment', 'Higher hourly limits'],
    highlighted: true,
  },
]

const StudyMeshLanding = () => {
  const navigate = useNavigate()
  const theme = useTheme()
  const [selectedStudyPathExample, setSelectedStudyPathExample] = useState(0)
  const [selectedNotesAttachments, setSelectedNotesAttachments] = useState([
    'text',
    'image',
  ])
  const activeStudyPathExample =
    studyPathPromptExamples[selectedStudyPathExample]
  const activeNotesDashboards = notesAttachmentExamples
    .filter((attachment) => selectedNotesAttachments.includes(attachment.id))
    .flatMap((attachment) => attachment.dashboards)
    .slice(0, 6)

  const toggleNotesAttachment = (attachmentId: string) => {
    setSelectedNotesAttachments((current) => {
      if (current.includes(attachmentId)) {
        return current.filter((id) => id !== attachmentId)
      }

      return [...current, attachmentId]
    })
  }

  const openWorkspace = (action?: string) => {
    navigate(action ? `/workspace?action=${action}` : '/workspace')
  }

  return (
    <Box
      sx={{
        minHeight: '100dvh',
        bgcolor: 'background.default',
        color: 'text.primary',
        overflowX: 'hidden',
      }}
    >
      <Box
        component="header"
        sx={{
          borderBottom: '1px solid',
          borderColor: 'divider',
          bgcolor: alpha(theme.palette.background.default, 0.92),
          backdropFilter: 'blur(14px)',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        <Container
          maxWidth="lg"
          sx={{
            height: 72,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Box
              component="img"
              src="/logo.png"
              alt="StudyMesh logo"
              sx={{ width: 36, height: 36, display: 'block' }}
            />
            <Typography variant="h6" fontWeight={800}>
              StudyMesh
            </Typography>
          </Stack>
          <Button
            variant="outlined"
            onClick={() => openWorkspace()}
            sx={{ borderRadius: 1, textTransform: 'none' }}
          >
            Enter workspace
          </Button>
        </Container>
      </Box>

      <Container maxWidth="lg" component="main">
        <Grid
          container
          spacing={5}
          alignItems="center"
          sx={{ minHeight: { xs: 'auto', md: 'calc(100dvh - 120px)' }, py: 6 }}
        >
          <Grid item xs={12} md={6}>
            <Typography
              variant="h2"
              component="h1"
              sx={{
                fontWeight: 900,
                fontSize: { xs: '2.35rem', md: '4rem' },
                lineHeight: 1.04,
                mb: 2,
                display: 'inline-block',
                background: 'linear-gradient(90deg, #2196F3, #00C49A, #2196F3)',
                backgroundSize: '190% auto',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                color: 'transparent',
                WebkitTextFillColor: 'transparent',
                animation: 'studyMeshHeroGradientShift 4s ease infinite',
                '@keyframes studyMeshHeroGradientShift': {
                  '0%': { backgroundPosition: '0% center' },
                  '50%': { backgroundPosition: '95% center' },
                  '100%': { backgroundPosition: '0% center' },
                },
              }}
            >
              StudyMesh
            </Typography>
            <Typography
              variant="h5"
              component="p"
              sx={{ 
                display: 'inline-block',
                mb: 2,
                fontWeight: 500, 
              }}
            >
              Turn <span style={{ color: '#2196F3', fontWeight: 700 }}>prompts</span> and <span style={{ color: '#00C49A', fontWeight: 700 }}>messy notes</span> into <Box component="span" sx={{ fontWeight: 700 }}>study guides</Box>.
            </Typography>
            <Typography variant="body1" sx={{ color: 'text.secondary', mb: 3 }}>
              Create a full tutorial from a learning goal, or use Quick Create
              to turn current material into quizzes, flashcards, expanded notes,
              and practice without designing the dashboard first.
            </Typography>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1}
              alignItems={{ xs: 'stretch', sm: 'center' }}
              flexWrap="wrap"
              useFlexGap
            >
              <Button
                variant="contained"
                size="large"
                onClick={() => openWorkspace()}
                sx={{ borderRadius: 1, textTransform: 'none' }}
              >
                Open Workspace
              </Button>
            </Stack>
            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              flexWrap="wrap"
              useFlexGap
              sx={{ mt: 2 }}
            >
              <Typography
                variant="caption"
                fontWeight={900}
                color="text.secondary"
              >
                Create:
              </Typography>
              {creationFeaturePills.map((item) => (
                <Chip
                  key={item.label}
                  size="small"
                  icon={item.icon}
                  label={item.label}
                  sx={{
                    borderRadius: 1,
                    fontWeight: 850,
                    bgcolor: alpha(theme.palette.primary.main, 0.08),
                    border: '1px solid',
                    borderColor: alpha(theme.palette.primary.main, 0.16),
                  }}
                />
              ))}
            </Stack>
            <Stack spacing={1} sx={{ mt: 3 }}>
              {heroHighlights.map((highlight) => (
                <Stack
                  key={highlight}
                  direction="row"
                  spacing={1}
                  alignItems="center"
                >
                  <CheckCircleIcon color="success" fontSize="small" />
                  <Typography variant="body2" color="text.secondary">
                    {highlight}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          </Grid>
          <Grid item xs={12} md={6}>
            <Paper
              elevation={0}
              sx={{
                borderRadius: 2,
                border: '1px solid',
                borderColor: 'divider',
                overflow: 'hidden',
                bgcolor: 'background.paper',
                boxShadow:
                  theme.palette.mode === 'dark'
                    ? `0 22px 60px ${alpha(theme.palette.common.black, 0.42)}`
                    : `0 22px 60px ${alpha(theme.palette.primary.dark, 0.14)}`,
              }}
            >
              <Box
                component="img"
                src="/images/widget_builder_overview.svg"
                alt="StudyMesh workspace"
                sx={{
                  display: 'block',
                  width: '100%',
                  aspectRatio: '16 / 10',
                  objectFit: 'cover',
                  objectPosition: 'top left',
                }}
              />
            </Paper>
          </Grid>
        </Grid>

        <Box sx={{ py: { xs: 4, md: 6 } }}>
          <Stack spacing={1} textAlign="center" alignItems="center" mb={3}>
            <Typography
              variant="overline"
              fontWeight={900}
              color="primary.main"
            >
              Two ways to start
            </Typography>
            <Typography variant="h4" component="h2" fontWeight={900}>
              Start from a learning goal or a Quick Create action
            </Typography>
            <Typography
              variant="body1"
              color="text.secondary"
              sx={{ maxWidth: 760 }}
            >
              Use Study Guide when you need a full tutorial across multiple
              dashboards. Use Quick Create when you already have context and
              want a focused study artifact fast.
            </Typography>
          </Stack>

          <Grid container spacing={2.5} alignItems="stretch">
            {mainUseCases.map((useCase, index) => (
              <Grid item xs={12} md={6} key={useCase.title}>
                <Paper
                  elevation={0}
                  sx={{
                    height: '100%',
                    p: { xs: 2.5, md: 3 },
                    borderRadius: 3,
                    border: '1px solid',
                    borderColor: alpha(useCase.accent, 0.28),
                    bgcolor: alpha(useCase.accent, 0.06),
                    position: 'relative',
                    overflow: 'hidden',
                    transition:
                      'transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease',
                    animation: `studyMeshUseCaseFloat${index} 7s ease-in-out infinite`,
                    '@keyframes studyMeshUseCaseFloat0': {
                      '0%, 100%': { transform: 'translateY(0)' },
                      '50%': { transform: 'translateY(-4px)' },
                    },
                    '@keyframes studyMeshUseCaseFloat1': {
                      '0%, 100%': { transform: 'translateY(-2px)' },
                      '50%': { transform: 'translateY(2px)' },
                    },
                    '&:hover': {
                      transform: 'translateY(-6px)',
                      borderColor: alpha(useCase.accent, 0.58),
                      boxShadow: `0 24px 54px ${alpha(useCase.accent, 0.16)}`,
                      animationPlayState: 'paused',
                    },
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      inset: 'auto -12% -28% auto',
                      width: 180,
                      height: 180,
                      borderRadius: '50%',
                      bgcolor: alpha(useCase.accent, 0.14),
                    },
                  }}
                >
                  <Stack spacing={2.25} height="100%" position="relative">
                    <Stack direction="row" spacing={1.25} alignItems="center">
                      <Box
                        sx={{
                          width: 48,
                          height: 48,
                          borderRadius: 2,
                          display: 'grid',
                          placeItems: 'center',
                          color: useCase.accent,
                          bgcolor: alpha(useCase.accent, 0.12),
                        }}
                      >
                        {useCase.icon}
                      </Box>
                      <Box>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          fontWeight={800}
                        >
                          {useCase.eyebrow}
                        </Typography>
                        <Typography variant="h5" fontWeight={900}>
                          {useCase.title}
                        </Typography>
                      </Box>
                    </Stack>

                    <Typography color="text.secondary">
                      {useCase.body}
                    </Typography>

                    <Stack
                      direction="row"
                      spacing={1}
                      flexWrap="wrap"
                      useFlexGap
                    >
                      {useCase.steps.map((step) => (
                        <Box
                          key={step}
                          sx={{
                            px: 1.25,
                            py: 0.75,
                            borderRadius: 999,
                            border: '1px solid',
                            borderColor: alpha(useCase.accent, 0.22),
                            bgcolor: alpha(theme.palette.background.paper, 0.7),
                            fontSize: '0.78rem',
                            fontWeight: 800,
                          }}
                        >
                          {step}
                        </Box>
                      ))}
                    </Stack>

                    <Button
                      variant={index === 0 ? 'contained' : 'outlined'}
                      onClick={() => openWorkspace(useCase.action)}
                      sx={{
                        mt: 'auto',
                        alignSelf: 'flex-start',
                        borderRadius: 1,
                        textTransform: 'none',
                        ...(index === 0
                          ? { bgcolor: useCase.accent }
                          : {
                              color: useCase.accent,
                              borderColor: alpha(useCase.accent, 0.42),
                            }),
                      }}
                    >
                      {useCase.cta}
                    </Button>
                  </Stack>
                </Paper>
              </Grid>
            ))}
          </Grid>

          <Stack spacing={1} sx={{ mt: 4, mb: 2 }}>
            <Typography variant="h5" fontWeight={900}>
              What creation looks like in practice
            </Typography>
          </Stack>

          <Stack spacing={2.5}>
            <Paper
              elevation={0}
              sx={{
                p: { xs: 2.25, md: 3 },
                borderRadius: 3,
                border: '1px solid',
                borderColor: alpha('#2196F3', 0.32),
                bgcolor: alpha('#2196F3', 0.07),
                overflow: 'hidden',
                position: 'relative',
              }}
            >
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} md={5}>
                  <Paper
                    elevation={0}
                    sx={{
                      height: '100%',
                      p: { xs: 2, md: 2.25 },
                      borderRadius: 2.5,
                      bgcolor: alpha(theme.palette.background.paper, 0.88),
                      border: '1px solid',
                      borderColor: alpha('#2196F3', 0.2),
                    }}
                  >
                    <Stack spacing={1.5} height="100%">
                      <Typography
                        variant="h5"
                        fontWeight={950}
                        color="#2196F3"
                      >
                        Create Study Guide
                      </Typography>
                      <Typography variant="h5" fontWeight={900}>
                        Tell StudyMesh what you want to master
                      </Typography>
                      <Stack spacing={1}>
                        {studyPathPromptExamples.map(
                          (example, exampleIndex) => {
                            const selected =
                              exampleIndex === selectedStudyPathExample

                            return (
                              <Box
                                key={example.prompt}
                                component="button"
                                type="button"
                                onClick={() =>
                                  setSelectedStudyPathExample(exampleIndex)
                                }
                                sx={{
                                  p: 1.25,
                                  borderRadius: 2,
                                  bgcolor: selected
                                    ? alpha('#2196F3', 0.16)
                                    : alpha('#2196F3', 0.08),
                                  border: '1px solid',
                                  borderColor: selected
                                    ? '#2196F3'
                                    : alpha('#2196F3', 0.18),
                                  boxShadow: selected
                                    ? `0 12px 28px ${alpha('#2196F3', 0.16)}`
                                    : 'none',
                                  color: 'text.primary',
                                  cursor: 'pointer',
                                  font: 'inherit',
                                  fontWeight: 850,
                                  textAlign: 'left',
                                  transition:
                                    'background-color 160ms ease, border-color 160ms ease, transform 160ms ease, box-shadow 160ms ease',
                                  '&:hover': {
                                    borderColor: '#2196F3',
                                    transform: 'translateY(-1px)',
                                  },
                                }}
                              >
                                “{example.prompt}”
                              </Box>
                            )
                          },
                        )}
                      </Stack>
                    </Stack>
                  </Paper>
                </Grid>
                <Grid item xs={12} md={1}>
                  <Box
                    sx={{
                      display: 'grid',
                      placeItems: 'center',
                      color: '#1565C0',
                      fontSize: { xs: 28, md: 34 },
                      fontWeight: 950,
                      transform: { xs: 'rotate(90deg)', md: 'none' },
                    }}
                    aria-hidden="true"
                  >
                    →
                  </Box>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Paper
                    elevation={0}
                    sx={{
                      height: '100%',
                      p: 1.5,
                      borderRadius: 2.5,
                      bgcolor: alpha(theme.palette.background.paper, 0.88),
                      border: '1px solid',
                      borderColor: alpha('#2196F3', 0.2),
                    }}
                  >
                    <Stack spacing={1.25}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <RouteIcon sx={{ color: '#2196F3' }} />
                        <Box>
                          <Typography variant="subtitle1" fontWeight={950}>
                            Get a step-by-step study journey
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Each lesson becomes its own dashboard with notes,
                            examples, and practice.
                          </Typography>
                        </Box>
                      </Stack>
                      <Grid container spacing={1}>
                        {activeStudyPathExample.dashboards.map(
                          ([number, title, detail]) => (
                            <Grid item xs={12} sm={6} key={number} px={1}>
                              <Box
                                sx={{
                                  py: 1.25,
                                  px: 1,
                                  minHeight: 86,
                                  borderRadius: 2,
                                  bgcolor: alpha('#2196F3', 0.08),
                                  border: '1px solid',
                                  borderColor: alpha('#2196F3', 0.14),
                                }}
                              >
                                <Typography
                                  variant="caption"
                                  fontWeight={950}
                                  color="#2196F3"
                                >
                                  Dashboard {number}
                                </Typography>
                                <Typography fontWeight={900}>
                                  {title}
                                </Typography>
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                >
                                  {detail}
                                </Typography>
                              </Box>
                            </Grid>
                          ),
                        )}
                      </Grid>
                    </Stack>
                  </Paper>
                </Grid>
              </Grid>
            </Paper>

            <Paper
              elevation={0}
              sx={{
                p: { xs: 2.25, md: 3 },
                borderRadius: 3,
                border: '1px solid',
                borderColor: alpha('#00A878', 0.32),
                bgcolor: alpha('#00A878', 0.07),
              }}
            >
              <Grid container spacing={2.5} alignItems="stretch">
                <Grid item xs={12} md={5}>
                  <Paper
                    elevation={0}
                    sx={{
                      height: '100%',
                      p: { xs: 2, md: 2.25 },
                      borderRadius: 2.5,
                      bgcolor: alpha(theme.palette.background.paper, 0.88),
                      border: '1px solid',
                      borderColor: alpha('#00A878', 0.2),
                    }}
                  >
                    <Stack spacing={1.5} height="100%">
                      <Typography
                        variant="h5"
                        fontWeight={950}
                        color="#00A878"
                      >
                        Quick Create
                      </Typography>
                      <Typography variant="h5" fontWeight={900}>
                        Choose what you want from current material
                      </Typography>
                      <Box
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                          gap: 1,
                        }}
                      >
                        {notesAttachmentExamples.map((attachment) => {
                          const selected = selectedNotesAttachments.includes(
                            attachment.id,
                          )

                          return (
                            <Paper
                              key={attachment.id}
                              component="button"
                              type="button"
                              elevation={0}
                              onClick={() =>
                                toggleNotesAttachment(attachment.id)
                              }
                              sx={{
                                p: 1,
                                minHeight: 112,
                                borderRadius: 2,
                                bgcolor: selected
                                  ? alpha('#00A878', 0.14)
                                  : alpha(theme.palette.background.paper, 0.86),
                                border: '1px solid',
                                borderColor: selected
                                  ? '#00A878'
                                  : alpha('#00A878', 0.18),
                                boxShadow: selected
                                  ? `0 12px 28px ${alpha('#00A878', 0.14)}`
                                  : 'none',
                                color: 'text.primary',
                                cursor: 'pointer',
                                font: 'inherit',
                                textAlign: 'left',
                                transition:
                                  'background-color 160ms ease, border-color 160ms ease, transform 160ms ease, box-shadow 160ms ease',
                                '&:hover': {
                                  borderColor: '#00A878',
                                  transform: 'translateY(-1px)',
                                },
                              }}
                            >
                              <Typography fontSize={24}>
                                {attachment.icon}
                              </Typography>
                              <Typography variant="caption" fontWeight={950}>
                                {attachment.label}
                              </Typography>
                              {attachment.lines.map((line, lineIndex) => (
                                <Box
                                  key={line}
                                  sx={{
                                    mt: 0.7,
                                    width: lineIndex === 0 ? '86%' : '64%',
                                    height: 6,
                                    borderRadius: 1,
                                    bgcolor: alpha(
                                      '#00A878',
                                      selected
                                        ? lineIndex === 0
                                          ? 0.42
                                          : 0.24
                                        : 0.14,
                                    ),
                                  }}
                                />
                              ))}
                            </Paper>
                          )
                        })}
                      </Box>
                    </Stack>
                  </Paper>
                </Grid>
                <Grid item xs={12} md={7}>
                  <Paper
                    elevation={0}
                    sx={{
                      height: '100%',
                      p: 1.5,
                      borderRadius: 2.5,
                      bgcolor: alpha(theme.palette.background.paper, 0.88),
                      border: '1px solid',
                      borderColor: alpha('#00A878', 0.2),
                    }}
                  >
                    <Stack spacing={1.25}>
                      <Typography variant="subtitle1" fontWeight={950}>
                        Get focused study results without setup
                      </Typography>
                      <Box
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: {
                            xs: '1fr',
                            sm: '1.1fr 1fr 1fr',
                          },
                          gap: 1,
                          alignItems: 'stretch',
                        }}
                      >
                        {activeNotesDashboards.length === 0 ? (
                          <Box
                            sx={{
                              gridColumn: '1 / -1',
                              minHeight: 132,
                              borderRadius: 2,
                              border: '1px dashed',
                              borderColor: alpha('#00A878', 0.32),
                              bgcolor: alpha('#00A878', 0.06),
                              display: 'grid',
                              placeItems: 'center',
                              textAlign: 'center',
                              p: 2,
                            }}
                          >
                            <Typography
                              variant="body2"
                              color="text.secondary"
                              fontWeight={800}
                            >
                              Click a source on the left to see the focused
                              study outputs Quick Create can generate.
                            </Typography>
                          </Box>
                        ) : (
                          activeNotesDashboards.map(
                            ([title, detail, width], cardIndex) => (
                              <Box
                                key={title as string}
                                sx={{
                                  p: 1.25,
                                  minHeight: 132,
                                  borderRadius: 2,
                                  bgcolor: alpha(
                                    '#00A878',
                                    cardIndex === 0 ? 0.12 : 0.08,
                                  ),
                                  border: '1px solid',
                                  borderColor: alpha('#00A878', 0.16),
                                  position: 'relative',
                                  overflow: 'hidden',
                                }}
                              >
                                <Typography
                                  variant="caption"
                                  fontWeight={950}
                                  color="#00A878"
                                >
                                  Dashboard {cardIndex + 1}
                                </Typography>
                                <Typography fontWeight={950}>
                                  {title as string}
                                </Typography>
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                >
                                  {detail as string}
                                </Typography>
                                <Box sx={{ mt: 1.2 }}>
                                  {[0, 1, 2].map((line) => (
                                    <Box
                                      key={line}
                                      sx={{
                                        width:
                                          line === 0
                                            ? `${width}%`
                                            : line === 1
                                              ? '74%'
                                              : '48%',
                                        height: 6,
                                        borderRadius: 1,
                                        bgcolor:
                                          line === 0
                                            ? '#00A878'
                                            : alpha('#00A878', 0.22),
                                        mb: 0.75,
                                      }}
                                    />
                                  ))}
                                </Box>
                                <Box
                                  sx={{
                                    position: 'absolute',
                                    right: -12,
                                    bottom: -12,
                                    width: 56,
                                    height: 56,
                                    borderRadius: '50%',
                                    bgcolor: alpha('#00A878', 0.13),
                                  }}
                                />
                              </Box>
                            ),
                          )
                        )}
                      </Box>
                    </Stack>
                  </Paper>
                </Grid>
              </Grid>
            </Paper>
          </Stack>
        </Box>

        <Box sx={{ py: 5 }}>
          <Paper
            elevation={0}
            sx={{
              p: { xs: 2.5, md: 4 },
              borderRadius: 3,
              border: '1px solid',
              borderColor: alpha(theme.palette.primary.main, 0.22),
              bgcolor:
                theme.palette.mode === 'dark'
                  ? alpha(theme.palette.primary.dark, 0.24)
                  : alpha(theme.palette.primary.light, 0.1),
              background:
                theme.palette.mode === 'dark'
                  ? `radial-gradient(circle at top right, ${alpha(
                      theme.palette.primary.main,
                      0.24,
                    )}, transparent 34%), ${alpha(
                      theme.palette.background.paper,
                      0.74,
                    )}`
                  : `radial-gradient(circle at top right, ${alpha(
                      theme.palette.primary.light,
                      0.38,
                    )}, transparent 34%), linear-gradient(135deg, ${alpha(
                      theme.palette.primary.light,
                      0.14,
                    )}, ${alpha(theme.palette.success.light, 0.14)})`,
            }}
          >
            <Stack spacing={1} alignItems="center" textAlign="center" mb={3}>
              <Typography
                variant="overline"
                fontWeight={900}
                color="primary.main"
              >
                Pricing
              </Typography>
              <Typography variant="h4" component="h2" fontWeight={900}>
                Choose the AI mode that fits you
              </Typography>
              <Typography
                variant="body1"
                color="text.secondary"
                sx={{ maxWidth: 720 }}
              >
                StudyMesh is designed to stay useful even at 0€. Use free modes,
                bring your own Gemini key, run local AI, or choose hosted tokens
                when you do not want to worry about API keys, quotas, or setup.
              </Typography>
            </Stack>

            <Grid container spacing={2} alignItems="stretch">
              {aiPricing.map((plan) => (
                <Grid item xs={12} sm={6} md={3} key={plan.title}>
                  <Paper
                    elevation={0}
                    sx={{
                      height: '100%',
                      p: 2.25,
                      borderRadius: 2,
                      border: '1px solid',
                      borderColor: plan.highlighted
                        ? 'primary.main'
                        : alpha(theme.palette.divider, 0.9),
                      bgcolor: plan.highlighted
                        ? alpha(theme.palette.primary.main, 0.1)
                        : alpha(theme.palette.background.paper, 0.86),
                      boxShadow: plan.highlighted
                        ? `0 18px 44px ${alpha(
                            theme.palette.primary.main,
                            0.18,
                          )}`
                        : 'none',
                    }}
                  >
                    <Stack spacing={1.5} height="100%">
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Box
                          sx={{
                            width: 38,
                            height: 38,
                            borderRadius: '50%',
                            display: 'grid',
                            placeItems: 'center',
                            color: plan.highlighted
                              ? 'primary.contrastText'
                              : 'primary.main',
                            bgcolor: plan.highlighted
                              ? 'primary.main'
                              : alpha(theme.palette.primary.main, 0.1),
                          }}
                        >
                          {plan.icon}
                        </Box>
                        <Typography variant="caption" color="text.secondary">
                          {plan.label}
                        </Typography>
                      </Stack>
                      <Box>
                        <Typography variant="h6" fontWeight={900}>
                          {plan.title}
                        </Typography>
                        <Stack direction="row" spacing={0.75} alignItems="end">
                          <Typography variant="h3" fontWeight={950}>
                            {plan.price}
                          </Typography>
                          {plan.highlighted && (
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              sx={{ pb: 0.75 }}
                            >
                              one-time
                            </Typography>
                          )}
                        </Stack>
                      </Box>
                      <Typography variant="body2" color="text.secondary">
                        {plan.body}
                      </Typography>
                      <Stack spacing={0.75} sx={{ mt: 'auto' }}>
                        {plan.features.map((feature) => (
                          <Stack
                            key={feature}
                            direction="row"
                            spacing={0.75}
                            alignItems="center"
                          >
                            <CheckCircleIcon
                              fontSize="small"
                              color={plan.highlighted ? 'primary' : 'success'}
                            />
                            <Typography variant="body2">{feature}</Typography>
                          </Stack>
                        ))}
                      </Stack>
                    </Stack>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </Paper>
        </Box>

        <Box sx={{ py: 5 }}>
          <Typography variant="h4" component="h2" fontWeight={850} mb={3}>
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
                    borderRadius: 1,
                    border: '1px solid',
                    borderColor: 'divider',
                    bgcolor: 'background.paper',
                  }}
                >
                  <Typography variant="h6" fontWeight={800} mb={1}>
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
          <Typography variant="h4" component="h2" fontWeight={850} mb={1}>
            Ready to create your next study view?
          </Typography>
          <Typography
            sx={{
              color: alpha(theme.palette.primary.contrastText, 0.82),
              mb: 3,
            }}
          >
            Start with a learning goal or current study material, then open the
            generated Study Guide or Quick Create result in your workspace.
          </Typography>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1.5}
            justifyContent="center"
            flexWrap="wrap"
            useFlexGap
          >
            <Button
              variant="contained"
              size="large"
              onClick={() => openWorkspace()}
              sx={{
                borderRadius: 1,
                textTransform: 'none',
                bgcolor: 'primary.main',
                color: 'primary.contrastText',
                '&:hover': { bgcolor: 'primary.light' },
              }}
            >
              Enter Workspace
            </Button>
          </Stack>
        </Paper>
      </Container>
    </Box>
  )
}

export default StudyMeshLanding
