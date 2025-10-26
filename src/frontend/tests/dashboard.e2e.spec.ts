import { expect, test } from '@playwright/test'

const EMAIL = process.env.E2E_EMAIL ?? 'admin@example.com'
const PASSWORD = process.env.E2E_PASSWORD ?? 'adminpass'

test.describe('Dashboard realtime metrics', () => {
  test('logs in and observes active WebSocket stream', async ({ page }) => {
    await page.goto('/')

    await page.getByLabel('Email').fill(EMAIL)
    await page.getByLabel('Password').fill(PASSWORD)
    await page.getByRole('button', { name: 'Sign in' }).click()

    await page.waitForURL('**/dashboard', { timeout: 15_000 })

    const connectedStatus = page
      .getByRole('article')
      .filter({ hasText: 'CPU 使用率' })
      .getByText('接続済み')

    await expect(connectedStatus).toBeVisible({ timeout: 30_000 })

    const latestValue = page
      .getByRole('article')
      .filter({ hasText: 'CPU 使用率' })
      .getByText('最新値', { exact: false })
    await expect(latestValue).toBeVisible()
  })
})
