import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  getAllUserKnownTopics,
  getUserKnownTopics,
  normalizeProfileContext,
  parseSpecificKnowledgeInput,
  PROFILE_CONTEXT_CHANGED_EVENT,
  PROFILE_CONTEXT_STORAGE_KEY,
  readProfileContext,
  sanitizeUserKnownTopics,
  saveProfileContext,
} from '../../src/profileContext'

describe('profile context', () => {
  let storage: Record<string, string>

  beforeEach(() => {
    storage = {}
    vi.mocked(localStorage.getItem).mockImplementation(
      (key: string) => storage[key] ?? null,
    )
    vi.mocked(localStorage.setItem).mockImplementation(
      (key: string, value: string) => {
        storage[key] = value
      },
    )
    vi.mocked(localStorage.removeItem).mockImplementation((key: string) => {
      delete storage[key]
    })
  })

  it('sanitizes, truncates, dedupes, and optionally caps user known topics', () => {
    expect(
      sanitizeUserKnownTopics([
        ' Backend ',
        'backend',
        'Databases',
        '',
        42,
        'DevOps',
        'APIs',
        'Testing',
        'Extra',
      ]),
    ).toEqual(['Backend', 'Databases', 'DevOps', 'APIs', 'Testing', 'Extra'])

    expect(
      sanitizeUserKnownTopics(
        ['Long topic name that should be clipped after forty chars', 'Second'],
        { maxTopics: 1 },
      ),
    ).toEqual(['Long topic name that should be clipped a'])
  })

  it('parses free text topics from commas, semicolons, and lines', () => {
    expect(
      parseSpecificKnowledgeInput('Java, gym training\ninvesting; French B1'),
    ).toEqual(['Java', 'gym training', 'investing', 'French B1'])
  })

  it('saves, reads, and emits self-reported profile context', () => {
    const listener = vi.fn()
    window.addEventListener(PROFILE_CONTEXT_CHANGED_EVENT, listener)

    const saved = saveProfileContext({
      roles: ['software_it', 'finance'],
      broadKnowledge: ['Backend', 'Databases'],
      specificKnowledge: ['MinIO'],
    })

    expect(saved).toMatchObject({
      version: 1,
      roles: ['software_it', 'finance'],
      broadKnowledge: ['Backend', 'Databases'],
      specificKnowledge: ['MinIO'],
      confidence: 'self_reported',
    })
    expect(readProfileContext()).toEqual(saved)
    expect(JSON.parse(storage[PROFILE_CONTEXT_STORAGE_KEY])).toEqual(saved)
    expect(listener).toHaveBeenCalled()

    window.removeEventListener(PROFILE_CONTEXT_CHANGED_EVENT, listener)
  })

  it('normalizes cloud-shaped profile context', () => {
    expect(
      normalizeProfileContext({
        roles: ['finance', 'software_it'],
        broadKnowledge: ['Investing', 'Markets'],
        specificKnowledge: ['Options'],
        updatedAt: '2026-06-23T00:00:00.000Z',
      }),
    ).toMatchObject({
      roles: ['finance', 'software_it'],
      broadKnowledge: ['Investing', 'Markets'],
      specificKnowledge: ['Options'],
    })
  })

  it('returns AI topics specific-first and capped', () => {
    const context = {
      version: 1 as const,
      roles: ['software_it' as const],
      broadKnowledge: [
        'Backend',
        'Databases',
        'Cloud',
        'APIs',
        'Testing',
        'DevOps',
        'Security',
        'Frontend',
      ],
      specificKnowledge: ['MinIO', 'S3', 'Databases'],
      confidence: 'self_reported' as const,
      updatedAt: '2026-06-23T00:00:00.000Z',
    }

    expect(getUserKnownTopics(context)).toEqual([
      'MinIO',
      'S3',
      'Databases',
      'Backend',
      'Cloud',
      'APIs',
      'Testing',
      'DevOps',
    ])
    expect(getAllUserKnownTopics(context)).toEqual([
      'MinIO',
      'S3',
      'Databases',
      'Backend',
      'Cloud',
      'APIs',
      'Testing',
      'DevOps',
      'Security',
      'Frontend',
    ])
  })
})
