import {
  krxTickSize,
  resolutionToMs,
  roundToTick,
  type Bar,
  type BarsRequest,
  type BarsResult,
  type ConnectionState,
  type Datafeed,
  type Quote,
  type Resolution,
  type SymbolInfo,
  type SymbolSearchResult,
} from '@funnest/charts';

const KST_OFFSET = 9 * 3_600_000;
const DAY = 86_400_000;
const HISTORY_BARS = 3000;
const NETWORK_DELAY = 250;

interface MockSymbol {
  info: SymbolInfo;
  basePrice: number;
  /** Typical daily return standard deviation (Samsung ≈ 1.6%, BTC ≈ 2.5%). */
  dailyVol: number;
  /** Trading minutes per day (KRX 390, crypto 1440) — spreads dailyVol over intraday bars. */
  sessionMinutes: number;
  /** Trading days per week, for weekly-bar volatility. */
  daysPerWeek: number;
  baseVolume: number;
  /** Is a bar opening at `time` inside the trading session? */
  inSession(time: number, resolutionMs: number): boolean;
  /** Intraday volatility multiplier (busier near the open/close). */
  intradayShape?(time: number): number;
}

const krxSession = (time: number, resMs: number) => {
  const kst = time + KST_OFFSET;
  const weekday = new Date(kst).getUTCDay();
  if (weekday === 0 || weekday === 6) return false;
  if (resMs >= DAY) return true;
  const minute = Math.floor((kst % DAY) / 60_000);
  return minute >= 9 * 60 && minute < 15 * 60 + 30;
};

const usSession = (time: number, resMs: number) => {
  const ny = time - 5 * 3_600_000; // EST (DST ignored in this mock)
  const weekday = new Date(ny).getUTCDay();
  if (weekday === 0 || weekday === 6) return false;
  if (resMs >= DAY) return true;
  const minute = Math.floor((((ny % DAY) + DAY) % DAY) / 60_000);
  return minute >= 9 * 60 + 30 && minute < 16 * 60;
};

/** Exchange-session U-shape: volatility is highest right after the open and before the close. */
const uShape = (offsetMs: number, openMinute: number, closeMinute: number) => (time: number) => {
  const minute = Math.floor((((time + offsetMs) % DAY) + DAY) % DAY / 60_000) - openMinute;
  const toClose = closeMinute - openMinute - minute;
  return 0.7 + 1.4 * Math.exp(-minute / 25) + 0.6 * Math.exp(-toClose / 20);
};

const krx = (symbol: string, name: string, basePrice: number, baseVolume: number, dailyVol: number): MockSymbol => ({
  info: {
    symbol,
    name,
    exchange: 'KRX',
    timezone: 'Asia/Seoul',
    session: '0900-1530',
    pricePrecision: 0,
    tickSize: krxTickSize,
    type: 'stock',
    country: 'KR',
  },
  basePrice,
  dailyVol,
  sessionMinutes: 390,
  daysPerWeek: 5,
  baseVolume,
  inSession: krxSession,
  intradayShape: uShape(KST_OFFSET, 9 * 60, 15 * 60 + 30),
});

const SYMBOLS: Record<string, MockSymbol> = {
  '005930': krx('005930', '삼성전자', 71_200, 180_000, 0.016),
  '000660': krx('000660', 'SK하이닉스', 182_400, 60_000, 0.026),
  BTCUSDT: {
    info: {
      symbol: 'BTCUSDT',
      name: 'BTC/USDT',
      exchange: 'Binance',
      timezone: 'Asia/Seoul',
      session: '24x7',
      pricePrecision: 2,
      tickSize: 0.01,
      type: 'crypto',
    },
    basePrice: 98_450,
    dailyVol: 0.025,
    sessionMinutes: 1440,
    daysPerWeek: 7,
    baseVolume: 42,
    inSession: () => true,
  },
  ETHUSDT: {
    info: {
      symbol: 'ETHUSDT',
      name: 'ETH/USDT',
      exchange: 'Binance',
      timezone: 'Asia/Seoul',
      session: '24x7',
      pricePrecision: 2,
      tickSize: 0.01,
      type: 'crypto',
    },
    basePrice: 3_412.5,
    dailyVol: 0.035,
    sessionMinutes: 1440,
    daysPerWeek: 7,
    baseVolume: 520,
    inSession: () => true,
  },
  AAPL: {
    info: {
      symbol: 'AAPL',
      name: 'Apple',
      exchange: 'NASDAQ',
      timezone: 'America/New_York',
      session: '0930-1600',
      pricePrecision: 2,
      tickSize: 0.01,
      type: 'stock',
      country: 'US',
    },
    basePrice: 232.4,
    dailyVol: 0.015,
    sessionMinutes: 390,
    daysPerWeek: 5,
    baseVolume: 90_000,
    inSession: usSession,
    intradayShape: uShape(-5 * 3_600_000, 9 * 60 + 30, 16 * 60),
  },
};

