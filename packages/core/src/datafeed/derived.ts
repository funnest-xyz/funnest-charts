import { DAY_MS, resolutionToMs } from '../resolution.js';
import type { Bar, BarsRequest, BarsResult, Datafeed, Resolution, SymbolInfo } from '../types.js';

/**
 * Intervals a feed doesn't send, made from one it does: 2시간 from 1시간, 3분 from 1분, 45분 from
 * 15분, 2일 from 일, 2주 from 주, 2개월 from 월. The chart wraps its datafeed with this, so any
 * interval with such a base works on every feed (the interval picker's 직접 추가).
 *
 * Candles: intraday ones align to UTC (2시간 = 00:00, 02:00… UTC — also 09:00 KST, the Korean
 * session's open); days, weeks and months are counted from the base candles' own dates. Paging
 * back, a page's oldest candle may be missing earlier base candles (they're on the next page), so
 * it's left for the next request unless history ends there. Live: the forming base candle is
 * merged into the ones before it in the same period.
 */

type Family = 'minutes' | 'D' | 'W' | 'M';

function parse(resolution: Resolution): { family: Family; n: number } | null {
  const m = /^(\d*)([SDWM]?)$/i.exec(resolution.trim());
  if (!m) return null;
  const n = m[1] ? Number(m[1]) : 1;
  const unit = (m[2] ?? '').toUpperCase();
  if (unit === 'S' || !(n >= 1)) return null;
  return { family: unit === '' ? 'minutes' : (unit as Family), n };
}

/**
 * The supported interval `target` can be made from, or null: when it's supported itself, when
 * the feed says nothing (everything goes), or when no supported interval divides it.
 */
export function derivedBase(target: Resolution, supported: readonly Resolution[] | undefined): Resolution | null {
  if (!supported?.length || supported.includes(target)) return null;
  const t = parse(target);
  if (!t) return null;
  if (t.family === 'minutes') {
    const bases = supported
      .map((r) => ({ r, p: parse(r) }))
      .filter((x) => x.p?.family === 'minutes' && x.p.n < t.n && t.n % x.p.n === 0)
      .sort((a, b) => b.p!.n - a.p!.n);
    return bases[0]?.r ?? null;
  }
  if (t.n < 2) return null;
  const one = `1${t.family}`;
  return supported.includes(one) ? one : null;
}

const dayIndex = (time: number) => Math.floor((time + DAY_MS / 2) / DAY_MS);
/** A base candle's calendar month (year × 12 + month): its time is near the month's start in some time zone. */
const monthIndex = (time: number) => {
  const d = new Date(time + 3 * DAY_MS);
  return d.getUTCFullYear() * 12 + d.getUTCMonth();
};
const floorTo = (v: number, n: number) => v - (((v % n) + n) % n);

/** Which candle of `target` a base candle at `time` belongs to (a number that grows with time). */
function groupKey(time: number, target: Resolution): number {
  const t = parse(target)!;
  switch (t.family) {
    case 'minutes': {
      const size = resolutionToMs(target);
      return Math.floor(time / size) * size;
    }
    case 'D':
      return floorTo(dayIndex(time), t.n);
    case 'W':
      // 1970-01-01 was a Thursday: +3 puts weeks on Monday.
      return floorTo(Math.floor((dayIndex(time) + 3) / 7), t.n);
    case 'M':
      return floorTo(monthIndex(time), t.n);
  }
}

const merge = (a: Bar, b: Bar): Bar => ({
  time: a.time,
  open: a.open,
  high: Math.max(a.high, b.high),
  low: Math.min(a.low, b.low),
  close: b.close,
  ...(a.volume !== undefined || b.volume !== undefined ? { volume: (a.volume ?? 0) + (b.volume ?? 0) } : {}),
});

interface Group {
  key: number;
  parts: Bar[];
}

