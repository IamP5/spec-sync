import { useDemoFrame } from "../timing";
import React from "react";
import { interpolate } from "remotion";

// Typing effect driven by the frame: reveals `text` between `from` and `to`
// frames and blinks a caret while typing and for a moment after.
type Props = {
  readonly text: string;
  readonly from: number;
  readonly to: number;
  readonly caretUntil?: number;
  readonly style?: React.CSSProperties;
};

export const TypedText: React.FC<Props> = ({
  text,
  from,
  to,
  caretUntil,
  style,
}) => {
  const frame = useDemoFrame();
  const shown = Math.floor(
    interpolate(frame, [from, to], [0, text.length], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );
  const showCaret =
    frame >= from && frame <= (caretUntil ?? to + 20) && frame % 20 < 12;
  return (
    <span style={style}>
      {text.slice(0, shown)}
      <span style={{ opacity: showCaret ? 1 : 0, color: "#066fef" }}>|</span>
    </span>
  );
};
