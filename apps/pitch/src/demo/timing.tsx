import React, { createContext, useContext } from "react";
import { useCurrentFrame } from "remotion";

export type DemoSceneProps = { readonly durationInFrames?: number };
const Timing = createContext({
  sourceDurationInFrames: 1,
  durationInFrames: 1,
});

export const DemoTiming: React.FC<
  React.PropsWithChildren<{
    readonly sourceDurationInFrames: number;
    readonly durationInFrames: number;
  }>
> = ({ children, sourceDurationInFrames, durationInFrames }) => (
  <Timing.Provider value={{ sourceDurationInFrames, durationInFrames }}>
    {children}
  </Timing.Provider>
);

export const useDemoFrame = () => {
  const frame = useCurrentFrame();
  const { sourceDurationInFrames, durationInFrames } = useContext(Timing);
  return (frame * sourceDurationInFrames) / durationInFrames;
};

export const useDemoTimeScale = () => {
  const { sourceDurationInFrames, durationInFrames } = useContext(Timing);
  return durationInFrames / sourceDurationInFrames;
};
