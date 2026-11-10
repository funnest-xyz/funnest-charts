import { AreaChart, BarChart, CandlestickChart, DonutChart, LineChart, Point, ReferenceLine, TreemapChart, type ChartSeries } from '@funnest/charts-react';
import { percentages, seriesColor } from '@funnest/charts-viz';
import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ChartSpec, Row } from './spec';

const UP = '#F04452';
const DOWN = '#3182F6';

const FONT = "Pretendard, 'Apple SD Gothic Neo', 'Malgun Gothic', 'Noto Sans KR', sans-serif";

/** Korean-capable fallback per OS, used when Pretendard isn't installed (PNG only). */
const SYSTEM_FONT: Record<string, string> = { win32: 'Malgun Gothic', darwin: 'Apple SD Gothic Neo' };
const defaultFont = () => SYSTEM_FONT[typeof process === 'undefined' ? '' : process.platform] ?? 'Noto Sans CJK KR';

interface Palette {
  bg: string;
  text: string;
  muted: string;
  grid: string;
  line: string;
}

const THEMES: Record<'light' | 'dark', Palette> = {
  light: { bg: '#ffffff', text: '#191f28', muted: '#8b95a1', grid: '#eef0f3', line: '#c5cad1' },
  dark: { bg: '#17171c', text: '#f2f2f4', muted: '#7e7e87', grid: '#26262e', line: '#4a4a55' },
};

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const yColumns = (spec: ChartSpec) => (Array.isArray(spec.y) ? spec.y : spec.y ? [spec.y] : []);

/** "2026-11-03" → "11/3" (shorter axis labels); other values as-is. */
const xLabel = (v: unknown) => {
  const s = String(v ?? '');
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  return m ? `${Number(m[2])}/${Number(m[3])}` : s;
};

export function valueFormatter(spec: ChartSpec) {
  const f = spec.format ?? {};
  const nf = new Intl.NumberFormat(spec.locale === 'en' ? 'en-US' : 'ko-KR', { maximumFractionDigits: f.decimals ?? 2, minimumFractionDigits: f.decimals ?? 0 });
  return (v: number) => `${f.prefix ?? ''}${nf.format(v)}${f.suffix ?? ''}`;
}

/** Row index for a point/reference given either an index or an x value. */
const indexOf = (spec: ChartSpec, x: number | string) => {
  if (typeof x === 'number') return x;
  const i = spec.x ? spec.data.findIndex((r) => String(r[spec.x!]) === x) : -1;
  return i >= 0 ? i : Number(x);
};

function seriesOf(spec: ChartSpec): (ChartSeries & { color: string })[] {
  return yColumns(spec).map((col, i) => ({
    id: col,
    label: spec.labels?.[col] ?? col,
    data: spec.data.map((r) => num(r[col])),
    color: spec.colors?.[col] ?? seriesColor(i),
  }));
}

