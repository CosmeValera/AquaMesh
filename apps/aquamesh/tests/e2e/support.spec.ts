import { test, expect } from '@playwright/test'
import { loginAs, dismissActiveDialog } from './helpers'

test.beforeEach(async ({ page }) => {
  // Login as admin for all help tests
  await loginAs(page, 'admin')
  
  // Set consistent viewport size
  await page.setViewportSize({ width: 1280, height: 720 })
  
  // Make sure no dialogs are active
  await dismissActiveDialog(page)
})

test.describe('Help Features', () => {
  test('should open the Tutorial modal', async ({ page }) => {
    // Dismiss any dialogs before interacting
    await dismissActiveDialog(page)
    
    // Find and click the Tutorial button in the top navbar
    // It has the ImportContactsIcon and a data-tutorial-id="help-button"
    const tutorialButton = page.locator('button[data-tutorial-id="help-button"]').first()
    await expect(tutorialButton).toBeVisible({ timeout: 5000 })
    await tutorialButton.click()
    
    // Wait for the tutorial modal to appear
    await page.waitForTimeout(1000)
    
    // Verify that the modal is open
    const tutorialModal = page.getByRole('dialog').filter({ has: page.getByText('Welcome to AquaMesh') })
    await expect(tutorialModal).toBeVisible({ timeout: 5000 })
    
    // Wait for the modal to fully render
    await page.waitForTimeout(1000)
    
    // Take screenshot
    const screenshot = await page.screenshot()
    await expect(screenshot).toMatchSnapshot('tutorial-modal.png')
  })
  
  test('should open the FAQ dialog', async ({ page }) => {
    // Dismiss any dialogs before interacting
    await dismissActiveDialog(page)
    
    // Find and click the FAQ button in the top navbar
    // It has the HelpOutlineIcon and a data-tutorial-id="faq-button"
    const faqButton = page.locator('button[data-tutorial-id="faq-button"]').first()
    await expect(faqButton).toBeVisible({ timeout: 5000 })
    await faqButton.click()
    
    // Wait for the FAQ dialog to appear
    await page.waitForTimeout(1000)
    
    // Verify that the dialog is open
    const faqDialog = page.getByRole('dialog').filter({ has: page.getByText('Frequently Asked Questions') })
    await expect(faqDialog).toBeVisible({ timeout: 5000 })
    
    // Wait for the dialog to fully render
    await page.waitForTimeout(1000)
    
    // Take screenshot
    const screenshot = await page.screenshot()
    await expect(screenshot).toMatchSnapshot('faq-dialog.png')
  })
}) 