import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { asset } from '../../lib/base';
import '../globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://charts.funnest.xyz'),
  title: 'Funnest Charts — 오픈소스 금융 차트 라이브러리',
  description:
    '자동매매·투자 서비스를 만드는 개발자를 위한 오픈소스(Apache-2.0) 차트. 프로 수준 트레이딩 차트 위젯과 라인·영역·막대 차트를 내 데이터, 내 디자인으로.',
  openGraph: {
    title: 'Funnest Charts',
    description: '투자 서비스를 위한 오픈소스 차트. 트레이딩 차트, SVG 차트 컴포넌트, CLI, MCP.',
    url: 'https://charts.funnest.xyz',
    siteName: 'Funnest Charts',
    locale: 'ko_KR',
    type: 'website',
    images: [{ url: asset('/og/default.png'), width: 1200, height: 630, alt: 'Funnest Charts — 투자 서비스를 위한 오픈소스 차트' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Funnest Charts',
    description: '투자 서비스를 위한 오픈소스 차트',
    images: [asset('/og/default.png')],
  },
  alternates: { canonical: asset('/'), languages: { ko: asset('/'), en: asset('/en/') } },
};

export const viewport: Viewport = { themeColor: '#6C4DFF' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
        {/* Code font for the docs (only code blocks use it). */}
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fontsource/jetbrains-mono@5/index.css" />
      </head>
      <body>{children}</body>
    </html>
  );
}
