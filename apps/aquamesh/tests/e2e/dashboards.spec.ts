import { test, expect } from '@playwright/test'

test.beforeEach('login to application as admin', async ({ page }) => {
  await page.goto('http://localhost:3000/')
  
  // Wait for login page to load
  await page.getByText('Please select a user to continue').waitFor()
  
  // Click the MUI dropdown (not a regular select element)
  await page.getByRole('combobox').click()
  
  // Select Admin option from dropdown
  await page.getByText('Admin (ADMIN_ROLE)').click()
  
  // Click the login button
  await page.getByRole('button', { name: 'Login' }).click()
  
  await page.waitForURL('http://localhost:3000/')
  await page.waitForSelector('.loader', { state: 'hidden' })
})

test.describe('Dashboards', () => {
  test('should open predefined dashboards', async ({ page }) => {
    // Click on Dashboards in the top navigation bar
    await page.getByLabel('Dashboards').click()
    
    // Open a default dashboard view
    await page.getByText('Default views', { exact: true }).click()
    await page.getByText('System Overview', { exact: true }).click()
    
    // Wait for dashboard to load
    await page.waitForTimeout(1000)
    
    // Verify that the dashboard is open
    await expect(page.getByText('System Overview')).toBeVisible()
    
    // Take a screenshot
    await expect(page.screenshot()).toMatchSnapshot('dashboard-system-overview.png')
  })
  
  test('should create a new dashboard', async ({ page }) => {
    // Click on ADD NEW button
    await page.getByText('ADD NEW').click()
    
    // Click on "Dashboard" menu item
    await page.getByText('Dashboard').click()
    
    // Wait for the dashboard to be created
    await page.waitForTimeout(500)
    
    // Verify a new tab is created
    await expect(page.getByText('Dashboard')).toBeVisible()
    
    // Take a screenshot of the new dashboard
    await expect(page.screenshot()).toMatchSnapshot('new-dashboard-created.png')
  })
  
  test('should add a widget to dashboard', async ({ page }) => {
    // Create a new dashboard
    await page.getByText('ADD NEW').click()
    await page.getByText('Dashboard').click()
    await page.waitForTimeout(500)
    
    // Open widgets from top nav
    await page.getByLabel('WIDGETS').click()
    
    // Select a category and a widget
    await page.getByText('System lens', { exact: true }).click()
    await page.getByText('CPU Usage', { exact: true }).click()
    
    // Wait for widget to be added to dashboard
    await page.waitForTimeout(1000)
    
    // Verify the widget is added
    await expect(page.getByText('CPU Usage')).toBeVisible()
    
    // Take a screenshot
    await expect(page.screenshot()).toMatchSnapshot('dashboard-with-widget.png')
  })
  
  test('should save and load a custom dashboard', async ({ page }) => {
    // Create a new dashboard
    await page.getByText('ADD NEW').click()
    await page.getByText('Dashboard').click()
    await page.waitForTimeout(500)
    
    // Add a widget to the dashboard
    await page.getByLabel('WIDGETS').click()
    await page.getByText('System lens', { exact: true }).click()
    await page.getByText('Memory Usage', { exact: true }).click()
    await page.waitForTimeout(1000)
    
    // Open dashboard options menu
    const dashboardTab = page.getByText('Dashboard').first()
    await dashboardTab.hover()
    await page.getByRole('button', { name: 'Options' }).click()
    
    // Click Save Dashboard
    await page.getByText('Save Dashboard').click()
    
    // Fill in dashboard name and save
    const testDashboardName = 'Test Dashboard ' + new Date().getTime()
    await page.fill('input[name="dashboardName"]', testDashboardName)
    await page.getByText('Save').click()
    
    // Verify success message
    await expect(page.getByText('Dashboard saved successfully')).toBeVisible()
    
    // Take a screenshot after saving
    await expect(page.screenshot()).toMatchSnapshot('dashboard-saved.png')
    
    // Now try to load the saved dashboard
    // First close current dashboard
    await dashboardTab.hover()
    await page.getByRole('button', { name: 'Close' }).click()
    
    // Open dashboard from menu
    await page.getByLabel('Dashboards').click()
    await page.getByText('My Dashboards', { exact: true }).click()
    await page.getByText(testDashboardName).click()
    
    // Verify dashboard is loaded
    await expect(page.getByText('Memory Usage')).toBeVisible()
    
    // Take a screenshot of the loaded dashboard
    await expect(page.screenshot()).toMatchSnapshot('dashboard-loaded.png')
    
    // Clean up by deleting the test dashboard
    const loadedTab = page.getByText(testDashboardName).first()
    await loadedTab.hover()
    await page.getByRole('button', { name: 'Options' }).click()
    await page.getByText('Delete Dashboard').click()
    await page.getByText('Confirm').click()
  })
  
  test('should rearrange widgets in a dashboard', async ({ page }) => {
    // Create a new dashboard
    await page.getByText('ADD NEW').click()
    await page.getByText('Dashboard').click()
    await page.waitForTimeout(500)
    
    // Add two widgets to the dashboard
    await page.getByLabel('WIDGETS').click()
    await page.getByText('System lens', { exact: true }).click()
    await page.getByText('CPU Usage', { exact: true }).click()
    await page.waitForTimeout(1000)
    
    await page.getByLabel('WIDGETS').click()
    await page.getByText('System lens', { exact: true }).click()
    await page.getByText('Memory Usage', { exact: true }).click()
    await page.waitForTimeout(1000)
    
    // Take a screenshot before rearranging
    await expect(page.screenshot()).toMatchSnapshot('dashboard-before-rearrange.png')
    
    // Rearrange widgets by dragging
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
      await page.waitForTimeout(1000)
      
      // Take a screenshot after rearranging
      await expect(page.screenshot()).toMatchSnapshot('dashboard-after-rearrange.png')
    }
  })
}) 