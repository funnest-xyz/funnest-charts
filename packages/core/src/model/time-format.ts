import type { Bar } from '../types';
import type { TimeScale } from './time-scale';

export type Locale = 'ko' | 'en';

export interface TimeParts {
  year: number;
  /** 1–12 */
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  /** 0 = Sunday */
  weekday: number;
}

const WEEKDAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const WEEKDAYS: Record<Locale, readonly string[]> = {
  ko: ['일', '월', '화', '수', '목', '금', '토'],
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
};
const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const CACHE_LIMIT = 10_000;

const pad2 = (n: number) => (n < 10 ? `0${n}` : String(n));

export function defaultTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

/** Timezone-aware calendar parts with a per-timestamp cache (Intl is slow per call). */
export class TimeFormatter {
  private readonly dtf: Intl.DateTimeFormat;
  private readonly cache = new Map<number, TimeParts>();

  constructor(
    readonly timeZone: string,
    readonly locale: Locale,
  ) {
    this.dtf = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      weekday: 'short',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    });
  }

  parts(time: number): TimeParts {
    const cached = this.cache.get(time);
    if (cached) return cached;
    const p: TimeParts = { year: 0, month: 0, day: 0, hour: 0, minute: 0, second: 0, weekday: 0 };
    for (const { type, value } of this.dtf.formatToParts(time)) {
      switch (type) {
        case 'year': p.year = Number(value); break;
        case 'month': p.month = Number(value); break;
        case 'day': p.day = Number(value); break;
        case 'hour': p.hour = Number(value) % 24; break;
        case 'minute': p.minute = Number(value); break;
        case 'second': p.second = Number(value); break;
        case 'weekday': p.weekday = WEEKDAY_INDEX[value] ?? 0; break;
      }
    }
    if (this.cache.size >= CACHE_LIMIT) this.cache.clear();
    this.cache.set(time, p);
    return p;
  }

  /** Full label for the crosshair, e.g. "2026.11.09 (월) 14:30". */
  crosshairLabel(time: number, intraday: boolean): string {
    const p = this.parts(time);
    const sep = this.locale === 'ko' ? '.' : '-';
    const date = `${p.year}${sep}${pad2(p.month)}${sep}${pad2(p.day)} (${WEEKDAYS[this.locale][p.weekday]})`;
    return intraday ? `${date} ${pad2(p.hour)}:${pad2(p.minute)}` : date;
  }

  tickLabel(p: TimeParts, weight: number): string {
    const ko = this.locale === 'ko';
    if (weight >= TickWeight.Year) return ko ? `${p.year}년` : String(p.year);
    if (weight >= TickWeight.Month) return ko ? `${p.month}월` : MONTHS_EN[p.month - 1]!;
    if (weight >= TickWeight.Day) return ko ? `${p.day}일` : String(p.day);
    return `${pad2(p.hour)}:${pad2(p.minute)}`;
  }
}

export const TickWeight = {
  Year: 60,
  Month: 50,
  Day: 40,
  Hour: 30,
  Minute30: 25,
  Minute15: 22,
  Minute5: 20,
  Minute: 10,
  None: 0,
} as const;

/** How "important" the boundary between two consecutive bars is (bigger = coarser unit changed). */
export function boundaryWeight(prev: TimeParts | null, cur: TimeParts): number {
  if (!prev) return TickWeight.Minute;
  if (cur.year !== prev.year) return TickWeight.Year;
  if (cur.month !== prev.month) return TickWeight.Month;
  if (cur.day !== prev.day) return TickWeight.Day;
  if (cur.hour !== prev.hour) return TickWeight.Hour;
  if (cur.minute !== prev.minute) {
    if (cur.minute % 30 === 0) return TickWeight.Minute30;
    if (cur.minute % 15 === 0) return TickWeight.Minute15;
    if (cur.minute % 5 === 0) return TickWeight.Minute5;
    return TickWeight.Minute;
  }
  return TickWeight.None;
}

export interface TimeTick {
  index: number;
  x: number;
  label: string;
}

/**
 * Picks time-axis labels: most significant boundaries first (year > month > day > hour…),
 * keeping at least `minGap` px between labels.
 */
export function computeTimeTicks(
  bars: readonly Bar[],
  timeScale: TimeScale,
  formatter: TimeFormatter,
  minGap: number,
): TimeTick[] {
  const { from, to } = timeScale.visibleRange();
  if (to < from) return [];

  const candidates: { index: number; weight: number; parts: TimeParts }[] = [];
  let prev = from > 0 ? formatter.parts(bars[from - 1]!.time) : null;
  for (let i = from; i <= to; i++) {
    const parts = formatter.parts(bars[i]!.time);
    const weight = boundaryWeight(prev, parts);
    if (weight > TickWeight.None) candidates.push({ index: i, weight, parts });
    prev = parts;
  }
  candidates.sort((a, b) => b.weight - a.weight || a.index - b.index);

  const edge = minGap / 3;
  const picked: TimeTick[] = [];
  for (const c of candidates) {
    const x = timeScale.indexToX(c.index);
    if (x < edge || x > timeScale.width - edge) continue;
    if (picked.some((t) => Math.abs(t.x - x) < minGap)) continue;
    picked.push({ index: c.index, x, label: formatter.tickLabel(c.parts, c.weight) });
  }
  return picked.sort((a, b) => a.index - b.index);
}
