import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import process from 'node:process';

// Mirrors the tool-neutral agent configuration into the locations each tool
// expects. Sources are the single source of truth; every generated copy gets a
// DO_NOT_EDIT marker.
//
// Sources, per directory that owns agent configuration (workspace root and
// every app under `apps/*`):
//   <dir>/.agents/skills/*   -> <dir>/.claude/skills/*  (per-directory skills,
//                               see https://code.claude.com/docs/en/large-codebases:
//                               an app's skills load when Claude works in that
//                               app, or at launch when started from it)
//   <dir>/.agents/mcp.json   -> <dir>/.mcp.json and <dir>/.cursor/mcp.json
//                               (Claude Code reads the .mcp.json of the
//                               directory it is started from, so an app's
//                               MCP servers load with `cd apps/web && claude`)
//
// Runs on `npm install` (prepare) and from the pre-commit hook whenever a
// source changed. `--targets` prints the generated paths (used by the
// pre-commit hook to stage them).

const owners = ['.', ...appDirs()].filter((dir) =>
  existsSync(join(dir, '.agents')),
);

const skillsWarning = (source) => `DO NOT EDIT THIS DIRECTORY.

These files are a generated copy produced by \`npm run sync:agent-config\`
from \`${source}\`. Any change here is overwritten on the next sync.
Edit the source under \`${source}\` instead.
`;

const mcpWarning = (target, source) => `DO NOT EDIT \`${target}\`.

It is a generated copy produced by \`npm run sync:agent-config\`
from \`${source}\`. Any change here is overwritten on the next sync.
Edit \`${source}\` instead.
`;

const targets = [];

for (const dir of owners) {
  const skillsSource = join(dir, '.agents', 'skills');
  if (existsSync(skillsSource)) {
    const skillsTarget = join(dir, '.claude', 'skills');
    rmSync(skillsTarget, { recursive: true, force: true });
    cpSync(skillsSource, skillsTarget, { recursive: true });
    writeFileSync(
      join(skillsTarget, 'DO_NOT_EDIT.txt'),
      skillsWarning(normalize(skillsSource)),
    );
    targets.push(normalize(skillsTarget));
  }

  const mcpSource = join(dir, '.agents', 'mcp.json');
  if (existsSync(mcpSource)) {
    const mcpJson =
      JSON.stringify(JSON.parse(readFileSync(mcpSource, 'utf8')), null, 2) +
      '\n';
    for (const [target, marker] of [
      [join(dir, '.mcp.json'), join(dir, '.mcp.DO_NOT_EDIT.txt')],
      [
        join(dir, '.cursor', 'mcp.json'),
        join(dir, '.cursor', 'mcp.DO_NOT_EDIT.txt'),
      ],
    ]) {
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, mcpJson);
      writeFileSync(
        marker,
        mcpWarning(normalize(target), normalize(mcpSource)),
      );
      targets.push(normalize(target), normalize(marker));
    }
  }
}

if (process.argv.includes('--targets')) {
  process.stdout.write(targets.join('\n') + '\n');
} else {
  console.log(`[sync] agent config updated: ${targets.join(', ')}`);
}

function appDirs() {
  if (!existsSync('apps')) {
    return [];
  }
  return readdirSync('apps', { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join('apps', entry.name));
}

function normalize(path) {
  return path.replace(/^\.\//, '').replaceAll('\\', '/');
}
