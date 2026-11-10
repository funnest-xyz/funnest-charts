import Link from 'next/link';
import { NavShell } from './client-bits';
import { GitHubButton } from './github-button';
import { Logo } from './logo';

export const NPM_URL = 'https://www.npmjs.com/package/@funnest/charts-react';

const TEXT = {
  ko: { home: '/', trading: '트레이딩 차트', components: '컴포넌트', docs: '문서', homeLabel: 'Funnest Charts 홈' },
  en: { home: '/en/', trading: 'Trading chart', components: 'Components', docs: 'Docs', homeLabel: 'Funnest Charts home' },
} as const;

/** Top navigation shared by the landing pages (ko/en) and the docs. */
export function SiteNav({ solid = false, lang = 'ko' }: { solid?: boolean; lang?: 'ko' | 'en' }) {
  const t = TEXT[lang];
  return (
    <NavShell solid={solid}>
      <div className="container nav-inner">
        <Link href={t.home} aria-label={t.homeLabel}>
          <Logo suffix="charts" />
        </Link>
        <nav className="nav-links">
          <Link href={`${t.home}#trading`}>{t.trading}</Link>
          <Link href={`${t.home}#components`}>{t.components}</Link>
          <a href={NPM_URL}>npm</a>
        </nav>
        <div className="nav-actions">
          <div className="lang-switch" role="group" aria-label="Language">
            <Link href="/" hrefLang="ko" lang="ko" aria-current={lang === 'ko' ? 'true' : undefined}>
              KO
            </Link>
            <Link href="/en/" hrefLang="en" lang="en" aria-current={lang === 'en' ? 'true' : undefined}>
              EN
            </Link>
          </div>
          <Link className="docs-btn" href="/docs/">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5v-15Z" />
              <path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5" />
              <path d="M9 8h7M9 12h5" />
            </svg>
            {t.docs}
          </Link>
          <GitHubButton lang={lang} />
        </div>
      </div>
    </NavShell>
  );
}
