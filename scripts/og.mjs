// Social images: Open Graph cards for the site and every docs page, the GitHub social
// preview and the Apple touch icon. Run `pnpm og` after changing page titles.
//   apps/site/public/og/*.png      1200×630, linked from page metadata
//   brand/github-social.png        1280×640, upload in GitHub → Settings → Social preview
//   apps/site/app/apple-icon.png   180×180
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const { Resvg } = createRequire(join(ROOT, 'packages/cli/package.json'))('@resvg/resvg-js');

// ── Fonts (Pretendard, OFL) cached outside git ──────────────────────────
const FONT_DIR = join(ROOT, '.cache/fonts');
const WEIGHTS = ['Medium', 'SemiBold', 'Bold', 'ExtraBold'];
async function fonts() {
  await mkdir(FONT_DIR, { recursive: true });
  const files = [];
  for (const w of WEIGHTS) {
    const file = join(FONT_DIR, `Pretendard-${w}.otf`);
    const ok = await stat(file).then(() => true, () => false);
    if (!ok) {
      const res = await fetch(`https://cdn.jsdelivr.net/npm/pretendard@1.3.9/dist/public/static/Pretendard-${w}.otf`);
      if (!res.ok) throw new Error(`font ${w}: HTTP ${res.status}`);
      await writeFile(file, new Uint8Array(await res.arrayBuffer()));
    }
    files.push(file);
  }
  return files;
}

// ── Drawing helpers ─────────────────────────────────────────────────────
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// Rough Pretendard advance widths (resvg can't measure text for us).
const textWidth = (t, size) => [...t].reduce((w, ch) => w + size * (ch.charCodeAt(0) > 0x2e80 ? 0.93 : ch === ' ' ? 0.26 : /[A-Z]/.test(ch) ? 0.64 : /[·.,]/.test(ch) ? 0.3 : 0.54), 0);

/** Split text into lines that fit `max` px (breaks on spaces; CJK-friendly). */
function wrap(text, size, max) {
  const lines = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const word of para.split(' ')) {
      const next = line ? `${line} ${word}` : word;
      if (textWidth(next, size) > max && line) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    lines.push(line);
  }
  return lines;
}

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MARK = (x, y, s) => `
  <g transform="translate(${x} ${y}) scale(${s / 32})">
    <rect width="32" height="32" rx="9" fill="url(#mark)"/>
    <path d="M7 13.5C9.5 21.5 17 23.5 23.4 11.2" stroke="#fff" stroke-width="3.2" stroke-linecap="round" fill="none"/>
    <circle cx="24.6" cy="8.6" r="2.9" fill="#FFD43B"/>
  </g>`;

/**
 * Neon ribbon: one price path drawn many times, each copy offset and fainter, so it reads as
 * a glowing band of lines flowing off the right edge (the TradingView "Supercharts" mood).
 * Ends on the brand's yellow peak dot.
 */
function ribbon(width, height, { seed = 11, x0, opacity = 1 }) {
  const r = rng(seed);
  const n = 46;
  const pts = [];
  let v = 0;
  for (let i = 0; i < n; i++) {
    // Rising with ordinary pullbacks; the last point is the high (the brand's peak dot).
    v += (r() - 0.3) * 1.15;
    pts.push(v);
  }
  pts[n - 1] = Math.max(...pts) + 0.9;
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const top = height * 0.14;
  const bottom = height * 0.92;
  const span = width * 0.9 - x0; // ends on the peak dot near the right edge
  const px = (i) => x0 + (i / (n - 1)) * span;
  const py = (val) => bottom - ((val - min) / (max - min)) * (bottom - top);
  const path = (dx, dy, k) =>
    pts.map((val, i) => `${i ? 'L' : 'M'}${(px(i) + dx).toFixed(1)},${(py(val) * k + dy).toFixed(1)}`).join('');

  const layers = 16;
  let out = '';
  for (let l = layers - 1; l >= 0; l--) {
    const t = l / (layers - 1);
    // Copies fan out down-left and flatten slightly, fading with depth.
    const d = path(-t * 120, t * 190, 1 - t * 0.1);
    const op = (l === 0 ? 1 : 0.5 * (1 - t) + 0.08) * opacity;
    out += `<path d="${d}" fill="none" stroke="url(#ribbon)" stroke-width="${l === 0 ? 4 : 1.6}" stroke-linejoin="round" stroke-opacity="${op.toFixed(3)}"${l === 0 ? ' filter="url(#glow)"' : ''}/>`;
  }
  // Peak dot at the end of the front line.
  const cx = px(n - 1);
  const cy = py(pts[n - 1]);
  out += `<circle cx="${cx}" cy="${cy}" r="26" fill="#FFD43B" opacity="${0.22 * opacity}" filter="url(#blur)"/>`;
  out += `<circle cx="${cx}" cy="${cy}" r="10" fill="#FFD43B" opacity="${opacity}"/>`;
  return out;
}

