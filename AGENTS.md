<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

# General Guidelines for working with Nx

- For navigating/exploring the workspace, invoke the `nx-workspace` skill first - it has patterns for querying projects, targets, and dependencies
- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- Prefix nx commands with the workspace's package manager (e.g., `pnpm nx build`, `npm exec nx test`) - avoids using globally installed CLI
- You have access to the Nx MCP server and its tools, use them to help the user
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md`. Not all plugins have this file - proceed without it if unavailable.
- NEVER guess CLI flags - always check nx_docs or `--help` first when unsure

## Scaffolding & Generators

- For scaffolding tasks (creating apps, libs, project structure, setup), ALWAYS invoke the `nx-generate` skill FIRST before exploring or calling MCP tools

## When to use nx_docs

- USE for: advanced config options, unfamiliar flags, migration guides, plugin configuration, edge cases
- DON'T USE for: basic generator syntax (`nx g @nx/react:app`), standard commands, things you already know
- The `nx-generate` skill handles generator discovery internally - don't call nx_docs just to look up generator syntax

<!-- nx configuration end-->

# SpecSync

Nx monorepo:

| Project   | Path       | Stack                                | Agent guide          |
| --------- | ---------- | ------------------------------------ | -------------------- |
| `web`     | `apps/web` | Angular 22, NgRx Signal Store        | `apps/web/AGENTS.md` |
| `api`     | `apps/api` | Spring Boot (Java 25, Gradle)        | _(planned)_          |
| `ui`      | `libs/ui`  | Zard/shadcn design system (Tailwind) | `apps/web/AGENTS.md` |
| `infra`   | `infra`    | Terraform (Google Cloud)             | –                    |
| `scripts` | `scripts`  | Node tooling for hooks and checks    | this file            |

Each app owns its own rules, docs, skills and checks. Before changing code
under an app, read that app's `AGENTS.md` and the docs it points to. Rules
in this file are workspace-wide only.

## Working in `apps/web` or `libs/ui`

- Read `apps/web/AGENTS.md` first. It names the architecture red lines and
  points to the binding docs under `apps/web/docs/`.
- Sheriff (`apps/web/sheriff.config.ts`, re-exported by the root stub
  `sheriff.config.ts` because Sheriff only reads the workspace root) and
  tsarch (`apps/web/arch/`) enforce those rules on every lint / test-arch run.

## Checks and hooks

- Every app declares its checks next to its code (`apps/web/checks.mjs`) and
  registers them in `scripts/checks/projects.mjs` with the path prefixes it
  owns.
- The agent Stop hooks (`.claude/settings.json` for Claude Code,
  `.cursor/hooks.json` for Cursor) and the husky pre-commit hook run only the
  fast checks of the projects whose files changed (uncommitted files for the
  Stop hooks, staged files for pre-commit). A change to a workspace-level
  file (`package.json`, `nx.json`, `eslint.config.mjs`, ...) runs every
  project's checks. Touching only `infra/` runs nothing.
- `npm run verify` runs the full checks (incl. unit tests and build) of every
  registered project; `npm run verify -- --changed` restricts it to the
  projects with uncommitted changes.
- When a hook reports a failure, fix the code. Never weaken a lint rule, a
  Sheriff or tsarch rule, or an Nx boundary to make a check pass.
- Commits follow Conventional Commits (commitlint runs on `commit-msg`).

## Comments

- Write all code comments and inline documentation in English, regardless of
  the conversation language.

## Agent configuration

- `.agents/` directories are the single source of truth for agent config:
  the workspace root owns the Nx skills and the `nx-mcp` server
  (`.agents/skills/`, `.agents/mcp.json`); each app owns its own
  (`apps/web/.agents/skills/`, `apps/web/.agents/mcp.json`).
- `npm run sync:agent-config` generates, next to each `.agents/` (root and
  `apps/*`), the `.claude/skills/`, `.mcp.json` and `.cursor/mcp.json`
  copies. Never edit the generated copies; they carry DO_NOT_EDIT markers.
- Per-app skills follow the Claude Code monorepo guide
  (https://code.claude.com/docs/en/large-codebases): an app's skills and
  `CLAUDE.md` load when Claude works on files of that app, or at launch when
  Claude is started from the app directory (`cd apps/web && claude`).
- Cursor rules live in `.cursor/rules/` (workspace) and `apps/*/.cursor/rules/`
  (per app, attached when files of that app are referenced).
