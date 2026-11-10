import Link from 'next/link';
import { NavShell } from './client-bits';
import { GitHubButton } from './github-button';
import { Logo } from './logo';

export const NPM_URL = 'https://www.npmjs.com/package/@funnest/charts-react';

/** Top navigation shared by the landing page and the docs. */
export function SiteNav({ solid = false }: { solid?: boolean }) {
  return (
    <NavShell solid={solid}>
      <div className="container nav-inner">
        <Link href="/" aria-label="Funnest Charts 홈">
          <Logo suffix="charts" />
        </Link>
        <nav className="nav-links">
          <Link href="/#trading">트레이딩 차트</Link>
          <Link href="/#components">컴포넌트</Link>
          <a href={NPM_URL}>npm</a>
        </nav>
        <div className="nav-actions">
          <Link className="docs-btn" href="/docs/">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5v-15Z" />
              <path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5" />
              <path d="M9 8h7M9 12h5" />
            </svg>
            문서
          </Link>
          <GitHubButton />
        </div>
      </div>
    </NavShell>
  );
}
