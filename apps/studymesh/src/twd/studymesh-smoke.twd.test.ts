import { expect, screenDom, screenDomGlobal, twd, userEvent } from 'twd-js'
import { beforeEach, describe, it } from 'twd-js/runner'

const TWD_EMAIL_KEY = 'studymeshTwdEmail'
const TWD_PASSWORD_KEY = 'studymeshTwdPassword'
const TWD_NAME_KEY = 'studymeshTwdName'

const defaultCredentials = {
  email: 'studymesh-twd@example.com',
  password: 'StudyMeshTwd123!',
  name: 'RabbitHole TWD',
}

// Mirrors the chip labels of DEMO_GUIDES in src/demo/demoGuides.ts.
const demoChipLabels = [
  'Why you forget',
  'Deliberate practice',
  'Bottlenecks in your learning',
  'Compound interest',
  'How your immune system works',
]

const getCredentials = () => ({
  email: window.localStorage.getItem(TWD_EMAIL_KEY) || defaultCredentials.email,
  password:
    window.localStorage.getItem(TWD_PASSWORD_KEY) ||
    defaultCredentials.password,
  name: window.localStorage.getItem(TWD_NAME_KEY) || defaultCredentials.name,
})

const setLocalStorageEmailAndPassword = () => {
  window.localStorage.setItem(TWD_EMAIL_KEY, defaultCredentials.email)
  window.localStorage.setItem(TWD_PASSWORD_KEY, defaultCredentials.password)
  window.localStorage.setItem(TWD_NAME_KEY, defaultCredentials.name)
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

  await user.type(
    (await twd.get('input[autocomplete="name"]')).el,
    credentials.name,
  )
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
  expect(
    (await screenDom.findAllByText(/Dashboards/i)).length,
  ).to.be.greaterThan(0)
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

  await twd.waitFor(
    () => {
      if (window.location.pathname === '/workspace') {
        return
      }

      const alert = document.querySelector('[role="alert"]')
      expect(alert?.textContent || '').not.to.equal('')
    },
    { timeout: 8000, message: 'workspace route or login error' },
  )

  if (window.location.pathname !== '/workspace') {
    await signupToyProfile()
    return
  }

  await assertWorkspaceLoaded()
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

describe('RabbitHole TWD landing smoke', () => {
  beforeEach(() => {
    setLocalStorageEmailAndPassword()
  })

  it('landing points visitors at the prepared demo', async () => {
    await twd.visit('/', true)

    expect(await screenDom.findByText(/explain it with/i)).to.exist

    // The CTA is a real link, not an in-app route change: /try is its own page
    // load. Following it here would reload the document out from under this
    // in-page runner, so the click-through lives in the Playwright spec and
    // this only checks where the CTA points.
    const tryCta = (
      await screenDom.findAllByRole('link', {
        name: /try it/i,
      })
    )[0]
    expect(tryCta.getAttribute('href')).to.equal('/try')

    await twd.visit('/try', true)

    // Stops at the topic picker: the prompt is locked because the demo runs on
    // prepared prompts, and opening a guide costs a 5s fake generation that
    // belongs in the Playwright spec, not in a smoke test.
    const promptPanel = await screenDom.findByTestId('demo-prompt-panel')
    expect(promptPanel.textContent || '').to.match(/pick a topic above/i)

    for (const label of demoChipLabels) {
      expect(await screenDom.findByRole('button', { name: label })).to.exist
    }
  })
})

describe('RabbitHole TWD auth form smoke', () => {
  beforeEach(() => {
    setLocalStorageEmailAndPassword()
  })

  it('opens signup and fills the form without submitting', async () => {
    await twd.visit('/login?redirect=%2Fworkspace', true)

    await userEvent.click(
      await screenDom.findByRole('link', { name: /create an account/i }),
    )

    expect(await screenDom.findByRole('heading', { name: /create account/i }))
      .to.exist

    await fillSignupForm()

    const nameInput = await twd.get('input[autocomplete="name"]')
    const emailInput = await twd.get('input[type="email"]')

    nameInput.should('have.value', getCredentials().name)
    emailInput.should('have.value', getCredentials().email)
  })
})

describe('RabbitHole TWD signup smoke', () => {
  beforeEach(() => {
    setLocalStorageEmailAndPassword()
  })

  it('creates a toy RabbitHole profile and opens the workspace', async () => {
    await signupToyProfile()
  })
})

describe('RabbitHole TWD login smoke', () => {
  beforeEach(() => {
    setLocalStorageEmailAndPassword()
  })

  it('logs into the toy RabbitHole profile and opens the workspace', async () => {
    await loginToyProfile()
  })
})

describe('RabbitHole TWD settings smoke', () => {
  beforeEach(() => {
    setLocalStorageEmailAndPassword()
  })

  it('opens Application Settings and shows AI provider controls', async () => {
    await loginToyProfile()
    await openApplicationSettings()

    expect(await screenDomGlobal.findByText(/AI Provider Settings/i)).to.exist
    expect(
      (await screenDomGlobal.findAllByLabelText(/AI provider/i)).length,
    ).to.be.greaterThan(0)
    expect(
      await screenDomGlobal.findByRole('button', {
        name: /save ai settings/i,
      }),
    ).to.exist
  })
})

describe('RabbitHole TWD profile cleanup smoke', () => {
  beforeEach(() => {
    setLocalStorageEmailAndPassword()
  })

  it('deletes the toy RabbitHole profile row and returns to login', async () => {
    await loginToyProfile()
    await openApplicationSettings()

    const user = userEvent.setup()
    await user.type(
      await screenDomGlobal.findByLabelText(/type delete to confirm/i),
      'DELETE',
    )
    await user.click(
      await screenDomGlobal.findByRole('button', {
        name: /^delete rabbithole account$/i,
      }),
    )
    await user.click(
      await screenDomGlobal.findByRole('button', {
        name: /i understand, delete my account data/i,
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
