# ADR-0002: React Native Reusables on Uniwind with the Ford tokens

- Status: accepted
- Date: 2026-09-27

## Context

The web app styles everything with Tailwind v4 utilities and shadcn-style
components (Zard) on the Ford tokens in `libs/ui/styles.css`. The mobile app
needs a comparable component library and must look like the same product.

React Native Reusables (https://reactnativereusables.com) ports shadcn/ui to
React Native on `@rn-primitives`. It can style with NativeWind (Tailwind v3)
or Uniwind (Tailwind v4). The workspace root already installs
`tailwindcss@4` for web.

## Decision

Use React Native Reusables with **Uniwind**:

- The components live in `src/design-system/components/ui`, added with the
  Reusables CLI.
- `src/global.css` carries the Ford tokens, copied from `libs/ui/styles.css`
  into Uniwind's `@theme` / `@variant light|dark` format.
- `src/design-system/theme.ts` mirrors those tokens as sRGB for code that
  cannot use class names, such as the navigation theme and icon tints.
- Icons are Lucide, as on web.

**Why Uniwind:** it runs on Tailwind v4 like web, so the hoisted install keeps
one Tailwind major, and the token CSS stays close to web's.

**CLI setup:**

- `components.json` points the CLI at `@mobile/design-system/...`.
- `apps/mobile/tsconfig.json` maps `@mobile/*` to `./src/*`, so the CLI
  writes into the app.
- `apps/mobile` is an npm workspace, so the CLI's dependency install lands in
  the root lockfile.

The generated `Textarea` was adapted from NativeWind's `placeholderClassName`
to Uniwind's `placeholderTextColorClassName`.

## Consequences

- **One theme, three files:** the Ford theme is defined in three places
  (`libs/ui/styles.css`, `global.css`, `theme.ts`). Change web first, then
  mirror.
- **Where the skills disagree:** the Expo skills favour SF Symbols and
  `@expo/ui` native controls. We use Lucide and Reusables components for
  parity with web. Reach for `@expo/ui` (menus, pickers, sheets) where a
  native control is clearly better, wrapped in the design system.
- **Build and test config:** Metro wraps the config with `withUniwindConfig`,
  and Jest transforms `@rn-primitives`, `uniwind` and `lucide-react-native`.
