# @funnest/charts-react

React용 트레이딩 차트와 SVG 차트 컴포넌트

React bindings: the <FnChart /> trading chart plus SVG line, area and bar charts.

```bash
npm i @funnest/charts-react
```

트레이딩 차트:

```tsx
import { FnChart } from '@funnest/charts-react';

<div style={{ height: 600 }}>
  <FnChart datafeed={myDatafeed} symbol="005930" resolution="1D" />
</div>
```

대시보드 차트(SSR 안전):

```tsx
import { LineChart, ReferenceLine } from '@funnest/charts-react';

<LineChart series={[{ id: 'price', data: prices }]} area="gradient" scrubber={{ showValues: true }}>
  <ReferenceLine dataY={avgPrice} label="평단가" />
</LineChart>
```

컴포넌트: `LineChart`, `AreaChart`, `BarChart`, `PercentageBarChart`, `CartesianChart`, `XAxis`, `YAxis`, `Scrubber`, `ReferenceLine`, `Point`, `Legend`, `PeriodSelector`

## 링크

- 문서: https://charts.funnest.xyz/docs/
- GitHub: https://github.com/funnest-xyz/funnest-charts
- 라이선스: Apache-2.0
