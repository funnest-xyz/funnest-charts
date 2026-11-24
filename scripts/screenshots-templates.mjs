// 그리기 템플릿: save a line's look by name, change the line, apply the template back; delete it.
// Usage: node scripts/screenshots-templates.mjs [baseUrl] [outDir]
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
  const a = b[b.length - 60], z = b[b.length - 10];
  const id = window.chart.addDrawing({ type: 'trendline', points: [{ time: a.time, price: a.low }, { time: z.time, price: z.high }], color: '#F04452', style: { width: 3, dash: 'dashed' } });
  window.chart.selectDrawing(id);
  return id;
});
await page.waitForTimeout(300);
await page.click('.fnc-selbar [aria-label="템플릿"]');
await page.click('.fnc-template-menu >> text=지금 모양을 템플릿으로 저장');
await page.fill('.fnc-template-name', '빨간 점선');
await page.keyboard.press('Enter');
check((await page.evaluate(() => JSON.parse(localStorage.getItem('fnc-drawing-templates') ?? '{}').trendline?.[0]?.name)) === '빨간 점선', 'template saved for the tool');
// Change the line, then apply the template back.
await page.evaluate((id) => window.chart.updateDrawing(id, { color: '#3182F6', style: { width: 1, dash: 'solid', text: '메모' } }), id);
await page.evaluate((id) => window.chart.selectDrawing(id), id);
await page.waitForTimeout(200);
await page.click('.fnc-selbar [aria-label="템플릿"]');
await page.screenshot({ path: `${out}/template-menu.png` });
await page.click('.fnc-template-row .fnc-menu-item');
const d = await page.evaluate((id) => window.chart.getDrawings().find((x) => x.id === id), id);
check(d.color === '#F04452' && d.style.width === 3 && d.style.dash === 'dashed' && d.style.text === '메모', `applied, text kept (${JSON.stringify({ color: d.color, style: d.style })})`);
await page.click('.fnc-selbar [aria-label="템플릿"]');
await page.click('.fnc-template-row [aria-label$="템플릿 지우기"]');
check((await page.evaluate(() => localStorage.getItem('fnc-drawing-templates'))) === '{}', 'deleted');
console.log(errors.length ? `FAILED\n${errors.join('\n')}` : 'all ok');
await browser.close();
process.exit(errors.length ? 1 : 0);
