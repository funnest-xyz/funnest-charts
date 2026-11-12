import { describe, expect, it } from 'vitest';
import type { Datafeed, SymbolInfo } from '../types';
import { combineDatafeeds } from './combine';

const info = (symbol: string, exchange: string): SymbolInfo => ({ symbol, name: symbol, exchange, timezone: 'UTC', session: '24x7', pricePrecision: 2, tickSize: 0.01 });

function feed(symbols: string[], exchange: string, delay: number, spark?: number[]): Datafeed {
  return {
    resolveSymbol: async (s) => info(s, exchange),
    getBars: async () => ({ bars: [], noMoreData: true }),
    subscribeBars: () => () => {},
    searchSymbols: (q) => new Promise((done) => setTimeout(() => done(symbols.filter((s) => s.includes(q)).map((s) => info(s, exchange))), delay)),
    ...(spark ? { getSparkline: async () => spark } : {}),
  };
}

describe('combineDatafeeds', () => {
  it('progressive search: each source as it answers, always in the feeds’ order', async () => {
    const combined = combineDatafeeds({ SLOW: feed(['A1', 'A2'], 'Slow', 30), FAST: feed(['B1'], 'Fast', 1) });
    const partials: string[][] = [];
    const all = await combined.searchSymbolsProgressive!('', (r) => partials.push(r.map((x) => x.symbol)));
    expect(partials).toEqual([['FAST:B1'], ['SLOW:A1', 'SLOW:A2', 'FAST:B1']]);
    expect(all.map((x) => x.symbol)).toEqual(['SLOW:A1', 'SLOW:A2', 'FAST:B1']);
  });

  it('sparklines go to the feed that owns the symbol', async () => {
    const combined = combineDatafeeds({ A: feed([], 'A', 0, [1, 2, 3]), B: feed([], 'B', 0) });
    expect(await combined.getSparkline!('A:X')).toEqual([1, 2, 3]);
    expect(await combined.getSparkline!('B:Y')).toEqual([]);
  });
});
