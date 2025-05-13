import { test, expect } from '@playwright/test'
import { loginAs, dismissActiveDialog } from './helpers'

test.beforeEach(async ({ page }) => {
  // Login as admin for all library tests
  await loginAs(page, 'admin')
  
  // Set consistent viewport size
  await page.setViewportSize({ width: 1280, height: 720 })
  
  // Make sure no dialogs are active
  await dismissActiveDialog(page)
})

test.describe('Library Access Tests', () => {
  test('should open Dashboards Library from TopNavBar', async ({ page }) => {
    // Dismiss any dialogs before interacting
    await dismissActiveDialog(page)
    
    // Click on Dashboards menu
    const dashboardButton = page.locator('[data-tutorial-id="dashboards-button"]')
    await expect(dashboardButton).toBeVisible({ timeout: 5000 })
    await dashboardButton.click()
    
    // Wait for menu to appear
    await page.waitForTimeout(500)
    
    // Click on Manage Dashboards option
    const manageDashboardsOption = page.getByText('Manage Dashboards')
    await expect(manageDashboardsOption).toBeVisible({ timeout: 5000 })
    await manageDashboardsOption.click()
    
    // Wait for dialog to appear
    await page.waitForTimeout(1000)
    
    // Verify that the dialog is open
    const dashboardsDialog = page.getByRole('dialog').filter({ has: page.getByText('Dashboard Library') })
    await expect(dashboardsDialog).toBeVisible({ timeout: 5000 })
    
    // Take screenshot
    const screenshot = await page.screenshot()
    await expect(screenshot).toMatchSnapshot('dashboards-library.png')
  })
  
  test('should open Widgets Library from TopNavBar', async ({ page }) => {
    // Dismiss any dialogs before interacting
    await dismissActiveDialog(page)
    
    // Click on Widgets menu
    const widgetsButton = page.locator('[data-tutorial-id="widgets-button"]')
    await expect(widgetsButton).toBeVisible({ timeout: 5000 })
    await widgetsButton.click()
    
    // Wait for menu to appear
    await page.waitForTimeout(500)
    
    // Click on Manage Widgets option
    const manageWidgetsOption = page.getByText('Manage Widgets')
    await expect(manageWidgetsOption).toBeVisible({ timeout: 5000 })
    await manageWidgetsOption.click()
    
    // Wait for dialog to appear
    await page.waitForTimeout(1000)
    
    // Verify that the dialog is open
    const widgetsDialog = page.getByRole('dialog').filter({ has: page.getByText('Widget Library') })
    await expect(widgetsDialog).toBeVisible({ timeout: 5000 })
    
    // Take screenshot
    const screenshot = await page.screenshot()
    await expect(screenshot).toMatchSnapshot('widgets-library-topnav.png')
  })
  
  test('should open Widgets Library from Widget Editor', async ({ page }) => {
    // Dismiss any dialogs before interacting
    await dismissActiveDialog(page)
    
    // Click on Widget Editor button
    const widgetEditorButton = page.locator('[data-tutorial-id="create-widget-button"]')
    await expect(widgetEditorButton).toBeVisible({ timeout: 5000 })
    await widgetEditorButton.click()
    
    // Wait for editor to load
    await page.waitForTimeout(2000)
    await expect(page.getByRole('heading', { name: 'Components' })).toBeVisible({ timeout: 5000 })
    
    // Click on the "Open saved widgets" button in the editor toolbar
    const openSavedWidgetsButton = page.getByRole('button', { name: 'Open saved widget' })
    await expect(openSavedWidgetsButton).toBeVisible({ timeout: 5000 })
    await openSavedWidgetsButton.click()
    
    // Wait for dialog to appear
    await page.waitForTimeout(1000)
    
    // Verify that the dialog is open
    const widgetListDialog = page.getByRole('dialog').filter({ has: page.getByText('Widget Library') })
    await expect(widgetListDialog).toBeVisible({ timeout: 5000 })
    
    // Take screenshot
    const screenshot = await page.screenshot()
    await expect(screenshot).toMatchSnapshot('widgets-library-editor.png')
  })
}) 