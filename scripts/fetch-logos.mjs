// Downloads the demo symbol logos used by apps/site and apps/playground.
// They are other companies' trademarks, so they are NOT committed to this repository
// (see .gitignore); the demos fetch them at dev/build time. A missing logo is fine —
// the widget falls back to an initial avatar.
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TARGETS = ['apps/site/public/logos', 'apps/playground/public/logos'];

const toss = (code) => `https://static.toss.im/png-icons/securities/icn-sec-fill-${code}.png`;
const upbit = (coin) => `https://static.upbit.com/logos/${coin}.png`;
const LOGOS = {
  '005930.png': toss('005930'),
  '000660.png': toss('000660'),
  '035420.png': toss('035420'),
  'BTC.png': upbit('BTC'),
  'ETH.png': upbit('ETH'),
  'SOL.png': upbit('SOL'),
  'XRP.png': upbit('XRP'),
  'AAPL.png': 'https://financialmodelingprep.com/image-stock/AAPL.png',
};

const exists = (p) => stat(p).then(() => true, () => false);
let fetched = 0;
let failed = 0;
for (const [file, url] of Object.entries(LOGOS)) {
  const paths = TARGETS.map((t) => join(ROOT, t, file));
  if ((await Promise.all(paths.map(exists))).every(Boolean)) continue;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = new Uint8Array(await res.arrayBuffer());
    for (const p of paths) {
      await mkdir(dirname(p), { recursive: true });
      await writeFile(p, body);
    }
    fetched++;
  } catch (e) {
    failed++;
    console.warn(`fetch-logos: ${file} skipped (${e.message}) — initial avatar will be shown`);
  }
}
if (fetched || failed) console.log(`fetch-logos: ${fetched} downloaded, ${failed} failed`);
