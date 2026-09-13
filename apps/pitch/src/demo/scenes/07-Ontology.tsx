import { DemoTiming, useDemoFrame, type DemoSceneProps } from "../timing";
import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  spring,
  useVideoConfig,
} from "remotion";
import { SceneShell } from "./SceneShell";
import { Sphere } from "../ui/Sphere";
import { Display, Kicker, Rise } from "../ui/Display";
import { fontFamily } from "../fonts";

const ease = Easing.bezier(0.4, 0, 0.2, 1);
const C = { x: 1180, y: 560 };
const R = 210;

const SATS = [
  { at: 40, x: 560, y: 470, kicker: "Veículo", label: "Ranger Raptor" },
  { at: 90, x: 1700, y: 380, kicker: "Unidade", label: "cv" },
  {
    at: 140,
    x: 640,
    y: 830,
    kicker: "Fonte",
    label: "Ford Brasil · ficha técnica",
  },
  { at: 190, x: 1660, y: 840, kicker: "Evidência", label: "Fonte + trecho" },
] as const;

const ALIAS_AT = 270;
const ALIASES = [
  { at: 0, x: 430, y: 560, text: "potência", note: "pt-BR" },
  { at: 14, x: 1700, y: 560, text: "power", note: "en" },
  { at: 28, x: 1180, y: 250, text: "Leistung", note: "de" },
  {
    at: 42,
    x: 1180,
    y: 838,
    text: "Fonte + contexto",
    note: "preservados na interpretação",
  },
] as const;

const curve = (x: number, y: number) => {
  const mx = (x + C.x) / 2;
  const my = (y + C.y) / 2 - 60;
  return `M ${x} ${y} Q ${mx} ${my} ${C.x} ${C.y}`;
};

