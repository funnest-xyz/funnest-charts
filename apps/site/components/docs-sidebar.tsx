'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export interface SidebarSection {
  title: string;
  items: { href: string; label: string }[];
}

const norm = (p: string) => (p.endsWith('/') ? p : `${p}/`);

/** Docs navigation; highlights the current page. On small screens it scrolls sideways. */
export function DocsSidebar({ sections }: { sections: SidebarSection[] }) {
  const path = norm(usePathname() ?? '/');
  return (
    <nav className="docs-sidebar" aria-label="문서 목차">
      {sections.map((s) => (
        <div key={s.title} className="docs-side-group">
          <p>{s.title}</p>
          <ul>
            {s.items.map((i) => {
              const active = path === norm(i.href);
              return (
                <li key={i.href}>
                  <Link href={i.href} aria-current={active ? 'page' : undefined} className={active ? 'is-active' : undefined}>
                    {i.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
