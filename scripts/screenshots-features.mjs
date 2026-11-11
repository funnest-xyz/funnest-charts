// Smoke test for 0.6 features on the playground: log/% price axis, bar-close countdown,
// undo/redo, compare, bar replay and alert lines. Saves screenshots, exits 1 on failure.
// Usage: node scripts/screenshots-features.mjs [baseUrl] [outDir]
import { chromium } from 'playwright';

const base = process.argv[2] ?? 'http://localhost:5173';
const out = process.argv[3] ?? 'test-results/features';
const errors = [];
const log = (...a) => console.log(...a);
const check = (ok, message) => {
  if (!ok) errors.push(message);
  log(ok ? '  ok ' : '  FAIL', message);
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 760 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));
await page.addInitScript(() => localStorage.clear());
const ready = async (symbol, resolution) => {
  await page.goto(`${base}/?symbol=${symbol}&resolution=${resolution}`);
  await page.waitForFunction(() => window.chart?.bars.length > 0, null, { timeout: 20_000 });
  await page.waitForTimeout(500);
};
const shot = (name) => page.screenshot({ path: `${out}/${name}.png` });
const box = async () => page.locator('.fnc-stage').boundingBox();

// ── Price axis modes ──────────────────────────────────────────────────
await ready('DEMO:005930', '1D');
for (const mode of ['log', 'percent', 'normal']) {
  await page.evaluate((m) => window.chart.setSettings({ priceScale: m }), mode);
  await page.waitForTimeout(200);
  await shot(`scale-${mode}`);
}
await page.click('[aria-label="차트 설정"]');
await page.click('.fnc-seg [role="radio"] >> text=로그');
check((await page.evaluate(() => window.chart.settings.priceScale)) === 'log', 'settings dialog switches to log');
await shot('settings-dialog');
await page.keyboard.press('Escape');
await page.evaluate(() => window.chart.setSettings({ priceScale: 'normal' }));

// ── Countdown (24x7 intraday) ─────────────────────────────────────────
await ready('DEMO:BTCUSDT', '5');
const countdown = await page.evaluate(() => window.chart.frame?.countdown ?? null);
check(typeof countdown === 'string' && /^\d\d:\d\d$/.test(countdown), `countdown shows mm:ss (${countdown})`);
await shot('countdown');

// ── Undo / redo ───────────────────────────────────────────────────────
await ready('DEMO:005930', '1D');
await page.evaluate(() => window.chart.clearDrawings());
let b = await box();
await page.click('[aria-label="수평선"]');
await page.mouse.click(b.x + b.width * 0.5, b.y + b.height * 0.4);
await page.evaluate(() => window.chart.addIndicator('rsi'));
const count = () => page.evaluate(() => [window.chart.getDrawings().length, window.chart.getIndicators().length]);
const before = await count();
await page.mouse.click(b.x + b.width * 0.3, b.y + b.height * 0.8); // focus the widget
await page.keyboard.press('Control+z');
const afterUndo = await count();
check(afterUndo[1] === before[1] - 1 && afterUndo[0] === before[0], `Ctrl+Z removes the indicator (${before} → ${afterUndo})`);
await page.keyboard.press('Control+z');
check((await count())[0] === before[0] - 1, 'second Ctrl+Z removes the line');
await page.keyboard.press('Control+Shift+z');
await page.keyboard.press('Control+y');
check(JSON.stringify(await count()) === JSON.stringify(before), 'redo restores both');
check(!(await page.locator('.fnc-btn-undo >> nth=0').isDisabled()), 'undo button enabled');

// ── Compare ───────────────────────────────────────────────────────────
await page.click('.fnc-btn-compare');
await page.fill('.fnc-search input', 'SK');
await page.waitForTimeout(400);
await page.keyboard.press('Enter');
await page.waitForFunction(() => window.chart.getCompares()[0]?.ready, null, { timeout: 10_000 });
await page.waitForTimeout(300);
check((await page.evaluate(() => window.chart.getCompares().map((c) => c.symbol))).length === 1, 'compare added from search');
check((await page.locator('.fnc-cmp').count()) === 1, 'compare row in legend');
const axis = await page.evaluate(() => window.chart.frame.panes[0].tickFormat(window.chart.bars.at(-1).close));
check(axis.endsWith('%'), `axis switches to % while comparing (${axis})`);
await shot('compare');
check(JSON.stringify(await page.evaluate(() => window.widget.save().compares)) === '["DEMO:000660"]', 'compare saved in layout');
await page.hover('.fnc-cmp');
await page.click('.fnc-cmp .fnc-ind-btn');
check((await page.evaluate(() => window.chart.getCompares().length)) === 0, 'compare removed');

// ── Replay ────────────────────────────────────────────────────────────
const [total, lastTime] = await page.evaluate(() => [window.chart.bars.length, window.chart.bars.at(-1).time]);
await page.click('.fnc-btn-replay');
check(await page.locator('.fnc-replay-hint').isVisible(), 'replay hint while picking');
b = await box();
await page.mouse.move(b.x + b.width * 0.5, b.y + b.height * 0.5);
await page.waitForTimeout(100);
await shot('replay-pick');
await page.mouse.click(b.x + b.width * 0.5, b.y + b.height * 0.5);
await page.waitForTimeout(200);
const cut = await page.evaluate(() => window.chart.bars.length);
check(cut < total && (await page.evaluate(() => window.chart.replay.active)), `replay hides bars (${total} → ${cut})`);
await page.click('.fnc-replay [aria-label="한 봉 앞으로"]');
check((await page.evaluate(() => window.chart.bars.length)) === cut + 1, 'step reveals one bar');
await page.click('.fnc-replay [role="radio"] >> text=10x');
await page.click('.fnc-replay [aria-label="재생"]');
await page.waitForTimeout(650);
const played = await page.evaluate(() => window.chart.bars.length);
check(played >= cut + 4, `play reveals bars at 10x (${cut + 1} → ${played})`);
await shot('replay-playing');
await page.click('.fnc-replay [aria-label="리플레이 종료"]');
const restored = await page.evaluate(() => [window.chart.bars.length, window.chart.replay.active, window.chart.bars.at(-1).time]);
check(restored[0] >= total && !restored[1] && restored[2] >= lastTime, `exit restores every bar (${total} → ${restored[0]}, last ${lastTime} → ${restored[2]})`);

// ── Alert line ────────────────────────────────────────────────────────
await page.evaluate(() => {
  const last = window.chart.bars.at(-1).close;
  window.alertMoved = null;
  window.chart.addAlertLine({ price: Math.round(last * 1.03), onMove: (p) => (window.alertMoved = p), onCancel: () => {} });
});
await page.waitForTimeout(200);
await shot('alert-line');

await browser.close();
if (errors.length) {
  console.error(`\n${errors.length} problem(s):\n${errors.join('\n')}`);
  process.exit(1);
}
log('\nall feature checks passed');
