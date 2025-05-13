import { test, expect } from '@playwright/test'
import { loginAs, dismissActiveDialog } from './helpers'

test.describe('User permission tests', () => {
  test('admin should have access to widget editor', async ({ page }) => {
    await loginAs(page, 'admin')
    
    // Set consistent viewport size
    await page.setViewportSize({ width: 1280, height: 720 })
    
    // Dismiss any dialogs before interacting
    await dismissActiveDialog(page)
    
    // Click directly on the Widget Editor button in the nav using a more robust selector
    await page.getByRole('button', { name: 'Widget Editor' }).click()
    
    // Verify editor is accessible by waiting for it to load
    await page.waitForTimeout(500)
    
    // Look for a unique element in the widget editor - using a more specific selector for UI Components header
    await expect(page.getByText('UI Components', { exact: true })).toBeVisible({ timeout: 5000 })
    
    // Wait before taking screenshot
    await page.waitForTimeout(50)
    const screenshot = await page.screenshot()
    await expect(screenshot).toMatchSnapshot('admin-widget-editor-access.png')
  })
  
  test('non-admin users should not have access to widget editor', async ({ page }) => {
    // Test with operator role
    await loginAs(page, 'operator')
    
    // Set consistent viewport size
    await page.setViewportSize({ width: 1280, height: 720 })
    
    // Dismiss any dialogs before checking
    await dismissActiveDialog(page)
    
    // The Widget Editor button should not be visible for non-admin roles
    await expect(page.getByRole('button', { name: 'Widget Editor' })).not.toBeVisible()
    
    // Wait before taking screenshot
    await page.waitForTimeout(50)
    const screenshotOperator = await page.screenshot()
    await expect(screenshotOperator).toMatchSnapshot('operator-no-widget-editor.png')
    
    // Logout by clicking on profile button first then logout
    await dismissActiveDialog(page)
    await page.locator('.MuiAvatar-root').click()
    await page.waitForSelector('[role="menu"]', { timeout: 5000 })
    await page.getByRole('menuitem', { name: 'Logout' }).click()

    // Wait before login as viewer
    await page.waitForTimeout(1000)
    
    // Test with viewer role
    await loginAs(page, 'viewer')
    
    // Set consistent viewport size
    await page.setViewportSize({ width: 1280, height: 720 })

    // Wait before dismissing dialog
    await page.waitForTimeout(1000)
    
    // Dismiss any dialogs before interacting
    await dismissActiveDialog(page)
    
    // The Widget Editor button should not be visible for viewers either
    await expect(page.getByRole('button', { name: 'Widget Editor' })).not.toBeVisible()
    
    // Wait before taking screenshot
    await page.waitForTimeout(1500)

    const screenshotViewer = await page.screenshot()
    await expect(screenshotViewer).toMatchSnapshot('viewer-no-widget-editor.png')
  })
  
  test('admin should have access to save dashboards', async ({ page }) => {
    await loginAs(page, 'admin')
    
    // Set consistent viewport size
    await page.setViewportSize({ width: 1280, height: 720 })
    
    // Dismiss any dialogs before interacting
    await dismissActiveDialog(page)
    
    // Create a new dashboard using the data-testid
    await page.getByTestId('add-dashboard-button').click()
    
    await page.waitForTimeout(1000)
    
    // Add a widget to create unsaved changes
    await dismissActiveDialog(page)
    await page.getByRole('button', { name: 'Widgets' }).click()
    await page.waitForSelector('[role="menu"]', { timeout: 5000 })
    
    // Direct click on one of the widget categories
    await page.getByRole('menuitem', { name: 'Control Flow' }).click()
    
    await page.waitForTimeout(1000)
    
    // Check that the save icon appears (only admins can see this)
    const saveIcon = page.locator('button', { has: page.locator('svg[data-testid="SaveIcon"]') })
    await expect(saveIcon).toBeVisible({ timeout: 5000 })
    
    // Wait before taking screenshot
    await page.waitForTimeout(50)
    const screenshot = await page.screenshot()
    await expect(screenshot).toMatchSnapshot('admin-dashboard-save-access.png')
  })
}) 