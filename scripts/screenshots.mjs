// Visual smoke test of the playground on desktop and mobile. Saves screenshots and
// fails loudly on page errors. Usage: node scripts/screenshots.mjs [baseUrl] [outDir]
import { chromium, devices } from 'playwright';

const base = process.argv[2] ?? 'http://localhost:5173';
const out = process.argv[3] ?? 'test-results/screens';
const errors = [];
const log = (...a) => console.log(...a);
const browser = await chromium.launch();

async function open(contextOptions, query = '') {
  const ctx = await browser.newContext(contextOptions);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));
  await page.goto(base + query);
  await page.waitForFunction(() => window.chart?.bars.length > 0, null, { timeout: 20_000 });
  await page.waitForTimeout(600);
  return { ctx, page };
}
const shot = (page, name) => page.screenshot({ path: `${out}/${name}.png` });
const stageBox = (page) => page.locator('.fnc-stage').boundingBox();
/** y (page px) of a price in the main pane. */
const priceY = async (page, price) => {
  const box = await stageBox(page);
  return box.y + (await page.evaluate((p) => window.chart.mainScale.priceToY(p), price));
};

// ── Desktop ─────────────────────────────────────────────────────────
{
  const { ctx, page } = await open({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
  await page.evaluate(() => window.chart.clearDrawings());
  await shot(page, 'desktop');
  const box = await stageBox(page);
  const at = (fx, fy) => [box.x + box.width * fx, box.y + box.height * fy];

  // Trendline: click-click
  await page.click('[aria-label="추세선"]');
  await page.mouse.click(...at(0.15, 0.6));
  await page.mouse.move(...at(0.45, 0.3), { steps: 5 });
  await page.mouse.click(...at(0.45, 0.3));
  // Horizontal line: single click
  await page.click('[aria-label="수평선"]');
  await page.mouse.click(...at(0.6, 0.45));
  // Fibonacci: drag
  await page.click('[aria-label="피보나치 되돌림"]');
  await page.mouse.move(...at(0.55, 0.7));
  await page.mouse.down();
  await page.mouse.move(...at(0.8, 0.2), { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(150);
  log('drawings:', (await page.evaluate(() => window.chart.getDrawings().map((d) => d.type))).join(', '));
  await shot(page, 'desktop-drawings');

  // Select the trendline, recolor it, then move it
  await page.mouse.click(...at(0.3, 0.45));
  await page.waitForSelector('.fnc-selbar');
  await page.click('.fnc-swatch >> nth=1');
  await shot(page, 'desktop-selected');

  // Trading demo + drag the buy order line up by a few ticks
  await page.click('#trading');
  await page.waitForFunction(() => window.chart.trading.orders.size > 0);
  await page.keyboard.press('Escape'); // deselect drawing
  await page.waitForTimeout(150);
  log('adapter: orders=' + (await page.evaluate(() => window.chart.trading.orders.size)) +
    ' fills=' + (await page.evaluate(() => window.chart.trading.executionList.length)));
  await shot(page, 'desktop-trading');
  // Hover a fill marker → tooltip
  const marker = await page.evaluate(() => window.chart.trading.groups.find((g) => g.x > 40 && g.x < window.chart.layout.plotWidth - 40));
  if (marker) {
    await page.mouse.move(box.x + marker.x, box.y + marker.y);
    await page.waitForTimeout(150);
    await shot(page, 'desktop-fill-tooltip');
  }
  const buyPrice = await page.evaluate(() => [...window.chart.trading.orders.values()][0].price);
  const y0 = await priceY(page, buyPrice);
  await page.mouse.move(box.x + 30, y0);
  await page.mouse.down();
  await page.mouse.move(box.x + 30, y0 - 40, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(500);
  const movedPrice = await page.evaluate(() => [...window.chart.trading.orders.values()][0].price);
  log(`order drag: ${buyPrice} → ${movedPrice}`);
  await shot(page, 'desktop-order-moved');

  // Indicators: add Bollinger, RSI, MACD from the picker (MA is on by default)
  await page.click('#trading'); // trading demo off, to keep the shot readable
  await page.evaluate(() => window.chart.clearDrawings());
  for (const name of ['볼린저밴드', 'RSI', 'MACD']) {
    await page.click('[aria-label="지표 추가"]');
    await page.click(`.fnc-sr-row:has-text("${name}")`);
  }
  await page.waitForTimeout(200);
  log('indicators:', (await page.evaluate(() => window.chart.getIndicators().map((i) => i.type))).join(', '));
  await shot(page, 'desktop-indicators');
  const panes = await page.evaluate(() => window.chart.layout.panes);
  const rsiPane = panes.find((p) => p.kind === 'indicator');
  await page.mouse.move(box.x + box.width * 0.6, box.y + rsiPane.top + rsiPane.height / 2);
  await page.waitForTimeout(100);
  await shot(page, 'desktop-indicators-hover');
  // MA settings: row 1 → period 10, 3px; row 2 → source 고가; remove row 4; add a row
  await page.click('.fnc-ind >> nth=0 >> .fnc-ind-title');
  await page.waitForSelector('.fnc-form');
  await page.fill('[aria-label="기간1"]', '10');
  await page.selectOption('.fnc-row >> nth=0 >> .fnc-select-width', '3');
  await page.selectOption('.fnc-row >> nth=1 >> .fnc-select-source', 'high');
  await page.click('.fnc-row >> nth=3 >> [aria-label="기간 삭제"]');
  await page.click('.fnc-add-row');
  await shot(page, 'desktop-indicator-settings');
  await page.click('.fnc-action-primary');
  await page.waitForTimeout(150);
  log('MA config:', JSON.stringify(await page.evaluate(() => {
    const c = window.chart.getIndicators()[0];
    return { lines: c.params.lines, l0: c.styles.l0 };
  })));
  // Eye: hide Bollinger; collapse the overlay list
  await page.click('.fnc-ind >> nth=1 >> .fnc-ind-eye');
  await page.waitForTimeout(100);
  await shot(page, 'desktop-indicator-hidden');
  log('BB visible:', await page.evaluate(() => window.chart.getIndicators()[1].visible));
  await page.click('.fnc-ind-collapse');
  await page.waitForTimeout(100);
  await shot(page, 'desktop-indicators-collapsed');
  await page.click('.fnc-ind-handle');
  // RSI settings dialog (inputs + style rows)
  await page.click('.fnc-pane-legend >> nth=0 >> .fnc-ind-title');
  await page.waitForSelector('.fnc-form');
  await shot(page, 'desktop-rsi-settings');
  await page.click('.fnc-action:has-text("취소")');

  // Chart type: area
  await page.click('.fnc-btn-tools');
  await page.waitForSelector('.fnc-tools-menu');
  await shot(page, 'desktop-tools-menu');
  await page.click('.fnc-tools-seg [data-type="area"]');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
  await shot(page, 'desktop-area');
  await ctx.close();
}

// ── Desktop: live Upbit via WebSocket ───────────────────────────────
{
  const { ctx, page } = await open(
    { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 },
    '?symbol=UPBIT:KRW-BTC&resolution=1',
  );
  const first = await page.evaluate(() => JSON.stringify(window.chart.bars.at(-1)));
  await page.waitForTimeout(5000);
  const later = await page.evaluate(() => JSON.stringify(window.chart.bars.at(-1)));
  log(`upbit live: bars=${await page.evaluate(() => window.chart.bars.length)} lastBarChanged=${first !== later}`);
  await shot(page, 'desktop-upbit-live');
  await page.click('.fnc-symbol');
  await page.waitForSelector('.fnc-sr-row');
  await page.keyboard.type('이더');
  await page.waitForTimeout(600);
  await shot(page, 'desktop-search-upbit');
  await ctx.close();
}

// ── Mobile ──────────────────────────────────────────────────────────
{
  const { ctx, page } = await open({ ...devices['iPhone 13'] });
  await shot(page, 'mobile');
  await page.tap('.fnc-interval-trigger');
  await page.waitForSelector('.fnc-interval-menu');
  await shot(page, 'mobile-interval-menu');
  await page.tap('.fnc-menu-item:has-text("1시간")');
  await page.waitForTimeout(800);
  log('mobile interval:', await page.evaluate(() => window.chart.currentResolution));
  await page.tap('.fnc-ind >> nth=0');
  await page.waitForSelector('.fnc-form');
  await shot(page, 'mobile-indicator-settings');
  await page.tap('.fnc-action:has-text("취소")');
  await page.tap('.fnc-btn-drawbar');
  await page.waitForTimeout(300);
  await shot(page, 'mobile-drawbar');
  await page.tap('[aria-label="수평선"]');
  const box = await stageBox(page);
  await page.tap('.fnc-stage', { position: { x: box.width * 0.5, y: box.height * 0.4 } });
  await page.waitForTimeout(200);
  await shot(page, 'mobile-drawn');
  await ctx.close();
}

await browser.close();
console.log(errors.length ? `ERRORS:\n${errors.join('\n')}` : 'no page errors');
