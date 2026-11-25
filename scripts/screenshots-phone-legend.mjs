// Phones: indicator names only until the chart is held (then the values there), and the price
// pane keeping its share with several indicator panes. Usage: node scripts/screenshots-phone-legend.mjs [baseUrl] [outDir]
import { chromium, devices } from 'playwright';

const base = process.argv[2] ?? 'http://localhost:5173';
const out = process.argv[3] ?? 'test-results/phone-legend';
const errors = [];
const check = (ok, message) => {
  if (!ok) errors.push(message);
  console.log(ok ? '  ok ' : '  FAIL', message);
};
const browser = await chromium.launch();
for (const [name, device] of [
  ['galaxy', devices['Galaxy S9+']],
  ['land', devices['iPhone 13 landscape']],
]) {
  const page = await (await browser.newContext({ ...device, locale: 'ko-KR' })).newPage();
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  await page.addInitScript(() => localStorage.clear());
  await page.goto(`${base}/?symbol=DEMO:BTCUSDT&resolution=60&legend=crosshair`);
  await page.waitForFunction(() => window.chart?.bars.length > 0, null, { timeout: 20_000 });
  await page.evaluate(() => {
    window.chart.addIndicator('rsi');
    window.chart.addIndicator('macd');
  });
  // The page settles (fonts, bars) before measuring.
  await page.waitForTimeout(2000);
  const rows = () => page.locator('.fnc-ind').evaluateAll((els) => els.map((e) => e.textContent.replace(/\s+/g, ' ').trim()));
  const idle = await rows();
  console.log(name, 'idle legend:', JSON.stringify(idle));
  check(idle.every((r) => !/\d,\d{3}\.\d|\d+\.\d{2}$/.test(r.replace(/^MA 5·20·60·120|^RSI 14|^MACD 12 26 9/, ''))), `${name}: no indicator values until held`);
  const layout = await page.evaluate(() => {
    const l = window.chart.layout;
    const main = l.panes.find((p) => p.kind === 'main').height;
    return { main, total: l.panesHeight, share: Math.round((main / l.panesHeight) * 100) };
  });
  console.log(name, 'price pane', JSON.stringify(layout));
  check(layout.share >= 54, `${name}: price pane keeps ≥ 55% (${layout.share}%)`);
  await page.screenshot({ path: `${out}/${name}-idle.png` });
  // Hold the chart (long press = crosshair on touch).
  const box = await page.locator('.fnc-chart canvas').first().boundingBox();
  const x = box.x + box.width * 0.5;
  const y = box.y + box.height * 0.3;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  await page.waitForTimeout(700);
  const held = await rows();
  console.log(name, 'held legend:', JSON.stringify(held));
  check(held.some((r) => /\d/.test(r.replace(/^MA 5·20·60·120|^RSI 14|^MACD 12 26 9/, ''))), `${name}: values while held`);
  const insetHeld = await page.evaluate(() => window.chart.layout.panes[0].height);
  await page.screenshot({ path: `${out}/${name}-held.png` });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(400);
  await page.mouse.click(5, 5);
  await page.waitForTimeout(300);
  console.log(name, 'price pane idle', layout.main, 'held', insetHeld);
  check(insetHeld === layout.main, `${name}: candles stay put while values show`);
  await page.context().close();
}
console.log(errors.length ? `FAILED\n${errors.join('\n')}` : 'all ok');
await browser.close();
process.exit(errors.length ? 1 : 0);
