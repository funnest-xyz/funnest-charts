# 실시간(WebSocket) 데이터 연결 가이드

대부분의 사용자는 거래소나 증권사의 WebSocket으로 실시간 데이터를 받는다. Funnest Charts는 WS 연결을 직접 관리하지 않는다. 대신 **Datafeed 어댑터 하나**만 구현하면 나머지는 차트가 처리하도록 설계했다.

```
거래소 REST ──getBars()──────────┐
                                 ├─▶ Chart (병합, 프레임 단위 렌더링, 과거 데이터 로딩, 재연결 후 보정)
거래소 WS ───subscribeBars()─────┘
```

## 1. 라이브러리가 주는 것과 주지 않는 것

라이브러리에는 특정 거래소·증권사 연결 코드가 **없다**. 어느 거래소를 쓸지, 인증을 어떻게 할지는 서비스마다 다르기 때문이다. 라이브러리는 다음만 제공한다.

| 제공 | 내용 |
|---|---|
| 인터페이스 | `Datafeed` (과거 데이터, 실시간 구독, 시세, 연결 상태), `TradingAdapter` (체결, 평단가, 주문) |
| 범용 도구 (`@funnest/charts`) | `ReconnectingWebSocket`, `TickAggregator`, `bucketStart`, `combineDatafeeds`, `monitorLatency` |

실제 연결 예시는 저장소의 `apps/playground/src/datafeeds/`에 있다. 그대로 복사해서 시작해도 되지만 배포 패키지에는 포함되지 않는다.

| 예시 | 과거 데이터 | 실시간 | 특징 |
|---|---|---|---|
| `upbit.ts` | REST 캔들 (요청당 200개, 자동 반복 요청) | `trade` 스트림을 `TickAggregator`로 봉으로 변환 | 한글 종목명, 로고, KRW 호가 단위, REST 요청 시간으로 지연 측정 |
| `binance.ts` | REST klines (현물 1000개 / 선물 1500개) | `@kline_<interval>` 스트림 (완성된 봉) | 30초 동안 메시지가 없으면 재연결, 선물은 미체결약정·펀딩비, WS 왕복 시간으로 지연 측정 |

## 2. 직접 어댑터 만들기 (증권사 API, 자체 서버 등)

WS가 보내는 데이터는 두 가지 중 하나다.

**A. 봉(캔들) 단위로 오는 경우** (바이낸스 kline 등): 받은 봉을 그대로 `onBar`에 넘긴다.

**B. 체결(틱) 단위로 오는 경우** (업비트 trade, 증권사 체결가 등): `TickAggregator`로 묶어서 넘긴다.

```ts
import { ReconnectingWebSocket, TickAggregator, type Datafeed } from '@funnest/charts';

const feed: Datafeed = {
  resolveSymbol: async (symbol) => ({ /* 종목 정보: 이름, 타임존, 호가 단위, 정밀도 */ }),
  getBars: async (info, resolution, { to, countBack }) => ({ bars: await fetchCandles(...), noMoreData }),

  subscribeBars(info, resolution, onBar, onResetCache) {
    // 봉 경계 기준이 되는 타임존: 거래소의 일봉이 시작되는 시각 기준 (업비트·바이낸스 = UTC, KRX = Asia/Seoul)
    const agg = new TickAggregator(resolution, 'Asia/Seoul');
    agg.seed(lastHistoricalBar);              // 아직 끝나지 않은 마지막 봉을 이어서 갱신

    const socket = new ReconnectingWebSocket(url, {
      onOpen(ws, reconnected) {
        ws.send(subscribeMessage(info.symbol));  // 재연결될 때마다 구독을 다시 보냄
        if (reconnected) onResetCache?.();       // 끊긴 동안 빠진 봉을 차트가 다시 받아옴
      },
      onMessage(text) {
        const t = JSON.parse(text);
        const bar = agg.push({ time: t.ts, price: t.price, volume: t.qty });
        if (bar) onBar(bar);
      },
    });
    return () => socket.close();
  },
};
```

## 3. 실시간 데이터에서 자주 생기는 문제와 대응

| 문제 | 대응 | 담당 |
|---|---|---|
| 초당 수백~수천 건의 메시지 | `onBar`를 아무리 자주 불러도 화면은 프레임당 한 번만 그린다. 직접 쓰로틀링할 필요 없음 | Chart |
| 연결 끊김 | 지수 백오프와 지터로 무한 재연결, 네트워크(`online`)가 복구되면 즉시 재시도 | `ReconnectingWebSocket` |
| 연결은 살아 있는데 데이터가 멈춤 | `idleTimeout`: 일정 시간 메시지가 없으면 강제로 재연결. 서버 응답을 기다리지 않고 바로 끊고 다시 붙음 | `ReconnectingWebSocket` |
| 끊긴 동안 빠진 봉 | `onResetCache()`를 부르면 차트가 최근 구간을 다시 받아 병합(merge)한다. 사용자가 보던 화면 위치는 유지됨 | Chart |
| 늦게 도착한 메시지 (이미 끝난 봉의 갱신) | 같은 시각의 봉이 있으면 그 봉을 고친다. 없는 과거 시각이면 무시 | Chart (`BarStore.upsert`) |
| 이미 끝난 봉에 속하는 틱 | `TickAggregator`가 무시한다(`null` 반환). 정확한 값은 재연결 후 보정으로 맞춰짐 | `TickAggregator` |
| 종목이나 시간 단위를 바꾸는 중에 이전 데이터가 도착 | 요청마다 토큰을 붙여 이전 응답과 구독을 버린다 | Chart |
| 사용자가 과거 구간을 보는 중에 새 봉이 추가됨 | 화면이 따라 움직이지 않고 그대로 유지. "최신으로" 버튼이 나타남 | Chart, UI |
| 봉 경계 시간대 (DST, 인도처럼 30분 단위 시차) | `bucketStart(time, resolution, timeZone)`이 거래소 타임존 기준으로 계산 | core |

## 4. 아직 하지 않은 것 (예정)

- **연결 상태 표시 UI**: 어댑터에는 `onStatus`(connecting / open / reconnecting / closed)가 이미 있다. 툴바에 "실시간 연결 끊김" 배지로 표시하는 것은 다음 작업이다.
- **WS 연결 하나로 여러 차트 공유하기**: 차트를 여러 개 띄울 때 필요하다.
- **Web Worker**: JSON 파싱이 아주 많은 경우 WS 처리를 Worker로 옮기는 옵션.
