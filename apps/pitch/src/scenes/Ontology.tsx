import {
  AbsoluteFill,
  Easing,
  Interactive,
  interpolate,
  useCurrentFrame,
} from "remotion";
import { fontFamily } from "../font";

type Vector = { x: number; y: number; z: number };
type Projection = { x: number; y: number; depth: number; size: number };
const ease = {
  extrapolateLeft: "clamp" as const,
  extrapolateRight: "clamp" as const,
  easing: Easing.bezier(0.22, 1, 0.36, 1),
};
const examples = [
  {
    manufacturer: "Ford",
    term: "AdvanceTrac",
    cue: 52,
    initial: { x: -590, y: -60, z: 95 },
    relation: { x: -595, y: -165, z: 75 },
    agent: { x: -615, y: -55, z: 105 },
    entity: "Veículos",
    detail: "Fabricante + modelo",
    agentLabel: "Pesquisa",
  },
  {
    manufacturer: "Toyota",
    term: "VSC",
    cue: 109,
    initial: { x: 570, y: -195, z: -85 },
    relation: { x: 590, y: -175, z: -85 },
    agent: { x: 550, y: -180, z: -65 },
    entity: "Versões",
    detail: "Configuração + período",
    agentLabel: "Comparação",
  },
  {
    manufacturer: "Honda",
    term: "VSA",
    cue: 161,
    initial: { x: 570, y: 135, z: 60 },
    relation: { x: 560, y: 155, z: 75 },
    agent: { x: 560, y: 160, z: 95 },
    entity: "Fontes",
    detail: "Origem + evidência",
    agentLabel: "Análise",
  },
];

const project = (position: Vector, frame: number): Projection => {
  const orbit = interpolate(
    frame,
    [0, 170, 390, 455, 530, 600, 839],
    [-0.23, -0.1, 0.12, 0.19, 0.11, -0.12, -0.22],
    ease,
  );
  const elevation = Math.sin(frame / 270) * 0.045;
  const zoom = interpolate(
    frame,
    [0, 95, 395, 451, 530, 598, 839],
    [0.99, 0.95, 0.98, 0.89, 0.9, 0.96, 0.98],
    ease,
  );
  const panX = interpolate(
    frame,
    [0, 95, 399, 455, 530, 595, 839],
    [-45, 0, 0, 30, 30, -20, -25],
    ease,
  );
  const panY = interpolate(
    frame,
    [0, 110, 395, 455, 535, 598, 839],
    [16, 0, 0, -4, -4, -10, -10],
    ease,
  );
  const rotatedX = position.x * Math.cos(orbit) + position.z * Math.sin(orbit);
  const rotatedZ = -position.x * Math.sin(orbit) + position.z * Math.cos(orbit);
  const rotatedY =
    position.y * Math.cos(elevation) - rotatedZ * Math.sin(elevation);
  const depth =
    position.y * Math.sin(elevation) + rotatedZ * Math.cos(elevation);
  const perspective = (1850 / (1850 + depth)) * zoom;
  return {
    x: 960 + (rotatedX - panX) * perspective,
    y: 530 + (rotatedY - panY) * perspective,
    depth,
    size: perspective,
  };
};

const orbitPath = (frame: number, radius: number, phase: number) =>
  Array.from({ length: 81 }, (_, index) => {
    const angle = (index / 80) * Math.PI * 2;
    const point = project(
      {
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius * 0.46,
        z: Math.sin(angle + phase) * radius * 0.55,
      },
      frame,
    );
    return `${index ? "L" : "M"} ${point.x} ${point.y}`;
  }).join(" ");

