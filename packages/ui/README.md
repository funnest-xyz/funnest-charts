# @funnest/charts-ui

툴바·심볼 검색·지표·그리기 도구가 있는 트레이딩 차트 위젯

Full trading chart widget (toolbar, symbol search, indicators, drawing tools). Framework-free.

```bash
npm i @funnest/charts-ui
```

```ts
import { createTradingChart } from '@funnest/charts-ui';

const widget = createTradingChart(document.getElementById('chart')!, {
  datafeed: myDatafeed,
  symbol: '005930',
  resolution: '1D',
  colorScheme: 'system', // OS 라이트/다크 설정을 따라요
});
```

- 프레임워크와 상관없이 동작해요. React는 `@funnest/charts-react`의 `<FnChart />`를 쓰세요.
- 슬롯(`toolbar`, `toolbarEnd`, `belowToolbar`, `footer`)으로 내 UI를 끼워 넣어요.
- `save()` / `load()`로 레이아웃(지표, 그리기, 설정)을 JSON으로 저장·복원해요.

## 링크

- 문서: https://charts.funnest.xyz/docs/
- GitHub: https://github.com/funnest-xyz/charts
- 라이선스: Apache-2.0
