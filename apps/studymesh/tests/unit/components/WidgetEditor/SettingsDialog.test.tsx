import React from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import SettingsDialog from '../../../../src/components/WidgetEditor/components/dialogs/SettingsDialog'
import { STUDY_CREDITS_LABEL } from '../../../../src/studyPack/ai/hostedCredits'
import { STUDY_GUIDES_STORAGE_KEY } from '../../../../src/studyGuides/storage'

const hostedAiStatus = vi.hoisted(() => ({
  available: true,
  accountReady: true,
  introSeen: true,
  studyCredits: 8,
  dailyFreeCredits: 2,
  initialFreeCredits: 10,
  costs: {
    'study-guide': 2,
    'quick-create': 1,
    chat: 1,
  },
}))

vi.mock('../../../../src/studyPack/ai', () => ({
  STRONG_AI_PROVIDERS: {
    gemini: {
      id: 'gemini',
      label: 'Own Gemini API key',
      defaultModel: 'gemini-test-model',
      envKey: 'GEMINI_API_KEY',
      supportsImageInput: true,
    },
    cerebras: {
      id: 'cerebras',
      label: 'Own Cerebras API key',
      defaultModel: 'gpt-oss-120b',
      envKey: 'CEREBRAS_API_KEY',
      supportsImageInput: false,
    },
  },
  DEFAULT_STUDY_PACK_AI_MODEL: 'gemini-test-model',
  DEFAULT_HOSTED_AI_CREDIT_PACK_ID: 'popular',
  HOSTED_AI_CREDIT_PACKS: [
    {
      id: 'starter',
      credits: 80,
      priceCents: 200,
      currency: 'eur',
      label: '2 EUR',
    },
    {
      id: 'popular',
      credits: 250,
      priceCents: 500,
      currency: 'eur',
      label: '5 EUR',
      badge: 'Most popular',
    },
    {
      id: 'value',
      credits: 550,
      priceCents: 1000,
      currency: 'eur',
      label: '10 EUR',
    },
    {
      id: 'max',
      credits: 1200,
      priceCents: 2000,
      currency: 'eur',
      label: '20 EUR',
      badge: 'Best value',
    },
  ],
  HOSTED_AI_CREDIT_COSTS: {
    'study-guide': 2,
    'quick-create': 1,
    chat: 1,
  },
  HOSTED_AI_DAILY_FREE_CREDITS: 2,
  HOSTED_AI_INITIAL_FREE_CREDITS: 10,
  HOSTED_AI_USAGE_CHANGED_EVENT: 'studymesh-hosted-ai-usage-changed',
  STUDY_CREDITS_LABEL: 'Study Credits',
  redirectToHostedAiCreditCheckout: vi.fn(),
  getHostedAiStatus: vi.fn(() => Promise.resolve(hostedAiStatus)),
  getEnvGeminiApiKey: vi.fn(() => ''),
  getEnvStrongAiProviderApiKey: vi.fn(() => ''),
  markHostedAiIntroSeen: vi.fn(),
  getStudyPackAiCredentialForProvider: vi.fn((settings, provider) => ({
    apiToken: settings.strongProviders?.[provider]?.apiToken || '',
    model:
      settings.strongProviders?.[provider]?.model ||
      (provider === 'cerebras' ? 'gpt-oss-120b' : 'gemini-test-model'),
  })),
  isStrongAiProvider: vi.fn(
    (provider) => provider === 'gemini' || provider === 'cerebras',
  ),
  readStudyPackAiSettings: vi.fn(() => ({
    provider: 'hosted',
    apiToken: '',
    model: 'gemini-test-model',
    strongProviders: {},
  })),
  saveStudyPackAiSettings: vi.fn(),
  testLocalLanguageModel: vi.fn(),
}))

vi.mock('../../../../src/studyPack/studyMeshGuideSeed', () => ({
  seedStudyMeshGuideStudyPath: vi.fn(() => true),
}))

vi.mock('../../../../src/auth/AuthProvider', () => ({
  useAuth: () => ({
    user: { id: 'auth-user', email: 'admin@example.com' },
    session: { access_token: 'test-access-token' },
    loading: false,
    signOut: vi.fn(),
  }),
}))

vi.mock('../../../../src/components/hostedAi/useHostedAiStatus', () => ({
  useHostedAiStatus: () => ({
    status: hostedAiStatus,
    loading: false,
    error: '',
    refresh: vi.fn(),
    markIntroSeen: vi.fn(),
  }),
}))

const readBlobText = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(reader.error)
    reader.readAsText(blob)
  })

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
  vi.mocked(localStorage.clear).mockImplementation(() => store.clear())

  return store
}

