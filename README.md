# Funnest Charts

TradingView Pro 수준의 UI/UX를 내 서비스에 그대로 녹여 쓸 수 있는 오픈소스 금융 차트 라이브러리.

- 같은 DOM에서 동작 (iframe 아님). 디자인 토큰 하나로 배경, 폰트, 상승·하락 색을 서비스에 맞춤
- 평단가, 주문 라인, 체결 마커 같은 매매 연동 API 기본 제공
- 데스크톱과 모바일 제스처 기본 지원
- 국내 주식, 해외 주식, 코인 (Datafeed 어댑터)
- Apache-2.0

> 🚧 개발 초기 단계입니다. 설계는 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)를 참고하세요.

## 패키지

| 패키지 | 설명 |
|---|---|
| `@funnest/charts` | Canvas 엔진 (의존성 0) |
| `@funnest/charts-ui` | 툴바, 그리기 도구, 설정 UI (프레임워크 무관) |
| `@funnest/charts-react` | React 래퍼 (`<FnChart />`, `<FnChartSlot />`, `useChartEvent`) |

## React

```tsx
import { FnChart, FnChartSlot } from '@funnest/charts-react';

<FnChart ref={chartRef} datafeed={myDatafeed} symbol="005930" resolution="1D" style={{ height: 600 }}>
  <FnChartSlot name="toolbar"><MyMarketStats /></FnChartSlot>
</FnChart>;

// 레이아웃 저장/복원
const state = chartRef.current.save();
await chartRef.current.load(state);
```

라이브러리에는 특정 거래소·증권사 연결 코드가 없습니다. `Datafeed` 인터페이스를 구현해 연결하세요 ([docs/REALTIME.md](docs/REALTIME.md), 예시: `apps/playground/src/datafeeds/`).

## 개발

```bash
pnpm install
pnpm dev        # playground (http://localhost:5173)
pnpm test
pnpm typecheck
pnpm build
```
