import type { ChartSpec, Row } from './spec';

/** Minimal RFC 4180 CSV parser (quoted fields, escaped quotes, CRLF). Numbers become numbers. */
export function parseCsv(text: string): Row[] {
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  const [header, ...body] = rows.filter((r) => r.some((v) => v.trim() !== ''));
  if (!header) return [];
  const keys = header.map((h) => h.trim().replace(/^﻿/, ''));
  return body.map((r) =>
    Object.fromEntries(
      keys.map((k, i) => {
        const raw = (r[i] ?? '').trim();
        const n = raw.replace(/,/g, '');
        return [k, raw !== '' && Number.isFinite(Number(n)) && /^-?[\d,.]+$/.test(raw) ? Number(n) : raw];
      }),
    ),
  );
}

/** Rows from file text by extension (.csv / .json — array, or { data: [...] }). */
export function parseData(text: string, filename: string): Row[] {
  if (/\.csv$/i.test(filename)) return parseCsv(text);
  const json = JSON.parse(text) as unknown;
  if (Array.isArray(json)) return json as Row[];
  if (json && typeof json === 'object' && Array.isArray((json as { data?: unknown }).data)) return (json as { data: Row[] }).data;
  throw new Error(`${filename}: expected an array of rows`);
}

const DATE = /^\d{4}-\d{2}(-\d{2})?([T ][\d:.]+Z?)?$|^\d{1,2}\/\d{1,2}$|^\d{1,2}월$|^\d{4}\.\d{1,2}(\.\d{1,2})?$/;

export interface Suggestion {
  reason: { ko: string; en: string };
  spec: ChartSpec;
}

/** Look at the columns and propose charts that fit (most fitting first). */
export function suggestCharts(rows: Row[]): Suggestion[] {
  if (rows.length === 0) return [];
  const cols = Object.keys(rows[0]!);
  const numeric = cols.filter((c) => rows.every((r) => typeof r[c] === 'number' || r[c] === null || r[c] === ''));
  const text = cols.filter((c) => !numeric.includes(c));
  const time = text.find((c) => rows.every((r) => DATE.test(String(r[c]))));
  const category = text.find((c) => c !== time);
  const out: Suggestion[] = [];
  const allPositive = (c: string) => rows.every((r) => typeof r[c] !== 'number' || (r[c] as number) >= 0);
  const hasNegative = (c: string) => rows.some((r) => typeof r[c] === 'number' && (r[c] as number) < 0);

  // OHLC columns (English or Korean names) → candles first.
  const find = (...names: string[]) => numeric.find((c) => names.includes(c.toLowerCase()));
  const ohlc = { open: find('open', 'o', '시가'), high: find('high', 'h', '고가'), low: find('low', 'l', '저가'), close: find('close', 'c', '종가') };
  if (ohlc.open && ohlc.high && ohlc.low && ohlc.close) {
    const volume = find('volume', 'vol', 'v', '거래량');
    out.push({
      reason: { ko: '시가·고가·저가·종가가 있어 캔들 차트가 잘 맞아요', en: 'Open/high/low/close columns: candles' },
      spec: { type: 'candlestick', data: rows, ...(time ? { x: time } : {}), open: ohlc.open, high: ohlc.high, low: ohlc.low, close: ohlc.close, ...(volume ? { volume } : {}) },
    });
  }
  if (time && numeric.length) {
    const magnitude = (c: string) => Math.max(...rows.map((r) => Math.abs(Number(r[c]) || 0)));
    // Columns on a similar scale can share one chart; others get their own.
    const base = numeric.find(allPositive) ?? numeric[0]!;
    const similar = numeric.filter((c) => allPositive(c) && magnitude(c) > 0 && magnitude(base) / magnitude(c) < 10 && magnitude(c) / magnitude(base) < 10);
    for (const c of numeric.slice(0, 4)) {
      if (hasNegative(c)) {
        out.push({
          reason: { ko: `${c}에 음수가 있어 0 기준 막대(빨강/파랑)가 잘 맞아요`, en: `${c} has negatives: bars around 0` },
          spec: { type: 'bar', data: rows, x: time, y: c, colorBySign: true, referenceLines: [{ y: 0 }] },
        });
      } else if (!similar.includes(c) || similar.length === 1) {
        out.push({
          reason: { ko: `${time}에 따른 ${c} 흐름`, en: `${c} over ${time}` },
          spec: { type: 'line', data: rows, x: time, y: c, area: 'gradient' },
        });
      }
    }
    if (similar.length > 1) {
      out.push({
        reason: { ko: `비슷한 크기의 ${similar.join(', ')}를 한 차트에서 비교`, en: `Compare ${similar.join(', ')} (similar scale)` },
        spec: { type: 'line', data: rows, x: time, y: similar.slice(0, 5) },
      });
      out.push({
        reason: { ko: '쌓아서 합계와 구성을 함께', en: 'Stack them to show total and composition' },
        spec: { type: 'area', data: rows, x: time, y: similar.slice(0, 5), stacked: true },
      });
    }
    out.push({ reason: { ko: `목록에 넣을 ${base}의 작은 흐름`, en: `Tiny ${base} trend for lists` }, spec: { type: 'sparkline', data: rows, x: time, y: base } });
  }
  if (category && numeric.length) {
    const v = numeric[0]!;
    // A size column plus a change column with negatives → market map.
    const size = numeric.find(allPositive);
    const change = numeric.find(hasNegative);
    if (size && change && rows.length >= 4) {
      out.push({
        reason: { ko: `${size}로 크기, ${change}로 색을 정한 마켓맵`, en: `Market map: size by ${size}, color by ${change}` },
        spec: { type: 'treemap', data: rows, label: category, value: size, change },
      });
    }
    if (rows.length <= 8 && allPositive(v)) {
      out.push({
        reason: { ko: `${category}별 ${v} 비중`, en: `Share of ${v} by ${category}` },
        spec: { type: 'percentage-bar', data: rows, label: category, value: v },
      });
      out.push({
        reason: { ko: `${category}별 ${v} 비중을 도넛으로`, en: `Share of ${v} by ${category} as a donut` },
        spec: { type: 'donut', data: rows, label: category, value: v },
      });
    }
    out.push({
      reason: { ko: `${category}별 ${v} 비교`, en: `Compare ${v} by ${category}` },
      spec: { type: 'bar', data: rows, x: category, y: numeric.length > 1 ? numeric.slice(0, 4) : v, ...(hasNegative(v) ? { colorBySign: true } : {}) },
    });
  }
  if (!time && !category && numeric.length) {
    out.push({ reason: { ko: '행 순서대로 값의 흐름', en: 'Values in row order' }, spec: { type: 'line', data: rows, y: numeric[0]! } });
  }
  return out;
}
