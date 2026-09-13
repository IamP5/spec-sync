import { DemoTiming, useDemoFrame, type DemoSceneProps } from "../timing";
import React from "react";
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  spring,
  staticFile,
  useVideoConfig,
} from "remotion";
import { Check, Minus, Search } from "../ui/Icons";
import { SceneShell } from "./SceneShell";
import { Shell, ValuePill } from "../ui/Shell";
import { Rise } from "../ui/Display";
import { fontFamily } from "../fonts";

const ease = Easing.bezier(0.4, 0, 0.2, 1);

// Real values returned by the SpecSync API on 2026-09-12 for the Raptor.
const ROWS = [
  { label: "Motor", value: "3.0L V6 Bi-turbo", known: true, ford: "Motor" },
  { label: "Potência máxima", value: "397 cv", known: true, ford: "Potência" },
  {
    label: "Torque máximo",
    value: "583 Nm",
    known: true,
    ford: "Torque máximo",
  },
  {
    label: "Transmissão",
    value: "Automática de 10 velocidades",
    known: true,
    ford: "Transmissão",
  },
  { label: "Tração", value: "4WD", known: true, ford: "Tração" },
  {
    label: "Amortecedores",
    value: "FOX 2.5 Live Valve · Série",
    known: true,
    ford: "Amortecedores",
  },
  {
    label: "Aceleração de 0 a 100 km/h",
    value: "Não informado",
    known: false,
    ford: "0-100 km/h",
  },
  {
    label: "Modos de condução",
    value: "7 modos de condução",
    known: true,
    ford: "Modos de condução",
  },
  {
    label: "Modos de volante, escapamento e amortecedor",
    value: "Não informado",
    known: false,
    ford: "Modos de ajustes",
  },
  { label: "Faróis", value: "Matrix LED · Série", known: true, ford: "Faróis" },
  {
    label: "Rodas e pneus",
    value: '17" · 285/70 R17',
    known: true,
    ford: "Rodas e pneus",
  },
  {
    label: "Preço de referência",
    value: "Não informado",
    known: false,
    ford: "Preço",
  },
] as const;

const ROW_START = 26;
const ROW_EVERY = 12;
const SPOT_AT = 236;