// 1:13–1:29 — the ontology: one concept with its vehicle, unit, source and
// evidence around it; then vendor terms converge on the same meaning.
const OntologyContent: React.FC = () => {
  const frame = useDemoFrame();
  const { fps } = useVideoConfig();
  const alias = frame >= ALIAS_AT;
  const satsOut = interpolate(frame, [ALIAS_AT - 14, ALIAS_AT], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: ease,
  });
  const heroIn = spring({
    frame: frame - 6,
    fps,
    durationInFrames: 30,
    config: { damping: 200 },
  });
  const breathe = 1 + 0.012 * Math.sin(frame / 18);
  const headlineOpacity = interpolate(
    frame,
    [150, 175, ALIAS_AT - 14, ALIAS_AT],
    [1, 0.28, 0.28, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <SceneShell id="07-ontology" background="#04060f">
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at 62% 52%, rgba(0,30,120,0.75) 0%, rgba(0,12,60,0.5) 30%, rgba(4,6,15,0) 68%)",
        }}
      />
      <AbsoluteFill
        style={{
          backgroundImage:
            "radial-gradient(circle at 62% 52%, transparent 0 200px, rgba(80,120,255,0.06) 201px 202px, transparent 203px 380px, rgba(80,120,255,0.05) 381px 382px, transparent 383px 560px, rgba(80,120,255,0.04) 561px 562px, transparent 563px)",
        }}
      />

      <div style={{ position: "absolute", left: 112, top: 90 }}>
        <Kicker from={0} color="rgba(255,255,255,0.5)">
          Visualização explicativa da ontologia
        </Kicker>
      </div>
      <div
        style={{
          position: "absolute",
          left: 104,
          top: 150,
          opacity: headlineOpacity,
        }}
      >
        <Display from={4} size={104}>
          Dados com significado.
        </Display>
      </div>

      {/* Edges */}
      <svg
        width={1920}
        height={1080}
        style={{ position: "absolute", inset: 0 }}
      >
        {SATS.map((s) => {
          const p = interpolate(frame, [s.at, s.at + 30], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: ease,
          });
          const e = { strokeDasharray: "1", strokeDashoffset: 1 - p };
          return (
            <path
              key={s.label}
              d={curve(s.x, s.y)}
              stroke="rgba(120,170,255,0.55)"
              strokeWidth={2.5}
              fill="none"
              pathLength={1}
              strokeDasharray={e.strokeDasharray}
              strokeDashoffset={e.strokeDashoffset}
              opacity={satsOut}
            />
          );
        })}
        {ALIASES.map((a) => {
          const p = interpolate(
            frame,
            [ALIAS_AT + a.at, ALIAS_AT + a.at + 30],
            [0, 1],
            {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: ease,
            },
          );
          const d = `M ${a.x} ${a.y} L ${C.x} ${C.y}`;
          const e = { strokeDasharray: "1", strokeDashoffset: 1 - p };
          return (
            <path
              key={a.text}
              d={d}
              stroke="rgba(120,170,255,0.45)"
              strokeWidth={2}
              fill="none"
              pathLength={1}
              strokeDasharray={e.strokeDasharray}
              strokeDashoffset={e.strokeDashoffset}
            />
          );
        })}
      </svg>

      {/* Satellites */}
      {SATS.map((s) => {
        const t = spring({
          frame: frame - s.at - 14,
          fps,
          durationInFrames: 20,
          config: { damping: 200 },
        });
        return (
          <React.Fragment key={s.label}>
            <Sphere
              x={s.x}
              y={s.y}
              r={26}
              opacity={t * satsOut}
              scale={0.6 + 0.4 * t}
              glow={0.6}
            />
            <div
              style={{
                position: "absolute",
                left: s.x - 260,
                top: s.y + 40,
                width: 520,
                textAlign: "center",
                fontFamily,
                opacity: t * satsOut,
                translate: `0px ${(1 - t) * 14}px`,
              }}
            >
              <div
                style={{
                  fontSize: 19,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  color: "rgba(255,255,255,0.55)",
                }}
              >
                {s.kicker}
              </div>
              <div style={{ fontSize: 32, fontWeight: 600, marginTop: 2 }}>
                {s.label}
              </div>
            </div>
          </React.Fragment>
        );
      })}

      {/* Aliases */}
      {ALIASES.map((a) => {
        const t = spring({
          frame: frame - (ALIAS_AT + a.at),
          fps,
          durationInFrames: 22,
          config: { damping: 200 },
        });
        const isBottom = a.y > 800;
        return (
          <div
            key={a.text}
            style={{
              position: "absolute",
              left: a.x - 300,
              top: a.y - (isBottom ? -10 : 92),
              width: 600,
              textAlign: "center",
              fontFamily,
              opacity: t,
              translate: `0px ${(1 - t) * 12}px`,
            }}
          >
            <div
              style={{
                fontSize: 52,
                fontWeight: 600,
                letterSpacing: "-0.02em",
                color: "#fff",
                textShadow: "0 0 40px rgba(6,111,239,0.6)",
              }}
            >
              {a.text}
            </div>
            <div
              style={{
                fontSize: 19,
                color: "rgba(255,255,255,0.5)",
                marginTop: 2,
              }}
            >
              {a.note}
            </div>
          </div>
        );
      })}

      {/* Concept */}
      <Sphere
        x={C.x}
        y={C.y}
        r={R}
        opacity={heroIn}
        scale={(0.7 + 0.3 * heroIn) * breathe}
      >
        <div
          style={{
            fontSize: 20,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.7)",
          }}
        >
          Conceito
        </div>
        <div style={{ fontSize: 40, fontWeight: 600, marginTop: 4 }}>
          Potência máxima
        </div>
        <div
          style={{
            fontSize: 96,
            fontWeight: 800,
            letterSpacing: "-0.04em",
            lineHeight: 1,
            marginTop: 6,
          }}
        >
          397
          <span style={{ fontSize: 40, fontWeight: 600, marginLeft: 10 }}>
            cv
          </span>
        </div>
      </Sphere>

      {alias ? (
        <div style={{ position: "absolute", left: 104, top: 150, fontFamily }}>
          <Rise from={ALIAS_AT + 40}>
            <div
              style={{
                fontSize: 88,
                fontWeight: 700,
                letterSpacing: "-0.04em",
                color: "#fff",
              }}
            >
              Um significado comum.
            </div>
            <div
              style={{
                fontSize: 30,
                color: "rgba(255,255,255,0.7)",
                marginTop: 8,
              }}
            >
              Pode alinhar o vocabulário Ford · unidades e contexto preservados
            </div>
          </Rise>
        </div>
      ) : null}
    </SceneShell>
  );
};

export const Ontology: React.FC<DemoSceneProps> = ({
  durationInFrames = 480,
}) => (
  <DemoTiming durationInFrames={durationInFrames} sourceDurationInFrames={480}>
    <OntologyContent />
  </DemoTiming>
);
