import React from "react";
import { fontFamily } from "../fonts";

// Glossy Ford-blue sphere with a soft outer glow; the ontology's visual atom.
type Props = {
  readonly x: number;
  readonly y: number;
  readonly r: number;
  readonly opacity?: number;
  readonly scale?: number;
  readonly children?: React.ReactNode;
  readonly glow?: number;
};

export const Sphere: React.FC<Props> = ({
  x,
  y,
  r,
  opacity = 1,
  scale = 1,
  children,
  glow = 1,
}) => (
  <div
    style={{
      position: "absolute",
      left: x - r,
      top: y - r,
      width: 2 * r,
      height: 2 * r,
      opacity,
      scale: String(scale),
      transformOrigin: "center",
    }}
  >
    <div
      style={{
        position: "absolute",
        inset: -r * 0.9,
        borderRadius: 9999,
        background:
          "radial-gradient(circle, rgba(6,111,239,0.45) 0%, rgba(6,111,239,0.12) 40%, rgba(6,111,239,0) 70%)",
        opacity: glow,
      }}
    />
    <div
      style={{
        position: "absolute",
        inset: 0,
        borderRadius: 9999,
        background:
          "radial-gradient(circle at 34% 28%, #6aa6ff 0%, #1f5fe0 28%, #0b2fa8 58%, #06165c 100%)",
        boxShadow: `inset ${-r * 0.18}px ${-r * 0.22}px ${r * 0.5}px rgba(0,5,40,0.7), inset ${r * 0.08}px ${r * 0.1}px ${r * 0.3}px rgba(160,200,255,0.35), 0 ${r * 0.3}px ${r * 0.8}px rgba(0,9,91,0.6)`,
      }}
    />
    <div
      style={{
        position: "absolute",
        left: "22%",
        top: "12%",
        width: "34%",
        height: "22%",
        borderRadius: "50%",
        background:
          "radial-gradient(ellipse, rgba(255,255,255,0.55), rgba(255,255,255,0) 70%)",
      }}
    />
    {children ? (
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily,
          color: "#fff",
          textAlign: "center",
        }}
      >
        {children}
      </div>
    ) : null}
  </div>
);
