/** Funnest mark: a smile that is also a rising price line, peaking at the yellow dot. */
export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="fn-logo-bg" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#8B6CFF" />
          <stop offset="1" stopColor="#5A3BF0" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#fn-logo-bg)" />
      <path d="M7 13.5C9.5 21.5 17 23.5 23.4 11.2" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" />
      <circle cx="24.6" cy="8.6" r="2.9" fill="#FFD43B" />
    </svg>
  );
}

export function Logo({ suffix }: { suffix?: string }) {
  return (
    <span className="logo">
      <LogoMark />
      <span className="logo-word">funnest</span>
      {suffix && <span className="logo-suffix">{suffix}</span>}
    </span>
  );
}
