// Phone UI audit: opens each part of the chart widget on phone screens, screenshots it, and lists
// what sticks out of the screen and buttons too small to tap. Usage: node scripts/audit-phone.mjs [baseUrl] [outDir]
import { chromium, devices } from 'playwright';

const base = process.argv[2] ?? 'http://localhost:5173';
const out = process.argv[3] ?? 'test-results/audit-phone';
const browser = await chromium.launch();
const report = [];

/** Visible elements past the screen's edges, and buttons under 32px, inside `root` (or the page). */
async function inspect(page, label, root = 'body') {
  const r = await page.evaluate((root) => {
    const vw = innerWidth;
    const vh = innerHeight;
    const scope = document.querySelector(root) ?? document.body;
    const out = [];
    const small = [];
    for (const el of scope.querySelectorAll('button, input, select, a, [role="button"], [role="tab"], label')) {
      const s = getComputedStyle(el);
      if (s.visibility === 'hidden' || s.display === 'none') continue;
      const b = el.getBoundingClientRect();
      if (b.width === 0 || b.height === 0) continue;
      // Hidden by a clipping parent (scroll containers): skip.
      let clipped = false;
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const ps = getComputedStyle(p);
        if (/(auto|scroll|hidden)/.test(ps.overflowX + ps.overflowY)) {
          const pb = p.getBoundingClientRect();
          if (b.right <= pb.left || b.left >= pb.right || b.bottom <= pb.top || b.top >= pb.bottom) clipped = true;
          break;
        }
      }
      if (clipped) continue;
      const name = (el.getAttribute('aria-label') || el.textContent || el.className || el.tagName).toString().trim().slice(0, 30);
      if (b.left < -1 || b.right > vw + 1 || b.top < -1 || b.bottom > vh + 1) out.push(`${name} [${Math.round(b.left)},${Math.round(b.top)} ${Math.round(b.width)}×${Math.round(b.height)}]`);
      else if ((b.width < 28 || b.height < 28) && el.tagName !== 'LABEL' && el.type !== 'checkbox' && el.type !== 'range') small.push(`${name} ${Math.round(b.width)}×${Math.round(b.height)}`);
    }
    const docOverflow = document.documentElement.scrollWidth > vw + 1 ? document.documentElement.scrollWidth : 0;
    return { out, small: [...new Set(small)].slice(0, 12), docOverflow };
  }, root);
  report.push(`\n## ${label}${r.docOverflow ? ` — page scrolls sideways (${r.docOverflow}px)` : ''}`);
  if (r.out.length) report.push(`  off screen: ${r.out.slice(0, 15).join(' | ')}`);
  if (r.small.length) report.push(`  small: ${r.small.join(' | ')}`);
}

const shot = (page, name) => page.screenshot({ path: `${out}/${name}.png` });
const closeAll = async (page) => {
  for (let i = 0; i < 3; i++) await page.keyboard.press('Escape');
  await page.evaluate(() => window.chart?.selectDrawing?.(null));
  await page.waitForTimeout(200);
};

for (const [dev, device] of [
  ['galaxy', { ...devices['Galaxy S9+'] }],
  ['iphone', devices['iPhone 13']],
  ['land', devices['iPhone 13 landscape']],
]) {
  const page = await (await browser.newContext({ ...device, locale: 'ko-KR' })).newPage();
  page.setDefaultTimeout(8000);
  await page.addInitScript(() => localStorage.clear());
  await page.goto(`${base}/?symbol=DEMO:BTCUSDT&resolution=60`);
  await page.waitForFunction(() => window.chart?.bars.length > 0, null, { timeout: 20_000 });
  await page.evaluate(() => {
    window.chart.addIndicator('rsi');
    window.chart.addIndicator('macd');
  });
  await page.waitForTimeout(500);
  await shot(page, `${dev}-01-chart`);
  await inspect(page, `${dev} chart`);

  const step = async (n, label, open, root) => {
    try {
      await open();
      await page.waitForTimeout(400);
      await shot(page, `${dev}-${n}-${label}`);
      await inspect(page, `${dev} ${label}`, root);
    } catch (e) {
      report.push(`\n## ${dev} ${label}: couldn't open (${String(e).split('\n')[0].slice(0, 90)})`);
    }
    await closeAll(page);
  };

  await step('02', 'indicator-picker', () => page.locator('.fnc-btn-indicators').first().click(), '.fnc-dialog');
  await step('03', 'indicator-settings-inputs', () => page.locator('.fnc-ind', { hasText: 'MA' }).first().click(), '.fnc-dialog');
  await step('04', 'indicator-settings-style', async () => {
    await page.locator('.fnc-ind', { hasText: 'MACD' }).first().click();
    await page.click('.fnc-dialog [role="tab"] >> text=모습');
  }, '.fnc-dialog');
  await step('05', 'indicator-settings-visibility', async () => {
    await page.locator('.fnc-ind', { hasText: 'RSI' }).first().click();
    await page.click('.fnc-dialog [role="tab"] >> text=보임');
  }, '.fnc-dialog');
  await step('06', 'tools-menu', () => page.locator('.fnc-tools button').last().click());
  await step('07', 'chart-settings', async () => {
    await page.evaluate(() => document.querySelector('.fnc-root')).then(() => 0);
    await page.evaluate(() => window.chart && null);
    await page.locator('.fnc-tools button').last().click();
    await page.locator('.fnc-menu-item', { hasText: '설정' }).first().click();
  }, '.fnc-dialog');
  await step('08', 'interval-menu', () => page.locator('.fnc-interval-current, .fnc-intervals button').first().click());
  await step('09', 'symbol-search', () => page.locator('.fnc-symbol').first().click());
  await step('10', 'drawbar', () => page.locator('.fnc-btn-drawbar').first().click());
  await step('11', 'drawbar-group', async () => {
    await page.locator('.fnc-btn-drawbar').first().click();
    await page.waitForTimeout(250);
    // The second group's menu (lines): its arrow / long press opens the list.
    const g = page.locator('.fnc-drawbar .fnc-tool-group, .fnc-drawbar .fnc-group-btn').nth(1);
    if (await g.count()) await g.click();
    const more = page.locator('.fnc-drawbar [aria-haspopup]').nth(1);
    if (await more.count()) await more.click();
  });
  // A selected drawing: its bar and every menu on it.
  const did = await page.evaluate(() => {
    const b = window.chart.bars;
    return window.chart.addDrawing({ type: 'fibonacci', points: [{ time: b[b.length - 40].time, price: b[b.length - 40].low }, { time: b[b.length - 10].time, price: b[b.length - 10].high }] });
  });
  const select = async () => {
    await page.evaluate((id) => window.chart.selectDrawing(id), did);
    await page.waitForTimeout(250);
  };
  await step('12', 'selbar', select, '.fnc-selbar');
  const menus = await (async () => {
    await select();
    const labels = await page.locator('.fnc-selbar .fnc-selbar-menu > button[aria-label]').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
    await closeAll(page);
    return labels;
  })();
  let k = 13;
  for (const label of menus) {
    await step(String(k++), `selbar-${label}`, async () => {
      await select();
      await page.click(`.fnc-selbar [aria-label="${label}"]`);
    }, '.fnc-selbar');
  }
  await step(String(k++), 'go-to-date', async () => {
    await page.locator('.fnc-rangebar button[aria-label], .fnc-range button').last().click();
  });
  await page.context().close();
}
await browser.close();
console.log(report.join('\n'));
