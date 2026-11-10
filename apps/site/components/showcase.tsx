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
const won = (v: number) => `${fmt(v)}원`;
const man = (v: number) => `${fmt(v)}만`;

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
  const data = useMemo(() => walk(7, 60, 52_000, 0.035, 0.002).map(Math.round), []);
  return <LineChart series={[{ id: 'p', data, color: UP }]} height={H} inset={6} area="gradient" scrubber={{ showValues: true, valueFormatter: won }} xAxis={{ data: dayLabels(60) }} />;
}

export function SparklineDemo() {
  const rows = useMemo(
    () =>
      [
        { name: '삼성전자', logo: '/logos/005930.png', seed: 11, start: 71_000, drift: 0.003 },
        { name: 'NAVER', logo: '/logos/035420.png', seed: 47, start: 181_000, drift: -0.002 },
        { name: '애플', logo: '/logos/AAPL.png', seed: 61, start: 232, drift: 0.002 },
        { name: '이더리움', logo: '/logos/ETH.png', seed: 13, start: 3_400, drift: -0.003 },
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
  const series = useMemo(
    () => [
      { id: 'kr', label: '국내주식', data: walk(3, 11, 400, 0.08, 0.02).map(Math.round) },
      { id: 'us', label: '해외주식', data: walk(9, 11, 300, 0.08, 0.03).map(Math.round) },
      { id: 'crypto', label: '코인', data: walk(13, 11, 150, 0.2, 0.03).map(Math.round) },
    ],
    [],
  );
  const months = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월'];
  return <AreaChart series={series} stacked height={H} inset={6} strokeWidth={1.5} xAxis={{ data: months }} scrubber={{ showValues: true, valueFormatter: man, dimFuture: false }} />;
}

export function BarChartDemo() {
  const data = useMemo(() => {
    const r = rng(5);
    return Array.from({ length: 20 }, () => Math.round((r() - 0.42) * 900) * 1000);
  }, []);
  const labels = dayLabels(20);
  return (
    <BarChart
      series={[{ id: 'pnl', label: '손익', data }]}
      height={H}
      inset={6}
      radius={2}
      xAxis={{ data: labels }}
      getBarColor={(v) => (v >= 0 ? UP : DOWN)}
      scrubber={{ showValues: true, valueFormatter: (v) => `${v > 0 ? '+' : ''}${fmt(v)}원` }}
    >
      <ReferenceLine dataY={0} dash="" />
    </BarChart>
  );
}

export function PercentageBarDemo() {
  return (
    <div className="stack-gap">
      <PercentageBarChart
        barHeight={14}
        data={[
          { id: 'buy', label: '매수', value: 62.4, color: UP },
          { id: 'sell', label: '매도', value: 37.6, color: DOWN },
        ]}
      />
      <PercentageBarChart
        barHeight={14}
        data={[
          { id: 'kr', label: '국내', value: 42 },
          { id: 'us', label: '해외', value: 31 },
          { id: 'crypto', label: '코인', value: 17 },
          { id: 'cash', label: '현금', value: 10, color: '#B0B8C1' },
        ]}
      />
    </div>
  );
}

/** Line + volume bars + axis composed by hand. */
export function CartesianDemo() {
  const price = useMemo(() => walk(21, 30, 70_000, 0.03, 0.002).map(Math.round), []);
  const volume = useMemo(() => {
    const r = rng(8);
    // Volume drawn in the bottom band of the price scale.
    return price.map(() => Math.round(r() * 5_000 + 64_000));
  }, [price]);
  return (
    <CartesianChart
      series={[
        { id: 'vol', label: '거래량', data: volume, color: 'color-mix(in srgb, var(--text-3) 35%, transparent)' },
        { id: 'price', label: '가격', data: price, color: VIOLET },
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
      <Scrubber seriesIds={['price']} showValues valueFormatter={(v) => won(v)} />
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
  const data = useMemo(() => walk(4, 30, 98_000, 0.03, 0.002), []);
  return (
    <LineChart
      series={[{ id: 'p', data, color: VIOLET }]}
      height={H}
      inset={{ top: 10, right: 6, bottom: 10, left: 6 }}
      showYAxis={{ width: 52, showLine: true, tickLabelFormatter: (v) => fmt(v) }}
      yAxis={{ nice: true }}
      strokeWidth={1.5}
      scrubber={{ showValues: true, valueFormatter: (v) => fmt(v), dimFuture: false, label: () => '' }}
    />
  );
}

/** Header follows the scrubber; optional period tabs switch the range. */
export function ScrubberDemo({ withPeriods = false }: { withPeriods?: boolean }) {
  const PERIODS: Period[] = [
    { id: '1W', label: '1주' },
    { id: '1M', label: '1개월' },
    { id: '3M', label: '3개월' },
    { id: '1Y', label: '1년' },
  ];
  const DAYS: Record<string, number> = { '1W': 7, '1M': 30, '3M': 90, '1Y': 365 };
  const [period, setPeriod] = useState('3M');
  const [index, setIndex] = useState<number | null>(null);
  const full = useMemo(() => walk(7, 365, 52_000, 0.035, 0.0012).map(Math.round), []);
  const n = DAYS[period]!;
  const data = full.slice(-n);
  const labels = useMemo(() => dayLabels(n), [n]);
  const change = seriesChange(data, index ?? data.length - 1)!;
  const color = dirColor(change.change);
  return (
    <div className="price-card">
      <div className="price-head">
        <SymbolLogo src="/logos/005930.png" size={36} />
        <div>
          <strong className="price-value">{won(change.last)}</strong>
          <span className="price-change" style={{ color }}>
            {change.change > 0 ? '+' : ''}
            {fmt(change.change)}원 ({pct(change.percent)})
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
        scrubber
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
  const data = useMemo(() => walk(19, 60, 68_000, 0.03, 0.001).map(Math.round), []);
  return (
    <CartesianChart
      series={[{ id: 'p', label: '가격', data, color: 'var(--text)' }]}
      yAxis={{ domain: { max: Math.max(...data, 71_000) + 400 } }}
      height={H}
      inset={{ top: 14, right: 8, bottom: 8, left: 8 }}
      enableScrubbing
    >
      <Line seriesId="p" curve="linear" strokeWidth={1.5} />
      <ReferenceLine dataY={69_500} label="평단가 69,500" labelPosition="left" color={VIOLET} />
      <ReferenceLine dataY={71_000} label="목표가 71,000" labelPosition="left" color={UP} />
      <Scrubber showValues valueFormatter={(v) => `${won(v)} (평단 ${pct(((v - 69_500) / 69_500) * 100)})`} dimFuture={false} label={() => ''} />
    </CartesianChart>
  );
}

export function PointDemo() {
  const data = useMemo(() => walk(19, 60, 68_000, 0.03, 0.001).map(Math.round), []);
  const [picked, setPicked] = useState<number | null>(null);
  const trades = [
    { x: 12, side: '매수', color: UP, pos: 'bottom' as const },
    { x: 31, side: '매수', color: UP, pos: 'bottom' as const },
    { x: 47, side: '매도', color: DOWN, pos: 'top' as const },
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
          label={picked === t.x ? `${t.side} ${won(data[t.x]!)}` : t.side}
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
  const [hidden, setHidden] = useState<string[]>([]);
  const [hovered, setHovered] = useState<string | null>(null);
  const toggle = (id: string) => setHidden((h) => (h.includes(id) ? h.filter((x) => x !== id) : [...h, id]));
  // Hovering a legend item fades the other lines.
  const shown = all
    .filter((s) => !hidden.includes(s.id))
    .map((s) => ({ ...s, color: hovered && hovered !== s.id ? `color-mix(in srgb, ${s.color} 25%, transparent)` : s.color }));
  return (
    <div>
      <Legend
        shape="line"
        items={all.map((s) => ({ id: s.id, label: s.label, color: s.color, inactive: hidden.includes(s.id) }))}
        onItemClick={toggle}
        onItemHover={setHovered}
      />
      {/* Fixed range so toggling a series doesn't rescale the others. */}
      <LineChart series={shown} yAxis={{ domain: range }} height={H - 30} inset={6} strokeWidth={1.5} scrubber={{ showValues: true, dimFuture: false, label: () => '' }} />
    </div>
  );
}

export function PeriodSelectorDemo() {
  return <ScrubberDemo withPeriods />;
}
