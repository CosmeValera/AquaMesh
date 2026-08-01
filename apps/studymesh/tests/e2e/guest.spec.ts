import { test, expect } from '@playwright/test'

// The guest trial renders its copy through the interface language layer, which
// follows the browser locale, so pin it for the copy assertions below.
test.use({ locale: 'en-US' })

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 })
})

test.describe('Guest Quick Guide trial', () => {
  test('should reach the guest trial from the landing CTA', async ({
    page,
  }) => {
    await page.goto('http://localhost:3000/')

    await page
      .getByRole('button', { name: /try it/i })
      .first()
      .click()

    await page.waitForURL('http://localhost:3000/try')

    await expect(
      page.getByRole('heading', { name: /try it without an account/i }),
    ).toBeVisible()
    await expect(
      page.getByRole('textbox', { name: /what do you want to learn/i }),
    ).toBeVisible()
  })

  test('should show the free allowance and no signed-in chrome', async ({
    page,
  }) => {
    await page.goto('http://localhost:3000/try')

    await expect(page.getByText(/3 of 3 free Quick Guides left/i)).toBeVisible()

    // Nothing is generated here: the button stays disabled until a visitor
    // types a prompt, so the run never spends a guest allowance in CI.
    await expect(
      page.getByRole('button', { name: /build my quick guide/i }),
    ).toBeDisabled()

    await expect(
      page.getByRole('button', { name: /open user menu/i }),
    ).toHaveCount(0)
    await expect(page.getByText(/carrot/i)).toHaveCount(0)
  })
})
