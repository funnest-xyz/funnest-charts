// 화면 분할 2 → 4: the two charts there keep what they had; the two new ones are copies of the active
// chart (symbol, interval, chart type, settings, indicators — not its drawings).
// Usage: node scripts/check-split-copies.mjs   (dev server on :5173)
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
const look = () =>
  page.evaluate(() =>
    window.multi.charts.map((c) => ({
      symbol: c.symbolInfo?.symbol,
      type: c.chartType,
      ind: c.save().indicators.map((i) => i.type).join(','),
      grid: c.settings.gridVertical,
      drawings: c.getDrawings().length,
    })),
  );

await page.goto('http://localhost:5173/multi.html');
await page.evaluate(() => localStorage.clear());
await page.goto('http://localhost:5173/multi.html?layout=2-cols&panes=2');
await loaded(2);
await page.evaluate(() => {
  const [a, b] = window.multi.charts;
  a.addIndicator('rsi');
  a.setSettings({ gridVertical: false });
  a.setChartType('hollow');
  a.addDrawing({ type: 'horizontal', points: [{ time: a.bars[a.bars.length - 5].time, price: a.bars[a.bars.length - 5].close }] });
  b.addIndicator('macd');
});
await page.waitForTimeout(300);
const before = await look();
console.log('before:', JSON.stringify(before));

// The active chart is the first: split to 4 from the toolbar.
await page.evaluate(() => window.multi.activate(0));
await page.click('.fnc-btn-tools');
await page.click('.fnc-layout-opt[data-layout="4-grid"]');
await loaded(4);
await page.waitForTimeout(800);
const after = await look();
console.log('after:', JSON.stringify(after));
check('the first two keep theirs', JSON.stringify(after.slice(0, 2)) === JSON.stringify(before));
for (const k of [2, 3]) {
  const p = after[k];
  check(`new chart ${k + 1} copies the active one`, p.symbol === before[0].symbol && p.type === before[0].type && p.ind === before[0].ind && p.grid === before[0].grid, JSON.stringify(p));
  check(`new chart ${k + 1} has no drawings`, p.drawings === 0);
}
await page.screenshot({ path: 'test-results/screens/split-copies.png' });
check('no page errors', errors.length === 0, errors.join(' | '));
await browser.close();
console.log(fails.length ? `\nFAIL: ${fails.length}` : '\nok');
process.exit(fails.length ? 1 : 0);
