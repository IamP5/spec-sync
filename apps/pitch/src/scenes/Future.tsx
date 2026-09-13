import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { fontFamily } from "../font";

const navy = "#00095B";
const blue = "#066FEF";
const ink = "#050914";
const muted = "#5C6C83";
const line = "#DCE5F1";
const ease = {
  extrapolateLeft: "clamp" as const,
  extrapolateRight: "clamp" as const,
  easing: Easing.bezier(0.22, 1, 0.36, 1),
};
const move = (frame: number, from: number, to: number) =>
  interpolate(frame, [from, to], [0, 1], ease);
const reveal = (frame: number, from: number, to = from + 25) => ({
  opacity: move(frame, from, to),
  transform: `translateY(${(1 - move(frame, from, to)) * 18}px)`,
});

const Arrow: React.FC<{ size?: number }> = ({ size = 28 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
    <path
      d="M5 16h21M18 7l9 9-9 9"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
const Check: React.FC<{ size?: number }> = ({ size = 27 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
    <path
      d="m7 16 6 6 13-14"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const Market: React.FC<{ frame: number }> = ({ frame }) => {
  const focus = move(frame, 194, 228);
  const opacity = 1 - move(frame, 224, 250);
  const points = [
    { x: 247, y: 269, r: 27, name: "A", value: "18%" },
    { x: 552, y: 193, r: 27, name: "B", value: "26%" },
    { x: 888, y: 117, r: 27, name: "C", value: "34%" },
  ];
  return (
    <AbsoluteFill
      style={{
        background: "white",
        opacity,
        transform: `translateX(${-focus * 38}px) scale(${1 + focus * 0.025})`,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 76,
          top: 168,
          fontSize: 58,
          fontWeight: 550,
          letterSpacing: -2.6,
        }}
      >
        Inteligência de mercado
      </div>
      <div
        style={{
          position: "absolute",
          left: 78,
          top: 246,
          fontSize: 30,
          color: muted,
        }}
      >
        Brasil <span style={{ color: "#A2AEC1", margin: "0 17px" }}>/</span>{" "}
        Picapes médias{" "}
        <span style={{ color: "#A2AEC1", margin: "0 17px" }}>/</span> Varejo{" "}
        <span style={{ color: "#A2AEC1", margin: "0 17px" }}>/</span> 1º
        semestre
      </div>
      <div
        style={{
          position: "absolute",
          left: 78,
          top: 322,
          fontSize: 38,
          fontWeight: 520,
          letterSpacing: -1,
        }}
      >
        Participação nos emplacamentos
      </div>
      <div
        style={{
          position: "absolute",
          left: 78,
          top: 375,
          fontSize: 28,
          color: muted,
        }}
      >
        Market share no segmento · portfólios hipotéticos
      </div>
      <svg
        style={{
          position: "absolute",
          left: 78,
          top: 427,
          width: 1120,
          height: 405,
          overflow: "visible",
        }}
        viewBox="0 0 1120 405"
      >
        {[0, 1, 2, 3].map((i) => (
          <g key={i}>
            <path
              d={`M85 ${345 - i * 95}H1100`}
              stroke={line}
              strokeWidth="1.5"
            />
            <text
              x="59"
              y={355 - i * 95}
              textAnchor="end"
              fill={muted}
              fontSize="28"
            >
              {10 + i * 10}%
            </text>
          </g>
        ))}
        {[90, 100, 110, 120].map((value, i) => (
          <text
            key={value}
            x={85 + i * 338}
            y="394"
            textAnchor="middle"
            fill={muted}
            fontSize="29"
          >
            {value}
          </text>
        ))}
        {points.map((point, i) => {
          const appear = move(frame, 18 + i * 16, 58 + i * 16);
          const pulse = i === 1 ? focus : 0;
          return (
            <g
              key={point.name}
              opacity={appear * (i === 1 ? 1 : 1 - focus * 0.55)}
              transform={`translate(${point.x} ${point.y + (1 - appear) * 60})`}
            >
              <circle
                r={point.r + 12 + pulse * 10}
                fill={i === 1 ? "#E2EEFF" : "#F0F4FA"}
              />
              <circle r={point.r} fill={i === 1 ? blue : navy} />
              <text
                x="0"
                y="10"
                textAnchor="middle"
                fill="white"
                fontSize="29"
                fontWeight="600"
              >
                {point.name}
              </text>
              <text x="52" y="0" fill={navy} fontSize="42" fontWeight="600">
                {point.value}
              </text>
              <text x="52" y="36" fill={muted} fontSize="27">
                Portfólio {point.name}
              </text>
            </g>
          );
        })}
      </svg>
      <div
        style={{
          position: "absolute",
          left: 338,
          top: 854,
          fontSize: 29,
          color: muted,
        }}
      >
        Preço público sugerido · índice (base 100)
      </div>
      <div
        style={{
          position: "absolute",
          left: 1250,
          right: 77,
          top: 324,
          bottom: 186,
          borderLeft: `2px solid ${line}`,
          paddingLeft: 42,
        }}
      >
        <div style={{ fontSize: 37, fontWeight: 520, letterSpacing: -1 }}>
          Mix de versões
        </div>
        <div style={{ fontSize: 28, color: muted, marginTop: 12 }}>
          Portfólio B · cenário simulado
        </div>
        {[
          { label: "Entrada", share: 55 },
          { label: "Intermediária", share: 30 },
          { label: "Topo", share: 15 },
        ].map((row, i) => (
          <div
            key={row.label}
            style={{ marginTop: 27, ...reveal(frame, 66 + i * 12) }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 30,
                marginBottom: 9,
              }}
            >
              <span>{row.label}</span>
              <span style={{ fontWeight: 600 }}>{row.share}%</span>
            </div>
            <div
              style={{
                height: 10,
                background: "#E5EDF8",
                borderRadius: 6,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${row.share * move(frame, 80 + i * 12, 136 + i * 12)}%`,
                  background: i === 0 ? blue : "#7FADEC",
                  borderRadius: 6,
                }}
              />
            </div>
          </div>
        ))}
        <div
          style={{
            marginTop: 40,
            paddingTop: 26,
            borderTop: `2px solid ${line}`,
            ...reveal(frame, 121),
          }}
        >
          <div style={{ fontSize: 30 }}>Emplacamentos · índice</div>
          <svg
            width="506"
            height="105"
            viewBox="0 0 506 105"
            style={{ marginTop: 12, overflow: "visible" }}
          >
            <path
              d="M4 70L90 62L170 73L255 45L337 38L440 13"
              stroke={blue}
              strokeWidth="4"
              fill="none"
              strokeDasharray="470"
              strokeDashoffset={470 * (1 - move(frame, 135, 188))}
            />
            <text x="4" y="105" fill={muted} fontSize="26">
              JAN · 100
            </text>
            <text x="506" y="105" textAnchor="end" fill={muted} fontSize="26">
              JUN · 108
            </text>
          </svg>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const Hypothesis: React.FC<{ frame: number }> = ({ frame }) => (
  <AbsoluteFill
    style={{
      background: "white",
      opacity: move(frame, 223, 249),
      transform: `translateY(${(1 - move(frame, 223, 255)) * 54}px)`,
    }}
  >
    <div
      style={{
        position: "absolute",
        left: 77,
        top: 177,
        color: blue,
        fontSize: 31,
        fontWeight: 600,
      }}
    >
      INTELIGÊNCIA COMPETITIVA
    </div>
    <div
      style={{
        position: "absolute",
        left: 74,
        top: 232,
        fontSize: 68,
        fontWeight: 540,
        letterSpacing: -3,
        lineHeight: 1.08,
      }}
    >
      O dado revela uma hipótese de produto.
    </div>
    <div style={{ position: "absolute", left: 77, top: 388, width: 1080 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "500px 290px 290px",
          fontSize: 31,
          color: muted,
          paddingBottom: 24,
          borderBottom: `2px solid ${line}`,
        }}
      >
        <span>Configuração comparável</span>
        <span>Versão A</span>
        <span>Versão B</span>
      </div>
      {[
        ["Preço público · índice", "100", "102"],
        ["Assistência à condução", "Opcional", "De série"],
        ["Lacuna a investigar", "Conteúdo", "Referência"],
      ].map((row, i) => (
        <div
          key={row[0]}
          style={{
            display: "grid",
            gridTemplateColumns: "500px 290px 290px",
            alignItems: "center",
            height: 111,
            borderBottom: `1.5px solid ${line}`,
            fontSize: 33,
            ...reveal(frame, 245 + i * 17),
          }}
        >
          {row.map((cell, j) => (
            <span
              key={cell}
              style={{
                color: j === 0 ? muted : j === 1 ? blue : navy,
                fontWeight: j > 0 ? 550 : 400,
              }}
            >
              {cell}
            </span>
          ))}
        </div>
      ))}
      <div style={{ marginTop: 26, fontSize: 28, color: muted }}>
        Versões hipotéticas · equipamentos e índices simulados
      </div>
    </div>
    <div
      style={{
        position: "absolute",
        left: 1240,
        top: 394,
        width: 595,
        borderLeft: `4px solid ${blue}`,
        paddingLeft: 37,
        ...reveal(frame, 290),
      }}
    >
      <div
        style={{ fontSize: 28, color: blue, fontWeight: 600, marginBottom: 25 }}
      >
        HIPÓTESE ESTRATÉGICA
      </div>
      <div
        style={{
          fontSize: 53,
          letterSpacing: -2,
          lineHeight: 1.12,
          fontWeight: 520,
        }}
      >
        Preço próximo.
        <br />
        Conteúdo diferente.
      </div>
      <div
        style={{ fontSize: 33, lineHeight: 1.38, color: muted, marginTop: 32 }}
      >
        Avaliar o pacote de equipamentos antes de definir a próxima versão.
      </div>
    </div>
  </AbsoluteFill>
);

const Command: React.FC<{ frame: number }> = ({ frame }) => {
  const complete = move(frame, 445, 464);
  return (
    <AbsoluteFill
      style={{
        color: "white",
        background: ink,
        opacity: move(frame, 351, 377),
        transform: `translateY(${(1 - move(frame, 351, 389)) * 90}px)`,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 78,
          top: 184,
          fontSize: 31,
          color: "#99BBEF",
          letterSpacing: 0.4,
        }}
      >
        SPECSYNC / MATERIAIS EXECUTIVOS
      </div>
      <div
        style={{
          position: "absolute",
          left: 74,
          top: 261,
          fontSize: 72,
          letterSpacing: -3.2,
          fontWeight: 500,
          lineHeight: 1.08,
        }}
      >
        Da hipótese ao comitê de produto.
      </div>
      <div
        style={{
          position: "absolute",
          left: 78,
          right: 78,
          top: 386,
          height: 238,
          border: "1.5px solid #395379",
          borderRadius: 17,
          background: "linear-gradient(120deg,#122038,#101827 80%)",
          padding: "34px 40px",
          boxShadow: "0 26px 70px #0004",
          ...reveal(frame, 364),
        }}
      >
        <div
          style={{
            fontSize: 39,
            lineHeight: 1.38,
            letterSpacing: -0.8,
            maxWidth: 1510,
          }}
        >
          Gere uma apresentação executiva e um relatório estratégico com a
          recomendação de portfólio.
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 24,
            color: "#ADC2E3",
            fontSize: 29,
            gap: 32,
          }}
        >
          <span>Produto · Marketing · Vendas</span>
          <span style={{ color: "#5273A7" }}> / </span>
          <span>Conclusões, implicações e recomendações</span>
        </div>
        <div
          style={{
            position: "absolute",
            right: 34,
            bottom: 31,
            width: 56,
            height: 56,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            background: blue,
            borderRadius: 28,
          }}
        >
          <Arrow size={32} />
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 82,
          right: 82,
          top: 681,
          display: "flex",
          alignItems: "center",
          gap: 40,
          ...reveal(frame, 396),
        }}
      >
        <span style={{ fontSize: 30, color: "#94AACA" }}>
          FONTES SELECIONADAS
        </span>
        {["Mercado", "Veículos e versões", "Fontes e premissas"].map(
          (label, i) => (
            <div
              key={label}
              style={{
                display: "flex",
                gap: 12,
                alignItems: "center",
                fontSize: 31,
                color: "#E1ECFC",
                ...reveal(frame, 404 + i * 13),
              }}
            >
              <span style={{ color: "#78AEFF" }}>
                <Check />
              </span>
              {label}
            </div>
          ),
        )}
      </div>
      <div
        style={{
          position: "absolute",
          left: 82,
          right: 82,
          top: 783,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderTop: "1px solid #2C405E",
          paddingTop: 28,
          ...reveal(frame, 431),
        }}
      >
        <div style={{ fontSize: 34 }}>
          <span style={{ color: "#6EABFF", marginRight: 18 }}>↗</span>
          {complete > 0.5
            ? "Construindo os materiais executivos"
            : "Conectando evidências à recomendação"}
        </div>
        <div style={{ color: "#AFC3E3", fontSize: 29 }}>
          .pptx <span style={{ margin: "0 21px", color: "#627995" }}>+</span>{" "}
          .docx
        </div>
      </div>
    </AbsoluteFill>
  );
};

const DocumentChrome: React.FC<{ frame: number; report?: boolean }> = ({
  frame,
  report = false,
}) => {
  const done = move(frame, report ? 803 : 672, report ? 813 : 694);
  return (
    <>
      <div
        style={{
          position: "absolute",
          left: 43,
          right: 43,
          top: 27,
          display: "flex",
          alignItems: "center",
          fontSize: 27,
          color: muted,
          borderBottom: `1.5px solid ${line}`,
          paddingBottom: 24,
        }}
      >
        <div style={{ fontWeight: 650, color: navy, fontSize: 29 }}>
          SpecSync
        </div>
        <div
          style={{ height: 27, width: 1, background: line, margin: "0 27px" }}
        />
        <div>
          {report
            ? "diretrizes-proximo-veiculo.docx"
            : "posicionamento-competitivo.pptx"}
        </div>
        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            gap: 11,
            alignItems: "center",
            color: done > 0.5 ? blue : muted,
          }}
        >
          {done > 0.5 && <Check size={24} />}
          {done > 0.5 ? "Pronto para revisão" : "Gerando conteúdo"}
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 44,
          right: 44,
          bottom: 29,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderTop: `1.5px solid ${line}`,
          paddingTop: 18,
          fontSize: 27,
          color: muted,
        }}
      >
        <span>Fontes: mercado + fichas técnicas simuladas</span>
        <span>Brasil · Picapes médias · Varejo · 1º semestre</span>
      </div>
    </>
  );
};

const ExecutiveSlide: React.FC<{ frame: number }> = ({ frame }) => {
  const entry = move(frame, 462, 499);
  const exit = move(frame, 714, 749);
  const columns = [
    {
      number: "01",
      heading: "Onde competir",
      text: "Picapes médias no varejo, com recorte por versão.",
      cue: 532,
    },
    {
      number: "02",
      heading: "Configuração e preço-alvo",
      text: "Avaliar assistência ampliada. Validar a faixa de preço.",
      cue: 563,
    },
    {
      number: "03",
      heading: "Próxima decisão",
      text: "Testar demanda, custos e percepção de valor.",
      cue: 595,
    },
  ];
  return (
    <div
      style={{
        position: "absolute",
        left: 70,
        top: 170,
        width: 1780,
        height: 720,
        perspective: 2400,
        opacity: entry * (1 - exit),
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 8,
          background: "white",
          boxShadow: "0 35px 110px #0007",
          overflow: "hidden",
          color: navy,
          transformOrigin: "70% 40%",
          transform: `translate3d(${(1 - entry) * 470 - exit * 150}px,${(1 - entry) * 90 - exit * 45}px,0) rotateY(${(1 - entry) * -13 - exit * 7}deg) rotateX(${(1 - entry) * 4}deg) scale(${1 - exit * 0.06})`,
        }}
      >
        <DocumentChrome frame={frame} />
        <div
          style={{
            position: "absolute",
            left: 47,
            top: 108,
            fontSize: 27,
            color: blue,
            fontWeight: 600,
            letterSpacing: 0.7,
            ...reveal(frame, 477),
          }}
        >
          COMITÊ DE PRODUTO · EXEMPLO SIMULADO
        </div>
        <div
          style={{
            position: "absolute",
            left: 44,
            top: 153,
            fontSize: 63,
            letterSpacing: -2.7,
            fontWeight: 560,
            ...reveal(frame, 486),
          }}
        >
          Posicionamento competitivo
        </div>
        <div
          style={{
            position: "absolute",
            left: 46,
            top: 246,
            width: 1590,
            fontSize: 43,
            lineHeight: 1.23,
            letterSpacing: -1.2,
            ...reveal(frame, 508, 535),
          }}
        >
          Uma lacuna de equipamentos pode orientar
          <br />a hipótese da próxima versão.
        </div>
        <div
          style={{
            position: "absolute",
            left: 47,
            right: 47,
            top: 392,
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
          }}
        >
          {columns.map((column, i) => (
            <div
              key={column.number}
              style={{
                paddingLeft: i === 0 ? 0 : 33,
                paddingRight: 32,
                minHeight: 196,
                borderLeft: i > 0 ? `1.5px solid ${line}` : undefined,
                ...reveal(frame, column.cue, column.cue + 32),
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 15,
                  marginBottom: 20,
                }}
              >
                <span style={{ fontSize: 27, color: blue }}>
                  {column.number}
                </span>
                <span
                  style={{ fontSize: 31, fontWeight: 650, letterSpacing: -0.8 }}
                >
                  {column.heading}
                </span>
              </div>
              <div
                style={{
                  fontSize: 33,
                  lineHeight: 1.34,
                  color: muted,
                  letterSpacing: -0.3,
                }}
              >
                {column.text}
              </div>
            </div>
          ))}
        </div>
        <div
          style={{
            position: "absolute",
            left: 46,
            bottom: 97,
            display: "flex",
            alignItems: "center",
            gap: 13,
            color: blue,
            fontSize: 28,
            ...reveal(frame, 642),
          }}
        >
          <Check size={26} />
          Conclusão → implicação → recomendação, com evidências rastreáveis
        </div>
      </div>
    </div>
  );
};

const StrategicReport: React.FC<{ frame: number }> = ({ frame }) => {
  const entry = move(frame, 707, 748);
  return (
    <div
      style={{
        position: "absolute",
        left: 70,
        top: 170,
        width: 1780,
        height: 720,
        perspective: 2400,
        opacity: entry,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "white",
          borderRadius: 8,
          boxShadow: "0 35px 110px #0007",
          overflow: "hidden",
          color: navy,
          transformOrigin: "20% 40%",
          transform: `translate3d(${(1 - entry) * 630}px,${(1 - entry) * 45}px,0) rotateY(${(1 - entry) * 11}deg)`,
        }}
      >
        <DocumentChrome frame={frame} report />
        <div
          style={{
            position: "absolute",
            left: 46,
            top: 111,
            fontSize: 27,
            color: blue,
            fontWeight: 600,
            letterSpacing: 0.7,
            ...reveal(frame, 714),
          }}
        >
          RELATÓRIO ESTRATÉGICO · EXEMPLO SIMULADO
        </div>
        <div
          style={{
            position: "absolute",
            left: 44,
            top: 158,
            fontSize: 61,
            letterSpacing: -2.8,
            fontWeight: 560,
            ...reveal(frame, 721),
          }}
        >
          Diretrizes para o próximo veículo
        </div>
        <div style={{ position: "absolute", left: 47, top: 265, width: 1055 }}>
          {[
            {
              label: "Hipótese",
              text: "Ampliar o pacote de assistência pode diferenciar a versão.",
              cue: 732,
            },
            {
              label: "Cenário-base",
              text: "Comparar conteúdo e preço no mesmo segmento e canal.",
              cue: 752,
            },
            {
              label: "Riscos e premissas",
              text: "Validar demanda, custos, disponibilidade e atualização das fontes.",
              cue: 772,
            },
          ].map((row) => (
            <div
              key={row.label}
              style={{
                display: "grid",
                gridTemplateColumns: "250px 1fr",
                columnGap: 24,
                padding: "19px 0 21px",
                borderTop: `1.5px solid ${line}`,
                ...reveal(frame, row.cue, row.cue + 30),
              }}
            >
              <div
                style={{
                  fontSize: 30,
                  fontWeight: 600,
                  color: navy,
                  lineHeight: 1.3,
                }}
              >
                {row.label}
              </div>
              <div
                style={{
                  fontSize: 32,
                  lineHeight: 1.31,
                  color: muted,
                  letterSpacing: -0.4,
                }}
              >
                {row.text}
              </div>
            </div>
          ))}
        </div>
        <div
          style={{
            position: "absolute",
            left: 1170,
            right: 46,
            top: 276,
            bottom: 104,
            background: "#EDF4FF",
            borderLeft: `5px solid ${blue}`,
            padding: "28px 30px",
            ...reveal(frame, 782, 803),
          }}
        >
          <div
            style={{
              color: blue,
              fontSize: 27,
              fontWeight: 650,
              marginBottom: 20,
            }}
          >
            RECOMENDAÇÃO AO COMITÊ
          </div>
          <div
            style={{
              fontSize: 39,
              lineHeight: 1.18,
              fontWeight: 540,
              letterSpacing: -1,
            }}
          >
            Validar a configuração antes de comprometer o portfólio.
          </div>
          <div
            style={{
              color: muted,
              fontSize: 28,
              lineHeight: 1.35,
              marginTop: 25,
            }}
          >
            Produto, Marketing e Vendas
            <br />
            decidem sobre a mesma evidência.
          </div>
        </div>
      </div>
    </div>
  );
};

export const Future: React.FC<{ durationInFrames?: number }> = ({
  durationInFrames = 979,
}) => {
  const elapsed = Math.min(
    978,
    (useCurrentFrame() * 978) / Math.max(1, durationInFrames - 1),
  );
  // Match the narration beats while allowing the parent sequence to retime the scene.
  const frame = interpolate(
    elapsed,
    [0, 180, 196, 346, 427, 660, 978],
    [0, 194, 220, 349, 460, 707, 929],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const dark = frame >= 363;
  return (
    <AbsoluteFill
      style={{
        fontFamily,
        background: dark ? ink : "white",
        color: navy,
        overflow: "hidden",
      }}
    >
      {frame < 251 && <Market frame={frame} />}
      {frame >= 220 && frame < 380 && <Hypothesis frame={frame} />}
      {frame >= 349 && frame < 500 && <Command frame={frame} />}
      {frame >= 460 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(ellipse at 64% 48%,#142B56 0%,#080F21 58%,#050914 100%)",
            opacity: move(frame, 460, 495),
          }}
        />
      )}
      {frame >= 460 && frame < 752 && <ExecutiveSlide frame={frame} />}
      {frame >= 705 && <StrategicReport frame={frame} />}
      <div
        style={{
          position: "absolute",
          left: 74,
          top: 78,
          padding: "15px 22px",
          background: blue,
          color: "white",
          fontSize: 28,
          fontWeight: 550,
          letterSpacing: 0.6,
          borderRadius: 5,
        }}
      >
        VISÃO FUTURA · CONCEITO
      </div>
      <div
        style={{
          position: "absolute",
          right: 77,
          top: 96,
          color: dark ? "#BBD0EF" : muted,
          fontSize: 29,
          fontWeight: 500,
        }}
      >
        SpecSync{" "}
        <span style={{ color: dark ? "#526D97" : "#B0BED1", margin: "0 18px" }}>
          /
        </span>{" "}
        {frame >= 707
          ? "Relatório estratégico · .docx"
          : frame >= 460
            ? "Apresentação executiva · .pptx"
            : "Estratégia de produto"}
      </div>
      <div
        style={{
          position: "absolute",
          left: 77,
          top: 926,
          color: dark ? "#BDCAE0" : muted,
          fontSize: 27,
        }}
      >
        Dados simulados · funcionalidades propostas
      </div>
    </AbsoluteFill>
  );
};
