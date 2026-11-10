import Link from 'next/link';
import { Children, Fragment, isValidElement, type ReactNode } from 'react';
import { highlight } from '../lib/highlight';
import { CopyButton, CopyLink } from './client-bits';

/**
 * One sentence per line: after every sentence end (". ", "? ", "! ") inside plain text
 * children, insert a line break. Inline elements (<code>, links) are kept as they are.
 */
export function sentences(node: ReactNode): ReactNode {
  const list = Children.toArray(node);
  return list.map((child, k) => {
    if (typeof child !== 'string') return isValidElement(child) ? child : child;
    const parts = child.split(/(?<=[.!?])\s+/).filter((p, i, all) => p !== '' || i < all.length - 1);
    // JSX drops the space between a sentence and a following element ("돼요.<code>"):
    // still break there.
    const breakAfterLast = k < list.length - 1 && /[.!?]\s*$/.test(child);
    return (
      <Fragment key={k}>
        {parts.map((part, i) => (
          <Fragment key={i}>
            {part}
            {(i < parts.length - 1 || breakAfterLast) && <br />}
          </Fragment>
        ))}
      </Fragment>
    );
  });
}

/** Docs paragraph (one sentence per line). */
export function P({ children }: { children: ReactNode }) {
  return <p>{sentences(children)}</p>;
}

/** Highlighted code with a copy button. */
export function Code({ children, lang = 'tsx', title }: { children: string; lang?: string; title?: string }) {
  const code = children.replace(/^\n+|\s+$/g, '');
  return (
    <figure className="code">
      <figcaption>
        <span>{title ?? lang}</span>
        <CopyButton text={code} />
      </figcaption>
      <pre>
        <code dangerouslySetInnerHTML={{ __html: lang === 'bash' ? code.replace(/</g, '&lt;') : highlight(code) }} />
      </pre>
    </figure>
  );
}

/** Live, interactive example frame. */
export function Demo({ children }: { children: ReactNode }) {
  return <div className="demo">{children}</div>;
}

export interface PropRow {
  name: string;
  type: string;
  def?: string;
  desc: string;
}

export function Props({ rows }: { rows: PropRow[] }) {
  return (
    <div className="props-wrap">
      <table className="props">
        <thead>
          <tr>
            <th>속성</th>
            <th>타입</th>
            <th>기본값</th>
            <th>설명</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name}>
              <td>
                <code>{r.name}</code>
              </td>
              <td>
                <code className="type">{r.type}</code>
              </td>
              <td>{r.def ? <code>{r.def}</code> : '—'}</td>
              <td>{sentences(r.desc)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Callout({ children }: { children: ReactNode }) {
  return <div className="callout">{sentences(children)}</div>;
}

/** Page header: small category, title, lead paragraph. */
export function DocHeader({ category, title, lead }: { category: string; title: string; lead: ReactNode }) {
  return (
    <header className="doc-header">
      <p className="doc-category">{category}</p>
      <h1>{title}</h1>
      <p className="doc-lead">{sentences(lead)}</p>
    </header>
  );
}

export function NextLinks({ items }: { items: { href: string; title: string; desc: string }[] }) {
  return (
    <div className="next-links">
      {items.map((i) => (
        <Link key={i.href} href={i.href} className="next-link">
          <b>{i.title} →</b>
          <span>{i.desc}</span>
        </Link>
      ))}
    </div>
  );
}

/** Section heading with an anchor and a "링크 복사" button. */
export function H2({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2 id={id} className="anchored">
      <a href={`#${id}`}>{children}</a>
      <CopyLink id={id} />
    </h2>
  );
}

/** Plain list whose items follow the one-sentence-per-line rule. */
export function List({ items }: { items: ReactNode[] }) {
  return (
    <ul className="doc-list">
      {items.map((item, i) => (
        <li key={i}>{sentences(item)}</li>
      ))}
    </ul>
  );
}
