/**
 * Default categorical colors: Funnest violet first, then hues chosen to stay apart from
 * each other and from the up/down colors (red/blue in Korea, green/red elsewhere).
 */
export const DEFAULT_PALETTE = ['#6C4DFF', '#F59E0B', '#14B8A6', '#EC4899', '#0EA5E9', '#84CC16', '#A16207', '#64748B'] as const;

export const seriesColor = (index: number, palette: readonly string[] = DEFAULT_PALETTE) =>
  palette[((index % palette.length) + palette.length) % palette.length]!;
