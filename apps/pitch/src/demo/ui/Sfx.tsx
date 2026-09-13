import React from "react";
import { Sequence, staticFile } from "remotion";
import { Audio } from "@remotion/media";
import { useDemoTimeScale } from "../timing";

// One-shot sound effect starting at `from` (scene-local frame).
export const Sfx: React.FC<{
  readonly name: "mouse-click" | "whoosh" | "switch";
  readonly from: number;
  readonly volume?: number;
}> = ({ name, from, volume = 0.35 }) => {
  const scale = useDemoTimeScale();
  return (
    <Sequence
      from={Math.round(from * scale)}
      durationInFrames={Math.ceil(45 * scale)}
      layout="none"
      name={`sfx ${name}`}
    >
      <Audio src={staticFile(`demo3100/sfx/${name}.wav`)} volume={volume} />
    </Sequence>
  );
};
