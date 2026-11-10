/** @jsxImportSource preact */
import type { SymbolInfo } from '@funnest/charts';
import { useEffect, useState } from 'preact/hooks';

function hue(text: string): number {
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}

/** Round symbol logo; falls back to a colored initial when there's no logo or it fails to load. */
export function SymbolAvatar({ info, size = 24 }: { info: SymbolInfo; size?: number }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [info.logoUrl]);
  const style = { width: `${size}px`, height: `${size}px`, fontSize: `${Math.round(size * 0.46)}px` };

  if (info.logoUrl && !failed) {
    return <img class="fnc-avatar" src={info.logoUrl} alt="" style={style} onError={() => setFailed(true)} />;
  }
  const h = hue(info.symbol);
  return (
    <span
      class="fnc-avatar fnc-avatar-initial"
      aria-hidden="true"
      style={{ ...style, background: `hsl(${h} 70% 50% / 0.16)`, color: `hsl(${h} 60% 42%)` }}
    >
      {(info.name || info.symbol).trim().charAt(0).toUpperCase()}
    </span>
  );
}
