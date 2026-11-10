import type { ReactNode } from 'react';
import { Reveal } from './client-bits';
import { GitHubButton, GITHUB_URL } from './github-button';
import { HeroChart } from './hero-chart';
import { LocaleProvider, type Lang } from './locale';
import { Logo } from './logo';
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
} from './showcase';
import { NPM_URL, SiteNav } from './site-nav';

interface ComponentItem {
  name: string;
  desc: string;
  demo: ReactNode;
  /** Spans two grid columns. */
  wide?: boolean;
}

interface Copy {
  hero: string[];
  heroSub: string;
  count: (n: number) => string;
  componentsTitle: string;
  componentsSub: string;
  groups: { id: string; title: string; desc: string; items: Record<string, string> }[];
  ctaTitle: string;
  ctaSub: string;
  ctaGithub: string;
  ctaNpm: string;
}

const COPY: Record<Lang, Copy> = {
  ko: {
    hero: ['특별하게 만드는 최고의 도구', '우리의 둥지'],
    heroSub: '트레이딩 차트부터 대시보드 컴포넌트',
    count: (n) => `${n}개 컴포넌트`,
    componentsTitle: '필요한 것만 골라 조합하세요',
    componentsSub: '가볍고 서버 렌더링에도 안전한 SVG 차트 컴포넌트',
    groups: [
      {
        id: 'charts',
        title: '차트',
        desc: '데이터 모양에 맞는 차트를 고르세요',
        items: {
          LineChart: '가격 흐름을 선으로. 그라디언트 영역은 옵션',
          AreaChart: '자산 구성처럼 쌓이는 값을 영역으로',
          BarChart: '손익과 거래량을 막대로. 값마다 다른 색',
          PercentageBarChart: '전체 중 비중을 막대 하나로',
          CartesianChart: '모든 차트의 기반. 선, 막대, 축을 직접 조합',
          Sparkline: '축을 뺀 작은 LineChart. 관심종목 목록에',
        },
      },
      {
        id: 'interaction',
        title: '축과 인터랙션',
        desc: '읽기 쉽게, 만지기 쉽게',
        items: {
          Scrubber: '손끝을 따라 그 시점의 값을 읽어요',
          XAxis: '시간·카테고리 축. 눈금, 격자, 라벨 형식',
          YAxis: '값 축. 보기 좋은 눈금과 가로 격자',
          PeriodSelector: '1주, 1개월, 1년… 기간 탭',
        },
      },
      {
        id: 'annotations',
        title: '표시',
        desc: '차트 위에 의미를 더하세요',
        items: {
          ReferenceLine: '평단가, 목표가 같은 기준선',
          Point: '매수·매도 표시와 실시간 점. 눌러보세요',
          Legend: '계열 범례. 올리면 강조, 누르면 켜고 끄기',
        },
      },
    ],
    ctaTitle: '지금 바로 시작해보세요',
    ctaSub: '오픈소스라 누구나 무료로 쓸 수 있어요',
    ctaGithub: 'GitHub에서 보기',
    ctaNpm: 'npm 패키지',
  },
  en: {
    hero: ['The best tools to make it special', 'Welcome to our nest'],
    heroSub: 'From trading charts to dashboard components',
    count: (n) => `${n} components`,
    componentsTitle: 'Pick only what you need',
    componentsSub: 'Lightweight SVG chart components, safe for server rendering',
    groups: [
      {
        id: 'charts',
        title: 'Charts',
        desc: 'Choose the chart that fits your data',
        items: {
          LineChart: 'Price history as a line, with an optional gradient area',
          AreaChart: 'Stacked values such as portfolio composition',
          BarChart: 'P&L and volume as bars, colored per value',
          PercentageBarChart: 'Shares of a whole in a single bar',
          CartesianChart: 'The base of every chart: compose lines, bars and axes',
          Sparkline: 'A tiny LineChart without axes, for watchlists',
        },
      },
      {
        id: 'interaction',
        title: 'Axes & interaction',
        desc: 'Easy to read, easy to touch',
        items: {
          Scrubber: 'Read the value under your finger',
          XAxis: 'Time and category axis: ticks, grid and label format',
          YAxis: 'Value axis with nice ticks and horizontal grid',
          PeriodSelector: '1W, 1M, 1Y… period tabs',
        },
      },
      {
        id: 'annotations',
        title: 'Annotations',
        desc: 'Add meaning on top of the chart',
        items: {
          ReferenceLine: 'Reference lines such as average or target price',
          Point: 'Buy/sell markers and a live dot. Try clicking them',
          Legend: 'Series legend: hover to highlight, click to toggle',
        },
      },
    ],
    ctaTitle: 'Get started today',
    ctaSub: 'Free and open source for everyone',
    ctaGithub: 'View on GitHub',
    ctaNpm: 'npm package',
  },
};

const DEMOS: Record<string, { demo: ReactNode; wide?: boolean }> = {
  LineChart: { demo: <LineChartDemo /> },
  AreaChart: { demo: <AreaChartDemo /> },
  BarChart: { demo: <BarChartDemo /> },
  PercentageBarChart: { demo: <PercentageBarDemo /> },
  CartesianChart: { demo: <CartesianDemo /> },
  Sparkline: { demo: <SparklineDemo /> },
  Scrubber: { demo: <ScrubberDemo />, wide: true },
  XAxis: { demo: <XAxisDemo /> },
  YAxis: { demo: <YAxisDemo /> },
  PeriodSelector: { demo: <PeriodSelectorDemo />, wide: true },
  ReferenceLine: { demo: <ReferenceLineDemo /> },
  Point: { demo: <PointDemo /> },
  Legend: { demo: <LegendDemo /> },
};

const lines = (rows: string[]) =>
  rows.map((line, i) => (
    <span key={i} className="line">
      {line}
    </span>
  ));

/** The landing page in either language (Korean at /, English at /en/). */
export function Landing({ lang }: { lang: Lang }) {
  const t = COPY[lang];
  const groups = t.groups.map((g) => ({
    ...g,
    items: Object.entries(g.items).map(([name, desc]): ComponentItem => ({ name, desc, ...DEMOS[name]! })),
  }));
  const count = groups.reduce((n, g) => n + g.items.length, 0);

  return (
    <LocaleProvider lang={lang}>
      <SiteNav lang={lang} />

      <main id="top">
        <section className="hero">
          <div className="container hero-copy">
            <h1>{lines(t.hero)}</h1>
            <p>{t.heroSub}</p>
          </div>
          <div className="container-wide hero-live" id="trading">
            <HeroChart />
          </div>
        </section>

        <section id="components" className="section components">
          <div className="container">
            <Reveal className="center">
              <span className="tag">{t.count(count)}</span>
              <h2 className="tag-gap">{t.componentsTitle}</h2>
              <p className="sub">{t.componentsSub}</p>
            </Reveal>

            {groups.map((g) => (
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
              <h2>{t.ctaTitle}</h2>
              <p className="sub">{t.ctaSub}</p>
              <div className="cta-actions">
                <GitHubButton large label={t.ctaGithub} lang={lang} />
                <a className="pill-btn pill-lg pill-ghost" href={NPM_URL}>
                  {t.ctaNpm}
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
            © 2026 Funnest · Apache-2.0 · <a href={GITHUB_URL}>GitHub</a> · <a href="https://funnest.xyz">funnest.xyz</a>
          </p>
        </div>
      </footer>
    </LocaleProvider>
  );
}
