import type { ChartEvents } from '@funnest/charts';
import { createTradingChart, type TradingChart, type TradingChartOptions, type TradingChartSlots } from '@funnest/charts-ui';
import {
  createContext,
  forwardRef,
  useContext,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

const WidgetContext = createContext<TradingChart | null>(null);
/** Slots of the surrounding <FnChart> or <FnMultiChart>, for <FnChartSlot>. */
export const SlotsContext = createContext<TradingChartSlots | null>(null);

export interface FnChartProps extends TradingChartOptions {
  className?: string;
  /** The widget fills its container; give it a height (default 100%). */
  style?: CSSProperties;
  /** Called once per created widget (also after it's recreated for a new datafeed). */
  onReady?: (widget: TradingChart) => void;
  /** `<FnChartSlot>` elements and other children that use `useFnChart()`. */
  children?: ReactNode;
}

/**
 * React wrapper around `createTradingChart`. Creation-time options are read on mount;
 * `symbol`, `resolution`, `locale` and `theme` stay in sync with props; a new `datafeed`
 * recreates the widget. The ref exposes the widget (save/load, chart API, slots…).
 */
export const FnChart = forwardRef<TradingChart | null, FnChartProps>(function FnChart(props, ref) {
  const { className, style, onReady, children, ...options } = props;
  const hostRef = useRef<HTMLDivElement>(null);
  const [widget, setWidget] = useState<TradingChart | null>(null);
  // Latest props for the mount effect without re-running it on every render.
  const latest = useRef(options);
  latest.current = options;
  const readyRef = useRef(onReady);
  readyRef.current = onReady;

  useImperativeHandle(ref, () => widget as TradingChart, [widget]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const instance = createTradingChart(host, latest.current);
    setWidget(instance);
    readyRef.current?.(instance);
    return () => {
      setWidget(null);
      instance.destroy();
    };
  }, [options.datafeed]);

  const { symbol, resolution, locale, theme, colorScheme } = options;
  useEffect(() => {
    if (!widget) return;
    const current = widget.chart.symbolInfo?.symbol;
    const res = resolution ?? widget.chart.currentResolution ?? undefined;
    if (current && (current !== symbol || (resolution && resolution !== widget.chart.currentResolution))) {
      void widget.setSymbol(symbol, res);
    }
  }, [widget, symbol, resolution]);

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
      <WidgetContext.Provider value={widget}>
        <SlotsContext.Provider value={widget?.slots ?? null}>{children}</SlotsContext.Provider>
      </WidgetContext.Provider>
    </div>
  );
});

/** The surrounding `<FnChart>`'s widget (null until mounted). */
export function useFnChart(): TradingChart | null {
  return useContext(WidgetContext);
}

/** Subscribes to a chart event of the surrounding `<FnChart>` for the component's lifetime. */
export function useChartEvent<K extends keyof ChartEvents>(event: K, handler: (payload: ChartEvents[K]) => void): void {
  const widget = useFnChart();
  const handlerRef = useRef(handler);
  handlerRef.current = handler;
  useEffect(() => widget?.chart.on(event, (payload) => handlerRef.current(payload)), [widget, event]);
}

/**
 * Renders React children into one of the widget's slots ('toolbar', 'toolbarEnd', 'belowToolbar', 'bottom', 'footer')
 * — e.g. a market stats bar or account info — styled with the widget's `--fnc-*` variables.
 */
export function FnChartSlot({ name, children }: { name: keyof TradingChartSlots; children: ReactNode }) {
  const slots = useContext(SlotsContext);
  return slots ? createPortal(children, slots[name]) : null;
}
