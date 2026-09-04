import process from 'node:process';

// Reads the JSON payload that agent hooks receive on stdin. Returns `{}` when
// stdin is empty or not valid JSON so callers never have to guard.
export async function readInput() {
  const chunks = [];
  for await (const c of process.stdin) {
    chunks.push(c);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString() || '{}');
  } catch {
    return {};
  }
}
