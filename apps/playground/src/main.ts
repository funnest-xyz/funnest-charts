import type { Locale } from '@funnest/charts';
import { combineDatafeeds } from '@funnest/charts';
import { createTradingChart } from '@funnest/charts-ui';
import { createDemoAccount } from './demo-account';
import { BinanceDatafeed } from './datafeeds/binance';
import { UpbitDatafeed } from './datafeeds/upbit';
import { MockDatafeed } from './mock-datafeed';
import { mountMarketBar } from './site/market-bar';
import './site/site.css';
import { mountStatusBar } from './site/status-bar';

const $ = (id: string) => document.getElementById(id)!;

// One chart, three sources: demo data, Upbit (trade ticks → bars) and Binance (kline stream).
const datafeed = combineDatafeeds({
  DEMO: new MockDatafeed(),
  UPBIT: new UpbitDatafeed(),
  BINANCE: new BinanceDatafeed(),
  // USDⓈ-M perpetual futures: adds open interest and funding to the market bar.
  BINANCEF: new BinanceDatafeed({ market: 'usdm', symbols: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT'] }),
});

// Page theme follows the OS (light/dark) until the user flips the toggle.
const darkQuery = matchMedia('(prefers-color-scheme: dark)');
const setPageTheme = (dark: boolean) => {
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  $('theme').textContent = dark ? '라이트' : '다크';
};
setPageTheme(darkQuery.matches);
darkQuery.addEventListener('change', (e) => setPageTheme(e.matches));

const params = new URLSearchParams(location.search);
const widget = createTradingChart($('chart'), {
  datafeed,
  symbol: params.get('symbol') ?? 'DEMO:005930',
  resolution: params.get('resolution') ?? '1D',
  // Host CSS variables: the widget follows the page's [data-theme] switch automatically.
  theme: {
    background: 'var(--bg)',
    surface: 'var(--surface)',
    text: 'var(--text)',
    textSecondary: 'var(--text-2)',
    grid: 'var(--grid)',
    border: 'var(--border)',
    crosshair: 'var(--text-2)',
    up: 'var(--up)',
    down: 'var(--down)',
    fontFamily: "'Pretendard Variable', Pretendard, -apple-system, sans-serif",
  },
});
const { chart } = widget;
// Site-only UI plugged into the widget slots (market stats, status line).
mountMarketBar(widget);
mountStatusBar(widget, { timeZone: 'Asia/Seoul', zoneLabel: 'KST' });
Object.assign(window, { widget, chart });
chart.on('error', (e) => console.error(e));

// Layout persistence: the whole chart state (symbol, interval, type, settings, indicators,
// per-symbol drawings, view) autosaves on every meaningful change and restores on reload.
// A real site would store this per user on its server instead of localStorage.
const LAYOUT_KEY = 'fnc-layout';
const savedLayout = localStorage.getItem(LAYOUT_KEY);
const restore = savedLayout && !params.has('symbol') ? widget.load(JSON.parse(savedLayout)) : Promise.resolve();
void restore
  .catch((e: unknown) => console.warn('Ignoring incompatible saved layout', e))
  .finally(() => {
    if (!savedLayout) chart.addIndicator('ma');
    chart.on('stateChange', () => localStorage.setItem(LAYOUT_KEY, JSON.stringify(widget.save())));
  });

// ── Demo controls ─────────────────────────────────────────────────────

$('theme').onclick = () => setPageTheme(document.documentElement.dataset.theme !== 'dark');

let kr = true;
$('direction').onclick = (e) => {
  kr = !kr;
  const s = document.documentElement.style;
  s.setProperty('--up', kr ? '#f04452' : '#12b886');
  s.setProperty('--down', kr ? '#3182f6' : '#f04452');
  (e.currentTarget as HTMLElement).textContent = kr ? '상승 빨강' : '상승 초록';
};

let locale: Locale = 'ko';
$('locale').onclick = (e) => {
  locale = locale === 'ko' ? 'en' : 'ko';
  widget.setLocale(locale);
  (e.currentTarget as HTMLElement).textContent = locale === 'ko' ? '한국어' : 'English';
};

// Trading demo: a fake account implementing TradingAdapter (fills, average price, orders).
const toast = (text: string) => {
  const el = $('toast');
  el.textContent = text;
  el.dataset.show = 'true';
  clearTimeout(Number(el.dataset.timer));
  el.dataset.timer = String(setTimeout(() => (el.dataset.show = 'false'), 1800));
};
const demoAccount = createDemoAccount(() => chart.bars, toast);
let tradingOn = false;
$('trading').onclick = (e) => {
  tradingOn = !tradingOn;
  chart.setTradingAdapter(tradingOn ? demoAccount : null);
  (e.currentTarget as HTMLElement).textContent = tradingOn ? '매매 데모 끄기' : '매매 데모';
};
