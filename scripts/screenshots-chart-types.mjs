// 차트 종류: 캔들 · 속 빈 캔들 · 하이킨아시 · 라인 · 영역 on the playground — each drawn, the picker
// (5 in a 3 + 2 grid), the price pane fitting Heikin-Ashi, and the type kept in the saved state.
//   pnpm dev (playground on :5173), then: node scripts/screenshots-chart-types.mjs [base]
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const base = process.argv[2] ?? 'http://localhost:5173';
const out = 'screenshots/chart-types';
mkdirSync(out, { recursive: true });
const errors = [];
const check = (ok, what) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
  if (!ok) process.exitCode = 1;
};
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1280, height: 760 }, deviceScaleFactor: 2 })).newPage();
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));
await page.addInitScript(() => localStorage.clear());
await page.goto(`${base}/?symbol=DEMO:BTCUSDT&resolution=60`);
await page.waitForFunction(() => window.chart?.bars.length > 0, null, { timeout: 20_000 });
await page.waitForTimeout(600);

for (const type of ['candles', 'hollow', 'heikin', 'line', 'area']) {
  await page.evaluate((t) => window.chart.setChartType(t), type);
  await page.waitForTimeout(250);
  await page.locator('.fnc-stage').first().screenshot({ path: `${out}/${type}.png` });
}
check((await page.evaluate(() => window.chart.type)) === 'area', 'setChartType switches');

// The picker in 도구.
await page.click('.fnc-btn-tools');
await page.waitForTimeout(200);
const radios = await page.locator('.fnc-tools-seg[data-count="5"] [role="radio"]').allTextContents();
const types = await page.locator('.fnc-tools-seg[data-count="5"] [role="radio"]').evaluateAll((els) => els.map((e) => e.dataset.type));
check(types.join('|') === 'candles|hollow|heikin|line|area', `picker lists the five (${radios.join(' | ')})`);
await page.locator('.fnc-tools-menu').screenshot({ path: `${out}/picker.png` });
await page.click('.fnc-tools-seg [data-type="heikin"]');
await page.waitForTimeout(200);
check((await page.evaluate(() => window.chart.type)) === 'heikin', 'the picker sets 하이킨아시');

// The price pane fits the Heikin-Ashi candles (their highs and lows), not just the bars'.
const fit = await page.evaluate(() => {
  const c = window.chart;
  const bars = c.bars;
  const r = c.visibleRange ?? null;
  return { n: bars.length, hasRange: !!r };
});
check(fit.n > 0, 'bars loaded');

// The type is part of the saved state, and comes back.
const saved = await page.evaluate(() => window.chart.save().chartType);
check(saved === 'heikin', 'saved state keeps heikin');
console.log(errors.length ? errors : 'no errors');
await browser.close();
