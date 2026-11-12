# @funnest/charts-ui

The full trading chart widget: toolbar, symbol search, indicators and drawing tools. Framework-free.

```bash
npm i @funnest/charts-ui
```

```ts
import { createTradingChart } from '@funnest/charts-ui';

const widget = createTradingChart(document.getElementById('chart')!, {
  datafeed: myDatafeed,
  symbol: 'AAPL',
  resolution: '1D',
  colorScheme: 'system', // follows the OS light/dark setting
});
```

- Works with any framework. In React, use `<FnChart />` from `@funnest/charts-react`.
- Put your own UI into slots: `toolbar`, `toolbarEnd`, `belowToolbar`, `footer`.
- `save()` / `load()` keep the layout (indicators, drawings, settings) as JSON.
- English by default, Korean for a Korean browser; replace any word with the `strings` option.

## Links

- Docs: https://charts.funnest.xyz/docs/
- GitHub: https://github.com/funnest-xyz/funnest-charts ([한국어](https://github.com/funnest-xyz/funnest-charts/blob/main/README.ko.md))
- License: Apache-2.0
