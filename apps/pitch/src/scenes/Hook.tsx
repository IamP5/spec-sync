import {
  AbsoluteFill,
  CanvasImage,
  Easing,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { fontFamily } from "../font";

const ease = {
  extrapolateLeft: "clamp" as const,
  extrapolateRight: "clamp" as const,
  easing: Easing.bezier(0.22, 1, 0.36, 1),
};

export const Hook: React.FC<{ durationInFrames: number }> = ({
  durationInFrames,
}) => {
  const frame = (useCurrentFrame() * 420) / durationInFrames;
  return (
    <AbsoluteFill
      name="The next competitive advantage"
      style={{
        background: "#050914",
        color: "white",
        fontFamily,
        overflow: "hidden",
      }}
    >
      <CanvasImage
        src={staticFile("brand/raptor-1.jpg")}
        style={{
          width: 1920,
          height: 1080,
          objectFit: "cover",
          objectPosition: "68% 50%",
          transformOrigin: "72% 57%",
          scale: interpolate(frame, [0, 250], [1.19, 1.025], {
            ...ease,
            output: "perceptual-scale",
          }),
        }}
      />
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(90deg, #050914d9, #05091445 60%, #05091405), linear-gradient(0deg, #050914b0, transparent 65%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 112,
          top: 112,
          fontSize: 35,
          letterSpacing: -1,
          fontWeight: 600,
          opacity: interpolate(frame, [0, 24], [0, 1], ease),
        }}
      >
        SpecSync
      </div>
      {[
        {
          text: (
            <>
              A próxima
              <br />
              vantagem.
            </>
          ),
          from: 12,
          until: 115,
        },
        {
          text: (
            <>
              Começa
              <br />
              na decisão.
            </>
          ),
          from: 120,
          until: 232,
        },
      ].map(({ text, from, until }) => (
        <div
          key={from}
          style={{
            position: "absolute",
            left: 106,
            top: 285,
            fontSize: 153,
            lineHeight: 1.02,
            letterSpacing: -8,
            fontWeight: 600,
            opacity: interpolate(
              frame,
              [from, from + 20, until - 12, until],
              [0, 1, 1, 0],
              ease,
            ),
            translate: `0 ${interpolate(frame, [from, from + 35], [65, 0], ease)}px`,
          }}
        >
          {text}
        </div>
      ))}
      <AbsoluteFill
        name="SpecSync brand reveal"
        style={{
          background: "#00095B",
          clipPath: `inset(0 0 0 ${interpolate(frame, [223, 250], [100, 0], ease)}%)`,
        }}
      >
        <div
          style={{
            position: "absolute",
            width: 1800,
            height: 1400,
            top: -800,
            left: 420,
            borderRadius: "50%",
            background: "#066FEF",
            rotate: "-26deg",
            translate: `0 ${interpolate(frame, [229, 390], [80, -300], ease)}px`,
          }}
        />
        <div
          style={{
            position: "absolute",
            width: 1770,
            height: 1390,
            top: -765,
            left: 315,
            borderRadius: "50%",
            background: "#00095B",
            rotate: "-26deg",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 112,
            top: 204,
            fontSize: 77,
            fontWeight: 650,
            letterSpacing: -4,
            opacity: interpolate(frame, [245, 271], [0, 1], ease),
          }}
        >
          SpecSync
        </div>
        <div
          style={{
            position: "absolute",
            left: 106,
            top: 378,
            fontSize: 139,
            fontWeight: 500,
            letterSpacing: -7,
            lineHeight: 1.05,
            opacity: interpolate(frame, [263, 289], [0, 1], ease),
            translate: `0 ${interpolate(frame, [260, 310], [58, 0], ease)}px`,
          }}
        >
          Inteligência
          <br />
          para ir além.
        </div>
        <div
          style={{
            position: "absolute",
            left: 116,
            top: 811,
            fontSize: 38,
            color: "#BCD5FF",
            letterSpacing: -1,
            opacity: interpolate(frame, [292, 322], [0, 1], ease),
          }}
        >
          Veículos. Especificações. Decisões.
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
