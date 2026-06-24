import React from 'react'
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

import DashboardOptionsMenu from '../../../src/components/Dasboard/DashboardOptionsMenu'
import DashboardProvider, {
  useDashboards,
} from '../../../src/components/Dasboard/DashboardProvider'
import StudyPathWorkspaceView from '../../../src/components/Dasboard/StudyPathWorkspaceView'
import {
  DashboardLayout,
  StudyPathContainerState,
} from '../../../src/state/store'
import { useStore } from '../../../src/state/store'
import { STUDY_GUIDES_STORAGE_KEY } from '../../../src/studyGuides/storage'
import { createMarkdownStudyGuidePageLayout } from '../../../src/studyGuides/pages'

vi.mock('../../../src/customHooks/useWorkspaceActions', () => ({
  ensureStarterDashboards: vi.fn(),
  OPEN_SAVED_DASHBOARDS_EVENT: 'studymesh-open-saved-dashboards',
}))

vi.mock('../../../src/components/onboarding/onboardingEvents', () => ({
  dispatchWorkspaceOnboardingEvent: vi.fn(),
}))

vi.mock('../../../src/components/Layout/Layout', () => ({
  default: ({ layout }: { layout?: DashboardLayout }) => (
    <div data-testid="mock-dashboard-layout">
      <div data-testid="mock-selected-widget-border">
        Selected widget border
      </div>
      <span>{layout?.name}</span>
    </div>
  ),
}))

vi.mock('../../../src/components/Dasboard/StudyGuidePageEditor', () => ({
  default: () => <div data-testid="mock-study-guide-page-editor" />,
}))

const createMemoryStorage = () => {
  const store = new Map<string, string>()
  vi.mocked(localStorage.getItem).mockImplementation((key: string) =>
    store.has(key) ? store.get(key)! : null,
  )
  vi.mocked(localStorage.setItem).mockImplementation(
    (key: string, value: string) => {
      store.set(key, value)
    },
  )
  vi.mocked(localStorage.removeItem).mockImplementation((key: string) => {
    store.delete(key)
  })
  vi.mocked(localStorage.clear).mockImplementation(() => {
    store.clear()
  })
  return store
}

const createLessonLayout = (index: number): DashboardLayout => ({
  type: 'row',
  name: `Lesson ${index}`,
  children: [
    {
      type: 'tabset',
      children: [
        {
          type: 'tab',
          name: `Lesson ${index}`,
          component: 'CustomWidget',
          config: {
            customProps: {
              studyPathId: 'german-b1-grammar',
              studyPathTitle: 'German B1 Grammar',
              studyPathDashboardKey: `german-b1-grammar-${index}`,
              studyPathDashboardName: `Lesson ${index}`,
              studyPathDashboardIndex: index,
              studyPathDashboardCount: 5,
              studyPathFolderName: 'German B1 Grammar',
              components: [],
            },
          },
        },
      ],
    },
  ],
})

const createStudyPath = (): StudyPathContainerState => ({
  pathId: 'german-b1-grammar',
  title: 'German B1 Grammar',
  folderName: 'German B1 Grammar',
  selectedIndex: 0,
  dashboards: Array.from({ length: 5 }, (_, lessonIndex) => ({
    id: `lesson-${lessonIndex + 1}`,
    name: `Lesson ${lessonIndex + 1}`,
    layout: createLessonLayout(lessonIndex + 1),
    dashboardKey: `german-b1-grammar-${lessonIndex + 1}`,
    dashboardIndex: lessonIndex + 1,
    dashboardCount: 5,
    folderName: 'German B1 Grammar',
  })),
  pinnedDashboardKeys: [],
})

const seedStoredStudyGuide = (storage: Map<string, string>) => {
  const studyPath = createStudyPath()

  storage.set(
    STUDY_GUIDES_STORAGE_KEY,
    JSON.stringify([
      {
        id: studyPath.pathId,
        title: studyPath.title,
        folderName: studyPath.folderName,
        description: 'Stored Study Guide',
        studyPath,
        createdAt: '2026-05-15T10:00:00.000Z',
        updatedAt: '2026-05-15T10:00:00.000Z',
      },
    ]),
  )
}

