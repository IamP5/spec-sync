import {
  AbsoluteFill,
  CanvasImage,
  Easing,
  Interactive,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { fontFamily } from "../font";

const ease = Easing.bezier(0.22, 1, 0.36, 1);
const accelerate = Easing.bezier(0.76, 0, 0.24, 1);
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
export const closeMotionEvents = { impactFrame: 401, ctaFrame: 598 } as const;

const commitments = [
  { at: 56, text: "Dados na sua nuvem." },
  { at: 96, text: "Evidência rastreável." },
  { at: 144, text: "Pessoas no comando." },
  { at: 183, text: "Trabalho agêntico." },
] as const;

// The sixty marks describe a visual transition, not a measured product latency.
const TimeArc: React.FC<{ frame: number }> = ({ frame }) => {
  const morph = interpolate(frame, [367, 421], [0, 1], {
    ...clamp,
    easing: accelerate,
  });
  const rotation = interpolate(frame, [278, 371], [-0.32, 0], {
    ...clamp,
    easing: ease,
  });
  const enter = interpolate(frame, [275, 300], [0, 1], clamp);
  const sweep = interpolate(frame, [298, 428], [0, 64], clamp);
  const lineIn = interpolate(frame, [406, 449], [0, 1], {
    ...clamp,
    easing: ease,
  });

  return (
    <svg
      width={1920}
      height={1080}
      viewBox="0 0 1920 1080"
      style={{ position: "absolute", inset: 0, overflow: "visible" }}
    >
      <defs>
        <linearGradient id="close-time-edge" x1="0" x2="1">
          <stop offset="0" stopColor="#066FEF" stopOpacity="0" />
          <stop offset="0.6" stopColor="#066FEF" />
          <stop offset="1" stopColor="#D6E8FF" />
        </linearGradient>
        <filter
          id="close-time-glow"
          x="-50%"
          y="-100%"
          width="200%"
          height="300%"
        >
          <feGaussianBlur stdDeviation="11" />
        </filter>
      </defs>
      <g opacity={enter}>
        {Array.from({ length: 60 }, (_, index) => {
          const angle = (index / 60) * Math.PI * 2 - Math.PI / 2 + rotation;
          const major = index % 5 === 0;
          const radius = 320;
          const length = major ? 25 : 13;
          const x1 = 960 + Math.cos(angle) * radius;
          const y1 = 486 + Math.sin(angle) * radius;
          const x2 = 960 + Math.cos(angle) * (radius + length);
          const y2 = 486 + Math.sin(angle) * (radius + length);
          const position = index / 59;
          const endX = 230 + position * 1395;
          const endY = 681 - Math.sin(position * Math.PI) * 37;
          const light = Math.max(0, 1 - Math.abs(index - sweep) / 5);
          return (
            <line
              key={index}
              x1={x1 + (endX - x1) * morph}
              y1={y1 + (endY - y1) * morph}
              x2={x2 + (endX + 18 - x2) * morph}
              y2={y2 + (endY - y2) * morph}
              stroke={light > 0.5 ? "#FFFFFF" : "#388CF2"}
              strokeWidth={major ? 4 : 2.5}
              strokeLinecap="round"
              opacity={(major ? 0.78 : 0.3) + light * 0.2}
            />
          );
        })}
      </g>
      <path
        d="M 230 681 Q 928 607 1692 681"
        fill="none"
        stroke="#066FEF"
        strokeWidth={28}
        filter="url(#close-time-glow)"
        opacity={lineIn * 0.65}
      />
      <path
        d="M 230 681 Q 928 607 1692 681"
        fill="none"
        stroke="url(#close-time-edge)"
        strokeWidth={5}
        pathLength={1}
        strokeDasharray={1}
        strokeDashoffset={1 - lineIn}
        opacity={lineIn}
      />
      <path
        d="M 1640 644 L 1692 681 L 1637 709"
        fill="none"
        stroke="#D6E8FF"
        strokeWidth={5}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={lineIn}
      />
    </svg>
  );
};

const FinalSurface: React.FC<{ frame: number }> = ({ frame }) => (
  <AbsoluteFill style={{ overflow: "hidden" }}>
    <Interactive.Div
      name="Ford blue sculpted surface"
      style={{
        position: "absolute",
        left: 880,
        top: -570,
        width: 1940,
        height: 1940,
        borderRadius: "50%",
        background:
          "linear-gradient(125deg, #00095B 12%, #00095B 35%, #066FEF 69%, #A1CEFF 81%, #FFFFFF 83%, #066FEF 86%)",
        rotate: "-22deg",
        translate: interpolate(
          frame,
          [535, 590, 840],
          ["780px 130px", "0px 0px", "-105px 35px"],
          {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.22, 1, 0.36, 1),
          },
        ),
      }}
    />
    <Interactive.Div
      name="Sculpted surface shadow"
      style={{
        position: "absolute",
        left: 690,
        top: -690,
        width: 1670,
        height: 1530,
        borderRadius: "50%",
        background: "#050914",
        rotate: "-22deg",
        boxShadow: "45px 35px 90px #05091488",
        translate: interpolate(
          frame,
          [535, 590, 840],
          ["850px 150px", "0px 0px", "-66px 10px"],
          {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.22, 1, 0.36, 1),
          },
        ),
      }}
    />
    <CanvasImage
      name="Ranger Raptor on the trail"
      src={staticFile("demo3100/vehicles/ranger-raptor-trail.jpg")}
      width={1130}
      height={1412}
      style={{
        position: "absolute",
        left: 910,
        top: -245,
        width: 1130,
        height: 1412,
        objectFit: "cover",
        opacity: interpolate(frame, [561, 606], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.bezier(0.22, 1, 0.36, 1),
        }),
        scale: interpolate(frame, [561, 840], [1.045, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.bezier(0.22, 1, 0.36, 1),
        }),
      }}
    />
    <AbsoluteFill
      style={{
        background:
          "linear-gradient(90deg, #050914 0%, #050914 46%, #050914EE 54%, #05091444 73%, #05091400 92%)",
      }}
    />
    <AbsoluteFill
      style={{
        background:
          "linear-gradient(180deg, #05091488 0%, #05091400 42%, #05091400 65%, #05091477 100%)",
      }}
    />
  </AbsoluteFill>
);