const Connection: React.FC<{
  from: Projection;
  to: Projection;
  frame: number;
  delay: number;
  opacity?: number;
}> = ({ from, to, frame, delay, opacity = 1 }) => {
  const reveal = interpolate(frame, [delay, delay + 40], [0, 1], ease);
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const bend = Math.min(95, Math.abs(dx) * 0.12);
  const path = `M ${from.x} ${from.y} C ${from.x + dx * 0.3} ${from.y + dy * 0.25 - bend}, ${from.x + dx * 0.75} ${from.y + dy * 0.8 - bend}, ${to.x} ${to.y}`;
  const travel = ((frame - delay + 500) % 160) / 160;
  return (
    <g opacity={opacity * reveal}>
      <path
        d={path}
        fill="none"
        stroke="#066FEF"
        strokeWidth={2.5}
        opacity={0.34}
      />
      <path
        d={path}
        fill="none"
        stroke="#066FEF"
        strokeWidth={10}
        opacity={0.26}
        pathLength={1}
        strokeDasharray="0.10 0.90"
        strokeDashoffset={-travel}
        filter="url(#ontology-glow)"
      />
      <path
        d={path}
        fill="none"
        stroke="#FFFFFF"
        strokeWidth={3.2}
        opacity={0.82}
        pathLength={1}
        strokeDasharray="0.024 0.976"
        strokeDashoffset={-travel}
      />
    </g>
  );
};

const MaterialNode: React.FC<{
  position: Projection;
  radius: number;
  opacity?: number;
  large?: boolean;
}> = ({ position, radius, opacity = 1, large = false }) => (
  <g opacity={opacity}>
    <ellipse
      cx={position.x + radius * 0.15}
      cy={position.y + radius * 0.83}
      rx={radius * 1.25}
      ry={radius * 0.17}
      fill="#000000"
      opacity={0.52}
      filter="url(#ontology-soft-shadow)"
    />
    <circle
      cx={position.x}
      cy={position.y}
      r={radius * 1.22}
      fill="#066FEF"
      opacity={large ? 0.11 : 0.14}
      filter="url(#ontology-glow)"
    />
    <circle
      cx={position.x}
      cy={position.y}
      r={radius}
      fill={
        large ? "url(#ontology-hero-material)" : "url(#ontology-node-material)"
      }
    />
    <circle
      cx={position.x}
      cy={position.y}
      r={radius - 1}
      fill="none"
      stroke="url(#ontology-rim)"
      strokeWidth={large ? 1.5 : 1}
    />
  </g>
);

const NodeLabel: React.FC<{
  name: string;
  position: Projection;
  opacity: number;
  role: string;
  label: string;
  detail?: string;
  size?: number;
}> = ({ name, position, opacity, role, label, detail, size = 62 }) => (
  <Interactive.Div
    name={name}
    style={{
      position: "absolute",
      left: position.x - 245,
      top: position.y + 68,
      width: 490,
      textAlign: "center",
      opacity,
      textShadow: "0 3px 24px #050914",
    }}
  >
    <div
      style={{
        fontSize: 34,
        lineHeight: 1.1,
        fontWeight: 450,
        color: "#B6CEF5",
        marginBottom: 10,
        letterSpacing: -0.65,
      }}
    >
      {role}
    </div>
    <div
      style={{
        fontSize: size,
        lineHeight: 1.04,
        fontWeight: 530,
        letterSpacing: -2.3,
      }}
    >
      {label}
    </div>
    {detail && (
      <div
        style={{
          fontSize: 31,
          lineHeight: 1.15,
          color: "#AFC1DC",
          marginTop: 13,
          letterSpacing: -0.6,
        }}
      >
        {detail}
      </div>
    )}
  </Interactive.Div>
);

