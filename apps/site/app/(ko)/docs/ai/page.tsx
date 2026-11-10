import type { Metadata } from 'next';
import { pageMeta } from '../../../../lib/meta';
import { Callout, Code, DocHeader, H2, List, NextLinks, P, Props } from '../../../../components/docs';
import { asset } from '../../../../lib/base';

export const metadata: Metadata = pageMeta('docs-ai', 'AI · CLI · MCP', '차트 스펙 검사와 렌더, React 코드 생성, Claude Code·Cursor용 MCP 서버와 스킬.');

export default function AiDoc() {
  return (
    <article className="doc">
      <DocHeader
        category="시작하기"
        title="AI · CLI · MCP"
        lead="터미널과 AI 도구에서도 Funnest Charts를 써요. 차트를 JSON 스펙으로 적으면 검사하고, 그림으로 그리고, 같은 차트의 React 코드까지 만들어줘요. Claude Code나 Cursor 같은 AI 도구는 MCP 서버와 스킬로 바로 연결해요."
      />

      <H2 id="cli">CLI</H2>
      <List
        items={[
          <>funnest-charts로 차트 목록과 스키마를 보고, 스펙을 검사하고, SVG, PNG, HTML로 그려요.</>,
          <>내 데이터(CSV, JSON)에 맞는 차트를 추천받고, 시작 폴더도 만들어요.</>,
          <>
            <code>npx @funnest/charts-cli</code>로 바로 실행해요. 프로젝트에 설치하면 <code>funnest-charts</code> 명령으로 써요.
          </>,
          <>
            출력 파일을 <code>.tsx</code>로 주면 같은 차트를 그리는 React 코드를 만들어요.
          </>,
          <>PNG는 Pretendard가 설치돼 있으면 그 글꼴로, 없으면 운영체제의 한글 글꼴로 그려요.</>,
          <>
            명령 앞뒤 어디든 <code>--locale en</code>을 붙이면 안내 문구가 영어로 바뀌어요.
          </>,
        ]}
      />
      <Code lang="bash" title="터미널">{`
npx @funnest/charts-cli list                          # 전체 목록
npx @funnest/charts-cli info bar                      # 항목, 예시, React 코드
npx @funnest/charts-cli example line --out spec.json  # 시작할 스펙
npx @funnest/charts-cli validate spec.json            # 오류가 있으면 1로 끝나고 비슷한 이름을 알려줘요
npx @funnest/charts-cli render spec.json --out chart.png --theme dark --scale 2
npx @funnest/charts-cli render spec.json --out chart.html
npx @funnest/charts-cli render spec.json --out Chart.tsx   # React 코드
npx @funnest/charts-cli schema line --out line.schema.json
npx @funnest/charts-cli suggest data.csv --out-dir charts
npx @funnest/charts-cli init my-chart --type area
npx @funnest/charts-cli validate spec.json --locale en    # 영어 메시지`}</Code>

      <H2 id="spec">차트 스펙</H2>
      <P>스펙은 차트 하나를 적은 JSON이에요. 웹에서 쓰는 컴포넌트와 같은 컴포넌트로 그려서, 그림과 앱 화면이 똑같아요.</P>
      <Code lang="json" title="spec.json">{`
{
  "type": "line",
  "title": "삼성전자 1개월",
  "data": [
    { "date": "2026-11-03", "price": 71200 },
    { "date": "2026-11-04", "price": 71800 }
  ],
  "x": "date",
  "y": "price",
  "area": "gradient",
  "format": { "suffix": "원" },
  "referenceLines": [{ "y": 73000, "label": "평단가" }]
}`}</Code>
      <figure className="doc-figure">
        <img src={asset('/docs/cli-line.png')} alt="funnest-charts render로 그린 선 차트" width={640} height={320} />
        <figcaption>funnest-charts render spec.json --out chart.png</figcaption>
      </figure>
      <Props
        rows={[
          { name: 'line', type: 'LineChart', desc: '가격 흐름, 수익률 추이.' },
          { name: 'area', type: 'AreaChart', desc: '자산 구성 변화. stacked로 쌓아요.' },
          { name: 'bar', type: 'BarChart', desc: '일별 손익, 거래량. colorBySign으로 빨강/파랑.' },
          { name: 'percentage-bar', type: 'PercentageBarChart', desc: '포트폴리오 비중, 체결 강도. label, value 열을 정해요.' },
          { name: 'sparkline', type: 'LineChart', desc: '관심종목 목록의 작은 선.' },
        ]}
      />
      <P>
        data는 행 배열이에요. CLI에서는 <code>"data": "./prices.csv"</code>처럼 파일 경로를 적어도 돼요.
      </P>

      <H2 id="mcp">MCP 서버</H2>
      <P>stdio MCP 서버는 도구 여섯 개를 줘요.</P>
      <Props
        rows={[
          { name: 'list_charts', type: 'tool', desc: '차트 종류와 쓰임새.' },
          { name: 'get_chart_schema', type: 'tool', desc: 'JSON 스키마와 예시 스펙.' },
          { name: 'validate_spec', type: 'tool', desc: '스펙 검사. 틀린 항목 이름은 비슷한 이름을 알려줘요.' },
          { name: 'render_chart', type: 'tool', desc: 'PNG 이미지, SVG, 같은 차트의 React 코드.' },
          { name: 'suggest_chart', type: 'tool', desc: '데이터에 맞는 차트 추천.' },
          { name: 'get_datafeed_template', type: 'tool', desc: '트레이딩 차트용 Datafeed 시작 코드(REST + WebSocket, 폴링, 고정 데이터).' },
        ]}
      />
      <List
        items={[
          <>데이터는 도구에 직접 넘겨요. 서버가 다른 주소에서 데이터를 가져오지 않아서, 내부망에 접근할 일이 없어요.</>,
          <>
            render_chart에 <code>theme: "dark"</code>를 넘기면 다크 테마로 그려요.
          </>,
        ]}
      />
      <P>Claude Code는 터미널에서 추가해요.</P>
      <Code lang="bash" title="터미널">{`claude mcp add funnest-charts -- npx -y @funnest/charts-mcp`}</Code>
      <P>Claude Desktop, Cursor와 그 밖의 클라이언트는 설정 파일에 같은 JSON을 넣어요.</P>
      <List
        items={[
          <>
            Claude Desktop: <code>claude_desktop_config.json</code>
          </>,
          <>
            Cursor: 프로젝트의 <code>.cursor/mcp.json</code>, 또는 모든 프로젝트에 쓰는 <code>~/.cursor/mcp.json</code>
          </>,
        ]}
      />
      <Code lang="json" title="JSON">{`
{
  "mcpServers": {
    "funnest-charts": {
      "command": "npx",
      "args": ["-y", "@funnest/charts-mcp"]
    }
  }
}`}</Code>

      <H2 id="skill">AI 스킬</H2>
      <List
        items={[
          <>
            <code>skills/funnest-charts/SKILL.md</code>에는 에이전트가 차트를 고르고, Datafeed를 만들고, 스펙을 쓰는 방법이 들어 있어요.
          </>,
          <>
            GitHub 저장소의 <code>skills/funnest-charts</code> 폴더를 프로젝트의 <code>.claude/skills/</code>에 복사하면 Claude Code와 Cursor가 모두 읽어요.
          </>,
          <>
            사이트 루트의 <a href={asset('/llms.txt')}>llms.txt</a>는 요약본이에요.
          </>,
        ]}
      />
      <Code lang="bash" title="터미널">{`
npx degit funnest-xyz/funnest-charts/skills/funnest-charts .claude/skills/funnest-charts`}</Code>

      <Callout>추천 흐름: get_chart_schema로 스펙 형식을 보고, validate_spec으로 검사하고, render_chart로 그림을 확인한 뒤, 함께 나온 React 코드를 앱에 붙여 넣어요.</Callout>

      <NextLinks items={[{ href: '/docs/components/line-chart/', title: '차트 컴포넌트', desc: 'LineChart부터 Legend까지' }]} />
    </article>
  );
}
