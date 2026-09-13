// Design tokens shared by the scenes. Colors mirror libs/ui/styles.css (the
// SpecSync theme, itself read from ford.com) so the reconstructed UI matches
// the product. Keep hex literals inline in Interactive.* styles when Studio
// editability matters; import from here everywhere else.

export const color = {
  // Ford brand (invariant across light/dark)
  fordBlue: "#0562d2", // accent
  fordAction: "#066fef", // primary button
  fordActionHover: "#044ea7",
  fordHeritage: "#00095b", // Ford Blue
  fordDeep: "#00142e", // "Twilight"
  fordSky: "#0093f0", // on-dark accent (links)

  // Dark surfaces (product dark mode)
  page: "#0f0f0f",
  card: "#212121",
  muted: "#303030",
  elevated: "#414141",
  sidebar: "#171717",
  border: "rgba(255,255,255,0.10)",
  input: "rgba(255,255,255,0.18)",

  // Text on dark
  text: "#f0f0f0",
  textSecondary: "#e5e5e5",
  textMuted: "#b2b2b2",
  textSubtle: "#8a8a8a",

  // Status (dark-lifted)
  success: "#68b631",
  warning: "#f0a04b",
  error: "#e5493d",
  info: "#0093f0",

  white: "#ffffff",
  black: "#000000",
} as const;

export const radius = {
  xs: 4,
  sm: 8,
  md: 10,
  lg: 12,
  xl: 16,
  "2xl": 20,
  "3xl": 24,
  full: 9999,
} as const;

// Motion vocabulary read from ford.com's live tokens:
//   --motion-duration: 400ms; --motion-easing: cubic-bezier(0.4, 0, 0.2, 1)
//   text/card enter: opacity 0→1 + translateY 32px→0 (12 frames at 30 fps)
//   zoom enter: opacity 0→1 + scale 0.92→1 (12 frames)
//   image push-zoom: scale 1→1.1 over 600 ms (18 frames), ease-out
//   hero crossfade 500 ms; hold each hero ~6 s; stagger 80-120 ms (3 frames)
//   drawers/hotspots: cubic-bezier(0.22, 1, 0.36, 1)
export const motion = {
  ease: [0.4, 0, 0.2, 1] as const,
  easeQuint: [0.22, 1, 0.36, 1] as const,
  enterFrames: 12,
  imageFrames: 18,
  staggerFrames: 3,
  enterOffsetPx: 32,
} as const;

// Ford campaign palette additions (published in Ford's own brand guidelines)
export const ford = {
  blue: "#00095b",
  twilight: "#00142e",
  skyview: "#066fef",
  interactive: "#0562d2",
  onDark: "#388cf2",
  hover: "#044ea7",
  performanceRed: "#d50032",
} as const;

// Keynote layer (v3): full-bleed stages, display typography and the
// shell-with-rail used by the reconstructed product screens.
export const stage = {
  dark: "#06070c",
  darkGlow: "#0a1030",
  blue: "#00095b",
  light: "#ffffff",
  lightMuted: "#f4f6fa",
  text: "#ffffff",
  textMuted: "rgba(255,255,255,0.62)",
  textFaint: "rgba(255,255,255,0.38)",
  navy: "#00142e",
} as const;

export const type = {
  display: 224,
  hero: 150,
  headline: 104,
  title: 56,
  lead: 36,
  body: 28,
  small: 22,
  tracking: -0.045,
} as const;
