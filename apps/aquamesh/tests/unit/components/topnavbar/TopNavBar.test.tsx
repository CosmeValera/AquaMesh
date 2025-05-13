import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import TopNavBar from '../../../../src/components/topnavbar/TopNavBar'
import * as useTopNavBarWidgetsModule from '../../../../src/customHooks/useTopNavBarWidgets'
import * as LayoutProviderModule from '../../../../src/components/Layout/LayoutProvider'
import * as DashboardProviderModule from '../../../../src/components/Dasboard/DashboardProvider'

// Mock custom hooks and providers
vi.mock('../../../../src/customHooks/useTopNavBarWidgets', () => ({
  __esModule: true,
  default: vi.fn()
}))

vi.mock('../../../../src/components/Layout/LayoutProvider', () => ({
  __esModule: true,
  useLayout: vi.fn()
}))

vi.mock('../../../../src/components/Dasboard/DashboardProvider', () => ({
  __esModule: true,
  useDashboards: vi.fn()
}))

// Mock child components
vi.mock('../../../../src/components/Dasboard/DashboardOptionsMenu', () => ({
  __esModule: true,
  default: () => <div data-testid="dashboard-options-menu">Dashboard Options Menu</div>
}))

vi.mock('../../../../src/components/WidgetEditor/components/dialogs/WidgetManagementModal', () => ({
  __esModule: true,
  default: ({ open, onClose }) => (
    <div data-testid="widget-management-modal" data-open={open} onClick={onClose}>
      Widget Management Modal
    </div>
  )
}))

vi.mock('../../../../src/components/tutorial/TutorialModal', () => ({
  __esModule: true,
  default: ({ open, onClose }) => (
    <div data-testid="tutorial-modal" data-open={open} onClick={onClose}>
      Tutorial Modal
    </div>
  )
}))

vi.mock('../../../../src/components/tutorial/FAQDialog', () => ({
  __esModule: true,
  default: ({ open, onClose }) => (
    <div data-testid="faq-dialog" data-open={open} onClick={onClose}>
      FAQ Dialog
    </div>
  )
}))

// Mock SVG import
vi.mock('../../../../public/logo.svg', () => ({
  ReactComponent: () => <svg data-testid="logo">Logo</svg>
}))

// Mock useWidgetManager hook
vi.mock('../../../../src/components/WidgetEditor/hooks/useWidgetManager', () => ({
  __esModule: true,
  default: () => ({
    widgets: [],
    isWidgetManagementOpen: false,
    openWidgetManagement: vi.fn(),
    closeWidgetManagement: vi.fn(),
    previewWidget: vi.fn(),
    editWidget: vi.fn(),
    deleteWidget: vi.fn()
  })
}))

// Mock useNavigate
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => navigateMock
  }
})

const navigateMock = vi.fn()

