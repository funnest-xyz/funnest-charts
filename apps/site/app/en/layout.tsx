import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { asset } from '../../lib/base';
import '../globals.css';

const description = 'Open-source charts for investment apps: a full trading chart and lightweight SVG dashboard charts, with your data and your design.';

export const metadata: Metadata = {
  metadataBase: new URL('https://charts.funnest.xyz'),
  title: 'Funnest Charts — Charts for investment apps',
  description,
  openGraph: {
    title: 'Funnest Charts',
    description,
    url: 'https://charts.funnest.xyz/en/',
    siteName: 'Funnest Charts',
    locale: 'en_US',
    type: 'website',
    images: [{ url: asset('/og/default-en.png'), width: 1200, height: 630, alt: 'Funnest Charts — Charts for investment apps' }],
  },
  twitter: { card: 'summary_large_image', title: 'Funnest Charts', description, images: [asset('/og/default-en.png')] },
  alternates: { canonical: asset('/en/'), languages: { ko: asset('/'), en: asset('/en/') } },
};

export const viewport: Viewport = { themeColor: '#6C4DFF' };

/** English pages have their own root layout so <html lang> is right. */
export default function EnglishLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
