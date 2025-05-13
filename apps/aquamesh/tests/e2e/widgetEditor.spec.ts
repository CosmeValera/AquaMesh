import { test, expect } from '@playwright/test'
import { loginAs, dismissActiveDialog } from './helpers'

test.beforeEach(async ({ page }) => {
  // Login as admin for all widget editor tests
  await loginAs(page, 'admin')
  
  // Set consistent viewport size
  await page.setViewportSize({ width: 1280, height: 720 })
  
  // Make sure no dialogs are active
  await dismissActiveDialog(page)
})

test.describe('Widget Editor', () => {
  test('should open the widget editor', async ({ page }) => {
    // Dismiss any dialogs before interacting
    await dismissActiveDialog(page)
    
    // Click directly on the Widget Editor button using role selector
    await page.getByRole('button', { name: 'Widget Editor' }).click()
    
    // Verify that the editor is open using a more specific selector for Components heading
    await page.waitForTimeout(1500)
    await expect(page.getByRole('heading', { name: 'Components' })).toBeVisible({ timeout: 5000 })
    
    // Wait before taking screenshot
    await page.waitForTimeout(500)
    const screenshot = await page.screenshot()
    await expect(screenshot).toMatchSnapshot('widget-editor-open.png')
  })
  
  test('should add components to the editor canvas', async ({ page }) => {
    // Dismiss any dialogs before interacting
    await dismissActiveDialog(page)
    
    // Open widget editor using role selector
    await page.getByRole('button', { name: 'Widget Editor' }).click()
    
    // Wait for editor to fully load
    await page.waitForTimeout(1000)
    
    // Find the Text Field component using more specific selectors
    // Target the draggable paper element containing "Text Field" text
    const textField = page.locator('.MuiPaper-root', { 
      has: page.getByText('Text Field', { exact: true }) 
    })
    
    // For canvas, look for element with text indicating it's the drop target
    const canvas = page.getByText('Drag and drop components here').first()
    
    // Get their bounding boxes
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
      
      // Allow time for the component to be placed
      await page.waitForTimeout(1000)
    }
    
    // Wait before taking screenshot
    await page.waitForTimeout(500)
    const screenshot = await page.screenshot()
    await expect(screenshot).toMatchSnapshot('widget-editor-with-components.png')
  })
  
  test('should toggle preview mode', async ({ page }) => {
    // Dismiss any dialogs before interacting
    await dismissActiveDialog(page)
    
    // Open widget editor using role selector
    await page.getByRole('button', { name: 'Widget Editor' }).click()
    
    // Wait for editor to fully load
    await page.waitForTimeout(1000)
    
    // First add a component to have something to preview
    // Find the Text Label component using specific selectors
    const textLabel = page.locator('.MuiPaper-root', { 
      has: page.getByText('Text Label', { exact: true }) 
    })
    
    // For canvas, look for element with text indicating it's the drop target
    const canvas = page.getByText('Drag and drop components here').first()
    
    // Get their bounding boxes
    const textLabelBox = await textLabel.boundingBox()
    const canvasBox = await canvas.boundingBox()
    
    if (textLabelBox && canvasBox) {
      // Perform the drag operation
      await page.mouse.move(
        textLabelBox.x + textLabelBox.width / 2,
        textLabelBox.y + textLabelBox.height / 2
      )
      await page.mouse.down()
      await page.mouse.move(
        canvasBox.x + canvasBox.width / 2,
        canvasBox.y + canvasBox.height / 2
      )
      await page.mouse.up()
      
      // Allow time for the component to be placed
      await page.waitForTimeout(1000)
    }
    
    // Find and click the preview button directly
    const previewButton = page.getByRole('button', { name: 'Preview' }).first()
    await expect(previewButton).toBeVisible({ timeout: 5000 })
    await previewButton.click()
    
    // Wait for preview mode to activate
    await page.waitForTimeout(1500)
    
    // Wait before taking screenshot
    await page.waitForTimeout(500)
    const screenshotPreview = await page.screenshot()
    await expect(screenshotPreview).toMatchSnapshot('widget-editor-preview-mode.png')
    
    // Return to edit mode
    const editButton = page.getByRole('button', { name: 'Edit' }).first()
    await expect(editButton).toBeVisible({ timeout: 5000 })
    await editButton.click()
    
    // Wait for edit mode to activate
    await page.waitForTimeout(1000)
  })
  
  test('should save and load a widget', async () => {
    // Skip this test per user instruction (can delete or skip)
    test.skip()
    
    /*
    // Implementation code removed as we're skipping this test
    */
  })
}) 