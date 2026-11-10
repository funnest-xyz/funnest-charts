// Records the README GIFs from the built site (apps/site/out) with Playwright + ffmpeg.
//   pnpm --filter site build && node scripts/readme-media.mjs
// Writes docs/media/trading-chart.gif and docs/media/components.gif.
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, readdir, rename, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, resolve } from 'node:path';
import { chromium } from 'playwright';

const OUT = resolve('apps/site/out');
const MEDIA = resolve('docs/media');
const TMP = resolve('test-results/readme-media');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.txt': 'text/plain' };

const server = createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  try {
    res.writeHead(200, { 'content-type': TYPES[extname(p)] ?? 'application/octet-stream' });
    res.end(await readFile(join(OUT, p)));
  } catch {
    res.writeHead(404).end();
  }
}).listen(0);
const url = `http://localhost:${server.address().port}/`;

await mkdir(MEDIA, { recursive: true });
await rm(TMP, { recursive: true, force: true });
const browser = await chromium.launch();
const SIZE = { width: 1200, height: 720 };

/** Record one scene and convert it to an optimized GIF. */
async function scene(name, run) {
  const dir = join(TMP, name);
  const context = await browser.newContext({ viewport: SIZE, recordVideo: { dir, size: SIZE }, colorScheme: 'light' });
  const page = await context.newPage();
  // run() returns the area to keep (CSS px); the nav bar is hidden for a clean shot.
  page.on('load', () => page.addStyleTag({ content: '.nav{display:none!important}' }).catch(() => {}));
  const clip = await run(page);
  await context.close();
  const [video] = await readdir(dir);
  const webm = join(dir, video);
  const gif = join(MEDIA, `${name}.gif`);
  // Two-pass palette for clean colors; trim the page-load start.
  const c = clip ? `crop=${Math.round(clip.width)}:${Math.round(clip.height)}:${Math.round(clip.x)}:${Math.round(clip.y)},` : '';
  const filters = `${c}fps=12,scale=880:-1:flags=lanczos`;
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', '1.2', '-i', webm, '-vf', `${filters},palettegen=stats_mode=diff`, join(dir, 'palette.png')]);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', '1.2', '-i', webm, '-i', join(dir, 'palette.png'), '-lavfi', `${filters}[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle`, join(dir, 'out.gif')]);
  await rename(join(dir, 'out.gif'), gif);
  console.log(`wrote ${gif}`);
}

const glide = async (page, from, to, steps = 30) => {
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    await page.mouse.move(from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t);
    await page.waitForTimeout(16);
  }
};

// 1) Trading chart: crosshair, interval, light/dark, candle colors.
await scene('trading-chart', async (page) => {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForSelector('.product-frame canvas');
  await page.evaluate(() => document.querySelector('.hero-live')?.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(1600);
  const box = await page.locator('.product-frame').boundingBox();
  const at = (fx, fy) => ({ x: box.x + box.width * fx, y: box.y + box.height * fy });
  await glide(page, at(0.15, 0.55), at(0.78, 0.35), 50);
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: /^1시간/ }).first().click().catch(() => {});
  await page.waitForTimeout(900);
  await glide(page, at(0.7, 0.4), at(0.3, 0.6), 40);
  const toggles = page.locator('.fnc-slot-toolbar-end button');
  await toggles.nth(0).click();
  await page.waitForTimeout(900);
  await toggles.nth(1).click();
  await page.waitForTimeout(900);
  await glide(page, at(0.3, 0.6), at(0.85, 0.45), 40);
  await toggles.nth(0).click();
  await page.waitForTimeout(800);
  return { x: box.x - 8, y: box.y - 8, width: box.width + 16, height: box.height + 16 };
});

// 2) Components: hover a few cards so the scrubber tooltips follow the pointer.
await scene('components', async (page) => {
  await page.goto(url, { waitUntil: 'networkidle' });
  const grid = page.locator('#components .comp-grid').first();
  await grid.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(1600);
  const g = await grid.boundingBox();
  for (const id of ['#linechart', '#areachart', '#barchart']) {
    const b = await page.locator(`${id} svg`).first().boundingBox();
    if (!b) continue;
    await glide(page, { x: b.x + 10, y: b.y + b.height / 2 }, { x: b.x + b.width - 10, y: b.y + b.height / 2 }, 45);
  }
  const pb = await page.locator('#percentagebarchart .comp-preview').boundingBox();
  if (pb) await glide(page, { x: pb.x + 20, y: pb.y + pb.height * 0.3 }, { x: pb.x + pb.width - 20, y: pb.y + pb.height * 0.3 }, 30);
  await page.waitForTimeout(500);
  return { x: g.x - 12, y: Math.max(0, g.y - 12), width: g.width + 24, height: Math.min(SIZE.height - Math.max(0, g.y - 12), g.height + 24) };
});

await browser.close();
server.close();
