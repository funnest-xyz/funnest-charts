// Drawing tools on phones: the tool bar (portrait and landscape) and the selected drawing's bar.
// Usage: node scripts/screenshots-phone-tools.mjs [baseUrl] [outDir]
import { chromium, devices } from 'playwright';

const base = process.argv[2] ?? 'http://localhost:5173';
const out = process.argv[3] ?? 'test-results/phone-tools';
const browser = await chromium.launch();
for (const [name, device] of [
  ['portrait', devices['iPhone 13']],
  ['landscape', devices['iPhone 13 landscape']],
]) {
  const page = await (await browser.newContext({ ...device, locale: 'ko-KR' })).newPage();
  await page.addInitScript(() => localStorage.clear());
  await page.goto(`${base}/?symbol=DEMO:BTCUSDT&resolution=60`);
  await page.waitForFunction(() => window.chart?.bars.length > 0, null, { timeout: 20_000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}/${name}-chart.png` });
  // Open the tool bar (phones: the pencil in the toolbar).
  const pencil = page.locator('.fnc-btn-drawbar').first();
  if (await pencil.isVisible()) await pencil.click();
  await page.waitForTimeout(300);
  const bar = page.locator('.fnc-drawbar').first();
  const info = await bar.evaluate((el) => ({ fit: el.dataset.fit ?? null, h: el.clientHeight, sh: el.scrollHeight, w: el.clientWidth }));
  console.log(name, 'drawbar', JSON.stringify(info));
  await page.screenshot({ path: `${out}/${name}-drawbar.png` });
  const down = page.locator('.fnc-drawbar-more.is-down');
  console.log(name, 'more-below arrow:', await down.count());
  if (await down.count()) {
    await down.click();
    await page.waitForTimeout(500);
    console.log(name, 'scrolled to', await bar.evaluate((el) => el.scrollTop), 'more-above arrow:', await page.locator('.fnc-drawbar-more.is-up').count());
    await page.screenshot({ path: `${out}/${name}-drawbar-scrolled.png` });
  }
  if (await pencil.isVisible()) await pencil.click();
  await page.waitForTimeout(300);
  // A drawing selected: its bar.
  const id = await page.evaluate(() => {
    const b = window.chart.bars;
    return window.chart.addDrawing({ type: 'trendline', points: [{ time: b[b.length - 30].time, price: b[b.length - 30].low }, { time: b[b.length - 8].time, price: b[b.length - 8].high }] });
  });
  await page.evaluate((id) => window.chart.selectDrawing(id), id);
  await page.waitForTimeout(300);
  const sel = await page.locator('.fnc-selbar').first().evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { left: Math.round(r.left), right: Math.round(r.right), vw: innerWidth, sw: el.scrollWidth, cw: el.clientWidth };
  });
  console.log(name, 'selbar', JSON.stringify(sel));
  await page.screenshot({ path: `${out}/${name}-selbar.png` });
  await page.click('.fnc-selbar [aria-label="좌표"]');
  await page.waitForTimeout(300);
  const pop = await page.locator('.fnc-coords-menu').evaluate((el) => { const r = el.getBoundingClientRect(); return { left: Math.round(r.left), right: Math.round(r.right), top: Math.round(r.top), bottom: Math.round(r.bottom), vw: innerWidth, vh: innerHeight }; });
  console.log(name, 'coords menu', JSON.stringify(pop));
  await page.screenshot({ path: `${out}/${name}-selbar-menu.png` });
  await page.context().close();
}
await browser.close();
