import { test, expect } from '@playwright/test'
import { loginAs, dismissActiveDialog } from './helpers'

test.beforeEach(async ({ page }) => {
  // Login as admin for all advanced features tests
  await loginAs(page, 'admin')
  
  // Set consistent viewport size
  await page.setViewportSize({ width: 1280, height: 720 })
  
  // Make sure no dialogs are active
  await dismissActiveDialog(page)
})

test.describe('Widget Editor Advanced Features', () => {
  // Helper function to open the widget editor
  async function openWidgetEditor(page) {
    // Dismiss any dialogs before interacting
    await dismissActiveDialog(page)
    
    // Click directly on the Widget Editor button using role selector
    await page.getByRole('button', { name: 'Widget Editor' }).click()
    
    // Verify that the editor is open using a more specific selector for Components heading
    await page.waitForTimeout(1500)
    await expect(page.getByRole('heading', { name: 'Components' })).toBeVisible({ timeout: 5000 })
    await page.waitForTimeout(500)
  }

  // Helper function to open the advanced features menu
  async function openAdvancedMenu(page) {
    // Click on the More Vert icon button for advanced features
    const advancedButton = page.getByRole('button', { name: 'Advanced features' })
    await expect(advancedButton).toBeVisible({ timeout: 5000 })
    await advancedButton.click()
    
    // Wait for the menu to appear
    await page.waitForTimeout(500)
  }

  test('should open the Templates dialog', async ({ page }) => {
    // Open widget editor
    await openWidgetEditor(page)
    
    // Open advanced features menu
    await openAdvancedMenu(page)
    
    // Click on Templates option
    const templatesOption = page.getByRole('menuitem', { name: 'Templates' })
    await expect(templatesOption).toBeVisible({ timeout: 5000 })
    await templatesOption.click()
    
    // Wait for Templates dialog to appear
    await page.waitForTimeout(1000)
    
    // Verify that the dialog is open
    const templateDialog = page.getByRole('dialog').filter({ has: page.getByText('Templates') })
    await expect(templateDialog).toBeVisible({ timeout: 5000 })
    
    // Find the "Basic Form Template" card and click its "Use Template" button
    // First find the heading for the template
    const basicFormTemplateHeading = page.getByRole('heading', { name: 'Basic Form Template' })
    await expect(basicFormTemplateHeading).toBeVisible({ timeout: 5000 })
    
    // Then find the "Use Template" button within the same card as this heading
    // We need to find the parent card first, then the button within it
    const parentCard = basicFormTemplateHeading.locator('xpath=ancestor::div[contains(@class, "MuiCard-root")]')
    const useTemplateButton = parentCard.getByRole('button', { name: 'Use Template' })
    
    // Click the Use Template button
    await expect(useTemplateButton).toBeVisible({ timeout: 5000 })
    await useTemplateButton.click()
    
    // Wait for template to be applied
    await page.waitForTimeout(1500)
    
    // Take screenshot
    const screenshot = await page.screenshot()
    await expect(screenshot).toMatchSnapshot('widget-editor-templates-dialog.png')
  })

  test('should open the Export/Import Widgets dialog', async ({ page }) => {
    // Open widget editor
    await openWidgetEditor(page)
    
    // Open advanced features menu
    await openAdvancedMenu(page)
    
    // Click on Export/Import Widgets option
    const exportImportOption = page.getByRole('menuitem', { name: 'Export/Import Widgets' })
    await expect(exportImportOption).toBeVisible({ timeout: 5000 })
    await exportImportOption.click()
    
    // Wait for Export/Import dialog to appear
    await page.waitForTimeout(1000)
    
    // Verify that the dialog is open (looking for Export/Import in the title)
    const exportImportDialog = page.getByRole('dialog').filter({ has: page.getByText(/Export|Import/) })
    await expect(exportImportDialog).toBeVisible({ timeout: 5000 })
    
    // Take screenshot
    const screenshot = await page.screenshot()
    await expect(screenshot).toMatchSnapshot('widget-editor-export-import-dialog.png')
  })

  test('should open the Version History dialog', async ({ page }) => {
    // Open widget editor
    await openWidgetEditor(page)
    
    // Before taking screenshot, we need to save a widget

    // Wait for editor to fully load
    await page.waitForTimeout(400)
    
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
    
    // Wait before saving
    await page.waitForTimeout(500)

    // Find and fill the widget name input using the test ID
    const widgetNameInput = page.getByTestId('widget-name-input')
    await expect(widgetNameInput).toBeVisible({ timeout: 5000 })
    
    // Clear and set a new widget name
    await widgetNameInput.click()
    await widgetNameInput.pressSequentially('My Custom Widget')
    
    // Wait before saving
    await page.waitForTimeout(500)
    
    // Click on the Save button
    await page.getByRole('button', { name: 'Save Widget' }).click()
    
    // Wait before taking screenshot
    await page.waitForTimeout(500)

    
    // Wait for Version History dialog to appear
    await page.waitForTimeout(1000)
    
    // Open advanced features menu
    await openAdvancedMenu(page)
    
    // Click on Version History option
    const versionHistoryOption = page.getByRole('menuitem', { name: 'Version History' })
    await expect(versionHistoryOption).toBeVisible({ timeout: 5000 })
    await versionHistoryOption.click()
    
    // Verify that the dialog is open
    const versionHistoryDialog = page.getByRole('dialog').filter({ has: page.getByText('Version History') })
    await expect(versionHistoryDialog).toBeVisible({ timeout: 5000 })
    
    // Wait for dialog to load
    await page.waitForTimeout(1200)

    // Take screenshot
    const screenshot = await page.screenshot()
    await expect(screenshot).toMatchSnapshot('widget-editor-version-history-dialog.png')
  })
}) 