/** Deterministic PRNG so history is stable across page reloads. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function alignTime(time: number, resMs: number): number {
  // Align daily+ bars to KST midnight, intraday bars to the resolution grid.
  if (resMs >= DAY) return Math.floor((time + KST_OFFSET) / DAY) * DAY - KST_OFFSET;
  return Math.floor(time / resMs) * resMs;
}

/** Standard normal via Box–Muller. */
const gauss = (rand: () => number) => Math.sqrt(-2 * Math.log(rand() || 1e-12)) * Math.cos(2 * Math.PI * rand());

/** Return standard deviation of one bar at this resolution. */
function barVol(sym: MockSymbol, resMs: number): number {
  // Months and longer (1M, 3M, 6M, 12M): scale the ~monthly volatility by the number of months.
  if (resMs >= 28 * DAY) return sym.dailyVol * Math.sqrt(sym.daysPerWeek * 4.3 * (resMs / (30 * DAY)));
  if (resMs >= 7 * DAY) return sym.dailyVol * Math.sqrt(sym.daysPerWeek);
  if (resMs >= DAY) return sym.dailyVol;
  return (sym.dailyVol / Math.sqrt(sym.sessionMinutes)) * Math.sqrt(resMs / 60_000);
}

const SUB_STEPS = 8;

/**
 * Realistic-looking bars: each bar is an 8-step intrabar random walk (so wicks and bodies
 * relate naturally), volatility clusters (AR(1) log-vol), occasional 3σ shocks give fat
 * tails, intraday U-shape for exchange sessions, and volume tracks volatility.
 */
function generateHistory(sym: MockSymbol, resMs: number): Bar[] {
  const seed = [...sym.info.symbol].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 7);
  const rand = mulberry32(seed + resMs);
  const times: number[] = [];
  let t = alignTime(Date.now(), resMs);
  // Long resolutions get a plausible listing history instead of 3000 months.
  const wanted = resMs >= 28 * DAY ? Math.max(24, Math.round((25 * 365 * DAY) / resMs)) : HISTORY_BARS;
  while (times.length < wanted) {
    if (sym.inSession(t, resMs)) times.push(t);
    t -= resMs;
  }
  times.reverse();

  const base = barVol(sym, resMs);
  const PHI = 0.97;
  const VOL_OF_VOL = 0.35;
  let logVol = 0;
  let price = sym.basePrice;
  const raw: Bar[] = [];
  for (const time of times) {
    logVol = PHI * logVol + Math.sqrt(1 - PHI * PHI) * VOL_OF_VOL * gauss(rand);
    const shock = rand() < 0.015 ? 3 : 1;
    const shape = resMs < DAY ? (sym.intradayShape?.(time) ?? 1) : 1;
    const vol = base * Math.exp(logVol - (VOL_OF_VOL * VOL_OF_VOL) / 2) * shock * shape;
    const step = vol / Math.sqrt(SUB_STEPS);
    const open = price;
    let high = open;
    let low = open;
    for (let i = 0; i < SUB_STEPS; i++) {
      price *= Math.exp(step * gauss(rand));
      high = Math.max(high, price);
      low = Math.min(low, price);
    }
    const activity = vol / base;
    raw.push({
      time,
      open,
      high,
      low,
      close: price,
      volume: Math.round(sym.baseVolume * Math.sqrt(resMs / 60_000) * activity * (0.6 + rand() * 0.8) * 100) / 100,
    });
  }

  // Rescale so the newest close sits at the base price, then snap to the tick grid.
  const k = sym.basePrice / price;
  const r = (p: number) => roundToTick(p * k, sym.info.tickSize);
  return raw.map((b) => {
    const open = r(b.open);
    const close = r(b.close);
    return { ...b, open, close, high: Math.max(r(b.high), open, close), low: Math.min(r(b.low), open, close) };
  });
}

export class MockDatafeed implements Datafeed {
  private readonly cache = new Map<string, Bar[]>();

  static symbols(): SymbolInfo[] {
    return Object.values(SYMBOLS).map((s) => s.info);
  }

  async resolveSymbol(symbol: string): Promise<SymbolInfo> {
    const sym = SYMBOLS[symbol];
    if (!sym) throw new Error(`Unknown symbol ${symbol}`);
    return sym.info;
  }

