# @funnest/charts

Canvas charting engine for financial charts: candles, indicators and realtime helpers.

```bash
npm i @funnest/charts
```

This is the engine alone, with no UI. For the toolbar, symbol search and indicator UI, use `@funnest/charts-ui` (or `@funnest/charts-react` in React).

```ts
import { createChart } from '@funnest/charts';

const chart = createChart(document.getElementById('chart')!, { datafeed: myDatafeed });
await chart.setSymbol('AAPL', '1D');
```

- Indicators: MA, EMA, Bollinger Bands, RSI, MACD
- Realtime helpers: `ReconnectingWebSocket`, `TickAggregator`, `combineDatafeeds`, `monitorLatency`
- Speaks your user's language: English, or Korean for a Korean browser, with matching up/down colors (green-up globally, red-up in Korea)
- Korean market defaults when it's Korean: KST, KRX sessions and tick sizes (`krxTickSize`)
- No exchange code inside. Connect any exchange or broker through the `Datafeed` interface.

## Links

- Docs: https://charts.funnest.xyz/docs/
- GitHub: https://github.com/funnest-xyz/funnest-charts ([한국어](https://github.com/funnest-xyz/funnest-charts/blob/main/README.ko.md))
- License: Apache-2.0
