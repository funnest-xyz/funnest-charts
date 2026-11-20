// The interval chips in time order with a non-favorite current interval, and fill markers that
// stand out on same-colored candles (a badge ringed in the background, a stem to its bar).
//   pnpm --filter playground dev, then: node scripts/check-chips-markers.mjs [base]
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const base = process.argv[2] ?? 'http://localhost:5173';
mkdirSync('test-results', { recursive: true });
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1280, height: 760 }, deviceScaleFactor: 2 })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
// Only 15분 and 일 as favorites, then open on 1분.
await page.addInitScript(() => {
  try {
    for (const k of Object.keys(localStorage)) if (k.endsWith(':favorite-intervals')) localStorage.removeItem(k);
  } catch {}
});
await page.goto(`${base}/?resolution=1`);
await page.waitForFunction(() => window.chart && window.chart.bars.length > 50, null, { timeout: 60000 });
// Un-star every favorite but 15m and 1D in the widget's own menu (the playground keeps nothing in storage).
await page.locator('.fnc-interval-trigger').click();
await page.evaluate(() => {
  for (const row of document.querySelectorAll('.fnc-menu-row.is-favorite')) {
    const name = row.querySelector('.fnc-menu-item')?.textContent ?? '';
    if (!/^15 ?m|15분|^1 ?D|1 day|^1일|^일/i.test(name.trim())) row.querySelector('.fnc-star')?.click();
  }
});
await page.keyboard.press('Escape');
const prefix = null;
await page.waitForTimeout(800);
const bar = await page.evaluate(() => {
  const pk = document.querySelector('.fnc-interval-picker');
  const chips = [...pk.querySelectorAll('.fnc-chip')].map((c) => `${c.textContent}${c.getAttribute('aria-pressed') === 'true' ? '*' : ''}`);
  const label = getComputedStyle(pk.querySelector('.fnc-interval-current')).display;
  return `chips: ${chips.join(' | ')} | trigger label shown: ${label !== 'none'}`;
});
console.log(bar, '| storage prefix:', prefix ?? '(none)');
await page.locator('.fnc-interval-picker').screenshot({ path: 'test-results/chips.png' });

// Fills on the last bars, both ways, some on bars of their own color.
await page.evaluate(() => {
  const bars = window.chart.bars;
  const marks = [];
  for (let i = bars.length - 60; i < bars.length; i += 6) {
    const b = bars[i];
    marks.push({ time: b.time, price: b.close, side: (i / 6) % 2 ? 'buy' : 'sell', quantity: 1 });
  }
  const b = bars[bars.length - 12];
  marks.push({ time: b.time, price: b.close, side: 'buy', quantity: 1 }, { time: b.time, price: b.close, side: 'buy', quantity: 2 });
  window.chart.setExecutions(marks);
});
await page.waitForTimeout(500);
await page.locator('.fnc-chart').first().screenshot({ path: 'test-results/markers.png' });
console.log('errors', errors);
await browser.close();
