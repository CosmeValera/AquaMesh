import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { humanizeGuideTitle } from '../../../../../api/hosted-ai'

describe('humanizeGuideTitle', () => {
  it('humanises the kebab-case slugs the Study Guide model returns', () => {
    expect(humanizeGuideTitle('spaced-repetition')).toBe('Spaced Repetition')
    expect(humanizeGuideTitle('compound-interest')).toBe('Compound Interest')
    expect(humanizeGuideTitle('learning-bottleneck')).toBe(
      'Learning Bottleneck',
    )
    expect(humanizeGuideTitle('why-you-forget')).toBe('Why You Forget')
  })

  it('humanises snake_case and mixed separators', () => {
    expect(humanizeGuideTitle('spaced_repetition')).toBe('Spaced Repetition')
    expect(humanizeGuideTitle('deep_work-basics')).toBe('Deep Work Basics')
  })

  it('treats a digit-only segment as part of the slug', () => {
    expect(humanizeGuideTitle('python-3-basics')).toBe('Python 3 Basics')
    expect(humanizeGuideTitle('http-2-explained')).toBe('Http 2 Explained')
  })

  it('leaves a title that already reads like a human title untouched', () => {
    expect(humanizeGuideTitle('Immune Defense')).toBe('Immune Defense')
    expect(humanizeGuideTitle('How memory works')).toBe('How memory works')
    expect(humanizeGuideTitle('Photosynthesis')).toBe('Photosynthesis')
    expect(humanizeGuideTitle('C')).toBe('C')
  })

  it('leaves a legitimate hyphenated title untouched', () => {
    // A space anywhere means the model already wrote words.
    expect(humanizeGuideTitle('Cost-Benefit Analysis')).toBe(
      'Cost-Benefit Analysis',
    )
    expect(humanizeGuideTitle('object-oriented programming')).toBe(
      'object-oriented programming',
    )
    // A single-letter part is a hyphenated word, not a slug of two words.
    expect(humanizeGuideTitle('e-commerce')).toBe('e-commerce')
    expect(humanizeGuideTitle('x-ray')).toBe('x-ray')
    expect(humanizeGuideTitle('t-test')).toBe('t-test')
    expect(humanizeGuideTitle('u-turn')).toBe('u-turn')
    // Any capital means the model already cased it deliberately.
    expect(humanizeGuideTitle('E-Commerce')).toBe('E-Commerce')
    expect(humanizeGuideTitle('Well-Being')).toBe('Well-Being')
    expect(humanizeGuideTitle('Cost-benefit')).toBe('Cost-benefit')
  })

  it('leaves anything that is not a clean slug untouched', () => {
    expect(humanizeGuideTitle('-leading')).toBe('-leading')
    expect(humanizeGuideTitle('trailing-')).toBe('trailing-')
    expect(humanizeGuideTitle('double--dash')).toBe('double--dash')
    expect(humanizeGuideTitle('café-crème')).toBe('café-crème')
    expect(humanizeGuideTitle('memory')).toBe('memory')
  })

  it('is safe for empty, blank and non-string values', () => {
    expect(humanizeGuideTitle('')).toBe('')
    expect(humanizeGuideTitle('   ')).toBe('')
    expect(humanizeGuideTitle(undefined)).toBe('')
    expect(humanizeGuideTitle(null)).toBe('')
    expect(humanizeGuideTitle(42)).toBe('')
    expect(humanizeGuideTitle({ title: 'spaced-repetition' })).toBe('')
  })

  it('trims before deciding, so a padded slug is still humanised', () => {
    expect(humanizeGuideTitle('  spaced-repetition  ')).toBe(
      'Spaced Repetition',
    )
  })

  it('is idempotent', () => {
    expect(humanizeGuideTitle(humanizeGuideTitle('spaced-repetition'))).toBe(
      'Spaced Repetition',
    )
  })
})

describe('captured /try demo guides', () => {
  const SLUG_SHAPED = /^[a-z0-9]+(?:[-_][a-z0-9]+)+$/
  const guideFiles = [
    'compoundInterest',
    'deliberatePractice',
    'immuneResponse',
    'learningBottlenecks',
    'whyYouForget',
  ]

  const readGuide = (name: string) =>
    JSON.parse(
      readFileSync(
        resolve(process.cwd(), `src/demo/guides/${name}.data.json`),
        'utf8',
      ),
    ) as {
      studyPath: {
        title: string
        folderName: string
        dashboards: Array<{ name: string }>
      }
      bonusPages: Array<{ page: { name: string } }>
    }

  it.each(guideFiles)(
    '%s ships a human guide title, not the model slug',
    (name) => {
      const { studyPath } = readGuide(name)

      expect(studyPath.title).not.toMatch(SLUG_SHAPED)
      expect(studyPath.folderName).not.toMatch(SLUG_SHAPED)
      expect(humanizeGuideTitle(studyPath.title)).toBe(studyPath.title)
    },
  )

  it.each(guideFiles)('%s page names read the way the app renders', (name) => {
    const guide = readGuide(name)
    const pageNames = [
      ...guide.studyPath.dashboards.map((page) => page.name),
      ...guide.bonusPages.map((bonus) => bonus.page.name),
    ]

    expect(pageNames).toHaveLength(6)
    pageNames.forEach((pageName) => {
      expect(pageName).not.toMatch(SLUG_SHAPED)
      // The derived Quick Create names are "<label>: <guide title>", so a page
      // name must never carry the slug form of the title either.
      expect(pageName).not.toContain(
        guide.studyPath.title.toLowerCase().replace(/\s+/g, '-'),
      )
    })
  })
})
