import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { bounded, motion } from "./Product";

export const ChapterCut: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ overflow: "hidden", pointerEvents: "none" }}>
      <AbsoluteFill
        style={{
          background: "#00095B",
          translate: `${interpolate(frame, [0, 7, 9, 16], [2000, 0, 0, -2000], { ...bounded, easing: motion })}px 0`,
          boxShadow: "35px 0 70px #066fef44",
        }}
      />
    </AbsoluteFill>
  );
};
