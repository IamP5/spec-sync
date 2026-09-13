import React from "react";
import {
  AbsoluteFill,
  CanvasImage,
  Easing,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { fontFamily } from "../font";

export const ford = "#066FEF";
export const navy = "#00095B";
export const motion = Easing.bezier(0.22, 1, 0.36, 1);
export const bounded = {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
} as const;

export const Icon: React.FC<{
  kind?: "search" | "add" | "arrow" | "check" | "file" | "grid";
  size?: number;
}> = ({ kind = "arrow", size = 30 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {kind === "search" ? (
      <>
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m16 16 4 4" />
      </>
    ) : kind === "add" ? (
      <path d="M12 4v16M4 12h16" />
    ) : kind === "check" ? (
      <path d="m5 12 4 4L19 6" />
    ) : kind === "file" ? (
      <>
        <path d="M5 3h9l5 5v13H5Z M14 3v6h5M8 13h8M8 17h6" />
      </>
    ) : kind === "grid" ? (
      <>
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M9 3v18M9 9h12" />
      </>
    ) : (
      <path d="M5 12h14m-6-6 6 6-6 6" />
    )}
  </svg>
);

export const Wordmark: React.FC<{ size?: number }> = ({ size = 64 }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: size * 0.22,
      fontSize: size,
      fontWeight: 560,
      letterSpacing: -size * 0.045,
      color: ford,
    }}
  >
    <CanvasImage
      src={staticFile("brand/ford-script-action-blue.svg")}
      style={{ width: size * 2.12, height: size * 0.95, objectFit: "contain" }}
    />
    <span style={{ width: 2, height: size * 0.7, background: "#4679d0" }} />
    <span>SpecSync</span>
  </div>
);

export const Cursor: React.FC<{
  x: number;
  y: number;
  click?: number;
  opacity?: number;
}> = ({ x, y, click = 0, opacity = 1 }) => (
  <div
    style={{
      position: "absolute",
      left: x,
      top: y,
      zIndex: 20,
      opacity,
      pointerEvents: "none",
    }}
  >
    {click > 0 && (
      <div
        style={{
          position: "absolute",
          width: 80,
          height: 80,
          left: -36,
          top: -36,
          borderRadius: "50%",
          border: "3px solid #76adff",
          scale: 1 + click,
          opacity: 1 - click,
        }}
      />
    )}
    <svg
      width="40"
      height="46"
      viewBox="0 0 32 38"
      style={{ filter: "drop-shadow(0 4px 6px #0009)" }}
    >
      <path
        d="m4 3 3 29 8-9 12-1Z"
        fill="#fff"
        stroke="#102b55"
        strokeWidth="2"
      />
    </svg>
  </div>
);

export const ProductShell: React.FC<
  React.PropsWithChildren<{
    title?: string;
    enter?: boolean;
    composer?: boolean;
  }>
> = ({ title = "Nova conversa", enter = false, composer = true, children }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill
      style={{
        fontFamily,
        background: navy,
        color: "#f5f5f5",
        perspective: 1900,
        overflow: "hidden",
      }}
    >
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at 70% 100%, #066fef99, transparent 65%)",
        }}
      />
      <AbsoluteFill
        style={{
          background: "#101010",
          overflow: "hidden",
          border: "1px solid #ffffff20",
          borderRadius: enter
            ? interpolate(frame, [0, 80], [28, 0], bounded)
            : 0,
          scale: enter
            ? interpolate(frame, [0, 80], [0.82, 1], {
                ...bounded,
                easing: motion,
              })
            : 1,
          transform: enter
            ? `rotateX(${interpolate(frame, [0, 80], [9, 0], { ...bounded, easing: motion })}deg) rotateY(${interpolate(frame, [0, 80], [-7, 0], { ...bounded, easing: motion })}deg)`
            : undefined,
          boxShadow: "0 50px 140px #0009",
        }}
      >
        <div
          style={{
            position: "absolute",
            width: 90,
            top: 0,
            bottom: 0,
            borderRight: "1px solid #ffffff15",
            background: "#171717",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 54,
            paddingTop: 30,
            color: "#b7b7b7",
          }}
        >
          <Icon kind="grid" />
          <Icon kind="add" />
          <Icon kind="file" />
          <Icon kind="search" />
        </div>
        <div
          style={{
            position: "absolute",
            left: 126,
            top: 28,
            right: 48,
            display: "flex",
            justifyContent: "space-between",
            fontSize: 29,
            color: "#dedede",
          }}
        >
          <span>{title}</span>
          <Icon kind="add" />
        </div>
        {children}
        {composer && (
          <div
            style={{
              position: "absolute",
              bottom: 121,
              left: 482,
              right: 388,
              background: "#202020",
              border: "1px solid #ffffff25",
              borderRadius: 20,
              height: 77,
              padding: "22px 28px",
              color: "#a4a4a4",
              fontSize: 29,
              display: "flex",
              justifyContent: "space-between",
              boxShadow: "0 -16px 50px #101010",
            }}
          >
            <span>Escreva para o SpecSync…</span>
            <Icon />
          </div>
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const Typed: React.FC<{
  text: string;
  start: number;
  end: number;
  size?: number;
}> = ({ text, start, end, size = 40 }) => {
  const f = useCurrentFrame();
  const count = Math.floor(
    interpolate(f, [start, end], [0, text.length], bounded),
  );
  return (
    <span style={{ fontSize: size, lineHeight: 1.38, letterSpacing: -0.6 }}>
      {text.slice(0, count)}
      <span
        style={{ color: ford, opacity: f < end + 15 && f % 26 < 16 ? 1 : 0 }}
      >
        │
      </span>
    </span>
  );
};

export const RealScreen: React.FC<{
  file: string;
  start: number;
  end: number;
  label?: string;
}> = ({ file, start, end, label = "SpecSync · interface real" }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill
      style={{
        background: "#101010",
        opacity: interpolate(
          frame,
          [start, start + 15, end - 15, end],
          [0, 1, 1, 0],
          bounded,
        ),
        pointerEvents: "none",
      }}
    >
      <CanvasImage
        src={staticFile(file)}
        style={{
          width: 1920,
          height: 1260,
          objectFit: "cover",
          objectPosition: "top",
          translate: "0 -10px",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 0,
          bottom: 0,
          width: 100,
          height: 140,
          background: "#171717",
        }}
      />
      <div
        style={{
          position: "absolute",
          right: 60,
          top: 110,
          fontSize: 24,
          color: "#b5c9e9",
          background: "#101010ee",
          padding: "12px 18px",
          borderRadius: 30,
        }}
      >
        {label}
      </div>
    </AbsoluteFill>
  );
};