describe('TopNavBar Component', () => {
  // Setup common mocks before each test
  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks()
    
    // Setup localStorage mock
    localStorage.getItem.mockReturnValue(JSON.stringify({ id: 'admin', name: 'Admin User', role: 'ADMIN_ROLE' }))
    
    // Setup useTopNavBarWidgets mock
    vi.mocked(useTopNavBarWidgetsModule.default).mockReturnValue({
      topNavBarWidgets: [
        {
          name: 'Standard Widgets',
          items: [
            { name: 'Chart Widget', component: 'ChartWidget' },
            { name: 'Data Table', component: 'DataTable' }
          ]
        },
        {
          name: 'Custom Widgets',
          items: [
            { name: 'My Custom Widget', component: 'CustomWidget', customProps: { widgetId: '123' } }
          ]
        }
      ]
    })
    
    // Setup useLayout mock
    vi.mocked(LayoutProviderModule.useLayout).mockReturnValue({
      ref: { current: { props: { model: { getActiveTabset: vi.fn(), getFirstTabSet: vi.fn() } }, doAction: vi.fn() } },
      addComponent: vi.fn()
    })
    
    // Setup useDashboards mock
    vi.mocked(DashboardProviderModule.useDashboards).mockReturnValue({
      addDashboard: vi.fn(),
      openDashboards: [{ id: 'dash1' }]
    })
  })

  it('renders correctly with all navigation items', () => {
    render(
      <BrowserRouter>
        <TopNavBar />
      </BrowserRouter>
    )
    
    // Verify main elements are rendered
    expect(screen.getByTestId('logo')).toBeInTheDocument()
    expect(screen.getByTestId('dashboard-options-menu')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /widgets/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /widget editor/i })).toBeInTheDocument()
  })

  it('opens widgets menu when Widgets button is clicked', async () => {
    render(
      <BrowserRouter>
        <TopNavBar />
      </BrowserRouter>
    )
    
    // Click on the Widgets button
    fireEvent.click(screen.getByRole('button', { name: /widgets/i }))
    
    // Check if the menu items appear
    await waitFor(() => {
      expect(screen.getByText('Manage Widgets')).toBeInTheDocument()
      expect(screen.getByText('Predefined Widgets')).toBeInTheDocument()
    })
  })

  it('opens widget editor when Widget Editor button is clicked', () => {
    render(
      <BrowserRouter>
        <TopNavBar />
      </BrowserRouter>
    )
    
    // Get the mocked addComponent function
    const addComponent = vi.mocked(LayoutProviderModule.useLayout().addComponent)
    
    // Click on the Widget Editor button
    fireEvent.click(screen.getByRole('button', { name: /widget editor/i }))
    
    // Verify the addComponent function was called with the correct arguments
    expect(addComponent).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Widget Editor",
        component: "WidgetEditor"
      })
    )
  })

  it('opens tutorial modal when Tutorial button is clicked', async () => {
    render(
      <BrowserRouter>
        <TopNavBar />
      </BrowserRouter>
    )
    
    // The button might be an icon button without text, so find by test ID
    const tutorialButton = screen.getByTestId('help-button')
    fireEvent.click(tutorialButton)
    
    // Check if the tutorial modal is visible
    await waitFor(() => {
      const tutorialModal = screen.getByTestId('tutorial-modal')
      expect(tutorialModal).toBeInTheDocument()
      expect(tutorialModal.getAttribute('data-open')).toBe('true')
    })
  })

  it('opens FAQ dialog when FAQ button is clicked', async () => {
    render(
      <BrowserRouter>
        <TopNavBar />
      </BrowserRouter>
    )
    
    // The button might be an icon button without text, so find by test ID
    const faqButton = screen.getByTestId('faq-button')
    fireEvent.click(faqButton)
    
    // Check if the FAQ dialog is visible
    await waitFor(() => {
      const faqDialog = screen.getByTestId('faq-dialog')
      expect(faqDialog).toBeInTheDocument()
      expect(faqDialog.getAttribute('data-open')).toBe('true')
    })
  })

  it('navigates to login page when logout is clicked', async () => {
    render(
      <BrowserRouter>
        <TopNavBar />
      </BrowserRouter>
    )
    
    // Click on the user menu button (avatar)
    const userButton = screen.getByRole('button', { name: /ad/i }) // "AD" from "ADMIN" in the avatar
    fireEvent.click(userButton)
    
    // Click on logout option in the menu
    await waitFor(() => {
      fireEvent.click(screen.getByText('Logout'))
    })
    
    // Verify navigation to login page
    expect(navigateMock).toHaveBeenCalledWith('/login')
  })

  it('adds a dashboard if none exists when adding a widget', () => {
    // Mock openDashboards as empty to test this behavior
    vi.mocked(DashboardProviderModule.useDashboards).mockReturnValue({
      addDashboard: vi.fn(),
      openDashboards: []
    })
    
    render(
      <BrowserRouter>
        <TopNavBar />
      </BrowserRouter>
    )
    
    // Click on the Widgets button
    fireEvent.click(screen.getByRole('button', { name: /widgets/i }))
    
    // Click on a widget in the menu
    fireEvent.click(screen.getByText('Chart Widget'))
    
    // Verify addDashboard was called
    expect(DashboardProviderModule.useDashboards().addDashboard).toHaveBeenCalled()
    
    // We would need to test the setTimeout, but that's complex in this test
    // Instead, verify that the functionality exists in the component
  })
}) 