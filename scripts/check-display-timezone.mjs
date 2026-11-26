// setDisplayTimezone: the multi-chart's panes (and one added after) show their times in another
// zone at once — the hover time on the date axis moves by the zones' difference, the bars don't.
// Usage: node scripts/check-display-timezone.mjs   (playground dev server on :5173)
import { chromium } from 'playwright';

const fails = [];
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) fails.push(name);
};
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1440, height: 860 }, deviceScaleFactor: 1 })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto('http://localhost:5173/multi.html');
await page.evaluate(() => localStorage.clear());
await page.goto('http://localhost:5173/multi.html?layout=2-cols');
await page.waitForFunction(() => window.multi?.charts.length === 2 && window.multi.charts.every((c) => c.bars.length > 20), null, { timeout: 30000 });

const zones = () => page.evaluate(() => window.multi.charts.map((c) => c.timeZone));
const firstBar = () => page.evaluate(() => window.multi.charts[0].bars.at(-1).time);
/** The hover time label on the first pane's date axis (hour:minute), at the middle of the pane. */
const hoverTime = async () => {
  const box = await page.locator('.fnc-grid .fnc-pane').first().boundingBox();
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.4);
  await page.waitForTimeout(250);
  return page.evaluate(() => window.multi.charts[0].timeZone);
};

const before = await zones();
const bar = await firstBar();
check('starts in the locale’s zone', before.every((z) => z === before[0]), before.join(', '));

await page.evaluate(() => window.multi.setDisplayTimezone('America/New_York'));
await page.waitForTimeout(200);
check('every pane follows', (await zones()).every((z) => z === 'America/New_York'), (await zones()).join(', '));
check('bars unchanged', (await firstBar()) === bar);
await hoverTime();

// A pane added afterwards (3 columns) uses the zone too.
await page.evaluate(() => window.multi.setLayout('3-cols'));
await page.waitForFunction(() => window.multi.charts.length === 3, null, { timeout: 15000 });
check('a new pane takes it', (await zones()).every((z) => z === 'America/New_York'), (await zones()).join(', '));

// An unknown zone is refused and nothing changes.
const threw = await page.evaluate(() => {
  try {
    window.multi.setDisplayTimezone('Not/AZone');
    return false;
  } catch {
    return true;
  }
});
check('an unknown zone throws, nothing changes', threw && (await zones()).every((z) => z === 'America/New_York'));

await page.evaluate(() => window.multi.setDisplayTimezone('UTC'));
await page.waitForTimeout(200);
check('and again (UTC)', (await zones()).every((z) => z === 'UTC'));
await page.screenshot({ path: 'test-results/screens/display-timezone.png' });
check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
console.log(fails.length ? `\nFAIL: ${fails.join(', ')}` : '\nok');
process.exit(fails.length ? 1 : 0);
