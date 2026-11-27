// 지표 템플릿: the chart's indicators saved by name from the toolbar, put back on another chart in
// one go (replacing what's there), still there after a reload, and deleted.
// Usage: node scripts/check-indicator-templates.mjs   (dev server on :5173)
import { chromium } from 'playwright';

const fails = [];
const errors = [];
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) fails.push(name);
};
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1440, height: 860 } })).newPage();
page.on('pageerror', (e) => errors.push(e.message));
const loaded = (n) =>
  page.waitForFunction((n) => window.multi?.charts.length >= n && window.multi.charts.slice(0, n).every((c) => c.bars.length > 20), n, { timeout: 30000 });
const types = (i) => page.evaluate((i) => window.multi.charts[i].getIndicators().map((x) => x.type).join(','), i);

await page.goto('http://localhost:5173/multi.html');
await page.evaluate(() => localStorage.clear());
await page.goto('http://localhost:5173/multi.html?layout=2-cols&panes=2');
await loaded(2);
await page.evaluate(() => {
  const [a, b] = window.multi.charts;
  for (const x of a.getIndicators()) a.removeIndicator(x.id);
  for (const x of b.getIndicators()) b.removeIndicator(x.id);
  a.addIndicator('rsi', { period: 21 });
  a.addIndicator('bb');
  b.addIndicator('macd');
});
await page.evaluate(() => window.multi.activate(0));
await page.waitForTimeout(300);

// Save chart 1's indicators as "스윙".
const btn = page.locator('.fnc-btn-indtpl').first();
await btn.click();
await page.waitForSelector('.fnc-indtpl-menu');
await page.screenshot({ path: 'test-results/screens/indtpl-empty.png' });
await page.locator('.fnc-indtpl-menu > button.fnc-menu-item').last().click();
await page.locator('.fnc-indtpl-menu .fnc-template-name').fill('스윙');
await page.keyboard.press('Enter');
await page.waitForTimeout(200);
const rows = await page.locator('.fnc-indtpl-menu .fnc-indtpl-item').allInnerTexts();
check('saved and listed', rows.length === 1 && rows[0].includes('스윙'), JSON.stringify(rows));
await page.screenshot({ path: 'test-results/screens/indtpl-saved.png' });
await page.keyboard.press('Escape');

// Put it on chart 2 (its MACD is replaced).
await page.evaluate(() => window.multi.activate(1));
await page.waitForTimeout(300);
await btn.click();
await page.locator('.fnc-indtpl-menu .fnc-indtpl-item', { hasText: '스윙' }).click();
await page.waitForTimeout(300);
check('applied to the other chart', (await types(1)) === (await types(0)), `${await types(1)} vs ${await types(0)}`);
check('its inputs came along', await page.evaluate(() => window.multi.charts[1].getIndicators().find((x) => x.type === 'rsi')?.params.period === 21));

// After a reload, still there; then delete it.
await page.reload();
await loaded(2);
await page.locator('.fnc-btn-indtpl').first().click();
check('kept after a reload', (await page.locator('.fnc-indtpl-menu .fnc-indtpl-item').count()) === 1);
await page.locator('.fnc-indtpl-menu .fnc-template-row .fnc-ind-btn').first().click();
check('deleted', (await page.locator('.fnc-indtpl-menu .fnc-indtpl-item').count()) === 0);
check('no page errors', errors.length === 0, errors.join(' | '));
await browser.close();
console.log(fails.length ? `\nFAIL: ${fails.length}` : '\nok');
process.exit(fails.length ? 1 : 0);
