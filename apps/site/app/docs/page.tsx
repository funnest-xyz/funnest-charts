import Link from 'next/link';
import type { Metadata } from 'next';
import { pageMeta } from '../../lib/meta';
import { Callout, Code, DocHeader, NextLinks, P } from '../../components/docs';

export const metadata: Metadata = pageMeta('docs', '소개와 설치', 'Funnest Charts 소개와 설치. npm i @funnest/charts-react 한 줄로 트레이딩 차트와 차트 컴포넌트를 시작해요.');

export default function DocsHome() {
  return (
    <article className="doc">
      <DocHeader
        category="시작하기"
        title="소개와 설치"
        lead="Funnest Charts는 투자 서비스를 위한 차트예요. 거래소 수준의 트레이딩 차트와, 대시보드에 쓰는 가벼운 SVG 차트 컴포넌트를 함께 제공해요."
      />

      <h2>설치</h2>
      <P>React에서는 패키지 하나면 트레이딩 차트와 차트 컴포넌트를 모두 쓸 수 있어요.</P>
      <Code lang="bash">npm i @funnest/charts-react</Code>

      <h2>패키지 구성</h2>
      <div className="pkg-grid">
        <div>
          <b>@funnest/charts-react</b>
          <span>React용. 트레이딩 차트(FnChart)와 SVG 차트 컴포넌트</span>
        </div>
        <div>
          <b>@funnest/charts-ui</b>
          <span>툴바·검색·지표·그리기 도구가 있는 트레이딩 위젯. 프레임워크와 상관없이 사용</span>
        </div>
        <div>
          <b>@funnest/charts</b>
          <span>Canvas 차트 엔진, 지표 계산, 실시간 연결 도구. UI 없이 직접 만들 때</span>
        </div>
        <div>
          <b>@funnest/charts-viz</b>
          <span>스케일·눈금·경로 계산. 웹과 React Native가 함께 쓰는 순수 TypeScript</span>
        </div>
      </div>

      <h2>첫 트레이딩 차트</h2>
      <P>
        데이터를 주는 <code>datafeed</code>와 종목 코드만 있으면 돼요. datafeed를 만드는 법은 <Link href="/docs/datafeed/">데이터 연결</Link>에서
        볼 수 있어요.
      </P>
      <Code title="Trading.tsx">{`
import { FnChart } from '@funnest/charts-react';

export function Trading() {
  return (
    <div style={{ height: 600 }}>
      <FnChart datafeed={myDatafeed} symbol="005930" resolution="1D" />
    </div>
  );
}`}</Code>

      <h2>첫 차트 컴포넌트</h2>
      <P>수익률 카드나 관심종목처럼 트레이딩 화면까지는 필요 없을 때 써요. 서버 렌더링에도 안전해요.</P>
      <Code title="ReturnCard.tsx">{`
import { LineChart } from '@funnest/charts-react';

<LineChart
  series={[{ id: 'price', data: [52000, 53100, 52800, 54200, 55000] }]}
  area="gradient"
  scrubber
/>`}</Code>

      <Callout>
        Funnest Charts에는 특정 거래소·증권사 연결 코드가 들어 있지 않아요. 바이낸스, 업비트, 증권사 API는 Datafeed 인터페이스로 직접 연결해요.
      </Callout>

      <NextLinks
        items={[
          { href: '/docs/trading-chart/', title: '트레이딩 차트', desc: '옵션, 슬롯, 레이아웃 저장' },
          { href: '/docs/components/line-chart/', title: '차트 컴포넌트', desc: 'LineChart부터 Legend까지' },
        ]}
      />
    </article>
  );
}
