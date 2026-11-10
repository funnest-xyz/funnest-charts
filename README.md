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
| `@funnest/charts-react` | React 래퍼 (`<FnChart />`, `<FnChartSlot />`, `useChartEvent`) + SVG 차트 컴포넌트 |
| `@funnest/charts-viz` | 플랫폼 중립 차트 계산 (스케일, 눈금, SVG 경로). 웹과 React Native가 공유 |
| `@funnest/charts-cli` | `funnest-charts` 명령: JSON 차트 스펙 검사, SVG·PNG·HTML 렌더, 차트 추천, React 코드 생성 |
| `@funnest/charts-mcp` | AI 도구용 MCP 서버 (Claude Code, Cursor 등) |

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

## 차트 컴포넌트 (SVG)

대시보드, 수익률 카드, 관심종목처럼 트레이딩 차트까지는 필요 없는 곳에 씁니다. SSR에 안전합니다.

```tsx
import { LineChart, BarChart, AreaChart, PercentageBarChart, PeriodSelector, ReferenceLine, Point } from '@funnest/charts-react';

<LineChart series={[{ id: 'price', data: prices }]} area="gradient" scrubber onScrubberPositionChange={setIndex}>
  <ReferenceLine dataY={avgPrice} label="평단가" />
  <Point seriesId="price" dataX={prices.length - 1} pulse />
</LineChart>

// 스파크라인 = 축 없는 작은 LineChart
<LineChart series={[{ id: 's', data }]} width={96} height={32} inset={2} />
```

| 컴포넌트 | 용도 |
|---|---|
| `CartesianChart` | 모든 x/y 차트의 기반. 아래 부품을 조합해 직접 구성 |
| `LineChart` · `AreaChart` · `BarChart` | 자주 쓰는 구성 (`stacked`, `legend`, `scrubber`, `showXAxis`, `showYAxis`) |
| `PercentageBarChart` | 비중 막대 (포트폴리오 비중, 매수/매도 체결 강도) |
| `XAxis` · `YAxis` | 축과 격자 |
| `Line` · `Area` · `BarPlot` | 계열 그리기 |
| `Scrubber` | 포인터를 따라가는 선과 점. `onScrubberPositionChange`로 헤더 연동 |
| `ReferenceLine` · `Point` | 평단가·목표가 선, 매수·매도 표시, 실시간 점 (`pulse`) |
| `Legend` · `PeriodSelector` | 범례, 기간 탭 (1주·1개월·3개월…) |

색은 CSS 변수로 바꿉니다: `--fnv-text`, `--fnv-text-muted`, `--fnv-grid`, `--fnv-bg`, `--fnv-accent`.

## AI · CLI · MCP

```bash
npx @funnest/charts-cli render spec.json --out chart.png     # 스펙 → PNG / SVG / HTML / React 코드
claude mcp add funnest-charts -- npx -y @funnest/charts-mcp  # Claude Code에 MCP 서버 추가
```

에이전트용 스킬은 [`skills/funnest-charts/SKILL.md`](skills/funnest-charts/SKILL.md), 요약은 사이트의 `/llms.txt`에 있습니다.
자세한 내용: 문서의 "AI · CLI · MCP".

## 테마

트레이딩 위젯은 기본으로 OS의 라이트/다크 설정을 따르고 바뀌면 즉시 전환합니다 (`colorScheme: 'system'`).
`'light'`·`'dark'`로 고정하거나, `theme`으로 색을 덮어쓸 수 있습니다 (덮어쓴 값은 라이트/다크 전환 후에도 유지).
SVG 차트 컴포넌트는 페이지의 `color-scheme`을 따르고, `--fnv-*` CSS 변수로 바꿀 수 있습니다.

## 차트 로고 (Attribution)

트레이딩 위젯은 차트 왼쪽 아래에 작은 Funnest 로고를 표시합니다 (charts.funnest.xyz 링크).
`attribution: false`로 끌 수 있습니다. 무료로 쓰신다면 켜두시는 것이 프로젝트에 가장 큰 응원이 됩니다.

## 개발

```bash
pnpm install
pnpm dev        # playground (http://localhost:5173)
pnpm site       # 소개 사이트 + 문서 (http://localhost:3100, /docs). 개발 중엔 라이브러리 소스를 바로 읽음
pnpm test:site  # 소개 사이트 빌드 + 화면 테스트
# 하위 경로에 배포할 때: BASE_PATH=/charts pnpm --filter site build  (funnest.xyz/charts)
pnpm test
pnpm typecheck
pnpm build
```
