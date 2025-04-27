import { test, expect } from '@playwright/test'

test.beforeEach('test & login', async ({ page }) => {
  await page.goto('http://localhost:3000/')

  const username = 'aquamesh_admin'
  const password = 'aquamesh'

  await page.fill('input[name="username"]', username)
  await page.fill('input[name="password"]', password)
  await page.click('input[name="login"]')

  await page.waitForURL('http://localhost:3000/')

  await page.waitForSelector('.loader', { state: 'hidden' })
})

test('Load', async ({ page }) => {
  expect(await page.screenshot()).toMatchSnapshot('load.png')
})

test.describe('TopNavBar', () => {
  test('Dashboards', async({ page }) => {
    await page.getByLabel('Dashboards').click()

    await page.getByText('Default views', { exact: true }).click()

    await page.waitForTimeout(1000)
    expect(await page.screenshot()).toMatchSnapshot('dashboards.png')
  })
    
  test('Widgets', async({ page }) => {
    await page.getByLabel('Widgets').click()

    await page.getByText('System lens', { exact: true }).click()
    await page.getByText('Control Flow', { exact: true }).click()

    await page.waitForTimeout(1000)
    expect(await page.screenshot()).toMatchSnapshot('widgets.png')
  })
})

test.describe('Add new', () => {
  test('Add New', async({ page }) => {
    await page.getByText('ADD NEW').click()
    expect(await page.screenshot()).toMatchSnapshot('addNew.png')
  })
})


test('Logout', async ({ page }) => {
  await page.getByRole('button', { name: 'LOGOUT' }).click()

  await page.waitForURL(/http:\/\/localhost:8180\/.*/)

  await expect(page.locator('h1#kc-page-title')).toHaveText('Sign in to your account')

  expect(await page.screenshot()).toMatchSnapshot('logout.png')
})
