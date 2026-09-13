import { Interactive, interpolate, useCurrentFrame } from "remotion";
import {
  Cursor,
  Icon,
  ProductShell,
  bounded,
  ford,
  motion,
} from "../components/Product";

const easing = { ...bounded, easing: motion };

export const Research: React.FC = () => {
  const frame = useCurrentFrame();
  const modal = interpolate(frame, [197, 233, 399, 431], [0, 1, 1, 0], easing);
  const reviewing = interpolate(frame, [422, 459], [0, 1], easing);
  const stageFour = interpolate(frame, [137, 158], [0, 1], easing);
  const cursorX = interpolate(
    frame,
    [125, 186, 238, 353, 390, 446, 509, 563, 636],
    [1160, 1480, 1700, 1700, 1794, 1710, 400, 1030, 1450],
    easing,
  );
  const cursorY = interpolate(
    frame,
    [125, 186, 238, 353, 390, 446, 509, 563, 636],
    [730, 641, 660, 250, 145, 320, 758, 727, 720],
    easing,
  );
  const firstClick = interpolate(frame, [192, 208], [0, 1], bounded);
  const secondClick = interpolate(frame, [394, 410], [0, 1], bounded);

  return (
    <ProductShell title="Mostre as especificações da Ford Ranger Raptor…">
      <div
        style={{
          position: "absolute",
          inset: "116px 0 140px 90px",
          filter: `blur(${modal * 5}px)`,
          opacity: 1 - modal * 0.62,
        }}
      >
        <Interactive.Div
          name="Vehicle research overview"
          style={{
            position: "absolute",
            left: 91,
            right: 120,
            top: 0,
            opacity: 1 - reviewing,
            scale: interpolate(frame, [0, 100], [1.025, 1], easing),
            transformOrigin: "50% 20%",
          }}
        >
          <div style={{ color: "#adadad", fontSize: 32, marginBottom: 21 }}>
            Pesquisa de veículos
          </div>
          <div
            style={{
              fontSize: 69,
              lineHeight: 1.09,
              fontWeight: 590,
              letterSpacing: -2.9,
            }}
          >
            Conhecendo o Ford Ranger Raptor.
          </div>
          <div style={{ color: "#b6b6b6", fontSize: 32, marginTop: 20 }}>
            BR · 2026 solicitado · confirme o ano-modelo nas evidências
          </div>
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 234,
              display: "flex",
              alignItems: "center",
              gap: 31,
            }}
          >
            <div
              style={{
                width: 86,
                height: 86,
                position: "relative",
                display: "grid",
                placeItems: "center",
              }}
            >
              <svg
                width={86}
                height={86}
                style={{ position: "absolute", inset: 0, rotate: "-90deg" }}
              >
                <circle
                  cx={43}
                  cy={43}
                  r={37}
                  stroke="#ffffff1d"
                  strokeWidth={5}
                  fill="none"
                />
                <circle
                  cx={43}
                  cy={43}
                  r={37}
                  stroke={ford}
                  strokeWidth={5}
                  fill="none"
                  pathLength={1}
                  strokeDasharray="1"
                  strokeDashoffset={interpolate(
                    frame,
                    [0, 100, 156],
                    [0.38, 0.25, 0],
                    easing,
                  )}
                  strokeLinecap="round"
                />
              </svg>
              <div
                style={{
                  fontSize: 40,
                  fontWeight: 550,
                  opacity: 1 - stageFour,
                }}
              >
                3
              </div>
              <div
                style={{
                  position: "absolute",
                  fontSize: 40,
                  fontWeight: 550,
                  opacity: stageFour,
                }}
              >
                4
              </div>
            </div>
            <div style={{ position: "relative", width: 1200, height: 98 }}>
              <div style={{ opacity: 1 - stageFour }}>
                <div
                  style={{ color: "#b2b2b2", fontSize: 32, marginBottom: 8 }}
                >
                  ETAPA 3 DE 4
                </div>
                <div style={{ fontSize: 42, fontWeight: 540 }}>
                  Verificando as versões
                </div>
              </div>
              <div
                style={{ position: "absolute", inset: 0, opacity: stageFour }}
              >
                <div
                  style={{ color: "#b2b2b2", fontSize: 32, marginBottom: 8 }}
                >
                  ETAPA 4 DE 4
                </div>
                <div style={{ fontSize: 42, fontWeight: 540 }}>
                  Pronta para revisão
                </div>
              </div>
            </div>
          </div>
          <div
            style={{
              position: "absolute",
              top: 365,
              left: 0,
              right: 0,
              height: 1,
              background: "#ffffff23",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: 407,
              left: 0,
              color: "#b2b2b2",
              display: "flex",
              alignItems: "center",
              gap: 19,
              fontSize: 32,
            }}
          >
            <Icon kind="file" size={33} />
            01 / A ORIGEM
          </div>
          <div
            style={{
              position: "absolute",
              top: 457,
              left: 0,
              fontSize: 43,
              fontWeight: 510,
              letterSpacing: -1.1,
            }}
          >
            Procurando de onde vêm os dados
          </div>
          <div
            style={{
              position: "absolute",
              top: 522,
              left: 0,
              fontSize: 37,
              color: "#c2c2c2",
            }}
          >
            ford.com.br
          </div>
          <div
            style={{
              position: "absolute",
              top: 485,
              right: 0,
              width: 410,
              height: 78,
              border: `1px solid ${ford}`,
              borderRadius: 40,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              gap: 18,
              fontSize: 32,
              background: "#066fef0d",
              boxShadow: `0 0 ${interpolate(frame, [157, 189, 215], [0, 32, 0], bounded)}px #066fef44`,
            }}
          >
            <Icon kind="file" size={30} />
            Ver as evidências
            <Icon size={29} />
          </div>
          <div
            style={{
              position: "absolute",
              top: 627,
              left: 0,
              right: 0,
              display: "flex",
              alignItems: "center",
              gap: 40,
              opacity: stageFour,
              fontSize: 32,
              color: "#bdbdbd",
            }}
          >
            <span style={{ color: "#f4f4f4", fontWeight: 510 }}>
              1 versão encontrada
            </span>
            <span>4 achados mapeados</span>
            <span>3 aguardando mapeamento</span>
          </div>
        </Interactive.Div>
        <Interactive.Div
          name="Review before publication"
          style={{
            position: "absolute",
            left: 91,
            right: 120,
            top: 0,
            opacity: reviewing,
            translate: interpolate(
              frame,
              [422, 459],
              ["0px 32px", "0px 0px"],
              easing,
            ),
          }}
        >
          <div style={{ display: "flex", gap: 26, alignItems: "center" }}>
            <div
              style={{
                width: 73,
                height: 73,
                flexShrink: 0,
                borderRadius: "50%",
                background: "#f2f2f2",
                color: "#111",
                display: "grid",
                placeItems: "center",
                fontSize: 38,
                fontWeight: 650,
              }}
            >
              4
            </div>
            <div>
              <div style={{ color: "#adadad", fontSize: 32, marginBottom: 7 }}>
                ETAPA 4 DE 4
              </div>
              <div style={{ fontSize: 59, fontWeight: 560, letterSpacing: -2 }}>
                Pronta para revisão
              </div>
            </div>
          </div>
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 153,
              fontSize: 42,
              fontWeight: 540,
              letterSpacing: -1,
            }}
          >
            Revisão e publicação
          </div>
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 214,
              fontSize: 33,
              color: "#b8b8b8",
            }}
          >
            <span style={{ color: "#f5f5f5" }}>2 selecionadas</span> · 0
            pendentes · <span style={{ color: "#f5f5f5" }}>0 publicadas</span>
          </div>
          <div
            style={{
              position: "absolute",
              right: 0,
              top: 166,
              padding: "16px 22px",
              borderRadius: 14,
              fontSize: 32,
              border: "1px solid #ffffff26",
              color: "#bcbcbc",
            }}
          >
            Voltar à pesquisa
          </div>
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: 275,
              height: 83,
              border: "1px solid #ffffff28",
              borderRadius: 17,
              display: "flex",
              alignItems: "center",
              padding: "0 27px",
              gap: 23,
              fontSize: 32,
            }}
          >
            <div
              style={{
                width: 31,
                height: 31,
                border: "2px solid #959595",
                borderRadius: 6,
                background: "#353535",
                flexShrink: 0,
              }}
            />
            <span>Confirmar a identidade da versão e o ano-modelo.</span>
            <span style={{ marginLeft: "auto", color: "#aaa", fontSize: 32 }}>
              Raptor 3.0 V6 Bi-turbo 4WD AT
            </span>
          </div>
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 385,
              width: 386,
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            {[
              { name: "Motor", status: "Já está no catálogo" },
              { name: "Tração", status: "Já está no catálogo" },
              { name: "Transmissão", status: "Pré-aprovado" },
            ].map((item, index) => (
              <div
                key={item.name}
                style={{
                  minHeight: 80,
                  borderRadius: 16,
                  padding: "10px 18px",
                  background: index === 2 ? "#292929" : "transparent",
                  border:
                    index === 2
                      ? "1px solid #ffffff1b"
                      : "1px solid transparent",
                  display: "flex",
                  alignItems: "center",
                  gap: 17,
                }}
              >
                <div style={{ color: index === 2 ? "#a6c6ff" : "#a7a7a7" }}>
                  {index === 2 ? (
                    <Icon kind="check" size={30} />
                  ) : (
                    <span style={{ fontSize: 32 }}>{index + 1}</span>
                  )}
                </div>
                <div>
                  <div style={{ fontSize: 35, fontWeight: 500 }}>
                    {item.name}
                  </div>
                  <div style={{ fontSize: 32, color: "#a9a9a9", marginTop: 7 }}>
                    {item.status}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div
            style={{
              position: "absolute",
              left: 430,
              right: 0,
              top: 385,
              height: 294,
              border: "1px solid #ffffff22",
              borderRadius: 20,
              padding: "25px 28px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span style={{ fontSize: 40, fontWeight: 540 }}>Transmissão</span>
              <span
                style={{
                  color: "#fff",
                  background: ford,
                  padding: "8px 18px",
                  borderRadius: 24,
                  fontSize: 32,
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <Icon kind="check" size={25} />
                Pré-aprovado
              </span>
            </div>
            <div style={{ display: "flex", gap: 22, marginTop: 24 }}>
              <div
                style={{
                  width: "50%",
                  borderRadius: 17,
                  background: "#292929",
                  padding: "18px 23px",
                }}
              >
                <div style={{ color: "#aaa", fontSize: 32, marginBottom: 10 }}>
                  Catálogo atual
                </div>
                <div
                  style={{
                    fontSize: 40,
                    fontWeight: 500,
                    lineHeight: 1.1,
                    letterSpacing: -0.9,
                  }}
                >
                  Automática de
                  <br />
                  10 velocidades
                </div>
              </div>
              <div
                style={{
                  width: "50%",
                  borderRadius: 17,
                  border: "1px solid #ffffff2e",
                  padding: "18px 23px",
                  boxShadow: `0 0 ${interpolate(frame, [555, 586, 660], [0, 24, 0], bounded)}px #066fef27`,
                }}
              >
                <div style={{ color: "#aaa", fontSize: 32, marginBottom: 10 }}>
                  Proposto
                </div>
                <div
                  style={{
                    fontSize: 40,
                    fontWeight: 500,
                    lineHeight: 1.1,
                    letterSpacing: -0.9,
                  }}
                >
                  AT de
                  <br />
                  10 velocidades
                </div>
              </div>
            </div>
          </div>
        </Interactive.Div>
      </div>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "#000",
          opacity: modal * 0.2,
          pointerEvents: "none",
        }}
      />
      <Interactive.Div
        name="Research evidence drawer"
        style={{
          position: "absolute",
          left: 599,
          top: 96,
          width: 1264,
          height: 822,
          borderRadius: 24,
          background: "#202020",
          border: "1px solid #ffffff30",
          boxShadow: "-35px 0 110px #000a",
          opacity: modal,
          translate: `${(1 - modal) * 1330}px 0px`,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: 99,
            padding: "27px 43px",
            borderBottom: "1px solid #ffffff25",
            fontSize: 41,
            fontWeight: 500,
          }}
        >
          Evidências da pesquisa
          <span
            style={{
              position: "absolute",
              right: 42,
              top: 29,
              fontSize: 39,
              color: "#c8c8c8",
            }}
          >
            ×
          </span>
        </div>
        <div style={{ position: "absolute", left: 44, right: 44, top: 126 }}>
          <div style={{ fontSize: 32, color: "#b8b8b8" }}>
            1 configuração da fonte
          </div>
          <div
            style={{
              fontSize: 39,
              fontWeight: 520,
              letterSpacing: -1.1,
              marginTop: 23,
            }}
          >
            Raptor 3.0 V6 Bi-turbo 4WD AT
          </div>
          <div style={{ fontSize: 32, color: "#aaa", marginTop: 17 }}>
            4 achados mapeados · 3 aguardando mapeamento
          </div>
          <div
            style={{
              height: 1,
              background: "#ffffff22",
              marginTop: 28,
              marginBottom: 31,
            }}
          />
          <div style={{ fontSize: 33, color: "#b8b8b8", marginBottom: 14 }}>
            Motor
          </div>
          <div
            style={{
              fontSize: 63,
              lineHeight: 1.04,
              letterSpacing: -2,
              fontWeight: 560,
            }}
          >
            3.0L V6 Bi-turbo
          </div>
          <div style={{ color: "#aaa", marginTop: 20, fontSize: 32 }}>
            Termo da fonte: Motor
          </div>
          <div style={{ color: "#bbb", marginTop: 38, fontSize: 32 }}>
            Evidência · linha 36 · Performance
          </div>
          <div
            style={{
              marginTop: 17,
              borderLeft: `4px solid ${ford}`,
              paddingLeft: 24,
              fontSize: 40,
              lineHeight: 1.35,
              letterSpacing: -0.9,
            }}
          >
            Motor 3.0L V6 Bi-turbo de 397cv com 583Nm
          </div>
          <div
            style={{
              marginTop: 32,
              display: "flex",
              alignItems: "center",
              gap: 15,
              fontSize: 32,
              color: "#c0cfe9",
            }}
          >
            <Icon kind="file" size={30} />
            Fonte: Ford · Performance
          </div>
        </div>
      </Interactive.Div>
      <Cursor
        x={cursorX}
        y={cursorY}
        click={
          frame >= 192 && frame < 208
            ? firstClick
            : frame >= 394 && frame < 410
              ? secondClick
              : 0
        }
        opacity={interpolate(frame, [130, 157, 665, 687], [0, 1, 1, 0], easing)}
      />
    </ProductShell>
  );
};
