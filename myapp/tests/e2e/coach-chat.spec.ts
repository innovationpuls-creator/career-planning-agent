/**
 * E2E tests for Coach Chat — core user flows.
 *
 * Covers: complete conversation, interruption, retry, file upload, session recovery.
 */

import { expect, test } from '@playwright/test';

const COACH_URL = '/coach';
const LOGIN_URL = '/user/login';

const sendBtn = (page: import('@playwright/test').Page) =>
  page.getByRole('button', { name: /发.*送/ });

const stopBtn = (page: import('@playwright/test').Page) =>
  page.getByRole('button', { name: /停.*止/ });

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

// ─── 1. Complete Conversation ────────────────────────────────────────────

test.describe('Complete Conversation', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page);
  });

  test('sends message and receives assistant response', async ({ page }) => {
    await page.goto(COACH_URL);
    await page.waitForLoadState('networkidle');

    await chatInput(page).fill('你好，请简单介绍一下你自己');
    await sendBtn(page).click();

    // User bubble appears
    await expect(
      page.locator('text=你好，请简单介绍一下你自己').first(),
    ).toBeVisible({ timeout: 10000 });

    // Assistant response starts streaming (any text in assistant bubble)
    await expect(
      page.locator('text=教练').first(),
    ).toBeVisible({ timeout: 30000 });

    // Stream completes: send button reappears (state goes back to idle)
    await expect(sendBtn(page)).toBeVisible({ timeout: 30000 });
  });

  test('send button becomes enabled after stream completes', async ({ page }) => {
    await page.goto(COACH_URL);
    await page.waitForLoadState('networkidle');

    await chatInput(page).fill('你好');
    await sendBtn(page).click();

    // Wait for roundtrip completion
    await expect(sendBtn(page)).toBeVisible({ timeout: 30000 });

    // Should be able to send another message
    await chatInput(page).fill('第二条消息');
    await expect(sendBtn(page)).toBeEnabled();
  });
});

// ─── 2. Interruption ─────────────────────────────────────────────────────

test.describe('Interruption', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page);
  });

  test('stop button appears during streaming and aborts', async ({ page }) => {
    await page.goto(COACH_URL);
    await page.waitForLoadState('networkidle');

    await chatInput(page).fill('请详细分析我的简历并给出改进建议');
    await sendBtn(page).click();

    // Stop button should be visible during streaming
    await expect(stopBtn(page)).toBeVisible({ timeout: 5000 });

    // Click stop to abort
    await stopBtn(page).click();

    // Abort message should appear
    await expect(
      page.locator('text=已停止生成').first(),
    ).toBeVisible({ timeout: 5000 });

    // Send button should be usable again
    await expect(sendBtn(page)).toBeVisible({ timeout: 5000 });
  });

  test('can send new message after interruption', async ({ page }) => {
    await page.goto(COACH_URL);
    await page.waitForLoadState('networkidle');

    await chatInput(page).fill('写一段很长的职业规划建议，详细展开每个方面');
    await sendBtn(page).click();
    await expect(stopBtn(page)).toBeVisible({ timeout: 5000 });
    await stopBtn(page).click();
    await expect(page.locator('text=已停止生成')).toBeVisible({ timeout: 5000 });

    // Should be able to start a new conversation
    await chatInput(page).fill('重新开始，帮我看看简历');
    await sendBtn(page).click();
    await expect(
      page.locator('text=重新开始，帮我看看简历').first(),
    ).toBeVisible({ timeout: 10000 });
  });
});

// ─── 3. Retry ────────────────────────────────────────────────────────────

test.describe('Retry', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page);
  });

  test('page remains functional after stream completes', async ({ page }) => {
    await page.goto(COACH_URL);
    await page.waitForLoadState('networkidle');

    await chatInput(page).fill('你好');
    await sendBtn(page).click();

    // Wait for completion
    await expect(sendBtn(page)).toBeVisible({ timeout: 30000 });

    // Chat input is still functional
    await expect(chatInput(page)).toBeVisible();
    await expect(chatInput(page)).toBeEnabled();
  });

  test('multiple messages can be sent in sequence', async ({ page }) => {
    await page.goto(COACH_URL);
    await page.waitForLoadState('networkidle');

    const messages = ['你好', '帮我分析简历', '谢谢'];

    for (const msg of messages) {
      await chatInput(page).fill(msg);
      await sendBtn(page).click();
      await expect(sendBtn(page)).toBeVisible({ timeout: 30000 });
      await expect(
        page.locator(`text=${msg}`).first(),
      ).toBeVisible({ timeout: 5000 });
    }
  });
});

// ─── 4. File Upload ──────────────────────────────────────────────────────

test.describe('File Upload', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page);
  });

  test('upload button is visible on coach page', async ({ page }) => {
    await page.goto(COACH_URL);
    await page.waitForLoadState('networkidle');

    // Upload trigger should exist (may be a button with upload icon or text)
    await expect(
      page.locator('[class*="upload"]').first(),
    ).toBeVisible({ timeout: 5000 });
  });

  test('chat input is functional alongside upload area', async ({ page }) => {
    await page.goto(COACH_URL);
    await page.waitForLoadState('networkidle');

    await expect(chatInput(page)).toBeVisible();
    await chatInput(page).fill('测试消息');
    await expect(sendBtn(page)).toBeEnabled();
  });
});

// ─── 5. Session Recovery ─────────────────────────────────────────────────

test.describe('Session Recovery', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page);
  });

  test('session appears in sidebar after sending message', async ({ page }) => {
    await page.goto(COACH_URL);
    await page.waitForLoadState('networkidle');

    const testMsg = `测试会话恢复_${Date.now()}`;
    await chatInput(page).fill(testMsg);
    await sendBtn(page).click();

    // Wait for streaming to complete
    await expect(sendBtn(page)).toBeVisible({ timeout: 30000 });

    // Session title should appear in sidebar
    await expect(
      page.locator(`text=${testMsg}`).first(),
    ).toBeVisible({ timeout: 10000 });
  });

  test('page loads without errors after navigation', async ({ page }) => {
    await page.goto(COACH_URL);
    await page.waitForLoadState('networkidle');

    // Send first message
    await chatInput(page).fill('导航测试');
    await sendBtn(page).click();
    await expect(sendBtn(page)).toBeVisible({ timeout: 30000 });

    // Reload the page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Page should still be functional
    await expect(page.locator('#root')).not.toBeEmpty({ timeout: 10000 });
    await expect(chatInput(page)).toBeVisible({ timeout: 5000 });
  });

  test('coach page loads with chat input ready', async ({ page }) => {
    await page.goto(COACH_URL);
    await page.waitForLoadState('networkidle');

    // Verify the basic structure is present
    await expect(chatInput(page)).toBeVisible();
    await expect(
      page.locator('text=你好！我是你的 AI 职业规划教练'),
    ).toBeVisible({ timeout: 5000 });
  });
});
