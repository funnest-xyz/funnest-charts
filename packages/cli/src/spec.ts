import { messages, type CliLocale } from './i18n';

/** A row of tabular data: column name → value. */
export type Row = Record<string, unknown>;

export type ChartType = 'line' | 'area' | 'bar' | 'percentage-bar' | 'sparkline';

export interface ReferenceLineSpec {
  y?: number;
  /** Row index, or a value of the x column. */
  x?: number | string;
  label?: string;
  color?: string;
}

export interface PointSpec {
  /** Row index, or a value of the x column. */
  x: number | string;
  /** Value; omit to sit on `series`. */
  y?: number;
  series?: string;
  label?: string;
  color?: string;
  pulse?: boolean;
}

/** Declarative chart description shared by the CLI, the MCP server and AI agents. */
export interface ChartSpec {
  type: ChartType;
  data: Row[];
  title?: string;
  width?: number;
  height?: number;
  theme?: 'light' | 'dark';
  locale?: CliLocale;
  /** x column (labels/dates). Omit to use the row index. */
  x?: string;
  /** Numeric column(s) to draw. */
  y?: string | string[];
  /** Display names per y column. */
  labels?: Record<string, string>;
  /** Colors per y column (or per row label for percentage-bar). */
  colors?: Record<string, string>;
  /** percentage-bar: the label and value columns. */
  label?: string;
  value?: string;
  curve?: 'monotone' | 'linear' | 'step';
  area?: 'none' | 'gradient' | 'solid';
  stacked?: boolean;
  /** bar: red for ≥ 0, blue for < 0 (Korean convention). */
  colorBySign?: boolean;
  /** bar: 'horizontal' draws one row per category (rankings, sector returns). */
  layout?: 'vertical' | 'horizontal';
  showXAxis?: boolean;
  showYAxis?: boolean;
  legend?: boolean;
  /** Value labels: prefix/suffix/decimals, e.g. { suffix: '원' }. */
  format?: { prefix?: string; suffix?: string; decimals?: number };
  referenceLines?: ReferenceLineSpec[];
  points?: PointSpec[];
}

// ── Field definitions (one source for validation, JSON Schema and `info`) ────────────

type FieldKind = 'string' | 'number' | 'boolean' | 'string|string[]' | 'record' | 'array' | 'object' | 'rows';

export interface FieldDef {
  kind: FieldKind;
  required?: boolean;
  enum?: readonly string[];
  /** For string fields naming a data column (checked against the data). */
  column?: 'any' | 'numeric';
  default?: unknown;
  ko: string;
  en: string;
  /** JSON Schema for array items / object properties. */
  items?: Record<string, unknown>;
}

const COMMON: Record<string, FieldDef> = {
  type: { kind: 'string', required: true, ko: '차트 종류', en: 'Chart type' },
  data: { kind: 'rows', required: true, ko: '데이터 행 배열 (CLI는 .csv/.json 파일 경로도 돼요)', en: 'Array of data rows (CLI also accepts a .csv/.json path)' },
  title: { kind: 'string', ko: '제목', en: 'Title' },
  width: { kind: 'number', default: 640, ko: '너비(px)', en: 'Width (px)' },
  height: { kind: 'number', default: 320, ko: '높이(px)', en: 'Height (px)' },
  theme: { kind: 'string', enum: ['light', 'dark'], default: 'light', ko: '테마', en: 'Theme' },
  locale: { kind: 'string', enum: ['ko', 'en'], default: 'ko', ko: '숫자·날짜 형식 언어', en: 'Number/date formatting locale' },
};

const FORMAT: FieldDef = {
  kind: 'object',
  ko: '값 표시 형식 { prefix, suffix, decimals }',
  en: 'Value format { prefix, suffix, decimals }',
  items: { type: 'object', properties: { prefix: { type: 'string' }, suffix: { type: 'string' }, decimals: { type: 'number' } }, additionalProperties: false },
};

