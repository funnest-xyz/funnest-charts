// The selection bar: a trend line's (swatches, the custom color's + centered) and a Fib
// retracement's (no one color for all levels). Usage: node scripts/screenshots-selbar.mjs
import { chromium } from 'playwright';

const base = process.argv[2] ?? 'http://localhost:5173';
const out = process.argv[3] ?? 'test-results/v09';
const errors = [];
const check = (ok, message) => {
  if (!ok) errors.push(message);
  console.log(ok ? '  ok ' : '  FAIL', message);
};
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1280, height: 760 }, deviceScaleFactor: 3, locale: 'ko-KR' })).newPage();
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
await page.addInitScript(() => localStorage.clear());
await page.goto(`${base}/?symbol=DEMO:BTCUSDT&resolution=60`);
await page.waitForFunction(() => window.chart?.bars.length > 0, null, { timeout: 20_000 });
await page.waitForTimeout(400);
const add = (type) =>
  page.evaluate((type) => {
    const b = window.chart.bars;
    const a = b[b.length - 60], z = b[b.length - 20];
    const id = window.chart.addDrawing({ type, points: [{ time: a.time, price: a.low }, { time: z.time, price: z.high }] });
    window.chart.selectDrawing(id);
    return id;
  }, type);
await add('trendline');
await page.waitForTimeout(200);
const plus = page.locator('.fnc-swatch-add');
const [box, icon] = [await plus.boundingBox(), await plus.locator('svg').boundingBox()];
const off = [icon.x + icon.width / 2 - (box.x + box.width / 2), icon.y + icon.height / 2 - (box.y + box.height / 2)].map((v) => Math.abs(v));
check(off[0] < 0.6 && off[1] < 0.6, `+ centered in its circle (off by ${off.map((v) => v.toFixed(2)).join(', ')} px)`);
const bar = await page.locator('.fnc-selbar').boundingBox();
await page.screenshot({ path: `${out}/selbar-trendline.png`, clip: { x: bar.x - 4, y: bar.y - 4, width: bar.width + 8, height: bar.height + 8 } });
await add('fibonacci');
await page.waitForTimeout(200);
check((await page.locator('.fnc-selbar .fnc-swatch').count()) === 0, 'no color swatches on a Fib retracement');
const bar2 = await page.locator('.fnc-selbar').boundingBox();
await page.screenshot({ path: `${out}/selbar-fib.png`, clip: { x: bar2.x - 4, y: bar2.y - 4, width: bar2.width + 8, height: bar2.height + 8 } });
console.log(errors.length ? `FAILED\n${errors.join('\n')}` : 'all ok');
await browser.close();
process.exit(errors.length ? 1 : 0);
