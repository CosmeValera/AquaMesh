import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  CONTENT_LANGUAGE_SETTINGS_KEY,
  detectContentLanguage,
  readContentLanguageSettings,
  resolveContentLanguage,
  saveContentLanguageSettings,
} from '../../../src/language/contentLanguage'
import {
  buildStudyGuideQuickStartPrompt,
  buildStudyGuideQuickStartRelevancePrompt,
} from '../../../src/studyGuides/quickStart'

describe('content language resolver', () => {
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
    vi.mocked(localStorage.clear).mockImplementation(() => {
      storage = {}
    })
  })

  it('detects prompt language without using network or AI calls', () => {
    const fetchSpy = vi.fn()
    const originalFetch = globalThis.fetch
    globalThis.fetch = fetchSpy

    expect(
      detectContentLanguage(
        'Crea una guia de estudio sobre derivadas y limites para bachillerato',
      ),
    ).toBe('es')
    expect(fetchSpy).not.toHaveBeenCalled()
    globalThis.fetch = originalFetch
  })

  it('uses settings when short prompts are ambiguous', () => {
    saveContentLanguageSettings({
      defaultContentLanguage: 'fr',
      autoDetectAiLanguage: true,
    })

    expect(resolveContentLanguage({ text: 'OK' })).toEqual({
      language: 'fr',
      source: 'settings',
    })
  })

  it('lets explicit output-language wording override detected prompt language', () => {
    expect(
      resolveContentLanguage({
        text: 'Create a study guide about derivatives. Answer in Spanish.',
      }),
    ).toEqual({
      language: 'es',
      source: 'explicit',
    })
  })

  it('detects the prompt language instead of the language being studied', () => {
    expect(
      resolveContentLanguage({
        text: 'Ayúdame a aprender un poquito de francés',
      }),
    ).toEqual({
      language: 'es',
      source: 'detected',
    })
    expect(
      resolveContentLanguage({
        text: 'quiero aprender inglés',
      }),
    ).toEqual({
      language: 'es',
      source: 'detected',
    })
    expect(
      resolveContentLanguage({
        text: 'je veux apprendre allemand',
      }),
    ).toEqual({
      language: 'fr',
      source: 'detected',
    })
  })

  it('does not let technical terms push Spanish prompts into a nearby language', () => {
    expect(
      resolveContentLanguage({
        text: 'Qué es realmente la tecnología de software de Docker?',
      }),
    ).toEqual({
      language: 'es',
      source: 'detected',
    })
  })

  it('persists default language and auto-detection preference', () => {
    saveContentLanguageSettings({
      defaultContentLanguage: 'de',
      autoDetectAiLanguage: false,
    })

    expect(window.localStorage.getItem(CONTENT_LANGUAGE_SETTINGS_KEY)).toContain(
      '"defaultContentLanguage":"de"',
    )
    expect(readContentLanguageSettings()).toEqual({
      defaultContentLanguage: 'de',
      autoDetectAiLanguage: false,
    })
    expect(
      resolveContentLanguage({
        text: 'Crea una guia de estudio sobre derivadas y limites.',
      }),
    ).toEqual({
      language: 'de',
      source: 'settings',
    })
  })

  it('adds target language instructions to Study Guide Quick Start TLDR prompts', () => {
    const quickStartPrompt = buildStudyGuideQuickStartPrompt({
      title: 'Derivadas',
      source: 'Contenido de la guia',
      outputLanguage: 'es',
    })
    const relevancePrompt = buildStudyGuideQuickStartRelevancePrompt({
      title: 'Derivadas',
      prompt: 'Quiero aprender derivadas',
      source: 'Contenido de la guia',
      userKnownTopics: ['algebra'],
      outputLanguage: 'es',
    })

    expect(quickStartPrompt).toContain('Output language: Spanish')
    expect(quickStartPrompt).toContain('keyIdea')
    expect(quickStartPrompt).toContain('quickSummary')
    expect(relevancePrompt).toContain('Output language: Spanish')
  })
})
