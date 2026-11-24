// Smoke test for 0.9: 지표 위에 지표 (an MA over RSI from the legend's +) and the new chart types
// (거래량 캔들, 렌코, 카기, 라인 브레이크, P&F). Saves screenshots, exits 1 on failure.
// Usage: node scripts/screenshots-0.9.mjs [baseUrl] [outDir]
import { chromium } from 'playwright';

const base = process.argv[2] ?? 'http://localhost:5173';
const out = process.argv[3] ?? 'test-results/v09';
const errors = [];
const check = (ok, message) => {
  if (!ok) errors.push(message);
  console.log(ok ? '  ok ' : '  FAIL', message);
};

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1280, height: 760 }, deviceScaleFactor: 2, locale: 'ko-KR' })).newPage();
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));
await page.addInitScript(() => localStorage.clear());
await page.goto(`${base}/?symbol=DEMO:BTCUSDT&resolution=60`);
await page.waitForFunction(() => window.chart?.bars.length > 0, null, { timeout: 20_000 });
await page.waitForTimeout(500);

// ── 지표 위에 지표 ──────────────────────────────────────────────────────
await page.evaluate(() => window.chart.setIndicators([]));
const rsi = await page.evaluate(() => window.chart.addIndicator('rsi'));
await page.waitForTimeout(300);
const row = page.locator('.fnc-pane-legend .fnc-ind', { hasText: 'RSI' }).first();
await row.hover();
await row.getByRole('button', { name: /이 지표 위에 지표 추가/ }).click();
await page.waitForTimeout(200);
await page.screenshot({ path: `${out}/on-indicator-picker.png` });
await page.locator('.fnc-sr-row', { hasText: '이동평균선' }).click();
await page.waitForTimeout(300);
const list = await page.evaluate(() => window.chart.getIndicators().map((c) => ({ type: c.type, on: c.on ?? null })));
check(list.length === 2 && list[1].type === 'ma' && list[1].on?.id === rsi && list[1].on?.key === 'rsi', `MA added on the RSI (${JSON.stringify(list)})`);
const legend = await page.locator('.fnc-pane-legend', { hasText: 'RSI' }).first().innerText();
check(/RSI 14/.test(legend) && /MA 14 \(RSI\)/.test(legend), `the RSI pane's legend shows the MA under it (${legend.replace(/\s+/g, ' ')})`);
check((await page.locator('.fnc-legend').first().innerText()).includes('MA 14') === false, 'not in the price legend');
await page.screenshot({ path: `${out}/ma-on-rsi.png` });
// Its settings: no 가격 기준 to pick.
await page.locator('.fnc-pane-legend .fnc-ind', { hasText: 'MA 14' }).locator('.fnc-ind-title').click();
await page.waitForTimeout(200);
check((await page.locator('.fnc-dialog .fnc-select-source').count()) === 0, 'no source picker for an MA on an indicator');
await page.keyboard.press('Escape');
// Removing the RSI takes the MA with it.
await page.evaluate((id) => window.chart.removeIndicator(id), rsi);
check((await page.evaluate(() => window.chart.getIndicators().length)) === 0, 'removing the RSI removes the MA on it');

// ── Chart types ─────────────────────────────────────────────────────────
for (const type of ['volumeCandles', 'renko', 'kagi', 'lineBreak', 'pnf']) {
  await page.click('.fnc-btn-tools');
  await page.click(`.fnc-tools-seg [data-type="${type}"]`);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  const n = await page.evaluate(() => window.chart.bars.length);
  check(n > 5, `${type}: ${n} bars`);
  await page.screenshot({ path: `${out}/type-${type}.png` });
}
await page.click('.fnc-btn-tools');
await page.screenshot({ path: `${out}/types-menu.png` });
await page.click('.fnc-tools-seg [data-type="candles"]');
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
check((await page.evaluate(() => window.chart.type)) === 'candles', 'back to candles');

console.log(errors.length ? `FAILED (${errors.length})\n${errors.join('\n')}` : 'all ok');
await browser.close();
process.exit(errors.length ? 1 : 0);
