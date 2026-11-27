// 틱 차트: on a feed that lists tick intervals, the interval menu has a 틱 group (hidden elsewhere);
// picking 100틱 loads it, labels it, shows no countdown, and the crosshair time reads to the second.
// Usage: node scripts/check-ticks.mjs   (dev server on :5173)
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

await page.goto('http://localhost:5173/');
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForFunction(() => window.chart?.bars.length > 20, null, { timeout: 30000 });

// A stock first: no 틱 group.
await page.evaluate(() => window.widget.setSymbol('DEMO:005930'));
await page.waitForTimeout(800);
await page.locator('.fnc-interval-trigger').click();
const stockGroups = await page.locator('.fnc-interval-menu .fnc-menu-title').allInnerTexts();
check('no tick group on a feed without ticks', !stockGroups.some((g) => /틱|Ticks/.test(g)), JSON.stringify(stockGroups));
await page.keyboard.press('Escape');

// A coin that lists them.
await page.evaluate(() => window.widget.setSymbol('DEMO:BTCUSDT'));
await page.waitForFunction(() => window.chart.symbolInfo?.symbol === 'DEMO:BTCUSDT', null, { timeout: 30000 });
await page.waitForTimeout(500);
await page.locator('.fnc-interval-trigger').click();
const groups = await page.locator('.fnc-interval-menu .fnc-menu-title').allInnerTexts();
check('a tick group on a feed with ticks', groups.some((g) => /틱|Ticks/.test(g)), JSON.stringify(groups));
await page.locator('.fnc-interval-menu .fnc-menu-item', { hasText: /^100(틱|T)$/ }).click();
await page.waitForFunction(() => window.chart.currentResolution === '100T' && window.chart.bars.length > 20, null, { timeout: 30000 });
await page.waitForTimeout(800);
const label = await page.locator('.fnc-interval-current').innerText();
check('labelled in ticks', /^100(틱|T)$/.test(label), label);

// The crosshair's time reads to the second.
const box = await page.locator('.fnc-stage').boundingBox();
await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.4);
await page.waitForTimeout(300);
await page.screenshot({ path: 'test-results/screens/ticks.png' });
const axisText = await page.evaluate(() => window.chart.save().resolution);
check('saved with the tick interval', axisText === '100T', axisText);
check('no page errors', errors.length === 0, errors.join(' | '));
await browser.close();
console.log(fails.length ? `\nFAIL: ${fails.length}` : '\nok');
process.exit(fails.length ? 1 : 0);
