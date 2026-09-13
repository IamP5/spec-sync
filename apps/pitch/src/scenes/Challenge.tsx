import {
  AbsoluteFill,
  CanvasImage,
  Easing,
  Interactive,
  interpolate,
  Sequence,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { fontFamily } from "../font";

const OpeningVerb: React.FC<{ children: string }> = ({ children }) => {
  const frame = useCurrentFrame();
  return (
    <Interactive.Div
      name={children}
      style={{ position: "absolute", left: 110, top: 215, overflow: "hidden" }}
    >
      <div
        style={{
          fontSize: 166,
          fontWeight: 650,
          lineHeight: 1.13,
          letterSpacing: -9,
          translate: interpolate(
            frame,
            [0, 17, 33, 40],
            ["0px 185px", "0px 0px", "0px 0px", "0px -195px"],
            {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.22, 1, 0.36, 1),
            },
          ),
        }}
      >
        {children}
      </div>
    </Interactive.Div>
  );
};

export const Challenge: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill
      name="The research challenge"
      style={{
        background: "#050914",
        color: "#FFFFFF",
        fontFamily,
        overflow: "hidden",
      }}
    >
      <AbsoluteFill
        name="Raptor opening film"
        style={{
          opacity: interpolate(frame, [116, 138], [1, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        <CanvasImage
          name="Raptor full frame"
          src={staticFile("brand/raptor-1.jpg")}
          style={{
            width: 1920,
            height: 1080,
            objectFit: "cover",
            objectPosition: "60% 48%",
            transformOrigin: "74% 58%",
            scale: interpolate(frame, [0, 120], [1.18, 1.02], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              output: "perceptual-scale",
              easing: Easing.bezier(0.14, 0.55, 0.36, 1),
            }),
          }}
        />
        <AbsoluteFill
          style={{
            background:
              "linear-gradient(90deg, #050914b8, #05091410 75%), linear-gradient(0deg, #0509149c, transparent 48%)",
          }}
        />
        <Sequence name="Know" durationInFrames={40}>
          <OpeningVerb>Conhecer.</OpeningVerb>
        </Sequence>
        <Sequence name="Compare" from={40} durationInFrames={40}>
          <OpeningVerb>Comparar.</OpeningVerb>
        </Sequence>
        <Sequence name="Decide" from={80} durationInFrames={40}>
          <OpeningVerb>Decidir.</OpeningVerb>
        </Sequence>
      </AbsoluteFill>

      <AbsoluteFill
        name="Scattered source material"
        style={{
          perspective: 1800,
          opacity: interpolate(frame, [116, 138, 272, 293], [0, 1, 1, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        <Interactive.Div
          name="Camera across sources"
          style={{
            position: "absolute",
            left: 0,
            top: 175,
            width: 3600,
            height: 700,
            transformStyle: "preserve-3d",
            translate: interpolate(
              frame,
              [124, 172, 216, 266, 290],
              [
                "480px 0px 0px",
                "110px 0px 0px",
                "-620px 0px 0px",
                "-1260px 0px 0px",
                "-1510px -25px -350px",
              ],
              {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: Easing.bezier(0.4, 0, 0.2, 1),
              },
            ),
          }}
        >
          <Interactive.Div
            name="Web source plane"
            style={{
              position: "absolute",
              left: 0,
              top: 50,
              width: 810,
              height: 610,
              padding: 65,
              boxSizing: "border-box",
              background: "#00095B",
              boxShadow: "0 45px 80px #00000060",
              rotate: "y 12deg",
              translate: "0px 0px -170px",
            }}
          >
            <div style={{ fontSize: 29, fontWeight: 550, color: "#FFFFFF99" }}>
              ford.com.br
            </div>
            <div
              style={{
                marginTop: 89,
                fontSize: 114,
                lineHeight: 0.94,
                letterSpacing: -7,
                fontWeight: 650,
              }}
            >
              Sites.
            </div>
            <div
              style={{
                position: "absolute",
                left: 65,
                bottom: 62,
                fontSize: 38,
                letterSpacing: -1,
              }}
            >
              Veículos. Versões. Detalhes.
            </div>
          </Interactive.Div>
          <Interactive.Div
            name="Technical document plane"
            style={{
              position: "absolute",
              left: 935,
              top: -25,
              width: 880,
              height: 710,
              background: "#FFFFFF",
              color: "#00095B",
              boxShadow: "0 50px 100px #00000075",
              overflow: "hidden",
              rotate: "y -5deg",
              translate: "0px 0px 0px",
            }}
          >
            <CanvasImage
              src={staticFile("brand/raptor-1.jpg")}
              style={{
                position: "absolute",
                inset: "0 0 auto 0",
                width: 880,
                height: 350,
                objectFit: "cover",
                objectPosition: "65% 43%",
              }}
            />
            <div
              style={{
                position: "absolute",
                top: 35,
                left: 44,
                fontSize: 31,
                letterSpacing: -0.8,
                fontWeight: 600,
                color: "#FFFFFF",
                textShadow: "0 2px 10px #0009",
              }}
            >
              Ranger Raptor
            </div>
            <div
              style={{
                position: "absolute",
                left: 54,
                top: 387,
                fontSize: 100,
                lineHeight: 0.97,
                letterSpacing: -6,
                fontWeight: 650,
              }}
            >
              Fichas
              <br />
              técnicas.
            </div>
          </Interactive.Div>
          <Interactive.Div
            name="Editorial source plane"
            style={{
              position: "absolute",
              left: 1970,
              top: 43,
              width: 970,
              height: 640,
              boxSizing: "border-box",
              padding: 64,
              background: "#E8EDF3",
              color: "#050914",
              boxShadow: "0 40px 80px #00000070",
              rotate: "y -11deg",
              translate: "0px 0px -160px",
            }}
          >
            <div style={{ fontSize: 28, color: "#066FEF", fontWeight: 600 }}>
              Análise automotiva
            </div>
            <div
              style={{
                marginTop: 116,
                fontSize: 100,
                lineHeight: 0.98,
                letterSpacing: -6,
                fontWeight: 650,
              }}
            >
              Reportagens.
            </div>
            <div
              style={{
                position: "absolute",
                left: 64,
                bottom: 72,
                fontSize: 37,
                letterSpacing: -1,
              }}
            >
              Novidades. Contexto. Mercado.
            </div>
          </Interactive.Div>
        </Interactive.Div>
      </AbsoluteFill>

      <AbsoluteFill
        name="The cost of manual research"
        style={{
          opacity: interpolate(frame, [280, 307], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.22, 1, 0.36, 1),
          }),
        }}
      >
        <Interactive.Div
          name="Ford blue reveal"
          style={{
            position: "absolute",
            inset: 0,
            background: "#00095B",
            clipPath: `inset(0 0 0 ${interpolate(frame, [276, 308], [100, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.65, 0, 0.2, 1),
            })}%)`,
          }}
        />
        <Interactive.Div
          name="One hour per trim"
          style={{
            position: "absolute",
            left: 122,
            top: 122,
            fontSize: 380,
            letterSpacing: -25,
            fontWeight: 580,
            lineHeight: 1.08,
            translate: interpolate(
              frame,
              [291, 321],
              ["0px 110px", "0px 0px"],
              {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: Easing.bezier(0.22, 1, 0.36, 1),
              },
            ),
            opacity: interpolate(frame, [293, 319], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        >
          ≈1h
        </Interactive.Div>
        <Interactive.Div
          name="Research time context"
          style={{
            position: "absolute",
            left: 140,
            top: 595,
            fontSize: 82,
            lineHeight: 1.12,
            fontWeight: 450,
            letterSpacing: -4,
            opacity: interpolate(frame, [309, 334], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
            translate: interpolate(frame, [309, 335], ["0px 35px", "0px 0px"], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.22, 1, 0.36, 1),
            }),
          }}
        >
          de pesquisa por versão
        </Interactive.Div>
        <Interactive.Div
          name="Ford challenge attribution"
          style={{
            position: "absolute",
            left: 145,
            top: 810,
            fontSize: 32,
            color: "#FFFFFFB8",
            letterSpacing: -0.6,
            opacity: interpolate(frame, [326, 345], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        >
          Estimativa do desafio Ford
        </Interactive.Div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
