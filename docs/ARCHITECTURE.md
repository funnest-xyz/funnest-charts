# Funnest Charts 아키텍처

> 상태: 초안 v0.1 (2026-11-09)

## 1. 비전

**"TradingView Pro 수준의 UI/UX를, 내 서비스의 일부처럼 녹여 쓸 수 있는 오픈소스 금융 차트"**

| | UI/UX | 내 서비스 테마 적용 | 매매 연동 | 사용 조건 |
|---|---|---|---|---|
| TradingView Lightweight | 캔버스만 (툴바 없음) | 높음 | 직접 구현 | 무료 |
| KLineChart | 중간 | 중간 | 직접 구현 | 무료 |
| TradingView Advanced Charts | 높음 | 낮음 (iframe) | 제한적 | **법인 신청·승인 필요** |
| TradingView Trading Platform | 높음 | 낮음 (iframe) | 가능 | 유료 라이선스 |
| **Funnest Charts** | **높음** | **높음 (같은 DOM, 디자인 토큰)** | **기본 제공** | **누구나 (Apache-2.0)** |

대상 사용자: 개인 개발자, AI로 자동매매·주식 프로그램을 만드는 사람, 스타트업, 거래소, 증권사

## 2. 확정된 결정

| 항목 | 결정 |
|---|---|
| 라이선스 | Apache-2.0 |
| 코어 | TypeScript, Canvas 2D, 런타임 의존성 0 |
| UI 레이어 | 내부는 Preact로 구현, 외부에는 Vanilla API만 노출 (Vue, Svelte, 순수 HTML에서도 사용 가능) |
| 프레임워크 래퍼 | React부터 제공 |
| 디자인 | 토스증권 계열: 깔끔함, 넉넉한 여백, 둥근 모서리, 부드러운 색 |
| 모바일 | **처음부터 지원** (Pointer Events로 마우스와 터치를 하나로 처리) |
| 시장 | 국내 주식, 해외 주식, 코인 전부 (Datafeed 어댑터로 추상화) |
| 스타일링 | 배포 패키지에서 Tailwind 같은 CSS 프레임워크 미사용. CSS 변수와 `.fnc-` prefix 사용 |

TradingView의 사용성 수준은 목표로 하지만, 화면을 그대로 복제하지 않는다. 시각적 정체성은 Funnest Charts만의 것으로 만든다.

## 3. 패키지 구조

```
packages/
  core/     @funnest/charts   Canvas 엔진. UI 없이 단독으로도 사용 가능
  ui/       @funnest/charts-ui     툴바, 그리기 도구, 설정 시트 (내부 Preact)
  react/    @funnest/charts-react  <FnChart /> 래퍼 + SVG 차트 컴포넌트 (LineChart, BarChart …)
  viz/      @funnest/charts-viz    SVG 차트용 순수 계산 (스케일, 눈금, 경로). DOM 없음 → React Native 공유
apps/
  playground/                 개발용 데모 (Vite). 거래소 어댑터 예시 포함, 배포 안 함
  site/                       charts.funnest.xyz 소개 사이트 (Next.js 정적 export)
brand/                        로고, 색상 가이드
docs/
```

UI를 원하는 수준만큼 골라 쓸 수 있다.
1. **완성형**: `<FnChart />` 또는 `createTradingChart(el)` 하나로 전체 UI가 나온다.
2. **부분 교체**: 슬롯과 오버라이드로 툴바 등을 자기 컴포넌트로 바꾼다.
3. **엔진만 사용**: `@funnest/charts`만 쓰고 상태·명령 API로 UI를 직접 만든다.

### 3.1 UI 배치 (TradingView 표준 동선 + 토스 톤의 시각 스타일)

| 위치 | 구성 |
|---|---|
| 상단 툴바 왼쪽 | 종목(로고 + 이름) 검색 버튼 → 시간 단위 칩(모바일은 "5분 ▾" 드롭다운) → 차트 종류(캔들, 라인, 영역) → 지표 |
| 지표 | 가격 위: 이동평균선, 지수이동평균, 볼린저밴드 / 별도 영역: RSI, MACD. 범례 행을 누르면 설정(기간 변경, 삭제). 계산 함수(sma, ema, rsi, macd, bollinger)는 core에서 export되어 전략 코드에서도 재사용 가능 |
| 상단 툴바 가운데 | **슬롯** (`slots.toolbar`): 사이트가 시세·통계 등을 끼워 넣는 자리 |
| 상단 툴바 오른쪽 | 스크린샷, 전체화면 |
| 툴바 아래 / 차트 아래 | **슬롯** (`slots.belowToolbar`, `slots.footer`). 비어 있으면 자리를 차지하지 않음 |
| 차트 왼쪽 위 | 범례: 종목 · 시간 단위 · 거래소, 시가·고가·저가·종가, 등락, 거래량. 범례 높이만큼 가격 영역을 비워 캔들을 가리지 않음 |
| 차트 하단 가운데 | 마우스 오버 시 축소, 확대, 이전, 다음, 초기화 (터치 기기에서는 숨김) |
| 차트 오른쪽 아래 | 과거로 스크롤했을 때만 "최신으로" 버튼 |
| 왼쪽 세로 바 | 그리기 도구: 커서, 추세선, 수평선, 피보나치, 모두 삭제. 그린 뒤 선택하면 위쪽에 색상·삭제 바 표시 |

