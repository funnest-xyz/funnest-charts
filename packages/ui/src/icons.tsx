/** @jsxImportSource preact */
import type { ComponentChildren } from 'preact';

function Icon({ children, size = 20 }: { children: ComponentChildren; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      stroke-width="1.6"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const SearchIcon = () => (
  <Icon size={18}>
    <circle cx="9" cy="9" r="5.5" />
    <path d="M13 13l3.5 3.5" />
  </Icon>
);

export const CloseIcon = () => (
  <Icon>
    <path d="M5.5 5.5l9 9M14.5 5.5l-9 9" />
  </Icon>
);

export const CameraIcon = () => (
  <Icon>
    <path d="M3.5 7.2c0-.9.7-1.6 1.6-1.6h1.6l1.2-1.8h4.2l1.2 1.8h1.6c.9 0 1.6.7 1.6 1.6v6.6c0 .9-.7 1.6-1.6 1.6H5.1c-.9 0-1.6-.7-1.6-1.6z" />
    <circle cx="10" cy="10.4" r="2.6" />
  </Icon>
);

export const ExpandIcon = () => (
  <Icon>
    <path d="M4 8V4h4M16 8V4h-4M4 12v4h4M16 12v4h-4" />
  </Icon>
);

export const CollapseIcon = () => (
  <Icon>
    <path d="M8 4v4H4M12 4v4h4M8 16v-4H4M12 16v-4h4" />
  </Icon>
);

export const MinusIcon = () => (
  <Icon size={18}>
    <path d="M5 10h10" />
  </Icon>
);

export const PlusIcon = () => (
  <Icon size={18}>
    <path d="M5 10h10M10 5v10" />
  </Icon>
);

export const ChevronLeftIcon = () => (
  <Icon size={18}>
    <path d="M12 5l-5 5 5 5" />
  </Icon>
);

export const ChevronRightIcon = () => (
  <Icon size={18}>
    <path d="M8 5l5 5-5 5" />
  </Icon>
);

export const ResetIcon = () => (
  <Icon size={18}>
    <path d="M4.5 10a5.5 5.5 0 1 0 1.7-4" />
    <path d="M4.5 3.5V7H8" />
  </Icon>
);

export const ToRealtimeIcon = () => (
  <Icon size={18}>
    <path d="M5 5.5l4.5 4.5L5 14.5M10 5.5l4.5 4.5-4.5 4.5" />
  </Icon>
);

export const ChevronDownIcon = () => (
  <Icon size={14}>
    <path d="M5 8l5 5 5-5" />
  </Icon>
);

export const CursorIcon = () => (
  <Icon>
    <path d="M5 3.5l10 6.2-4.4 1.1-2 4.2z" />
  </Icon>
);

export const TrendLineIcon = () => (
  <Icon>
    <path d="M5 15L15 5" />
    <circle cx="5" cy="15" r="1.6" fill="currentColor" />
    <circle cx="15" cy="5" r="1.6" fill="currentColor" />
  </Icon>
);

export const HorizontalLineIcon = () => (
  <Icon>
    <path d="M3 10h14" />
    <circle cx="10" cy="10" r="1.6" fill="currentColor" />
  </Icon>
);

export const FibonacciIcon = () => (
  <Icon>
    <path d="M3 4.5h14M3 8.2h14M3 11.8h14M3 15.5h14" />
  </Icon>
);

export const TrashIcon = () => (
  <Icon>
    <path d="M4.5 6h11M8 6V4.5h4V6M6 6l.7 9.5h6.6L14 6" />
  </Icon>
);

export const PencilIcon = () => (
  <Icon>
    <path d="M12.8 4.2l3 3L7.5 15.5 4 16l.5-3.5z" />
  </Icon>
);

export const CandlesIcon = () => (
  <Icon>
    <path d="M6.5 3.5v13M13.5 3.5v13" />
    <rect x="4.5" y="6" width="4" height="6" rx="0.8" fill="currentColor" />
    <rect x="11.5" y="8" width="4" height="5" rx="0.8" />
  </Icon>
);

export const LineChartIcon = () => (
  <Icon>
    <path d="M3 14l4.5-5 3.5 3 6-7" />
  </Icon>
);

export const AreaChartIcon = () => (
  <Icon>
    <path d="M3 14l4.5-5 3.5 3 6-7" />
    <path d="M3 14l4.5-5 3.5 3 6-7V17H3z" fill="currentColor" fill-opacity="0.25" stroke="none" />
  </Icon>
);

export const IndicatorIcon = () => (
  <Icon>
    <path d="M3 15.5l4-5 3 2.5 3.5-5L17 11" />
    <path d="M3 4.5v11.5h14" />
  </Icon>
);

export const GearIcon = () => (
  <Icon size={14}>
    <circle cx="10" cy="10" r="2.4" />
    <path d="M10 3v2M10 15v2M3 10h2M15 10h2M5 5l1.4 1.4M13.6 13.6L15 15M5 15l1.4-1.4M13.6 6.4L15 5" />
  </Icon>
);

export const SmallCloseIcon = () => (
  <Icon size={14}>
    <path d="M6 6l8 8M14 6l-8 8" />
  </Icon>
);

export const EyeIcon = () => (
  <Icon size={14}>
    <path d="M2 10s3-5.5 8-5.5S18 10 18 10s-3 5.5-8 5.5S2 10 2 10z" />
    <circle cx="10" cy="10" r="2.3" />
  </Icon>
);

export const EyeOffIcon = () => (
  <Icon size={14}>
    <path d="M3 3l14 14M8.2 5a8 8 0 0 1 1.8-.5c5 0 8 5.5 8 5.5a14 14 0 0 1-2.2 2.9M5.4 6.4A14 14 0 0 0 2 10s3 5.5 8 5.5a7.7 7.7 0 0 0 3.6-.9" />
  </Icon>
);

export const ChevronUpIcon = () => (
  <Icon size={14}>
    <path d="M5 12l5-5 5 5" />
  </Icon>
);

export const MagnetIcon = () => (
  <Icon>
    <path d="M5 4h3v6.5a2 2 0 0 0 4 0V4h3v6.5a5 5 0 0 1-10 0z" />
    <path d="M5 7h3M12 7h3" />
  </Icon>
);

export const StarIcon = ({ filled = false }: { filled?: boolean }) => (
  <Icon size={16}>
    <path
      d="M10 3.2l2.1 4.3 4.7.7-3.4 3.3.8 4.7L10 14l-4.2 2.2.8-4.7-3.4-3.3 4.7-.7z"
      fill={filled ? 'currentColor' : 'none'}
    />
  </Icon>
);

export const ClockIcon = () => (
  <Icon size={13}>
    <circle cx="10" cy="10" r="7" />
    <path d="M10 6v4l2.5 1.5" />
  </Icon>
);

export const WifiIcon = ({ bars = 3 }: { bars?: 0 | 1 | 2 | 3 }) => (
  <Icon size={14}>
    <path d="M3 8.5a10 10 0 0 1 14 0" opacity={bars >= 3 ? 1 : 0.25} />
    <path d="M5.5 11a6.5 6.5 0 0 1 9 0" opacity={bars >= 2 ? 1 : 0.25} />
    <path d="M8 13.5a3 3 0 0 1 4 0" opacity={bars >= 1 ? 1 : 0.25} />
    <circle cx="10" cy="16" r="0.9" fill="currentColor" />
  </Icon>
);

export const CollapseLeftIcon = () => (
  <Icon size={14}>
    <path d="M11 5l-5 5 5 5M15 5l-5 5 5 5" />
  </Icon>
);

export const SettingsIcon = () => (
  <Icon>
    <path d="M10 12.6a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0 5.2z" />
    <path d="M16.2 12a1.3 1.3 0 0 0 .26 1.43l.05.05a1.6 1.6 0 1 1-2.26 2.26l-.05-.05a1.3 1.3 0 0 0-1.43-.26 1.3 1.3 0 0 0-.79 1.19v.14a1.6 1.6 0 0 1-3.2 0v-.07a1.3 1.3 0 0 0-.85-1.19 1.3 1.3 0 0 0-1.43.26l-.05.05a1.6 1.6 0 1 1-2.26-2.26l.05-.05A1.3 1.3 0 0 0 4.5 12a1.3 1.3 0 0 0-1.19-.79h-.14a1.6 1.6 0 0 1 0-3.2h.07a1.3 1.3 0 0 0 1.19-.85 1.3 1.3 0 0 0-.26-1.43l-.05-.05a1.6 1.6 0 1 1 2.26-2.26l.05.05a1.3 1.3 0 0 0 1.43.26h.06a1.3 1.3 0 0 0 .79-1.19v-.14a1.6 1.6 0 0 1 3.2 0v.07a1.3 1.3 0 0 0 .79 1.19 1.3 1.3 0 0 0 1.43-.26l.05-.05a1.6 1.6 0 1 1 2.26 2.26l-.05.05a1.3 1.3 0 0 0-.26 1.43v.06a1.3 1.3 0 0 0 1.19.79h.14a1.6 1.6 0 0 1 0 3.2h-.07a1.3 1.3 0 0 0-1.19.79z" />
  </Icon>
);

/** Funnest brand mark (brand/logo-mark.svg). Colors are fixed on purpose. */
export const FunnestMark = () => (
  <svg width="20" height="20" viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <rect width="32" height="32" rx="9" fill="#6C4DFF" />
    <path d="M7 13.5C9.5 21.5 17 23.5 23.4 11.2" stroke="#fff" stroke-width="3.2" stroke-linecap="round" />
    <circle cx="24.6" cy="8.6" r="2.9" fill="#FFD43B" />
  </svg>
);

export const LinkIcon = () => (
  <Icon>
    <path d="M8.5 11.5a3 3 0 0 0 4.2 0l2.6-2.6a3 3 0 0 0-4.2-4.2l-1 1" />
    <path d="M11.5 8.5a3 3 0 0 0-4.2 0l-2.6 2.6a3 3 0 0 0 4.2 4.2l1-1" />
  </Icon>
);

export const MaximizeIcon = () => (
  <Icon size={16}>
    <path d="M11 4h5v5M9 16H4v-5M16 4l-5 5M4 16l5-5" />
  </Icon>
);

export const RestoreIcon = () => (
  <Icon size={16}>
    <path d="M15 9h-4V5M5 11h4v4M11 9l5-5M9 11l-5 5" />
  </Icon>
);

export const UndoIcon = () => (
  <Icon size={18}>
    <path d="M7 5L3.5 8.5 7 12" />
    <path d="M3.5 8.5h8.5a4.5 4.5 0 0 1 0 9H9" />
  </Icon>
);

export const RedoIcon = () => (
  <Icon size={18}>
    <path d="M13 5l3.5 3.5L13 12" />
    <path d="M16.5 8.5H8a4.5 4.5 0 0 0 0 9h3" />
  </Icon>
);

/** Two price lines diverging (compare symbols). */
export const CompareIcon = () => (
  <Icon>
    <path d="M3 14l4-4 3 2 7-7" />
    <path d="M3 9l4 2 3-3 7 5" opacity="0.55" />
  </Icon>
);

export const ReplayIcon = () => (
  <Icon>
    <path d="M5 4v12" />
    <path d="M16 4.5v11L8 10z" />
  </Icon>
);

export const PlayIcon = () => (
  <Icon size={18}>
    <path d="M6 4.5v11l9-5.5z" fill="currentColor" />
  </Icon>
);

export const PauseIcon = () => (
  <Icon size={18}>
    <path d="M7 4.5v11M13 4.5v11" stroke-width="2.4" />
  </Icon>
);

export const StepIcon = () => (
  <Icon size={18}>
    <path d="M4.5 4.5v11l8-5.5z" />
    <path d="M15.5 4.5v11" />
  </Icon>
);

/** Plugin tool icon: SVG markup from DrawingDefinition.icon (whole <svg> or just its children). */
export const SvgIcon = ({ markup }: { markup: string }) =>
  markup.trim().startsWith('<svg') ? (
    <span class="fnc-svg-icon" dangerouslySetInnerHTML={{ __html: markup }} />
  ) : (
    <svg
      width={20}
      height={20}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      stroke-width="1.6"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );

/** Tiny corner triangle on drawing-bar buttons that hold more tools. */
export const CornerIcon = () => (
  <svg width="6" height="6" viewBox="0 0 6 6" aria-hidden="true">
    <path d="M6 0v6H0z" fill="currentColor" />
  </svg>
);
