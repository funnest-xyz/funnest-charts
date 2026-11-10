import type { Metadata } from 'next';
import { Code, DocHeader, NextLinks, P, Props } from '../../../components/docs';

export const metadata: Metadata = { title: '테마' };

export default function ThemingDoc() {
  return (
    <article className="doc">
      <DocHeader
        category="시작하기"
        title="테마"
        lead="기본은 사용자 기기의 라이트/다크 설정을 따라가요. 색과 글꼴은 내 서비스에 맞게 바꿀 수 있어요."
      />

      <h2>라이트 · 다크</h2>
      <Code>{`
<FnChart colorScheme="system" … />  // 기본: OS 설정을 따르고, 바뀌면 바로 전환
<FnChart colorScheme="dark" … />    // 항상 다크`}</Code>

      <h2>상승 · 하락 색</h2>
      <P>기본은 한국식(상승 빨강, 하락 파랑)이에요. 해외 서비스라면 바꿔주세요.</P>
      <Code>{`
<FnChart theme={{ up: '#12B886', down: '#F04452' }} … />`}</Code>

      <h2>트레이딩 차트 색 토큰</h2>
      <Props
        rows={[
          { name: 'background / surface', type: 'string', desc: '배경, 패널 배경.' },
          { name: 'text / textSecondary', type: 'string', desc: '글자, 보조 글자.' },
          { name: 'grid / border / crosshair', type: 'string', desc: '격자, 경계선, 십자선.' },
          { name: 'up / down', type: 'string', desc: '상승, 하락.' },
          { name: 'accent', type: 'string', desc: '선택·강조 색.' },
          { name: 'fontFamily / fontSize / radius', type: 'string / number / number', desc: '글꼴, 글자 크기, 모서리.' },
        ]}
      />
      <P>
        값에 CSS 변수를 써도 돼요. <code>{`theme={{ background: 'var(--bg)' }}`}</code>처럼 쓰면 페이지 테마가 바뀔 때 차트도 따라 바뀌어요.
      </P>

      <h2>차트 컴포넌트 색</h2>
      <P>SVG 차트 컴포넌트는 페이지의 color-scheme을 따르고, 아래 CSS 변수로 바꿀 수 있어요.</P>
      <Code lang="css">{`
:root {
  --fnv-text: #191f28;        /* 진한 글자 */
  --fnv-text-muted: #8b95a1;  /* 축 라벨 */
  --fnv-grid: #f2f4f6;        /* 격자 */
  --fnv-bg: #ffffff;          /* 말풍선·점 테두리 */
  --fnv-accent: #6c4dff;      /* 기간 탭 선택 */
}`}</Code>

      <NextLinks items={[{ href: '/docs/components/line-chart/', title: 'LineChart', desc: '차트 컴포넌트 둘러보기' }]} />
    </article>
  );
}
