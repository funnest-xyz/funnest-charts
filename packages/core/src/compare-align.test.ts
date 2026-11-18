import { describe, expect, it } from 'vitest';
import { alignCloses } from './compare-align.js';

const utc = (s: string) => Date.parse(`${s}Z`);

describe('alignCloses', () => {
  it('daily bars match by trading date across markets whose days start at different instants', () => {
    // Binance days (00:00 UTC) vs a US stock (00:00 New York = 05:00 UTC) and a Korean stock (00:00 KST = 15:00 UTC the day before).
    const btc = [utc('2026-11-16T00:00'), utc('2026-11-17T00:00'), utc('2026-11-18T00:00')];
    const aapl = [
      { time: utc('2026-11-16T05:00'), close: 16 },
      { time: utc('2026-11-17T05:00'), close: 17 },
    ];
    const samsung = [
      { time: utc('2026-11-15T15:00'), close: 16 },
      { time: utc('2026-11-16T15:00'), close: 17 },
      { time: utc('2026-11-17T15:00'), close: 18 },
    ];
    expect([...alignCloses(btc, aapl, true)]).toEqual([16, 17, 17]); // the 18th: not traded yet, the last close
    expect([...alignCloses(btc, samsung, true)]).toEqual([16, 17, 18]);
    // The other way round too.
    expect([...alignCloses(samsung.map((b) => b.time), [{ time: btc[0]!, close: 1 }, { time: btc[1]!, close: 2 }, { time: btc[2]!, close: 3 }], true)]).toEqual([1, 2, 3]);
    // By time (the old way) the US day lagged a day.
    expect([...alignCloses(btc, aapl, false)]).toEqual([NaN, 16, 17]);
  });

  it('intraday bars match by time; a closed market keeps its last close', () => {
    const main = [utc('2026-11-17T13:00'), utc('2026-11-17T14:00'), utc('2026-11-17T15:00')];
    const other = [{ time: utc('2026-11-17T14:00'), close: 5 }];
    expect([...alignCloses(main, other, false)]).toEqual([NaN, 5, 5]);
  });
});
