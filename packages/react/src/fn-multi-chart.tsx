import { createMultiChart, type MultiChart, type MultiChartOptions } from '@funnest/charts-ui';
import { createContext, forwardRef, useContext, useEffect, useImperativeHandle, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { SlotsContext } from './fn-chart';

const MultiContext = createContext<MultiChart | null>(null);

export interface FnMultiChartProps extends MultiChartOptions {
  className?: string;
  /** The widget fills its container; give it a height (default 100%). */
  style?: CSSProperties;
  /** Called once per created widget (also after it's recreated for a new datafeed). */
  onReady?: (widget: MultiChart) => void;
  /** `<FnChartSlot>` elements and other children that use `useFnMultiChart()`. */
  children?: ReactNode;
}

/**
 * React wrapper around `createMultiChart`: split layout of 1–8 linked charts with one toolbar.
 * `panes`, `layout` and `sync` are read on mount (the user changes them from the toolbar; use
 * the ref's `setLayout`/`setSync`/`load` to drive them). `locale`, `theme` and `colorScheme`
 * stay in sync with props; a new `datafeed` recreates the widget.
 */
export const FnMultiChart = forwardRef<MultiChart | null, FnMultiChartProps>(function FnMultiChart(props, ref) {
  const { className, style, onReady, children, ...options } = props;
  const hostRef = useRef<HTMLDivElement>(null);
  const [widget, setWidget] = useState<MultiChart | null>(null);
  const latest = useRef(options);
  latest.current = options;
  const readyRef = useRef(onReady);
  readyRef.current = onReady;

  useImperativeHandle(ref, () => widget as MultiChart, [widget]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const instance = createMultiChart(host, latest.current);
    setWidget(instance);
    readyRef.current?.(instance);
    return () => {
      setWidget(null);
      instance.destroy();
    };
  }, [options.datafeed]);

  const { locale, theme, colorScheme } = options;
  useEffect(() => {
    if (widget && locale) widget.setLocale(locale);
  }, [widget, locale]);
  useEffect(() => {
    if (widget && colorScheme) widget.setColorScheme(colorScheme);
  }, [widget, colorScheme]);
  const themeKey = JSON.stringify(theme ?? null);
  useEffect(() => {
    if (widget && theme) widget.setTheme(theme);
  }, [widget, themeKey]);

  return (
    <div ref={hostRef} className={className} style={{ width: '100%', height: '100%', ...style }}>
      <MultiContext.Provider value={widget}>
        <SlotsContext.Provider value={widget?.slots ?? null}>{children}</SlotsContext.Provider>
      </MultiContext.Provider>
    </div>
  );
});

/** The surrounding `<FnMultiChart>`'s widget (null until mounted). */
export function useFnMultiChart(): MultiChart | null {
  return useContext(MultiContext);
}
