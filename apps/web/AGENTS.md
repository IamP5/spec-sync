<!-- BEGIN:angular-agent-rules -->

# This is NOT the Angular you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Invoke the `angular-developer` skill and read the relevant guide before writing any code. Heed deprecation notices.

<!-- END:angular-agent-rules -->

# SpecSync web app (Angular 22)

Angular 22 application built with Nx, NgRx Signal Store and the Zard/shadcn
design-system library in `libs/ui`. Paths below are relative to the workspace
root.

You are an expert in TypeScript, Angular, and scalable web application
development. You write functional, maintainable, performant, and accessible
code following Angular and TypeScript best practices.

## Architecture (red lines)

The binding rules live in the docs; this section only names the red lines.

- Read `apps/web/docs/architecture-boundaries.md` before changing code under
  `apps/web` or `libs/ui`. Read `apps/web/docs/architecture-state-management.md`
  when the change touches stores, coordinators, or data access. The reasoning
  behind the rules is recorded in `apps/web/docs/adr/`.
- Domains live in `apps/web/src/app/domains/<domain>/<layer>`; layers are
  `feature → ui → data → util`, with acyclic composition through feature entry
  points. Cross-domain access uses typed public APIs under the same rules for
  every domain; new domain names require no Sheriff edits. UI is strictly dumb,
  including feature-local UI: no stores, coordinators, clients, or chat actions.
- Components never call a data access client (`-client.ts`). Data flows
  client → store (`-store.ts`) → smart component (`-page`, `-search`,
  `-edit`, `-detail`, `-overview`). Stores never depend on other stores; use
  a `-coordinator.ts`.
- Do not create a new domain, move code to `shared`, or change
  `apps/web/sheriff.config.ts`, `apps/web/arch/`, or the Nx `depConstraints`
  without an explicit request in the current conversation.
- Model new features after `ChatPage`, `ConversationDetailStore`,
  `ThreadSearchStore`, `ChatCoordinator` and `ThreadClient` under
  `apps/web/src/app/domains/chat`.
- Add design-system components with the Zard CLI; never hand-edit
  `libs/ui` to add application logic.
- The theme lives in `libs/ui/styles.css`: Ford blue for primary actions
  and focus only, neutral gray surfaces, hover fills and borders, and a
  `--radius` of 0.75rem (controls `rounded-lg` 12px, menu items and small
  controls `rounded-md` 10px, panels `rounded-xl` 16px, pills
  `rounded-full`). Its header records the ChatGPT measurements the values
  follow; keep new surfaces on the tokens instead of ad-hoc colours or radii.

## Checks

- Lint (Sheriff + Nx boundaries): `npm exec -- nx run-many -t lint -p web,ui`
- Architecture tests (tsarch): `npm exec -- nx run web:test-arch`
- Everything incl. unit tests and build: `npm run verify`
- The checks are declared in `apps/web/checks.mjs`. The agent Stop hooks and
  the pre-commit hook run the fast ones whenever files under `apps/web` or
  `libs/ui` changed and feed failures back. Fix the code; never weaken a rule
  to make a check pass.
- Use the `web-architecture-review` skill for reviews and `web-verify-and-fix`
  before declaring work merge-ready.

## TypeScript Best Practices

- Use strict type checking.
- Prefer type inference when the type is obvious.
- Avoid the `any` type; use `unknown` when type is uncertain.

## Angular Best Practices

- Always use standalone components over NgModules.
- Must NOT set `standalone: true` inside Angular decorators. It's the default
  in Angular v20+.
- Use signals for state management.
- Implement lazy loading for feature routes (`loadComponent` /
  `loadChildren`).
- Do NOT use the `@HostBinding` and `@HostListener` decorators. Put host
  bindings inside the `host` object of the `@Component` or `@Directive`
  decorator instead.
- Use `NgOptimizedImage` for all static images.
  - `NgOptimizedImage` does not work for inline base64 images.

## Accessibility Requirements

- It MUST pass all AXE checks.
- It MUST follow all WCAG AA minimums, including focus management, color
  contrast, and ARIA attributes.

### Components

- Keep components small and focused on a single responsibility.
- Use `input()` and `output()` functions instead of decorators.
- Use `computed()` for derived state.
- Set `changeDetection: ChangeDetectionStrategy.OnPush` in `@Component`
  decorator.
- Prefer inline templates for small components.
- Always use Signal Forms for building forms.
- Do NOT use `ngClass`, use `class` bindings instead.
- Do NOT use `ngStyle`, use `style` bindings instead.
- When using external templates/styles, use paths relative to the component
  TS file.
- Style with Tailwind utility classes and the Zard components from
  `@/ui/components/*`.

## State Management

- Use signals for local component state.
- Use `computed()` for derived state.
- Keep state transformations pure and predictable.
- Do NOT use `mutate` on signals, use `update` or `set` instead.
- Feature state lives in NgRx Signal Stores built with `withResource`,
  `withMutations` and `withDevtools` (see
  `apps/web/docs/architecture-state-management.md`).

## Templates

- Keep templates simple and avoid complex logic.
- Use native control flow (`@if`, `@for`, `@switch`) instead of `*ngIf`,
  `*ngFor`, `*ngSwitch`.
- Use the async pipe to handle observables.
- Do not assume globals like (`new Date()`) are available.

## Services

- Design services around a single responsibility.
- Use the `providedIn: 'root'` option for singleton services.
- Use the `inject()` function instead of constructor injection.

## Agent configuration

- Skills for this app live in `apps/web/.agents/skills/` (`angular-developer`,
  `web-architecture-review`, `web-verify-and-fix`); the Angular CLI MCP server in
  `apps/web/.agents/mcp.json`. `npm run sync:agent-config` generates
  `apps/web/.claude/skills/` and `apps/web/.mcp.json` from them; do not edit
  those copies.
- Start Claude from this directory (`cd apps/web && claude`) to have these
  skills, the Angular CLI MCP server and this file loaded at launch; from the workspace root they load
  once Claude touches files under `apps/web`.
