export { AskSpecSync as DemoAsk } from "./scenes/03-AskSpecSync";
export { Research as DemoResearch } from "./scenes/04-Research";
export { StandardOutput as DemoOutput } from "./scenes/05-StandardOutput";
export { Compare as DemoCompare } from "./scenes/06-Compare";
export { Ontology as DemoOntology } from "./scenes/07-Ontology";
export type { DemoSceneProps } from "./timing";

export const demoReferenceFrames = {
  ask: 270,
  research: 480,
  output: 360,
  compare: 390,
  ontology: 480,
} as const;
