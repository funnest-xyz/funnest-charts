// Multi-chart demo: split layouts, active pane, crosshair/time/symbol/interval sync.
//   http://localhost:5173/multi.html            (layout from localStorage, else 2×2)
//   http://localhost:5173/multi.html?layout=3-left
import { combineDatafeeds } from '@funnest/charts';
import { createMultiChart, type LayoutId } from '@funnest/charts-ui';
import { UpbitDatafeed } from './datafeeds/upbit';
import { MockDatafeed } from './mock-datafeed';

const datafeed = combineDatafeeds({ DEMO: new MockDatafeed(), UPBIT: new UpbitDatafeed() });
const params = new URLSearchParams(location.search);
const KEY = 'funnest-charts:multi-demo';

const multi = createMultiChart(document.getElementById('chart')!, {
  datafeed,
  colorScheme: 'dark',
  layout: (params.get('layout') as LayoutId | null) ?? '4-grid',
  panes: [
    { symbol: 'DEMO:005930', resolution: '1D' },
    { symbol: 'DEMO:000660', resolution: '1D' },
    { symbol: 'UPBIT:KRW-BTC', resolution: '60' },
    { symbol: 'UPBIT:KRW-ETH', resolution: '60' },
  ],
});
Object.assign(window, { multi });

// Restore the last session unless a layout is forced from the URL, then autosave.
const saved = localStorage.getItem(KEY);
if (saved && !params.has('layout')) void multi.load(JSON.parse(saved)).catch(() => localStorage.removeItem(KEY));
multi.on('stateChange', () => localStorage.setItem(KEY, JSON.stringify(multi.save())));
