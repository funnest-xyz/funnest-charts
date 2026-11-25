// 투명도 · 기준선 값 · 지표 위 지표의 타임프레임 · 도구 텍스트. Usage: node scripts/screenshots-settings-more.mjs [baseUrl] [outDir]
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
const { rsi, ma } = await page.evaluate(() => {
  for (const c of window.chart.getIndicators()) window.chart.removeIndicator(c.id);
  const rsi = window.chart.addIndicator('rsi');
  const ma = window.chart.addIndicatorOn(rsi, 'ma', { lines: [{ period: 5, source: 'close' }] });
  return { rsi, ma };
});
await page.waitForTimeout(300);

// RSI: opacity and level values through the dialog.
await page.evaluate(() => document.querySelector('.fnc-ind[aria-label^="RSI"]')?.click());
await page.waitForSelector('.fnc-dialog');
await page.click('.fnc-dialog [role="tab"] >> text=모습');
await page.locator('.fnc-dialog .fnc-opacity').first().fill('50');
await page.locator('.fnc-level-values input').first().fill('20');
await page.locator('.fnc-level-values input').first().dispatchEvent('change');
await page.locator('.fnc-level-values input').nth(1).fill('80');
await page.locator('.fnc-level-values input').nth(1).dispatchEvent('change');
await page.locator('.fnc-dialog').screenshot({ path: `${out}/style-opacity-levels.png` });
await page.click('.fnc-dialog button[type="submit"]');
await page.waitForTimeout(300);
const cfg = await page.evaluate((id) => window.chart.getIndicators().find((c) => c.id === id), rsi);
console.log('rsi styles', JSON.stringify(cfg.styles), JSON.stringify(cfg.display));
check(Object.values(cfg.styles).some((s) => /^#[0-9a-f]{8}$/i.test(s.color ?? '')), 'opacity kept in the color');
check(JSON.stringify(cfg.display.levelValues?.slice(0, 2)) === '[20,80]', 'level values 20 / 80');

// MA on RSI with its own timeframe (4h).
await page.evaluate((id) => window.chart.updateIndicator(id, { timeframe: '240' }), ma);
await page.waitForTimeout(1500);
const steps = await page.evaluate((id) => {
  const n = window.chart.bars.length;
  return [n - 9, n - 8, n - 7, n - 6, n - 5].map((i) => window.chart.indicatorLegend(i).find((x) => x.id === id)?.values[0]?.value);
}, ma);
const title = await page.evaluate((id) => window.chart.indicatorLegend().find((x) => x.id === id).title, ma);
console.log('MA on RSI, 4h:', title, steps);
check(title.includes('4시간') && steps.every((v) => v && v !== '—') && new Set(steps).size <= 3, 'MA on RSI computed on 4h bars');
await page.screenshot({ path: `${out}/rsi-levels-ma4h.png` });

// Notes on a trend line and a horizontal line.
const [tl, hl] = await page.evaluate(() => {
  const b = window.chart.bars;
  const tl = window.chart.addDrawing({ type: 'trendline', points: [{ time: b[b.length - 60].time, price: b[b.length - 60].low }, { time: b[b.length - 15].time, price: b[b.length - 15].high }] });
  const hl = window.chart.addDrawing({ type: 'horizontal', points: [{ time: b[b.length - 30].time, price: b[b.length - 30].close }] });
  return [tl, hl];
});
await page.evaluate((id) => window.chart.selectDrawing(id), tl);
await page.waitForTimeout(200);
await page.click('.fnc-selbar [aria-label="텍스트"]');
await page.fill('.fnc-note-menu textarea', '지지 추세선');
await page.click('.fnc-note-menu [aria-label="굵게"]');
await page.waitForTimeout(200);
await page.screenshot({ path: `${out}/note-menu.png` });
const st = await page.evaluate((id) => window.chart.getDrawings().find((d) => d.id === id).style, tl);
check(st?.text === '지지 추세선' && st.bold === true, 'trend line note saved');
await page.evaluate((id) => window.chart.updateDrawing(id, { style: { text: '저항', textH: 'right', textV: 'top', fontSize: 16 } }), hl);
await page.evaluate(() => window.chart.selectDrawing(null));
await page.waitForTimeout(300);
await page.screenshot({ path: `${out}/notes.png` });

console.log(errors.length ? `FAILED\n${errors.join('\n')}` : 'all ok');
await browser.close();
process.exit(errors.length ? 1 : 0);
