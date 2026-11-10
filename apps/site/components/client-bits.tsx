'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

/** Fades/slides children in the first time they scroll into view. */
export function Reveal({ children, className = '', delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return setShown(true);
    const io = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={`reveal ${shown ? 'is-in' : ''} ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

/**
 * Transparent over the dark hero, solid once the page scrolls past it.
 * `solid` keeps it solid from the start (docs pages).
 */
export function NavShell({ children, solid = false }: { children: ReactNode; solid?: boolean }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    if (solid) return;
    const onScroll = () => setScrolled(window.scrollY > window.innerHeight * 0.75);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [solid]);
  return <header className={solid || scrolled ? 'nav nav-solid' : 'nav'}>{children}</header>;
}

/** Copies `text` and confirms for a moment. */
export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="code-copy"
      aria-label={copied ? '복사됨' : '코드 복사'}
      onClick={() =>
        void navigator.clipboard?.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        })
      }
    >
      {copied ? '복사됨' : '복사'}
    </button>
  );
}

/** Copies the URL of a heading anchor (the page URL + #id). */
export function CopyLink({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="copy-link"
      aria-label={copied ? '링크 복사됨' : '이 부분 링크 복사'}
      onClick={() => {
        const url = `${location.origin}${location.pathname}#${id}`;
        void navigator.clipboard?.writeText(url).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
    >
      {copied ? '복사됨' : '링크 복사'}
    </button>
  );
}
