// Landing page (apps/site static export) screenshots + chart component interaction checks.
// Run `pnpm --filter site build` first.
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { chromium } from 'playwright';

const OUT = resolve('apps/site/out');
const SHOTS = resolve('test-results/site');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.txt': 'text/plain', '.woff2': 'font/woff2' };

// BASE_PATH=/charts when the site was built for funnest.xyz/charts.
const BASE = process.env.BASE_PATH ?? '';
const server = createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (BASE) {
    if (!p.startsWith(BASE)) return res.writeHead(404).end();
    p = p.slice(BASE.length) || '/';
  }
  if (p.endsWith('/')) p += 'index.html';
  try {
    const body = await readFile(join(OUT, p));
    res.writeHead(200, { 'content-type': TYPES[extname(p)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end();
  }
}).listen(0);
// SITE_URL=https://… tests a deployed site instead of the local build.
const url = process.env.SITE_URL ? process.env.SITE_URL.replace(/\/?$/, '/') : `http://localhost:${server.address().port}${BASE}/`;
await mkdir(SHOTS, { recursive: true });

const browser = await chromium.launch();
const errors = [];
let failed = false;
const check = (ok, msg) => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${msg}`);
  if (!ok) failed = true;
};

const RUNS = [
  ['desktop', { width: 1440, height: 900 }, 'light'],
  ['mobile', { width: 390, height: 844 }, 'light'],
  ['desktop-dark', { width: 1440, height: 900 }, 'dark'],
];
for (const [name, viewport, colorScheme] of RUNS) {
  const page = await browser.newPage({ viewport, colorScheme, deviceScaleFactor: name === 'mobile' ? 2 : 1 });
  page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && !/pretendard|ERR_/i.test(m.text()) && errors.push(`${name}: ${m.text()}`));
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${SHOTS}/${name}-hero.png` });

  // Hovering a component preview shows a value tooltip.
  const lineCard = page.locator('#linechart svg').first();
  await lineCard.scrollIntoViewIfNeeded();
  await page.waitForTimeout(900);
  const lb = await lineCard.boundingBox();
  await page.mouse.move(lb.x + lb.width * 0.5, lb.y + lb.height * 0.5);
  await page.waitForTimeout(150);
  // LineChart card: the value sits beside the beacon (beaconLabels).
  check(/원/.test((await page.locator('#linechart svg text[dominant-baseline="central"]').allTextContents()).join(' ')), `${name}: beacon label on LineChart card`);
  // AreaChart card: a value tooltip box.
  const areaSvg = page.locator('#areachart svg').first();
  await areaSvg.scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);
  const ab = await areaSvg.boundingBox();
  await page.mouse.move(ab.x + ab.width * 0.5, ab.y + ab.height * 0.5);
  await page.waitForTimeout(150);
  check((await page.locator('#areachart svg rect[rx="8"]').count()) === 1, `${name}: hover tooltip on AreaChart card`);
  await page.mouse.move(0, 0);

  const html = await page.content();
  check(!html.includes('투자 권유') && !html.includes('Apache-2.0</span>') && !html.includes('만들고 싶은 화면'), `${name}: removed copy stays removed`);
  check((await page.locator('.comp-card').count()) === 13, `${name}: component catalogue (${await page.locator('.comp-card').count()} cards)`);

  // Symbol logos must actually load (they are the "signboard" of each row).
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 700) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 40));
    }
  });
  await page.waitForTimeout(500);
  const brokenLogos = await page.$$eval('img.symbol-logo', (imgs) => imgs.filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.src));
  check(brokenLogos.length === 0, `${name}: symbol logos load ${brokenLogos.join(', ')}`);

  // Live widget: tilted until in view, then flat; follows the OS theme.
  const product = page.locator('#trading');
  await product.scrollIntoViewIfNeeded();
  await page.locator('.product-frame').scrollIntoViewIfNeeded();
  await page.waitForSelector('.product-frame canvas', { timeout: 15000 });
  await page.waitForTimeout(1600);
  check(await page.locator('.fnc-attribution').count() === 1, `${name}: attribution badge in widget`);
  const scheme = await page.locator('.fnc-root').getAttribute('data-color-scheme');
  // The hero is always dark, so its widget is pinned to dark.
  check(scheme === 'dark', `${name}: hero widget color scheme = ${scheme}`);
  const legendLogo = await page.locator('.fnc-legend-title .fnc-avatar').count();
  check(legendLogo === 1, `${name}: symbol logo in chart legend`);
  await page.locator('.product-frame').screenshot({ path: `${SHOTS}/${name}-product.png` });

  // Symbol search closes with Escape even after clicking empty space inside it.
  if (name !== 'mobile') {
    await page.locator('.fnc-symbol').first().click();
    await page.waitForTimeout(200);
    const dlg = page.locator('.fnc-search-dialog');
    if (await dlg.count()) {
      const box = await dlg.boundingBox();
      await page.mouse.click(box.x + box.width - 16, box.y + box.height - 8);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(150);
      check((await dlg.count()) === 0, `${name}: Escape closes symbol search`);
    } else check(false, `${name}: symbol search opens`);
  }

  // Scrub the price card and expect the header to follow.
  const svg = page.locator('#scrubber svg').first();
  await svg.scrollIntoViewIfNeeded();
  await page.waitForTimeout(900);
  const before = await page.locator('#scrubber .price-value').textContent();
  const box = await svg.boundingBox();
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height / 2);
  await page.waitForTimeout(150);
  const during = await page.locator('#scrubber .price-value').textContent();
  check(before !== during, `${name}: scrubbing updates price header (${before} → ${during})`);
  await page.mouse.move(0, 0);
  await page.getByRole('tab', { name: '1주' }).click();
  await page.waitForTimeout(100);
  check(await page.getByRole('tab', { name: '1주' }).getAttribute('aria-selected') === 'true', `${name}: period selector`);

  // Reveal everything for the full-page shot.
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 600) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 60));
    }
  });
  await page.waitForTimeout(900);
  check(!/monospace|Consolas|Courier/i.test(await page.evaluate(() => [...document.querySelectorAll('body *')].map((e) => getComputedStyle(e).fontFamily).join('|'))), `${name}: no monospace fonts`);
  await page.screenshot({ path: `${SHOTS}/${name}-full.png`, fullPage: true });
  await page.close();
}

