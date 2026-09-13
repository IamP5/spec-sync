import { useDemoFrame } from "../timing";
import React from "react";
import { Easing, interpolate } from "remotion";

// A fake pointer that travels through waypoints with an eased move and emits
// a click ring when a waypoint is marked as a click. Deterministic: driven by
// the frame only.
export type Waypoint = {
  readonly frame: number;
  readonly x: number;
  readonly y: number;
  readonly click?: boolean;
};

type Props = {
  readonly waypoints: readonly Waypoint[];
  readonly visibleFrom?: number;
  readonly visibleUntil?: number;
};

export const Cursor: React.FC<Props> = ({
  waypoints,
  visibleFrom = 0,
  visibleUntil = Infinity,
}) => {
  const frame = useDemoFrame();
  if (frame < visibleFrom || frame > visibleUntil || waypoints.length === 0)
    return null;

  const frames = waypoints.map((w) => w.frame);
  const x = interpolate(
    frame,
    frames,
    waypoints.map((w) => w.x),
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.bezier(0.4, 0, 0.2, 1),
    },
  );
  const y = interpolate(
    frame,
    frames,
    waypoints.map((w) => w.y),
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.bezier(0.4, 0, 0.2, 1),
    },
  );

  const lastClick = [...waypoints]
    .reverse()
    .find((w) => w.click && frame >= w.frame);
  const ringAge = lastClick ? frame - lastClick.frame : Infinity;
  const ringScale = interpolate(ringAge, [0, 12], [0.4, 1.8], {
    extrapolateRight: "clamp",
  });
  const ringOpacity = interpolate(ringAge, [0, 12], [0.7, 0], {
    extrapolateRight: "clamp",
  });
  const pressed = lastClick && ringAge < 5 ? 0.85 : 1;

  return (
    <div
      style={{ position: "absolute", left: x, top: y, pointerEvents: "none" }}
    >
      {ringAge < 14 ? (
        <div
          style={{
            position: "absolute",
            left: -22,
            top: -22,
            width: 44,
            height: 44,
            borderRadius: 9999,
            border: "3px solid #066fef",
            opacity: ringOpacity,
            scale: String(ringScale),
          }}
        />
      ) : null}
      <svg
        width={30}
        height={36}
        viewBox="0 0 24 28"
        style={{
          scale: String(pressed),
          filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.6))",
        }}
      >
        <path
          d="M4 2 L4 22 L9.5 17 L13 25 L16.5 23.5 L13 15.5 L20 15.5 Z"
          fill="#ffffff"
          stroke="#111111"
          strokeWidth={1.5}
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
};
