// 프리마켓 · 애프터마켓 가격 배지: where it meets the last price's on the price axis, it's drawn on top
// (outside the regular session it's the price trading now). The chart's own canvas at DPR 1 and 2.
// Usage: node scripts/check-extended-badge.mjs   (dev server on :5173)
import { writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const browser = await chromium.launch();
for (const dpr of [1, 2]) {
  const page = await (await browser.newContext({ viewport: { width: 1200, height: 700 }, deviceScaleFactor: dpr })).newPage();
  await page.goto('http://localhost:5173/');
  await page.waitForFunction(() => window.chart?.bars.length > 20, null, { timeout: 30000 });
  const png = await page.evaluate(async () => {
    const c = window.chart;
    for (const x of c.getIndicators()) c.removeIndicator(x.id);
    const last = c.bars[c.bars.length - 1];
    // A pre-market price a hair over the last close, so the two badges overlap; held there (the
    // demo feed's own quotes would replace it).
    const q = { price: last.close, extended: { price: last.close + 150, session: 'pre' } };
    Object.defineProperty(c, 'latestQuote', { get: () => q, set: () => {}, configurable: true });
    c.setSettings({ extendedPriceLine: false });
    c.setSettings({ extendedPriceLine: true });
    await new Promise((r) => setTimeout(r, 300));
    // The chart's main canvas as drawn (the badges live there).
    const main = [...document.querySelectorAll('.fnc-stage canvas')][0];
    return main.toDataURL('image/png');
  });
  writeFileSync(`test-results/screens/extended-badge-dpr${dpr}.png`, Buffer.from(png.split(',')[1], 'base64'));
  await page.context().close();
}
await browser.close();
console.log('ok');
