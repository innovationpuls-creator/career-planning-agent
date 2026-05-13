/**
 * Playwright screenshot utility for Phase verification.
 *
 * Usage:
 *   cd myapp && node ../docs/images/test/screenshot.js [phase] [options]
 *   cd myapp && npm run screenshot -- [phase] [options]
 *
 * Examples:
 *   node ../docs/images/test/screenshot.js phase2               # full page + per-section
 *   node ../docs/images/test/screenshot.js phase2 --full-only   # full page only
 *   node ../docs/images/test/screenshot.js phase2 --sections    # per-section only
 */

const path = require('path');
const fs = require('fs');

// Resolve playwright from myapp/node_modules (script lives in docs/images/test/)
const myappModules = path.resolve(__dirname, '../../../myapp/node_modules');
const playwrightPath = path.join(myappModules, 'playwright');
const { chromium } = require(playwrightPath);

const BASE = 'http://localhost:8000';
const ROOT = path.resolve(__dirname, '../..');
const OUT_BASE = path.join(__dirname);

// ── Phase config ──────────────────────────────────────────────
const PHASES = {
  phase2: {
    route: '/phase2-demo',
    sections: [
      'ClaudeButton', 'ClaudeCard', 'ClaudeTag', 'ClaudeInput',
      'ClaudeSelect', 'ClaudeStatCard', 'ProgressRing', 'CountUpNumber',
      'FadeInWhenVisible',
    ],
  },
  phase4: {
    route: '/home-v2',
    sections: [
      '职业规划进度', '成长路径',
    ],
  },
};

// ── Helpers ───────────────────────────────────────────────────
function parseArgs(argv) {
  const args = argv.slice(2);
  const phase = args.find(a => !a.startsWith('--')) || 'phase2';
  const fullOnly = args.includes('--full-only');
  const sectionsOnly = args.includes('--sections');
  return { phase, fullOnly, sectionsOnly };
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// ── Main ──────────────────────────────────────────────────────
async function main() {
  const { phase, fullOnly, sectionsOnly } = parseArgs(process.argv);
  const config = PHASES[phase];

  if (!config) {
    console.error(`Unknown phase: ${phase}. Available: ${Object.keys(PHASES).join(', ')}`);
    process.exit(1);
  }

  const outDir = path.join(OUT_BASE, phase.charAt(0).toUpperCase() + phase.slice(1));
  ensureDir(outDir);

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  // Login first (app requires auth for all pages including layout:false routes)
  await loginIfNeeded(page);

  await page.goto(`${BASE}${config.route}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Full page screenshot
  if (!sectionsOnly) {
    const fullPath = path.join(outDir, `${phase}-full-page.png`);
    await page.screenshot({ path: fullPath, fullPage: true });
    console.log(`✓ Full page → ${path.relative(ROOT, fullPath)}`);
  }

  // Section screenshots
  if (!fullOnly && config.sections.length > 0) {
    const headings = page.locator('h2');
    const count = await headings.count();

    for (let i = 0; i < count; i++) {
      const heading = headings.nth(i);
      const text = await heading.textContent();
      if (!text) continue;

      const match = config.sections.find(n => text.includes(n));
      if (!match) continue;

      await heading.scrollIntoViewIfNeeded();
      await page.waitForTimeout(800);
      const parent = heading.locator('xpath=..');
      const sectionPath = path.join(outDir, `${phase}-${match.toLowerCase()}.png`);
      await parent.screenshot({ path: sectionPath });
      console.log(`✓ ${match} → ${path.relative(ROOT, sectionPath)}`);
    }
  }

  await browser.close();
  console.log(`\nDone — screenshots saved to ${path.relative(ROOT, outDir)}/`);
}

async function loginIfNeeded(page) {
  await page.goto(`${BASE}/user/login`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // If already logged in, the page will redirect away from /user/login
  if (!page.url().includes('/user/login')) return;

  const usernameInput = page.locator('input[id="username"], input[placeholder*="用户名"]').first();
  if (await usernameInput.isVisible()) {
    await usernameInput.fill('444');
    await page.locator('input[type="password"]').first().fill('12345678');
    await page.locator('button[type="submit"], button:has-text("登录")').first().click();
    await page.waitForTimeout(2000);
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
