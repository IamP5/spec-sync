import "./index.css";
import { Audio } from "@remotion/media";
import { TransitionSeries } from "@remotion/transitions";
import {
  AbsoluteFill,
  Composition,
  Folder,
  interpolate,
  Sequence,
  staticFile,
} from "remotion";
import { ChapterCut } from "./components/ChapterCut";
import { Voice } from "./components/Voice";
import { TrySpecSync } from "./components/TrySpecSync";
import { Hook } from "./scenes/Hook";
import { Future } from "./scenes/Future";
import { Ontology } from "./scenes/Ontology";
import { Close } from "./scenes/Close";
import { DemoAsk, DemoResearch, DemoOutput, DemoCompare } from "./demo";
import storyboard from "./data/storyboard.json";

const fps = 30;
const scenes = [
  Hook,
  DemoAsk,
  DemoResearch,
  DemoOutput,
  DemoCompare,
  Ontology,
  Future,
  Close,
];
const sceneFrames = storyboard.map((scene) => Math.round(scene.duration * fps));
const totalFrames = sceneFrames.reduce((sum, duration) => sum + duration, 0);
const demoStart = storyboard[1].startFrame;
const demoEnd = storyboard[5].startFrame;
const closingQRStart = storyboard[7].startFrame + 540;

export const Pitch: React.FC = () => (
  <AbsoluteFill>
    <TransitionSeries>
      {storyboard.flatMap((scene, index) => {
        const Scene = scenes[index];
        const chapter = (
          <TransitionSeries.Sequence
            key={scene.id}
            durationInFrames={sceneFrames[index]}
            name={scene.title}
          >
            <Scene durationInFrames={sceneFrames[index]} />
            <Voice index={index} />
          </TransitionSeries.Sequence>
        );
        return index === 0
          ? [chapter]
          : [
              <TransitionSeries.Overlay
                key={`${scene.id}-cut`}
                durationInFrames={16}
              >
                <ChapterCut />
              </TransitionSeries.Overlay>,
              chapter,
            ];
      })}
    </TransitionSeries>
    <Sequence
      from={demoStart}
      durationInFrames={demoEnd - demoStart}
      layout="none"
      name="Experimente o SpecSync durante a demo"
    >
      <TrySpecSync />
    </Sequence>
    <Sequence
      from={closingQRStart}
      durationInFrames={totalFrames - closingQRStart}
      layout="none"
      name="Experimente o SpecSync no encerramento"
    >
      <TrySpecSync variant="closing" />
    </Sequence>
    <Audio
      src={staticFile("audio/score-v5.wav")}
      volume={(frame) =>
        interpolate(
          frame,
          [0, 30, totalFrames - 100, totalFrames],
          [0, 0.45, 0.45, 0],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        )
      }
    />
    {storyboard.slice(1).map((scene) => (
      <Sequence
        key={scene.id}
        from={Math.round(scene.start * fps) - 5}
        durationInFrames={90}
        layout="none"
        name="Passagem de capítulo"
      >
        <Audio src={staticFile("audio/sfx/whoosh.wav")} volume={0.045} />
      </Sequence>
    ))}
  </AbsoluteFill>
);

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="SpecSyncFord"
      component={Pitch}
      durationInFrames={totalFrames}
      fps={fps}
      width={1920}
      height={1080}
    />
    <Folder name="Cenas">
      {storyboard.map((scene, index) => (
        <Composition
          key={scene.id}
          id={scene.id}
          component={scenes[index]}
          defaultProps={{ durationInFrames: sceneFrames[index] }}
          durationInFrames={sceneFrames[index]}
          fps={fps}
          width={1920}
          height={1080}
        />
      ))}
    </Folder>
  </>
);