const StateProbe = () => {
  const {
    openDashboards,
    selectedDashboard,
    addStudyPathContainer,
    updateStudyPathContainer,
  } = useDashboards()
  const selected = openDashboards[selectedDashboard]

  return (
    <div>
      <button onClick={() => addStudyPathContainer(createStudyPath())}>
        open-study-path
      </button>
      <button
        onClick={() => {
          const studyPathDashboard = openDashboards.find(
            (dashboard) => dashboard.kind === 'studyPathContainer',
          )
          if (studyPathDashboard?.studyPath) {
            updateStudyPathContainer(studyPathDashboard.id, (studyPath) => ({
              ...studyPath,
              selectedIndex: 3,
            }))
          }
        }}
      >
        go-lesson-4
      </button>
      <output data-testid="dashboard-count">{openDashboards.length}</output>
      <output data-testid="selected-kind">
        {selected?.kind || 'dashboard'}
      </output>
      <output data-testid="selected-lesson">
        {selected?.studyPath?.selectedIndex ?? 'none'}
      </output>
      <output data-testid="dashboard-names">
        {openDashboards.map((dashboard) => dashboard.name).join('|')}
      </output>
    </div>
  )
}

const renderWithDashboardProvider = (ui: React.ReactNode) =>
  render(<DashboardProvider>{ui}</DashboardProvider>)

