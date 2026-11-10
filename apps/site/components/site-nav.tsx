import Link from 'next/link';
import { NavShell } from './client-bits';
import { GitHubButton } from './github-button';
import { Logo } from './logo';

export const NPM_URL = 'https://www.npmjs.com/package/@funnest/charts-react';

const TEXT = {
  ko: { home: '/', app: 'https://funnest.xyz/', docs: '문서', homeLabel: 'Funnest Charts 홈', appLabel: 'Funnest 서비스로 가기' },
  en: { home: '/en/', app: 'https://funnest.xyz/en/', docs: 'Docs', homeLabel: 'Funnest Charts home', appLabel: 'Go to the Funnest app' },
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
        <div className="nav-actions">
          <div className="lang-switch" role="group" aria-label="Language">
            <Link href="/" hrefLang="ko" lang="ko" aria-current={lang === 'ko' ? 'true' : undefined}>
              KO
            </Link>
            <Link href="/en/" hrefLang="en" lang="en" aria-current={lang === 'en' ? 'true' : undefined}>
              EN
            </Link>
          </div>
          <Link className="docs-btn" href="/docs/" aria-label={t.docs}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5v-15Z" />
              <path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5" />
              <path d="M9 8h7M9 12h5" />
            </svg>
            <span className="docs-label">{t.docs}</span>
          </Link>
          <GitHubButton lang={lang} />
          <a className="app-btn" href={t.app} aria-label={t.appLabel}>
            App
          </a>
        </div>
      </div>
    </NavShell>
  );
}
