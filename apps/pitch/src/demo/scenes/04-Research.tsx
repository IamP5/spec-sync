import { DemoTiming, useDemoFrame, type DemoSceneProps } from "../timing";
import React from "react";
import { Easing, interpolate, spring, useVideoConfig } from "remotion";
import { ArrowRight, Check, FileText, X } from "../ui/Icons";
import { SceneShell } from "./SceneShell";
import { Bubble, Shell } from "../ui/Shell";
import { Cursor } from "../ui/Cursor";
import { Sfx } from "../ui/Sfx";
import { Rise } from "../ui/Display";
import { fontFamily } from "../fonts";
import { QUESTION } from "./03-AskSpecSync";

const ease = Easing.bezier(0.4, 0, 0.2, 1);
const easeQuint = Easing.bezier(0.22, 1, 0.36, 1);

const STEPS = [
  { at: 0, n: 1, label: "Pesquisando fontes" },
  { at: 60, n: 2, label: "Capturando a ficha técnica" },
  { at: 120, n: 3, label: "Verificando as versões" },
  { at: 190, n: 4, label: "Pronta para revisão" },
] as const;

const EVIDENCE_AT = 250;
const DECISION_AT = 330;
const PICK_AT = 408;

// 0:32–0:48 — agents find the official source, extract and keep the
// evidence; the reviewer checks the proposed publication before confirming vehicle identity.
const ResearchContent: React.FC = () => {
  const frame = useDemoFrame();
  const step = [...STEPS].reverse().find((s) => frame >= s.at) ?? STEPS[0];
  const panel = interpolate(frame, [EVIDENCE_AT, EVIDENCE_AT + 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: easeQuint,
  });
  const decision = frame >= DECISION_AT;
  const swap = interpolate(frame, [DECISION_AT, DECISION_AT + 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: ease,
  });
  const picked = frame >= PICK_AT;

  return (
    <SceneShell id="04-research" captionBottom={44}>
      <Shell title="Especificações da Ranger Raptor" dim={panel * 0.55}>
        <div style={{ position: "absolute", left: 200, right: 120, top: 40 }}>
          <Bubble>{QUESTION}</Bubble>
        </div>

        <div
          style={{
            position: "absolute",
            left: 200,
            top: 190,
            width: 1360,
            fontFamily,
          }}
        >
          <Rise from={4}>
            <div style={{ fontSize: 22, color: "#8f8f8f" }}>
              Pesquisa de veículos
            </div>
            <div
              style={{
                fontSize: 52,
                fontWeight: 700,
                letterSpacing: "-0.03em",
                marginTop: 4,
              }}
            >
              Conhecendo o Ford Ranger Raptor.
            </div>
            <div style={{ fontSize: 22, color: "#8f8f8f", marginTop: 6 }}>
              BR · 2026 solicitado · confirme o ano-modelo nas evidências
            </div>
          </Rise>

          {/* Step */}
          <div
            style={{
              marginTop: 44,
              display: "flex",
              alignItems: "center",
              gap: 22,
            }}
          >
            <StepBadge n={step.n} done={step.n === 4} />
            <div>
              <div
                style={{
                  fontSize: 20,
                  letterSpacing: "0.1em",
                  color: "#8f8f8f",
                  textTransform: "uppercase",
                }}
              >
                Etapa {step.n} de 4
              </div>
              <div key={step.n} style={{ fontSize: 34, fontWeight: 600 }}>
                <Rise from={step.at} offset={14}>
                  {step.label}
                </Rise>
              </div>
            </div>
          </div>

          {/* Origin */}
          <div
            style={{
              marginTop: 40,
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "space-between",
            }}
          >
            <Rise from={24}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  fontSize: 20,
                  letterSpacing: "0.1em",
                  color: "#8f8f8f",
                  textTransform: "uppercase",
                }}
              >
                <FileText size={20} strokeWidth={2} /> 01 / A origem
              </div>
              <div style={{ fontSize: 30, fontWeight: 500, marginTop: 6 }}>
                Procurando de onde vêm os dados
              </div>
              <div style={{ fontSize: 24, color: "#388cf2", marginTop: 2 }}>
                ford.com.br · fonte oficial
              </div>
            </Rise>
            <Rise from={200}>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 10,
                  height: 56,
                  padding: "0 26px",
                  borderRadius: 9999,
                  border: "1px solid rgba(255,255,255,0.18)",
                  fontSize: 24,
                  fontWeight: 500,
                }}
              >
                Ver as evidências <ArrowRight size={22} strokeWidth={2} />
              </div>
            </Rise>
          </div>

          <div style={{ marginTop: 36 }}>
            <Rise from={196}>
              <div
                style={{
                  display: "flex",
                  gap: 36,
                  fontSize: 24,
                  color: "#e5e5e5",
                }}
              >
                <span>
                  <b>1</b> versão encontrada
                </span>
                <span>
                  <b>4</b> achados mapeados
                </span>
                <span style={{ color: "#ffc622" }}>
                  <b>3</b> aguardando mapeamento
                </span>
              </div>
            </Rise>
          </div>
        </div>
      </Shell>

      {/* Evidence / decision panel */}
      <div
        style={{
          position: "absolute",
          right: 0,
          top: 0,
          bottom: 0,
          width: 860,
          backgroundColor: "#151517",
          borderLeft: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "-40px 0 120px rgba(0,0,0,0.6)",
          translate: `${(1 - panel) * 900}px 0px`,
          fontFamily,
          padding: "44px 56px",
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
          <div style={{ fontSize: 30, fontWeight: 600 }}>
            {decision ? "Revisão de publicação" : "Evidências da pesquisa"}
          </div>
          <X size={26} color="#8f8f8f" />
        </div>

        {!decision ? (
          <div style={{ opacity: 1 - swap }}>
            <div style={{ marginTop: 40, fontSize: 20, color: "#8f8f8f" }}>
              1 configuração da fonte
            </div>
            <div style={{ fontSize: 28, fontWeight: 500 }}>
              Raptor 3.0 V6 Bi-turbo 4WD AT
            </div>
            <div style={{ fontSize: 20, color: "#8f8f8f" }}>
              4 achados mapeados · 3 aguardando mapeamento
            </div>
            <div
              style={{
                height: 1,
                backgroundColor: "rgba(255,255,255,0.08)",
                margin: "30px 0",
              }}
            />
            <Rise from={EVIDENCE_AT + 16}>
              <div style={{ fontSize: 20, color: "#8f8f8f" }}>Motor</div>
              <div
                style={{
                  fontSize: 56,
                  fontWeight: 700,
                  letterSpacing: "-0.03em",
                  marginTop: 4,
                }}
              >
                3.0L V6 Bi-turbo
              </div>
              <div style={{ fontSize: 20, color: "#8f8f8f", marginTop: 6 }}>
                Termo da fonte: Motor
              </div>
            </Rise>
            <Rise from={EVIDENCE_AT + 30}>
              <div style={{ marginTop: 36, fontSize: 20, color: "#8f8f8f" }}>
                Evidência · linha 36 · Performance
              </div>
              <div
                style={{
                  marginTop: 10,
                  borderLeft: "4px solid #066fef",
                  paddingLeft: 18,
                  fontSize: 26,
                  lineHeight: 1.4,
                }}
              >
                Motor 3.0L V6 Bi-turbo de 397cv com 583Nm
              </div>
              <div
                style={{
                  marginTop: 14,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 20,
                  color: "#b2b2b2",
                }}
              >
                <FileText size={18} /> Fonte: Ford · Performance
              </div>
            </Rise>
          </div>
        ) : (
          <div style={{ opacity: swap }}>
            <div style={{ marginTop: 40, fontSize: 20, color: "#8f8f8f" }}>
              Transmissão · termo da fonte
            </div>
            <div style={{ fontSize: 34, fontWeight: 600, marginTop: 4 }}>
              Conferir antes de publicar.
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 18,
                marginTop: 34,
              }}
            >
              <Option
                value="Automática de 10 velocidades"
                unit=""
                source="Catálogo atual"
                tag="Atual"
                at={DECISION_AT + 8}
              />
              <Option
                value="AT de 10 velocidades"
                unit=""
                source="Proposto pela fonte Ford"
                tag="Pré-aprovado"
                selected={picked}
                at={DECISION_AT + 16}
              />
            </div>
            <Rise from={PICK_AT + 6}>
              <div
                style={{
                  marginTop: 34,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 10,
                  borderRadius: 9999,
                  backgroundColor: "#066fef",
                  padding: "10px 22px",
                  fontSize: 22,
                  fontWeight: 600,
                }}
              >
                <Check size={20} strokeWidth={3} /> 2 selecionadas · 0
                publicadas
              </div>
            </Rise>
            <div
              style={{
                marginTop: 22,
                fontSize: 22,
                display: "flex",
                alignItems: "center",
                gap: 12,
                color: "#b2b2b2",
              }}
            >
              <span
                style={{
                  width: 24,
                  height: 24,
                  border: "2px solid #8f8f8f",
                  borderRadius: 4,
                  flexShrink: 0,
                }}
              />
              Confirmar a identidade da versão e o ano-modelo.
            </div>
          </div>
        )}
      </div>

      <Cursor
        waypoints={[
          { frame: 200, x: 1200, y: 800 },
          { frame: 244, x: 1500, y: 673 },
          { frame: EVIDENCE_AT, x: 1500, y: 673, click: true },
          { frame: EVIDENCE_AT + 40, x: 1500, y: 760 },
          { frame: PICK_AT - 30, x: 1420, y: 410 },
          { frame: PICK_AT, x: 1420, y: 410, click: true },
          { frame: PICK_AT + 30, x: 1560, y: 560 },
        ]}
        visibleFrom={200}
      />
      <Sfx name="mouse-click" from={EVIDENCE_AT} />
      <Sfx name="mouse-click" from={PICK_AT} />
    </SceneShell>
  );
};

