import type { ReactNode } from 'react';
import { Reveal } from '../components/client-bits';
import { NPM_URL, SiteNav } from '../components/site-nav';
import { GitHubButton, GITHUB_URL } from '../components/github-button';
import { HeroChart } from '../components/hero-chart';
import { Logo } from '../components/logo';
import {
  AreaChartDemo,
  BarChartDemo,
  CartesianDemo,
  LegendDemo,
  LineChartDemo,
  PercentageBarDemo,
  PeriodSelectorDemo,
  PointDemo,
  ReferenceLineDemo,
  ScrubberDemo,
  SparklineDemo,
  XAxisDemo,
  YAxisDemo,
} from '../components/showcase';

const GITHUB = GITHUB_URL;
const NPM = NPM_URL;

interface ComponentItem {
  name: string;
  desc: string;
  demo: ReactNode;
  /** Spans two grid columns. */
  wide?: boolean;
}

const GROUPS: { id: string; title: string; desc: string; items: ComponentItem[] }[] = [
  {
    id: 'charts',
    title: '차트',
    desc: '데이터 모양에 맞는 차트를 고르세요',
    items: [
      { name: 'LineChart', desc: '가격 흐름을 선으로. 그라디언트 영역은 옵션', demo: <LineChartDemo /> },
      { name: 'AreaChart', desc: '자산 구성처럼 쌓이는 값을 영역으로', demo: <AreaChartDemo /> },
      { name: 'BarChart', desc: '손익과 거래량을 막대로. 값마다 다른 색', demo: <BarChartDemo /> },
      { name: 'PercentageBarChart', desc: '전체 중 비중을 막대 하나로', demo: <PercentageBarDemo /> },
      { name: 'CartesianChart', desc: '모든 차트의 기반. 선, 막대, 축을 직접 조합', demo: <CartesianDemo /> },
      { name: 'Sparkline', desc: '축을 뺀 작은 LineChart. 관심종목 목록에', demo: <SparklineDemo /> },
    ],
  },
  {
    id: 'interaction',
    title: '축과 인터랙션',
    desc: '읽기 쉽게, 만지기 쉽게',
    items: [
      { name: 'Scrubber', desc: '손끝을 따라 그 시점의 값을 읽어요', demo: <ScrubberDemo />, wide: true },
      { name: 'XAxis', desc: '시간·카테고리 축. 눈금, 격자, 라벨 형식', demo: <XAxisDemo /> },
      { name: 'YAxis', desc: '값 축. 보기 좋은 눈금과 가로 격자', demo: <YAxisDemo /> },
      { name: 'PeriodSelector', desc: '1주, 1개월, 1년… 기간 탭', demo: <PeriodSelectorDemo />, wide: true },
    ],
  },
  {
    id: 'annotations',
    title: '표시',
    desc: '차트 위에 의미를 더하세요',
    items: [
      { name: 'ReferenceLine', desc: '평단가, 목표가 같은 기준선', demo: <ReferenceLineDemo /> },
      { name: 'Point', desc: '매수·매도 표시와 실시간 점. 눌러보세요', demo: <PointDemo /> },
      { name: 'Legend', desc: '계열 범례. 올리면 강조, 누르면 켜고 끄기', demo: <LegendDemo /> },
    ],
  },
];

const COUNT = GROUPS.reduce((n, g) => n + g.items.length, 0);

const lines = (rows: string[]) =>
  rows.map((line, i) => (
    <span key={i} className="line">
      {line}
    </span>
  ));

export default function Home() {
  return (
    <>
      <SiteNav />

      <main id="top">
        <section className="hero">
          <div className="container hero-copy">
            <h1>{lines(['특별하게 만드는 최고의 도구', '우리의 둥지'])}</h1>
            <p>트레이딩 차트부터 대시보드 컴포넌트</p>
          </div>
          <div className="container-wide hero-live" id="trading">
            <HeroChart />
          </div>
        </section>



        <section id="components" className="section components">
          <div className="container">
            <Reveal className="center">
              <span className="tag">{COUNT}개 컴포넌트</span>
              <h2 className="tag-gap">필요한 것만 골라 조합하세요</h2>
              <p className="sub">가볍고 서버 렌더링에도 안전한 SVG 차트 컴포넌트</p>
            </Reveal>

            {GROUPS.map((g) => (
              <div key={g.id} className="comp-group">
                <Reveal className="comp-group-head">
                  <h3>{g.title}</h3>
                  <p>{g.desc}</p>
                </Reveal>
                <div className="comp-grid">
                  {g.items.map((item, i) => (
                    <Reveal key={item.name} delay={(i % 3) * 70} className={item.wide ? 'comp-wide' : ''}>
                      <article className="comp-card" id={item.name.toLowerCase()}>
                        <div className="comp-preview">{item.demo}</div>
                        <div className="comp-meta">
                          <h4>{item.name}</h4>
                          <p>{item.desc}</p>
                        </div>
                      </article>
                    </Reveal>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="cta">
          <div className="container center">
            <Reveal>
              <h2>지금 바로 시작해보세요</h2>
              <p className="sub">오픈소스라 누구나 무료로 쓸 수 있어요</p>
              <div className="cta-actions">
                <GitHubButton large label="GitHub에서 보기" />
                <a className="pill-btn pill-lg pill-ghost" href={NPM}>
                  npm 패키지
                </a>
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="container footer-inner">
          <Logo />
          <p>
            © 2026 Funnest · Apache-2.0 · <a href={GITHUB}>GitHub</a> · <a href="https://funnest.xyz">funnest.xyz</a>
          </p>
        </div>
      </footer>
    </>
  );
}