모바일: 종목 검색은 전체 화면 시트, 시간 단위 칩은 가로 스크롤(오른쪽 끝 페이드), 스크린샷 버튼 숨김, 그리기 바는 툴바의 연필 버튼으로 열고 도구를 고르면 자동으로 닫힘. 선택 바는 하단에 표시.

실시간(WebSocket) 연결은 [REALTIME.md](REALTIME.md) 참고.

> **원칙**: 라이브러리에는 특정 거래소·증권사 API 연결 코드를 넣지 않는다. 인터페이스(`Datafeed`, `TradingAdapter`)와 거래소를 모르는 범용 도구(`ReconnectingWebSocket`, `TickAggregator`, `combineDatafeeds`, `monitorLatency`)만 core에 둔다. 업비트·바이낸스 연결 예시는 `apps/playground/src/datafeeds/`에 있고 배포되지 않는다.

## 4. Core 엔진

```
Chart
 ├─ DataLayer      Datafeed → BarStore (정렬된 배열, 지연 로딩, 실시간 병합)
 ├─ Model
 │   ├─ TimeScale    인덱스 기반 X축 (장 마감 구간은 빈 공간 없이 이어짐), barSpacing, rightOffset
 │   └─ Pane[]       메인 / 거래량 / (추후) 보조지표
 │        └─ PriceScale  보이는 구간 기준 자동 스케일, 정밀도·호가 단위
 ├─ Renderer       차트 전체에 Canvas 2개 (Pane은 clip 영역으로 구분)
 │   ├─ main         그리드, 시리즈, 축, 최고·최저 표시, 그리기 도구, 매매 라인
 │   └─ overlay      크로스헤어와 축 배지 (포인터 이동 시 이 레이어만 다시 그림)
 ├─ Scheduler      requestAnimationFrame 단위로 갱신을 모음. 레이어별 dirty 플래그
 └─ Interaction    Pointer Events와 제스처 인식 (아래 6장)
```

원칙
- 실시간 틱이 여러 개 들어와도 한 프레임에 한 번만 그린다. 그래서 초당 1틱이든 1000틱이든 그리는 비용이 같다.
- 화면에 보이는 봉만 순회한다.
- devicePixelRatio를 반영하고, 1px 선은 픽셀 경계에 정렬해서 그린다.
- 가격은 소수점 오차를 피하기 위해 정밀도·호가 단위 연산을 정수 기반 유틸로 처리한다.

## 5. 데이터 계약

```ts
interface Bar { time: number /* UTC ms, 봉 시작 시각 */; open; high; low; close; volume? }

interface SymbolInfo {
  symbol; name; exchange;
  timezone;          // 'Asia/Seoul'
  session;           // 장 시간 (24시간 거래 시장은 '24x7')
  pricePrecision;    // 표시 소수 자릿수
  tickSize;          // 최소 호가 단위 (국내 주식처럼 가격대별 단위면 함수로 지정)
}

interface Datafeed {
  resolveSymbol(symbol): Promise<SymbolInfo>
  getBars(symbol, resolution, { from, to, countBack }): Promise<{ bars; noMoreData }>
  subscribeBars(symbol, resolution, onBar): Unsubscribe
}
```

- `onBar`로 들어온 봉의 time이 마지막 봉과 같으면 **update**, 더 크면 **append**로 처리한다.
- 업비트, 바이낸스, 한국투자증권 같은 거래소 어댑터는 별도 패키지로 나중에 제공한다.

## 6. 모바일과 인터랙션

| 동작 | 데스크톱 | 모바일 |
|---|---|---|
| 이동 (pan) | 드래그 | 한 손가락 드래그 (관성 스크롤 포함) |
| 확대·축소 | 휠 / Ctrl+휠 | 핀치 |
| 크로스헤어 | 마우스 오버 | **길게 누르기**, 이후 드래그로 이동 |
| 가격축 스케일 | 축 드래그 | 축 드래그 |
| 리셋 | 더블클릭 | 더블탭 |
| 그리기 도구 | 클릭으로 점 지정 | 탭으로 지정, 돋보기로 정밀 위치 확인 |

- 페이지 세로 스크롤과 충돌하지 않게 처리한다. 가로 제스처는 차트가 처리하고 세로 제스처는 페이지로 넘긴다 (`touch-action` 정책).
- 터치 영역은 최소 44px.
- UI는 화면 크기에 따라 바뀐다. 데스크톱은 상단 툴바와 좌측 그리기 도구 바, 모바일은 하단 시트와 축약 툴바를 쓴다.

