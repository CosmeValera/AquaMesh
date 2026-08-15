import React from 'react'
import { Box, Container, Stack, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import LayersOutlinedIcon from '@mui/icons-material/LayersOutlined'

import { ReactComponent as GeminiLogo } from '../../icons/providers/gemini.svg'
import { ReactComponent as AnthropicLogo } from '../../icons/providers/anthropic.svg'
import { ReactComponent as ChromeLogo } from '../../icons/providers/chrome.svg'
import { ReactComponent as SupabaseLogo } from '../../icons/providers/supabase.svg'
import { ReactComponent as VercelLogo } from '../../icons/providers/vercel.svg'

import { SectionHeading, brand } from './landingTheme'

type StackMark = {
  id: string
  label: string
  Logo?: React.FunctionComponent<React.SVGProps<SVGSVGElement>>
  // Marks without an official monochrome SVG render as a tracked wordmark, the
  // way real logo strips mix marks and type.
  status?: 'soon'
}

// Every entry here has to be something RabbitHole genuinely runs on. 'soon'
// means the provider is not usable yet, so the strip never implies more than
// the app actually does.
const STACK_MARKS: StackMark[] = [
  { id: 'gemini', label: 'Gemini', Logo: GeminiLogo },
  { id: 'cerebras', label: 'Cerebras' },
  { id: 'chrome', label: 'Chrome built-in AI', Logo: ChromeLogo },
  { id: 'openai', label: 'OpenAI', status: 'soon' },
  { id: 'anthropic', label: 'Anthropic', Logo: AnthropicLogo, status: 'soon' },
  { id: 'supabase', label: 'Supabase', Logo: SupabaseLogo },
  { id: 'vercel', label: 'Vercel', Logo: VercelLogo },
  { id: 'tavily', label: 'Tavily' },
  { id: 'unrealspeech', label: 'Unreal Speech' },
]

const MARQUEE_SECONDS = 42

const TrustedStackSection = () => (
  <Box
    id="runs-on"
    data-testid="landing-runs-on"
    sx={{
      position: 'relative',
      bgcolor: 'transparent',
      pt: { xs: 5, md: 7 },
      pb: { xs: 1, md: 2 },
      overflow: 'hidden',
    }}
  >
    <Container maxWidth="lg">
      <Stack spacing={{ xs: 3, md: 3.6}} sx={{mb: '2rem'}} alignItems="center">
        <SectionHeading
          eyebrow={
            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              sx={{
                px: 1.5,
                py: 0.65,
                borderRadius: 999,
                border: `1px solid ${alpha(brand.mint, 0.2)}`,
                bgcolor: alpha(brand.mint, 0.09),
                color: '#008A78',
                fontWeight: 800,
                fontSize: '0.82rem',
                lineHeight: 1,
              }}
            >
              <LayersOutlinedIcon sx={{ fontSize: 16 }} />
              <Box component="span">RUNS ON</Box>
            </Stack>
          }
          title={<>Runs on AI you already trust.</>}
          body="Bring your own Gemini or Cerebras key, or run on-device in Chrome. OpenAI and Anthropic keys are next."
          maxWidth={780}
        />

        <MarkMarquee />
      </Stack>
    </Container>
  </Box>
)

/**
 * The scrolling strip. The mark list is rendered twice inside one track and the
 * track is shifted by exactly half its width, so the second copy is under the
 * cursor the moment the first scrolls out and the loop has no visible seam.
 *
 * Both copies are aria-hidden and the names are exposed once through a
 * visually hidden list, so a screen reader hears nine names rather than
 * eighteen.
 */
const MarkMarquee = () => (
  <Box sx={{ width: '100%', position: 'relative' }}>
    <Box component="ul" sx={visuallyHiddenSx}>
      {STACK_MARKS.map((mark) => (
        <li key={mark.id}>
          {mark.label}
          {mark.status === 'soon' ? ' (coming soon)' : ''}
        </li>
      ))}
    </Box>

    <Box
      aria-hidden="true"
      sx={{
        width: '100%',
        overflow: 'hidden',
        // Fades the marks into the page instead of cutting them at the edge.
        maskImage:
          'linear-gradient(90deg, transparent, #000 7%, #000 93%, transparent)',
        WebkitMaskImage:
          'linear-gradient(90deg, transparent, #000 7%, #000 93%, transparent)',
        '&:hover .runs-on-track': {
          animationPlayState: 'paused',
        },
        // Nothing is clipped once the strip wraps, so the fade would only dim
        // the first and last mark of each row.
        '@media (prefers-reduced-motion: reduce)': {
          maskImage: 'none',
          WebkitMaskImage: 'none',
        },
      }}
    >
      <Box
        className="runs-on-track"
        sx={{
          display: 'flex',
          width: 'max-content',
          alignItems: 'center',
          animation: `runsOnMarquee ${MARQUEE_SECONDS}s linear infinite`,
          '@keyframes runsOnMarquee': {
            from: { transform: 'translateX(0)' },
            to: { transform: 'translateX(-50%)' },
          },
          // Motion is decoration here, so it stops entirely and the strip wraps
          // into a plain centered row that reads at any width.
          '@media (prefers-reduced-motion: reduce)': {
            animation: 'none',
            width: '100%',
            flexWrap: 'wrap',
            justifyContent: 'center',
          },
        }}
      >
        {[0, 1].map((copy) => (
          <Stack
            key={copy}
            direction="row"
            alignItems="center"
            sx={{
              flex: '0 0 auto',
              '@media (prefers-reduced-motion: reduce)': {
                // Has to be allowed to fill and wrap, otherwise the row stays
                // one unbreakable flex item and overflows the clipped parent.
                flex: '1 1 100%',
                width: '100%',
                flexWrap: 'wrap',
                justifyContent: 'center',
                // One copy is enough once nothing moves.
                display: copy === 1 ? 'none' : 'flex',
              },
            }}
          >
            {STACK_MARKS.map((mark) => (
              <MarkItem key={`${copy}-${mark.id}`} mark={mark} />
            ))}
          </Stack>
        ))}
      </Box>
    </Box>
  </Box>
)

const MarkItem = ({ mark }: { mark: StackMark }) => {
  const { Logo, label, status } = mark
  const isSoon = status === 'soon'

  return (
    <Stack
      direction="row"
      spacing={1.1}
      alignItems="center"
      sx={{
        flex: '0 0 auto',
        px: { xs: 2.4, md: 3.4 },
        py: 1.2,
        // Muted enough to read as "not yet", still above the contrast floor
        // for body-sized text.
        color: isSoon ? alpha(brand.ink, 0.52) : '#5C6884',
        transition: 'color 160ms ease',
        '&:hover': {
          color: isSoon ? alpha(brand.ink, 0.68) : brand.ink,
        },
      }}
    >
      {Logo ? (
        <Logo width={26} height={26} aria-hidden="true" focusable="false" />
      ) : null}
      <Typography
        component="span"
        sx={{
          whiteSpace: 'nowrap',
          color: 'inherit',
          fontWeight: Logo ? 700 : 800,
          fontSize: Logo ? '1.02rem' : '1.06rem',
          letterSpacing: Logo ? 0 : '0.06em',
          textTransform: Logo ? 'none' : 'uppercase',
        }}
      >
        {label}
      </Typography>
      {isSoon && (
        <Box
          component="span"
          sx={{
            px: 0.85,
            py: 0.3,
            borderRadius: 999,
            border: `1px solid ${alpha(brand.mint, 0.32)}`,
            bgcolor: alpha(brand.mint, 0.12),
            color: '#008A78',
            fontWeight: 800,
            fontSize: '0.62rem',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            lineHeight: 1.4,
          }}
        >
          Soon
        </Box>
      )}
    </Stack>
  )
}

const visuallyHiddenSx = {
  position: 'absolute',
  width: 1,
  height: 1,
  m: 0,
  p: 0,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  clipPath: 'inset(50%)',
  whiteSpace: 'nowrap',
  listStyle: 'none',
} as const

export default TrustedStackSection
