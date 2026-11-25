// Reconnect = reload (bars thrown away and loaded again, view kept), and the hidden-tab pause.
// Usage: node scripts/check-reload.mjs [baseUrl]
import { chromium } from 'playwright';

const base = process.argv[2] ?? 'http://localhost:5173';
const errors = [];
const check = (ok, message) => {
  if (!ok) errors.push(message);
  console.log(ok ? '  ok ' : '  FAIL', message);
};
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1280, height: 820 }, locale: 'ko-KR' })).newPage();
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
await page.goto(`${base}/?symbol=DEMO:BTCUSDT&resolution=1`);
await page.waitForFunction(() => window.chart?.bars.length > 0, null, { timeout: 20_000 });
await page.waitForTimeout(500);

// 1. At the latest bar: a reload keeps the right edge and the zoom, the bars are new objects.
const before = await page.evaluate(() => {
  window.chart.zoom(1.5);
  window.__first = window.chart.bars[window.chart.bars.length - 1];
  return { spacing: window.chart.timeScale.barSpacing, at: window.chart.isAtRealtime(), n: window.chart.bars.length };
});
await page.evaluate(() => window.chart.reload());
await page.waitForTimeout(800);
const after = await page.evaluate(() => ({
  spacing: window.chart.timeScale.barSpacing,
  at: window.chart.isAtRealtime(),
  replaced: window.chart.bars[window.chart.bars.length - 1] !== window.__first,
  n: window.chart.bars.length,
}));
console.log('latest view', JSON.stringify(before), '→', JSON.stringify(after));
check(after.at && Math.abs(after.spacing - before.spacing) < 0.01 && after.replaced, 'reload at the latest: right edge and zoom kept, bars reloaded');

// 2. Scrolled back: the same time span after the reload.
const span = await page.evaluate(() => {
  window.chart.scrollBars(-400);
  return window.chart.getVisibleTimeRange();
});
await page.evaluate(() => window.chart.reload());
await page.waitForTimeout(1500);
const span2 = await page.evaluate(() => window.chart.getVisibleTimeRange());
console.log('scrolled', JSON.stringify(span), '→', JSON.stringify(span2));
const minute = 60_000;
check(Math.abs(span2.from - span.from) <= minute && Math.abs(span2.to - span.to) <= minute, 'reload while scrolled back: same time span');

// 3. Ticks still flow after a reload.
const last1 = await page.evaluate(() => window.chart.bars.at(-1).close);
await page.waitForTimeout(3000);
const last2 = await page.evaluate(() => window.chart.bars.at(-1).close);
console.log('last close', last1, '→', last2);
check(last1 !== last2, 'realtime follows after a reload');

// 4. Hidden 60 s: paused (status 'paused', no more ticks); shown: reloaded and live again.
await page.evaluate(() => {
  window.__states = [];
  window.chart.on('connectionChange', (s) => window.__states.push(s.status));
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
  document.dispatchEvent(new Event('visibilitychange'));
});
await page.waitForTimeout(61_500);
const pausedAt = await page.evaluate(() => ({ states: window.__states, close: window.chart.bars.at(-1).close }));
await page.waitForTimeout(3000);
const stillPaused = await page.evaluate(() => window.chart.bars.at(-1).close);
console.log('hidden states', JSON.stringify(pausedAt.states));
check(pausedAt.states.includes('paused') && stillPaused === pausedAt.close, 'hidden 60 s: paused, no ticks');
await page.evaluate(() => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
  document.dispatchEvent(new Event('visibilitychange'));
});
await page.waitForTimeout(3500);
const back = await page.evaluate(() => ({ states: window.__states, close: window.chart.bars.at(-1).close }));
console.log('shown states', JSON.stringify(back.states));
check(back.close !== stillPaused, 'shown again: reloaded and live');

console.log(errors.length ? `FAILED\n${errors.join('\n')}` : 'all ok');
await browser.close();
process.exit(errors.length ? 1 : 0);