// 0:48–1:00 — the same fixed format, normalized units, explicit gaps; Ford's
// slide-2 list ticks on the right; then the gap gets the spotlight.
const StandardOutputContent: React.FC = () => {
  const frame = useDemoFrame();
  const { fps } = useVideoConfig();
  const spot = interpolate(frame, [SPOT_AT, SPOT_AT + 16], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: ease,
  });
  const known = ROWS.filter((r) => r.known).length;
  const ticked = ROWS.filter(
    (_, i) => frame >= ROW_START + i * ROW_EVERY + 6,
  ).length;

  return (
    <SceneShell id="05-output">
      <Shell title="Especificações da Ranger Raptor" dim={spot * 0.7}>
        <div
          style={{
            position: "absolute",
            left: 200,
            top: 30,
            width: 1160,
            fontFamily,
          }}
        >
          <Rise from={0}>
            <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
              <div
                style={{
                  width: 150,
                  height: 92,
                  borderRadius: 12,
                  overflow: "hidden",
                }}
              >
                <Img
                  src={staticFile("demo3100/vehicles/ranger-raptor-hero.jpg")}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              </div>
              <div>
                <div
                  style={{
                    fontSize: 36,
                    fontWeight: 700,
                    letterSpacing: "-0.02em",
                  }}
                >
                  Ranger Raptor 3.0 V6 Bi-turbo 4WD AT
                </div>
                <div style={{ fontSize: 22, color: "#8f8f8f" }}>
                  Ford · BR · 2026 solicitado · fonte oficial · 12 atributos
                  pedidos
                </div>
              </div>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginTop: 22,
                color: "#8f8f8f",
                fontSize: 22,
              }}
            >
              <Search size={20} /> Filtrar as especificações…
            </div>
          </Rise>
          <div style={{ marginTop: 14 }}>
            {ROWS.map((row, i) => {
              const at = ROW_START + i * ROW_EVERY;
              const t = spring({
                frame: frame - at,
                fps,
                durationInFrames: 14,
                config: { damping: 200 },
              });
              return (
                <div
                  key={row.label}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    height: 56,
                    borderBottom: "1px solid rgba(255,255,255,0.07)",
                    opacity: t,
                    translate: `0px ${(1 - t) * 14}px`,
                  }}
                >
                  <div
                    style={{
                      fontSize: 24,
                      color: "#d0d0d0",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      maxWidth: 680,
                    }}
                  >
                    {row.label}
                  </div>
                  <ValuePill tone={row.known ? "default" : "muted"} size={22}>
                    {row.value}
                  </ValuePill>
                </div>
              );
            })}
          </div>
        </div>

        {/* Requested attribute coverage */}
        <div
          style={{
            position: "absolute",
            left: 1390,
            top: 40,
            width: 380,
            fontFamily,
          }}
        >
          <Rise from={10}>
            <div
              style={{
                fontSize: 18,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "#8f8f8f",
              }}
            >
              Especificações solicitadas
            </div>
            <div style={{ fontSize: 26, fontWeight: 600, marginTop: 4 }}>
              {ticked} de 12{" "}
              <span style={{ color: "#8f8f8f", fontWeight: 400 }}>
                · mesmo formato
              </span>
            </div>
          </Rise>
          <div
            style={{ marginTop: 22, display: "flex", flexDirection: "column" }}
          >
            {ROWS.map((row, i) => {
              const at = ROW_START + i * ROW_EVERY + 6;
              const t = spring({
                frame: frame - at,
                fps,
                durationInFrames: 12,
                config: { damping: 200 },
              });
              return (
                <div
                  key={row.ford}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    height: 46,
                    fontSize: 21,
                    color: row.known ? "#f0f0f0" : "#8f8f8f",
                    opacity: 0.35 + 0.65 * t,
                  }}
                >
                  <span
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 9999,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: row.known
                        ? "#066fef"
                        : "rgba(255,255,255,0.08)",
                      color: "#fff",
                      scale: String(0.6 + 0.4 * t),
                    }}
                  >
                    {row.known ? (
                      <Check size={16} strokeWidth={3} />
                    ) : (
                      <Minus size={16} strokeWidth={3} />
                    )}
                  </span>
                  <span
                    style={{
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {row.ford}
                  </span>
                </div>
              );
            })}
          </div>
          <Rise from={ROW_START + 12 * ROW_EVERY + 10}>
            <div
              style={{
                marginTop: 18,
                fontSize: 20,
                color: "#b2b2b2",
                lineHeight: 1.4,
              }}
            >
              {known} na fonte oficial · {12 - known} não informados,
              explícitos.
            </div>
          </Rise>
        </div>
      </Shell>

      {/* Spotlight on the gap */}
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: spot,
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            width: 1180,
            borderRadius: 28,
            backgroundColor: "#141416",
            border: "1px solid rgba(255,255,255,0.10)",
            boxShadow: "0 60px 140px -40px rgba(0,0,0,0.9)",
            padding: "48px 56px",
            fontFamily,
            scale: String(0.94 + 0.06 * spot),
            translate: "0px -40px",
          }}
        >
          <div style={{ fontSize: 24, color: "#8f8f8f" }}>
            Aceleração de 0 a 100 km/h
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 40,
              marginTop: 20,
            }}
          >
            <div>
              <div style={{ fontSize: 20, color: "#8f8f8f" }}>
                Ranger Raptor · fonte oficial
              </div>
              <div
                style={{
                  fontSize: 64,
                  fontWeight: 700,
                  letterSpacing: "-0.03em",
                  marginTop: 4,
                }}
              >
                Não informado
              </div>
            </div>
            <div>
              <div style={{ fontSize: 20, color: "#8f8f8f" }}>
                Preço de referência · fonte oficial
              </div>
              <div
                style={{
                  fontSize: 64,
                  fontWeight: 700,
                  letterSpacing: "-0.03em",
                  marginTop: 4,
                }}
              >
                Não informado
              </div>
            </div>
          </div>
          <div
            style={{
              marginTop: 26,
              fontSize: 28,
              color: "#388cf2",
              fontWeight: 500,
            }}
          >
            A lacuna permanece explícita. Nada é inferido de outra versão.
          </div>
        </div>
      </AbsoluteFill>
    </SceneShell>
  );
};

export const StandardOutput: React.FC<DemoSceneProps> = ({
  durationInFrames = 360,
}) => (
  <DemoTiming durationInFrames={durationInFrames} sourceDurationInFrames={360}>
    <StandardOutputContent />
  </DemoTiming>
);
