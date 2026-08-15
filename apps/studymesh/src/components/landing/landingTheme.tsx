import React from 'react'
import { Stack, Typography } from '@mui/material'

// Shared by StudyMeshLanding and the landing sections that live in their own
// files. Kept here rather than in StudyMeshLanding so a section can use them
// without importing the page that renders it.
export const brand = {
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

export const SectionHeading = ({
  eyebrow,
  title,
  body,
  maxWidth = 820,
}: {
  eyebrow: React.ReactNode
  title: React.ReactNode
  body?: React.ReactNode
  maxWidth?: number
}) => (
  <Stack spacing={1.15} alignItems="center" textAlign="center">
    {eyebrow}
    <Typography
      variant="h2"
      sx={{
        maxWidth,
        color: brand.ink,
        fontWeight: 800,
        fontSize: { xs: '2rem', md: '3.05rem' },
        lineHeight: 1.08,
        letterSpacing: 0,
        textWrap: 'balance',
      }}
    >
      {title}
    </Typography>
    {body && (
      <Typography
        sx={{
          maxWidth: 760,
          color: '#64719B',
          fontSize: { xs: '1rem', md: '1.18rem' },
          lineHeight: 1.58,
        }}
      >
        {body}
      </Typography>
    )}
  </Stack>
)
