/** Interval units, for 보임 (which intervals an indicator or drawing shows on). */
export type IntervalUnit = 'seconds' | 'minutes' | 'hours' | 'days' | 'weeks' | 'months';

/**
 * 보임: per unit, the range of that unit it shows on (inclusive; 분 1–59 means every minute
 * interval), or false: not on that unit at all. Units left out: shown.
 */
export type IntervalVisibility = Partial<Record<IntervalUnit, [number, number] | false>>;

/** Which unit an interval is in, and how many of it ('240' → hours 4, '1D' → days 1). */
export function intervalUnit(resolution: string): { unit: IntervalUnit; n: number } | null {
  const m = /^(\d*)([SDWM]?)$/i.exec(resolution.trim());
  if (!m) return null;
  const n = m[1] ? Number(m[1]) : 1;
  switch ((m[2] ?? '').toUpperCase()) {
    case 'S':
      return { unit: 'seconds', n };
    case 'D':
      return { unit: 'days', n };
    case 'W':
      return { unit: 'weeks', n };
    case 'M':
      return { unit: 'months', n };
    default:
      return n % 60 === 0 ? { unit: 'hours', n: n / 60 } : { unit: 'minutes', n };
  }
}

/** Whether something with this 보임 shows on `resolution`. */
export function shownOnInterval(intervals: IntervalVisibility | undefined, resolution: string | null | undefined): boolean {
  if (!intervals || !resolution) return true;
  const u = intervalUnit(resolution);
  if (!u) return true;
  const rule = intervals[u.unit];
  if (rule === undefined) return true;
  if (rule === false) return false;
  return u.n >= rule[0] && u.n <= rule[1];
}
