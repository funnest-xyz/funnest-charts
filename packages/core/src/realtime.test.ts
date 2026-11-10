import { describe, expect, it } from 'vitest';
import { BarStore } from './model/bar-store';
import { bucketStart, TickAggregator, timeZoneOffset } from './realtime';

const kst = (iso: string) => Date.parse(`${iso}+09:00`);

describe('bucketStart', () => {
  it('computes timezone offsets', () => {
    expect(timeZoneOffset(Date.UTC(2026, 10, 9), 'Asia/Seoul')).toBe(9 * 3_600_000);
    expect(timeZoneOffset(Date.UTC(2026, 6, 1), 'America/New_York')).toBe(-4 * 3_600_000);
  });

  it('aligns intraday buckets to the local clock', () => {
    expect(bucketStart(kst('2026-11-09T09:07:31'), '5', 'Asia/Seoul')).toBe(kst('2026-11-09T09:05:00'));
    expect(bucketStart(kst('2026-11-09T10:59:59'), '60', 'Asia/Seoul')).toBe(kst('2026-11-09T10:00:00'));
    // India is UTC+5:30: hourly bars start at :00 local, not :30.
    const ist = Date.parse('2026-11-09T10:20:00+05:30');
    expect(bucketStart(ist, '60', 'Asia/Kolkata')).toBe(Date.parse('2026-11-09T10:00:00+05:30'));
  });

  it('aligns D/W/M to local midnight', () => {
    expect(bucketStart(kst('2026-11-09T23:50:00'), '1D', 'Asia/Seoul')).toBe(kst('2026-11-09T00:00:00'));
    // Upbit/Binance daily candles open at 00:00 UTC (09:00 KST).
    expect(bucketStart(kst('2026-11-09T08:00:00'), '1D', 'UTC')).toBe(kst('2026-11-08T09:00:00'));
    // 2026-11-12 is a Thursday → week starts Monday 11-09.
    expect(bucketStart(kst('2026-11-12T15:00:00'), '1W', 'Asia/Seoul')).toBe(kst('2026-11-09T00:00:00'));
    expect(bucketStart(kst('2026-11-30T12:00:00'), '1M', 'Asia/Seoul')).toBe(kst('2026-11-01T00:00:00'));
  });
});

describe('TickAggregator', () => {
  it('builds bars from ticks and continues a seeded bar', () => {
    const agg = new TickAggregator('1', 'UTC');
    const t0 = Date.UTC(2026, 10, 9, 0, 0);
    agg.seed({ time: t0, open: 100, high: 101, low: 99, close: 100, volume: 5 });

    expect(agg.push({ time: t0 + 10_000, price: 103, volume: 1 })).toEqual({
      time: t0, open: 100, high: 103, low: 99, close: 103, volume: 6,
    });
    expect(agg.push({ time: t0 + 61_000, price: 98, volume: 2 })).toEqual({
      time: t0 + 60_000, open: 98, high: 98, low: 98, close: 98, volume: 2,
    });
    // A late tick for the closed bar is dropped rather than corrupting the new one.
    expect(agg.push({ time: t0 + 59_000, price: 200 })).toBeNull();
  });
});

describe('BarStore realtime helpers', () => {
  const bar = (time: number, close = 1) => ({ time, open: close, high: close, low: close, close });

  it('updates an older existing bar in place (out-of-order message)', () => {
    const s = new BarStore();
    s.set([bar(1), bar(2), bar(3)]);
    expect(s.upsert(bar(2, 9))).toBe('update');
    expect(s.at(1)!.close).toBe(9);
    expect(s.upsert(bar(0))).toBe('ignored');
  });

  it('merges a re-fetched window that overlaps and fills a gap', () => {
    const s = new BarStore();
    s.set([bar(1), bar(2), bar(5)]);
    s.merge([bar(2, 7), bar(3), bar(4), bar(5, 8), bar(6)]);
    expect(s.bars.map((b) => b.time)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(s.at(1)!.close).toBe(7);
    expect(s.at(4)!.close).toBe(8);
  });

  it('maps time <-> fractional index, extrapolating beyond the data', () => {
    const s = new BarStore();
    s.set([bar(100), bar(200), bar(400)]);
    expect(s.indexFloatOfTime(300, 100)).toBe(1.5);
    expect(s.indexFloatOfTime(600, 100)).toBe(4);
    expect(s.indexFloatOfTime(0, 100)).toBe(-1);
    expect(s.timeOfIndexFloat(1.5, 100)).toBe(300);
    expect(s.timeOfIndexFloat(4, 100)).toBe(600);
  });
});
