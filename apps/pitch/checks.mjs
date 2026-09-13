// Rendering is an explicit production task; regular checks validate its source.
export const pitchChecks = {
  name: "pitch",
  paths: ["apps/pitch/"],
  fastSteps: [
    "npx nx run pitch:lint --output-style=static-failures-only",
    "npx nx run pitch:typecheck --output-style=static-failures-only",
  ],
  fullOnlySteps: ["npx nx run pitch:build --output-style=static-failures-only"],
};
