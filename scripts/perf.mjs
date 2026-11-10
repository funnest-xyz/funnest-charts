// Measures full-frame render cost with many bars visible. Usage: node scripts/perf.mjs [baseUrl]
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 });
await page.goto(process.argv[2] ?? 'http://localhost:5173');
await page.waitForFunction(() => window.chart?.bars.length > 0);
const result = await page.evaluate((count) => {
  const chart = window.chart;
  const bars = [];
  let p = 100;
  for (let i = 0; i < count; i++) {
    const o = p;
    p *= 1 + (Math.random() - 0.5) * 0.01;
    bars.push({ time: i * 60_000, open: o, high: Math.max(o, p) * 1.002, low: Math.min(o, p) * 0.998, close: p, volume: Math.random() * 1000 });
  }
  chart.setData(bars);
  const out = {};
  for (const [label, spacing] of [['all bars visible', 0.5], ['default zoom', 8]]) {
    chart.timeScale.barSpacing = spacing;
    const times = [];
    for (let i = 0; i < 60; i++) {
      chart.timeScale.pan(3);
      chart.mainDirty = true;
      const t = performance.now();
      chart.render();
      times.push(performance.now() - t);
    }
    times.sort((a, b) => a - b);
    const range = chart.timeScale.visibleRange();
    out[label] = { visibleBars: range.to - range.from + 1, medianMs: +times[30].toFixed(2), p95Ms: +times[57].toFixed(2) };
  }
  return out;
}, 20_000);
console.table(result);
await browser.close();