const SERIES: Record<string, FieldDef> = {
  x: { kind: 'string', column: 'any', ko: 'x축 열 (날짜·라벨). 없으면 행 순서', en: 'x column (dates/labels); row index when omitted' },
  y: { kind: 'string|string[]', required: true, column: 'numeric', ko: '그릴 숫자 열 (여러 개면 배열)', en: 'Numeric column(s) to draw' },
  labels: { kind: 'record', ko: '열 이름 → 표시 이름', en: 'Column → display name' },
  colors: { kind: 'record', ko: '열 이름 → 색', en: 'Column → color' },
  showXAxis: { kind: 'boolean', default: true, ko: 'x축 표시', en: 'Show x axis' },
  showYAxis: { kind: 'boolean', default: true, ko: 'y축 표시', en: 'Show y axis' },
  legend: { kind: 'boolean', ko: '범례 (계열이 여러 개면 기본으로 켜져요)', en: 'Legend (on by default for several series)' },
  format: FORMAT,
  referenceLines: {
    kind: 'array',
    ko: '기준선 [{ y, label, color }] 또는 [{ x, label }]',
    en: 'Reference lines [{ y, label, color }] or [{ x, label }]',
    items: { type: 'object', properties: { y: { type: 'number' }, x: { type: ['number', 'string'] }, label: { type: 'string' }, color: { type: 'string' } }, additionalProperties: false },
  },
  points: {
    kind: 'array',
    ko: '점 표시 [{ x, series, label, color, pulse }]',
    en: 'Markers [{ x, series, label, color, pulse }]',
    items: {
      type: 'object',
      required: ['x'],
      properties: { x: { type: ['number', 'string'] }, y: { type: 'number' }, series: { type: 'string' }, label: { type: 'string' }, color: { type: 'string' }, pulse: { type: 'boolean' } },
      additionalProperties: false,
    },
  },
};

const CURVE: FieldDef = { kind: 'string', enum: ['monotone', 'linear', 'step'], default: 'monotone', ko: '곡선 방식', en: 'Curve' };

export interface ChartDef {
  type: ChartType;
  ko: string;
  en: string;
  /** Which React component the spec maps to. */
  component: string;
  fields: Record<string, FieldDef>;
  example: Omit<ChartSpec, 'type'>;
}

const days = (n: number) =>
  Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(2026, 10, 10) - (n - 1 - i) * 86_400_000);
    return d.toISOString().slice(0, 10);
  });

const priceRows = () => {
  let p = 71_000;
  return days(30).map((date, i) => {
    p = Math.round(p * (1 + Math.sin(i * 1.7) * 0.012 + 0.002));
    return { date, price: p };
  });
};

