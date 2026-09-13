import React from "react";
import {
  AbsoluteFill,
  CanvasImage,
  Easing,
  Interactive,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { fontFamily } from "../font";

export const ink = "#071322";
export const blue = "#3c8bff";
export const mint = "#8aead2";
export const muted = "#aab8c9";
export const ease = Easing.bezier(0.16, 1, 0.3, 1);
export const clamp = {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
} as const;

export const Brand: React.FC<{ size?: number }> = ({ size = 36 }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 14,
      fontSize: size,
      fontWeight: 650,
      letterSpacing: -size * 0.05,
    }}
  >
    <svg width={size * 1.1} height={size * 1.1} viewBox="0 0 48 48" fill="none">
      <path
        d="M8 14h20l12 10-12 10H8l12-10L8 14Z"
        stroke="#79b5ff"
        strokeWidth="3.3"
        strokeLinejoin="round"
      />
      <path
        d="M20 14 8 24l12 10M28 14 16 24l12 10"
        stroke="#fff"
        strokeWidth="3.3"
        strokeLinejoin="round"
      />
    </svg>
    <span>SpecSync</span>
  </div>
);

export const Frame: React.FC<
  React.PropsWithChildren<{ chapter: string; index: number; future?: boolean }>
> = ({ chapter, index, future = false, children }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  return (
    <AbsoluteFill
      style={{
        background: ink,
        color: "#f8fbff",
        fontFamily,
        overflow: "hidden",
      }}
    >
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at 85% 5%, #17427388, transparent 57%)",
        }}
      />
      <AbsoluteFill
        style={{
          backgroundImage:
            "linear-gradient(#5d84b309 1px, transparent 1px),linear-gradient(90deg,#5d84b309 1px,transparent 1px)",
          backgroundSize: "80px 80px",
          opacity: 0.7,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 96,
          right: 96,
          top: 57,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Brand />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 18,
            fontSize: 23,
            color: muted,
          }}
        >
          {future && (
            <span
              style={{
                padding: "10px 18px",
                border: "1px solid #bf935c",
                borderRadius: 50,
                color: "#ffcf91",
                fontSize: 22,
              }}
            >
              Visão futura · conceito
            </span>
          )}
          <span>{String(index).padStart(2, "0")} / 08</span>
          <span style={{ width: 35, height: 1, background: "#68778c" }} />
          <span>{chapter}</span>
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 96,
          right: 96,
          top: 134,
          height: 1,
          background: "#dbe7fa1c",
        }}
      />
      {children}
      <div
        style={{
          position: "absolute",
          bottom: 39,
          left: 96,
          color: "#8194ad",
          fontSize: 18,
          letterSpacing: 2,
        }}
      >
        SPECSYNC / FORD · INTELIGÊNCIA COMPETITIVA
      </div>
      <div
        style={{
          position: "absolute",
          bottom: 45,
          right: 96,
          width: 210,
          height: 3,
          background: "#dbe7fa20",
        }}
      >
        <div
          style={{
            height: 3,
            width: `${interpolate(frame, [0, durationInFrames], [0, 100], clamp)}%`,
            background: future ? "#ffcf91" : blue,
          }}
        />
      </div>
    </AbsoluteFill>
  );
};

export const Reveal: React.FC<
  React.PropsWithChildren<{ delay?: number; style?: React.CSSProperties }>
> = ({ delay = 0, style, children }) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        ...style,
        opacity: interpolate(frame, [delay, delay + 22], [0, 1], clamp),
        translate: `0px ${interpolate(frame, [delay, delay + 32], [24, 0], { ...clamp, easing: ease })}px`,
      }}
    >
      {children}
    </div>
  );
};

export const Kicker: React.FC<React.PropsWithChildren<{ color?: string }>> = ({
  children,
  color = mint,
}) => (
  <div
    style={{
      fontSize: 22,
      fontWeight: 600,
      letterSpacing: 3.2,
      textTransform: "uppercase",
      color,
      marginBottom: 24,
    }}
  >
    {children}
  </div>
);

export const Headline: React.FC<
  React.PropsWithChildren<{ size?: number; style?: React.CSSProperties }>
> = ({ children, size = 82, style }) => (
  <Interactive.Div
    name="Título da cena"
    style={{
      fontSize: size,
      lineHeight: 1.04,
      fontWeight: 620,
      letterSpacing: -3.5,
      ...style,
    }}
  >
    {children}
  </Interactive.Div>
);

export const Pill: React.FC<React.PropsWithChildren<{ active?: boolean }>> = ({
  children,
  active = false,
}) => (
  <span
    style={{
      display: "inline-flex",
      alignItems: "center",
      borderRadius: 50,
      border: `1px solid ${active ? "#3c8bff" : "#6580a54d"}`,
      padding: "12px 23px",
      fontSize: 26,
      background: active ? "#2673e82b" : "#ffffff05",
      color: active ? "#b1d4ff" : "#d5deea",
    }}
  >
    {children}
  </span>
);

export const Check: React.FC<{ size?: number }> = ({ size = 28 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path
      d="m5 12 4 4L19 6"
      stroke={mint}
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const Capture: React.FC<{
  file: string;
  width: number;
  crop?: { x: number; y: number; width: number; height: number };
  style?: React.CSSProperties;
  label?: string;
}> = ({
  file,
  width,
  crop = { x: 65, y: 56, width: 1010, height: 530 },
  style,
  label = "Captura do SpecSync",
}) => {
  const scale = width / crop.width;
  return (
    <div style={{ width, ...style }}>
      <div
        style={{
          height: 39,
          background: "#1b2635",
          border: "1px solid #fff2",
          borderBottom: 0,
          borderRadius: "18px 18px 0 0",
          display: "flex",
          gap: 7,
          alignItems: "center",
          padding: "0 17px",
        }}
      >
        {["#7d8997", "#556173", "#394759"].map((color) => (
          <span
            key={color}
            style={{
              width: 8,
              height: 8,
              borderRadius: "100%",
              background: color,
            }}
          />
        ))}
        <span style={{ fontSize: 15, color: "#b6c1cf", marginLeft: 14 }}>
          {label}
        </span>
      </div>
      <div
        style={{
          position: "relative",
          width,
          height: crop.height * scale,
          overflow: "hidden",
          background: "#101010",
          border: "1px solid #ffffff20",
          borderRadius: "0 0 18px 18px",
          boxShadow: "0 24px 70px #0005",
        }}
      >
        <CanvasImage
          src={staticFile(file)}
          style={{
            position: "absolute",
            width: 1094 * scale,
            height: 718 * scale,
            left: -crop.x * scale,
            top: -crop.y * scale,
            maxWidth: "none",
          }}
        />
      </div>
    </div>
  );
};

export const Note: React.FC<
  React.PropsWithChildren<{ style?: React.CSSProperties }>
> = ({ children, style }) => (
  <div style={{ fontSize: 21, color: "#9dacc0", lineHeight: 1.4, ...style }}>
    {children}
  </div>
);
