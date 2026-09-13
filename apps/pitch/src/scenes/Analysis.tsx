import {
  AbsoluteFill,
  CanvasImage,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";
import {
  bounded,
  ford,
  motion,
  ProductShell,
  Typed,
  Wordmark,
} from "../components/Product";

import { fontFamily } from "../font";

const paragraphs = [
  {
    title: "Evidências",
    text: "Raptor: 397 cv, 583 Nm e automática de 10 velocidades. XL: 170 cv, 405 Nm e manual de 6 velocidades.",
  },
  {
    title: "Implicações",
    text: "Raptor: desempenho e lazer fora de estrada. XL: proposta mais utilitária, sem inferir capacidade operacional.",
  },
  {
    title: "Lacunas",
    text: "Aceleração não informada. Carga, reboque e custo total exigem evidências adicionais.",
  },
];

export const Analysis: React.FC = () => {
  const f = useCurrentFrame();
  const sent = f > 145;
  const raw = f >= 548;
  return (
    <AbsoluteFill style={{ fontFamily }}>
      <ProductShell title="Análise competitiva · Ranger Raptor e Ranger XL">
        <div
          style={{
            position: "absolute",
            left: sent ? 530 : 270,
            right: 190,
            top: interpolate(f, [135, 175], [215, 122], {
              ...bounded,
              easing: motion,
            }),
            padding: "30px 37px",
            background: "#252525",
            borderRadius: 24,
            border: sent ? "1px solid #fff2" : `1px solid ${ford}`,
            minHeight: 120,
          }}
        >
          <Typed
            text="O que essas diferenças significam para o posicionamento das versões?"
            start={12}
            end={123}
            size={sent ? 32 : 48}
          />
        </div>
        {!sent && (
          <div
            style={{
              position: "absolute",
              left: 270,
              top: 480,
              color: "#f3f5ff",
              fontSize: 76,
              lineHeight: 1.1,
              letterSpacing: -3,
              opacity: interpolate(f, [40, 65], [0, 1], bounded),
            }}
          >
            Da especificação
            <br />
            <span style={{ color: "#7eafff" }}>à próxima decisão.</span>
          </div>
        )}
        {sent && (
          <div
            style={{ position: "absolute", left: 255, right: 210, top: 300 }}
          >
            {paragraphs.map(({ title, text }, i) => (
              <div
                key={title}
                style={{
                  marginBottom: 34,
                  opacity: interpolate(
                    f,
                    [180 + i * 80, 202 + i * 80],
                    [0, 1],
                    bounded,
                  ),
                  translate: `0 ${interpolate(f, [180 + i * 80, 208 + i * 80], [20, 0], { ...bounded, easing: motion })}px`,
                }}
              >
                <div
                  style={{ fontSize: 29, color: "#8cb9ff", marginBottom: 10 }}
                >
                  {title}
                </div>
                <div
                  style={{
                    fontSize: 38,
                    lineHeight: 1.35,
                    letterSpacing: -0.6,
                    color: i === 1 ? "#fff" : "#cbcbcb",
                  }}
                >
                  {text}
                </div>
              </div>
            ))}
          </div>
        )}
        <div
          style={{
            position: "absolute",
            left: 254,
            bottom: 226,
            fontSize: 25,
            color: "#7c7c7c",
            opacity: interpolate(f, [420, 440], [0, 1], bounded),
          }}
        >
          Resumo editorial da resposta real · a decisão continua com a equipe
        </div>
      </ProductShell>
      {raw && (
        <AbsoluteFill
          style={{
            background: "#101010",
            opacity: interpolate(f, [548, 566], [0, 1], bounded),
          }}
        >
          <CanvasImage
            src={staticFile("captures/09-analysis.png")}
            style={{
              position: "absolute",
              width: 2200,
              height: 1444,
              left: -140,
              top: -110,
              scale: interpolate(f, [550, 660], [1, 1.03], bounded),
              transformOrigin: "55% 42%",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: 155,
              background: "linear-gradient(#101010 75%,transparent)",
              display: "flex",
              padding: "30px 95px",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Wordmark size={40} />
            <span style={{ fontSize: 26, color: "#b3c7e6" }}>
              Resposta real do SpecSync
            </span>
          </div>
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: 230,
              background: "linear-gradient(transparent,#101010 35%)",
            }}
          />
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};