/** One candle from a group's base candles: intraday at its period's start, longer ones at their first base candle. */
function candleOf(g: Group, target: Resolution): Bar {
  const bar = g.parts.reduce(merge);
  return parse(target)!.family === 'minutes' ? { ...bar, time: g.key } : bar;
}

/** Base candles (any order) → the target's candles, oldest first, with their groups. */
export function groupBars(base: readonly Bar[], target: Resolution): { bars: Bar[]; groups: Group[] } {
  const groups: Group[] = [];
  for (const bar of [...base].sort((a, b) => a.time - b.time)) {
    const key = groupKey(bar.time, target);
    const last = groups.at(-1);
    if (last?.key === key) last.parts.push(bar);
    else groups.push({ key, parts: [bar] });
  }
  return { bars: groups.map((g) => candleOf(g, target)), groups };
}

/** Base candles per target candle, about (to ask the feed for enough). */
const perCandle = (target: Resolution, base: Resolution) => Math.max(1, Math.ceil(resolutionToMs(target) / resolutionToMs(base)));

/** The feed, serving intervals it doesn't send from ones it does (derivedBase). */
export function withDerivedResolutions(feed: Datafeed): Datafeed {
  /** The newest group per symbol and interval, as the last read gave it: live candles build on it. */
  const latest = new Map<string, Group>();
  const keyOf = (info: SymbolInfo, resolution: Resolution) => `${info.symbol}|${resolution}`;

  // Every method of the feed as the wrapper's own, bound (search, quotes… come along).
  const wrapped = {} as Datafeed;
  for (let o: object | null = feed; o && o !== Object.prototype; o = Object.getPrototypeOf(o)) {
    for (const k of Object.getOwnPropertyNames(o)) {
      if (k === 'constructor' || k in wrapped) continue;
      const v = (feed as unknown as Record<string, unknown>)[k];
      (wrapped as unknown as Record<string, unknown>)[k] = typeof v === 'function' ? (v as (...a: unknown[]) => unknown).bind(feed) : v;
    }
  }

  wrapped.getBars = async (info: SymbolInfo, resolution: Resolution, req: BarsRequest): Promise<BarsResult> => {
    const base = derivedBase(resolution, info.supportedResolutions);
    if (!base) return feed.getBars(info, resolution, req);
    const k = perCandle(resolution, base);
    const r = await feed.getBars(info, base, { ...req, ...(req.countBack ? { countBack: req.countBack * k + k } : {}) });
    const { bars, groups } = groupBars(r.bars, resolution);
    const newest = groups.at(-1);
    if (newest && req.to >= Date.now() - 2 * resolutionToMs(resolution)) latest.set(keyOf(info, resolution), { key: newest.key, parts: [...newest.parts] });
    // More history before: the oldest candle may be partial — the next page brings it whole.
    if (!r.noMoreData && bars.length > 1) return { bars: bars.slice(1), noMoreData: false };
    return { bars, noMoreData: r.noMoreData };
  };

  wrapped.subscribeBars = (info, resolution, onBar, onResetCache, onConnection) => {
    const base = derivedBase(resolution, info.supportedResolutions);
    if (!base) return feed.subscribeBars(info, resolution, onBar, onResetCache, onConnection);
    const key = keyOf(info, resolution);
    return feed.subscribeBars(
      info,
      base,
      (part) => {
        const g = groupKey(part.time, resolution);
        let cur = latest.get(key);
        if (!cur || cur.key !== g) {
          if (cur && g < cur.key) return;
          cur = { key: g, parts: [] };
          latest.set(key, cur);
        }
        // The forming base candle replaces itself; a new one joins after the ones before it.
        const i = cur.parts.findIndex((p) => p.time === part.time);
        if (i >= 0) cur.parts[i] = part;
        else cur.parts.push(part);
        cur.parts.sort((a, b) => a.time - b.time);
        onBar(candleOf(cur, resolution));
      },
      onResetCache,
      onConnection,
    );
  };
  return wrapped;
}
