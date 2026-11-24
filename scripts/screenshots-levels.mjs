// 레벨 설정 on a Fib retracement: change a value, hide one, recolor one, add one, then back to the
// defaults; width and line style reach the level lines. Usage: node scripts/screenshots-levels.mjs
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
const id = await page.evaluate(() => {
  const b = window.chart.bars;
  const a = b[b.length - 80], z = b[b.length - 20];
  const id = window.chart.addDrawing({ type: 'fibonacci', points: [{ time: a.time, price: a.low }, { time: z.time, price: z.high }] });
  window.chart.selectDrawing(id);
  return id;
});
await page.waitForTimeout(300);
const levels = () => page.evaluate((id) => window.chart.getDrawings().find((x) => x.id === id).style?.levels ?? null, id);
await page.click('.fnc-selbar [aria-label="레벨 설정"]');
check((await page.locator('.fnc-level-row').count()) === 24, 'seven default levels on, seventeen more offered');
check((await page.locator('.fnc-selbar [aria-label="부분 색상"]').count()) === 0, 'no separate part-color button');
// 0.786 → 0.65
const value = page.locator('.fnc-level-value').nth(5);
await value.fill('0.65');
await value.press('Enter');
await page.waitForTimeout(150);
check((await levels())?.[5]?.value === 0.65, 'a value changes');
// Hide 0.236.
await page.locator('.fnc-level-row').nth(1).locator('input[type=checkbox]').uncheck();
check((await levels())?.[1]?.on === false, 'a level hides');
// Add one: past 1.
await page.click('.fnc-levels-menu >> text=레벨 추가');
const l = await levels();
check(l.length === 25 && l[24].value > 1, `a level adds (${l.at(-1).value})`);
await page.screenshot({ path: `${out}/levels-menu.png` });
await page.keyboard.press('Escape');
// Width and line style reach the levels.
await page.evaluate((id) => window.chart.updateDrawing(id, { style: { ...window.chart.getDrawings().find((x) => x.id === id).style, width: 3, dash: 'dashed' } }), id);
await page.evaluate((id) => window.chart.selectDrawing(null), id);
await page.waitForTimeout(200);
await page.screenshot({ path: `${out}/levels-drawn.png` });
// Back to the defaults.
await page.evaluate((id) => window.chart.selectDrawing(id), id);
await page.waitForTimeout(200);
if (!(await page.locator('.fnc-levels-menu').isVisible())) await page.click('.fnc-selbar [aria-label="레벨 설정"]');
await page.click('.fnc-levels-menu >> text=기본 레벨로');
check((await levels()) === null, 'back to the defaults');
console.log(errors.length ? `FAILED\n${errors.join('\n')}` : 'all ok');
await browser.close();
process.exit(errors.length ? 1 : 0);