/** The chart as a React element (same components an app would use). */
function element(spec: ChartSpec, width: number, height: number): ReactElement {
  const series = seriesOf(spec);
  const fmt = valueFormatter(spec);
  const xAxis = spec.x ? { data: spec.data.map((r) => xLabel(r[spec.x!])) } : undefined;
  const common = {
    series,
    width,
    height,
    animate: false,
    ...(xAxis ? { xAxis } : {}),
    showXAxis: spec.showXAxis ?? !!spec.x,
    showYAxis: spec.showYAxis === false ? false : { tickLabelFormatter: fmt, width: 64 },
  };
  const extras = [
    ...(spec.referenceLines ?? []).map((r, i) => (
      <ReferenceLine
        key={`r${i}`}
        {...(r.y !== undefined ? { dataY: r.y } : {})}
        {...(r.x !== undefined ? { dataX: indexOf(spec, r.x) } : {})}
        {...(r.label !== undefined ? { label: r.label } : {})}
        {...(r.color ? { color: r.color } : {})}
      />
    )),
    ...(spec.points ?? []).map((p, i) => (
      <Point
        key={`p${i}`}
        dataX={indexOf(spec, p.x)}
        {...(p.y !== undefined ? { dataY: p.y } : { seriesId: p.series ?? series[0]?.id ?? '' })}
        {...(p.label !== undefined ? { label: p.label } : {})}
        {...(p.color ? { color: p.color } : {})}
        {...(p.pulse ? { pulse: true } : {})}
      />
    )),
  ];

  switch (spec.type) {
    case 'candlestick': {
      const candles = spec.data.map((r) => {
        const o = num(r[spec.open!]);
        const h = num(r[spec.high!]);
        const l = num(r[spec.low!]);
        const c = num(r[spec.close!]);
        if (o === null || h === null || l === null || c === null) return null;
        const v = spec.volume ? num(r[spec.volume]) : null;
        return { open: o, high: h, low: l, close: c, ...(v !== null ? { volume: v } : {}) };
      });
      return (
        <CandlestickChart
          data={candles}
          width={width}
          height={height}
          animate={false}
          tooltip={false}
          valueFormatter={fmt}
          {...(xAxis ? { xAxis } : {})}
          showXAxis={spec.showXAxis ?? !!spec.x}
          showYAxis={spec.showYAxis === false ? false : { tickLabelFormatter: fmt, width: 64 }}
        >
          {(spec.referenceLines ?? []).map((r, i) => (
            <ReferenceLine
              key={`r${i}`}
              yAxisId="price"
              {...(r.y !== undefined ? { dataY: r.y } : {})}
              {...(r.x !== undefined ? { dataX: indexOf(spec, r.x) } : {})}
              {...(r.label !== undefined ? { label: r.label } : {})}
              {...(r.color ? { color: r.color } : {})}
            />
          ))}
        </CandlestickChart>
      );
    }
    case 'treemap':
      return (
        <TreemapChart
          width={width}
          height={height}
          enableTooltip={false}
          valueFormatter={fmt}
          {...(spec.maxChange !== undefined ? { maxChange: spec.maxChange } : {})}
          data={spec.data.map((r, i) => {
            const label = String(r[spec.label!] ?? i);
            const change = spec.change ? num(r[spec.change]) : null;
            const color = spec.colors?.[label];
            return { id: `${i}`, label, value: num(r[spec.value!]) ?? 0, ...(change !== null ? { change } : {}), ...(color ? { color } : {}) };
          })}
        />
      );
    case 'area':
      return <AreaChart {...common} stacked={spec.stacked ?? false} {...(spec.curve ? { curve: spec.curve } : {})}>{extras}</AreaChart>;
    case 'bar':
      return (
        <BarChart {...common} stacked={spec.stacked ?? false} {...(spec.layout === 'horizontal' ? { layout: 'horizontal' as const } : {})} {...(spec.colorBySign ? { getBarColor: (v: number) => (v >= 0 ? UP : DOWN) } : {})}>
          {extras}
        </BarChart>
      );
    case 'sparkline': {
      const s = series[0];
      const vals = (s?.data ?? []).filter((v): v is number => v !== null);
      const up = (vals.at(-1) ?? 0) >= (vals[0] ?? 0);
      const color = spec.colorBySign === false ? (s?.color ?? UP) : up ? UP : DOWN;
      return <LineChart series={s ? [{ ...s, color }] : []} width={width} height={height} inset={2} strokeWidth={1.5} animate={false} />;
    }
    default:
      return (
        <LineChart {...common} {...(spec.curve ? { curve: spec.curve } : {})} {...(spec.area ? { area: spec.area } : {})}>
          {extras}
        </LineChart>
      );
  }
}

