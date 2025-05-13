import { Page } from '@playwright/test'

/**
 * Helper function to dismiss any active dialog/modal
 */
export async function dismissActiveDialog(page: Page): Promise<boolean> {
  // Check if a dialog is visible
  const dialog = page.locator('.MuiDialog-root')
  if (await dialog.isVisible()) {

    // Wait for dialog to load
    await page.waitForTimeout(600)
    
    // Try to click outside the dialog to dismiss it
    // Click on a corner of the page, away from the dialog
    await page.mouse.click(10, 10)

    // Wait for dialog to disappear
    await page.waitForTimeout(400)
    return true
  }
  return false
}

/**
 * Helper function to login with a specific user role
 */
export async function loginAs(page: Page, role: 'admin' | 'operator' | 'viewer') {
  await page.goto('http://localhost:3000/login')

  // Wait for login page to load
  await page.getByText('Please select a user to continue').waitFor()
  
  // Click the MUI dropdown (not a regular select element)
  await page.getByRole('combobox').click()
  
  // Select the appropriate user role from dropdown
  if (role === 'admin') {
    await page.getByText('Admin (ADMIN_ROLE)').click()
  } else if (role === 'operator') {
    await page.getByText('Operator (OPERATOR_ROLE)').click()
  } else if (role === 'viewer') {
    await page.getByText('Viewer (VIEWER_ROLE)').click()
  }
  
  // Click the login button
  await page.getByRole('button', { name: 'Login' }).click()

  // Wait for main page to load
  await page.waitForURL('http://localhost:3000/')
  await page.waitForSelector('.loader', { state: 'hidden' })
  
  // Dismiss any welcome/tutorial dialog that might appear
  await page.waitForTimeout(1500)
  await dismissActiveDialog(page)
}

/**
 * Navigate to the Widgets menu
 */
export async function navigateToWidgets(page: Page) {
  // Set viewport to desktop size for consistent UI
  await page.setViewportSize({ width: 1280, height: 720 })
  
  // Make sure no dialogs are active
  await dismissActiveDialog(page)
  
  // Use data-tutorial-id attribute as shown in the DOM structure
  await page.locator('[data-tutorial-id="widgets-button"]').click()
}

/**
 * Navigate to the Dashboards menu
 */
export async function navigateToDashboards(page: Page) {
  // Set viewport to desktop size for consistent UI
  await page.setViewportSize({ width: 1280, height: 720 })
  
  // Make sure no dialogs are active
  await dismissActiveDialog(page)
  
  // Use data-tutorial-id attribute as shown in the DOM structure
  await page.locator('[data-tutorial-id="dashboards-button"]').click()
}

/**
 * Click the Add button (+ icon) to add a new dashboard
 */
export async function clickAddNew(page: Page) {
  // Set viewport to desktop size for consistent UI
  await page.setViewportSize({ width: 1280, height: 720 })
  
  // Make sure no dialogs are active
  await dismissActiveDialog(page)
  
  // Based on Dashboard.tsx line 306-337, there's a button with an AddIcon
  // Try a more direct approach to finding the button
  const plusButton = page.locator('button').filter({ has: page.locator('svg').filter({ hasText: '+' }) }).first()
  
  // Make the button visible by forcing it into view
  try {
    await plusButton.scrollIntoViewIfNeeded()
    await plusButton.click()
  } catch (_) { // Intentionally ignoring the error, just trying alternative approach
    // If that doesn't work, try a different approach - all buttons with startIcon
    const addButtons = page.locator('button .MuiButton-startIcon').all()
    const buttons = await addButtons
    if (buttons.length > 0) {
      await buttons[0].click()
    }
  }
} 