describe('Interactive Study Guide UX', () => {
  beforeEach(() => {
    createMemoryStorage()
    useStore.setState({
      selectedDashboard: 0,
      openDashboards: [
        {
          id: 'existing-dashboard',
          name: 'Existing dashboard',
          layout: createLessonLayout(99),
        },
      ],
    })
  })

  it('opens a multi-lesson Study Guide as one top-level tab and internal navigation does not add tabs', () => {
    renderWithDashboardProvider(<StateProbe />)

    fireEvent.click(screen.getByRole('button', { name: 'open-study-path' }))

    expect(screen.getByTestId('dashboard-count')).toHaveTextContent('2')
    expect(screen.getByTestId('selected-kind')).toHaveTextContent(
      'studyPathContainer',
    )
    expect(screen.getByTestId('selected-lesson')).toHaveTextContent('0')

    fireEvent.click(screen.getByRole('button', { name: 'go-lesson-4' }))

    expect(screen.getByTestId('dashboard-count')).toHaveTextContent('2')
    expect(screen.getByTestId('selected-lesson')).toHaveTextContent('3')
  })

  it('keeps reading navigation in the Study Guide without the Edit Pages canvas', () => {
    const onStudyPathChange = vi.fn()

    render(
      <MemoryRouter>
        <StudyPathWorkspaceView
          studyPath={createStudyPath()}
          onStudyPathChange={onStudyPathChange}
        />
      </MemoryRouter>,
    )

    expect(
      screen.queryByRole('button', { name: 'Edit Pages' }),
    ).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Next page' })).toBeEnabled()

    fireEvent.click(screen.getByRole('button', { name: 'Next page' }))
    expect(onStudyPathChange).toHaveBeenCalledWith(
      expect.objectContaining({ selectedIndex: 1 }),
    )
  })

  it('renders Quick Start as a collapsible card separate from page content', () => {
    const studyPath = {
      ...createStudyPath(),
      quickStart: {
        keyIdea: 'A data lake is raw shared storage plus tools for later use.',
        quickSummary:
          'First paragraph gives the learner a fast model.\n\nSecond paragraph adds a caveat without listing pages.',
      },
    }
    const firstPage = studyPath.dashboards[0]
    firstPage.layout = createMarkdownStudyGuidePageLayout({
      studyPath,
      pageKey: firstPage.dashboardKey,
      title: firstPage.name,
      markdown: 'Main page body starts here.',
      pageIndex: 1,
      pageCount: studyPath.dashboards.length,
    })

    const { rerender } = render(
      <MemoryRouter>
        <StudyPathWorkspaceView
          studyPath={studyPath}
          onStudyPathChange={vi.fn()}
        />
      </MemoryRouter>,
    )

    const quickStartCard = screen.getByTestId('study-guide-quick-start-card')
    expect(within(quickStartCard).getByText('Quick Start')).toBeInTheDocument()
    expect(within(quickStartCard).getByText('Key idea')).toBeInTheDocument()
    expect(
      within(quickStartCard).getByText(
        'A data lake is raw shared storage plus tools for later use.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByText('Main page body starts here.')).toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', { name: 'Collapse Quick Start' }),
    )
    expect(
      screen.queryByText(
        'A data lake is raw shared storage plus tools for later use.',
      ),
    ).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Expand Quick Start' }))
    expect(
      screen.getByText(
        'A data lake is raw shared storage plus tools for later use.',
      ),
    ).toBeInTheDocument()

    rerender(
      <MemoryRouter>
        <StudyPathWorkspaceView
          studyPath={{ ...studyPath, selectedIndex: 1 }}
          onStudyPathChange={vi.fn()}
        />
      </MemoryRouter>,
    )

    expect(
      screen.queryByTestId('study-guide-quick-start-card'),
    ).not.toBeInTheDocument()
  })

  it('uses an icon-only edit and preview toggle for editable pages', () => {
    const onEditingPageKeyChange = vi.fn()
    const studyPath = createStudyPath()
    const currentPage = studyPath.dashboards[0]
    currentPage.deletable = true
    currentPage.createdBy = 'manual'
    currentPage.layout = createMarkdownStudyGuidePageLayout({
      studyPath,
      pageKey: currentPage.dashboardKey,
      title: currentPage.name,
      markdown: 'Lesson notes',
      pageIndex: 1,
      pageCount: studyPath.dashboards.length,
    })

    const { rerender } = render(
      <MemoryRouter>
        <StudyPathWorkspaceView
          studyPath={studyPath}
          onStudyPathChange={vi.fn()}
          onEditingPageKeyChange={onEditingPageKeyChange}
        />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Edit current page' }))
    expect(onEditingPageKeyChange).toHaveBeenCalledWith(
      currentPage.dashboardKey,
    )

    rerender(
      <MemoryRouter>
        <StudyPathWorkspaceView
          studyPath={studyPath}
          onStudyPathChange={vi.fn()}
          editingPageKey={currentPage.dashboardKey}
          onEditingPageKeyChange={onEditingPageKeyChange}
        />
      </MemoryRouter>,
    )

    fireEvent.click(
      screen.getByRole('button', { name: 'Preview current page' }),
    )
    expect(onEditingPageKeyChange).toHaveBeenLastCalledWith(null)
  })

  it('keeps Study Guides dropdown actions focused and opens lessons as standalone tabs', async () => {
    const storage = createMemoryStorage()
    seedStoredStudyGuide(storage)

    renderWithDashboardProvider(
      <>
        <DashboardOptionsMenu />
        <StateProbe />
      </>,
    )

    fireEvent.click(screen.getByRole('button', { name: /library/i }))

    expect(await screen.findByText('German B1 Grammar')).toBeInTheDocument()
    expect(screen.getByText('5 lessons')).toBeInTheDocument()
    expect(
      screen.getByLabelText('Manage German B1 Grammar in Library'),
    ).toBeInTheDocument()
    expect(
      screen.queryByLabelText(/Study Guide actions/i),
    ).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/Lesson actions/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Open all dashboards/i)).not.toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('Expand German B1 Grammar lessons'))

    expect(await screen.findByText('01 Lesson 1')).toBeInTheDocument()
    expect(
      screen.queryByLabelText('Open Lesson 1 in new tab'),
    ).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/Lesson actions/i)).not.toBeInTheDocument()

    fireEvent.click(screen.getByText('German B1 Grammar'))
    expect(screen.getByTestId('dashboard-count')).toHaveTextContent('2')
    expect(screen.getByTestId('selected-kind')).toHaveTextContent(
      'studyPathContainer',
    )

    fireEvent.click(screen.getByRole('button', { name: /library/i }))
    const expandForNavigation = screen.queryByLabelText(
      'Expand German B1 Grammar lessons',
    )
    if (expandForNavigation) {
      fireEvent.click(expandForNavigation)
    }
    fireEvent.click(await screen.findByText('03 Lesson 3'))

    await waitFor(() => {
      expect(screen.getByTestId('dashboard-count')).toHaveTextContent('3')
      expect(screen.getByTestId('dashboard-names')).toHaveTextContent(
        'Existing dashboard|German B1 Grammar|Lesson 3',
      )
    })
  })

  it('does not show the empty library message when stored Study Guides exist', async () => {
    const storage = createMemoryStorage()
    seedStoredStudyGuide(storage)

    renderWithDashboardProvider(<DashboardOptionsMenu />)

    fireEvent.click(screen.getByRole('button', { name: /library/i }))

    expect(await screen.findByText('German B1 Grammar')).toBeInTheDocument()
    expect(screen.getByText('5 lessons')).toBeInTheDocument()
    expect(
      screen.queryByText('No study guides or dashboards yet'),
    ).not.toBeInTheDocument()
  })
})
