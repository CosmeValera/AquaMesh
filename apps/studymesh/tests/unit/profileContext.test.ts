import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  addLearnedTopicToProfileContext,
  getAllUserKnownTopics,
  getUserKnownTopics,
  normalizeProfileContext,
  parseSpecificKnowledgeInput,
  PROFILE_CONTEXT_CHANGED_EVENT,
  PROFILE_CONTEXT_STORAGE_KEY,
  readProfileContext,
  sanitizeUserKnownTopics,
  saveProfileContext,
  USER_KNOWN_TOPICS_DIRECT_MAX,
  USER_KNOWN_TOPICS_STORAGE_MAX,
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

  it('returns AI topics specific-first, deduped, under the direct cap', () => {
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
    const expectedTopics = [
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
    ]

    expect(getUserKnownTopics(context)).toEqual(expectedTopics)
    expect(getAllUserKnownTopics(context)).toEqual(expectedTopics)
  })

  it('caps getUserKnownTopics at USER_KNOWN_TOPICS_DIRECT_MAX, leaving getAllUserKnownTopics uncapped', () => {
    const specificKnowledge = Array.from(
      { length: 55 },
      (_, index) => `Topic ${index + 1}`,
    )
    const context = {
      version: 1 as const,
      roles: [],
      broadKnowledge: [],
      specificKnowledge,
      confidence: 'self_reported' as const,
      updatedAt: '2026-06-23T00:00:00.000Z',
    }

    expect(getUserKnownTopics(context)).toEqual(specificKnowledge.slice(0, 50))
    expect(getAllUserKnownTopics(context)).toEqual(specificKnowledge)
  })

  it('caps total stored known topics at USER_KNOWN_TOPICS_STORAGE_MAX, keeping newest specific topics first', () => {
    const specificKnowledge = Array.from(
      { length: USER_KNOWN_TOPICS_STORAGE_MAX + 10 },
      (_, index) => `Specific ${index + 1}`,
    )
    const normalized = normalizeProfileContext({
      roles: [],
      broadKnowledge: ['Backend', 'Databases'],
      specificKnowledge,
    })

    expect(normalized?.specificKnowledge).toHaveLength(
      USER_KNOWN_TOPICS_STORAGE_MAX,
    )
    expect(normalized?.specificKnowledge).toEqual(
      specificKnowledge.slice(0, USER_KNOWN_TOPICS_STORAGE_MAX),
    )
    expect(normalized?.broadKnowledge).toEqual([])
  })

  it('refuses to add a new learned topic once the storage limit is reached, but still promotes a known one', () => {
    const specificKnowledge = Array.from(
      { length: USER_KNOWN_TOPICS_STORAGE_MAX },
      (_, index) => `Topic ${index + 1}`,
    )
    const context = {
      version: 1 as const,
      roles: [],
      broadKnowledge: [],
      specificKnowledge,
      confidence: 'self_reported' as const,
      updatedAt: '2026-06-23T00:00:00.000Z',
    }

    expect(addLearnedTopicToProfileContext('Brand New Topic', context)).toBeNull()

    const promoted = addLearnedTopicToProfileContext('Topic 500', context)
    expect(promoted?.specificKnowledge[0]).toBe('Topic 500')
    expect(promoted?.specificKnowledge).toHaveLength(
      USER_KNOWN_TOPICS_STORAGE_MAX,
    )
  })

  it('keeps a newly learned topic inside the AI topic cap', () => {
    const priorSpecificKnowledge = Array.from(
      { length: USER_KNOWN_TOPICS_DIRECT_MAX },
      (_, index) => `Topic ${index + 1}`,
    )
    saveProfileContext({
      roles: ['software_it'],
      broadKnowledge: ['Backend', 'Databases'],
      specificKnowledge: priorSpecificKnowledge,
    })

    const next = addLearnedTopicToProfileContext('Bottlenecks')

    expect(next?.specificKnowledge[0]).toBe('Bottlenecks')
    expect(next?.specificKnowledge).toHaveLength(USER_KNOWN_TOPICS_DIRECT_MAX + 1)
    expect(getUserKnownTopics(next)).toHaveLength(USER_KNOWN_TOPICS_DIRECT_MAX)
    expect(getUserKnownTopics(next)[0]).toBe('Bottlenecks')
  })

  it('promotes an already declared topic instead of duplicating it', () => {
    saveProfileContext({
      roles: [],
      broadKnowledge: [],
      specificKnowledge: ['MinIO', 'bottlenecks', 'S3'],
    })

    const next = addLearnedTopicToProfileContext('Bottlenecks')

    expect(next?.specificKnowledge).toEqual(['Bottlenecks', 'MinIO', 'S3'])
  })
})