export const Close: React.FC<{ durationInFrames?: number }> = ({
  durationInFrames = 840,
}) => {
  const frame = (useCurrentFrame() * 840) / durationInFrames;

  return (
    <AbsoluteFill
      name="Delivery, impact and the next decision"
      style={{
        background: "#050914",
        color: "#FFFFFF",
        fontFamily,
        overflow: "hidden",
      }}
    >
      {frame < 276 ? (
        <AbsoluteFill
          name="How we deliver"
          style={{
            background: "#00095B",
            opacity: interpolate(frame, [258, 276], [1, 0], clamp),
          }}
        >
          <div
            style={{
              position: "absolute",
              width: 1500,
              height: 1500,
              borderRadius: "50%",
              right: -960,
              top: -420,
              border: "130px solid #066FEF",
              opacity: 0.16,
              translate: `${interpolate(frame, [0, 276], [100, -30], clamp)}px 0px`,
            }}
          />
          <Interactive.Div
            name="How we deliver title"
            style={{
              position: "absolute",
              left: 150,
              top: 116,
              fontSize: 32,
              fontWeight: 600,
              letterSpacing: 4.5,
              opacity: interpolate(frame, [0, 15], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
            }}
          >
            COMO ENTREGAMOS
          </Interactive.Div>
          <div
            style={{ position: "absolute", left: 145, top: 245, right: 100 }}
          >
            {commitments.map((line, index) => {
              const enter = spring({
                frame: frame - line.at,
                fps: 30,
                durationInFrames: 26,
                config: { damping: 200 },
              });
              const nextAt = commitments[index + 1]?.at ?? 1000;
              const focus = interpolate(
                frame,
                [nextAt, nextAt + 18],
                [1, 0.26],
                clamp,
              );
              return (
                <div
                  key={line.text}
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: 31,
                    height: 148,
                    opacity: enter * focus,
                    translate: `0px ${(1 - enter) * 46}px`,
                  }}
                >
                  <span
                    style={{
                      width: 54,
                      fontSize: 31,
                      fontWeight: 500,
                      color: "#7EB5FF",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    0{index + 1}
                  </span>
                  <span
                    style={{
                      fontSize: 124,
                      fontWeight: 620,
                      letterSpacing: -6.2,
                      lineHeight: 1.14,
                    }}
                  >
                    {line.text}
                  </span>
                </div>
              );
            })}
          </div>
          <div
            style={{
              position: "absolute",
              left: 230,
              top: 900,
              fontSize: 32,
              color: "#A7CFFF",
              opacity:
                frame >= 183
                  ? interpolate(frame, [225, 244], [0, 1], clamp)
                  : 0,
            }}
          >
            Agentes trabalham. Sua equipe decide.
          </div>
        </AbsoluteFill>
      ) : null}

      {frame >= 266 && frame < 553 ? (
        <AbsoluteFill
          name="Pilot impact ambition"
          style={{
            opacity: interpolate(
              frame,
              [266, 279, 532, 553],
              [0, 1, 1, 0],
              clamp,
            ),
            background:
              "radial-gradient(ellipse at 50% 47%, #00095B99 0%, #05091400 66%)",
          }}
        >
          <TimeArc frame={frame} />
          <Interactive.Div
            name="Pilot target qualification"
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: 88,
              textAlign: "center",
              fontSize: 30,
              fontWeight: 550,
              letterSpacing: 3,
              color: "#9BC8FF",
            }}
          >
            META DO PILOTO · REDUÇÃO A VALIDAR
          </Interactive.Div>
          <Interactive.Div
            name="One hour reference"
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: 310,
              textAlign: "center",
              fontSize: 312,
              fontWeight: 650,
              lineHeight: 1,
              letterSpacing: -19,
              opacity: interpolate(frame, [278, 300, 379, 399], [0, 1, 1, 0], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
              translate: interpolate(
                frame,
                [278, 300, 379, 408],
                ["0px 60px", "0px 0px", "0px 0px", "-160px -60px"],
                {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                  easing: Easing.bezier(0.22, 1, 0.36, 1),
                },
              ),
            }}
          >
            <span
              style={{
                fontSize: 192,
                fontWeight: 350,
                marginRight: 20,
                verticalAlign: "18px",
              }}
            >
              ≈
            </span>
            1h
          </Interactive.Div>
          <Interactive.Div
            name="Minutes ambition"
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: 324,
              textAlign: "center",
              fontSize: 278,
              fontWeight: 650,
              lineHeight: 1.05,
              letterSpacing: -16,
              opacity: interpolate(frame, [389, 401], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
              translate: interpolate(
                frame,
                [386, 415],
                ["180px 56px", "0px 0px"],
                {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                  easing: Easing.bezier(0.16, 1, 0.3, 1),
                },
              ),
              scale: interpolate(frame, [386, 423], [0.94, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: Easing.bezier(0.16, 1, 0.3, 1),
              }),
            }}
          >
            minutos
          </Interactive.Div>
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: interpolate(frame, [367, 421], [627, 727], {
                ...clamp,
                easing: accelerate,
              }),
              textAlign: "center",
              fontSize: 44,
              fontWeight: 450,
              letterSpacing: -1,
              opacity: interpolate(
                frame,
                [292, 313, 423, 441],
                [0, 1, 1, 0],
                clamp,
              ),
            }}
          >
            por versão pesquisada
          </div>
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: 747,
              textAlign: "center",
              fontSize: 37,
              lineHeight: 1.45,
              fontWeight: 450,
              color: "#C7DBF4",
              opacity: interpolate(frame, [439, 455], [0, 1], clamp),
              translate: `0px ${interpolate(frame, [439, 461], [24, 0], { ...clamp, easing: ease })}px`,
            }}
          >
            Mais tempo para analisar.
            <div
              style={{
                opacity: interpolate(frame, [477, 492], [0, 1], clamp),
                translate: `${interpolate(frame, [477, 497], [20, 0], { ...clamp, easing: ease })}px 0px`,
              }}
            >
              Mais espaço para inovar.
            </div>
          </div>
          <div
            style={{
              position: "absolute",
              left: -600,
              top: -150,
              width: 440,
              height: 1300,
              background:
                "linear-gradient(90deg, #066FEF00, #066FEF18, #8EC5FF0A, #066FEF00)",
              rotate: "-24deg",
              translate: `${interpolate(frame, [397, 456], [0, 2900], { ...clamp, easing: ease })}px 0px`,
              opacity: interpolate(
                frame,
                [397, 412, 440, 456],
                [0, 0.8, 0.8, 0],
                clamp,
              ),
              pointerEvents: "none",
            }}
          />
        </AbsoluteFill>
      ) : null}

      {frame >= 535 ? (
        <AbsoluteFill
          name="Build the next decision"
          style={{ opacity: interpolate(frame, [535, 553], [0, 1], clamp) }}
        >
          <FinalSurface frame={frame} />
          <Interactive.Div
            name="SpecSync wordmark"
            style={{
              position: "absolute",
              left: 144,
              top: 194,
              fontSize: 78,
              fontWeight: 620,
              letterSpacing: -4.5,
              opacity: interpolate(frame, [536, 551], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
              translate: interpolate(
                frame,
                [531, 559],
                ["0px 34px", "0px 0px"],
                {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                  easing: Easing.bezier(0.22, 1, 0.36, 1),
                },
              ),
            }}
          >
            SpecSync
          </Interactive.Div>
          <div
            style={{
              position: "absolute",
              left: 140,
              top: 363,
              width: 1690,
              height: 164,
              overflow: "hidden",
            }}
          >
            <Interactive.Div
              name="Build together"
              style={{
                fontSize: 136,
                fontWeight: 550,
                lineHeight: 1.12,
                letterSpacing: -7,
                translate: interpolate(
                  frame,
                  [568, 598],
                  ["0px 167px", "0px 0px"],
                  {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                    easing: Easing.bezier(0.22, 1, 0.36, 1),
                  },
                ),
              }}
            >
              Vamos construir
            </Interactive.Div>
          </div>
          <div
            style={{
              position: "absolute",
              left: 140,
              top: 518,
              width: 1690,
              height: 170,
              overflow: "hidden",
            }}
          >
            <Interactive.Div
              name="The next decision"
              style={{
                fontSize: 136,
                fontWeight: 550,
                lineHeight: 1.12,
                letterSpacing: -7,
                translate: interpolate(
                  frame,
                  [583, 613],
                  ["0px 170px", "0px 0px"],
                  {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                    easing: Easing.bezier(0.22, 1, 0.36, 1),
                  },
                ),
              }}
            >
              a próxima decisão.
            </Interactive.Div>
          </div>
          <Interactive.Div
            name="Pilot invitation"
            style={{
              position: "absolute",
              left: 146,
              top: 796,
              display: "flex",
              alignItems: "center",
              gap: 25,
              fontSize: 41,
              letterSpacing: -1.2,
              fontWeight: 450,
              color: "#84BAFF",
              opacity: interpolate(frame, [655, 682], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
              translate: interpolate(
                frame,
                [651, 686],
                ["0px 28px", "0px 0px"],
                {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                  easing: Easing.bezier(0.22, 1, 0.36, 1),
                },
              ),
            }}
          >
            Validar o fluxo com a Ford
            <svg width={42} height={42} viewBox="0 0 42 42" fill="none">
              <path
                d="M 8 34 L 34 8 M 9 8 H 34 V 33"
                stroke="currentColor"
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Interactive.Div>
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  );
};
