'use client';

import {
  AreaChart,
  BarChart,
  BarPlot,
  CartesianChart,
  Legend,
  Line,
  LineChart,
  PercentageBarChart,
  PeriodSelector,
  Point,
  ReferenceLine,
  Scrubber,
  YAxis,
  type Period,
} from '@funnest/charts-react';
import { seriesChange } from '@funnest/charts-viz';
import { useMemo, useState } from 'react';
import { asset } from '../lib/base';
import { useLang } from './locale';

// Korean convention: up = red, down = blue.
export const UP = '#F04452';
export const DOWN = '#3182F6';
const VIOLET = '#6C4DFF';

/** Every chart preview on the page uses this height, so cards line up. */
const H = 170;

/** Deterministic PRNG so the server-rendered HTML matches the client. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function walk(seed: number, n: number, start: number, vol: number, drift = 0) {
  const r = rng(seed);
  const out: number[] = [];
  let p = start;
  for (let i = 0; i < n; i++) {
    p *= 1 + drift + (r() - 0.5) * vol;
    out.push(Math.round(p * 100) / 100);
  }
  return out;
}

const fmt = (v: number, digits = 0) => v.toLocaleString('ko-KR', { maximumFractionDigits: digits, minimumFractionDigits: digits });
const pct = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(2)}%`;
const dirColor = (v: number) => (v > 0 ? UP : v < 0 ? DOWN : 'var(--text-3)');
/** Demo strings per page language. */
const S = {
  ko: {
    samsung: '삼성전자', apple: '애플', ether: '이더리움',
    kr: '국내주식', us: '해외주식', crypto: '코인', cash: '현금',
    krShort: '국내', usShort: '해외', pnl: '손익', buy: '매수', sell: '매도', volume: '거래량', price: '가격',
    avg: '평단가', target: '목표가', vsAvg: '평단',
    months: ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월'],
    periods: ['1주', '1개월', '3개월', '1년'],
    live: '실시간',
    won: (v: number) => `${fmt(v)}원`,
    man: (v: number) => `${fmt(v)}만`,
  },
  en: {
    samsung: 'Samsung Electronics', apple: 'Apple', ether: 'Ethereum',
    kr: 'KR stocks', us: 'US stocks', crypto: 'Crypto', cash: 'Cash',
    krShort: 'KR', usShort: 'US', pnl: 'P&L', buy: 'Buy', sell: 'Sell', volume: 'Volume', price: 'Price',
    avg: 'Avg', target: 'Target', vsAvg: 'vs avg',
    months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov'],
    periods: ['1W', '1M', '3M', '1Y'],
    live: 'Live',
    won: (v: number) => `₩${fmt(v)}`,
    // Values are in 10k KRW (만원): show millions of won.
    man: (v: number) => `₩${(v / 100).toLocaleString('en-US', { maximumFractionDigits: 1 })}M`,
  },
};
const useT = () => S[useLang()];

export function SymbolLogo({ src, size = 36 }: { src: string; size?: number }) {
  return <img className="symbol-logo" src={asset(src)} alt="" width={size} height={size} loading="lazy" />;
}

function dayLabels(n: number) {
  const end = Date.UTC(2026, 10, 10);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(end - (n - 1 - i) * 86_400_000);
    return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
  });
}

// ── Component previews (one per component card) ─────────────

export function LineChartDemo() {
  const { won } = useT();
  const data = useMemo(() => walk(7, 60, 52_000, 0.035, 0.002).map(Math.round), []);
  const hi = data.indexOf(Math.max(...data));
  const lo = data.indexOf(Math.min(...data));
  return (
    <LineChart
      series={[{ id: 'p', data }]}
      height={H}
      inset={{ top: 18, right: 6, bottom: 18, left: 6 }}
      area="gradient"
      baseline={data[0]!}
      xAxis={{ data: dayLabels(60) }}
      points={(i) => (i === hi ? { label: won(data[i]!) } : i === lo ? { label: won(data[i]!), labelPosition: 'bottom' } : false)}
      scrubber={{ beaconLabels: (v) => won(v), idlePulse: true }}
    >
      <ReferenceLine dataY={data[0]!} dash="2 3" />
    </LineChart>
  );
}

