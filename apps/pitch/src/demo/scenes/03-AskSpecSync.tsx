import { DemoTiming, useDemoFrame, type DemoSceneProps } from "../timing";
import React from "react";
import { Easing, interpolate, spring, useVideoConfig } from "remotion";
import { ArrowUp, LayoutGrid } from "../ui/Icons";
import { SceneShell } from "./SceneShell";
import { BrandRow, Bubble, Shell } from "../ui/Shell";
import { TypedText } from "../ui/TypedText";
import { Cursor } from "../ui/Cursor";
import { Sfx } from "../ui/Sfx";
import { fontFamily } from "../fonts";

const ease = Easing.bezier(0.4, 0, 0.2, 1);
export const QUESTION =
  "Mostre as especificações da Ranger Raptor 2026: motor, potência, torque e transmissão.";
const SEND_AT = 186;

// 0:23–0:32 — the question typed into the product's empty state, sent, and
// the thread opening.
const AskSpecSyncContent: React.FC = () => {
  const frame = useDemoFrame();
  const { fps } = useVideoConfig();
  const sent = frame >= SEND_AT + 6;
  const emptyOut = interpolate(frame, [SEND_AT + 6, SEND_AT + 18], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: ease,
  });
  const bubbleIn = spring({
    frame: frame - (SEND_AT + 14),
    fps,
    durationInFrames: 18,
    config: { damping: 200 },
  });
  const brandIn = spring({
    frame: frame - 4,
    fps,
    durationInFrames: 20,
    config: { damping: 200 },
  });

  return (
    <SceneShell id="03-ask">
      <Shell
        title={sent ? "Especificações da Ranger Raptor" : "Nova conversa"}
        composer={sent}
      >
        {/* Empty state */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: emptyOut,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            paddingTop: 150,
          }}
        >
          <div
            style={{
              opacity: brandIn,
              translate: `0px ${(1 - brandIn) * 24}px`,
            }}
          >
            <BrandRow scale={1.15} />
          </div>
          <div
            style={{
              marginTop: 56,
              width: 1120,
              borderRadius: 26,
              border: "1px solid rgba(255,255,255,0.12)",
              backgroundColor: "rgba(28,28,30,0.96)",
              padding: "26px 30px 18px",
              boxShadow: "0 20px 60px -20px rgba(0,0,0,0.8)",
              opacity: brandIn,
            }}
          >
            <div
              style={{
                minHeight: 92,
                fontFamily,
                fontSize: 30,
                lineHeight: 1.45,
                color: "#f0f0f0",
              }}
            >
              <TypedText
                text={QUESTION}
                from={26}
                to={150}
                caretUntil={SEND_AT}
              />
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginTop: 6,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  fontFamily,
                  fontSize: 20,
                  color: "rgba(240,240,240,0.7)",
                }}
              >
                <span style={{ display: "flex", gap: 4 }}>
                  {[1, 1, 0].map((on, i) => (
                    <span
                      key={i}
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: 9999,
                        backgroundColor: "currentColor",
                        opacity: on ? 1 : 0.25,
                      }}
                    />
                  ))}
                </span>
                Equilibrado
              </div>
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 9999,
                  backgroundColor: "#066fef",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                }}
              >
                <ArrowUp size={26} strokeWidth={2.2} />
              </div>
            </div>
          </div>
          <div
            style={{
              marginTop: 26,
              width: 840,
              borderRadius: 18,
              backgroundColor: "#1a1a1d",
              border: "1px solid rgba(255,255,255,0.06)",
              padding: "18px 24px",
              display: "flex",
              gap: 18,
              alignItems: "center",
              opacity: brandIn,
              fontFamily,
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                backgroundColor: "rgba(6,111,239,0.18)",
                color: "#388cf2",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <LayoutGrid size={24} strokeWidth={2} />
            </div>
            <div>
              <div style={{ fontSize: 24, fontWeight: 500 }}>
                Explorar o catálogo de veículos
              </div>
              <div style={{ fontSize: 20, color: "#8f8f8f" }}>
                Busca, filtros, detalhes e lista de comparação.
              </div>
            </div>
          </div>
        </div>

        {/* Thread */}
        {sent ? (
          <div
            style={{
              position: "absolute",
              left: 200,
              right: 120,
              top: 40,
              opacity: bubbleIn,
              translate: `0px ${(1 - bubbleIn) * 40}px`,
            }}
          >
            <Bubble>{QUESTION}</Bubble>
          </div>
        ) : null}
      </Shell>

      <Cursor
        waypoints={[
          { frame: 140, x: 1500, y: 700 },
          { frame: 176, x: 1505, y: 526 },
          { frame: SEND_AT, x: 1505, y: 526, click: true },
          { frame: SEND_AT + 30, x: 1300, y: 640 },
        ]}
        visibleFrom={140}
        visibleUntil={SEND_AT + 40}
      />
      <Sfx name="mouse-click" from={SEND_AT} />
    </SceneShell>
  );
};

export const AskSpecSync: React.FC<DemoSceneProps> = ({
  durationInFrames = 270,
}) => (
  <DemoTiming durationInFrames={durationInFrames} sourceDurationInFrames={270}>
    <AskSpecSyncContent />
  </DemoTiming>
);
