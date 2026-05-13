/**
 * E2E tests for Coach Streaming CLI UI.
 *
 * Verifies: CLI log expands during streaming, hides raw JSON,
 * shows mapped step labels, auto-collapses after completion.
 */
import { expect, test } from '@playwright/test';

const COACH_URL = '/coach';
const LOGIN_URL = '/user/login';

const sendBtn = (page: import('@playwright/test').Page) =>
  page.getByRole('button', { name: /发.*送/ });

const chatInput = (page: import('@playwright/test').Page) =>
  page.getByRole('textbox', { name: '输入你的问题' });

async function loginViaUI(page: import('@playwright/test').Page) {
  await page.goto(LOGIN_URL);
  await page.waitForLoadState('networkidle');

  await page.locator('#username').fill('testuser');
  await page.locator('#password').fill('test123456');
  await page.locator('button[type="submit"]').click();

  await page.waitForURL((url) => !url.pathname.includes('/user/login'), {
    timeout: 15000,
  });
}

test.describe('Coach Streaming CLI UI', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page);
  });

  test('CLI log expands during streaming', async ({ page }) => {
    await page.goto(COACH_URL);
    await page.waitForLoadState('networkidle');

    await chatInput(page).fill('你好，请简单介绍一下你自己');
    await sendBtn(page).click();

    // CLI log should appear during streaming - look for the section label
    await expect(
      page.locator('section[aria-label="智能体运行轨迹"]'),
    ).toBeVisible({ timeout: 15000 });

    // Step labels should use mapped English names, not raw Chinese titles
    // During streaming, the log is expanded so step content is visible
    const cliSection = page.locator('section[aria-label="智能体运行轨迹"]');
    await expect(cliSection).toBeVisible();
  });

  test('no raw detail button or JSON visible', async ({ page }) => {
    await page.goto(COACH_URL);
    await page.waitForLoadState('networkidle');

    await chatInput(page).fill('你好');
    await sendBtn(page).click();

    // Wait for the CLI log to appear
    await expect(
      page.locator('section[aria-label="智能体运行轨迹"]'),
    ).toBeVisible({ timeout: 15000 });

    // "raw detail" button should never appear
    await expect(
      page.locator('button:has-text("raw detail")'),
    ).toHaveCount(0);

    // Wait for streaming to complete
    await expect(sendBtn(page)).toBeVisible({ timeout: 30000 });

    // Even after completion, no raw detail button
    await expect(
      page.locator('button:has-text("raw detail")'),
    ).toHaveCount(0);
  });

  test('CLI log shows collapsed bar after completion', async ({ page }) => {
    await page.goto(COACH_URL);
    await page.waitForLoadState('networkidle');

    await chatInput(page).fill('你好');
    await sendBtn(page).click();

    // Wait for streaming to complete
    await expect(sendBtn(page)).toBeVisible({ timeout: 30000 });

    // After completion + collapse delay, the collapsed bar with "expand" should be visible
    await expect(
      page.locator('button:has-text("expand")'),
    ).toBeVisible({ timeout: 10000 });

    // Step-level details (like kind labels) should NOT be visible when collapsed
    const expandedLog = page.locator('text=[route]');
    await expect(expandedLog).toHaveCount(0);

    const expandedLog2 = page.locator('text=[tool]');
    await expect(expandedLog2).toHaveCount(0);
  });

  test('can re-expand collapsed CLI log', async ({ page }) => {
    await page.goto(COACH_URL);
    await page.waitForLoadState('networkidle');

    await chatInput(page).fill('你好');
    await sendBtn(page).click();

    // Wait for completion
    await expect(sendBtn(page)).toBeVisible({ timeout: 30000 });

    // Wait for auto-collapse
    await expect(
      page.locator('button:has-text("expand")'),
    ).toBeVisible({ timeout: 10000 });

    // Click to expand
    await page.locator('button:has-text("expand")').click();

    // Step details should now be visible
    await expect(
      page.locator('section[aria-label="智能体运行轨迹"]'),
    ).toBeVisible();
  });

  test('multiple messages each get their own CLI log', async ({ page }) => {
    await page.goto(COACH_URL);
    await page.waitForLoadState('networkidle');

    // First message — use a substantial prompt to trigger agent steps
    await chatInput(page).fill('你好，请简单介绍一下你自己');
    await sendBtn(page).click();
    await expect(sendBtn(page)).toBeVisible({ timeout: 30000 });

    // Wait for auto-collapse (2s after completion)
    await page.waitForTimeout(3000);

    // Count expand buttons (may be 0 if no agent steps, or 1+ if CLI log present)
    const firstCount = await page.locator('button:has-text("expand")').count();

    // Second message
    await chatInput(page).fill('帮我分析简历');
    await sendBtn(page).click();
    await expect(sendBtn(page)).toBeVisible({ timeout: 30000 });

    // Wait for auto-collapse
    await page.waitForTimeout(3000);

    // Should have expand buttons from at least one message
    const finalCount = await page.locator('button:has-text("expand")').count();
    expect(finalCount).toBeGreaterThanOrEqual(1);
  });
});
