// 지표 설정 (인풋 · 모습 · 보임) and the drawing bar's 좌표 · 보임. Usage: node scripts/screenshots-indicator-settings.mjs [baseUrl] [outDir]
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
const id = await page.evaluate(() => {
  for (const c of window.chart.getIndicators()) window.chart.removeIndicator(c.id);
  window.chart.addIndicator('rsi');
  return window.chart.addIndicator('ma', { lines: [{ period: 20, source: 'close' }] });
});
await page.waitForTimeout(300);
await page.screenshot({ path: `${out}/axis-labels.png` });
const labels = await page.evaluate(() => window.chart.indicatorLegend().map((x) => x.title));
console.log('legend', labels);

// Settings: 인풋.
await page.evaluate((id) => document.querySelector(`.fnc-ind[aria-label^="MA"]`)?.click(), id);
await page.waitForSelector('.fnc-dialog');
await page.locator('.fnc-dialog').screenshot({ path: `${out}/settings-inputs.png` });
// 타임프레임 4시간, then 모습.
await page.selectOption('.fnc-dialog select[aria-label="타임프레임"]', '240');
await page.click('.fnc-dialog [role="tab"] >> text=모습');
await page.selectOption('.fnc-dialog select[aria-label="선 모양"]', 'dashed');
await page.selectOption('.fnc-dialog select[aria-label="선 굵기"]', '3');
await page.locator('.fnc-dialog').screenshot({ path: `${out}/settings-style.png` });
await page.click('.fnc-dialog [role="tab"] >> text=보임');
await page.locator('.fnc-dialog').screenshot({ path: `${out}/settings-visibility.png` });
await page.click('.fnc-dialog button[type="submit"]');
await page.waitForTimeout(1500);
const ma = await page.evaluate((id) => window.chart.getIndicators().find((c) => c.id === id), id);
check(ma.timeframe === '240', 'timeframe saved');
check(ma.styles.l0.lineStyle === 'dashed' && ma.styles.l0.width === 3, 'line style and width saved');
const title = await page.evaluate((id) => window.chart.indicatorLegend().find((x) => x.id === id).title, id);
check(title.includes('4시간'), `legend says the timeframe: ${title}`);
// The 4h MA is a staircase on the hourly chart: equal values within each 4-hour block (waiting for closes).
const steps = await page.evaluate(() => {
  const legend = window.chart.indicatorLegend();
  const n = window.chart.bars.length;
  return [n - 9, n - 8, n - 7, n - 6, n - 5].map((i) => window.chart.indicatorLegend(i).find((x) => x.title.startsWith('MA'))?.values[0]?.value);
});
console.log('4h MA on the last hours', steps);
check(new Set(steps).size <= 3, 'the 4h MA steps in blocks');
await page.screenshot({ path: `${out}/timeframe.png` });

// 보임: RSI off on hours → dimmed in the legend, not drawn.
const rsi = await page.evaluate(() => window.chart.getIndicators().find((c) => c.type === 'rsi').id);
await page.evaluate((rsi) => window.chart.updateIndicator(rsi, { display: { intervals: { hours: false } } }), rsi);
await page.waitForTimeout(200);
check(await page.evaluate((rsi) => window.chart.indicatorLegend().find((x) => x.id === rsi).offInterval === true, rsi), 'RSI off on hourly charts');

// Defaults: save MA as default, a new MA starts like it.
await page.evaluate((id) => document.querySelector(`.fnc-ind[aria-label^="MA"]`)?.click(), id);
await page.waitForSelector('.fnc-dialog');
await page.click('.fnc-dialog .fnc-action-menu');
await page.locator('.fnc-dialog').screenshot({ path: `${out}/settings-defaults.png` });
await page.click('.fnc-defaults-menu >> text=기본값으로 저장');
await page.keyboard.press('Escape');
const fresh = await page.evaluate(() => {
  const nid = window.chart.addIndicator('ma');
  return window.chart.getIndicators().find((c) => c.id === nid);
});
check(fresh.timeframe === '240' && fresh.styles.l0?.lineStyle === 'dashed', 'a new MA starts from the saved default');

// Drawing: 좌표 and 보임.
const did = await page.evaluate(() => {
  const b = window.chart.bars;
  return window.chart.addDrawing({ type: 'trendline', points: [{ time: b[b.length - 40].time, price: b[b.length - 40].low }, { time: b[b.length - 10].time, price: b[b.length - 10].high }] });
});
await page.evaluate((id) => window.chart.selectDrawing(id), did);
await page.waitForTimeout(200);
await page.click('.fnc-selbar [aria-label="좌표"]');
await page.waitForTimeout(150);
await page.screenshot({ path: `${out}/drawing-coords.png` });
await page.fill('.fnc-coord-price >> nth=0', '12345');
await page.locator('.fnc-coord-price >> nth=0').dispatchEvent('change');
check((await page.evaluate((id) => window.chart.getDrawings().find((d) => d.id === id).points[0].price, did)) === 12345, 'point price typed in');
await page.click('.fnc-selbar [aria-label="보임"]');
await page.waitForTimeout(150);
await page.screenshot({ path: `${out}/drawing-visibility.png` });
await page.locator('.fnc-visibility-menu label', { hasText: '시간' }).locator('input').uncheck();
check(JSON.stringify(await page.evaluate((id) => window.chart.getDrawings().find((d) => d.id === id).style?.intervals, did)) === '{"hours":false}', 'drawing hidden on hours');

console.log(errors.length ? `FAILED\n${errors.join('\n')}` : 'all ok');
await browser.close();
process.exit(errors.length ? 1 : 0);