/** Replace `var(--fnv-name, fallback)` (with nested parentheses) by concrete colors. */
function resolveVars(markup: string, map: Record<string, string>): string {
  let out = '';
  let i = 0;
  while (i < markup.length) {
    const at = markup.indexOf('var(--fnv-', i);
    if (at < 0) {
      out += markup.slice(i);
      break;
    }
    out += markup.slice(i, at);
    let depth = 0;
    let j = at;
    for (; j < markup.length; j++) {
      if (markup[j] === '(') depth++;
      else if (markup[j] === ')' && --depth === 0) break;
    }
    const name = /^var\(--fnv-([a-z-]+)/.exec(markup.slice(at))?.[1] ?? '';
    out += map[name] ?? 'currentColor';
    i = j + 1;
  }
  return out;
}

const percentBarSvg = (spec: ChartSpec, width: number, top: number, p: Palette) => {
  const rows = spec.data;
  const items = rows.map((r, i) => ({
    id: String(r[spec.label!] ?? i),
    value: num(r[spec.value!]) ?? 0,
  }));
  const segs = percentages(items);
  const barH = 14;
  const gap = 2;
  const visible = segs.filter((s) => s.fraction > 0);
  const usable = width - gap * Math.max(0, visible.length - 1);
  let x = 0;
  const bars = visible
    .map((s) => {
      const w = Math.max(2, s.fraction * usable);
      const color = spec.colors?.[s.id] ?? seriesColor(items.findIndex((it) => it.id === s.id));
      const rect = `<rect x="${x.toFixed(1)}" y="${top}" width="${w.toFixed(1)}" height="${barH}" rx="3" fill="${color}"/>`;
      x += w + gap;
      return rect;
    })
    .join('');
  // Labels flow left to right and wrap.
  let lx = 0;
  let ly = top + barH + 24;
  const labels = segs
    .map((s, i) => {
      const color = spec.colors?.[s.id] ?? seriesColor(i);
      const text = `${s.id} ${(Math.round(s.fraction * 1000) / 10).toString()}%`;
      const w = textWidth(text, 12) + 26;
      if (lx > 0 && lx + w > width) {
        lx = 0;
        ly += 20;
      }
      const g = `<circle cx="${lx + 4}" cy="${ly - 4}" r="4" fill="${color}"/><text x="${lx + 13}" y="${ly}" font-size="12" fill="${p.muted}">${esc(s.id)} <tspan fill="${p.text}" font-weight="700">${(Math.round(s.fraction * 1000) / 10).toString()}%</tspan></text>`;
      lx += w;
      return g;
    })
    .join('');
  return bars + labels;
};

const textWidth = (t: string, size: number) => [...t].reduce((w, ch) => w + (ch.charCodeAt(0) > 0x2e80 ? size : size * 0.6), 0);

export interface RenderOptions {
  theme?: 'light' | 'dark';
}

/** Donut on the left, labels with shares on the right (all SVG, no HTML legend). */
const donutSvg = (spec: ChartSpec, width: number, height: number, p: Palette) => {
  const fmt = valueFormatter(spec);
  const items = spec.data.map((r, i) => {
    const label = String(r[spec.label!] ?? i);
    return { id: `${i}`, label, value: num(r[spec.value!]) ?? 0, color: spec.colors?.[label] ?? seriesColor(i) };
  });
  const size = Math.max(60, Math.min(height, width * 0.5));
  const markup = renderToStaticMarkup(
    <DonutChart
      data={items}
      size={size}
      showLegend={false}
      valueFormatter={fmt}
      {...(spec.totalLabel ? { totalLabel: spec.totalLabel } : {})}
      {...(spec.innerRadius !== undefined ? { innerRadius: spec.innerRadius } : {})}
    />,
  );
  const svg = markup.slice(markup.indexOf('<svg'), markup.indexOf('</svg>') + 6).replace('<svg', `<svg x="0" y="${(height - size) / 2}"`);
  const segs = percentages(items);
  const lx = size + 28;
  const rowH = 24;
  const top = height / 2 - (items.length * rowH) / 2 + rowH / 2;
  const labels = items
    .map((it, i) => {
      const y = top + i * rowH;
      const pct = `${(Math.round(segs[i]!.fraction * 1000) / 10).toString()}%`;
      return `<circle cx="${lx + 4}" cy="${y}" r="4" fill="${it.color}"/><text x="${lx + 14}" y="${y}" dominant-baseline="central" font-size="13" fill="${p.muted}">${esc(it.label)} <tspan fill="${p.text}" font-weight="700">${pct}</tspan> <tspan fill="${p.muted}">${esc(fmt(it.value))}</tspan></text>`;
    })
    .join('');
  return svg + labels;
};

/** Render a (validated) spec to a standalone SVG document. */
export function renderSvg(spec: ChartSpec, options: RenderOptions = {}): string {
  const theme = THEMES[options.theme ?? spec.theme ?? 'light'];
  const isSpark = spec.type === 'sparkline';
  const width = spec.width ?? (isSpark ? 120 : 640);
  const height = spec.height ?? (isSpark ? 36 : spec.type === 'percentage-bar' ? 96 : spec.type === 'donut' ? 220 : 320);
  const pad = isSpark ? 0 : 16;
  const innerW = width - pad * 2;
  let y = pad;
  let head = '';

  if (spec.title && !isSpark) {
    head += `<text x="${pad}" y="${y + 16}" font-size="16" font-weight="700" fill="${theme.text}">${esc(spec.title)}</text>`;
    y += 30;
  }

  let body: string;
  if (spec.type === 'percentage-bar') {
    body = percentBarSvg(spec, innerW, 0, theme);
    body = `<g transform="translate(${pad},${y})">${body}</g>`;
  } else if (spec.type === 'donut') {
    body = `<g transform="translate(${pad},${y})">${donutSvg(spec, innerW, Math.max(60, height - y - pad), theme)}</g>`;
  } else {
    const series = seriesOf(spec);
    const legend = !isSpark && (spec.legend ?? series.length > 1);
    if (legend) {
      let lx = pad;
      head += series
        .map((s) => {
          const label = s.label ?? s.id;
          const g = `<rect x="${lx}" y="${y + 3}" width="12" height="3" rx="1.5" fill="${s.color}"/><text x="${lx + 18}" y="${y + 8}" font-size="12" fill="${theme.muted}">${esc(label)}</text>`;
          lx += textWidth(label, 12) + 34;
          return g;
        })
        .join('');
      y += 22;
    }
    const chartH = Math.max(20, height - y - pad);
    const markup = renderToStaticMarkup(element(spec, innerW, chartH));
    const svg = markup.slice(markup.indexOf('<svg'), markup.lastIndexOf('</svg>') + 6);
    body = svg.replace('<svg', `<svg x="${pad}" y="${y}"`);
  }

  const doc =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="${FONT}">` +
    `<rect width="100%" height="100%" fill="${theme.bg}"/>${head}${body}</svg>`;
  return resolveVars(doc, {
    text: theme.text,
    'text-muted': theme.muted,
    grid: theme.grid,
    line: theme.line,
    bg: theme.bg,
    accent: '#6C4DFF',
    font: FONT,
  }).replace(/font-family:inherit/g, `font-family:${FONT}`);
}

export function renderHtml(spec: ChartSpec, options: RenderOptions = {}): string {
  const theme = THEMES[options.theme ?? spec.theme ?? 'light'];
  return `<!doctype html>
<html lang="${spec.locale ?? 'ko'}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(spec.title ?? 'Funnest Charts')}</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:${theme.bg}}svg{max-width:100%;height:auto}</style>
</head>
<body>
${renderSvg(spec, options)}
</body>
</html>
`;
}

/** PNG via resvg (optional dependency, loaded on demand). */
export async function renderPng(spec: ChartSpec, options: RenderOptions & { scale?: number } = {}): Promise<Uint8Array> {
  let Resvg: typeof import('@resvg/resvg-js').Resvg;
  try {
    ({ Resvg } = await import('@resvg/resvg-js'));
  } catch {
    throw Object.assign(new Error('PNG_RENDERER_MISSING'), { code: 'PNG_RENDERER_MISSING' });
  }
  const svg = renderSvg(spec, options);
  const r = new Resvg(svg, {
    fitTo: { mode: 'zoom', value: options.scale ?? 2 },
    font: { loadSystemFonts: true, defaultFontFamily: defaultFont() },
  });
  return r.render().asPng();
}

// ── React code for the same chart ────────────────────────────────────────

const lit = (v: unknown) => JSON.stringify(v);

export function reactCode(spec: ChartSpec): string {
  const ys = yColumns(spec);
  const dataLine =
    spec.data.length <= 40 ? `const data = ${JSON.stringify(spec.data, null, 2)};` : `// data: ${spec.data.length}행 — 내 데이터로 바꿔주세요\nconst data = [/* … */];`;
  const fmt = spec.format ? `const fmt = (v: number) => \`${spec.format.prefix ?? ''}\${v.toLocaleString()}${spec.format.suffix ?? ''}\`;\n` : '';

  if (spec.type === 'percentage-bar') {
    return `import { PercentageBarChart } from '@funnest/charts-react';

${dataLine}

export function Chart() {
  return (
    <PercentageBarChart
      data={data.map((d) => ({ id: String(d[${lit(spec.label)}]), label: String(d[${lit(spec.label)}]), value: d[${lit(spec.value)}]${spec.colors ? `, color: (${lit(spec.colors)} as Record<string, string>)[String(d[${lit(spec.label)}])]` : ''} }))}
    />
  );
}
`;
  }

  if (spec.type === 'candlestick') {
    const vol = spec.volume ? `, volume: d[${lit(spec.volume)}]` : '';
    return `import { CandlestickChart${spec.referenceLines?.length ? ', ReferenceLine' : ''} } from '@funnest/charts-react';

${dataLine}
${fmt}
export function Chart() {
  return (
    <CandlestickChart
      data={data.map((d) => ({ open: d[${lit(spec.open)}], high: d[${lit(spec.high)}], low: d[${lit(spec.low)}], close: d[${lit(spec.close)}]${vol} }))}
      height={${spec.height ?? 320}}${spec.x ? `
      xAxis={{ data: data.map((d) => d[${lit(spec.x)}]) }}` : ''}${fmt ? '\n      valueFormatter={fmt}' : ''}
    >${(spec.referenceLines ?? []).map((r) => `
      <ReferenceLine yAxisId="price"${r.y !== undefined ? ` dataY={${r.y}}` : ''}${r.label ? ` label=${lit(r.label)}` : ''} />`).join('')}
    </CandlestickChart>
  );
}
`;
  }
  if (spec.type === 'donut') {
    return `import { DonutChart } from '@funnest/charts-react';

${dataLine}
${fmt}
export function Chart() {
  return (
    <DonutChart
      data={data.map((d) => ({ id: String(d[${lit(spec.label)}]), label: String(d[${lit(spec.label)}]), value: d[${lit(spec.value)}]${spec.colors ? `, color: (${lit(spec.colors)} as Record<string, string>)[String(d[${lit(spec.label)}])]` : ''} }))}${spec.totalLabel ? `
      totalLabel=${lit(spec.totalLabel)}` : ''}${spec.innerRadius !== undefined ? `
      innerRadius={${spec.innerRadius}}` : ''}${fmt ? '\n      valueFormatter={fmt}' : ''}
    />
  );
}
`;
  }
  if (spec.type === 'treemap') {
    return `import { TreemapChart } from '@funnest/charts-react';

${dataLine}
${fmt}
export function Chart() {
  return (
    <TreemapChart
      height={${spec.height ?? 320}}
      data={data.map((d, i) => ({ id: String(i), label: String(d[${lit(spec.label)}]), value: d[${lit(spec.value)}]${spec.change ? `, change: d[${lit(spec.change)}]` : ''} }))}${spec.maxChange !== undefined ? `
      maxChange={${spec.maxChange}}` : ''}${fmt ? '\n      valueFormatter={fmt}' : ''}
    />
  );
}
`;
  }

  const component = spec.type === 'area' ? 'AreaChart' : spec.type === 'bar' ? 'BarChart' : 'LineChart';
  const imports = new Set([component]);
  if (spec.referenceLines?.length) imports.add('ReferenceLine');
  if (spec.points?.length) imports.add('Point');
  const series = ys
    .map((c) => `{ id: ${lit(c)}, label: ${lit(spec.labels?.[c] ?? c)}, data: data.map((d) => d[${lit(c)}])${spec.colors?.[c] ? `, color: ${lit(spec.colors[c])}` : ''} }`)
    .join(',\n        ');
  const props: string[] = [`series={[\n        ${series},\n      ]}`];
  if (spec.type === 'sparkline') props.push('height={32}', 'inset={2}', 'strokeWidth={1.5}');
  else {
    props.push(`height={${spec.height ?? 320}}`);
    if (spec.x) props.push(`xAxis={{ data: data.map((d) => d[${lit(spec.x)}]) }}`);
    if (spec.showXAxis ?? !!spec.x) props.push('showXAxis');
    if (spec.showYAxis !== false) props.push(fmt ? 'showYAxis={{ tickLabelFormatter: fmt }}' : 'showYAxis');
    props.push(fmt ? 'scrubber={{ showValues: true, valueFormatter: fmt }}' : 'scrubber={{ showValues: true }}');
  }
  if (spec.stacked) props.push('stacked');
  if (spec.area && spec.area !== 'none') props.push(`area=${lit(spec.area)}`);
  if (spec.curve) props.push(`curve=${lit(spec.curve)}`);
  if (spec.type === 'bar' && spec.layout === 'horizontal') props.push('layout="horizontal"');
  if (spec.type === 'bar' && spec.colorBySign) props.push("getBarColor={(v) => (v >= 0 ? '#F04452' : '#3182F6')}");
  if (ys.length > 1 || spec.legend) props.push('legend');

  const children = [
    ...(spec.referenceLines ?? []).map(
      (r) =>
        `<ReferenceLine${r.y !== undefined ? ` dataY={${r.y}}` : ''}${r.x !== undefined ? ` dataX={${typeof r.x === 'number' ? r.x : `data.findIndex((d) => d[${lit(spec.x)}] === ${lit(r.x)})`}}` : ''}${r.label ? ` label=${lit(r.label)}` : ''}${r.color ? ` color=${lit(r.color)}` : ''} />`,
    ),
    ...(spec.points ?? []).map(
      (p) =>
        `<Point dataX={${typeof p.x === 'number' ? p.x : `data.findIndex((d) => d[${lit(spec.x)}] === ${lit(p.x)})`}}${p.y !== undefined ? ` dataY={${p.y}}` : ` seriesId=${lit(p.series ?? ys[0])}`}${p.label ? ` label=${lit(p.label)}` : ''}${p.color ? ` color=${lit(p.color)}` : ''}${p.pulse ? ' pulse' : ''} />`,
    ),
  ];

  const open = `<${component}\n      ${props.join('\n      ')}\n    `;
  const jsx = children.length ? `${open}>\n      ${children.join('\n      ')}\n    </${component}>` : `${open}/>`;
  return `import { ${[...imports].join(', ')} } from '@funnest/charts-react';

${dataLine}
${fmt}
export function Chart() {
  return (
    ${jsx}
  );
}
`;
}

export type { Row };
