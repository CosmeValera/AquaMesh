/// <reference types="@testing-library/jest-dom" />
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import EditorToolbar from '../../../../src/components/WidgetEditor/components/core/EditorToolbar'
import { ThemeProvider, createTheme } from '@mui/material'

// Mock matchMedia for desktop view: queries containing 'min-width' will match
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: query.includes('min-width'),
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock VersionWarningDialog component
vi.mock('../../../../src/components/WidgetEditor/components/dialogs/VersionWarningDialog', () => ({
  __esModule: true,
  default: ({ open, onConfirm, onCancel }) => (
    <div data-testid="version-warning-dialog" data-open={open ? 'true' : 'false'}>
      {open && (
        <>
          <button onClick={onConfirm} data-testid="confirm-button">Confirm</button>
          <button onClick={onCancel} data-testid="cancel-button">Cancel</button>
        </>
      )}
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
    expect(screen.getByLabelText('Toggle edit/preview mode')).toBeInTheDocument()
    expect(screen.getByLabelText('Open saved widget')).toBeInTheDocument()
    expect(screen.getByLabelText('Editor settings')).toBeInTheDocument()
    expect(screen.getByLabelText('Advanced features')).toBeInTheDocument()
    expect(screen.getByText('Save Widget')).toBeInTheDocument()
    
    // Check that undo/redo spans are present
    const undoSpan = screen.getByLabelText('Undo (Ctrl+Z)')
    const redoSpan = screen.getByLabelText('Redo (Ctrl+Y)')
    expect(undoSpan).toBeInTheDocument()
    expect(redoSpan).toBeInTheDocument()
    
    // Verify the buttons inside these spans are disabled
    const undoButton = within(undoSpan).getByRole('button')
    const redoButton = within(redoSpan).getByRole('button')
    expect(undoButton).toBeDisabled()
    expect(redoButton).toBeDisabled()
  })

  it('enables undo/redo buttons when canUndo/canRedo are true', () => {
    render(
      <ThemeProvider theme={darkTheme}>
        <EditorToolbar {...mockProps} canUndo={true} canRedo={true} />
      </ThemeProvider>
    )
    
    // Get the spans first then the buttons within them
    const undoSpan = screen.getByLabelText('Undo (Ctrl+Z)')
    const redoSpan = screen.getByLabelText('Redo (Ctrl+Y)')
    
    const undoButton = within(undoSpan).getByRole('button')
    const redoButton = within(redoSpan).getByRole('button')
    
    expect(undoButton).not.toBeDisabled()
    expect(redoButton).not.toBeDisabled()
  })

  it('calls toggleSidebar when sidebar button is clicked', () => {
    render(
      <ThemeProvider theme={darkTheme}>
        <EditorToolbar {...mockProps} />
      </ThemeProvider>
    )
    
    const sidebarButton = screen.getByLabelText('menu')
    fireEvent.click(sidebarButton)
    
    expect(mockProps.toggleSidebar).toHaveBeenCalledTimes(1)
  })

  it('calls toggleEditMode when edit/preview button is clicked', () => {
    render(
      <ThemeProvider theme={darkTheme}>
        <EditorToolbar {...mockProps} />
      </ThemeProvider>
    )
    
    const editModeButton = screen.getByLabelText('Toggle edit/preview mode')
    fireEvent.click(editModeButton)
    
    expect(mockProps.toggleEditMode).toHaveBeenCalledTimes(1)
  })

  it('calls handleSaveWidget when save button is clicked', () => {
    render(
      <ThemeProvider theme={darkTheme}>
        <EditorToolbar {...mockProps} />
      </ThemeProvider>
    )
    
    const saveButton = screen.getByText('Save Widget')
    fireEvent.click(saveButton)
    
    expect(mockProps.handleSaveWidget).toHaveBeenCalledWith(false)
  })

  it('shows version warning when saving non-latest version and confirms', async () => {
    // First test handles the confirmation path
    const { getByText, getByTestId } = render(
      <ThemeProvider theme={darkTheme}>
        <EditorToolbar {...mockProps} isLatestVersion={false} isUpdating={true} />
      </ThemeProvider>
    )
    
    // Find and click the Update Widget button
    const saveButton = getByText('Update Widget')
    fireEvent.click(saveButton)
    
    // Wait for dialog to appear and check it's there
    await waitFor(() => {
      expect(getByTestId('version-warning-dialog')).toHaveAttribute('data-open', 'true')
    })
    
    // Test confirm button
    fireEvent.click(getByTestId('confirm-button'))
    expect(mockProps.handleSaveWidget).toHaveBeenCalledWith(false)
  })
  
  it('shows version warning when saving non-latest version and cancels', async () => {
    // Second test handles the cancellation path
    const { getByText, getByTestId } = render(
      <ThemeProvider theme={darkTheme}>
        <EditorToolbar {...mockProps} isLatestVersion={false} isUpdating={true} />
      </ThemeProvider>
    )
    
    // Clear any previous calls
    mockProps.handleSaveWidget.mockClear()
    
    // Find and click the Update Widget button
    const saveButton = getByText('Update Widget')
    fireEvent.click(saveButton)
    
    // Wait for dialog to appear and check it's there
    await waitFor(() => {
      expect(getByTestId('version-warning-dialog')).toHaveAttribute('data-open', 'true')
    })
    
    // Test cancel button
    fireEvent.click(getByTestId('cancel-button'))
    expect(mockProps.handleSaveWidget).not.toHaveBeenCalled()
  })

  it('opens widget list when folder button is clicked', () => {
    render(
      <ThemeProvider theme={darkTheme}>
        <EditorToolbar {...mockProps} />
      </ThemeProvider>
    )
    
    const folderButton = screen.getByLabelText('Open saved widget')
    fireEvent.click(folderButton)
    
    expect(mockProps.setShowWidgetList).toHaveBeenCalledWith(true)
  })

  it('opens settings modal when settings button is clicked', () => {
    render(
      <ThemeProvider theme={darkTheme}>
        <EditorToolbar {...mockProps} />
      </ThemeProvider>
    )
    
    const settingsButton = screen.getByLabelText('Editor settings')
    fireEvent.click(settingsButton)
    
    expect(mockProps.setShowSettingsModal).toHaveBeenCalledWith(true)
  })

  it('calls undo and redo functions when respective buttons are clicked', () => {
    render(
      <ThemeProvider theme={darkTheme}>
        <EditorToolbar {...mockProps} canUndo={true} canRedo={true} />
      </ThemeProvider>
    )
    
    // Get the spans first then the buttons within them
    const undoSpan = screen.getByLabelText('Undo (Ctrl+Z)')
    const redoSpan = screen.getByLabelText('Redo (Ctrl+Y)')
    
    const undoButton = within(undoSpan).getByRole('button')
    const redoButton = within(redoSpan).getByRole('button')
    
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
    
    const moreButton = screen.getByLabelText('Advanced features')
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
    fireEvent.click(screen.getByLabelText('Advanced features'))
    
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
    fireEvent.click(screen.getByLabelText('Advanced features'))
    
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
    fireEvent.click(screen.getByLabelText('Advanced features'))
    
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
    
    const saveButton = screen.getByText('Save Widget').closest('button')
    expect(saveButton).toBeDisabled()
    
    // Case 2: No changes when updating
    render(
      <ThemeProvider theme={darkTheme}>
        <EditorToolbar {...mockProps} isUpdating={true} hasChanges={false} />
      </ThemeProvider>
    )
    
    const noChangesButton = screen.getByText('No changes').closest('button')
    expect(noChangesButton).toBeDisabled()
    
    // Case 3: Empty widget
    render(
      <ThemeProvider theme={darkTheme}>
        <EditorToolbar {...mockProps} isEmpty={true} />
      </ThemeProvider>
    )
    
    const emptyWidgetButton = screen.getByText('Empty Widget').closest('button')
    expect(emptyWidgetButton).toBeDisabled()
  })
  
  // This test needs to mock the mediaQuery specifically to test desktop view
  it('shows advanced features directly in toolbar when showAdvancedInToolbar is true', () => {
    // Force desktop view by mocking the useMediaQuery hook from MUI
    vi.spyOn(window, 'matchMedia').mockImplementation(query => ({
      matches: true, // This will simulate a desktop view
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn()
    }))
    
    render(
      <ThemeProvider theme={darkTheme}>
        <EditorToolbar 
          {...mockProps} 
          showAdvancedInToolbar={true} 
        />
      </ThemeProvider>
    )
    
    // Test for SVG icons inside buttons instead of button text
    expect(screen.getAllByTestId('DashboardIcon').length).toBeGreaterThan(0)
    expect(screen.getAllByTestId('ImportExportIcon').length).toBeGreaterThan(0)
    expect(screen.getAllByTestId('HistoryIcon').length).toBeGreaterThan(0)
  })
}) 