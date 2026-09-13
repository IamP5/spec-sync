import {
  comparisonEvidence,
  comparisonFootnote,
  comparisonRows,
  comparisonSummary,
  comparisonVehicles,
  fordComparisonSource,
} from "../data";
import { DemoTiming, useDemoFrame, type DemoSceneProps } from "../timing";
import React from "react";
import { Easing, interpolate, spring, useVideoConfig } from "remotion";
import { FileText, MessageSquareQuote, Search, X } from "../ui/Icons";
import { SceneShell } from "./SceneShell";
import { Shell } from "../ui/Shell";
import { Cursor } from "../ui/Cursor";
import { Sfx } from "../ui/Sfx";
import { Rise } from "../ui/Display";
import { fontFamily } from "../fonts";

const ease = Easing.bezier(0.4, 0, 0.2, 1);
const easeQuint = Easing.bezier(0.22, 1, 0.36, 1);
const columns = "330px repeat(3, minmax(0, 1fr))";
const TOGGLE_AT = 56;
const HERO_AT = 120;
const SOURCE_AT = 210;
const REVIEWS_AT = 290;

// Keep the source timing and row geometry stable as the comparison is enriched.
const CompareContent: React.FC = () => {
  const frame = useDemoFrame();
  const { fps } = useVideoConfig();
  const differences = frame >= TOGGLE_AT;
  const hero = interpolate(frame, [HERO_AT, HERO_AT + 16], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: ease,
  });
  const source = interpolate(frame, [SOURCE_AT, SOURCE_AT + 14], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: ease,
  });
  const drawer = interpolate(frame, [REVIEWS_AT, REVIEWS_AT + 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: easeQuint,
  });

  return (
    <SceneShell id="06-compare">
      <Shell title="Comparação · Raptor × Amarok × Shark" dim={drawer * 0.5}>
        <div
          style={{
            position: "absolute",
            left: 200,
            top: 30,
            width: 1480,
            fontFamily,
          }}
        >
          <Rise from={0}>
            <div style={{ fontSize: 22, color: "#8f8f8f" }}>
              {comparisonSummary}
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: columns,
                columnGap: 12,
                alignItems: "center",
                height: 72,
                marginTop: 14,
              }}
            >
              <div style={{ fontSize: 22, color: "#8f8f8f" }}>
                Configurações
              </div>
              {comparisonVehicles.map((vehicle) => (
                <div
                  key={vehicle.index}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                    minWidth: 0,
                  }}
                >
                  <span
                    style={{
                      width: 32,
                      height: 32,
                      flexShrink: 0,
                      borderRadius: 9999,
                      backgroundColor:
                        vehicle.index === 1 ? "#066fef" : "#2a2a2e",
                      color: "#fff",
                      fontSize: 18,
                      fontWeight: 700,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      marginTop: 5,
                    }}
                  >
                    {vehicle.index}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 28,
                        fontWeight: 600,
                        letterSpacing: -0.5,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {vehicle.name}
                    </div>
                    <div
                      style={{
                        fontSize: 20,
                        color: "#8f8f8f",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {vehicle.meta}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: 22,
                paddingBottom: 12,
                borderBottom: "1px solid rgba(255,255,255,0.08)",
                color: "#8f8f8f",
                fontSize: 22,
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Search size={20} /> Filtrar as especificações…
              </span>
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  color: differences ? "#f0f0f0" : "#8f8f8f",
                }}
              >
                Só as diferenças
                <span
                  style={{
                    width: 54,
                    height: 30,
                    borderRadius: 9999,
                    backgroundColor: differences ? "#066fef" : "#3a3a3e",
                    position: "relative",
                  }}
                >
                  <span
                    style={{
                      position: "absolute",
                      top: 3,
                      left: differences ? 27 : 3,
                      width: 24,
                      height: 24,
                      borderRadius: 9999,
                      backgroundColor: "#fff",
                    }}
                  />
                </span>
              </span>
            </div>
          </Rise>

          <div style={{ marginTop: 6 }}>
            {comparisonRows.map((row, i) => {
              const at = 14 + i * 9;
              const t = spring({
                frame: frame - at,
                fps,
                durationInFrames: 14,
                config: { damping: 200 },
              });
              const isHero = i === 0;
              const grow = isHero ? hero : 0;
              const first = row.cells[0];
              const sameKnownValues =
                first !== undefined &&
                row.cells.every(
                  (cell) =>
                    cell.known &&
                    cell.v === first.v &&
                    cell.note === first.note,
                );
              const hiddenByToggle = differences && sameKnownValues;
              return (
                <div
                  key={row.code}
                  style={{
                    display: "grid",
                    gridTemplateColumns: columns,
                    columnGap: 12,
                    alignItems: "center",
                    height: 60 + grow * 70,
                    borderBottom: "1px solid rgba(255,255,255,0.07)",
                    opacity: t * (hiddenByToggle ? 0 : 1),
                    translate: `0px ${(1 - t) * 14}px`,
                    backgroundColor: isHero
                      ? `rgba(6,111,239,${0.08 * grow})`
                      : "transparent",
                    borderRadius: 14,
                  }}
                >
                  <div style={{ minWidth: 0, paddingLeft: 14 * grow }}>
                    <div
                      style={{
                        fontSize: 24 + grow * 8,
                        lineHeight: 1.2,
                        color: "#e5e5e5",
                        fontWeight: isHero ? 600 : 400,
                      }}
                    >
                      {row.label}
                    </div>
                    {(isHero || row.note) && (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          marginTop: 3,
                          fontSize: 20,
                          lineHeight: "22px",
                          color: "#8f8f8f",
                          opacity: isHero ? grow : 1,
                          height: isHero ? 22 * grow : 22,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {isHero && <FileText size={17} />}
                        {row.note ?? "Fontes e observações"}
                      </div>
                    )}
                  </div>
                  {row.cells.map((cell, j) => (
                    <div
                      key={j}
                      style={{
                        minWidth: 0,
                        minHeight: 44,
                        borderRadius: 12,
                        backgroundColor: !cell.known
                          ? "transparent"
                          : j === 0
                            ? "#0b1d6b"
                            : "#232326",
                        border: cell.known
                          ? "1px solid transparent"
                          : "1px solid rgba(255,255,255,0.12)",
                        padding: `${3 + grow * 5}px 12px`,
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "center",
                        color: cell.known ? "#ffffff" : "#a3a3a3",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 24 + grow * 7,
                          lineHeight: 1.18,
                          fontWeight: cell.known ? 600 : 400,
                          letterSpacing: -0.45,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {cell.v}
                      </div>
                      {cell.note && (
                        <div
                          style={{
                            fontSize: 20,
                            lineHeight: "22px",
                            fontWeight: 400,
                            color: j === 0 ? "#B8CBFA" : "#AEB4BF",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {cell.note}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 14, fontSize: 20, color: "#8f8f8f" }}>
            {comparisonFootnote}
          </div>
        </div>
      </Shell>

      {/* The popover uses the same Ford source metadata as the evidence model. */}
      <div
        style={{
          position: "absolute",
          left: 540,
          top: 300,
          width: 720,
          borderRadius: 22,
          backgroundColor: "#1a1a1d",
          border: "1px solid rgba(255,255,255,0.12)",
          boxShadow: "0 40px 100px -30px rgba(0,0,0,0.9)",
          padding: "28px 34px",
          fontFamily,
          opacity: source * (1 - drawer),
          translate: `0px ${(1 - source) * 16}px`,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 24,
            fontWeight: 600,
          }}
        >
          Fontes e observações <X size={22} color="#8f8f8f" />
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginTop: 22,
            fontSize: 20,
            color: "#388cf2",
          }}
        >
          <FileText size={18} />{" "}
          <a
            href={fordComparisonSource.url}
            style={{ color: "inherit", textDecoration: "none" }}
          >
            Fonte oficial Ford ↗
          </a>
        </div>
        <div
          style={{
            fontSize: 32,
            fontWeight: 600,
            marginTop: 6,
            lineHeight: 1.2,
          }}
        >
          {fordComparisonSource.title}
        </div>
        <div
          style={{
            marginTop: 16,
            borderLeft: "4px solid #066fef",
            paddingLeft: 16,
            fontSize: 24,
            lineHeight: 1.3,
          }}
        >
          {fordComparisonSource.excerpt}
        </div>
        <div
          style={{
            marginTop: 14,
            fontSize: 20,
            lineHeight: 1.3,
            color: "#8f8f8f",
          }}
        >
          {fordComparisonSource.capturedLabel}
        </div>
        <div
          style={{
            marginTop: 20,
            height: 44,
            padding: "0 20px",
            display: "inline-flex",
            alignItems: "center",
            border: "1px solid rgba(255,255,255,0.18)",
            borderRadius: 9999,
            fontSize: 22,
            color: "#f0f0f0",
            textDecoration: "none",
          }}
        >
          Ver fontes dos veículos →
        </div>
      </div>

      {/* Fixed card heights reserve the lower-right area for the global QR. */}
      <div
        style={{
          position: "absolute",
          right: 0,
          top: 0,
          bottom: 0,
          width: 760,
          backgroundColor: "#151517",
          borderLeft: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "-40px 0 120px rgba(0,0,0,0.6)",
          translate: `${(1 - drawer) * 800}px 0px`,
          fontFamily,
          padding: "44px 52px",
          color: "#f0f0f0",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div
            style={{
              fontSize: 30,
              lineHeight: "36px",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <MessageSquareQuote size={28} color="#388cf2" /> Evidências da
            comparação
          </div>
          <X size={26} color="#8f8f8f" />
        </div>
        <div
          style={{
            fontSize: 20,
            lineHeight: "24px",
            color: "#8f8f8f",
            marginTop: 8,
          }}
        >
          Fontes por veículo · síntese das evidências
        </div>
        {comparisonEvidence.map((evidence) => (
          <Rise key={evidence.who} from={REVIEWS_AT + evidence.at}>
            <div
              style={{
                marginTop: 14,
                height: 222,
                borderRadius: 18,
                backgroundColor: "#1f1f22",
                padding: "16px 22px",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div
                style={{ fontSize: 20, lineHeight: "24px", color: "#b2b2b2" }}
              >
                {evidence.who}
              </div>
              <div
                style={{
                  fontSize: 26,
                  lineHeight: 1.18,
                  marginTop: 6,
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                  flexShrink: 0,
                }}
              >
                {evidence.text}
              </div>
              <div
                style={{
                  fontSize: 22,
                  lineHeight: 1.2,
                  marginTop: 8,
                  color: "#b2b2b2",
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                  flexShrink: 0,
                }}
              >
                {evidence.takeaway}
              </div>
              <a
                href={evidence.url}
                style={{
                  display: "inline-block",
                  marginTop: "auto",
                  paddingTop: 8,
                  fontSize: 20,
                  lineHeight: "24px",
                  color: "#388cf2",
                  fontWeight: 500,
                  textDecoration: "none",
                }}
              >
                {evidence.domain} ↗
              </a>
            </div>
          </Rise>
        ))}
      </div>

      <Cursor
        waypoints={[
          { frame: 20, x: 1200, y: 760 },
          { frame: TOGGLE_AT - 8, x: 1738, y: 266 },
          { frame: TOGGLE_AT, x: 1738, y: 266, click: true },
          { frame: HERO_AT - 6, x: 420, y: 410 },
          { frame: SOURCE_AT - 10, x: 380, y: 390 },
          { frame: SOURCE_AT, x: 380, y: 390, click: true },
          { frame: SOURCE_AT + 40, x: 900, y: 640 },
          { frame: REVIEWS_AT - 8, x: 775, y: 570 },
          { frame: REVIEWS_AT, x: 775, y: 570, click: true },
          { frame: REVIEWS_AT + 30, x: 980, y: 700 },
        ]}
        visibleFrom={20}
      />
      <Sfx name="switch" from={TOGGLE_AT} />
      <Sfx name="mouse-click" from={SOURCE_AT} />
      <Sfx name="mouse-click" from={REVIEWS_AT} />
    </SceneShell>
  );
};

export const Compare: React.FC<DemoSceneProps> = ({
  durationInFrames = 390,
}) => (
  <DemoTiming durationInFrames={durationInFrames} sourceDurationInFrames={390}>
    <CompareContent />
  </DemoTiming>
);
