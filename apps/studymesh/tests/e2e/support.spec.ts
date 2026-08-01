import { test, expect } from '@playwright/test'

// The guest trial renders its copy through the interface language layer, which
// follows the browser locale, so pin it for the /try assertions below.
test.use({ locale: 'en-US' })

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.goto('http://localhost:3000/')
})

test.describe('Landing tutorial page', () => {
  test('should show the RabbitHole landing hero', async ({ page }) => {
    await expect(
      page.getByRole('heading', {
        name: /something i already get/i,
      }),
    ).toBeVisible()
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

  test('should send guests to the free trial from the landing CTA', async ({
    page,
  }) => {
    await page
      .getByRole('button', { name: /try it/i })
      .first()
      .click()

    await page.waitForURL('http://localhost:3000/try')

    // Stops at the prompt surface on purpose: typing and submitting here would
    // burn a real guest allowance and a real hosted generation.
    await expect(
      page.getByRole('textbox', { name: /what do you want to learn/i }),
    ).toBeVisible()
  })
})