/** Faint perspective floor grid under the ribbon. */
function grid(width, height, x0) {
  let g = '';
  for (let i = 0; i < 9; i++) {
    const y = height * 0.2 + i * (height * 0.1);
    g += `<line x1="${x0 - 120}" x2="${width}" y1="${y + i * 6}" y2="${y - 40}" stroke="#8B6CFF" stroke-opacity="${0.05 + i * 0.006}"/>`;
  }
  for (let i = 0; i < 9; i++) {
    const x = x0 - 40 + i * ((width - x0 + 40) / 8);
    g += `<line x1="${x}" x2="${x + 120}" y1="0" y2="${height}" stroke="#8B6CFF" stroke-opacity="0.05"/>`;
  }
  return g;
}

/** One social card: black, huge type on the left, glowing chart ribbon on the right. */
function card({ width = 1200, height = 630, category, title, subtitle, hero = false }) {
  const left = 80;
  const textMax = hero ? 640 : 600;
  const written = title.split(/\n/);
  let titleSize = hero ? 112 : 92;
  while (titleSize > 52 && written.some((l) => textWidth(l, titleSize) > textMax)) titleSize -= 2;
  const titleLines = wrap(title, titleSize, textMax);
  const subSize = hero ? 38 : 32;
  const subLines = subtitle ? wrap(subtitle, subSize, textMax).slice(0, 2) : [];

  const brandH = 64;
  const blockH = brandH + (category ? 52 : 0) + titleLines.length * titleSize * 1.08 + (subLines.length ? 18 + subLines.length * subSize * 1.35 : 0);
  let y = (height - blockH) / 2;
  let body = '';
  // Brand line above the title; the hero card shows the mark alone (its title is the name).
  body += MARK(left, y, hero ? 64 : 48);
  if (!hero) body += `<text x="${left + 62}" y="${y + 36}" font-size="34" font-weight="800" fill="#ffffff" letter-spacing="-1">funnest<tspan dx="10" font-weight="600" fill="#9a9aa5" letter-spacing="-0.5">charts</tspan></text>`;
  y += hero ? brandH + 24 : brandH;
  if (category) {
    body += `<text x="${left}" y="${y + 30}" font-size="26" font-weight="700" fill="#B9A8FF">${esc(category)}</text>`;
    y += 52;
  }
  titleLines.forEach((l) => {
    y += titleSize * 1.08;
    body += `<text x="${left - 4}" y="${y - titleSize * 0.18}" font-size="${titleSize}" font-weight="800" fill="#ffffff" letter-spacing="${-titleSize * 0.03}">${esc(l)}</text>`;
  });
  if (subLines.length) y += 18;
  subLines.forEach((l) => {
    y += subSize * 1.35;
    body += `<text x="${left}" y="${y - subSize * 0.3}" font-size="${subSize}" font-weight="600" fill="#ffffff" fill-opacity="0.82">${esc(l)}</text>`;
  });

  const x0 = width * (hero ? 0.5 : 0.56);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="Pretendard">
  <defs>
    <linearGradient id="mark" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse"><stop stop-color="#8B6CFF"/><stop offset="1" stop-color="#5A3BF0"/></linearGradient>
    <linearGradient id="ribbon" x1="${x0}" y1="0" x2="${width}" y2="0" gradientUnits="userSpaceOnUse">
      <stop stop-color="#5A3BF0"/><stop offset="0.45" stop-color="#8B6CFF"/><stop offset="0.8" stop-color="#FF4FB8"/><stop offset="1" stop-color="#FFB347"/>
    </linearGradient>
    <radialGradient id="haze" cx="0.78" cy="0.35" r="0.55"><stop stop-color="#6C4DFF" stop-opacity="0.38"/><stop offset="1" stop-color="#6C4DFF" stop-opacity="0"/></radialGradient>
    <linearGradient id="fade" x1="0" y1="0" x2="1" y2="0"><stop offset="0.3" stop-color="#000" stop-opacity="1"/><stop offset="0.62" stop-color="#000" stop-opacity="0"/></linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <filter id="blur"><feGaussianBlur stdDeviation="10"/></filter>
  </defs>
  <rect width="${width}" height="${height}" fill="#000"/>
  <rect width="${width}" height="${height}" fill="url(#haze)"/>
  ${grid(width, height, x0)}
  ${ribbon(width, height, { x0, opacity: hero ? 1 : 0.85 })}
  <rect width="${width}" height="${height}" fill="url(#fade)"/>
  ${body}
</svg>`;
}

// ── Pages ───────────────────────────────────────────────────────────────
async function pages() {
  const list = [
    { slug: 'default', hero: true, title: 'Funnest Charts', subtitle: '투자 서비스를 위한 차트' },
    { slug: 'docs', category: '문서', title: '소개와 설치', subtitle: 'npm i @funnest/charts-react 한 줄로 시작해요' },
    { slug: 'docs-trading-chart', category: '문서', title: '트레이딩 차트', subtitle: '툴바, 심볼 검색, 지표, 그리기 도구까지 컴포넌트 하나로' },
    { slug: 'docs-datafeed', category: '문서', title: '데이터 연결', subtitle: 'Datafeed 하나로 어떤 거래소·증권사 데이터든' },
    { slug: 'docs-theming', category: '문서', title: '테마', subtitle: '라이트 · 다크, 상승 · 하락 색, 내 서비스 디자인' },
    { slug: 'docs-ai', category: '문서', title: 'AI · CLI · MCP', subtitle: '차트 스펙 검사와 렌더, React 코드 생성, AI 도구 연결' },
  ];
  // Component pages come straight from the docs data (slug, name, group, summary).
  const src = await readFile(join(ROOT, 'apps/site/lib/component-docs.tsx'), 'utf8');
  const re = /slug: '([^']+)',\s*name: '([^']+)',\s*group: '([^']+)',\s*summary: '([^']+)'/g;
  for (const m of src.matchAll(re)) list.push({ slug: `docs-components-${m[1]}`, category: m[3], title: m[2], subtitle: m[4] });
  return list;
}

const fontFiles = await fonts();
const render = (svg, width) =>
  new Resvg(svg, { fitTo: { mode: 'width', value: width }, font: { fontFiles, loadSystemFonts: false, defaultFontFamily: 'Pretendard' } }).render().asPng();

const OUT = join(ROOT, 'apps/site/public/og');
await mkdir(OUT, { recursive: true });
const list = await pages();
for (const p of list) await writeFile(join(OUT, `${p.slug}.png`), render(card(p), 1200));
await writeFile(join(ROOT, 'brand/github-social.png'), render(card({ ...list[0], width: 1280, height: 640 }), 1280));

const icon = `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180" viewBox="0 0 32 32"><defs><linearGradient id="mark" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse"><stop stop-color="#8B6CFF"/><stop offset="1" stop-color="#5A3BF0"/></linearGradient></defs><rect width="32" height="32" fill="url(#mark)"/><g transform="translate(16 16) scale(0.8) translate(-17.2 -13.4)"><path d="M7 13.5C9.5 21.5 17 23.5 23.4 11.2" stroke="#fff" stroke-width="3.2" stroke-linecap="round" fill="none"/><circle cx="24.6" cy="8.6" r="2.9" fill="#FFD43B"/></g></svg>`;
await writeFile(join(ROOT, 'apps/site/app/apple-icon.png'), render(icon, 180));
console.log(`og: ${list.length} cards, github-social.png, apple-icon.png`);
