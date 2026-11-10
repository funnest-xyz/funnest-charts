import type { Bar, BarsRequest, ConnectionState, Datafeed, Quote, Resolution, SymbolInfo } from '../types';

/**
 * Serves several datafeeds through one chart. Symbols are namespaced as `KEY:SYMBOL`
 * (e.g. 'UPBIT:KRW-BTC', 'BINANCE:BTCUSDT'); search merges every feed's results.
 * A symbol without a prefix goes to the first feed.
 */
export function combineDatafeeds(feeds: Record<string, Datafeed>): Datafeed {
  const keys = Object.keys(feeds);
  if (keys.length === 0) throw new Error('combineDatafeeds: no datafeeds given');

  const split = (symbol: string): [string, Datafeed, string] => {
    const i = symbol.indexOf(':');
    const key = i > 0 ? symbol.slice(0, i) : keys[0]!;
    const feed = feeds[key];
    if (!feed) throw new Error(`combineDatafeeds: unknown prefix "${key}"`);
    return [key, feed, i > 0 ? symbol.slice(i + 1) : symbol];
  };
  const inner = (info: SymbolInfo): [Datafeed, SymbolInfo] => {
    const [, feed, symbol] = split(info.symbol);
    return [feed, { ...info, symbol }];
  };
  const outer = <T extends SymbolInfo>(key: string, info: T): T => ({ ...info, symbol: `${key}:${info.symbol}` });

  return {
    async resolveSymbol(symbol) {
      const [key, feed, raw] = split(symbol);
      return outer(key, await feed.resolveSymbol(raw));
    },
    getBars(info: SymbolInfo, resolution: Resolution, req: BarsRequest) {
      const [feed, raw] = inner(info);
      return feed.getBars(raw, resolution, req);
    },
    subscribeBars(
      info: SymbolInfo,
      resolution: Resolution,
      onBar: (bar: Bar) => void,
      onResetCache?: () => void,
      onConnection?: (state: ConnectionState) => void,
    ) {
      const [feed, raw] = inner(info);
      return feed.subscribeBars(raw, resolution, onBar, onResetCache, onConnection);
    },
    subscribeQuotes(info: SymbolInfo, onQuote: (quote: Quote) => void) {
      const [feed, raw] = inner(info);
      return feed.subscribeQuotes?.(raw, onQuote) ?? (() => {});
    },
    async searchSymbols(query: string) {
      const results = await Promise.allSettled(
        keys.map(async (key) => ((await feeds[key]!.searchSymbols?.(query)) ?? []).map((info) => outer(key, info))),
      );
      return results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
    },
  };
}
