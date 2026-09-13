import React from "react";

type Props = {
  readonly size?: number;
  readonly color?: string;
  readonly strokeWidth?: number;
};
const icon = (children: React.ReactNode): React.FC<Props> => {
  const SvgIcon: React.FC<Props> = ({
    size = 24,
    color = "currentColor",
    strokeWidth = 2,
  }) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
  return SvgIcon;
};

export const ArrowUp = icon(
  <>
    <path d="M12 19V5" />
    <path d="m5 12 7-7 7 7" />
  </>,
);
export const ArrowRight = icon(
  <>
    <path d="M5 12h14" />
    <path d="m12 5 7 7-7 7" />
  </>,
);
export const Plus = icon(
  <>
    <path d="M12 5v14" />
    <path d="M5 12h14" />
  </>,
);
export const Minus = icon(<path d="M5 12h14" />);
export const X = icon(
  <>
    <path d="m18 6-12 12" />
    <path d="m6 6 12 12" />
  </>,
);
export const Check = icon(<path d="m20 6-11 11-5-5" />);
export const Search = icon(
  <>
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </>,
);
export const FileText = icon(
  <>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
    <path d="M14 2v6h6M8 13h8M8 17h8" />
  </>,
);
export const PanelLeft = icon(
  <>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M9 3v18" />
  </>,
);
export const LayoutGrid = icon(
  <>
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
  </>,
);
export const MessageSquareQuote = icon(
  <>
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z" />
    <path d="M8 7H6v3h3V7H8v5M15 7h-2v3h3V7h-1v5" />
  </>,
);
