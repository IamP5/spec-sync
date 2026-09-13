import {
  CanvasImage,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";
import {
  bounded,
  ford,
  Icon,
  motion,
  ProductShell,
  Typed,
  Wordmark,
  Cursor,
} from "../components/Product";

export const Question: React.FC = () => {
  const f = useCurrentFrame();
  const sent = f >= 230;
  return (
    <ProductShell
      enter
      composer={sent}
      title={sent ? "Especificações da Ranger Raptor" : "Nova conversa"}
    >
      <div
        style={{
          position: "absolute",
          left: 340,
          right: 246,
          top: interpolate(f, [210, 258], [235, 116], {
            ...bounded,
            easing: motion,
          }),
          opacity: interpolate(f, [220, 252], [1, 0], bounded),
        }}
      >
        <Wordmark size={76} />
      </div>
      <div
        style={{
          position: "absolute",
          left: interpolate(f, [210, 258], [300, 600], {
            ...bounded,
            easing: motion,
          }),
          right: 220,
          top: interpolate(f, [210, 258], [394, 116], {
            ...bounded,
            easing: motion,
          }),
          height: interpolate(f, [210, 258], [230, 150], bounded),
          border: `1px solid ${sent ? "#ffffff20" : ford}`,
          borderRadius: 26,
          background: "#202020",
          padding: "32px 38px",
          boxShadow: sent ? "none" : "0 0 50px #066fef0c",
        }}
      >
        <Typed
          text="Mostre as especificações da Ranger Raptor. Motor, potência, torque e transmissão."
          start={50}
          end={185}
          size={interpolate(f, [210, 258], [42, 31], {
            ...bounded,
            easing: motion,
          })}
        />
        {!sent && (
          <div
            style={{
              position: "absolute",
              left: 36,
              bottom: 30,
              color: "#aaa",
              fontSize: 26,
            }}
          >
            ••• Equilibrado
          </div>
        )}
        {!sent && (
          <div
            style={{
              position: "absolute",
              right: 27,
              bottom: 22,
              background: ford,
              width: 56,
              height: 56,
              borderRadius: "50%",
              display: "grid",
              placeItems: "center",
              color: "#fff",
              rotate: "-90deg",
            }}
          >
            <Icon />
          </div>
        )}
      </div>
      {!sent && (
        <div
          style={{
            position: "absolute",
            left: 435,
            right: 350,
            top: 690,
            padding: "28px 38px",
            display: "flex",
            alignItems: "center",
            gap: 30,
            background: "#242424",
            border: "1px solid #fff2",
            borderRadius: 22,
            opacity: interpolate(f, [30, 65], [0, 1], bounded),
          }}
        >
          <div style={{ padding: 16, background: ford, borderRadius: 14 }}>
            <Icon kind="grid" size={35} />
          </div>
          <div>
            <div style={{ fontSize: 33 }}>Explorar o catálogo de veículos</div>
            <div style={{ fontSize: 25, color: "#aaa", marginTop: 10 }}>
              Busca, filtros, detalhes e lista de comparação.
            </div>
          </div>
        </div>
      )}
      {sent && (
        <div
          style={{
            position: "absolute",
            top: 305,
            left: 230,
            right: 195,
            opacity: interpolate(f, [245, 280], [0, 1], bounded),
            translate: `0 ${interpolate(f, [245, 290], [35, 0], { ...bounded, easing: motion })}px`,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 25,
              marginBottom: 33,
            }}
          >
            <CanvasImage
              src={staticFile("brand/raptor-1.jpg")}
              style={{
                width: 160,
                height: 102,
                objectFit: "cover",
                borderRadius: 15,
              }}
            />
            <div>
              <div style={{ fontSize: 39, fontWeight: 550 }}>
                Ranger Raptor 3.0 V6 Bi-turbo 4WD AT
              </div>
              <div style={{ fontSize: 30, color: "#a0a0a0", marginTop: 9 }}>
                Ford · BR · 2026 solicitado · versão a confirmar
              </div>
            </div>
          </div>
          <div
            style={{
              fontSize: 28,
              color: "#999",
              paddingBottom: 23,
              display: "flex",
              gap: 16,
            }}
          >
            <Icon kind="search" /> Filtrar as especificações…
          </div>
          {[
            ["Motor", "3.0L V6 Bi-turbo"],
            ["Potência máxima", "397 cv"],
            ["Torque máximo", "583 Nm"],
          ].map(([label, value], i) => (
            <div
              key={label}
              style={{
                borderTop: "1px solid #fff2",
                padding: "20px 0",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                opacity: interpolate(
                  f,
                  [265 + i * 30, 285 + i * 30],
                  [0, 1],
                  bounded,
                ),
              }}
            >
              <span style={{ fontSize: 31, color: "#d0d0d0" }}>{label}</span>
              <span
                style={{
                  fontSize: 44,
                  fontWeight: 560,
                  padding: "7px 24px",
                  borderRadius: 15,
                  background: "#252525",
                  color: i === 1 ? "#91bfff" : "white",
                }}
              >
                {value}
              </span>
            </div>
          ))}
          <div style={{ color: "#aaa", fontSize: 25, paddingTop: 17 }}>
            ▸ Fontes e observações disponíveis em cada atributo
          </div>
        </div>
      )}
      <Cursor
        x={interpolate(f, [170, 214], [1510, 1658], {
          ...bounded,
          easing: motion,
        })}
        y={interpolate(f, [170, 214], [760, 571], {
          ...bounded,
          easing: motion,
        })}
        opacity={interpolate(f, [169, 185, 227, 240], [0, 1, 1, 0], bounded)}
        click={f >= 217 && f < 230 ? (f - 217) / 13 : 0}
      />
    </ProductShell>
  );
};
