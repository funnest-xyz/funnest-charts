// 화면 분할: 종목 워터마크 is one look for the whole widget — switched on in 차트 설정, every pane
// shows it, and panes added by splitting further show it too.
// Usage: node scripts/check-split-watermark.mjs   (dev server on :5173)
import { chromium } from 'playwright';

const out = 'test-results/screens';
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
const marks = () => page.evaluate(() => window.multi.charts.map((c) => c.settings.symbolWatermark));

await page.goto('http://localhost:5173/multi.html');
await page.evaluate(() => localStorage.clear());
await page.goto('http://localhost:5173/multi.html?layout=2-cols');
await loaded(2);
check('starts without the watermark', (await marks()).every((m) => !m), JSON.stringify(await marks()));

// 도구 › 차트 설정 › 표시 › 종목 워터마크, from the second pane.
const p1 = await page.locator('.fnc-grid .fnc-pane').nth(1).boundingBox();
await page.mouse.click(p1.x + p1.width * 0.4, p1.y + p1.height * 0.5);
await page.click('.fnc-btn-tools');
await page.click('.fnc-btn-settings');
await page.waitForSelector('.fnc-settings-tabs');
await page.locator(".fnc-settings-tabs .fnc-tab").nth(2).click();
await page.locator('.fnc-toggle-row', { hasText: /종목 워터마크|Symbol watermark/ }).locator('.fnc-switch').click();
await page.click('.fnc-action-primary');
await page.waitForTimeout(300);
check('both panes show it', (await marks()).every(Boolean), JSON.stringify(await marks()));
await page.screenshot({ path: `${out}/split-watermark-2.png` });

// Split further: the new panes take it from the pane they were split from.
await page.click('.fnc-btn-tools');
await page.click('.fnc-layout-opt[data-layout="4-grid"]');
await loaded(4);
await page.waitForTimeout(500);
check('new panes show it after splitting to 4', (await marks()).slice(0, 4).every(Boolean), JSON.stringify(await marks()));
await page.screenshot({ path: `${out}/split-watermark-4.png` });

check('no page errors', errors.length === 0, errors.join(' | '));
await browser.close();
console.log(fails.length ? `\nFAIL: ${fails.length}` : '\nok');
process.exit(fails.length ? 1 : 0);
