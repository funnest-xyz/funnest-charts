// Visual/behavior check: multi-chart (split layouts, active pane, sync, maximize, persistence).
// Usage: node scripts/screenshots-multi.mjs   (dev server on :5173)
import { chromium } from 'playwright';

const out = 'test-results/screens';
const errors = [];
const fails = [];
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) fails.push(name);
};
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 860 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
const loaded = (n) =>
  page.waitForFunction((n) => window.multi?.charts.length === n && window.multi.charts.every((c) => c.bars.length > 20), n, { timeout: 30000 });
const ev = (fn, arg) => page.evaluate(fn, arg);
const panes = page.locator('.fnc-grid .fnc-pane');

await page.goto('http://localhost:5173/multi.html');
await page.evaluate(() => localStorage.clear());
await page.goto('http://localhost:5173/multi.html?layout=4-grid');
await loaded(4);
await page.waitForTimeout(800);
await page.screenshot({ path: `${out}/multi-4grid.png` });
check('4-grid shows 4 panes', (await panes.count()) === 4);

// Activate pane 3 (BTC) by clicking it → toolbar follows
const box2 = await panes.nth(2).boundingBox();
await page.mouse.click(box2.x + box2.width * 0.4, box2.y + box2.height * 0.5);
await page.waitForTimeout(300);
check('click activates pane', (await ev(() => window.multi.activeIndex)) === 2);
check('toolbar follows active pane', ((await page.locator('.fnc-symbol-name').textContent()) ?? '').includes('비트코인'));

// Crosshair sync: hover pane 0 → pane 1 gets a mirrored crosshair
await ev(() => {
  window.__sync = [];
  window.multi.charts[1].on('crosshairMove', (i) => i && window.__sync.push(i.source));
});
const box0 = await panes.nth(0).boundingBox();
await page.mouse.move(box0.x + box0.width * 0.5, box0.y + box0.height * 0.5);
await page.waitForTimeout(300);
check('crosshair mirrored to other pane', await ev(() => window.__sync.includes('sync')));
await page.screenshot({ path: `${out}/multi-crosshair.png` });

// Layout menu → 3-left
await page.click('.fnc-btn-layout');
await page.waitForSelector('.fnc-layout-menu');
await page.screenshot({ path: `${out}/multi-layout-menu.png` });
await page.click('.fnc-layout-opt[data-layout="3-left"]');
await page.waitForTimeout(500);
check('layout 3-left → 3 panes', (await panes.count()) === 3, String(await ev(() => window.multi.layout)));
check('active index kept within range', (await ev(() => window.multi.activeIndex)) === 2);

// Symbol + interval sync from the active pane (demo data: no exchange rate limits)
await page.keyboard.press('Alt+Digit1');
await page.waitForTimeout(200);
await page.click('.fnc-btn-sync');
await page.click('.fnc-sync-item:has-text("종목")');
await page.click('.fnc-sync-item:has-text("주기")');
await page.screenshot({ path: `${out}/multi-sync-menu.png` });
await page.keyboard.press('Escape');
const allOn = (sym) => ev((sym) => window.multi.charts.every((c) => c.symbolInfo?.symbol === sym), sym);
await page.waitForFunction(() => window.multi.charts.every((c) => c.symbolInfo?.symbol === 'DEMO:005930'), null, { timeout: 20000 }).catch(() => {});
check(
  'symbol+interval sync applied on enable',
  await ev(() => window.multi.charts.every((c) => c.symbolInfo?.symbol === 'DEMO:005930' && c.currentResolution === '1D')),
  JSON.stringify(await ev(() => window.multi.charts.map((c) => `${c.symbolInfo?.symbol}/${c.currentResolution}`))),
);
await ev(() => window.multi.setSymbol('DEMO:000660'));
await page.waitForFunction(() => window.multi.charts.every((c) => c.symbolInfo?.symbol === 'DEMO:000660'), null, { timeout: 20000 }).catch(() => {});
check('setSymbol propagates with symbol sync', await allOn('DEMO:000660'));
await ev(() => window.multi.setSync({ symbol: false }));
await page.waitForTimeout(300);

// Time sync: scroll the active pane → same-interval panes follow
await ev(() => window.multi.setSync({ time: true }));
await page.waitForTimeout(400);
const act = await panes.nth(0).boundingBox();
await page.mouse.move(act.x + act.width * 0.5, act.y + act.height * 0.5);
await page.mouse.wheel(0, 400);
await page.waitForTimeout(600);
const ranges = await ev(() => window.multi.charts.map((c) => c.getVisibleTimeRange()));
const DAY = 86_400_000;
const close = (a, b) => Math.abs(a.from - b.from) < DAY && Math.abs(a.to - b.to) < DAY;
check(
  'time range synced',
  close(ranges[0], ranges[1]) && close(ranges[0], ranges[2]),
  JSON.stringify(ranges.map((r) => [new Date(r.from).toISOString(), new Date(r.to).toISOString()])),
);
await page.screenshot({ path: `${out}/multi-3left-synced.png` });
await ev(() => window.multi.setSync({ time: false, interval: false }));

