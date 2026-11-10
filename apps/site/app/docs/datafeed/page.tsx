import type { Metadata } from 'next';
import { Callout, Code, DocHeader, NextLinks, Props } from '../../../components/docs';

export const metadata: Metadata = { title: '데이터 연결' };

export default function DatafeedDoc() {
  return (
    <article className="doc">
      <DocHeader
        category="시작하기"
        title="데이터 연결"
        lead="차트는 Datafeed 인터페이스로 데이터를 받아요. 어떤 거래소·증권사든 이 몇 개의 함수만 구현하면 연결돼요."
      />

      <h2>Datafeed 인터페이스</h2>
      <Props
        rows={[
          { name: 'resolveSymbol', type: '(symbol) => Promise<SymbolInfo>', desc: '종목 정보: 이름, 거래소, 시간대, 장 시간, 호가 단위, 로고.' },
          { name: 'getBars', type: '(info, resolution, { from, to, countBack }) => Promise<{ bars, noMoreData }>', desc: '과거 봉. 왼쪽으로 스크롤하면 더 오래된 구간을 다시 요청해요.' },
          { name: 'subscribeBars', type: '(info, resolution, onBar, onResetCache?, onConnection?) => unsubscribe', desc: '실시간 봉. 틱마다 현재 봉을 onBar로 넘겨요.' },
          { name: 'searchSymbols', type: '(query) => Promise<SymbolSearchResult[]>', desc: '선택. 종목 검색 창을 켜요.' },
          { name: 'subscribeQuotes', type: '(info, onQuote) => unsubscribe', desc: '선택. 현재가·등락률 같은 시세.' },
        ]}
      />

      <h2>예시: REST + WebSocket</h2>
      <Code title="my-datafeed.ts">{`
import {
  ReconnectingWebSocket,
  TickAggregator,
  toConnectionStatus,
  type Datafeed,
} from '@funnest/charts';

export const myDatafeed: Datafeed = {
  async resolveSymbol(symbol) {
    return {
      symbol,
      name: '삼성전자',
      exchange: 'KRX',
      timezone: 'Asia/Seoul',
      session: '0900-1530',
      pricePrecision: 0,
      tickSize: 100,
      logoUrl: '/logos/005930.png',
    };
  },

  async getBars(info, resolution, { to, countBack }) {
    const res = await fetch(\`/api/candles?symbol=\${info.symbol}&res=\${resolution}&to=\${to}&count=\${countBack}\`);
    const bars = await res.json(); // [{ time, open, high, low, close, volume }]
    return { bars, noMoreData: bars.length === 0 };
  },

  subscribeBars(info, resolution, onBar, onResetCache, onConnection) {
    const candles = new TickAggregator(resolution, info.timezone);
    const ws = new ReconnectingWebSocket('wss://example.com/ws', {
      onOpen: (socket, reconnected) => {
        socket.send(JSON.stringify({ subscribe: info.symbol }));
        if (reconnected) onResetCache?.(); // 끊긴 동안 빠진 봉을 다시 받아요
      },
      onMessage: (data) => {
        const trade = JSON.parse(data); // { time, price, volume }
        const bar = candles.push(trade);
        if (bar) onBar(bar);
      },
      onStatus: (s) => onConnection?.({ status: toConnectionStatus(s) }),
    });
    return () => ws.close();
  },
};`}</Code>

      <h2>실시간 도구</h2>
      <Props
        rows={[
          { name: 'ReconnectingWebSocket', type: 'class', desc: '끊기면 점점 간격을 늘려 다시 연결. 응답 없는 연결 감지(idleTimeout), 지연 측정(ping).' },
          { name: 'TickAggregator', type: 'class', desc: '체결(틱)을 봉으로 묶어요. 거래소 시간대 기준 일봉.' },
          { name: 'combineDatafeeds', type: 'function', desc: '여러 datafeed를 접두어(UPBIT:, BINANCE:)로 묶어 하나처럼.' },
          { name: 'monitorLatency', type: 'function', desc: 'REST로 지연 시간을 주기적으로 측정.' },
        ]}
      />

      <Callout>
        라이브러리는 바이낸스·업비트 같은 실제 거래소 연결 코드를 넣지 않아요. 저장소의 <code>apps/playground/src/datafeeds/</code>에 예시가
        있으니 참고해서 직접 만드세요.
      </Callout>

      <NextLinks items={[{ href: '/docs/theming/', title: '테마', desc: '라이트/다크, 상승·하락 색' }]} />
    </article>
  );
}
