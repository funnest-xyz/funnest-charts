---
name: funnest-charts
description: Build financial charts with Funnest Charts (@funnest/charts-*). Use when adding a trading chart (candles, indicators, drawing tools), connecting exchange/broker data through a Datafeed, or drawing dashboard charts (line, area, bar, percentage bar, sparkline) in a React app, or when rendering a chart image from data.
---

# Funnest Charts

Open-source (Apache-2.0) financial charts. Two layers:

| Need | Use |
|---|---|
| A full trading screen: candles, toolbar, symbol search, indicators, drawings, positions/orders | `<FnChart />` from `@funnest/charts-react` (or `createTradingChart` from `@funnest/charts-ui` without React) |
| Dashboard pieces: return cards, watchlists, P&L bars, portfolio weights | SVG components from `@funnest/charts-react`: `LineChart`, `AreaChart`, `BarChart`, `PercentageBarChart`, `CartesianChart` + parts |
| A chart image or quick look at data (no app) | `npx @funnest/charts-cli render spec.json --out chart.png`, or the MCP tool `render_chart` |

Install: `npm i @funnest/charts-react` (React ≥ 18).

## 1. Trading chart

```tsx
import { FnChart } from '@funnest/charts-react';

<div style={{ height: 600 }}>
  <FnChart datafeed={datafeed} symbol="005930" resolution="1D" />
</div>
```

- `symbol`, `resolution`, `locale`, `theme`, `colorScheme` update live; a new `datafeed` recreates the chart.
- `colorScheme`: `'system'` (default, follows OS), `'light'`, `'dark'`.
- `theme={{ up, down }}`: default is Korean (up red `#F04452`, down blue `#3182F6`). Global apps: `{ up: '#12B886', down: '#F04452' }`.
- Slots for app UI: `<FnChartSlot name="toolbar" | "toolbarEnd" | "belowToolbar" | "footer">`.
- Layout persistence: `ref.current.save()` → JSON, `ref.current.load(json)`.
- Events inside `<FnChart>`: `useChartEvent('quoteChange', cb)`, `useChartEvent('symbolChange', cb)`.
- Positions/orders/fills: pass a `TradingAdapter` as `trading`.

### Datafeed (the only thing you must write)

The library never contains exchange code. Implement this interface in the app:

```ts
interface Datafeed {
  resolveSymbol(symbol: string): Promise<SymbolInfo>; // name, exchange, timezone, session, pricePrecision, tickSize, logoUrl
  getBars(info, resolution, { from, to, countBack }): Promise<{ bars: Bar[]; noMoreData: boolean }>; // time = UTC ms
  subscribeBars(info, resolution, onBar, onResetCache?, onConnection?): () => void; // call onBar with the forming bar on every tick
  searchSymbols?(query): Promise<SymbolSearchResult[]>; // enables the search dialog
  subscribeQuotes?(info, onQuote): () => void;
}
```

Helpers in `@funnest/charts`: `ReconnectingWebSocket` (backoff, idle timeout, app-level ping), `TickAggregator` (trades → bars, exchange timezone), `toConnectionStatus`, `combineDatafeeds` (prefix routing like `UPBIT:KRW-BTC`), `monitorLatency`.

Rules that avoid common bugs:
- On WebSocket reconnect call `onResetCache()` so the chart refetches the gap.
- `SymbolInfo.timezone` is the exchange's (e.g. `Asia/Seoul`), so daily bars start at the right local midnight.
- `tickSize` may be a function of price (KRX tick table: `krxTickSize`).
- Always set `logoUrl` when you have logos; the UI falls back to an initial avatar.

Get a starter with the MCP tool `get_datafeed_template` (`rest-websocket`, `polling`, `static`).

## 2. Dashboard components

```tsx
import { LineChart, ReferenceLine, Point } from '@funnest/charts-react';

<LineChart
  series={[{ id: 'price', label: '가격', data: prices }]}   // data[i] lines up with x position i; null = gap
  xAxis={{ data: dates }}
  area="gradient"
  showYAxis
  scrubber={{ showValues: true, valueFormatter: (v) => `${v.toLocaleString()}원` }}
  onScrubberPositionChange={setIndex}                          // drive a big price header
>
  <ReferenceLine dataY={avgPrice} label="평단가" />
  <Point seriesId="price" dataX={prices.length - 1} pulse />
</LineChart>
```

- `AreaChart stacked` for composition; `BarChart getBarColor={(v) => v >= 0 ? up : down}` for P&L.
- `CandlestickChart data={[{ open, high, low, close, volume? }]}` for a small candle chart in a card (use `FnChart` for a full trading screen).
- `DonutChart data={[{ id, label, value }]} totalLabel="총 자산"` for portfolio mix (`innerRadius={0}` = pie).
- `TreemapChart data={[{ id, label, value: marketCap, change: pct }]}` for market maps (`onItemClick` to open a stock).
- `BarChart layout="horizontal"` for rankings / sector returns (categories from `xAxis.data`).
- Ranges: a data point can be `[low, high]` → `Area` draws a band (forecast range), bars float (day low–high).
- Several y axes: `yAxis={[{ id: 'price' }, { id: 'volume' }]}` + `series[].yAxisId`; `<YAxis axisId="price" />`.
- `PercentageBarChart data={[{ id, label, value, color? }]}` for weights / buy-sell pressure; `rows={[{ id, label, data }]}` compares several bars with one legend, `layout="vertical"` for columns.
- Sparkline = `<LineChart height={32} inset={2} strokeWidth={1.5} animate={false} />` (no axes).
- `PeriodSelector periods value onChange` for 1W/1M/1Y tabs; `Legend` with `onItemClick`/`onItemHover`.
- Compose freely with `CartesianChart` + `Line`, `Area`, `BarPlot`, `XAxis`, `YAxis`, `Scrubber`, `ReferenceLine`, `Point`.
- Colors: CSS variables `--fnv-text`, `--fnv-text-muted`, `--fnv-grid`, `--fnv-bg`, `--fnv-accent`. Follows page `color-scheme` by default.
- SSR-safe (Next.js server components can render them inside client boundaries).

## 3. Chart specs (CLI / MCP)

A JSON spec describes one chart; it renders with the same components:

```json
{ "type": "line", "data": [{ "date": "2026-11-03", "price": 71200 }], "x": "date", "y": "price",
  "area": "gradient", "format": { "suffix": "원" }, "referenceLines": [{ "y": 71000, "label": "평단가" }] }
```

Types: `line`, `area` (`stacked`), `bar` (`colorBySign`, `layout: 'horizontal'`), `percentage-bar` (`label`, `value`), `sparkline`.

```bash
npx @funnest/charts-cli list
npx @funnest/charts-cli info bar                 # fields, example, React code
npx @funnest/charts-cli validate spec.json       # exits 1, with "did you mean" hints
npx @funnest/charts-cli render spec.json --out chart.png --theme dark --scale 2
npx @funnest/charts-cli render spec.json --out Chart.tsx   # React code for the same chart
npx @funnest/charts-cli suggest data.csv --out-dir charts
```

Workflow for agents: `get_chart_schema` → write spec → `validate_spec` → `render_chart` (look at the PNG) → paste the returned React code into the app.
