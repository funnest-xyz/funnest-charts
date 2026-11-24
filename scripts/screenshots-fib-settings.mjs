// 피보나치 되돌림, TradingView's settings: words on a level (the middle of its line), the extra
// levels (off until turned on), levels in %, labels on the right, a bigger font.
// Usage: node scripts/screenshots-fib-settings.mjs [baseUrl] [outDir]
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
  const a = b[b.length - 70], z = b[b.length - 25];
  const id = window.chart.addDrawing({ type: 'fibonacci', points: [{ time: a.time, price: a.low }, { time: z.time, price: z.high }] });
  window.chart.selectDrawing(id);
  return id;
});
await page.waitForTimeout(200);
const style = () => page.evaluate((id) => window.chart.getDrawings().find((x) => x.id === id).style ?? {}, id);
await page.click('.fnc-selbar [aria-label="레벨 설정"]');
const rows = page.locator('.fnc-level-row');
check((await rows.count()) === 24, `7 levels on and 17 more offered (${await rows.count()})`);
check(!(await rows.nth(9).locator('input[type=checkbox]').isChecked()), 'the extra ones start off');
// Words on 0.618, and 1.618 turned on.
const t618 = rows.nth(4).locator('.fnc-level-text');
await t618.fill('황금 비율');
await t618.press('Enter');
await rows.nth(9).locator('input[type=checkbox]').check();
let s = await style();
check(s.levels?.[4]?.text === '황금 비율' && s.levels?.[9]?.on === true && s.levels?.[9]?.value === 1.618, 'text kept, 1.618 on');
await page.screenshot({ path: `${out}/fib-levels-text.png` });
await page.keyboard.press('Escape');
// Settings: % levels, labels on the right, font 14.
await page.click('.fnc-selbar [aria-label="도구 설정"]');
const menu = page.locator('.fnc-options-menu');
await menu.locator('label', { hasText: '레벨 표시' }).locator('select').selectOption('percent');
await menu.locator('label', { hasText: '라벨 가로 위치' }).locator('select').selectOption('right');
const font = menu.locator('label', { hasText: '폰트 크기' }).locator('input');
await font.fill('14');
await font.press('Enter');
s = await style();
check(s.options?.levelFormat === 'percent' && s.options?.labelH === 'right' && s.options?.fontSize === 14, `settings kept (${JSON.stringify(s.options)})`);
await page.screenshot({ path: `${out}/fib-options-menu.png` });
await page.keyboard.press('Escape');
await page.evaluate(() => window.chart.selectDrawing(null));
await page.waitForTimeout(200);
await page.screenshot({ path: `${out}/fib-settings-drawn.png` });
console.log(errors.length ? `FAILED\n${errors.join('\n')}` : 'all ok');
await browser.close();
process.exit(errors.length ? 1 : 0);