const StepBadge: React.FC<{ readonly n: number; readonly done: boolean }> = ({
  n,
  done,
}) => {
  const frame = useDemoFrame();
  const pulse = 0.5 + 0.5 * Math.sin(frame / 6);
  return (
    <div
      style={{
        width: 64,
        height: 64,
        borderRadius: 9999,
        border: `3px solid ${done ? "#066fef" : "rgba(255,255,255,0.25)"}`,
        backgroundColor: done ? "#066fef" : "transparent",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 28,
        fontWeight: 700,
        boxShadow: done
          ? "0 0 0 8px rgba(6,111,239,0.18)"
          : `0 0 0 ${4 + pulse * 6}px rgba(6,111,239,${0.08 + pulse * 0.1})`,
      }}
    >
      {done ? <Check size={30} strokeWidth={3} /> : n}
    </div>
  );
};

const Option: React.FC<{
  readonly value: string;
  readonly unit: string;
  readonly source: string;
  readonly tag: string;
  readonly selected?: boolean;
  readonly dimmed?: boolean;
  readonly at: number;
}> = ({ value, unit, source, tag, selected, dimmed, at }) => {
  const frame = useDemoFrame();
  const { fps } = useVideoConfig();
  const t = spring({
    frame: frame - at,
    fps,
    durationInFrames: 16,
    config: { damping: 200 },
  });
  return (
    <div
      style={{
        opacity: t * (dimmed ? 0.4 : 1),
        translate: `0px ${(1 - t) * 20}px`,
        borderRadius: 18,
        border: `2px solid ${selected ? "#066fef" : "rgba(255,255,255,0.12)"}`,
        backgroundColor: selected ? "rgba(6,111,239,0.14)" : "#1c1c1f",
        padding: "22px 26px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <div>
        <div
          style={{
            fontSize: 34,
            fontWeight: 700,
            letterSpacing: "-0.03em",
            lineHeight: 1,
          }}
        >
          {value}{" "}
          <span style={{ fontSize: 28, fontWeight: 500, color: "#b2b2b2" }}>
            {unit}
          </span>
        </div>
        <div style={{ fontSize: 20, color: "#b2b2b2", marginTop: 10 }}>
          {source}
        </div>
      </div>
      <div
        style={{
          fontSize: 18,
          fontWeight: 600,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: selected ? "#388cf2" : "#8f8f8f",
        }}
      >
        {tag}
      </div>
    </div>
  );
};

export const Research: React.FC<DemoSceneProps> = ({
  durationInFrames = 480,
}) => (
  <DemoTiming durationInFrames={durationInFrames} sourceDurationInFrames={480}>
    <ResearchContent />
  </DemoTiming>
);