export const CHARTS: Record<ChartType, ChartDef> = {
  line: {
    type: 'line',
    ko: '선 차트. 가격 흐름, 수익률 추이',
    en: 'Line chart: price history, returns over time',
    component: 'LineChart',
    fields: { ...COMMON, ...SERIES, curve: CURVE, area: { kind: 'string', enum: ['none', 'gradient', 'solid'], default: 'none', ko: '선 아래 채우기', en: 'Fill under the line' } },
    example: { title: '삼성전자 1개월', data: priceRows(), x: 'date', y: 'price', area: 'gradient', format: { suffix: '원' }, referenceLines: [{ y: 73_000, label: '평단가' }] },
  },
  area: {
    type: 'area',
    ko: '영역 차트. 자산 구성 변화 (stacked)',
    en: 'Area chart: composition over time (stacked)',
    component: 'AreaChart',
    fields: { ...COMMON, ...SERIES, curve: CURVE, stacked: { kind: 'boolean', default: false, ko: '위로 쌓기', en: 'Stack series' } },
    example: {
      title: '내 자산 (만원)',
      data: ['1월', '2월', '3월', '4월', '5월', '6월'].map((month, i) => ({ month, kr: 400 + i * 12, us: 300 + i * 20, crypto: 150 + ((i * 37) % 60) })),
      x: 'month',
      y: ['kr', 'us', 'crypto'],
      labels: { kr: '국내주식', us: '해외주식', crypto: '코인' },
      stacked: true,
      format: { suffix: '만' },
    },
  },
  bar: {
    type: 'bar',
    ko: '막대 차트. 일별 손익, 거래량',
    en: 'Bar chart: daily P&L, volume',
    component: 'BarChart',
    fields: {
      ...COMMON,
      ...SERIES,
      stacked: { kind: 'boolean', default: false, ko: '위로 쌓기', en: 'Stack series' },
      colorBySign: { kind: 'boolean', default: false, ko: '0 이상 빨강, 미만 파랑', en: 'Red for ≥ 0, blue for < 0' },
      layout: { kind: 'string', enum: ['vertical', 'horizontal'], default: 'vertical', ko: "'horizontal'이면 가로 막대 (순위, 업종별 수익률)", en: "'horizontal' for left-to-right bars (rankings, sector returns)" },
    },
    example: {
      title: '일별 손익',
      data: days(12).map((date, i) => ({ date, pnl: Math.round(Math.sin(i * 2.1) * 300 + 60) * 1000 })),
      x: 'date',
      y: 'pnl',
      colorBySign: true,
      format: { suffix: '원' },
      referenceLines: [{ y: 0 }],
    },
  },
  'percentage-bar': {
    type: 'percentage-bar',
    ko: '비중 막대. 포트폴리오 비중, 매수·매도 체결 강도',
    en: 'Percentage bar: portfolio weights, buy/sell pressure',
    component: 'PercentageBarChart',
    fields: {
      ...COMMON,
      height: { kind: 'number', default: 96, ko: '높이(px)', en: 'Height (px)' },
      label: { kind: 'string', required: true, column: 'any', ko: '이름 열', en: 'Label column' },
      value: { kind: 'string', required: true, column: 'numeric', ko: '값 열', en: 'Value column' },
      colors: { kind: 'record', ko: '이름 → 색', en: 'Label → color' },
    },
    example: {
      title: '포트폴리오 비중',
      data: [
        { asset: '국내주식', amount: 4200 },
        { asset: '해외주식', amount: 3100 },
        { asset: '코인', amount: 1700 },
        { asset: '현금', amount: 1000 },
      ],
      label: 'asset',
      value: 'amount',
      colors: { 현금: '#B0B8C1' },
    },
  },
  sparkline: {
    type: 'sparkline',
    ko: '스파크라인. 관심종목 목록의 작은 선',
    en: 'Sparkline: tiny line for watchlists',
    component: 'LineChart',
    fields: {
      ...COMMON,
      width: { kind: 'number', default: 120, ko: '너비(px)', en: 'Width (px)' },
      height: { kind: 'number', default: 36, ko: '높이(px)', en: 'Height (px)' },
      y: SERIES.y!,
      x: SERIES.x!,
      colors: SERIES.colors!,
      colorBySign: { kind: 'boolean', default: true, ko: '오르면 빨강, 내리면 파랑', en: 'Red when up, blue when down' },
    },
    example: { data: priceRows(), y: 'price' },
  },
};

export const CHART_TYPES = Object.keys(CHARTS) as ChartType[];

// ── Validation ──────────────────────────────────────────────────────────

export interface ValidationIssue {
  path: string;
  message: string;
}

/** Levenshtein distance, for "did you mean" hints. */
function distance(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...new Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0]![j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i]![j] = Math.min(dp[i - 1]![j]! + 1, dp[i]![j - 1]! + 1, dp[i - 1]![j - 1]! + (a[i - 1]!.toLowerCase() === b[j - 1]!.toLowerCase() ? 0 : 1));
  return dp[a.length]![b.length]!;
}

export function closest(word: string, options: readonly string[]): string | null {
  let best: string | null = null;
  let bestD = Infinity;
  for (const o of options) {
    const d = distance(word, o);
    if (d < bestD) {
      bestD = d;
      best = o;
    }
  }
  return best !== null && bestD <= Math.max(2, Math.floor(word.length / 3)) ? best : null;
}

const isNumeric = (v: unknown) => (typeof v === 'number' && Number.isFinite(v)) || v === null || (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)));

const typeOk = (kind: FieldKind, v: unknown): boolean => {
  switch (kind) {
    case 'string':
      return typeof v === 'string';
    case 'number':
      return typeof v === 'number' && Number.isFinite(v);
    case 'boolean':
      return typeof v === 'boolean';
    case 'string|string[]':
      return typeof v === 'string' || (Array.isArray(v) && v.length > 0 && v.every((x) => typeof x === 'string'));
    case 'record':
      return typeof v === 'object' && v !== null && !Array.isArray(v) && Object.values(v).every((x) => typeof x === 'string');
    case 'array':
      return Array.isArray(v);
    case 'object':
      return typeof v === 'object' && v !== null && !Array.isArray(v);
    case 'rows':
      return Array.isArray(v) && v.every((r) => typeof r === 'object' && r !== null && !Array.isArray(r));
  }
};

