import { expect, screenDom, screenDomGlobal, twd, userEvent } from 'twd-js'
import { beforeEach, describe, it } from 'twd-js/runner'

const TWD_EMAIL_KEY = 'studymeshTwdEmail'
const TWD_PASSWORD_KEY = 'studymeshTwdPassword'
const TWD_NAME_KEY = 'studymeshTwdName'

const defaultCredentials = {
  email: 'studymesh-twd@example.com',
  password: 'StudyMeshTwd123!',
  name: 'StudyMesh TWD',
}

const getCredentials = () => ({
  email: window.localStorage.getItem(TWD_EMAIL_KEY) || defaultCredentials.email,
  password:
    window.localStorage.getItem(TWD_PASSWORD_KEY) ||
    defaultCredentials.password,
  name: window.localStorage.getItem(TWD_NAME_KEY) || defaultCredentials.name,
})

const clearBrowserState = () => {
  const credentials = getCredentials()
  window.localStorage.clear()
  window.sessionStorage.clear()
  window.localStorage.setItem(TWD_EMAIL_KEY, credentials.email)
  window.localStorage.setItem(TWD_PASSWORD_KEY, credentials.password)
  window.localStorage.setItem(TWD_NAME_KEY, credentials.name)
}

const fillLoginForm = async () => {
  const credentials = getCredentials()
  const user = userEvent.setup()
  await user.type((await twd.get('input[type="email"]')).el, credentials.email)
  await user.type(
    (await twd.get('input[type="password"]')).el,
    credentials.password,
  )
}

const fillSignupForm = async () => {
  const credentials = getCredentials()
  const user = userEvent.setup()
  const passwordInputs = await twd.getAll('input[type="password"]')

  await user.type((await twd.get('input[autocomplete="name"]')).el, credentials.name)
  await user.type((await twd.get('input[type="email"]')).el, credentials.email)
  await user.type(passwordInputs[0].el, credentials.password)
  await user.type(passwordInputs[1].el, credentials.password)
}

const assertWorkspaceLoaded = async () => {
  await twd.waitFor(
    () => {
      expect(window.location.pathname).to.equal('/workspace')
    },
    { timeout: 12000, message: 'workspace route' },
  )

  expect(await screenDom.findByText(/Creation/i)).to.exist
  expect((await screenDom.findAllByText(/Dashboards/i)).length).to.be.greaterThan(0)
}

const signupToyProfile = async () => {
  await twd.visit('/signup?redirect=%2Fworkspace', true)
  await fillSignupForm()

  await userEvent.click(
    await screenDom.findByRole('button', { name: /^create account$/i }),
  )

  await assertWorkspaceLoaded()
}

const loginToyProfile = async () => {
  await twd.visit('/login?redirect=%2Fworkspace', true)

  await twd.waitFor(
    () => {
      if (window.location.pathname === '/workspace') {
        return
      }

      const emailInput = document.querySelector('input[type="email"]')
      expect(emailInput).to.exist
    },
    { timeout: 12000, message: 'login form or existing workspace session' },
  )

  if (window.location.pathname === '/workspace') {
    await assertWorkspaceLoaded()
    return
  }

  await fillLoginForm()
  await userEvent.click(
    await screenDom.findByRole('button', { name: /^sign in$/i }),
  )

  try {
    await assertWorkspaceLoaded()
  } catch {
    await signupToyProfile()
  }
}

const openApplicationSettings = async () => {
  const user = userEvent.setup()
  await user.click((await twd.get('button[aria-label="Open user menu"]')).el)
  await user.click(
    await screenDomGlobal.findByRole('menuitem', { name: /^settings$/i }),
  )

  expect(
    await screenDomGlobal.findByRole('heading', {
      name: /application settings/i,
    }),
  ).to.exist
}

describe('StudyMesh TWD landing smoke', () => {
  beforeEach(() => {
    clearBrowserState()
  })

  it('landing sends guests to login', async () => {
    await twd.visit('/', true)

    expect(await screenDom.findByText(/turn messy notes into/i)).to.exist

    await userEvent.click(
      (await screenDom.findAllByRole('button', { name: /try studymesh/i }))[0],
    )

    await twd.waitFor(() => {
      expect(window.location.pathname).to.equal('/login')
      expect(new URLSearchParams(window.location.search).get('redirect')).to.eq(
        '/workspace',
      )
    })
  })
})

describe('StudyMesh TWD auth form smoke', () => {
  beforeEach(() => {
    clearBrowserState()
  })

  it('opens signup and fills the form without submitting', async () => {
    await twd.visit('/login?redirect=%2Fworkspace', true)

    await userEvent.click(
      await screenDom.findByRole('link', { name: /create an account/i }),
    )

    expect(
      await screenDom.findByRole('heading', { name: /create account/i }),
    ).to.exist

    await fillSignupForm()

    const nameInput = await twd.get('input[autocomplete="name"]')
    const emailInput = await twd.get('input[type="email"]')

    nameInput.should('have.value', getCredentials().name)
    emailInput.should('have.value', getCredentials().email)
  })
})

describe('StudyMesh TWD signup smoke', () => {
  beforeEach(() => {
    clearBrowserState()
  })

  it('creates a toy StudyMesh profile and opens the workspace', async () => {
    await signupToyProfile()
  })
})

describe('StudyMesh TWD login smoke', () => {
  beforeEach(() => {
    clearBrowserState()
  })

  it('logs into the toy StudyMesh profile and opens the workspace', async () => {
    await loginToyProfile()
  })
})

describe('StudyMesh TWD settings smoke', () => {
  beforeEach(() => {
    clearBrowserState()
  })

  it('opens Application Settings and shows AI provider controls', async () => {
    await loginToyProfile()
    await openApplicationSettings()

    expect(await screenDomGlobal.findByText(/AI Provider Settings/i)).to.exist
    expect(await screenDomGlobal.findByLabelText(/AI provider/i)).to.exist
    expect(
      await screenDomGlobal.findByRole('button', {
        name: /save ai settings/i,
      }),
    ).to.exist
  })
})

describe('StudyMesh TWD profile cleanup smoke', () => {
  beforeEach(() => {
    clearBrowserState()
  })

  it('deletes the toy StudyMesh profile row and returns to login', async () => {
    await loginToyProfile()
    await openApplicationSettings()

    const user = userEvent.setup()
    await user.type(
      await screenDomGlobal.findByLabelText(/type delete to confirm/i),
      'DELETE',
    )
    await user.click(
      await screenDomGlobal.findByRole('button', {
        name: /^delete studymesh profile$/i,
      }),
    )

    await twd.waitFor(
      () => {
        expect(window.location.pathname).to.equal('/login')
      },
      { timeout: 12000, message: 'return to login after profile delete' },
    )
  })
})
