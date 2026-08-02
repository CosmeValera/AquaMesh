import { test, expect, type Page } from '@playwright/test'

/**
 * The prepared demo at /try. Every page, quiz, deck, podcast and chat answer in
 * it is frozen data rendered by the real workspace components, so this spec can
 * walk the whole thing end to end without spending a generation or an account.
 *
 * The assertion that matters most is in afterEach: a demo run must never reach
 * a serverless route.
 */

const APP_URL = 'http://localhost:3000'
const DEMO_SLUG = 'why-you-forget'

// Mirrors the first entry of DEMO_GUIDES in src/demo/demoGuides.ts. Importing
// the registry here would make Playwright resolve the per-guide data chunks it
// lazily imports, so the two labels are kept in sync by hand.
const DEMO_CHIP_LABEL = 'Why you forget'

const LESSON_PAGE_COUNT = 3
const PREPARED_CHAT_QUESTIONS = 3

// The fake Quick Create waits are 9s (quiz), 6s (flashcards) and 13s (podcast),
// on top of the 5s fake generation.
const QUICK_CREATE_TIMEOUT_MS = 60_000

// The demo renders its copy through the interface language layer, which follows
// the browser locale.
test.use({ locale: 'en-US' })

let apiRequests: string[] = []

const pageRows = (page: Page) => page.getByTestId(/^study-guide-page-row-\d+$/)

/**
 * The chat panel's own Paper. Used to scope selectors that would otherwise be
 * ambiguous against the guide surface next to it.
 */
const chatPanel = (page: Page) =>
  page
    .getByTestId('dashboard-chat-composer')
    .locator('xpath=ancestor::div[contains(@class, "MuiPaper-root")][1]')

/**
 * The three prepared questions offered while the transcript is empty. They are
 * guide data, so they are located structurally rather than by label.
 */
const chatSuggestions = (page: Page) =>
  chatPanel(page).locator('button.MuiButton-outlined')

const openDemoGuide = async (page: Page) => {
  await page.goto(`${APP_URL}/`)

  // The CTA is a link: /try is its own page load, not an in-app route change.
  await page
    .getByRole('link', { name: /try it/i })
    .first()
    .click()
  await page.waitForURL(`${APP_URL}/try`)

  await page.getByRole('button', { name: DEMO_CHIP_LABEL, exact: true }).click()
  await page.getByRole('button', { name: /^create guide$/i }).click()

  await expect(page.getByText(/generating your guide/i)).toBeVisible()
  await page.waitForURL(`${APP_URL}/try/${DEMO_SLUG}`, { timeout: 20_000 })

  await expect(pageRows(page)).toHaveCount(LESSON_PAGE_COUNT, {
    timeout: 20_000,
  })
}

const runDemoQuickCreate = async (
  page: Page,
  actionId: string,
  actionLabel: string,
) => {
  await chatPanel(page)
    .getByRole('button', { name: /^create$/i })
    .click()
  // The Quick Create menu is a portal, so it is outside the chat panel.
  await page.getByRole('button', { name: actionLabel, exact: true }).click()

  const pendingTask = page.getByTestId(
    `dashboard-chat-quick-create-task-${actionId}`,
  )
  await expect(pendingTask).toBeVisible()
  await expect(pendingTask).toHaveCount(0, { timeout: QUICK_CREATE_TIMEOUT_MS })
}

test.beforeEach(async ({ page }) => {
  apiRequests = []
  page.on('request', (request) => {
    const { pathname } = new URL(request.url())
    if (pathname.startsWith('/api/')) {
      apiRequests.push(`${request.method()} ${request.url()}`)
    }
  })

  await page.setViewportSize({ width: 1440, height: 900 })
})

test.afterEach(() => {
  // The demo is canned all the way down: no hosted generation, no podcast
  // token, no web lookup, no chat call. One request to /api/ means a visitor
  // without an account reached a serverless route, which is the failure mode
  // this whole feature exists to avoid.
  expect(
    apiRequests,
    `the demo reached ${apiRequests.length} API route(s): ${apiRequests.join(
      ', ',
    )}`,
  ).toEqual([])
})

test.describe('Prepared demo', () => {
  test('walks a whole prepared guide without calling an API', async ({
    page,
  }) => {
    test.setTimeout(180_000)

    await openDemoGuide(page)

    // The real workspace, not a mockup: the page rail and the Quick Start card
    // are the same components a signed-in guide renders.
    await expect(
      page.getByTestId('study-guide-pages-panel-desktop'),
    ).toBeVisible()
    await expect(page.getByTestId('study-guide-quick-start-card')).toBeVisible()

    // TopNavBar falls back to "Admin" whenever localStorage has no userData,
    // which is exactly the state a demo visitor is in. DemoTopNavBar exists so
    // that fallback can never be shown.
    await expect(page.getByTestId('demo-log-in')).toBeVisible()
    await expect(page.getByTestId('demo-guest-identity')).toBeVisible()
    await expect(page.locator('header').first()).not.toContainText(/admin/i)

    await expect(chatSuggestions(page)).toHaveCount(PREPARED_CHAT_QUESTIONS)
    await chatSuggestions(page).first().click()

    await expect(page.locator('.studymesh-user-message')).toHaveCount(1)
    // The copy action only renders once an assistant message has stopped
    // pending, so it is the signal that the canned answer landed.
    await expect(
      chatPanel(page).getByRole('button', { name: /copy answer/i }),
    ).toBeVisible({ timeout: 20_000 })

    await runDemoQuickCreate(page, 'quiz', 'Quiz')
    await expect(pageRows(page)).toHaveCount(LESSON_PAGE_COUNT + 1)

    // The demo does not persist progress: a reload replays the guide fresh,
    // with none of the created bonus pages carried over.
    await page.reload()
    await expect(pageRows(page)).toHaveCount(LESSON_PAGE_COUNT, {
      timeout: 20_000,
    })

    await runDemoQuickCreate(page, 'podcast', 'Podcast')
    await expect(pageRows(page)).toHaveCount(LESSON_PAGE_COUNT + 1)

    // The audio is a static file under public/, so preparePodcastAudio must
    // have skipped the signed-URL call entirely.
    const audio = page.locator('audio')
    await expect(audio).toHaveCount(1, { timeout: 30_000 })
    await expect
      .poll(
        () =>
          audio.evaluate((element) => (element as HTMLAudioElement).currentSrc),
        { timeout: 20_000 },
      )
      .toContain('/demo/audio/')
  })

  test('sends an unknown demo slug back to the topic picker', async ({
    page,
  }) => {
    await page.goto(`${APP_URL}/try/not-a-demo-guide`)

    await page.waitForURL(`${APP_URL}/try`)
    await expect(
      page.getByRole('button', { name: DEMO_CHIP_LABEL, exact: true }),
    ).toBeVisible()
  })
})
