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
    await expect(page.getByText(/20 sec/)).toBeVisible()
    await expect(page.getByText(/60 sec/)).toBeVisible()
    await expect(page.getByText(/5 pages/)).toBeVisible()
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