export function SparklineDemo() {
  const t = useT();
  const rows = useMemo(
    () =>
      [
        { name: t.samsung, logo: '/logos/005930.png', seed: 11, start: 71_000, drift: 0.003 },
        { name: 'NAVER', logo: '/logos/035420.png', seed: 47, start: 181_000, drift: -0.002 },
        { name: t.apple, logo: '/logos/AAPL.png', seed: 61, start: 232, drift: 0.002 },
        { name: t.ether, logo: '/logos/ETH.png', seed: 13, start: 3_400, drift: -0.003 },
      ].map((r) => ({ ...r, data: walk(r.seed, 40, r.start, 0.03, r.drift) })),
    [],
  );
  return (
    <ul className="mini-list">
      {rows.map((r) => {
        const c = seriesChange(r.data)!;
        const color = dirColor(c.change);
        return (
          <li key={r.name}>
            <SymbolLogo src={r.logo} size={28} />
            <b>{r.name}</b>
            <LineChart series={[{ id: 's', data: r.data, color }]} height={28} inset={3} strokeWidth={1.5} animate={false} scrubber={{ label: () => '', dimFuture: true }} />
            <em style={{ color }}>{pct(c.percent)}</em>
          </li>
        );
      })}
    </ul>
  );
}

export function AreaChartDemo() {
  const t = useT();
  const series = useMemo(
    () => [
      { id: 'kr', label: t.kr, data: walk(3, 11, 400, 0.08, 0.02).map(Math.round) },
      { id: 'us', label: t.us, data: walk(9, 11, 300, 0.08, 0.03).map(Math.round) },
      { id: 'crypto', label: t.crypto, data: walk(13, 11, 150, 0.2, 0.03).map(Math.round) },
    ],
    [],
  );
  const months = t.months;
  return (
    <AreaChart
      series={series}
      stacked
      height={H - 28}
      inset={6}
      strokeWidth={1.5}
      xAxis={{ data: months }}
      legend={{ position: 'bottom', interactive: true, shape: 'pill' }}
      scrubber={{ showValues: true, valueFormatter: t.man, dimFuture: false }}
    />
  );
}

export function BarChartDemo() {
  const t = useT();
  const data = useMemo(() => {
    const r = rng(5);
    return Array.from({ length: 20 }, () => Math.round((r() - 0.42) * 900) * 1000);
  }, []);
  const labels = dayLabels(20);
  return (
    <BarChart
      series={[{ id: 'pnl', label: t.pnl, data }]}
      height={H}
      inset={6}
      radius={2}
      xAxis={{ data: labels }}
      getBarColor={(v) => (v >= 0 ? UP : DOWN)}
      scrubber={{ showValues: true, valueFormatter: (v) => `${v > 0 ? '+' : ''}${t.won(v)}` }}
    >
      <ReferenceLine dataY={0} dash="" />
    </BarChart>
  );
}

export function PercentageBarDemo() {
  const t = useT();
  return (
    <div className="stack-gap">
      <PercentageBarChart
        barHeight={14}
        data={[
          { id: 'buy', label: t.buy, value: 62.4, color: UP },
          { id: 'sell', label: t.sell, value: 37.6, color: DOWN },
        ]}
      />
      <PercentageBarChart
        barHeight={14}
        data={[
          { id: 'kr', label: t.krShort, value: 42 },
          { id: 'us', label: t.usShort, value: 31 },
          { id: 'crypto', label: t.crypto, value: 17 },
          { id: 'cash', label: t.cash, value: 10, color: '#B0B8C1' },
        ]}
      />
    </div>
  );
}

/** Line + volume bars + axis composed by hand. */
export function CartesianDemo() {
  const t = useT();
  const price = useMemo(() => walk(21, 30, 70_000, 0.03, 0.002).map(Math.round), []);
  const volume = useMemo(() => {
    const r = rng(8);
    // Volume drawn in the bottom band of the price scale.
    return price.map(() => Math.round(r() * 5_000 + 64_000));
  }, [price]);
  return (
    <CartesianChart
      series={[
        { id: 'vol', label: t.volume, data: volume, color: 'color-mix(in srgb, var(--text-3) 35%, transparent)' },
        { id: 'price', label: t.price, data: price, color: VIOLET },
      ]}
      xAxis={{ scaleType: 'band', bandPadding: 0.35, data: dayLabels(30) }}
      yAxis={{ domain: { min: 64_000 } }}
      height={H}
      inset={6}
      enableScrubbing
    >
      <BarPlot seriesIds={['vol']} radius={1} />
      <Line seriesId="price" strokeWidth={2} />
      <YAxis width={40} tickLabelFormatter={(v) => `${Math.round(v / 1000)}k`} />
      <Scrubber seriesIds={['price']} showValues valueFormatter={(v) => t.won(v)} />
    </CartesianChart>
  );
}

