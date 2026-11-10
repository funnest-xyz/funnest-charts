// Visual check for intervals/favorites, symbol search, market bar, status bar and futures data.
// Usage: node scripts/screenshots-market.mjs   (dev server on :5173)
import { chromium, devices } from 'playwright';
const out = 'test-results/screens';
const errors = [];
const browser = await chromium.launch();
const open = async (opts, q = '') => {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto('http://localhost:5173/' + q);
  await page.waitForFunction(() => window.chart?.bars.length > 50, null, { timeout: 20000 });
  await page.waitForTimeout(1500);
  return { ctx, page };
};
const desk = { viewport: { width: 1280, height: 760 }, deviceScaleFactor: 2 };
{
  const { ctx, page } = await open(desk);
  console.log('resolution:', await page.evaluate(() => window.chart.currentResolution));
  await page.screenshot({ path: `${out}/n-desktop.png` });
  // interval menu + favorite 30분
  await page.click('.fnc-interval-trigger');
  await page.hover('.fnc-menu-row:has-text("30분")');
  await page.screenshot({ path: `${out}/n-interval-menu.png`, clip: { x: 0, y: 0, width: 760, height: 560 } });
  await page.click('.fnc-menu-row:has-text("30분") .fnc-star');
  await page.click('.fnc-menu-row:has-text("3개월") .fnc-menu-item');
  await page.waitForTimeout(1200);
  console.log('chips:', (await page.locator('.fnc-chip').allInnerTexts()).join(' '), '| resolution:', await page.evaluate(() => window.chart.currentResolution));
  await page.screenshot({ path: `${out}/n-3m.png` });
  // legend collapse
  await page.click('.fnc-ind-collapse');
  await page.screenshot({ path: `${out}/n-legend-collapsed.png`, clip: { x: 0, y: 100, width: 640, height: 200 } });
  await page.click('.fnc-ind-handle');
  // search
  await page.click('.fnc-symbol');
  await page.waitForSelector('.fnc-sr-row');
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${out}/n-search-empty.png` });
  await page.keyboard.type('비트');
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${out}/n-search-query.png` });
  await page.click('.fnc-tab:has-text("선물")');
  await page.fill('.fnc-search input', 'BTC');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${out}/n-search-futures.png` });
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.chart?.symbolInfo?.type === 'futures', null, { timeout: 20000 });
  await page.waitForTimeout(4000);
  console.log('futures quote:', JSON.stringify(await page.evaluate(() => window.chart.quote)));
  console.log('connection:', JSON.stringify(await page.evaluate(() => window.chart.connection)));
  await page.screenshot({ path: `${out}/n-futures.png` });
  await ctx.close();
}
{
  const { ctx, page } = await open({ ...devices['iPhone 13'] });
  await page.screenshot({ path: `${out}/n-mobile.png` });
  await page.tap('.fnc-symbol');
  await page.waitForSelector('.fnc-sr-row');
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${out}/n-mobile-search.png` });
  await ctx.close();
}
await browser.close();
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no page errors');
