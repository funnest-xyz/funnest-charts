import type { Metadata } from 'next';
import { Callout, Code, DocHeader, NextLinks, P, Props } from '../../../components/docs';

export const metadata: Metadata = { title: '트레이딩 차트' };

export default function TradingChartDoc() {
  return (
    <article className="doc">
      <DocHeader
        category="시작하기"
        title="트레이딩 차트"
        lead="캔들 차트에 툴바, 심볼 검색, 지표, 그리기 도구, 차트 설정까지 붙은 완성형 위젯이에요. 이 사이트 첫 화면의 차트가 바로 이 컴포넌트예요."
      />

      <h2>React</h2>
      <Code>{`
import { FnChart } from '@funnest/charts-react';

<FnChart
  datafeed={myDatafeed}
  symbol="005930"
  resolution="1D"
  style={{ height: 600 }}
/>`}</Code>
      <P>
        <code>symbol</code>, <code>resolution</code>, <code>locale</code>, <code>theme</code>, <code>colorScheme</code>는 바꾸면 바로 반영돼요.
        <code>datafeed</code>가 바뀌면 차트를 새로 만들어요.
      </P>

      <h2>React 없이</h2>
      <Code>{`
import { createTradingChart } from '@funnest/charts-ui';

const widget = createTradingChart(document.getElementById('chart')!, {
  datafeed: myDatafeed,
  symbol: '005930',
});

widget.setSymbol('000660');
widget.destroy();`}</Code>

      <h2>주요 옵션</h2>
      <Props
        rows={[
          { name: 'datafeed', type: 'Datafeed', desc: '과거 봉, 실시간 봉, 종목 검색을 주는 객체.' },
          { name: 'symbol', type: 'string', desc: '처음 보여줄 종목.' },
          { name: 'resolution', type: 'string', def: "'1D'", desc: "봉 단위. '1', '5', '60', '1D', '1W' 등." },
          { name: 'colorScheme', type: "'light' | 'dark' | 'system'", def: "'system'", desc: 'OS 설정을 따르거나 고정.' },
          { name: 'theme', type: 'Partial<ThemeTokens>', desc: '색·글꼴 덮어쓰기. 라이트/다크 전환 후에도 유지.' },
          { name: 'locale', type: "'ko' | 'en'", def: "'ko'", desc: 'UI 언어. ko면 시간은 한국 시간(KST)으로.' },
          { name: 'chartType', type: "'candles' | 'line' | 'area' …", def: "'candles'", desc: '처음 차트 종류.' },
          { name: 'favoriteIntervals', type: 'Resolution[]', desc: '툴바에 바로 보일 봉 단위. 사용자가 ★로 바꿔요.' },
          { name: 'storageKey', type: 'string | null', def: "'funnest-charts'", desc: '즐겨찾기·최근 검색 저장 키. null이면 저장 안 함.' },
          { name: 'symbolLogo', type: 'boolean', def: 'true', desc: 'SymbolInfo.logoUrl 로고 표시(없으면 이니셜).' },
          { name: 'drawingToolbar', type: 'boolean', def: 'true', desc: '왼쪽 그리기 도구 막대.' },
          { name: 'attribution', type: 'boolean', def: 'true', desc: '왼쪽 아래 작은 Funnest 로고.' },
          { name: 'trading', type: 'TradingAdapter', desc: '평단가, 주문, 체결 내역을 차트에 표시.' },
        ]}
      />

      <h2>슬롯: 내 UI 끼워 넣기</h2>
      <P>위젯 안의 정해진 자리에 내 컴포넌트를 넣을 수 있어요. 위젯의 색 변수(--fnc-*)를 그대로 물려받아요.</P>
      <Props
        rows={[
          { name: 'toolbar', type: 'HTMLElement', desc: '툴바에서 봉 단위 버튼 바로 뒤(시세 정보 등).' },
          { name: 'toolbarEnd', type: 'HTMLElement', desc: '툴바 오른쪽 끝, 설정(톱니바퀴) 옆. 아이콘 버튼용.' },
          { name: 'belowToolbar', type: 'HTMLElement', desc: '툴바 아래 한 줄 전체.' },
          { name: 'footer', type: 'HTMLElement', desc: '차트 아래 한 줄 전체(연결 상태 등).' },
        ]}
      />
      <Code title="이 사이트 첫 화면의 라이트/다크 버튼">{`
import { FnChart, FnChartSlot } from '@funnest/charts-react';

const [scheme, setScheme] = useState<'dark' | 'light'>('dark');

<FnChart datafeed={feed} symbol="005930" colorScheme={scheme}>
  <FnChartSlot name="toolbarEnd">
    <button className="fnc-btn" onClick={() => setScheme(scheme === 'dark' ? 'light' : 'dark')}>
      {scheme === 'dark' ? '☀' : '☾'}
    </button>
  </FnChartSlot>
</FnChart>`}</Code>

      <h2>레이아웃 저장과 복원</h2>
      <P>종목, 봉 단위, 차트 종류, 설정, 지표, 그리기가 하나의 JSON으로 저장돼요. 사용자 계정에 저장해두고 다음에 그대로 열 수 있어요.</P>
      <Code>{`
const ref = useRef<TradingChart>(null);

<FnChart ref={ref} datafeed={feed} symbol="005930" />

const state = ref.current!.save();    // JSON으로 저장
await ref.current!.load(state);       // 그대로 복원`}</Code>

      <h2>이벤트</h2>
      <Code>{`
import { useChartEvent } from '@funnest/charts-react';

// FnChart 안쪽 컴포넌트에서
useChartEvent('quoteChange', (quote) => setPrice(quote.price));
useChartEvent('symbolChange', (info) => setTitle(info.name));`}</Code>

      <Callout>무료로 쓰신다면 왼쪽 아래 로고(attribution)를 켜두시는 게 프로젝트에 가장 큰 응원이 돼요.</Callout>

      <NextLinks
        items={[
          { href: '/docs/datafeed/', title: '데이터 연결', desc: 'Datafeed 만들기와 실시간 연결' },
          { href: '/docs/theming/', title: '테마', desc: '라이트/다크, 상승·하락 색' },
        ]}
      />
    </article>
  );
}