  /** Search hits carry price, daily change and a 30-day sparkline (from the daily history). */
  async searchSymbols(query: string): Promise<SymbolSearchResult[]> {
    const q = query.toLowerCase();
    return Object.values(SYMBOLS)
      .map((s) => s.info)
      .filter((i) => !q || i.name.toLowerCase().includes(q) || i.symbol.toLowerCase().includes(q))
      .map((info) => {
        const daily = this.history(info.symbol, '1D');
        const last = daily[daily.length - 1]!;
        const prev = daily[daily.length - 2] ?? last;
        return {
          ...info,
          price: this.livePrice.get(info.symbol) ?? last.close,
          changePercent: ((last.close - prev.close) / prev.close) * 100,
          sparkline: daily.slice(-30).map((b) => b.close),
        };
      });
  }

  async getBars(symbol: SymbolInfo, resolution: Resolution, req: BarsRequest): Promise<BarsResult> {
    await new Promise((r) => setTimeout(r, NETWORK_DELAY));
    const all = this.history(symbol.symbol, resolution);
    let end = all.length;
    while (end > 0 && all[end - 1]!.time > req.to) end--;
    const count = req.countBack ?? 300;
    const start = Math.max(0, end - count);
    return { bars: all.slice(start, end), noMoreData: start === 0 };
  }

  /** Latest simulated price per symbol, shared by bar ticks and the market bar. */
  private readonly livePrice = new Map<string, number>();

  subscribeBars(
    symbol: SymbolInfo,
    resolution: Resolution,
    onBar: (bar: Bar) => void,
    _onResetCache?: () => void,
    onConnection?: (state: ConnectionState) => void,
  ): () => void {
    // Simulated connection: connected, with a jittery 15–45ms round trip.
    const reportLatency = () => onConnection?.({ status: 'connected', latency: Math.round(15 + Math.random() * 30) });
    onConnection?.({ status: 'connecting' });
    const latencyTimer = setInterval(reportLatency, 5000);
    setTimeout(reportLatency, 300);
    const sym = SYMBOLS[symbol.symbol]!;
    const resMs = resolutionToMs(resolution);
    const rand = Math.random;
    const all = this.history(symbol.symbol, resolution);
    let current = { ...all[all.length - 1]! };
    let ticks = 0;
    // Demo clock compresses a bar into 15 ticks, so each tick carries 1/√15 of a bar's volatility.
    const tickVol = barVol(sym, resMs) / Math.sqrt(15);
    const gaussRand = () => gauss(rand);

    // Demo clock: a new bar every ~3s regardless of resolution, ticks every 200ms.
    const timer = setInterval(() => {
      ticks++;
      if (ticks % 15 === 0) {
        let t = current.time + resMs;
        while (!sym.inSession(t, resMs)) t += resMs;
        current = { time: t, open: current.close, high: current.close, low: current.close, close: current.close, volume: 0 };
      }
      const close = roundToTick(current.close * Math.exp(tickVol * gaussRand()), sym.info.tickSize);
      current = {
        ...current,
        close,
        high: Math.max(current.high, close),
        low: Math.min(current.low, close),
        volume: Math.round(((current.volume ?? 0) + sym.baseVolume * rand() * 0.2) * 100) / 100,
      };
      this.livePrice.set(symbol.symbol, close);
      onBar({ ...current });
    }, 200);
    return () => {
      clearInterval(timer);
      clearInterval(latencyTimer);
    };
  }

  /** Market bar: last price, change vs the previous daily close, today's volume and range. */
  subscribeQuotes(symbol: SymbolInfo, onQuote: (quote: Quote) => void): () => void {
    const daily = this.history(symbol.symbol, '1D');
    const today = daily[daily.length - 1]!;
    const prevClose = daily[daily.length - 2]?.close ?? today.open;
    let high = today.high;
    let low = today.low;
    const emit = () => {
      const price = this.livePrice.get(symbol.symbol) ?? today.close;
      high = Math.max(high, price);
      low = Math.min(low, price);
      onQuote({
        price,
        change: price - prevClose,
        changePercent: ((price - prevClose) / prevClose) * 100,
        high24h: high,
        low24h: low,
        volume24h: today.volume ?? 0,
        turnover24h: (today.volume ?? 0) * price,
      });
    };
    emit();
    const timer = setInterval(emit, 1000);
    return () => clearInterval(timer);
  }

  private history(symbol: string, resolution: Resolution): Bar[] {
    const key = `${symbol}:${resolution}`;
    let bars = this.cache.get(key);
    if (!bars) {
      bars = generateHistory(SYMBOLS[symbol]!, resolutionToMs(resolution));
      this.cache.set(key, bars);
    }
    return bars;
  }
}
