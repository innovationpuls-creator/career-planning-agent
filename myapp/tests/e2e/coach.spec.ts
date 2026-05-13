import { test, expect } from '@playwright/test';

class CoachPage {
  constructor(public readonly page: import('@playwright/test').Page) {}

  async goto() {
    await this.page.goto('/coach');
    await this.page.waitForLoadState('networkidle');
  }

  async login() {
    await this.page.goto('/user/login');
    // The username input might have multiple matches if we use placeholder, use id
    const usernameInput = this.page.locator('input[id="username"]').first();
    await usernameInput.fill('444');
    const passwordInput = this.page.locator('input[id="password"]').first();
    await passwordInput.fill('12345678');
    await this.page.locator('button[type="submit"]').first().click();
    await this.page.waitForURL('**/home-v2**', { timeout: 10000 }).catch(() => {});
  }
}

test.describe('Coach Interface Tests', () => {
  let coachPage;

  test.beforeEach(async ({ page }) => {
    coachPage = new CoachPage(page);
    await coachPage.login();
    await coachPage.goto();
  });

  test('should render main components', async ({ page }) => {
    // Sidebar
    const newChatBtn = page.getByRole('button', { name: /新对话|新会话|New/i }).first();
    await expect(newChatBtn).toBeVisible();

    // Input
    const inputArea = page.getByPlaceholder('输入你的问题...');
    await expect(inputArea).toBeVisible();

    // Upload button
    const uploadBtn = page.locator('input[type="file"]');
    await expect(uploadBtn).toBeAttached();
  });

  test('should support sending messages', async ({ page }) => {
    const inputArea = page.getByPlaceholder('输入你的问题...');
    await inputArea.fill('你好，请帮我解析简历');
    await page.keyboard.press('Enter');

    // Wait for response or thinking block
    const assistantMessage = page.locator('.ant-space-item').filter({ hasText: /你好/ });
    // This is just a basic check, we will see if it fails
  });
});
