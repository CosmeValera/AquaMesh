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
      interfaceLanguage: 'es',
      defaultContentLanguage: 'fr',
      autoDetectAiLanguage: true,
    })

    expect(resolveContentLanguage({ text: 'OK' })).toEqual({
      language: 'es',
      source: 'settings',
    })
  })

  it('does not classify single-word technical topics as natural-language prompts', () => {
    expect(detectContentLanguage('React')).toBeNull()
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

  it('falls back to settings when ELD cannot separate short close languages', () => {
    saveContentLanguageSettings({
      interfaceLanguage: 'es',
      defaultContentLanguage: 'es',
      autoDetectAiLanguage: true,
    })

    expect(
      resolveContentLanguage({
        text: 'aprender algo de ingles',
      }),
    ).toEqual({
      language: 'es',
      source: 'settings',
    })
  })

  it('derives default AI language from interface language and always auto-detects', () => {
    saveContentLanguageSettings({
      interfaceLanguage: 'es',
      defaultContentLanguage: 'de',
      autoDetectAiLanguage: false,
    })

    expect(
      window.localStorage.getItem(CONTENT_LANGUAGE_SETTINGS_KEY),
    ).toContain('"defaultContentLanguage":"es"')
    expect(readContentLanguageSettings()).toEqual({
      interfaceLanguage: 'es',
      defaultContentLanguage: 'es',
      autoDetectAiLanguage: true,
    })
    expect(
      resolveContentLanguage({
        text: 'OK',
      }),
    ).toEqual({
      language: 'es',
      source: 'settings',
    })
  })

  it('supports French and German interface languages as AI language defaults', () => {
    saveContentLanguageSettings({
      interfaceLanguage: 'fr',
      defaultContentLanguage: 'en',
      autoDetectAiLanguage: false,
    })

    expect(readContentLanguageSettings()).toEqual({
      interfaceLanguage: 'fr',
      defaultContentLanguage: 'fr',
      autoDetectAiLanguage: true,
    })
    expect(resolveContentLanguage({ text: 'OK' })).toEqual({
      language: 'fr',
      source: 'settings',
    })

    saveContentLanguageSettings({
      interfaceLanguage: 'de',
      defaultContentLanguage: 'en',
      autoDetectAiLanguage: false,
    })

    expect(readContentLanguageSettings()).toEqual({
      interfaceLanguage: 'de',
      defaultContentLanguage: 'de',
      autoDetectAiLanguage: true,
    })
    expect(resolveContentLanguage({ text: 'OK' })).toEqual({
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
