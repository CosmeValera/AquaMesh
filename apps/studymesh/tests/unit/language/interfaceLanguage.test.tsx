/// <reference types="@testing-library/jest-dom" />
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import { CONTENT_LANGUAGE_SETTINGS_KEY } from '../../../src/language/contentLanguage'
import {
  InterfaceLanguageProvider,
  useInterfaceText,
} from '../../../src/language/interfaceLanguage'

/**
 * `forceLanguage` is what keeps /try English whatever the visitor's browser
 * locale or stored setting says. The landing and pricing pages carry no
 * translations at all and the captured demo guides are English-only, so a
 * translated demo shell would be the only translated thing on the way in.
 */
const Probe = () => {
  const { language, setLanguage, t } = useInterfaceText()

  return (
    <div>
      <span data-testid="language">{language}</span>
      <span data-testid="create-guide">{t('demo.createGuide')}</span>
      <button type="button" onClick={() => setLanguage('fr')}>
        Switch to French
      </button>
    </div>
  )
}

describe('InterfaceLanguageProvider', () => {
  let storage: Record<string, string>

  beforeEach(() => {
    storage = {
      [CONTENT_LANGUAGE_SETTINGS_KEY]: JSON.stringify({
        interfaceLanguage: 'es',
      }),
    }
    vi.mocked(localStorage.getItem).mockImplementation(
      (key: string) => storage[key] ?? null,
    )
    vi.mocked(localStorage.setItem).mockImplementation(
      (key: string, value: string) => {
        storage[key] = value
      },
    )
  })

  // The control: without the pin the same stored setting must still win, so a
  // passing pin test cannot be explained by an English default somewhere.
  it('follows the stored interface language when nothing is pinned', () => {
    render(
      <InterfaceLanguageProvider>
        <Probe />
      </InterfaceLanguageProvider>,
    )

    expect(screen.getByTestId('language')).toHaveTextContent('es')
    expect(screen.getByTestId('create-guide')).toHaveTextContent('Crear guía')
  })

  it('pins the tree to the forced language over the stored one', () => {
    render(
      <InterfaceLanguageProvider forceLanguage="en">
        <Probe />
      </InterfaceLanguageProvider>,
    )

    expect(screen.getByTestId('language')).toHaveTextContent('en')
    expect(screen.getByTestId('create-guide')).toHaveTextContent('Create guide')
  })

  it('never lets a pinned surface rewrite the stored setting', () => {
    render(
      <InterfaceLanguageProvider forceLanguage="en">
        <Probe />
      </InterfaceLanguageProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: /switch to french/i }))

    expect(screen.getByTestId('create-guide')).toHaveTextContent('Create guide')
    // The visitor never asked for the change, so their own setting survives a
    // trip through the demo untouched.
    expect(JSON.parse(storage[CONTENT_LANGUAGE_SETTINGS_KEY])).toMatchObject({
      interfaceLanguage: 'es',
    })
  })
})
