import { expect, screenDom, twd, userEvent } from 'twd-js'
import { beforeEach, describe, it } from 'twd-js/runner'

const clearBrowserState = () => {
  window.localStorage.clear()
  window.sessionStorage.clear()
}

describe('StudyMesh auth and landing smoke', () => {
  beforeEach(() => {
    clearBrowserState()
  })

  it('shows the landing CTA and sends guests to sign in', async () => {
    await twd.visit('/', true)

    const headline = await screenDom.findByText(/turn messy notes into/i)
    expect(headline).to.exist

    const ctaButtons = await screenDom.findAllByRole('button', {
      name: /try studymesh/i,
    })
    expect(ctaButtons.length).to.be.greaterThan(0)

    const user = userEvent.setup()
    await user.click(ctaButtons[0])

    await twd.waitFor(() => {
      expect(window.location.pathname).to.equal('/login')
      expect(new URLSearchParams(window.location.search).get('redirect')).to.eq(
        '/workspace',
      )
    })

    const signInHeading = await screenDom.findByRole('heading', {
      name: /^sign in$/i,
    })
    expect(signInHeading).to.exist
  })

  it('redirects protected workspace access to login with return path', async () => {
    await twd.visit('/workspace', true)

    await twd.waitFor(() => {
      expect(window.location.pathname).to.equal('/login')
    expect(new URLSearchParams(window.location.search).get('redirect')).to.eq(
        '/workspace',
      )
    })

    expect(await screenDom.findByRole('heading', { name: /^sign in$/i })).to
      .exist
    const emailInput = await twd.get('input[type="email"]')
    const passwordInput = await twd.get('input[type="password"]')
    emailInput.should('be.visible')
    passwordInput.should('be.visible')
  })

  it('keeps auth navigation available from login', async () => {
    await twd.visit('/login?redirect=%2Fworkspace', true)

    expect(await screenDom.findByRole('heading', { name: /^sign in$/i })).to
      .exist
    expect(await screenDom.findByRole('button', { name: /continue with google/i }))
      .to.exist
    expect(await screenDom.findByRole('link', { name: /create an account/i })).to
      .exist
    expect(await screenDom.findByRole('link', { name: /forgot password/i })).to
      .exist
  })
})
