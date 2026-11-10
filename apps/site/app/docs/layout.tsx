import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { DocsSidebar, type SidebarSection } from '../../components/docs-sidebar';
import { SiteNav } from '../../components/site-nav';
import { COMPONENT_DOCS, COMPONENT_GROUPS } from '../../lib/component-docs';

export const metadata: Metadata = {
  title: { default: '문서 · Funnest Charts', template: '%s · Funnest Charts 문서' },
};

const SECTIONS: SidebarSection[] = [
  {
    title: '시작하기',
    items: [
      { href: '/docs/', label: '소개와 설치' },
      { href: '/docs/trading-chart/', label: '트레이딩 차트' },
      { href: '/docs/datafeed/', label: '데이터 연결' },
      { href: '/docs/theming/', label: '테마' },
      { href: '/docs/ai/', label: 'AI · CLI · MCP' },
    ],
  },
  ...COMPONENT_GROUPS.map((g) => ({
    title: g,
    items: COMPONENT_DOCS.filter((c) => c.group === g).map((c) => ({ href: `/docs/components/${c.slug}/`, label: c.name })),
  })),
];

export default function DocsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteNav solid />
      <div className="docs container-wide">
        <DocsSidebar sections={SECTIONS} />
        <main className="docs-main">{children}</main>
      </div>
    </>
  );
}
