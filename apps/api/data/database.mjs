import { spawn } from 'node:child_process';

import { workspaceRoot } from './foundation.mjs';

export function compose(args, { input, inherit = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'docker',
      ['compose', '-f', `${workspaceRoot}/compose.yaml`, ...args],
      {
        cwd: workspaceRoot,
        stdio: inherit ? 'inherit' : ['pipe', 'pipe', 'pipe'],
      },
    );
    let output = '';
    let errors = '';
    child.on('error', reject);
    if (!inherit) {
      child.stdout.setEncoding('utf8').on('data', (chunk) => {
        output += chunk;
      });
      child.stderr.setEncoding('utf8').on('data', (chunk) => {
        errors += chunk;
      });
      child.stdin.on('error', (error) => {
        if (error.code !== 'EPIPE') reject(error);
      });
      child.stdin.end(input);
    }
    child.on('close', (code) => {
      if (code !== 0)
        reject(
          new Error(
            `docker compose ${args[0]} failed (${code}): ${errors.trim()}`,
          ),
        );
      else resolve(output.trim());
    });
  });
}

// These tools intentionally target this workspace's local Compose services only.
// SQL and JSON travel on stdin or in request bodies, never through a shell command.
export function postgres(sql) {
  return compose(
    [
      'exec',
      '-T',
      'postgres',
      'psql',
      '-X',
      '-qAt',
      '-v',
      'ON_ERROR_STOP=1',
      '-U',
      'myuser',
      '-d',
      'mydatabase',
    ],
    { input: sql },
  );
}

export async function neo4j(statements) {
  const address = await compose(['port', 'neo4j', '7474']);
  if (!/^127\.0\.0\.1:\d+$/.test(address))
    throw new Error('Expected a loopback-only Neo4j Compose port');
  const response = await fetch(`http://${address}/db/neo4j/tx/commit`, {
    method: 'POST',
    redirect: 'error',
    signal: AbortSignal.timeout(60000),
    headers: {
      authorization: `Basic ${Buffer.from('neo4j:specsync-local').toString('base64')}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ statements }),
  });
  if (!response.ok) throw new Error(`Neo4j HTTP ${response.status}`);
  const result = await response.json();
  // Neo4j can return HTTP 200 for a transaction that was rolled back.
  if (result.errors?.length)
    throw new Error(
      result.errors.map((e) => `${e.code}: ${e.message}`).join('\n'),
    );
  return result.results;
}
