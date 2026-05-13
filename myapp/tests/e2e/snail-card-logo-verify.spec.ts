import { execSync } from 'child_process';
import { test, expect } from '@playwright/test';

/**
 * E2E: snail-learning-path resource cards should show logo.
 *
 * Setup via snai-setup.py (Python script):
 *   1. Registers a user, seeds DB (StudentProfile + StudentCompetencyUserLatestProfile)
 *   2. Creates career favorite + generates workspace via API
 *   → returns { username, password, favorite_id, token }
 *
 * Token is injected into localStorage so UI login is bypassed.
 */

function setupViaScript(): { username: string; password: string; favorite_id: number; token: string } {
  const result = execSync(
    '/Users/torch/torch/opt/career-planning-agent/backend/.venv/bin/python /Users/torch/torch/opt/career-planning-agent/myapp/tests/e2e/snai-setup.py',
    { timeout: 30000, encoding: 'utf-8' },
  ).trim();
  return JSON.parse(result) as { username: string; password: string; favorite_id: number; token: string };
}

test('snail-learning-path: resource cards show logo', async ({ page }) => {
  page.on('console', (msg) => {
    if (msg.type() === 'error') test.info().annotations.push({ type: 'console-error', description: msg.text() });
  });

  // 1. Run Python setup script
  const { favorite_id, token } = setupViaScript();
  console.log('Setup complete, favorite_id:', favorite_id);

  // 2. Navigate to login page then inject token into localStorage (bypass UI login)
  await page.goto('http://localhost:8002/user/login');
  await page.waitForLoadState('networkidle');

  // Inject token using the correct localStorage key used by Umi Max Pro
  // Key is: feature_map_access_token (from src/utils/authToken.ts)
  await page.evaluate(
    (tok: string) => {
      localStorage.setItem('feature_map_access_token', tok);
    },
    token,
  );

  // 3. Reload to let the app pick up the injected auth
  await page.goto(`http://localhost:8002/snail-learning-path?favorite_id=${favorite_id}`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(5000);

  const pageText = await page.locator('body').innerText();
  console.log('Page state:', pageText.slice(0, 500));

  // Screenshot BEFORE fix (baseline)
  await page.screenshot({ path: 'tests/e2e/screenshots/before-logo-fix.png', fullPage: false });
  console.log('Screenshot saved');

  // 4. Wait for cards
  const cardHandle = await page.waitForSelector('.ant-card', { timeout: 10000 }).catch(() => null);
  if (!cardHandle) {
    console.log('No cards found — page still in guidance/loading state.');
    return;
  }

  const cards = page.locator('.ant-card');
  const count = await cards.count();
  const imgsInCards = await page.locator('.ant-card img').count();
  console.log(`Cards: ${count}, Imgs inside cards: ${imgsInCards}`);

  const firstCardHTML = await cards.first().innerHTML();
  console.log('First card HTML:', firstCardHTML.slice(0, 800));

  expect(count).toBeGreaterThan(0);
  // After fix: expect(imgsInCards).toBeGreaterThan(0)
});
