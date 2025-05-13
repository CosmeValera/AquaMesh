import { test, expect } from '@playwright/test'
import { loginAs, dismissActiveDialog } from './helpers'

test.beforeEach(async ({ page }) => {
  // Login as admin for all tests
  await loginAs(page, 'admin')
  
  // Set consistent viewport size
  await page.setViewportSize({ width: 1280, height: 720 })
  
  // Make sure no dialogs are active
  await dismissActiveDialog(page)
})

test('Load', async ({ page }) => {
  // Wait half second for content to load
  await page.waitForTimeout(500)
  
  // Take a screenshot of the loaded app - ensure we await the Promise
  const screenshot = await page.screenshot()
  await expect(screenshot).toMatchSnapshot('load.png')
})

test.describe('TopNavBar', () => {
  test('Dashboards', async({ page }) => {
    // Dismiss any dialogs before clicking
    await dismissActiveDialog(page)
    
    // Navigate to dashboards using role selector
    await page.getByRole('button', { name: 'Dashboards' }).click()

    // Wait for menu to appear
    await page.waitForSelector('[role="menu"]', { timeout: 5000 })
    
    // Select a predefined dashboard using role
    await page.getByRole('menuitem', { name: 'Control Flow Dashboard' }).click()

    // Wait for dashboard to load
    await page.waitForTimeout(1500)
    await page.waitForTimeout(50) // Extra wait for rendering
    const screenshot = await page.screenshot()
    await expect(screenshot).toMatchSnapshot('dashboards.png')
  })
    
  test('Widgets', async({ page }) => {
    // Dismiss any dialogs before clicking
    await dismissActiveDialog(page)
    
    // Navigate to widgets using role selector
    await page.getByRole('button', { name: 'Widgets' }).click()

    // Wait for menu to appear
    await page.waitForSelector('[role="menu"]', { timeout: 5000 })
    
    // Select a widget category using role
    await page.getByRole('menuitem', { name: 'System Lens' }).click()

    // Wait for widgets to load
    await page.waitForTimeout(1800)
    const screenshot = await page.screenshot()
    await expect(screenshot).toMatchSnapshot('widgets.png')
  })
})

test.describe('Widget Editor', () => {
  test('Widget Editor', async({ page }) => {
    // Dismiss any dialogs before clicking
    await dismissActiveDialog(page)
    
    // Click on the Widget Editor button using role selector
    await page.getByRole('button', { name: 'Widget Editor' }).click()
    
    // Wait for editor to load
    await page.waitForTimeout(1500)
    
    // Make sure the UI Components are visible
    await expect(page.getByText('UI Components', { exact: true })).toBeVisible({ timeout: 5000 })
    
    // Extra wait for rendering
    await page.waitForTimeout(50)
    const screenshot = await page.screenshot()
    await expect(screenshot).toMatchSnapshot('widgetEditor.png')
  })
})

test('Logout', async ({ page }) => {
  // Dismiss any dialogs before clicking
  await dismissActiveDialog(page)
  
  // Click on the user menu (avatar button) using a more specific selector
  await page.getByRole('button', { name: /Admin ADMIN_ROLE/ }).click()
  
  // Wait for dropdown and click logout using role
  await page.waitForSelector('[role="menu"]', { timeout: 5000 })
  await page.getByRole('menuitem', { name: 'Logout' }).click()

  // Wait for the login page to load
  await page.waitForURL(/http:\/\/localhost:3000\/.*/)

  // Wait for content to load
  await page.waitForTimeout(500)
  
  // Verify we're back at the login screen
  await expect(page.getByText('Please select a user to continue')).toBeVisible({ timeout: 5000 })

  await page.waitForTimeout(50) // Extra wait for rendering
  const screenshot = await page.screenshot()
  await expect(screenshot).toMatchSnapshot('logout.png')
})
