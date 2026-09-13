import React from "react";
import { Img, staticFile } from "remotion";
import { ArrowRight, FileText, PanelLeft, Plus, Search } from "./Icons";
import { fontFamily } from "../fonts";

// The SpecSync shell with the sidebar collapsed to its icon rail: 88px rail,
// 84px header, page on #0f0f0f. Pixel sizes are already frame-scale (1920).
type Props = {
  readonly title?: string;
  readonly children?: React.ReactNode;
  readonly composer?: boolean;
  readonly composerText?: React.ReactNode;
  readonly dim?: number;
};

export const RAIL = 88;
export const HEADER = 84;

export const Shell: React.FC<Props> = ({
  title = "Nova conversa",
  children,
  composer = true,
  composerText,
  dim = 0,
}) => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      display: "flex",
      fontFamily,
      color: "#f0f0f0",
      backgroundColor: "#0f0f0f",
      fontSize: 24,
      lineHeight: 1.45,
    }}
  >
    <aside
      style={{
        width: RAIL,
        flexShrink: 0,
        backgroundColor: "#141414",
        borderRight: "1px solid rgba(255,255,255,0.06)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        paddingTop: 26,
        gap: 34,
        color: "#b2b2b2",
      }}
    >
      <PanelLeft size={26} strokeWidth={1.75} />
      <Plus size={26} strokeWidth={1.75} />
      <FileText size={26} strokeWidth={1.75} />
      <Search size={26} strokeWidth={1.75} />
    </aside>
    <main
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        minWidth: 0,
        position: "relative",
      }}
    >
      <header
        style={{
          height: HEADER,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 40px",
          flexShrink: 0,
        }}
      >
        <div style={{ fontWeight: 500, fontSize: 26 }}>{title}</div>
        <Plus size={26} strokeWidth={1.75} color="#b2b2b2" />
      </header>
      <section style={{ flex: 1, position: "relative", minHeight: 0 }}>
        {children}
      </section>
      {composer ? (
        <div
          style={{
            position: "absolute",
            left: "50%",
            bottom: 56,
            translate: "-50% 0",
            width: 1040,
            height: 78,
            borderRadius: 22,
            border: "1px solid rgba(255,255,255,0.10)",
            backgroundColor: "rgba(28,28,30,0.96)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 30px",
            color: composerText ? "#f0f0f0" : "#8f8f8f",
            fontSize: 26,
            boxShadow: "0 12px 40px -12px rgba(0,0,0,0.7)",
          }}
        >
          <span>{composerText ?? "Escreva para o SpecSync…"}</span>
          <ArrowRight size={26} strokeWidth={2} color="#b2b2b2" />
        </div>
      ) : null}
    </main>
    {dim > 0 ? (
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: `rgba(6,7,12,${dim})`,
        }}
      />
    ) : null}
  </div>
);

// Ford script + hairline + wordmark, as in the product's empty state.
export const BrandRow: React.FC<{
  readonly style?: React.CSSProperties;
  readonly scale?: number;
}> = ({ style, scale = 1 }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 20 * scale,
      color: "#066fef",
      ...style,
    }}
  >
    <Img
      src={staticFile("demo3100/brand/ford-script-action-blue.svg")}
      style={{ width: 176 * scale }}
    />
    <div style={{ width: 2, height: 46 * scale, backgroundColor: "#066fef" }} />
    <div
      style={{
        fontFamily,
        fontSize: 48 * scale,
        fontWeight: 600,
        letterSpacing: -1,
      }}
    >
      SpecSync
    </div>
  </div>
);

// Right-aligned user message.
export const Bubble: React.FC<{
  readonly children: React.ReactNode;
  readonly style?: React.CSSProperties;
}> = ({ children, style }) => (
  <div style={{ display: "flex", justifyContent: "flex-end", ...style }}>
    <div
      style={{
        maxWidth: 1100,
        borderRadius: 26,
        backgroundColor: "#1f1f22",
        border: "1px solid rgba(255,255,255,0.06)",
        padding: "18px 28px",
        fontSize: 26,
        lineHeight: 1.5,
        color: "#f0f0f0",
      }}
    >
      {children}
    </div>
  </div>
);

// Value pill with the numbered index used by comparisons.
export const ValuePill: React.FC<{
  readonly index?: number;
  readonly children: React.ReactNode;
  readonly tone?: "primary" | "default" | "muted";
  readonly size?: number;
}> = ({ index, children, tone = "default", size = 26 }) => (
  <span
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 12,
      borderRadius: 14,
      backgroundColor:
        tone === "primary"
          ? "#0b1d6b"
          : tone === "muted"
            ? "transparent"
            : "#232326",
      border:
        tone === "muted"
          ? "1px solid rgba(255,255,255,0.12)"
          : "1px solid transparent",
      padding: `${size * 0.4}px ${size * 0.8}px`,
      fontSize: size,
      fontWeight: tone === "muted" ? 400 : 600,
      color: tone === "muted" ? "#8f8f8f" : "#ffffff",
      whiteSpace: "nowrap",
      fontVariantNumeric: "tabular-nums",
      letterSpacing: -0.3,
    }}
  >
    {index !== undefined ? (
      <span
        style={{
          fontSize: size * 0.6,
          color: "rgba(255,255,255,0.55)",
          fontWeight: 500,
        }}
      >
        {index}
      </span>
    ) : null}
    {children}
  </span>
);
