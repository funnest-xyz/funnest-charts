// 차트 고정 and 가격 축 비율 고정. Usage: node scripts/screenshots-locks.mjs [baseUrl] [outDir]
import { chromium } from 'playwright';

const base = process.argv[2] ?? 'http://localhost:5173';
const out = process.argv[3] ?? 'test-results/v010';
const errors = [];
const check = (ok, message) => {
  if (!ok) errors.push(message);
  console.log(ok ? '  ok ' : '  FAIL', message);
};
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1280, height: 820 }, deviceScaleFactor: 2, locale: 'ko-KR' })).newPage();
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
await page.addInitScript(() => localStorage.clear());
await page.goto(`${base}/?symbol=DEMO:BTCUSDT&resolution=60`);
await page.waitForFunction(() => window.chart?.bars.length > 0, null, { timeout: 20_000 });
await page.waitForTimeout(400);
const view = () => page.evaluate(() => ({ spacing: window.chart.timeScale.barSpacing, range: window.chart.getVisibleTimeRange(), lo: window.chart.mainScale?.min, hi: window.chart.mainScale?.max }));
const plot = await page.locator('.fnc-chart canvas').first().boundingBox();
const cx = plot.x + plot.width * 0.45;
const cy = plot.y + plot.height * 0.35;

// 차트 고정: wheel, drag and the zoom buttons leave the view.
await page.evaluate(() => window.chart.setSettings({ lockView: true }));
await page.waitForTimeout(200);
const before = await view();
await page.mouse.move(cx, cy);
await page.mouse.wheel(0, -600);
await page.mouse.down();
await page.mouse.move(cx - 200, cy + 40, { steps: 8 });
await page.mouse.up();
await page.evaluate(() => window.chart.zoom(2));
await page.waitForTimeout(300);
const after = await view();
check(after.spacing === before.spacing && after.range.from === before.range.from, 'locked: wheel, drag and zoom() leave the view');
check(await page.locator('.fnc-nav-locked [aria-label="차트 고정 풀기"]').count() === 1, 'the zoom bar shows only the lock');
await page.screenshot({ path: `${out}/lock-view.png` });
await page.click('.fnc-nav-locked [aria-label="차트 고정 풀기"]');
check((await page.evaluate(() => window.chart.settings.lockView)) === false, 'the lock button unlocks');

// 가격 축 비율 고정: zooming time zooms price with it.
await page.evaluate(() => window.chart.setSettings({ lockRatio: true }));
await page.waitForTimeout(300);
// The price pane's own scale (internal, read for the check).
const priceAt = (y) => page.evaluate((y) => window.chart.mainScale.yToPrice(y), y);
const p0 = [await priceAt(100), await priceAt(300)];
await page.evaluate(() => window.chart.zoom(2));
await page.waitForTimeout(300);
const p1 = [await priceAt(100), await priceAt(300)];
console.log('price span over 200px: before', p0[0] - p0[1], 'after 2× zoom', p1[0] - p1[1]);
check(Math.abs((p0[0] - p0[1]) / (p1[0] - p1[1]) - 2) < 0.05, 'price axis zoomed with the time axis (2×)');
await page.screenshot({ path: `${out}/lock-ratio.png` });

console.log(errors.length ? `FAILED\n${errors.join('\n')}` : 'all ok');
await browser.close();
process.exit(errors.length ? 1 : 0);
