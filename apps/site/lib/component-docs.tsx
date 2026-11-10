import type { ReactNode } from 'react';
import type { PropRow } from '../components/docs';
import {
  AreaChartDemo,
  BarChartDemo,
  CartesianDemo,
  ConfidenceBandDemo,
  HorizontalBarDemo,
  PercentageRowsDemo,
  RangeBarDemo,
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

export interface ComponentDoc {
  slug: string;
  name: string;
  group: '차트' | '축과 인터랙션' | '표시';
  summary: string;
  /** Longer explanation under the title. */
  body: string;
  demo: ReactNode;
  code: string;
  /** More demos with their code, under the main one. */
  examples?: { title: string; body?: string; demo: ReactNode; code: string }[];
  props: PropRow[];
}

const SERIES = 'readonly { id: string; data: (number | [low, high] | null)[]; yAxisId?: string; label?: string; color?: string }[]';

/** Props every preset chart (LineChart, AreaChart, BarChart) shares with CartesianChart. */
const CHART_PROPS: PropRow[] = [
  { name: 'series', type: SERIES, desc: '그릴 데이터. data[i]는 x 위치 i의 값이고 null은 빈 구간이에요. [low, high]를 넣으면 범위(띠·떠 있는 막대)가 돼요.' },
  { name: 'height', type: 'number', def: '240', desc: '차트 높이(px).' },
  { name: 'width', type: 'number', desc: '비우면 부모 너비를 꽉 채워요(ResizeObserver).' },
  { name: 'inset', type: 'number | { top, right, bottom, left }', def: '8', desc: 'SVG 가장자리와 그림 영역 사이 여백.' },
  { name: 'xAxis', type: '{ data?, scaleType?, bandPadding? }', desc: 'x 라벨(날짜 등)과 축 종류.' },
  { name: 'yAxis', type: '{ id?, domain?: { min?, max? }, includeZero?, nice?, scaleType? } | 배열', desc: '값 범위를 고정하거나 0을 포함시켜요. 배열로 넘기면 y축이 여러 개가 되고, 계열은 series.yAxisId로 축을 골라요.' },
  { name: 'stacked', type: 'boolean', def: 'false', desc: '계열을 위로 쌓아요(양수는 위, 음수는 아래).' },
  { name: 'showXAxis / showYAxis', type: 'boolean | XAxisProps | YAxisProps', desc: '축 표시. 객체로 세부 옵션을 넘길 수 있어요.' },
  { name: 'scrubber', type: 'boolean | ScrubberProps', desc: '마우스·손가락을 따라가는 선과 값 말풍선.' },
  { name: 'onScrubberPositionChange', type: '(index: number | null) => void', desc: '짚은 위치가 바뀔 때. 헤더 가격 연동에 써요.' },
  { name: 'legend', type: "boolean | 'top' | 'bottom' | 'left' | 'right' | { position, interactive, shape }", def: 'false', desc: '계열 범례. interactive면 올려서 강조, 눌러서 숨기기.' },
  { name: 'yAxis.scaleType', type: "'linear' | 'log'", def: "'linear'", desc: '값이 몇 자릿수씩 차이 날 때는 로그 스케일.' },
  { name: 'emptyState', type: 'ReactNode', desc: '데이터가 없을 때 대신 보여줄 내용.' },
  { name: 'getScrubberAccessibilityLabel', type: '(index) => string', desc: '키보드로 짚을 때 스크린리더가 읽을 문장.' },
  { name: 'animate', type: 'boolean', def: 'true', desc: '처음 그릴 때 애니메이션(동작 줄이기 설정이면 꺼져요).' },
  { name: 'palette', type: 'readonly string[]', desc: '계열 기본 색 목록.' },
];

export const COMPONENT_DOCS: ComponentDoc[] = [
  {
    slug: 'line-chart',
    name: 'LineChart',
    group: '차트',
    summary: '가격 흐름을 선으로',
    body: '가장 많이 쓰는 차트예요. area로 아래를 채우고, scrubber로 손끝을 따라 값을 읽게 할 수 있어요. 축을 빼고 작게 그리면 스파크라인이 돼요.',
    demo: <LineChartDemo />,
    code: `
import { LineChart, ReferenceLine } from '@funnest/charts-react';

const hi = prices.indexOf(Math.max(...prices));

<LineChart
  series={[{ id: 'price', data: prices }]}
  xAxis={{ data: dates }}
  area="gradient"
  baseline={prices[0]}  // 시작가 위는 빨강, 아래는 파랑
  points={(i) => (i === hi ? { label: '고점' } : false)}
  scrubber={{ beaconLabels: true, idlePulse: true }}
>
  <ReferenceLine dataY={prices[0]} dash="2 3" />
</LineChart>`,
    props: [
      ...CHART_PROPS,
      { name: 'curve', type: "'monotone' | 'linear' | 'step' | 'stepBefore' | 'stepAfter'", def: "'monotone'", desc: "monotone은 부드럽지만 데이터에 없는 고점·저점을 만들지 않아요." },
      { name: 'area', type: "'none' | 'gradient' | 'solid'", def: "'none'", desc: '선 아래 채우기.' },
      { name: 'strokeWidth', type: 'number', def: '2', desc: '선 두께.' },
      { name: 'connectNulls', type: 'boolean', def: 'false', desc: 'null 구간을 건너뛰고 이어서 그려요.' },
      { name: 'lineStyle', type: "'solid' | 'dashed' | 'dotted'", def: "'solid'", desc: '선 모양. 계열마다 series.lineStyle로도 정해요.' },
      { name: 'points', type: 'boolean | (index, value) => LinePoint | false', desc: '점 표시. 함수로 고점·저점에만 라벨을 붙일 수 있어요.' },
      { name: 'baseline', type: 'number', desc: '이 값을 기준으로 선과 영역 색을 나눠요(예: 시작가).' },
      { name: 'splitColors', type: '{ above, below }', def: '빨강 / 파랑', desc: 'baseline 위아래 색.' },
    ],
  },
  {
    slug: 'area-chart',
    name: 'AreaChart',
    group: '차트',
    summary: '쌓이는 값을 영역으로',
    body: '자산 구성처럼 여러 값의 합과 변화를 함께 보여줄 때 좋아요. stacked를 켜면 계열이 위로 쌓여요.',
    demo: <AreaChartDemo />,
    code: `
import { AreaChart } from '@funnest/charts-react';

<AreaChart
  series={[
    { id: 'kr', label: '국내주식', data: kr },
    { id: 'us', label: '해외주식', data: us },
    { id: 'crypto', label: '코인', data: crypto },
  ]}
  stacked
  xAxis={{ data: months }}
  scrubber={{ showValues: true, valueFormatter: (v) => \`\${v}만\` }}
/>`,
    props: [
      ...CHART_PROPS,
      { name: 'fill', type: "'gradient' | 'solid' | 'dotted'", def: "'gradient'", desc: '채우기 방식. 계열마다 series.areaStyle로도 정해요.' },
      { name: 'baseline / splitColors', type: 'number / { above, below }', desc: '기준값 위아래로 색을 나눠 채워요.' },
      { name: 'gradientStops', type: '{ offset, opacity, color? }[]', desc: '그라디언트를 직접 정해요(0 = 선, 1 = 기준선).' },
      { name: 'showLines', type: 'boolean', def: 'true', desc: '영역 위쪽 경계선.' },
      { name: 'curve', type: 'Curve', def: "'monotone'", desc: '곡선 방식.' },
    ],
  },
  {
    slug: 'bar-chart',
    name: 'BarChart',
    group: '차트',
    summary: '손익과 거래량을 막대로',
    body: 'x축이 칸(band)으로 나뉘는 막대 차트예요. getBarColor로 막대마다 색을 정할 수 있어서 손익(빨강/파랑)이나 거래량에 잘 맞아요.',
    demo: <BarChartDemo />,
    code: `
import { BarChart, ReferenceLine } from '@funnest/charts-react';

<BarChart
  series={[{ id: 'pnl', label: '손익', data: dailyPnl }]}
  xAxis={{ data: dates }}
  getBarColor={(v) => (v >= 0 ? '#F04452' : '#3182F6')}
  scrubber={{ showValues: true }}
>
  <ReferenceLine dataY={0} dash="" />
</BarChart>`,
    props: [
      ...CHART_PROPS,
      { name: 'getBarColor', type: '(value, index, seriesId) => string | undefined', desc: '막대별 색. undefined면 계열 색.' },
      { name: 'radius', type: 'number', def: '3', desc: '막대 끝 모서리 둥글기(음수 막대는 아래쪽).' },
      { name: 'groupGap', type: 'number', def: '2', desc: '여러 계열을 나란히 그릴 때 막대 사이 간격.' },
      { name: 'stackGap', type: 'number', def: '0', desc: '쌓인 막대 조각 사이 간격(px).' },
      { name: 'roundBaseline', type: 'boolean', def: 'false', desc: '기준선 쪽 모서리도 둥글게(알약 모양).' },
      { name: 'barMinSize', type: 'number', def: '0', desc: '아주 작은 값도 보이게 하는 최소 길이(px).' },
      { name: 'layout', type: "'vertical' | 'horizontal'", def: "'vertical'", desc: '가로 막대는 xAxis.data가 줄 이름이 돼요. 순위, 보유 종목, 업종별 수익률에 좋아요.' },
    ],
    examples: [
      {
        title: '범위 막대',
        body: '값을 [low, high]로 넣으면 막대가 0이 아니라 low에서 시작해요. 일중 고가·저가나 목표가 범위를 그릴 때 써요.',
        demo: <RangeBarDemo />,
        code: `
<BarChart
  series={[{ id: 'range', label: '일중 고가–저가', data: [[69800, 71200], [70100, 72000], …] }]}
  xAxis={{ data: dates }}
  yAxis={{ includeZero: false, nice: true }}
  showYAxis
  scrubber={{ showValues: true }}
/>`,
      },
      {
        title: '가로 막대',
        body: "layout='horizontal'이면 줄마다 막대가 왼쪽에서 오른쪽으로 뻗어요. 음수는 0 기준 왼쪽으로 그려요.",
        demo: <HorizontalBarDemo />,
        code: `
<BarChart
  layout="horizontal"
  series={[{ id: 'ret', data: [12.4, 8.1, -3.2, 5.6, -1.4, 9.8] }]}
  xAxis={{ data: ['반도체', '2차전지', '바이오', '자동차', '금융', '인터넷'] }}
  getBarColor={(v) => (v >= 0 ? '#F04452' : '#3182F6')}
  showYAxis={{ tickLabelFormatter: (v) => \`\${v}%\` }}
  scrubber
/>`,
      },
    ],
  },
  {
    slug: 'percentage-bar-chart',
    name: 'PercentageBarChart',
    group: '차트',
    summary: '전체 중 비중을 막대 하나로',
    body: '포트폴리오 비중, 매수·매도 체결 강도, 롱/숏 비율처럼 합이 100%인 값을 보여줘요. 구간이나 범례에 마우스를 올리면 그 부분만 강조돼요.',
    demo: <PercentageBarDemo />,
    code: `
import { PercentageBarChart } from '@funnest/charts-react';

<PercentageBarChart
  data={[
    { id: 'buy', label: '매수', value: 62.4, color: '#F04452' },
    { id: 'sell', label: '매도', value: 37.6, color: '#3182F6' },
  ]}
/>`,
    props: [
      { name: 'data', type: '{ id, label, value, color? }[]', desc: '구간 목록. 음수는 0으로 봐요.' },
      { name: 'rows', type: '{ id, label?, data }[]', desc: '막대 여러 개를 줄지어 비교해요(계좌별, 월별). 같은 id는 같은 색이고 범례는 하나만 그려요.' },
      { name: 'layout', type: "'horizontal' | 'vertical'", def: "'horizontal'", desc: '세로면 아래에서 위로 쌓인 기둥이 돼요.' },
      { name: 'barLength', type: 'number', def: '160', desc: '세로 막대의 길이(px).' },
      { name: 'barHeight', type: 'number', def: '10 (세로 28)', desc: '막대 두께.' },
      { name: 'gap', type: 'number', def: '2', desc: '구간 사이 간격.' },
      { name: 'showLabels', type: 'boolean', def: 'true', desc: '아래 범례와 퍼센트.' },
      { name: 'formatLabel', type: '(item, fraction) => string', desc: '라벨 형식. 기본은 "62.4%".' },
      { name: 'radius', type: 'number', def: 'barHeight / 2', desc: '막대 양 끝 둥글기.' },
      { name: 'legendPosition', type: "'top' | 'bottom' | 'right'", def: "'bottom'", desc: '라벨 위치.' },
      { name: 'legendShape', type: "'circle' | 'square' | 'squircle' | 'pill' | 'line'", def: "'circle'", desc: '색 표시 모양.' },
    ],
    examples: [
      {
        title: '여러 줄 · 세로',
        body: '계좌마다 자산 비중을 나란히 놓고 비교해요. 줄에 마우스를 올리면 범례에 그 줄의 퍼센트가 나와요.',
        demo: <PercentageRowsDemo />,
        code: `
const rows = [
  { id: 'a', label: '일반', data: [{ id: 'kr', label: '국내', value: 45 }, { id: 'us', label: '해외', value: 30 }, …] },
  { id: 'b', label: 'ISA', data: [...] },
];

<PercentageBarChart rows={rows} />
<PercentageBarChart rows={rows} layout="vertical" />`,
      },
    ],
  },
  {
    slug: 'cartesian-chart',
    name: 'CartesianChart',
    group: '차트',
    summary: '모든 차트의 기반',
    body: 'LineChart, AreaChart, BarChart도 이 위에 만들어져 있어요. Line, Area, BarPlot, XAxis, YAxis, ReferenceLine, Point, Scrubber를 자식으로 넣어 원하는 차트를 직접 조합하세요.',
    demo: <CartesianDemo />,
    code: `
import { BarPlot, CartesianChart, Line, Scrubber, YAxis } from '@funnest/charts-react';

// 가격과 거래량을 각자의 y축에 그려요. <CartesianChart
  series={[
    { id: 'vol', label: '거래량', data: volume, yAxisId: 'volume', color: '#D1D6DB' },
    { id: 'price', label: '가격', data: prices, yAxisId: 'price' },
  ]}
  xAxis={{ scaleType: 'band', data: dates }}
  yAxis={[{ id: 'price', includeZero: false }, { id: 'volume', domain: { min: 0, max: maxVolume * 4 } }]}
  enableScrubbing
>
  <BarPlot seriesIds={['vol']} />
  <Line seriesId="price" />
  <YAxis axisId="price" />
  <Scrubber seriesIds={['price']} showValues />
</CartesianChart>`,
    examples: [
      {
        title: '신뢰 구간 띠',
        body: '계열 값을 [low, high]로 넣고 Area로 그리면 두 값 사이가 채워져요. 예측선과 함께 불확실성 범위를 보여줄 때 써요.',
        demo: <ConfidenceBandDemo />,
        code: `
<CartesianChart
  series={[
    { id: 'band', data: forecastRange },        // [[low, high], …]
    { id: 'actual', data: prices },
    { id: 'mean', data: forecast, lineStyle: 'dashed' },
  ]}
  enableScrubbing
>
  <Area seriesId="band" fill="solid" />
  <Line seriesId="actual" />
  <Line seriesId="mean" />
  <YAxis />
  <Scrubber showValues />
</CartesianChart>`,
      },
    ],
    props: [
      ...CHART_PROPS.filter((p) => !['showXAxis / showYAxis', 'scrubber'].includes(p.name)),
      { name: 'enableScrubbing', type: 'boolean', def: 'false', desc: '포인터를 추적해 Scrubber와 onScrubberPositionChange에 전달해요.' },
      { name: 'children', type: 'ReactNode', desc: '그릴 부품들. 순서대로 위에 겹쳐 그려요.' },
    ],
  },
  {
    slug: 'sparkline',
    name: 'Sparkline',
    group: '차트',
    summary: '관심종목 목록의 작은 차트',
    body: '별도 컴포넌트가 아니라 축을 뺀 작은 LineChart예요. 높이와 여백만 줄이면 돼요.',
    demo: <SparklineDemo />,
    code: `
import { LineChart } from '@funnest/charts-react';

<LineChart
  series={[{ id: 's', data: last30Days, color: up ? '#F04452' : '#3182F6' }]}
  height={32}
  inset={2}
  strokeWidth={1.5}
  animate={false}
/>`,
    props: [
      { name: 'height', type: 'number', def: '240', desc: '스파크라인은 28~40 정도.' },
      { name: 'inset', type: 'number', def: '8', desc: '2~3으로 줄이면 선이 칸을 꽉 채워요.' },
      { name: 'animate', type: 'boolean', def: 'true', desc: '목록에서는 끄는 걸 추천해요.' },
    ],
  },
  {
    slug: 'scrubber',
    name: 'Scrubber',
    group: '축과 인터랙션',
    summary: '손끝을 따라 값을 읽어요',
    body: '포인터 위치의 세로선, 계열마다 점, 값 말풍선을 그려요. onScrubberPositionChange로 짚은 위치를 받아 큰 가격 헤더를 바꾸는 토스식 화면을 만들 수 있어요.',
    demo: <ScrubberDemo />,
    code: `
const [index, setIndex] = useState<number | null>(null);
const shown = prices[index ?? prices.length - 1];

<strong>{shown.toLocaleString()}원</strong>
<LineChart
  series={[{ id: 'price', data: prices }]}
  scrubber
  onScrubberPositionChange={setIndex}
/>`,
    props: [
      { name: 'label', type: '(index) => string', desc: '세로선 위 글자. 기본은 x 라벨. 빈 문자열이면 숨겨요.' },
      { name: 'showValues', type: 'boolean', def: 'false', desc: '계열 값 말풍선.' },
      { name: 'valueFormatter', type: '(value, seriesId) => string', desc: '말풍선 값 형식.' },
      { name: 'seriesIds', type: 'string[]', desc: '표시할 계열만 고르기.' },
      { name: 'dimFuture', type: 'boolean', def: 'true', desc: '짚은 곳 오른쪽을 흐리게.' },
      { name: 'hideOverlay', type: 'boolean', def: 'false', desc: 'dimFuture를 끄는 것과 같아요.' },
      { name: 'idlePulse', type: 'boolean', def: 'false', desc: '짚지 않을 때 각 계열의 마지막 점이 깜빡여요(실시간 느낌).' },
      { name: 'beaconLabels', type: 'boolean | (value, seriesId) => string', def: 'false', desc: '점 바로 옆에 값을 보여줘요.' },
      { name: 'beaconColor', type: '(value, seriesId) => string', desc: '점 색을 값에 따라(예: 기준선 위아래).' },
      { name: '키보드', type: '← → · Shift · Home · End · Esc', desc: '차트에 초점을 두면 키보드로 짚을 수 있어요.' },
    ],
  },
  {
    slug: 'x-axis',
    name: 'XAxis',
    group: '축과 인터랙션',
    summary: '시간·카테고리 축',
    body: 'xAxis.data의 라벨을 겹치지 않게 골라서 보여줘요. 세로 격자와 눈금 표시를 켤 수 있어요.',
    demo: <XAxisDemo />,
    code: `
<LineChart
  series={[{ id: 'p', data }]}
  xAxis={{ data: dates }}
  showXAxis={{ showLine: true, showTickMarks: true, showGrid: true }}
/>`,
    props: [
      { name: 'position', type: "'bottom' | 'top'", def: "'bottom'", desc: '축 위치.' },
      { name: 'height', type: 'number', def: '24', desc: '축이 차지하는 높이.' },
      { name: 'ticks', type: 'number[]', desc: '라벨을 붙일 인덱스를 직접 지정.' },
      { name: 'tickLabelFormatter', type: '(value, index) => string', desc: '라벨 형식.' },
      { name: 'minTickSpacing', type: 'number', def: '80', desc: '라벨 사이 최소 간격(px).' },
      { name: 'showLine / showTickMarks / showGrid', type: 'boolean', def: 'false', desc: '축선, 눈금, 세로 격자.' },
    ],
  },
  {
    slug: 'y-axis',
    name: 'YAxis',
    group: '축과 인터랙션',
    summary: '값 축과 가로 격자',
    body: '보기 좋은 숫자(1, 2, 2.5, 5 단위)로 눈금을 골라요. 트레이딩 차트처럼 기본 위치는 오른쪽이에요.',
    demo: <YAxisDemo />,
    code: `
<LineChart
  series={[{ id: 'p', data }]}
  yAxis={{ nice: true }}
  showYAxis={{ width: 56, tickLabelFormatter: (v) => v.toLocaleString() }}
/>`,
    props: [
      { name: 'position', type: "'left' | 'right'", def: "'right'", desc: '축 위치.' },
      { name: 'axisId', type: 'string', desc: 'y축이 여러 개일 때 그릴 축(yAxis 배열의 id).' },
      { name: 'width', type: 'number', def: '48', desc: '라벨 영역 너비.' },
      { name: 'ticks', type: 'number[]', desc: '눈금 값을 직접 지정.' },
      { name: 'tickLabelFormatter', type: '(value) => string', desc: '라벨 형식. 기본은 10만 이상이면 1.2M처럼 줄여요.' },
      { name: 'minTickSpacing', type: 'number', def: '32', desc: '눈금 사이 최소 간격(px).' },
      { name: 'showGrid', type: 'boolean', def: 'true', desc: '가로 격자.' },
      { name: '로그 스케일', type: "yAxis={{ scaleType: 'log' }}", desc: '차트에 켜면 눈금이 1·2·5 × 10ⁿ으로 바뀌어요.' },
    ],
  },
  {
    slug: 'period-selector',
    name: 'PeriodSelector',
    group: '축과 인터랙션',
    summary: '1주, 1개월, 1년… 기간 탭',
    body: '선택된 탭 뒤로 알약 모양 배경이 미끄러져요. 좌우 방향키로 이동할 수 있어요.',
    demo: <PeriodSelectorDemo />,
    code: `
import { PeriodSelector } from '@funnest/charts-react';

const [period, setPeriod] = useState('3M');

<PeriodSelector
  periods={[
    { id: '1W', label: '1주' },
    { id: '1M', label: '1개월' },
    { id: '3M', label: '3개월' },
    { id: '1Y', label: '1년' },
  ]}
  value={period}
  onChange={setPeriod}
  fullWidth
/>`,
    props: [
      { name: 'periods', type: '{ id, label }[]', def: '1일~전체', desc: '탭 목록.' },
      { name: 'value', type: 'string', desc: '선택된 탭 id.' },
      { name: 'onChange', type: '(id) => void', desc: '탭을 바꿀 때.' },
      { name: 'activeColor', type: 'string', def: 'var(--fnv-accent)', desc: '선택 색. 등락 색과 맞추면 자연스러워요.' },
      { name: 'fullWidth', type: 'boolean', def: 'false', desc: '탭을 가로로 꽉 채워요(모바일).' },
      { name: 'periods[].live', type: 'boolean', desc: '실시간 탭. 깜빡이는 점이 붙고, 고르면 liveColor로 바뀌어요.' },
      { name: 'liveColor', type: 'string', def: '빨강', desc: '실시간 탭을 골랐을 때 색.' },
      { name: 'LiveTabLabel', type: 'component', desc: '깜빡이는 점이 붙은 라벨을 따로 쓸 때.' },
    ],
  },
  {
    slug: 'reference-line',
    name: 'ReferenceLine',
    group: '표시',
    summary: '평단가, 목표가 같은 기준선',
    body: '값(dataY)에 가로선, 위치(dataX)에 세로선을 그어요. 평단가, 목표가, 손절가, 0% 기준선에 써요.',
    demo: <ReferenceLineDemo />,
    code: `
<CartesianChart series={[{ id: 'p', data }]}>
  <Line seriesId="p" />
  <ReferenceLine dataY={69_500} label="평단가 69,500" labelPosition="left" color="#6C4DFF" />
  <ReferenceLine dataY={71_000} label="목표가" color="#F04452" />
</CartesianChart>`,
    props: [
      { name: 'dataY', type: 'number', desc: '이 값에 가로선.' },
      { name: 'dataX', type: 'number', desc: '이 인덱스에 세로선.' },
      { name: 'yAxisId', type: 'string', desc: 'y축이 여러 개일 때 dataY가 속한 축.' },
      { name: 'label', type: 'string', desc: '선 위 글자.' },
      { name: 'labelPosition', type: "'left' | 'right' | 'center' | 'top' | 'bottom'", def: "'right'", desc: '글자 위치.' },
      { name: 'color', type: 'string', desc: '선과 글자 색.' },
      { name: 'dash', type: 'string', def: "'4 4'", desc: "점선 패턴. ''이면 실선." },
      { name: 'labelStyle', type: "'text' | 'pill'", def: "'text'", desc: 'pill이면 선 색 배경의 알약 모양 라벨.' },
      { name: 'labelAlign', type: "'above' | 'below' | 'center'", def: "'above'", desc: '가로선에서 라벨을 선 위, 아래, 가운데에.' },
      { name: 'labelDx / labelDy', type: 'number', def: '0', desc: '라벨 위치 미세 조정(px).' },
    ],
  },
  {
    slug: 'point',
    name: 'Point',
    group: '표시',
    summary: '매수·매도 표시와 실시간 점',
    body: '특정 위치에 점과 글자를 찍어요. 체결 내역, 고점·저점, 실시간 가격(pulse)에 써요. onClick으로 누를 수도 있어요.',
    demo: <PointDemo />,
    code: `
<CartesianChart series={[{ id: 'p', data }]}>
  <Line seriesId="p" />
  <Point seriesId="p" dataX={12} color="#F04452" label="매수" labelPosition="bottom" />
  <Point seriesId="p" dataX={47} color="#3182F6" label="매도" onClick={showTrade} />
  <Point seriesId="p" dataX={data.length - 1} pulse />
</CartesianChart>`,
    props: [
      { name: 'dataX', type: 'number', desc: 'x 인덱스.' },
      { name: 'dataY', type: 'number', desc: '값. 비우고 seriesId를 주면 그 계열 위에 찍혀요.' },
      { name: 'seriesId', type: 'string', desc: '붙을 계열.' },
      { name: 'yAxisId', type: 'string', desc: 'seriesId 없이 dataY만 줄 때, 값이 속한 축.' },
      { name: 'label', type: 'string', desc: '점 옆 글자.' },
      { name: 'labelPosition', type: "'top' | 'bottom' | 'left' | 'right'", def: "'top'", desc: '글자 위치.' },
      { name: 'pulse', type: 'boolean', def: 'false', desc: '실시간 점처럼 퍼지는 애니메이션.' },
      { name: 'radius / color / onClick', type: 'number / string / () => void', desc: '크기, 색, 클릭.' },
    ],
  },
  {
    slug: 'legend',
    name: 'Legend',
    group: '표시',
    summary: '계열 범례',
    body: 'HTML로 그려서 좁은 화면에서도 줄바꿈이 돼요. onItemClick으로 켜고 끄기, onItemHover로 강조를 연결하세요. 차트의 legend 속성으로 간단히 켤 수도 있어요.',
    demo: <LegendDemo />,
    code: `
import { Legend } from '@funnest/charts-react';

<Legend
  shape="line"
  items={lines.map((l) => ({ id: l.id, label: l.label, color: l.color, inactive: hidden.includes(l.id) }))}
  onItemClick={toggle}
  onItemHover={setHovered}
/>`,
    props: [
      { name: 'items', type: '{ id, label, color, value?, inactive? }[]', desc: '범례 항목.' },
      { name: 'shape', type: "'circle' | 'square' | 'squircle' | 'pill' | 'line'", def: "'circle'", desc: '색 표시 모양.' },
      { name: 'onItemClick', type: '(id) => void', desc: '누르면(버튼으로 바뀌어요).' },
      { name: 'onItemHover', type: '(id | null) => void', desc: '올리면 id, 벗어나면 null.' },
      { name: 'direction', type: "'row' | 'column'", def: "'row'", desc: '가로로 줄바꿈 또는 세로로 쌓기.' },
      { name: 'justify', type: 'CSS justify-content', def: "'flex-start'", desc: '정렬.' },
    ],
  },
];

export const COMPONENT_GROUPS = ['차트', '축과 인터랙션', '표시'] as const;
