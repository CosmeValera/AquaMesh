import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import '../setup'
import '@testing-library/jest-dom/vitest'
import CustomWidget from '../../src/components/WidgetEditor/CustomWidget'
import WidgetStorage from '../../src/components/WidgetEditor/WidgetStorage'

// Mock WidgetStorage
vi.mock('../../src/components/WidgetEditor/WidgetStorage', () => {
  return {
    default: {
      getWidgetById: vi.fn(),
      getAllWidgets: vi.fn(),
    }
  }
})

describe('CustomWidget', () => {
  const mockComponents = [
    {
      id: 'comp-1',
      type: 'TextField',
      props: { 
        label: 'Test Field',
        placeholder: 'Enter text here'
      },
    },
    {
      id: 'comp-2',
      type: 'Button',
      props: { 
        label: 'Submit',
        variant: 'contained'
      },
    }
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders components from direct props', () => {
    render(
      <CustomWidget 
        components={mockComponents} 
        name="Test Widget" 
        showWidgetName={true}
      />
    )

    // Check that the widget name is displayed
    expect(screen.queryByText('Test Widget')).not.toBeNull()

    // Check that components are rendered
    expect(screen.queryByLabelText('Test Field')).not.toBeNull()
    expect(screen.queryByText('Submit')).not.toBeNull()
  })

  it('retrieves widget from storage by ID', () => {
    // Mock the storage getWidgetById function
    const mockWidget = {
      id: 'widget-123',
      name: 'Stored Widget',
      components: mockComponents,
      createdAt: '2023-01-01',
      updatedAt: '2023-01-01'
    }
    
    vi.mocked(WidgetStorage.getWidgetById).mockReturnValue(mockWidget)
    
    render(<CustomWidget widgetId="widget-123" />)
    
    // Verify the storage was called with the correct ID
    expect(WidgetStorage.getWidgetById).toHaveBeenCalledWith('widget-123')
    
    // Check that components from the stored widget are rendered
    expect(screen.queryByLabelText('Test Field')).not.toBeNull()
    expect(screen.queryByText('Submit')).not.toBeNull()
  })

  it('retrieves widget from storage by name', () => {
    // Mock getAllWidgets to return an array of widgets
    const mockWidgets = [
      {
        id: 'widget-456',
        name: 'Named Widget',
        components: mockComponents,
        createdAt: '2023-01-01',
        updatedAt: '2023-01-01'
      }
    ]
    
    vi.mocked(WidgetStorage.getAllWidgets).mockReturnValue(mockWidgets)
    
    render(<CustomWidget name="Named Widget" />)
    
    // Verify the storage function was called
    expect(WidgetStorage.getAllWidgets).toHaveBeenCalled()
    
    // Check that components from the named widget are rendered
    expect(screen.queryByLabelText('Test Field')).not.toBeNull()
    expect(screen.queryByText('Submit')).not.toBeNull()
  })

  it('renders empty state when no widget is found', () => {
    // Mock empty responses
    vi.mocked(WidgetStorage.getWidgetById).mockReturnValue(null)
    vi.mocked(WidgetStorage.getAllWidgets).mockReturnValue([])
    
    render(<CustomWidget widgetId="non-existent" />)
    
    // Components should not be rendered since no widget is found
    expect(screen.queryByLabelText('Test Field')).toBeNull()
    expect(screen.queryByText('Submit')).toBeNull()
  })
}) 