describe('SettingsDialog study library export', () => {
  let exportedBlob: Blob | null
  let downloadedFileName: string

  beforeEach(() => {
    exportedBlob = null
    downloadedFileName = ''

    vi.stubGlobal(
      'URL',
      Object.assign(URL, {
        createObjectURL: vi.fn((blob: Blob) => {
          exportedBlob = blob
          return 'blob:study-library'
        }),
        revokeObjectURL: vi.fn(),
      }),
    )

    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(
      function click(this: HTMLAnchorElement) {
        downloadedFileName = this.download
      },
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('exports only selected dashboards from grouped folders', async () => {
    const storage = createMemoryStorage()
    storage.set(
      'customDashboards',
      JSON.stringify([
        { id: 'bio-1', name: 'Cells', folder: 'Biology' },
        { id: 'bio-2', name: 'Genetics', folder: 'Biology' },
        { id: 'hist-1', name: 'Rome', folder: 'History' },
      ]),
    )

    render(<SettingsDialog open onClose={vi.fn()} scope="global" />)

    fireEvent.click(screen.getByRole('button', { name: /export library/i }))

    const exportDialog = await screen.findByRole('dialog', {
      name: /export study library/i,
    })

    expect(
      within(exportDialog).getByRole('checkbox', {
        name: /select biology folder/i,
      }),
    ).toBeChecked()
    expect(
      within(exportDialog).getByRole('checkbox', { name: /select cells/i }),
    ).toBeChecked()
    expect(
      within(exportDialog).getByRole('checkbox', { name: /select genetics/i }),
    ).toBeChecked()

    fireEvent.click(
      within(exportDialog).getByRole('checkbox', { name: /select genetics/i }),
    )
    fireEvent.click(
      within(exportDialog).getByRole('checkbox', {
        name: /select history folder/i,
      }),
    )
    fireEvent.click(
      within(exportDialog).getByRole('button', { name: /export selected/i }),
    )

    expect(downloadedFileName).toMatch(
      /^studymesh-study-library-\d{4}-\d{2}-\d{2}\.json$/,
    )
    expect(exportedBlob).not.toBeNull()

    const payload = JSON.parse(await readBlobText(exportedBlob!))
    expect(payload.version).toBe(1)
    expect(payload.exportedAt).toEqual(expect.any(String))
    expect(payload.dashboards).toEqual([
      { id: 'bio-1', name: 'Cells', folder: 'Biology' },
    ])
    expect(payload.studyGuides).toEqual([])
  })

  it('exports saved Study Guides when no dashboards are saved', async () => {
    const storage = createMemoryStorage()
    const studyGuide = {
      id: 'spanish-b2',
      title: 'Spanish B2',
      folderName: 'Languages',
      studyPath: {
        pathId: 'spanish-b2',
        title: 'Spanish B2',
        folderName: 'Languages',
        dashboards: [],
        selectedIndex: 0,
      },
      createdAt: '2026-06-05T00:00:00.000Z',
      updatedAt: '2026-06-05T00:00:00.000Z',
    }
    storage.set(STUDY_GUIDES_STORAGE_KEY, JSON.stringify([studyGuide]))

    render(<SettingsDialog open onClose={vi.fn()} scope="global" />)

    fireEvent.click(screen.getByRole('button', { name: /export library/i }))

    const exportDialog = await screen.findByRole('dialog', {
      name: /export study library/i,
    })

    expect(
      within(exportDialog).getByRole('checkbox', {
        name: /select languages folder/i,
      }),
    ).toBeChecked()
    expect(
      within(exportDialog).getByRole('checkbox', {
        name: /select spanish b2/i,
      }),
    ).toBeChecked()

    fireEvent.click(
      within(exportDialog).getByRole('button', { name: /export selected/i }),
    )

    const payload = JSON.parse(await readBlobText(exportedBlob!))
    expect(payload.dashboards).toEqual([])
    expect(payload.studyGuides).toEqual([studyGuide])
  })

  it('keeps AI provider controls out of Application Settings', () => {
    render(<SettingsDialog open onClose={vi.fn()} scope="global" />)

    expect(screen.queryByLabelText(/AI provider/i)).not.toBeInTheDocument()
    expect(screen.queryByText(STUDY_CREDITS_LABEL)).not.toBeInTheDocument()
  })

  it('requires DELETE before deleting the StudyMesh profile', () => {
    const onDeleteStudyMeshProfile = vi.fn()

    render(
      <SettingsDialog
        open
        onClose={vi.fn()}
        scope="global"
        onDeleteStudyMeshProfile={onDeleteStudyMeshProfile}
      />,
    )

    const deleteButton = screen.getByRole('button', {
      name: /delete studymesh profile/i,
    })

    expect(deleteButton).toBeDisabled()

    fireEvent.change(screen.getByLabelText(/type delete to confirm/i), {
      target: { value: 'DELETE' },
    })
    fireEvent.click(deleteButton)

    expect(onDeleteStudyMeshProfile).toHaveBeenCalledTimes(1)
  })
})
