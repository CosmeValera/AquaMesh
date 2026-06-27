import { test, expect } from '@playwright/test'
test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.goto('http://localhost:3000/')
})

test.describe('Landing tutorial page', () => {
  test('should show the StudyMesh landing hero', async ({ page }) => {
    await expect(
      page.getByRole('heading', {
        name: /study guides that grow with you/i,
      }),
    ).toBeVisible()
    await expect(
      page.getByText(
        /StudyMesh builds adaptive study guides by connecting new concepts/i,
      ),
    ).toBeVisible()
    await expect(page.getByText(/20 sec/)).toBeVisible()
    await expect(page.getByText(/60 sec/)).toBeVisible()
    await expect(page.getByText(/5 pages/)).toBeVisible()
  })

  test('should send guests to login from the landing CTA', async ({ page }) => {
    await page
      .getByRole('button', { name: /Create a Study Guide/i })
      .first()
      .click()

    await page.waitForURL(
      'http://localhost:3000/login?redirect=%2Fstudy-guides%3Fcreate%3D1',
    )
  })
})