export function XAxisDemo() {
  const data = useMemo(() => walk(2, 30, 100, 0.04, 0.003), []);
  return (
    <LineChart
      series={[{ id: 'p', data, color: VIOLET }]}
      height={H}
      inset={{ top: 18, right: 12, bottom: 4, left: 12 }}
      xAxis={{ data: dayLabels(30) }}
      showXAxis={{ showLine: true, showTickMarks: true, showGrid: true, minTickSpacing: 60 }}
      strokeWidth={1.5}
      scrubber={{ dimFuture: false }}
    />
  );
}

export function YAxisDemo() {
  // Ten years of a fast grower: a log axis keeps early moves readable.
  const data = useMemo(() => walk(4, 120, 120, 0.09, 0.05), []);
  return (
    <LineChart
      series={[{ id: 'p', data, color: VIOLET }]}
      height={H}
      inset={{ top: 10, right: 6, bottom: 10, left: 6 }}
      showYAxis={{ width: 56, showLine: true, tickLabelFormatter: (v) => fmt(v) }}
      yAxis={{ scaleType: 'log' }}
      strokeWidth={1.5}
      scrubber={{ showValues: true, valueFormatter: (v) => fmt(v), hideOverlay: true, label: () => '' }}
    />
  );
}

/** Header follows the scrubber; optional period tabs switch the range. */
export function ScrubberDemo({ withPeriods = false }: { withPeriods?: boolean }) {
  const t = useT();
  const PERIODS: Period[] = [
    ...(withPeriods ? [{ id: 'LIVE', label: t.live, live: true }] : []),
    { id: '1W', label: t.periods[0]! },
    { id: '1M', label: t.periods[1]! },
    { id: '3M', label: t.periods[2]! },
    { id: '1Y', label: t.periods[3]! },
  ];
  const DAYS: Record<string, number> = { LIVE: 2, '1W': 7, '1M': 30, '3M': 90, '1Y': 365 };
  const [period, setPeriod] = useState('3M');
  const [index, setIndex] = useState<number | null>(null);
  const full = useMemo(() => walk(7, 365, 52_000, 0.035, 0.0012).map(Math.round), []);
  // Live: today's 5-minute prices from the open (09:00) up to now, ending at the latest close.
  const intraday = useMemo(() => {
    const last = full[full.length - 1]!;
    const steps = walk(91, 72, 1000, 0.006); // start high enough that 2-decimal rounding stays smooth
    const end = steps[steps.length - 1]!;
    return steps.map((v) => Math.round((last * v) / end));
  }, [full]);
  const live = period === 'LIVE';
  const n = DAYS[period]!;
  const data = live ? intraday : full.slice(-n);
  const labels = useMemo(
    () =>
      live
        ? intraday.map((_, i) => {
            const m = 9 * 60 + i * 5;
            return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
          })
        : dayLabels(n),
    [live, intraday, n],
  );
  const change = seriesChange(data, index ?? data.length - 1)!;
  const color = dirColor(change.change);
  return (
    <div className="price-card">
      <div className="price-head">
        <SymbolLogo src="/logos/005930.png" size={36} />
        <div>
          <strong className="price-value">{t.won(change.last)}</strong>
          <span className="price-change" style={{ color }}>
            {change.change > 0 ? '+' : change.change < 0 ? '-' : ''}
            {t.won(Math.abs(change.change))} ({pct(change.percent)})
            <em>{index === null ? '' : ` · ${labels[index]}`}</em>
          </span>
        </div>
      </div>
      <LineChart
        series={[{ id: 'price', data, color }]}
        height={withPeriods ? 104 : 130}
        inset={{ top: 16, bottom: 4, left: 4, right: 4 }}
        xAxis={{ data: labels }}
        area="gradient"
        scrubber={{ idlePulse: true }}
        onScrubberPositionChange={setIndex}
      >
        <ReferenceLine dataY={data[0]!} dash="2 3" />
      </LineChart>
      {withPeriods && (
        <PeriodSelector periods={PERIODS} value={period} onChange={(p) => (setPeriod(p), setIndex(null))} fullWidth activeColor={color} />
      )}
    </div>
  );
}