const KIND_NAMES: Record<FieldKind, { ko: string; en: string }> = {
  string: { ko: '문자열', en: 'a string' },
  number: { ko: '숫자', en: 'a number' },
  boolean: { ko: 'true/false', en: 'true/false' },
  'string|string[]': { ko: '문자열 또는 문자열 배열', en: 'a string or string array' },
  record: { ko: '{ 이름: 문자열 } 객체', en: 'an object of strings' },
  array: { ko: '배열', en: 'an array' },
  object: { ko: '객체', en: 'an object' },
  rows: { ko: '객체 배열', en: 'an array of objects' },
};

/** Check a spec. Returns an empty list when it can be rendered. */
export function validateSpec(input: unknown, locale: CliLocale = 'ko'): ValidationIssue[] {
  const t = messages(locale);
  const issues: ValidationIssue[] = [];
  const add = (path: string, message: string) => issues.push({ path, message });
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    add('', t.wrongType('spec', KIND_NAMES.object[locale]));
    return issues;
  }
  const spec = input as Record<string, unknown>;
  const type = spec.type;
  if (typeof type !== 'string') {
    add('type', t.required('type'));
    return issues;
  }
  const def = CHARTS[type as ChartType];
  if (!def) {
    add('type', t.unknownType(type, closest(type, CHART_TYPES)));
    return issues;
  }

  for (const key of Object.keys(spec)) {
    if (!(key in def.fields)) add(key, t.unknownField(key, closest(key, Object.keys(def.fields))));
  }
  for (const [name, f] of Object.entries(def.fields)) {
    const v = spec[name];
    if (v === undefined) {
      if (f.required) add(name, t.required(name));
      continue;
    }
    if (!typeOk(f.kind, v)) {
      add(name, t.wrongType(name, KIND_NAMES[f.kind][locale]));
      continue;
    }
    if (f.enum && !f.enum.includes(v as string)) add(name, t.notOneOf(name, f.enum.join(' | ')));
  }

  // Column references must exist in the data (and be numeric where drawn).
  const rows = Array.isArray(spec.data) ? (spec.data as Row[]) : null;
  if (rows && rows.length === 0) add('data', t.emptyData);
  if (rows && rows.length > 0) {
    const columns = [...new Set(rows.flatMap((r) => Object.keys(r)))];
    for (const [name, f] of Object.entries(def.fields)) {
      if (!f.column || spec[name] === undefined) continue;
      const cols = Array.isArray(spec[name]) ? (spec[name] as string[]) : typeof spec[name] === 'string' ? [spec[name] as string] : [];
      cols.forEach((col, i) => {
        const path = Array.isArray(spec[name]) ? `${name}[${i}]` : name;
        if (!columns.includes(col)) add(path, t.noColumn(path, col, columns.join(', '), closest(col, columns)));
        else if (f.column === 'numeric' && !rows.every((r) => isNumeric(r[col]))) add(path, t.notNumeric(path, col));
      });
    }
  }
  return issues;
}

// ── JSON Schema ─────────────────────────────────────────────────────────

const jsonType = (f: FieldDef): Record<string, unknown> => {
  switch (f.kind) {
    case 'string':
      return f.enum ? { type: 'string', enum: f.enum } : { type: 'string' };
    case 'number':
      return { type: 'number' };
    case 'boolean':
      return { type: 'boolean' };
    case 'string|string[]':
      return { oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' }, minItems: 1 }] };
    case 'record':
      return { type: 'object', additionalProperties: { type: 'string' } };
    case 'array':
      return { type: 'array', items: f.items ?? {} };
    case 'object':
      return f.items ?? { type: 'object' };
    case 'rows':
      return { type: 'array', items: { type: 'object' }, minItems: 1 };
  }
};

export function chartSchema(type: ChartType, locale: CliLocale = 'ko'): Record<string, unknown> {
  const def = CHARTS[type];
  const properties: Record<string, unknown> = {};
  for (const [name, f] of Object.entries(def.fields)) {
    properties[name] = {
      ...(name === 'type' ? { const: type } : jsonType(f)),
      description: f[locale],
      ...(f.default !== undefined ? { default: f.default } : {}),
    };
  }
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: `https://charts.funnest.xyz/schema/${type}.json`,
    title: `Funnest Charts · ${type}`,
    description: def[locale],
    type: 'object',
    required: Object.entries(def.fields)
      .filter(([, f]) => f.required)
      .map(([n]) => n),
    properties,
    additionalProperties: false,
  };
}

export const exampleSpec = (type: ChartType): ChartSpec => ({ type, ...structuredClone(CHARTS[type].example) }) as ChartSpec;
