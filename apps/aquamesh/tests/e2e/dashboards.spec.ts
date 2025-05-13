import { test, expect } from '@playwright/test'
import { loginAs, navigateToDashboards, navigateToWidgets, dismissActiveDialog } from './helpers'

test.beforeEach(async ({ page }) => {
  // Login as admin for all dashboard tests
  await loginAs(page, 'admin')
  
  // Set consistent viewport size
  await page.setViewportSize({ width: 1280, height: 720 })
  
  // Make sure no dialogs are active
  await dismissActiveDialog(page)
})

test.describe('Dashboards', () => {
  test('should open predefined dashboards', async ({ page }) => {
    // Dismiss any active dialog
    await dismissActiveDialog(page)
    
    // Navigate to dashboards
    await navigateToDashboards(page)
    
    // Wait for menu to appear
    await page.waitForSelector('[role="menu"]', { timeout: 5000 })
    
    // Based on the screenshot, directly click on a predefined dashboard option
    await page.getByText('System Lens Dashboard').click()
    
    // Wait for dashboard to load
    await page.waitForTimeout(1500)
    
    // Verify that the dashboard is open
    await expect(page.getByText('System Lens Dashboard')).toBeVisible()
    
    // Wait before taking screenshot to ensure everything is loaded
    await page.waitForTimeout(500)
    const screenshot = await page.screenshot()
    await expect(screenshot).toMatchSnapshot('dashboard-system-overview.png')
  })
  
  test('should create a new dashboard', async ({ page }) => {
    // Dismiss any active dialog
    await dismissActiveDialog(page)
    
    // Click on the + button to add a new dashboard using the data-testid
    await page.getByTestId('add-dashboard-button').click()
    
    // Wait for the dashboard to be created
    await page.waitForTimeout(1500)
    
    // Verify a new tab is created - using a more specific selector for the heading
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
    
    // Wait before taking screenshot
    await page.waitForTimeout(500)
    const screenshot = await page.screenshot()
    await expect(screenshot).toMatchSnapshot('new-dashboard-created.png')
  })
  
  test('should add a widget to dashboard', async ({ page }) => {
    // Create a new dashboard
    await dismissActiveDialog(page)
    
    // Click on the + button to add a new dashboard using the data-testid
    await page.getByTestId('add-dashboard-button').click()
    
    await page.waitForTimeout(1500)
    
    // Open widgets from top nav
    await dismissActiveDialog(page)
    await navigateToWidgets(page)
    
    // Wait for menu to appear
    await page.waitForSelector('[role="menu"]', { timeout: 5000 })
    
    // Based on the screenshot, click directly on a widget category
    await page.getByText('Control Flow').click()
    
    // Wait for widget to be added to dashboard
    await page.waitForTimeout(1500)
    
    // Verify some widget is added
    await expect(page.getByText('Control Flow')).toBeVisible()
    
    // Wait before taking screenshot
    await page.waitForTimeout(500)
    const screenshot = await page.screenshot()
    await expect(screenshot).toMatchSnapshot('dashboard-with-widget.png')
  })
  
  test('should rearrange widgets in a dashboard', async ({ page }) => {
    // Create a new dashboard
    await dismissActiveDialog(page)
    
    // Click on the + button to add a new dashboard using the data-testid
    await page.getByTestId('add-dashboard-button').click()
    
    await page.waitForTimeout(1500)
    
    // Add two widgets to the dashboard
    await dismissActiveDialog(page)
    await navigateToWidgets(page)
    
    // Wait for menu to appear
    await page.waitForSelector('[role="menu"]', { timeout: 5000 })
    
    // Add first widget - direct click on widget type
    await page.getByText('Control Flow').click()
    await page.waitForTimeout(1500)
    
    await dismissActiveDialog(page)
    await navigateToWidgets(page)
    
    // Wait for menu to appear
    await page.waitForSelector('[role="menu"]', { timeout: 5000 })
    
    // Add second widget
    await page.getByText('System Lens').click()
    await page.waitForTimeout(1500)
    
    // Take a screenshot before rearranging
    await page.waitForTimeout(500)
    const screenshotBefore = await page.screenshot()
    await expect(screenshotBefore).toMatchSnapshot('dashboard-before-rearrange.png')
    
    // Rearrange widgets by dragging - the actual classes may need to be verified
    const firstWidget = page.locator('.flexlayout__tab').first()
    const secondWidget = page.locator('.flexlayout__tab').nth(1)
    
    const firstWidgetBox = await firstWidget.boundingBox()
    const secondWidgetBox = await secondWidget.boundingBox()
    
    if (firstWidgetBox && secondWidgetBox) {
      // Drag the first widget to the right of the second widget
      await page.mouse.move(
        firstWidgetBox.x + 20,
        firstWidgetBox.y + 20
      )
      await page.mouse.down()
      await page.mouse.move(
        secondWidgetBox.x + secondWidgetBox.width + 50,
        secondWidgetBox.y + 20
      )
      await page.mouse.up()
      
      // Wait for the layout to update
      await page.waitForTimeout(1500)
      
      // Take a screenshot after rearranging
      const screenshotAfter = await page.screenshot()
      await expect(screenshotAfter).toMatchSnapshot('dashboard-after-rearrange.png')
    }
  })
}) 