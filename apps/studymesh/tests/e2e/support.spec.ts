import { test, expect } from '@playwright/test'

// The demo renders its copy through the interface language layer, which follows
// the browser locale, so pin it for the /try assertions below.
test.use({ locale: 'en-US' })

// Mirrors the chip labels of DEMO_GUIDES in src/demo/demoGuides.ts. Importing
// the registry here would make Playwright resolve the per-guide data chunks it
// lazily imports, so the two lists are kept in sync by hand.
const demoChipLabels = [
  'Why you forget',
  'Deliberate practice',
  'Bottlenecks in your learning',
  'Compound interest',
  'How your immune system works',
]

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.goto('http://localhost:3000/')
})

test.describe('Landing tutorial page', () => {
  test('should show the RabbitHole landing hero', async ({ page }) => {
    const hero = page.getByRole('heading', {
      name: /something i already get/i,
    })

    await expect(hero).toBeVisible()
    await expect(hero).toContainText(/explain it with/i)
    await expect(
      page.getByText(/Tell RabbitHole what you already know/i),
    ).toBeVisible()
    await expect(page.getByTestId('hero-differentiator')).toContainText(
      /a chat gives you an answer\. rabbithole gives you a guide/i,
    )
    await expect(page.getByText(/20 sec . Key idea/)).toBeVisible()
    await expect(page.getByText(/60 sec . Idea summary/)).toBeVisible()
    await expect(page.getByText(/5 pages . Full guide/)).toBeVisible()
  })

  test('should lead with the differentiation stages above the fold order', async ({
    page,
  }) => {
    await expect(
      page.getByRole('heading', { name: /you already have chatgpt/i }),
    ).toBeVisible()

    for (const [label, hash] of [
      ['Why RabbitHole', '#why'],
      ['What you get', '#what'],
      ['How it works', '#how'],
      ['FAQ', '#faq'],
    ] as const) {
      await page.getByRole('link', { name: label, exact: true }).first().click()
      await expect(page).toHaveURL(new RegExp(`${hash}$`))
    }

    await expect(page.getByTestId('landing-study-outputs')).toContainText(
      /flashcards/i,
    )
    await expect(page.getByTestId('landing-how-it-works')).toContainText(
      /say what you already know/i,
    )
    await expect(page.getByTestId('landing-access')).toContainText(
      /no rabbithole subscription|free account/i,
    )
    await expect(page.getByTestId('landing-faq')).toContainText(
      /what is actually different here/i,
    )
  })

  test('should send visitors to the prepared demo from the landing CTA', async ({
    page,
  }) => {
    await page
      .getByRole('button', { name: /try it/i })
      .first()
      .click()

    await page.waitForURL('http://localhost:3000/try')

    // The prompt is locked on purpose: the demo runs on five prepared prompts,
    // so a visitor picks a topic instead of writing one, and the prompt shows
    // as a read-only panel. Opening a guide from here is demo.spec.ts's job.
    const promptPanel = page.getByRole('button', {
      name: /why is this prompt locked/i,
    })
    await expect(promptPanel).toBeVisible()
    await expect(promptPanel).toContainText(/pick a topic above/i)

    for (const label of demoChipLabels) {
      await expect(
        page.getByRole('button', { name: label, exact: true }),
      ).toBeVisible()
    }
  })
})