## 7. 테마 (디자인 토큰)

하나의 토큰 세트가 Canvas와 DOM을 함께 칠한다. 토큰 값에 CSS 변수(`var(--x)`)를 쓰면 Canvas에서 실제 색상 값으로 변환해 적용하므로, 서비스의 다크모드 전환을 그대로 따라간다.

- 상승·하락 색 프리셋: `kr` (상승 빨강, 하락 파랑), `global` (상승 초록, 하락 빨강)
- 기본 폰트: Pretendard → 시스템 폰트 순으로 대체

## 8. 매매 연동 (TradingAdapter)

사용자의 계좌 데이터(체결내역, 평단가, 미체결 주문)는 **사이트 개발자가 어댑터로 연결**하고, **불러오기·동기화·표시·조작은 차트가** 맡는다. 인증이나 증권사·거래소별 API는 사이트마다 다르기 때문에 라이브러리가 대신 가져오지 않는다.

```ts
createTradingChart(el, { datafeed, trading: {
  getExecutions: (symbol, { from, to }) => api.fills(symbol.symbol, from, to), // 종목 로드할 때, 과거로 스크롤할 때 자동 호출
  getPositions:  (symbol) => api.positions(symbol.symbol),                    // 평단가 라인 + 실시간 평가손익
  getOrders:     (symbol) => api.orders(symbol.symbol),                       // 주문 라인
  subscribe:     (symbol, { onExecution, onPositions, onOrders }) => ws.listen(...),
  modifyOrder:   (order, price) => api.modify(order.id, price),  // 있으면 주문 라인을 끌어서 정정 (false를 반환하면 원래 가격으로 복귀)
  cancelOrder:   (order) => api.cancel(order.id),                // 있으면 주문 라인에 × 버튼 표시
}});
```

- 종목을 바꾸면 이전 종목의 응답과 구독은 버린다(토큰 방식). 체결은 `id`로 중복을 제거한다.
- 체결 마커는 같은 봉·같은 방향끼리 묶어 건수를 표시하고, 마우스를 올리거나 탭하면 툴팁(체결가 또는 평균가, 수량, 시각)이 나온다.
- 어댑터 없이 직접 그리는 저수준 API(`addPositionLine`, `addOrderLine`, `setExecutions`)도 그대로 쓸 수 있다.

## 9. 상태 저장 (JSON)

차트 상태 전체를 `chart.save()`(또는 `widget.save()`)로 내보내고 `load(json)`으로 복원한다. 사용자에게는 레이아웃 저장 기능이고, AI에게는 JSON만 만들면 차트를 구성할 수 있는 인터페이스다.

- 포함: 종목, 시간 단위, 차트 종류, 차트 설정(`ChartSettings`), 지표(줄별 스타일 포함), **종목별 그리기**, 보이는 구간(확대 정도, 오른쪽 여백)
- 그리기는 종목에 속한다. 종목을 바꾸면 이전 종목의 그리기는 보관되고 새 종목의 그리기가 나타난다.
- `load()`는 저장소에서 읽은 JSON을 검증한다(`parseChartState`, `version: 1`). 형식이 다르면 예외.
- 자동 저장: `stateChange` 이벤트(틱 단위로 묶임)마다 `save()` 결과를 저장하면 된다. 서버 저장 여부는 사이트가 결정한다.

## 9-1. 차트 설정

`ChartSettings`: 최고·최저 표시, 현재가 선, 거래량, 가로·세로 격자, 상승·하락 색(null이면 테마 색). 위젯 툴바의 ⚙ 차트 설정 창에서 즉시 반영되며 `기본값으로`로 되돌린다.

## 10. 1차 출시 범위 (v0.1)

포함
- 캔들 차트 (그 다음 순서로 라인, 영역 차트)
- 거래량 Pane
- 툴바: 종목 표시, 시간 단위, 차트 타입, 설정, 전체화면
- 그리기 도구: 추세선, 수평선, 피보나치 되돌림
- 매매 연동: 평단가 라인, 주문 라인 (드래그로 정정)
- 테마 (라이트, 다크, 커스텀 토큰), kr/global 상승·하락 색
- 데스크톱과 모바일 인터랙션 전체
- 저장과 복원

제외 (v0.2 이후)
- 지표 추가 확장 (스토캐스틱, 일목균형표 등), Pane 높이 드래그 조절
- 거래소 어댑터 패키지
- 멀티 차트 레이아웃, 비교 차트, 로그 스케일

## 11. 품질 기준

- 성능: 봉 1만 개를 60fps로 이동·확대. 실시간 틱 1000건/초에서도 프레임 드랍 없음
- 테스트: 로직은 Vitest, 렌더링 결과는 Playwright 스크린샷 비교, 모바일 제스처는 Playwright 터치 에뮬레이션
- 번들 크기 목표 (gzip): core 40KB 이하, ui 60KB 이하