// ── Landing-only toggles in the widget's toolbarEnd slot ──
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', (e) => errors.push(`toggles: ${e.message}`));
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForSelector('.fnc-root canvas');
  const root = page.locator('.fnc-root');
  const buttons = page.locator('.fnc-slot-toolbar-end button');
  check((await buttons.count()) === 2, 'toggles: two buttons next to the gear');
  await buttons.nth(0).click();
  await page.waitForTimeout(200);
  check((await root.getAttribute('data-color-scheme')) === 'light', 'toggles: light/dark switches the chart');
  const before = await root.evaluate((e) => e.style.getPropertyValue('--fnc-up'));
  await buttons.nth(1).click();
  await page.waitForTimeout(200);
  const after = await root.evaluate((e) => e.style.getPropertyValue('--fnc-up'));
  check(before !== after, `toggles: candle colors switch (${before} → ${after})`);
  await page.locator('.product-frame').screenshot({ path: `${SHOTS}/toggles.png` });
  await page.close();
}

// ── English landing ──
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', (e) => errors.push(`en: ${e.message}`));
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.locator('.lang-switch a', { hasText: 'EN' }).click();
  await page.waitForURL(/\/en\/$/);
  await page.waitForSelector('.fnc-root canvas');
  await page.waitForTimeout(800);
  check((await page.getAttribute('html', 'lang')) === 'en', 'en: html lang="en"');
  check(/Welcome to our nest/.test(await page.locator('.hero h1').textContent()), 'en: English hero copy');
  check(!/[가-힣]/.test(await page.locator('#components').innerText()), 'en: component cards have no Korean text');
  const legend = await page.locator('.fnc-legend-title b').first().textContent();
  check(/Apple/i.test(legend ?? ''), `en: hero chart shows a US stock (${legend})`);
  check(/Light mode/.test((await page.locator('.fnc-slot-toolbar-end button').first().getAttribute('title')) ?? ''), 'en: toggle labels in English');
  check(/og\/default-en\.png/.test(await page.content()), 'en: English OG image');
  await page.screenshot({ path: `${SHOTS}/en-hero.png` });
  await page.locator('.lang-switch a', { hasText: 'KO' }).click();
  await page.waitForURL((u) => !u.pathname.includes('/en/'));
  check((await page.getAttribute('html', 'lang')) === 'ko', 'en: KO switch returns to Korean');
  await page.close();
}

// ── Docs ──
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', (e) => errors.push(`docs: ${e.message}`));
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.locator('.docs-btn').click();
  await page.waitForURL(/\/docs\/$/);
  check((await page.locator('.doc-header h1').textContent()) === '소개와 설치', 'docs: 문서 button opens the docs');
  const links = await page.locator('.docs-sidebar a').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
  check(links.length === 18, `docs: sidebar has ${links.length} pages`);
  for (const href of links) {
    await page.goto(new URL(href, url).href, { waitUntil: 'networkidle' });
    const title = await page.locator('.doc-header h1').textContent();
    const active = await page.locator('.docs-sidebar a.is-active').count();
    const isComponent = href.includes('/components/');
    const demoOk = !isComponent || (await page.locator('.demo svg, .demo [role="img"]').count()) > 0;
    check(!!title && active === 1 && demoOk, `docs: ${href} (${title})`);
  }
  await page.goto(new URL(`${BASE}/docs/components/line-chart/`, url).href, { waitUntil: 'networkidle' });
  await page.screenshot({ path: `${SHOTS}/docs-line-chart.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: `${SHOTS}/docs-mobile.png` });
  await page.close();
}

check(errors.length === 0, `no page errors${errors.length ? `: ${errors.join(' | ')}` : ''}`);
await browser.close();
server.close();
process.exit(failed ? 1 : 0);
