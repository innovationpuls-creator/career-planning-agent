import { expect, test } from '@playwright/test';

const BASE = 'http://localhost:8000';

test.describe('Header Redesign', () => {
  test.beforeEach(async ({ page }) => {
    // Login as regular user
    await page.goto(`${BASE}/user/login`);
    await page.waitForLoadState('networkidle');
    await page.getByRole('textbox', { name: /username/i }).fill('testuser');
    await page.getByRole('textbox', { name: /password/i }).fill('test123456');
    await page.getByRole('button', { name: /login/i }).click();
    await page.waitForURL((url) => !url.pathname.includes('/user/login'), {
      timeout: 15000,
    });
  });

  test('header renders three-zone layout on home page', async ({ page }) => {
    await page.goto(`${BASE}/home-v2`);
    await page.waitForLoadState('networkidle');

    const header = page.locator('header[class*="appHeader"]');
    await expect(header).toBeVisible({ timeout: 10000 });

    // Brand area
    await expect(page.getByText('大学生职业规划智能体')).toBeVisible();
    await expect(page.getByText('AI赋能职业成长每一步')).toBeVisible();

    // Screenshot the header
    await header.screenshot({
      path: 'docs/images/test/Header/header-full.png',
    });

    // Full page screenshot for context
    await page.screenshot({
      path: 'docs/images/test/Header/header-with-page.png',
      fullPage: false,
    });
  });

  test('nav items have correct active state styling', async ({ page }) => {
    await page.goto(`${BASE}/home-v2`);
    await page.waitForLoadState('networkidle');

    const header = page.locator('header[class*="appHeader"]');
    await expect(header).toBeVisible({ timeout: 10000 });

    const activeNav = page.getByRole('button', { name: /职业规划/ });
    await expect(activeNav).toBeVisible();

    const navArea = header.locator('nav');
    await navArea.screenshot({
      path: 'docs/images/test/Header/nav-active-state.png',
    });
  });

  test('font rendering check - capture computed styles', async ({ page }) => {
    await page.goto(`${BASE}/home-v2`);
    await page.waitForLoadState('networkidle');

    const header = page.locator('header[class*="appHeader"]');
    await expect(header).toBeVisible({ timeout: 10000 });

    // Check brand title computed font
    const brandTitle = page.getByText('大学生职业规划智能体');
    const titleStyles = await brandTitle.evaluate((el) => {
      const cs = window.getComputedStyle(el);
      return {
        fontFamily: cs.fontFamily,
        fontSize: cs.fontSize,
        fontWeight: cs.fontWeight,
        lineHeight: cs.lineHeight,
        letterSpacing: cs.letterSpacing,
        color: cs.color,
      };
    });

    // Check nav item computed font
    const navItem = page.getByRole('button', { name: /职业规划/ });
    const navStyles = await navItem.evaluate((el) => {
      const cs = window.getComputedStyle(el);
      return {
        fontFamily: cs.fontFamily,
        fontSize: cs.fontSize,
        fontWeight: cs.fontWeight,
        lineHeight: cs.lineHeight,
        letterSpacing: cs.letterSpacing,
        color: cs.color,
      };
    });

    // Check subtitle computed font
    const subtitle = page.getByText('AI赋能职业成长每一步');
    const subtitleStyles = await subtitle.evaluate((el) => {
      const cs = window.getComputedStyle(el);
      return {
        fontFamily: cs.fontFamily,
        fontSize: cs.fontSize,
        fontWeight: cs.fontWeight,
        color: cs.color,
      };
    });

    // Log styles for debugging
    console.log('=== Brand Title Styles ===');
    console.log(JSON.stringify(titleStyles, null, 2));
    console.log('=== Nav Item Styles ===');
    console.log(JSON.stringify(navStyles, null, 2));
    console.log('=== Subtitle Styles ===');
    console.log(JSON.stringify(subtitleStyles, null, 2));

    // Assert fonts are applied
    expect(titleStyles.fontFamily).toBeTruthy();
    expect(titleStyles.fontSize).toBeTruthy();
    expect(navStyles.fontFamily).toBeTruthy();
  });
});
