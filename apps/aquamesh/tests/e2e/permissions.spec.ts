import { test, expect } from '@playwright/test'

// Helper function to login with a specific user role
async function loginAs(page, role) {
  await page.goto('http://localhost:3000/')

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
  } else {
    throw new Error(`Unknown role: ${role}`)
  }
  
  // Click the login button
  await page.getByRole('button', { name: 'Login' }).click()

  await page.waitForURL('http://localhost:3000/')
  await page.waitForSelector('.loader', { state: 'hidden' })
}

test.describe('User permission tests', () => {
  test('admin should have access to widget editor', async ({ page }) => {
    await loginAs(page, 'admin')
    
    // Navigate to widget editor
    await page.getByLabel('WIDGETS').click()
    await expect(page.getByText('Widget Editor', { exact: true })).toBeVisible()
    
    // Click on Widget Editor
    await page.getByText('Widget Editor', { exact: true }).click()
    
    // Verify editor is accessible
    await expect(page.getByText('Components')).toBeVisible()
    await expect(page.screenshot()).toMatchSnapshot('admin-widget-editor-access.png')
  })
  
  test('non-admin users should not have access to widget editor', async ({ page }) => {
    // Test with operator role
    await loginAs(page, 'operator')
    
    // Check that Widgets dropdown exists
    await page.getByLabel('WIDGETS').click()
    
    // Widget Editor should not be visible in the dropdown
    await expect(page.getByText('Widget Editor', { exact: true })).not.toBeVisible()
    await expect(page.screenshot()).toMatchSnapshot('operator-no-widget-editor.png')
    
    // Logout
    await page.getByRole('button', { name: 'LOGOUT' }).click()
    await page.waitForURL(/http:\/\/localhost:3000\/.*/)
    
    // Test with viewer role
    await loginAs(page, 'viewer')
    
    // Check that Widgets dropdown exists
    await page.getByLabel('WIDGETS').click()
    
    // Widget Editor should not be visible for viewers either
    await expect(page.getByText('Widget Editor', { exact: true })).not.toBeVisible()
    await expect(page.screenshot()).toMatchSnapshot('viewer-no-widget-editor.png')
  })
  
  test('admin should have access to save dashboards', async ({ page }) => {
    await loginAs(page, 'admin')
    
    // Create a new dashboard
    await page.getByText('ADD NEW').click()
    await page.getByText('Dashboard').click()
    await page.waitForTimeout(500)
    
    // Open dashboard options menu
    const dashboardTab = page.getByText('Dashboard').first()
    await dashboardTab.hover()
    await page.getByRole('button', { name: 'Options' }).click()
    
    // Check that Save Dashboard option is available
    await expect(page.getByText('Save Dashboard')).toBeVisible()
    await expect(page.screenshot()).toMatchSnapshot('admin-dashboard-save-access.png')
  })
  
  test('non-admin users should not have access to save dashboards', async ({ page }) => {
    await loginAs(page, 'operator')
    
    // Create a new dashboard
    await page.getByText('ADD NEW').click()
    await page.getByText('Dashboard').click()
    await page.waitForTimeout(500)
    
    // Open dashboard options menu
    const dashboardTab = page.getByText('Dashboard').first()
    await dashboardTab.hover()
    await page.getByRole('button', { name: 'Options' }).click()
    
    // Check that Save Dashboard option is not available
    await expect(page.getByText('Save Dashboard')).not.toBeVisible()
    await expect(page.screenshot()).toMatchSnapshot('operator-no-dashboard-save.png')
  })
}) 