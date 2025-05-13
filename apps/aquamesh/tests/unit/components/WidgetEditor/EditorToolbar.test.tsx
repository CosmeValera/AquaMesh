import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import EditorToolbar from '../../../../src/components/WidgetEditor/components/core/EditorToolbar'
import { ThemeProvider, createTheme } from '@mui/material'

// Mock VersionWarningDialog component
vi.mock('../../../../src/components/WidgetEditor/components/dialogs/VersionWarningDialog', () => ({
  __esModule: true,
  default: ({ open, onConfirm, onCancel }) => (
    <div data-testid="version-warning-dialog" data-open={open}>
      <button onClick={onConfirm} data-testid="confirm-button">Confirm</button>
      <button onClick={onCancel} data-testid="cancel-button">Cancel</button>
    </div>
  )
}))

// Create a dark theme for testing
const darkTheme = createTheme({
  palette: {
    mode: 'dark',
  }
})

describe('EditorToolbar Component', () => {
  // Define mock props and handler functions
  const mockProps = {
    editMode: true,
    showSidebar: false,
    toggleSidebar: vi.fn(),
    toggleEditMode: vi.fn(),
    handleSaveWidget: vi.fn(),
    setShowWidgetList: vi.fn(),
    setShowSettingsModal: vi.fn(),
    isUpdating: false,
    handleUndo: vi.fn(),
    handleRedo: vi.fn(),
    canUndo: false,
    canRedo: false,
    hasChanges: true,
    isEmpty: false,
    showTemplateDialog: false,
    setShowTemplateDialog: vi.fn(),
    showExportImportDialog: false,
    setShowExportImportDialog: vi.fn(),
    handleOpenVersioningDialog: vi.fn(),
    handleOpenSearchDialog: vi.fn(),
    widgetHasComponents: true,
    isLatestVersion: true,
    currentWidgetVersion: '1.0',
    showAdvancedInToolbar: false
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders correctly with all toolbar buttons', () => {
    render(
      <ThemeProvider theme={darkTheme}>
        <EditorToolbar {...mockProps} />
      </ThemeProvider>
    )
    
    // Verify basic elements are rendered
    expect(screen.getByText('Widget Editor')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /toggle edit\/preview mode/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /open saved widget/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /editor settings/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /advanced features/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /save widget/i })).toBeInTheDocument()
    
    // Check that undo/redo buttons are present and disabled
    const undoButton = screen.getByRole('button', { name: /undo/i })
    const redoButton = screen.getByRole('button', { name: /redo/i })
    expect(undoButton).toBeInTheDocument()
    expect(redoButton).toBeInTheDocument()
    expect(undoButton).toBeDisabled()
    expect(redoButton).toBeDisabled()
  })

  it('enables undo/redo buttons when canUndo/canRedo are true', () => {
    render(
      <ThemeProvider theme={darkTheme}>
        <EditorToolbar {...mockProps} canUndo={true} canRedo={true} />
      </ThemeProvider>
    )
    
    const undoButton = screen.getByRole('button', { name: /undo/i })
    const redoButton = screen.getByRole('button', { name: /redo/i })
    
    expect(undoButton).not.toBeDisabled()
    expect(redoButton).not.toBeDisabled()
  })

  it('calls toggleSidebar when sidebar button is clicked', () => {
    render(
      <ThemeProvider theme={darkTheme}>
        <EditorToolbar {...mockProps} />
      </ThemeProvider>
    )
    
    const sidebarButton = screen.getByRole('button', { name: /menu/i })
    fireEvent.click(sidebarButton)
    
    expect(mockProps.toggleSidebar).toHaveBeenCalledTimes(1)
  })

  it('calls toggleEditMode when edit/preview button is clicked', () => {
    render(
      <ThemeProvider theme={darkTheme}>
        <EditorToolbar {...mockProps} />
      </ThemeProvider>
    )
    
    const editModeButton = screen.getByRole('button', { name: /toggle edit\/preview mode/i })
    fireEvent.click(editModeButton)
    
    expect(mockProps.toggleEditMode).toHaveBeenCalledTimes(1)
  })

  it('calls handleSaveWidget when save button is clicked', () => {
    render(
      <ThemeProvider theme={darkTheme}>
        <EditorToolbar {...mockProps} />
      </ThemeProvider>
    )
    
    const saveButton = screen.getByRole('button', { name: /save widget/i })
    fireEvent.click(saveButton)
    
    expect(mockProps.handleSaveWidget).toHaveBeenCalledWith(false)
  })

  it('shows version warning when saving on non-latest version', async () => {
    render(
      <ThemeProvider theme={darkTheme}>
        <EditorToolbar {...mockProps} isLatestVersion={false} isUpdating={true} />
      </ThemeProvider>
    )
    
    const saveButton = screen.getByRole('button', { name: /update widget/i })
    fireEvent.click(saveButton)
    
    // Check if warning dialog is shown
    await waitFor(() => {
      const warningDialog = screen.getByTestId('version-warning-dialog')
      expect(warningDialog).toBeInTheDocument()
      expect(warningDialog.getAttribute('data-open')).toBe('true')
    })
    
    // Test confirm button
    fireEvent.click(screen.getByTestId('confirm-button'))
    expect(mockProps.handleSaveWidget).toHaveBeenCalledWith(false)
    
    // Reset mocks
    vi.clearAllMocks()
    
    // Test cancel button (need to re-render because state is reset)
    render(
      <ThemeProvider theme={darkTheme}>
        <EditorToolbar {...mockProps} isLatestVersion={false} isUpdating={true} />
      </ThemeProvider>
    )
    
    fireEvent.click(screen.getByRole('button', { name: /update widget/i }))
    await waitFor(() => {
      fireEvent.click(screen.getByTestId('cancel-button'))
    })
    
    expect(mockProps.handleSaveWidget).not.toHaveBeenCalled()
  })

  it('opens widget list when folder button is clicked', () => {
    render(
      <ThemeProvider theme={darkTheme}>
        <EditorToolbar {...mockProps} />
      </ThemeProvider>
    )
    
    const folderButton = screen.getByRole('button', { name: /open saved widget/i })
    fireEvent.click(folderButton)
    
    expect(mockProps.setShowWidgetList).toHaveBeenCalledWith(true)
  })

  it('opens settings modal when settings button is clicked', () => {
    render(
      <ThemeProvider theme={darkTheme}>
        <EditorToolbar {...mockProps} />
      </ThemeProvider>
    )
    
    const settingsButton = screen.getByRole('button', { name: /editor settings/i })
    fireEvent.click(settingsButton)
    
    expect(mockProps.setShowSettingsModal).toHaveBeenCalledWith(true)
  })

  it('calls undo and redo functions when respective buttons are clicked', () => {
    render(
      <ThemeProvider theme={darkTheme}>
        <EditorToolbar {...mockProps} canUndo={true} canRedo={true} />
      </ThemeProvider>
    )
    
    const undoButton = screen.getByRole('button', { name: /undo/i })
    const redoButton = screen.getByRole('button', { name: /redo/i })
    
    fireEvent.click(undoButton)
    expect(mockProps.handleUndo).toHaveBeenCalledTimes(1)
    
    fireEvent.click(redoButton)
    expect(mockProps.handleRedo).toHaveBeenCalledTimes(1)
  })

  it('opens advanced features menu when more button is clicked', async () => {
    render(
      <ThemeProvider theme={darkTheme}>
        <EditorToolbar {...mockProps} />
      </ThemeProvider>
    )
    
    const moreButton = screen.getByRole('button', { name: /advanced features/i })
    fireEvent.click(moreButton)
    
    // Wait for menu to appear
    await waitFor(() => {
      expect(screen.getByText('Templates')).toBeInTheDocument()
      expect(screen.getByText('Export/Import Widgets')).toBeInTheDocument()
      expect(screen.getByText('Version History')).toBeInTheDocument()
    })
  })
  
  it('handles template dialog correctly', async () => {
    render(
      <ThemeProvider theme={darkTheme}>
        <EditorToolbar {...mockProps} />
      </ThemeProvider>
    )
    
    // Open advanced menu
    fireEvent.click(screen.getByRole('button', { name: /advanced features/i }))
    
    // Click on Templates option
    await waitFor(() => {
      fireEvent.click(screen.getByText('Templates'))
    })
    
    expect(mockProps.setShowTemplateDialog).toHaveBeenCalledWith(true)
  })
  
  it('handles export/import dialog correctly', async () => {
    render(
      <ThemeProvider theme={darkTheme}>
        <EditorToolbar {...mockProps} />
      </ThemeProvider>
    )
    
    // Open advanced menu
    fireEvent.click(screen.getByRole('button', { name: /advanced features/i }))
    
    // Click on Export/Import option
    await waitFor(() => {
      fireEvent.click(screen.getByText('Export/Import Widgets'))
    })
    
    expect(mockProps.setShowExportImportDialog).toHaveBeenCalledWith(true)
  })
  
  it('handles version history dialog correctly', async () => {
    render(
      <ThemeProvider theme={darkTheme}>
        <EditorToolbar {...mockProps} />
      </ThemeProvider>
    )
    
    // Open advanced menu
    fireEvent.click(screen.getByRole('button', { name: /advanced features/i }))
    
    // Click on Version History option
    await waitFor(() => {
      fireEvent.click(screen.getByText('Version History'))
    })
    
    expect(mockProps.handleOpenVersioningDialog).toHaveBeenCalledTimes(1)
  })
  
  it('disables save button when appropriate', () => {
    // Case 1: Not in edit mode
    render(
      <ThemeProvider theme={darkTheme}>
        <EditorToolbar {...mockProps} editMode={false} />
      </ThemeProvider>
    )
    
    expect(screen.getByRole('button', { name: /save widget/i })).toBeDisabled()
    
    // Case 2: No changes when updating
    render(
      <ThemeProvider theme={darkTheme}>
        <EditorToolbar {...mockProps} isUpdating={true} hasChanges={false} />
      </ThemeProvider>
    )
    
    expect(screen.getByRole('button', { name: /no changes/i })).toBeDisabled()
    
    // Case 3: Empty widget
    render(
      <ThemeProvider theme={darkTheme}>
        <EditorToolbar {...mockProps} isEmpty={true} />
      </ThemeProvider>
    )
    
    expect(screen.getByRole('button', { name: /empty widget/i })).toBeDisabled()
  })
  
  it('shows advanced features directly in toolbar when showAdvancedInToolbar is true', () => {
    render(
      <ThemeProvider theme={darkTheme}>
        <EditorToolbar 
          {...mockProps} 
          showAdvancedInToolbar={true} 
        />
      </ThemeProvider>
    )
    
    // Use queries to check if buttons are in the document without throwing errors
    const templateButton = screen.queryByRole('button', { name: /templates/i })
    const exportImportButton = screen.queryByRole('button', { name: /export\/import widgets/i })
    const versionHistoryButton = screen.queryByRole('button', { name: /version history/i })
    
    // In desktop view with showAdvancedInToolbar=true, these buttons should be visible
    expect(templateButton).not.toBeNull()
    expect(exportImportButton).not.toBeNull()
    expect(versionHistoryButton).not.toBeNull()
  })
}) 