// Splitter drag
const before = await panes.nth(0).boundingBox();
const splitter = await page.locator('.fnc-grid .fnc-splitter-row').first().boundingBox();
// A quarter down: the middle is where the right column's own splitter crosses.
const sy = splitter.y + splitter.height / 4;
await page.mouse.move(splitter.x + 0.5, sy);
await page.mouse.down();
await page.mouse.move(splitter.x + 200, sy, { steps: 5 });
await page.mouse.up();
await page.waitForTimeout(300);
const after = await panes.nth(0).boundingBox();
check('splitter resizes panes', after.width > before.width + 150, `${Math.round(before.width)} → ${Math.round(after.width)}`);

// Maximize with Alt+Enter, then back
await page.keyboard.press('Alt+Enter');
await page.waitForTimeout(300);
check('Alt+Enter maximizes', (await panes.count()) === 1);
await page.screenshot({ path: `${out}/multi-maximized.png` });
await page.keyboard.press('Alt+Enter');
await page.waitForTimeout(300);
check('Alt+Enter restores', (await panes.count()) === 3);
await page.keyboard.press('Alt+Digit1');
await page.waitForTimeout(200);
check('Alt+1 activates pane 1', (await ev(() => window.multi.activeIndex)) === 0);

// Navigation buttons can be switched off in chart settings
const navBefore = await page.locator('.fnc-grid .fnc-pane').first().locator('.fnc-nav').count();
await ev(() => window.multi.activeChart.setSettings({ navigationButtons: false }));
await page.waitForTimeout(200);
const navAfter = await page.locator('.fnc-grid .fnc-pane').first().locator('.fnc-nav').count();
check('navigation buttons toggle off', navBefore === 1 && navAfter === 0, `${navBefore} → ${navAfter}`);
await ev(() => window.multi.activeChart.setSettings({ navigationButtons: true }));

// Persistence
await page.waitForTimeout(300);
await page.goto('http://localhost:5173/multi.html');
await page.waitForFunction(() => window.multi?.layout === '3-left', null, { timeout: 10000 }).catch(() => {});
await loaded(3).catch(() => {});
check('reload restores layout', (await ev(() => window.multi.layout)) === '3-left');
const restoredWidth = (await panes.first().boundingBox()).width;
check('reload restores sizes', Math.abs(restoredWidth - after.width) < 4, `${Math.round(restoredWidth)} vs ${Math.round(after.width)}`);

// Narrow container → active pane + tabs
await page.setViewportSize({ width: 520, height: 800 });
await page.waitForTimeout(500);
check('narrow: one pane + tabs', (await panes.count()) === 1 && (await page.locator('.fnc-pane-tab').count()) === 3);
await page.screenshot({ path: `${out}/multi-narrow.png` });
await page.click('.fnc-pane-tab >> nth=1');
await page.waitForTimeout(300);
check('narrow: tab switches pane', (await ev(() => window.multi.activeIndex)) === 1);
await page.setViewportSize({ width: 1440, height: 860 });

// Tooltips: drawing bar → to the right; toolbar → below; no native title attributes
const drawBtn = page.locator('.fnc-drawbar button[data-tip]').nth(1);
await page.mouse.move(700, 400);
await drawBtn.hover();
await page.waitForTimeout(600);
const tip = await page.evaluate(() => {
  const t = document.querySelector('.fnc-tip.is-on');
  return t ? { text: t.textContent, side: t.dataset.side } : null;
});
check('drawing bar tooltip on the right', tip?.side === 'right' && !!tip.text, JSON.stringify(tip));
await page.screenshot({ path: `${out}/multi-tooltip-drawbar.png` });
await page.hover('.fnc-toolbar [data-tip]:not(.fnc-symbol) >> nth=2');
await page.waitForTimeout(200);
check('toolbar tooltip moves without a new delay', (await page.locator('.fnc-tip.is-on').count()) === 1);
check('no native title tooltips left', (await page.locator('.fnc-root [title]').count()) === 0, String(await page.locator('.fnc-root [title]').count()));

// Single widget still works (regression)
await page.goto('http://localhost:5173/?symbol=DEMO:005930&resolution=1D');
await page.waitForFunction(() => window.chart?.bars.length > 50, null, { timeout: 20000 });
check('single widget has no layout menu', (await page.locator('.fnc-btn-layout').count()) === 0);
await page.keyboard.press('Control+k');
await page.waitForTimeout(300);
check('single widget Ctrl+K search', (await page.locator('[role="dialog"]').count()) > 0);
await page.screenshot({ path: `${out}/multi-single-regression.png` });

console.log(errors.length ? `ERRORS:\n${errors.join('\n')}` : 'no page errors');
console.log(fails.length ? `${fails.length} FAILED` : 'all passed');
await browser.close();
process.exit(fails.length || errors.length ? 1 : 0);
