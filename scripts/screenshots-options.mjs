// 도구 설정: a trend line extended both ways with its numbers shown; a retracement extended right
// and reversed, with no background. Usage: node scripts/screenshots-options.mjs [baseUrl] [outDir]
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
const add = (type, from, to) =>
  page.evaluate(
    ([type, from, to]) => {
      const b = window.chart.bars;
      const a = b[b.length - from], z = b[b.length - to];
      const id = window.chart.addDrawing({ type, points: [{ time: a.time, price: a.low }, { time: z.time, price: z.high }] });
      window.chart.selectDrawing(id);
      return id;
    },
    [type, from, to],
  );
const opts = (id) => page.evaluate((id) => window.chart.getDrawings().find((x) => x.id === id).style?.options ?? {}, id);
const line = await add('trendline', 90, 60);
await page.waitForTimeout(200);
await page.click('.fnc-selbar [aria-label="도구 설정"]');
for (const name of ['왼쪽으로 연장', '오른쪽으로 연장', '가격 변화 · 봉 수 표시']) await page.locator('.fnc-options-menu label', { hasText: name }).locator('input').check();
const o = await opts(line);
check(o.extendLeft && o.extendRight && o.stats, `trend line options saved (${JSON.stringify(o)})`);
await page.keyboard.press('Escape');
const fib = await add('fibonacci', 40, 15);
await page.waitForTimeout(200);
if (!(await page.locator('.fnc-options-menu').isVisible())) await page.click('.fnc-selbar [aria-label="도구 설정"]');
await page.locator('.fnc-options-menu label', { hasText: '오른쪽으로 연장' }).locator('input').check();
await page.locator('.fnc-options-menu label', { hasText: '뒤집기' }).locator('input').check();
await page.locator('.fnc-options-menu').getByRole('checkbox', { name: '배경', exact: true }).uncheck();
await page.screenshot({ path: `${out}/options-menu.png` });
const f = await opts(fib);
check(f.extendRight && f.reverse && f.background === false, `retracement options saved (${JSON.stringify(f)})`);
await page.evaluate(() => window.chart.selectDrawing(null));
await page.waitForTimeout(200);
await page.screenshot({ path: `${out}/options-drawn.png` });
console.log(errors.length ? `FAILED\n${errors.join('\n')}` : 'all ok');
await browser.close();
process.exit(errors.length ? 1 : 0);
