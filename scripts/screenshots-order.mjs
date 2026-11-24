// 순서: two overlapping drawings; the selection bar's order menu sends the top one to the back
// and brings it to the front again. Usage: node scripts/screenshots-order.mjs [baseUrl] [outDir]
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
await page.addInitScript(() => localStorage.clear());
await page.goto(`${base}/?symbol=DEMO:BTCUSDT&resolution=60`);
await page.waitForFunction(() => window.chart?.bars.length > 0, null, { timeout: 20_000 });
await page.waitForTimeout(400);
const [first, second] = await page.evaluate(() => {
  const b = window.chart.bars;
  const add = (from, to, color) =>
    window.chart.addDrawing({ type: 'trendline', color, style: { width: 4 }, points: [{ time: b[b.length - from].time, price: b[b.length - from].low }, { time: b[b.length - to].time, price: b[b.length - to].high }] });
  return [add(60, 20, '#F04452'), add(60, 20, '#3182F6')];
});
const ids = () => page.evaluate(() => window.chart.getDrawings().map((d) => d.id));
check(JSON.stringify(await ids()) === JSON.stringify([first, second]), 'the second is on top');
await page.evaluate((id) => window.chart.selectDrawing(id), second);
await page.waitForTimeout(200);
await page.click('.fnc-selbar [aria-label="순서"]');
check(await page.locator('.fnc-selbar-pop button', { hasText: '맨 앞으로' }).isDisabled(), '맨 앞으로 is off for the top one');
await page.screenshot({ path: `${out}/order-menu.png` });
await page.click('.fnc-selbar-pop >> text=맨 뒤로');
check(JSON.stringify(await ids()) === JSON.stringify([second, first]), 'sent to the back');
if (!(await page.locator('.fnc-selbar-pop').isVisible())) await page.click('.fnc-selbar [aria-label="순서"]');
await page.click('.fnc-selbar-pop >> text=맨 앞으로');
check(JSON.stringify(await ids()) === JSON.stringify([first, second]), 'brought to the front');
// Undo puts it back.
await page.evaluate(() => window.chart.undo());
check(JSON.stringify(await ids()) === JSON.stringify([second, first]), 'undo reverses the move');
console.log(errors.length ? `FAILED\n${errors.join('\n')}` : 'all ok');
await browser.close();
process.exit(errors.length ? 1 : 0);
