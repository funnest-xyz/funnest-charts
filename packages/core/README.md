# @funnest/charts

Canvas 차트 엔진 — 캔들, 지표, 실시간 연결 도구

Canvas charting engine for financial charts: candles, indicators, realtime helpers.

```bash
npm i @funnest/charts
```

UI 없이 엔진만 쓸 때의 패키지예요. 툴바·검색·지표 UI까지 필요하면 `@funnest/charts-ui`(또는 React는 `@funnest/charts-react`)를 쓰세요.

```ts
import { createChart } from '@funnest/charts';

const chart = createChart(document.getElementById('chart')!, { datafeed: myDatafeed });
await chart.setSymbol('005930', '1D');
```

- 지표: MA, EMA, 볼린저 밴드, RSI, MACD
- 실시간 도구: `ReconnectingWebSocket`, `TickAggregator`, `combineDatafeeds`, `monitorLatency`
- 한국 시장 기본값: KST, KRX 장 시간·호가 단위(`krxTickSize`), 빨강 상승/파랑 하락
- 거래소 연결 코드는 들어 있지 않아요. `Datafeed` 인터페이스로 직접 연결하세요.

## 링크

- 문서: https://charts.funnest.xyz/docs/
- GitHub: https://github.com/funnest-xyz/funnest-charts
- 라이선스: Apache-2.0