export function ReferenceLineDemo() {
  const t = useT();
  const data = useMemo(() => walk(19, 60, 68_000, 0.03, 0.001).map(Math.round), []);
  return (
    <CartesianChart
      series={[{ id: 'p', label: t.price, data, color: 'var(--text)' }]}
      yAxis={{ domain: { max: Math.max(...data, 71_000) + 400 } }}
      height={H}
      inset={{ top: 14, right: 8, bottom: 8, left: 8 }}
      enableScrubbing
    >
      <Line seriesId="p" curve="linear" strokeWidth={1.5} />
      <ReferenceLine dataY={69_500} label={`${t.avg} 69,500`} labelPosition="left" labelStyle="pill" labelAlign="center" color={VIOLET} />
      <ReferenceLine dataY={71_000} label={`${t.target} 71,000`} labelPosition="right" labelStyle="pill" labelAlign="center" color={UP} />
      <Scrubber showValues valueFormatter={(v) => `${t.won(v)} (${t.vsAvg} ${pct(((v - 69_500) / 69_500) * 100)})`} dimFuture={false} label={() => ''} />
    </CartesianChart>
  );
}

export function PointDemo() {
  const tr = useT();
  const data = useMemo(() => walk(19, 60, 68_000, 0.03, 0.001).map(Math.round), []);
  const [picked, setPicked] = useState<number | null>(null);
  const trades = [
    { x: 12, side: tr.buy, color: UP, pos: 'bottom' as const },
    { x: 31, side: tr.buy, color: UP, pos: 'bottom' as const },
    { x: 47, side: tr.sell, color: DOWN, pos: 'top' as const },
  ];
  return (
    <CartesianChart series={[{ id: 'p', data, color: 'var(--text)' }]} height={H} inset={{ top: 18, right: 12, bottom: 20, left: 8 }}>
      <Line seriesId="p" curve="linear" strokeWidth={1.5} />
      {trades.map((t) => (
        <Point
          key={t.x}
          seriesId="p"
          dataX={t.x}
          color={t.color}
          radius={picked === t.x ? 6 : 4}
          label={picked === t.x ? `${t.side} ${tr.won(data[t.x]!)}` : t.side}
          labelPosition={t.pos}
          onClick={() => setPicked((p) => (p === t.x ? null : t.x))}
        />
      ))}
      <Point seriesId="p" dataX={data.length - 1} pulse color={VIOLET} />
    </CartesianChart>
  );
}

export function LegendDemo() {
  const all = useMemo(
    () =>
      [
        { id: 'ma5', label: 'MA 5', period: 5, color: '#F59E0B' },
        { id: 'ma20', label: 'MA 20', period: 20, color: '#14B8A6' },
        { id: 'ma60', label: 'MA 60', period: 60, color: VIOLET },
      ].map(({ period, ...s }) => {
        const price = walk(1, 160, 100, 0.04, 0.003);
        // Simple moving average over the last 100 bars.
        const data = price.slice(60).map((_, i) => {
          const win = price.slice(60 + i - period + 1, 60 + i + 1);
          return Math.round((win.reduce((a, b) => a + b, 0) / win.length) * 100) / 100;
        });
        return { ...s, data };
      }),
    [],
  );
  const range = useMemo(() => {
    const values = all.flatMap((s) => s.data);
    return { min: Math.min(...values), max: Math.max(...values) };
  }, [all]);
  return (
    // Fixed range so toggling a series doesn't rescale the others.
    <LineChart
      series={all}
      yAxis={{ domain: range }}
      height={H}
      inset={6}
      strokeWidth={1.5}
      legend={{ position: 'top', interactive: true, shape: 'line' }}
      scrubber={{ showValues: true, dimFuture: false, label: () => '' }}
    />
  );
}

export function PeriodSelectorDemo() {
  return <ScrubberDemo withPeriods />;
}
