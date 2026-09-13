import { useDemoFrame } from "../timing";
import React from "react";
import { Easing, interpolate, spring, useVideoConfig } from "remotion";
import { fontFamily } from "../fonts";
import { type } from "../theme";

const ease = Easing.bezier(0.4, 0, 0.2, 1);

// Keynote-style display text: rises 40px on a no-bounce spring, optionally
// exits by fading and drifting up. Frames are scene-local.
type Props = {
  readonly children: React.ReactNode;
  readonly from?: number;
  readonly until?: number;
  readonly size?: number;
  readonly weight?: number;
  readonly color?: string;
  readonly style?: React.CSSProperties;
  readonly tracking?: number;
  readonly lineHeight?: number;
};

export const Display: React.FC<Props> = ({
  children,
  from = 0,
  until,
  size = type.display,
  weight = 700,
  color = "#ffffff",
  style,
  tracking = type.tracking,
  lineHeight = 1.0,
}) => {
  const frame = useDemoFrame();
  const { fps } = useVideoConfig();
  const t = spring({
    frame: frame - from,
    fps,
    durationInFrames: 26,
    config: { damping: 200 },
  });
  const out =
    until === undefined
      ? 1
      : interpolate(frame, [until - 10, until], [1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: ease,
        });
  if (frame < from || (until !== undefined && frame >= until)) return null;
  return (
    <div
      style={{
        fontFamily,
        fontSize: size,
        fontWeight: weight,
        letterSpacing: `${tracking}em`,
        lineHeight,
        color,
        opacity: t * out,
        translate: `0px ${(1 - t) * 40 - (1 - out) * 24}px`,
        whiteSpace: "pre-line",
        ...style,
      }}
    >
      {children}
    </div>
  );
};

// Small uppercase label with tracking.
export const Kicker: React.FC<{
  readonly children: React.ReactNode;
  readonly from?: number;
  readonly color?: string;
  readonly style?: React.CSSProperties;
}> = ({ children, from = 0, color = "rgba(255,255,255,0.7)", style }) => {
  const frame = useDemoFrame();
  const o = interpolate(frame, [from, from + 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: ease,
  });
  return (
    <div
      style={{
        fontFamily,
        fontSize: 22,
        fontWeight: 600,
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        color,
        opacity: o,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

// Fade+rise for any block, ford.com style (12 frames, 32px).
export const Rise: React.FC<{
  readonly children: React.ReactNode;
  readonly from?: number;
  readonly until?: number;
  readonly offset?: number;
  readonly style?: React.CSSProperties;
}> = ({ children, from = 0, until, offset = 32, style }) => {
  const frame = useDemoFrame();
  const { fps } = useVideoConfig();
  const t = spring({
    frame: frame - from,
    fps,
    durationInFrames: 18,
    config: { damping: 200 },
  });
  const out =
    until === undefined
      ? 1
      : interpolate(frame, [until - 10, until], [1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: ease,
        });
  if (frame < from || (until !== undefined && frame >= until)) return null;
  return (
    <div
      style={{
        opacity: t * out,
        translate: `0px ${(1 - t) * offset}px`,
        ...style,
      }}
    >
      {children}
    </div>
  );
};