export const Ontology: React.FC<{ durationInFrames?: number }> = ({
  durationInFrames = 840,
}) => {
  const currentFrame = useCurrentFrame();
  const frame = Math.min(
    839,
    Math.max(0, (currentFrame * 839) / Math.max(1, durationInFrames - 1)),
  );
  const terms = interpolate(frame, [0, 24, 398, 422], [0, 1, 1, 0], ease);
  const relations = interpolate(
    frame,
    [426, 450, 526, 548],
    [0, 1, 1, 0],
    ease,
  );
  const agents = interpolate(frame, [575, 614], [0, 1], ease);
  const fordVocabulary = interpolate(frame, [550, 582], [0, 1], ease);
  const commonConcept = interpolate(frame, [254, 285], [0, 1], ease);
  const hub = project({ x: 0, y: 0, z: 0 }, frame);
  const heroRadius =
    interpolate(
      frame,
      [0, 396, 451, 528, 596],
      [205, 205, 190, 190, 215],
      ease,
    ) * hub.size;
  const nodes = examples.map((example) => {
    const position = Object.fromEntries(
      (["x", "y", "z"] as const).map((axis) => [
        axis,
        interpolate(
          frame,
          [0, 396, 455, 532, 601, 839],
          [
            example.initial[axis],
            example.initial[axis],
            example.relation[axis],
            example.relation[axis],
            example.agent[axis],
            example.agent[axis],
          ],
          ease,
        ),
      ]),
    ) as Vector;
    position.y += Math.sin(frame / 96 + example.cue) * 5;
    return {
      ...example,
      projected: project(position, frame),
      appearance: interpolate(
        frame,
        [example.cue - 14, example.cue + 14],
        [0, 1],
        ease,
      ),
    };
  });
  const market = project({ x: -590, y: 155, z: -55 }, frame);
  const edgeLabel = project({ x: -365, y: -148, z: 30 }, frame);
  return (
    <AbsoluteFill
      style={{
        background: "#050914",
        color: "#FFFFFF",
        fontFamily,
        overflow: "hidden",
      }}
    >
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at 56% 47%, #00095B 0%, #071132 39%, #050914 77%)",
        }}
      />
      <Interactive.Div
        name="Brazilian ontology example disclosure"
        style={{
          position: "absolute",
          left: 80,
          top: 72,
          fontSize: 31,
          fontWeight: 440,
          letterSpacing: -0.4,
          color: "#B7C9E7",
        }}
      >
        Exemplo explicativo de normalização · fontes brasileiras
      </Interactive.Div>
      <Interactive.Div
        name="Different manufacturer names"
        style={{
          position: "absolute",
          left: 80,
          top: 163,
          fontSize: 84,
          lineHeight: 1,
          letterSpacing: -4,
          fontWeight: 540,
          opacity: interpolate(frame, [0, 22, 79, 112], [0, 1, 1, 0], ease),
          translate: interpolate(frame, [0, 32], ["0px 25px", "0px 0px"], ease),
        }}
      >
        Nomes diferentes.
      </Interactive.Div>
      <Interactive.Div
        name="Shared function relationship"
        style={{
          position: "absolute",
          left: 80,
          right: 80,
          top: 165,
          textAlign: "center",
          fontSize: 75,
          fontWeight: 520,
          letterSpacing: -3.2,
          opacity: interpolate(frame, [232, 269, 386, 414], [0, 1, 1, 0], ease),
        }}
      >
        Uma função em comum.
      </Interactive.Div>
      <Interactive.Div
        name="Vehicle version and source context"
        style={{
          position: "absolute",
          left: 80,
          right: 80,
          top: 165,
          textAlign: "center",
          fontSize: 74,
          fontWeight: 520,
          letterSpacing: -3.1,
          opacity: relations,
        }}
      >
        Relações que mantêm o contexto.
      </Interactive.Div>
      <Interactive.Div
        name="Ford vocabulary transition"
        style={{
          position: "absolute",
          left: 80,
          right: 80,
          top: 165,
          textAlign: "center",
          fontSize: 76,
          fontWeight: 520,
          letterSpacing: -3.2,
          opacity: interpolate(frame, [549, 575, 628, 650], [0, 1, 1, 0], ease),
        }}
      >
        Conhecimento no vocabulário Ford.
      </Interactive.Div>
      <Interactive.Div
        name="Competitive intelligence question"
        style={{
          position: "absolute",
          left: 80,
          right: 80,
          top: 165,
          textAlign: "center",
          fontSize: 72,
          fontWeight: 520,
          letterSpacing: -3.2,
          opacity: interpolate(frame, [654, 684], [0, 1], ease),
          translate: interpolate(
            frame,
            [652, 692],
            ["0px 20px", "0px 0px"],
            ease,
          ),
        }}
      >
        Quais versões oferecem essa função?
      </Interactive.Div>
      <svg
        width={1920}
        height={1080}
        style={{ position: "absolute", inset: 0 }}
      >
        <defs>
          <radialGradient id="ontology-hero-material" cx="31%" cy="24%" r="77%">
            <stop offset="0" stopColor="#315ECB" />
            <stop offset="0.29" stopColor="#132D87" />
            <stop offset="0.68" stopColor="#00095B" />
            <stop offset="1" stopColor="#030B29" />
          </radialGradient>
          <radialGradient id="ontology-node-material" cx="29%" cy="23%" r="80%">
            <stop offset="0" stopColor="#FFFFFF" />
            <stop offset="0.12" stopColor="#99C7FF" />
            <stop offset="0.38" stopColor="#066FEF" />
            <stop offset="0.76" stopColor="#00318B" />
            <stop offset="1" stopColor="#00095B" />
          </radialGradient>
          <linearGradient id="ontology-rim" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#D2E7FF" stopOpacity={0.8} />
            <stop offset="0.52" stopColor="#066FEF" stopOpacity={0.15} />
            <stop offset="1" stopColor="#066FEF" stopOpacity={0.05} />
          </linearGradient>
          <filter
            id="ontology-glow"
            x="-100%"
            y="-100%"
            width="300%"
            height="300%"
          >
            <feGaussianBlur stdDeviation={10} />
          </filter>
          <filter
            id="ontology-soft-shadow"
            x="-100%"
            y="-200%"
            width="300%"
            height="500%"
          >
            <feGaussianBlur stdDeviation={20} />
          </filter>
        </defs>
        <path
          d={orbitPath(frame, 291, 0.45)}
          fill="none"
          stroke="#699DEB"
          strokeWidth={1.6}
          opacity={0.25}
        />
        <path
          d={orbitPath(frame, 315, 2.2)}
          fill="none"
          stroke="#066FEF"
          strokeWidth={2}
          opacity={0.18}
        />
        {nodes.map((node) => (
          <Connection
            key={`inbound-${node.term}`}
            from={node.projected}
            to={hub}
            frame={frame}
            delay={node.cue}
            opacity={node.appearance * (1 - agents)}
          />
        ))}
        {nodes.map((node, index) => (
          <Connection
            key={`agent-edge-${node.term}`}
            from={hub}
            to={node.projected}
            frame={frame}
            delay={576 + index * 12}
            opacity={agents}
          />
        ))}
        <Connection
          from={market}
          to={hub}
          frame={frame}
          delay={423}
          opacity={relations}
        />
        <Connection
          from={nodes[0].projected}
          to={nodes[1].projected}
          frame={frame}
          delay={439}
          opacity={relations * 0.42}
        />
        <Connection
          from={nodes[1].projected}
          to={nodes[2].projected}
          frame={frame}
          delay={447}
          opacity={relations * 0.42}
        />
        <Connection
          from={nodes[2].projected}
          to={market}
          frame={frame}
          delay={450}
          opacity={relations * 0.3}
        />
        {[...nodes]
          .sort((a, b) => b.projected.depth - a.projected.depth)
          .map((node) => (
            <MaterialNode
              key={`sphere-${node.term}`}
              position={node.projected}
              radius={47 * node.projected.size}
              opacity={node.appearance}
            />
          ))}
        <MaterialNode
          position={market}
          radius={40 * market.size}
          opacity={relations}
        />
        <MaterialNode position={hub} radius={heroRadius} large />
      </svg>
      {nodes.map((node) => (
        <NodeLabel
          key={`term-${node.term}`}
          name={`${node.manufacturer} commercial name`}
          position={node.projected}
          role={node.manufacturer}
          label={node.term}
          size={node.term === "AdvanceTrac" ? 64 : 72}
          opacity={terms * node.appearance}
        />
      ))}
      {nodes.map((node) => (
        <NodeLabel
          key={`entity-${node.term}`}
          name={`${node.entity} ontology relationship`}
          position={node.projected}
          role="RELACIONA"
          label={node.entity}
          detail={node.detail}
          size={60}
          opacity={relations}
        />
      ))}
      <NodeLabel
        name="Brazilian market context"
        position={market}
        role="CONTEXTO"
        label="Brasil"
        detail="Mercado de referência"
        size={58}
        opacity={relations}
      />
      {nodes.map((node, index) => (
        <NodeLabel
          key={`agent-label-${node.term}`}
          name={`${node.agentLabel} agent`}
          position={node.projected}
          role="AGENTE DE IA"
          label={node.agentLabel}
          size={node.agentLabel === "Comparação" ? 59 : 66}
          opacity={interpolate(
            frame,
            [580 + index * 12, 612 + index * 12],
            [0, 1],
            ease,
          )}
        />
      ))}
      <Interactive.Div
        name="Includes the stability function"
        style={{
          position: "absolute",
          left: edgeLabel.x - 164,
          top: edgeLabel.y,
          width: 328,
          textAlign: "center",
          fontSize: 33,
          lineHeight: 1.12,
          color: "#C4D8F7",
          letterSpacing: -0.7,
          opacity: interpolate(frame, [236, 273, 391, 421], [0, 1, 1, 0], ease),
        }}
      >
        inclui a função
      </Interactive.Div>
      <Interactive.Div
        name="Manufacturer terms awaiting normalization"
        style={{
          position: "absolute",
          left: hub.x - 255,
          top: hub.y - 84,
          width: 510,
          textAlign: "center",
          opacity: interpolate(frame, [0, 26, 229, 251], [0, 1, 1, 0], ease),
        }}
      >
        <div
          style={{
            fontSize: 33,
            fontWeight: 450,
            color: "#BDD1F2",
            letterSpacing: 2,
            marginBottom: 20,
          }}
        >
          ONTOLOGIA
        </div>
        <div
          style={{
            fontSize: 64,
            lineHeight: 1.05,
            fontWeight: 510,
            letterSpacing: -2.6,
          }}
        >
          Significado
          <br />
          em comum
        </div>
      </Interactive.Div>
      <Interactive.Div
        name="Electronic stability control common function"
        style={{
          position: "absolute",
          left: hub.x - 290,
          top: hub.y - 142,
          width: 580,
          textAlign: "center",
          opacity: commonConcept * interpolate(frame, [528, 548], [1, 0], ease),
        }}
      >
        <div
          style={{
            fontSize: 33,
            fontWeight: 450,
            color: "#BDD1F2",
            letterSpacing: 1.6,
            marginBottom: 8,
          }}
        >
          FUNÇÃO
        </div>
        <div
          style={{
            fontSize: 117,
            lineHeight: 1,
            fontWeight: 560,
            letterSpacing: -5.2,
          }}
        >
          ESC
        </div>
        <div
          style={{
            marginTop: 17,
            fontSize: 47,
            lineHeight: 1.1,
            fontWeight: 480,
            letterSpacing: -1.6,
          }}
        >
          Controle eletrônico
          <br />
          de estabilidade
        </div>
      </Interactive.Div>
      <Interactive.Div
        name="Ford-aligned shared knowledge"
        style={{
          position: "absolute",
          left: hub.x - 255,
          top: hub.y - 113,
          width: 510,
          textAlign: "center",
          opacity: fordVocabulary,
        }}
      >
        <div
          style={{
            fontSize: 33,
            fontWeight: 450,
            color: "#BDD1F2",
            letterSpacing: 1.1,
            marginBottom: 22,
          }}
        >
          BASE COMPARTILHADA
        </div>
        <div
          style={{
            fontSize: 69,
            lineHeight: 1.02,
            fontWeight: 530,
            letterSpacing: -3,
          }}
        >
          Vocabulário
          <br />
          Ford
        </div>
        <div
          style={{
            marginTop: 23,
            fontSize: 33,
            color: "#BACDF1",
            letterSpacing: -0.7,
          }}
        >
          Função + contexto + evidência
        </div>
      </Interactive.Div>
      <Interactive.Div
        name="Competitive intelligence outcome"
        style={{
          position: "absolute",
          left: 640,
          right: 640,
          top: 840,
          textAlign: "center",
          fontSize: 43,
          fontWeight: 480,
          letterSpacing: -1.3,
          color: "#AFCDFD",
          opacity: interpolate(frame, [681, 725], [0, 1], ease),
        }}
      >
        Inteligência competitiva
      </Interactive.Div>
      <Interactive.Div
        name="Function scope and manufacturer distinctions"
        style={{
          position: "absolute",
          left: 80,
          right: 80,
          top: 925,
          textAlign: "center",
          fontSize: 34,
          lineHeight: 1.1,
          fontWeight: 440,
          letterSpacing: -0.8,
          color: "#C2CFE5",
          opacity: interpolate(frame, [238, 270, 390, 420], [0, 1, 1, 0], ease),
        }}
      >
        Função em comum. Sistemas e condições preservados.
      </Interactive.Div>
    </AbsoluteFill>
  );
};
