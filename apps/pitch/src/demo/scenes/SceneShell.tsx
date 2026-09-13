import React from "react";
import { AbsoluteFill } from "remotion";
import { stage } from "../theme";

// Captions and narration belong to the parent composition.
export const SceneShell: React.FC<
  React.PropsWithChildren<{
    readonly id?: string;
    readonly background?: string;
    readonly captionBottom?: number;
  }>
> = ({ background = stage.dark, children }) => (
  <AbsoluteFill
    style={{
      backgroundColor: background,
      color: "#f0f0f0",
      overflow: "hidden",
    }}
  >
    {children}
  </AbsoluteFill>
);
