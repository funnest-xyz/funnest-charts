import { formatPrice, type ChartState, type Quote } from '@funnest/charts';
import { FnChart, FnChartSlot, useChartEvent, useFnChart, type TradingChart } from '@funnest/charts-react';
import { StrictMode, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MockDatafeed } from './mock-datafeed';

/** A React component living in the widget's toolbar slot, fed by chart events. */
function PriceBadge() {
  const widget = useFnChart();
  const [quote, setQuote] = useState<Quote | null>(null);
  useChartEvent('quoteChange', setQuote);
  useChartEvent('symbolChange', () => setQuote(null));
  const info = widget?.chart.symbolInfo;
  if (!quote?.price || !info) return null;
  const up = (quote.changePercent ?? 0) >= 0;
  return (
    <span className="react-badge" style={{ color: up ? 'var(--fnc-up)' : 'var(--fnc-down)' }}>
      {formatPrice(quote.price, info.pricePrecision)} {up ? '+' : ''}
      {quote.changePercent?.toFixed(2)}%
    </span>
  );
}

function App() {
  const datafeed = useMemo(() => new MockDatafeed(), []);
  const [symbol, setSymbol] = useState('005930');
  const chartRef = useRef<TradingChart | null>(null);
  const [saved, setSaved] = useState<ChartState | null>(null);
  const [log, setLog] = useState('');

  return (
    <div className="react-page">
      <nav className="devbar">
        <span className="devbar-title">@funnest/charts-react</span>
        {['005930', '000660', 'BTCUSDT'].map((s) => (
          <button key={s} id={`sym-${s}`} aria-pressed={s === symbol} onClick={() => setSymbol(s)}>
            {s}
          </button>
        ))}
        <button id="save" onClick={() => (setSaved(chartRef.current!.save()), setLog('저장됨'))}>
          레이아웃 저장
        </button>
        <button id="load" disabled={!saved} onClick={() => saved && chartRef.current!.load(saved).then(() => setLog('복원됨'))}>
          복원
        </button>
        <span id="log">{log}</span>
      </nav>
      <FnChart ref={chartRef} datafeed={datafeed} symbol={symbol} resolution="1D" style={{ flex: 1, minHeight: 0 }}>
        <FnChartSlot name="toolbar">
          <PriceBadge />
        </FnChartSlot>
      </FnChart>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
