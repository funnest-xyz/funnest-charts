import type { Metadata } from 'next';
import { pageMeta } from '../../../../lib/meta';
import { Callout, Code, DocHeader, NextLinks, P, Props } from '../../../../components/docs';

export const metadata: Metadata = pageMeta('docs-trading-chart', '트레이딩 차트', '툴바, 심볼 검색, 지표, 그리기 도구까지 들어 있는 FnChart 트레이딩 차트 사용법.');

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
          { name: 'bottom', type: 'HTMLElement', desc: '차트 바로 아래, 그리기 도구 막대 오른쪽(잔고·포지션 패널 등). 높이는 직접 정해요.' },
          { name: 'footer', type: 'HTMLElement', desc: '맨 아래 한 줄 전체(연결 상태 등).' },
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

      <h2>분할 화면 (여러 차트)</h2>
      <P>
        차트 1~8개를 한 화면에 나눠 보여줘요.
        툴바와 그리기 도구는 하나이고, 마지막으로 누른 칸(활성 칸)을 조작해요.
        사용자는 툴바의 분할 버튼으로 모양을 바꾸고, 칸 사이 경계를 끌어 크기를 바꿔요.
      </P>
      <Code>{`
import { FnMultiChart } from '@funnest/charts-react';

<FnMultiChart
  datafeed={myDatafeed}
  layout="4-grid"
  panes={[
    { symbol: '005930', resolution: '1D' },
    { symbol: '000660', resolution: '1D' },
    { symbol: 'KRW-BTC', resolution: '60' },
    { symbol: 'KRW-ETH', resolution: '60' },
  ]}
  sync={{ crosshair: true }}
  style={{ height: 720 }}
/>`}</Code>
      <P>
        React 없이 쓸 때는 <code>createMultiChart(element, options)</code>를 써요.
        <code>FnChart</code>의 옵션과 슬롯을 모두 그대로 쓸 수 있어요.
      </P>
      <Props
        rows={[
          { name: 'panes', type: 'PaneSpec[]', desc: '칸마다 처음 열 종목과 봉 단위. 분할 모양이 칸을 더 필요로 하면 활성 칸의 종목으로 채워요.' },
          { name: 'layout', type: 'LayoutId', def: "'1'", desc: "'2-cols', '3-left', '4-grid', '6-grid', '8-grid' 등 12가지." },
          { name: 'sync', type: 'Partial<LayoutSync>', def: '{ crosshair: true }', desc: '칸 동기화: crosshair(십자선), time(시간 범위), symbol(종목), interval(봉 단위).' },
          { name: 'narrowWidth', type: 'number', def: '640', desc: '이보다 좁으면 활성 칸만 보여주고 위에 칸 탭을 띄워요.' },
        ]}
      />
      <P>
        시간 범위 동기화는 봉 단위가 같은 칸끼리만 맞춰요.
        <code>Alt+1</code>~<code>Alt+8</code>로 칸을 옮기고, <code>Alt+Enter</code>로 활성 칸을 크게 봐요.
      </P>
      <Code title="분할 화면 저장과 복원">{`
const ref = useRef<MultiChart>(null);

<FnMultiChart ref={ref} datafeed={feed} panes={[{ symbol: '005930' }]}
  onReady={(w) => w.on('stateChange', () => save(w.save()))} />

await ref.current!.load(saved);   // 분할 모양, 크기, 동기화, 칸마다의 차트까지`}</Code>

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
