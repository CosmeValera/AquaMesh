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

test.describe('Widget Editor', () => {
  test('should open the widget editor', async ({ page }) => {
    // Click on Widgets in the top navigation bar
    await page.getByLabel('WIDGETS').click()
    
    // Open the widget editor
    await page.getByText('Widget Editor', { exact: true }).click()
    
    // Verify that the editor is open
    await expect(page.getByText('Components')).toBeVisible()
    await expect(page.getByText('Canvas')).toBeVisible()
    
    // Take a screenshot
    await expect(page.screenshot()).toMatchSnapshot('widget-editor-open.png')
  })
  
  test('should add components to the editor canvas', async ({ page }) => {
    // Open the widget editor
    await page.getByLabel('WIDGETS').click()
    await page.getByText('Widget Editor', { exact: true }).click()
    
    // Drag a text field component to the canvas
    const textField = page.locator('div:has-text("Text Field")').first()
    const canvas = page.locator('.editor-canvas')
    
    // Get the bounding boxes
    const textFieldBox = await textField.boundingBox()
    const canvasBox = await canvas.boundingBox()
    
    if (textFieldBox && canvasBox) {
      // Perform the drag operation
      await page.mouse.move(
        textFieldBox.x + textFieldBox.width / 2,
        textFieldBox.y + textFieldBox.height / 2
      )
      await page.mouse.down()
      await page.mouse.move(
        canvasBox.x + canvasBox.width / 2,
        canvasBox.y + canvasBox.height / 2
      )
      await page.mouse.up()
      
      // Verify component is on the canvas
      await expect(page.locator('.editor-canvas .text-field-component')).toBeVisible()
    }
    
    // Add a button component as well
    const button = page.locator('div:has-text("Button")').first()
    const buttonBox = await button.boundingBox()
    
    if (buttonBox && canvasBox) {
      // Perform the drag operation
      await page.mouse.move(
        buttonBox.x + buttonBox.width / 2,
        buttonBox.y + buttonBox.height / 2
      )
      await page.mouse.down()
      await page.mouse.move(
        canvasBox.x + canvasBox.width / 2,
        canvasBox.y + canvasBox.height / 2 + 100 // Position below the text field
      )
      await page.mouse.up()
      
      // Verify button is on the canvas
      await expect(page.locator('.editor-canvas .button-component')).toBeVisible()
    }
    
    // Take a screenshot of the canvas with components
    await expect(page.screenshot()).toMatchSnapshot('widget-editor-with-components.png')
  })
  
  test('should toggle preview mode', async ({ page }) => {
    // Open the widget editor and add components
    await page.getByLabel('WIDGETS').click()
    await page.getByText('Widget Editor', { exact: true }).click()
    
    // Add a text field to the canvas (simplified)
    const textField = page.locator('div:has-text("Text Field")').first()
    const canvas = page.locator('.editor-canvas')
    
    const textFieldBox = await textField.boundingBox()
    const canvasBox = await canvas.boundingBox()
    
    if (textFieldBox && canvasBox) {
      await page.mouse.move(
        textFieldBox.x + textFieldBox.width / 2,
        textFieldBox.y + textFieldBox.height / 2
      )
      await page.mouse.down()
      await page.mouse.move(
        canvasBox.x + canvasBox.width / 2,
        canvasBox.y + canvasBox.height / 2
      )
      await page.mouse.up()
    }
    
    // Toggle to preview mode
    await page.getByText('Preview').click()
    
    // Verify we're in preview mode (edit controls should be hidden)
    await expect(page.locator('.editor-toolbar')).not.toBeVisible()
    
    // Take a screenshot of preview mode
    await expect(page.screenshot()).toMatchSnapshot('widget-editor-preview-mode.png')
    
    // Toggle back to edit mode
    await page.getByText('Edit').click()
    
    // Verify we're back in edit mode
    await expect(page.locator('.editor-toolbar')).toBeVisible()
  })
  
  test('should save and load a widget', async ({ page }) => {
    // Open the widget editor
    await page.getByLabel('WIDGETS').click()
    await page.getByText('Widget Editor', { exact: true }).click()
    
    // Add a component to the canvas (simplified)
    const button = page.locator('div:has-text("Button")').first()
    const canvas = page.locator('.editor-canvas')
    
    const buttonBox = await button.boundingBox()
    const canvasBox = await canvas.boundingBox()
    
    if (buttonBox && canvasBox) {
      await page.mouse.move(
        buttonBox.x + buttonBox.width / 2,
        buttonBox.y + buttonBox.height / 2
      )
      await page.mouse.down()
      await page.mouse.move(
        canvasBox.x + canvasBox.width / 2,
        canvasBox.y + canvasBox.height / 2
      )
      await page.mouse.up()
    }
    
    // Click Save button
    await page.getByText('Save', { exact: true }).click()
    
    // Fill in widget name in the save dialog
    const testWidgetName = 'Test Widget ' + new Date().getTime()
    await page.fill('input[name="widgetName"]', testWidgetName)
    await page.getByText('Save Widget').click()
    
    // Verify success message
    await expect(page.getByText('Widget saved successfully')).toBeVisible()
    
    // Take a screenshot after saving
    await expect(page.screenshot()).toMatchSnapshot('widget-saved.png')
    
    // Now try to open the saved widget
    await page.getByText('Open').click()
    
    // Find and click our newly created widget
    await page.getByText(testWidgetName).click()
    
    // Verify the widget is loaded
    await expect(page.locator('.editor-canvas .button-component')).toBeVisible()
    
    // Take a screenshot of the loaded widget
    await expect(page.screenshot()).toMatchSnapshot('widget-loaded.png')
    
    // Clean up by deleting the test widget
    await page.getByText('Open').click()
    await page.locator(`text="${testWidgetName}"`).hover()
    await page.getByText('Delete').click()
    await page.getByText('Confirm').click()
  })
}) 