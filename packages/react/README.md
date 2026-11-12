# @funnest/charts-react

React bindings for Funnest Charts: the `<FnChart />` trading chart plus SVG line, area and bar charts.

```bash
npm i @funnest/charts-react
```

Trading chart:

```tsx
import { FnChart } from '@funnest/charts-react';

<div style={{ height: 600 }}>
  <FnChart datafeed={myDatafeed} symbol="AAPL" resolution="1D" />
</div>
```

Dashboard charts (SSR-safe):

```tsx
import { LineChart, ReferenceLine } from '@funnest/charts-react';

<LineChart series={[{ id: 'price', data: prices }]} area="gradient" scrubber={{ showValues: true }}>
  <ReferenceLine dataY={avgPrice} label="Avg. price" />
</LineChart>
```

Components: `LineChart`, `AreaChart`, `BarChart`, `PercentageBarChart`, `CartesianChart`, `XAxis`, `YAxis`, `Scrubber`, `ReferenceLine`, `Point`, `Legend`, `PeriodSelector`

## Links

- Docs: https://charts.funnest.xyz/docs/
- GitHub: https://github.com/funnest-xyz/funnest-charts ([한국어](https://github.com/funnest-xyz/funnest-charts/blob/main/README.ko.md))
- License: Apache-2.0
