import { spawn } from 'node:child_process';
import driver from 'neo4j-driver';

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
  const address = await compose(['port', 'neo4j', '7687']);
  if (!/^127\.0\.0\.1:\d+$/.test(address))
    throw new Error('Expected a loopback-only Neo4j Compose port');
  // Maintenance targets intentionally ignore Aura credentials; they only mutate local fixtures.
  const connection = driver.driver(
    `bolt://${address}`,
    driver.auth.basic('neo4j', 'specsync-local'),
    {
      disableLosslessIntegers: true,
      maxTransactionRetryTime: 0,
    },
  );
  const session = connection.session({ database: 'neo4j' });
  const parameters = (value) => {
    if (typeof value === 'number' && Number.isInteger(value))
      return driver.int(value);
    if (Array.isArray(value)) return value.map(parameters);
    if (value && typeof value === 'object')
      return Object.fromEntries(
        Object.entries(value).map(([k, v]) => [k, parameters(v)]),
      );
    return value;
  };
  try {
    return await session.executeWrite(
      async (tx) => {
        const results = [];
        for (const { statement, parameters: params = {} } of statements) {
          const result = await tx.run(statement, parameters(params));
          results.push({
            data: result.records.map((record) => ({
              row: record.keys.map((key) => record.get(key)),
            })),
          });
        }
        return results;
      },
      { timeout: 60000 },
    );
  } catch (error) {
    throw new Error(`${error.code ?? 'Neo4jError'}: ${error.message}`, {
      cause: error,
    });
  } finally {
    await session.close();
    await connection.close();
  }
}
