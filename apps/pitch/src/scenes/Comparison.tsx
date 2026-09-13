import { interpolate, useCurrentFrame } from "remotion";
import {
  bounded,
  ford,
  Icon,
  motion,
  ProductShell,
  Cursor,
} from "../components/Product";

export const Comparison: React.FC = () => {
  const f = useCurrentFrame();
  const source = f >= 330 && f < 508;
  const missing = f >= 508;
  const focus = interpolate(f, [145, 200, 300, 330], [0, 1, 1, 0], {
    ...bounded,
    easing: motion,
  });
  return (
    <ProductShell
      title="Comparação de especificações · Ranger Raptor × Ranger XL"
      composer={!source}
    >
      <div
        style={{
          position: "absolute",
          left: 230,
          right: 180,
          top: 132,
          opacity: source ? 0.2 : 1,
          filter: source ? "blur(7px)" : undefined,
        }}
      >
        <div style={{ fontSize: 30, color: "#999", marginBottom: 26 }}>
          2 veículos · Brasil · 2026 solicitado · versões a confirmar
        </div>
        <div style={{ display: "flex", gap: 40, marginBottom: 32 }}>
          {["Ranger Raptor 3.0 V6", "Ranger XL 2.0 Diesel"].map((name, i) => (
            <div
              key={name}
              style={{
                flex: 1,
                display: "flex",
                gap: 20,
                alignItems: "center",
              }}
            >
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: "50%",
                  background: i ? "#ddd" : ford,
                  color: i ? "#111" : "#fff",
                  display: "grid",
                  placeItems: "center",
                  fontSize: 29,
                }}
              >
                {i + 1}
              </div>
              <div>
                <div style={{ fontSize: 36, fontWeight: 540 }}>{name}</div>
                <div style={{ fontSize: 29, color: "#aaa", marginTop: 8 }}>
                  {i
                    ? "Manual · 6 velocidades · 4×4"
                    : "Automática · 10 velocidades · 4WD"}
                </div>
              </div>
            </div>
          ))}
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            borderBottom: "1px solid #fff3",
            paddingBottom: 28,
            color: "#aaa",
            fontSize: 28,
          }}
        >
          <div style={{ display: "flex", gap: 12 }}>
            <Icon kind="search" />
            Filtrar as especificações…
          </div>
          <span style={{ color: "#aaa" }}>Só as diferenças</span>
        </div>
        <div style={{ position: "relative", height: 440, overflow: "hidden" }}>
          {[
            ["Motor", "3.0L V6 Bi-turbo", "2.0 Turbo Diesel"],
            ["Potência máxima", "397 cv", "170 cv"],
            ["Torque máximo", "583 Nm", "405 Nm"],
          ].map(([label, a, b], i) => (
            <div
              key={label}
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: i === 1 ? interpolate(focus, [0, 1], [144, 20]) : i * 144,
                opacity: i === 1 ? 1 : 1 - focus,
                padding: "22px 0",
                borderBottom: "1px solid #fff2",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: i === 1 ? 31 + focus * 15 : 31,
                    color: "#ccc",
                  }}
                >
                  {label}
                </div>
                <div style={{ fontSize: 24, color: "#aaa", marginTop: 12 }}>
                  ▸ Fontes e observações
                </div>
              </div>
              <div style={{ display: "flex", gap: 30 }}>
                {[a, b].map((v, j) => (
                  <div
                    key={v}
                    style={{
                      fontSize: i === 1 ? 43 + focus * 59 : 39,
                      padding: `${14 + focus * 14}px ${22 + focus * 15}px`,
                      borderRadius: 18,
                      background: j
                        ? "#252525"
                        : focus > 0.1
                          ? "#00095B"
                          : "#252525",
                      letterSpacing: -1,
                      fontWeight: 530,
                    }}
                  >
                    <span
                      style={{ fontSize: 24, marginRight: 17, opacity: 0.6 }}
                    >
                      {j + 1}
                    </span>
                    {v}
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div
            style={{
              position: "absolute",
              top: 230,
              left: 0,
              right: 0,
              opacity: focus,
              fontSize: 42,
              color: "#92baff",
            }}
          >
            Diferenças visíveis. Contexto preservado.
          </div>
          <div
            style={{
              position: "absolute",
              top: 315,
              left: 0,
              right: 0,
              opacity: focus,
              fontSize: 31,
              color: "#aaa",
            }}
          >
            Potência isolada não define o desempenho do veículo.
          </div>
        </div>
      </div>
      {source && (
        <div
          style={{
            position: "absolute",
            top: 100,
            bottom: 150,
            right: 40,
            width: 1280,
            background: "#202020",
            border: "1px solid #fff3",
            borderRadius: 26,
            padding: 55,
            boxShadow: "-50px 20px 130px #000a",
            translate: `${interpolate(f, [330, 355], [1300, 0], { ...bounded, easing: motion })}px 0`,
          }}
        >
          <div
            style={{
              fontSize: 33,
              display: "flex",
              justifyContent: "space-between",
              paddingBottom: 30,
              borderBottom: "1px solid #fff2",
            }}
          >
            <span>Fontes e observações</span>
            <span>×</span>
          </div>
          <div
            style={{
              display: "flex",
              gap: 18,
              alignItems: "center",
              color: "#99beff",
              fontSize: 29,
              marginTop: 40,
            }}
          >
            <Icon kind="file" /> Fonte oficial Ford
          </div>
          <div
            style={{
              fontSize: 56,
              lineHeight: 1.1,
              marginTop: 36,
              letterSpacing: -1.5,
            }}
          >
            Ranger Raptor
            <br />
            Ficha técnica
          </div>
          <div style={{ fontSize: 31, color: "#aaa", marginTop: 25 }}>
            Potência máxima · 397 cv
          </div>
          <div
            style={{
              borderLeft: "4px solid #066FEF",
              paddingLeft: 30,
              marginTop: 42,
              fontSize: 43,
              lineHeight: 1.35,
            }}
          >
            Potência máxima: 397
          </div>
          <div style={{ fontSize: 30, color: "#999", marginTop: 34 }}>
            Capturado em 12/09/2026 · versão a confirmar
          </div>
        </div>
      )}
      {missing && (
        <div
          style={{
            position: "absolute",
            left: 170,
            right: 120,
            top: 350,
            bottom: 230,
            padding: "45px 60px",
            background: "#151515",
            border: "1px solid #fff3",
            borderRadius: 22,
            opacity: interpolate(f, [508, 530], [0, 1], bounded),
            translate: `0 ${interpolate(f, [508, 542], [45, 0], { ...bounded, easing: motion })}px`,
          }}
        >
          <div style={{ fontSize: 35, color: "#ccc", marginBottom: 40 }}>
            Aceleração de 0 a 100 km/h
          </div>
          <div style={{ display: "flex", gap: 90 }}>
            {["Ranger Raptor", "Ranger XL"].map((name) => (
              <div key={name} style={{ flex: 1 }}>
                <div style={{ fontSize: 28, color: "#aaa", marginBottom: 20 }}>
                  {name}
                </div>
                <div style={{ fontSize: 57, letterSpacing: -1 }}>
                  Não informado
                </div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 32, color: "#8ab6ff", marginTop: 45 }}>
            A lacuna permanece explícita.
          </div>
        </div>
      )}
      <Cursor
        x={interpolate(f, [110, 145, 290, 325], [1490, 520, 660, 420], {
          ...bounded,
          easing: motion,
        })}
        y={interpolate(f, [110, 145, 290, 325], [680, 523, 515, 482], {
          ...bounded,
          easing: motion,
        })}
        opacity={f > 340 || f < 100 ? 0 : 1}
        click={f >= 325 && f < 338 ? (f - 325) / 13 : 0}
      />
    </ProductShell>
  );
};
