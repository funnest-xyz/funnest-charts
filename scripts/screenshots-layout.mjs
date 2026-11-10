// Visual/behavior check: chart settings dialog, per-symbol drawings, layout save/restore, React wrapper.
// Usage: node scripts/screenshots-layout.mjs   (dev server on :5173)
import { chromium } from 'playwright';

const out = 'test-results/screens';
const errors = [];
const log = (...a) => console.log(...a);
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 760 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
const ready = () => page.waitForFunction(() => window.chart?.bars.length > 50 && window.chart.symbolInfo, null, { timeout: 20000 });

await page.goto('http://localhost:5173/?symbol=DEMO:005930&resolution=1D');
await page.evaluate(() => localStorage.clear());
await page.goto('http://localhost:5173/');
await ready();
await page.waitForTimeout(800);

// 1. Settings dialog
await page.click('[aria-label="차트 설정"]');
await page.waitForSelector('.fnc-switch');
await page.click('.fnc-toggle-row:has-text("최고·최저 표시") .fnc-switch');
await page.click('.fnc-toggle-row:has-text("세로 격자") .fnc-switch');
await page.locator('.fnc-row:has-text("상승 색") input[type=color]').evaluate((el) => {
  el.value = '#12b886';
  el.dispatchEvent(new Event('input', { bubbles: true }));
});
await page.waitForTimeout(200);
await page.screenshot({ path: `${out}/l-settings.png` });
log('settings:', JSON.stringify(await page.evaluate(() => window.chart.settings)));
await page.click('.fnc-action-primary');

// 2. Per-symbol drawings
const box = await page.locator('.fnc-stage').boundingBox();
await page.click('[aria-label="수평선"]');
await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.4);
const count = () => page.evaluate(() => window.chart.getDrawings().length);
log('drawings on 삼성전자:', await count());
await page.evaluate(() => window.widget.setSymbol('DEMO:000660'));
await page.waitForFunction(() => window.chart.symbolInfo.symbol === 'DEMO:000660');
log('drawings on SK하이닉스:', await count());
await page.evaluate(() => window.widget.setSymbol('DEMO:005930'));
await page.waitForFunction(() => window.chart.symbolInfo.symbol === 'DEMO:005930');
log('drawings back on 삼성전자:', await count());

// 3. Autosave → reload → restored
await page.click('[aria-label="차트 종류"]');
await page.click('.fnc-menu-item >> nth=2'); // area
await page.waitForTimeout(300);
await page.reload();
await ready();
await page.waitForTimeout(1200);
log(
  'after reload:',
  JSON.stringify(
    await page.evaluate(() => ({
      symbol: window.chart.symbolInfo.symbol,
      type: window.chart.type,
      highLow: window.chart.settings.highLowMarkers,
      upColor: window.chart.settings.upColor,
      drawings: window.chart.getDrawings().length,
    })),
  ),
);
await page.screenshot({ path: `${out}/l-restored.png` });

// 4. React wrapper
const r = await ctx.newPage();
r.on('pageerror', (e) => errors.push('react: ' + e.message));
r.on('console', (m) => m.type() === 'error' && errors.push('react: ' + m.text()));
await r.goto('http://localhost:5173/react.html');
await r.waitForSelector('.fnc-root canvas');
await r.waitForSelector('.react-badge', { timeout: 20000 });
log('react: roots =', await r.locator('.fnc-root').count(), '| badge =', await r.locator('.react-badge').innerText());
await r.click('#save');
await r.click('#sym-BTCUSDT');
await r.waitForFunction(() => document.querySelector('.fnc-symbol-name')?.textContent === 'BTC/USDT');
log('react: switched to', await r.locator('.fnc-symbol-name').innerText());
await r.screenshot({ path: `${out}/l-react.png` });
await r.click('#load');
await r.waitForFunction(() => document.querySelector('#log')?.textContent === '복원됨', null, { timeout: 15000 });
log('react: after load', await r.locator('.fnc-symbol-name').innerText());

await browser.close();
log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no page errors');
