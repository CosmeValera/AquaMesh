import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

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
              components: [
                {
                  id: `progress-${index}`,
                  type: 'StudyProgress',
                  props: {
                    studyPathId: 'german-b1-grammar',
                    studyPathTitle: 'German B1 Grammar',
                    studyPathDashboardKey: `german-b1-grammar-${index}`,
                    studyPathDashboardName: `Lesson ${index}`,
                    studyPathDashboardIndex: index,
                    studyPathDashboardCount: 5,
                    studyPathFolderName: 'German B1 Grammar',
                  },
                },
              ],
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

const seedStudyPathDashboards = (storage: Map<string, string>) => {
  const dashboards = createStudyPath().dashboards.map((lesson, index) => ({
    id: lesson.id,
    name: lesson.name,
    folder: 'German B1 Grammar',
    folderColor: '#007C66',
    layout: lesson.layout,
    tags: ['study-pack'],
    isPublic: true,
    createdAt: `2026-05-15T10:0${index}:00.000Z`,
    updatedAt: `2026-05-15T10:0${index}:00.000Z`,
  }))

  storage.set('customDashboards', JSON.stringify(dashboards))
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

  it('uses a subtle floating navigator that overlays the dashboard and can be collapsed', () => {
    const onStudyPathChange = vi.fn()

    render(
      <StudyPathWorkspaceView
        studyPath={createStudyPath()}
        onStudyPathChange={onStudyPathChange}
      />,
    )

    expect(screen.getByTestId('mock-dashboard-layout')).toBeInTheDocument()
    expect(
      screen.getByTestId('mock-selected-widget-border'),
    ).toBeInTheDocument()
    expect(screen.getByTestId('study-path-navigator-pill')).toBeInTheDocument()
    expect(
      screen.queryByTestId('study-path-navigator-panel'),
    ).not.toBeInTheDocument()

    expect(screen.getByTestId('study-path-workspace')).toHaveStyle({
      overflow: 'visible',
    })
    expect(screen.getByTestId('study-path-dashboard-content')).toHaveStyle({
      overflow: 'visible',
    })

    const overlay = screen.getByTestId('study-path-navigator-overlay')
    expect(overlay).toHaveStyle({ pointerEvents: 'none' })

    fireEvent.click(
      screen.getByRole('button', { name: /open course navigator/i }),
    )

    expect(screen.getByTestId('study-path-navigator-panel')).toBeInTheDocument()
    expect(screen.getByText('Course helper')).toBeInTheDocument()
    expect(screen.getByText('0/5 completed')).toBeInTheDocument()
    expect(screen.getByText('Lesson 1/5')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /dock left/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /dock right/i })).toBeInTheDocument()
    expect(
      screen.getByTestId('mock-selected-widget-border'),
    ).toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', { name: /collapse course navigator/i }),
    )

    expect(
      screen.queryByTestId('study-path-navigator-panel'),
    ).not.toBeInTheDocument()
    expect(screen.getByTestId('study-path-navigator-pill')).toBeInTheDocument()
  })

  it('keeps Study Guides dropdown actions focused and opens lessons as standalone tabs', async () => {
    const storage = createMemoryStorage()
    seedStudyPathDashboards(storage)

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
})
