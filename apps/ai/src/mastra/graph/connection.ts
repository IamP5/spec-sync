import neo4j, { type Driver } from 'neo4j-driver';

export type GraphItem = Record<string, unknown>;
export type GraphQuery = (
  cypher: string,
  params?: Record<string, unknown>,
) => Promise<GraphItem[]>;

let driver: Driver | undefined;

function getDriver(): Driver {
  if (driver) return driver;
  const uri = process.env['NEO4J_URI'];
  const username = process.env['NEO4J_USERNAME'];
  const password = process.env['NEO4J_PASSWORD'];
  if (!uri || !username || !password)
    throw new Error('Graph is not configured');
  if (process.env['NODE_ENV'] === 'production' && !uri.startsWith('neo4j+s://'))
    throw new Error('Production graph requires verified TLS');
  driver = neo4j.driver(uri, neo4j.auth.basic(username, password), {
    connectionTimeout: 3000,
    connectionAcquisitionTimeout: 5000,
    maxConnectionPoolSize: 10,
    maxTransactionRetryTime: 0,
    disableLosslessIntegers: true,
  });
  return driver;
}

export async function closeGraph(): Promise<void> {
  const current = driver;
  driver = undefined;
  await current?.close();
}

// Mastra owns signal handling and process exit; release our pool during its shutdown.
process.once('SIGTERM', () => {
  void closeGraph().catch(() => undefined);
});
process.once('SIGINT', () => {
  void closeGraph().catch(() => undefined);
});

/** One bounded read transaction per tool call; the pool is shared across requests. */
export async function withGraphRead<T>(
  operation: (query: GraphQuery) => Promise<T>,
  signal?: AbortSignal,
): Promise<T> {
  const deadline = AbortSignal.timeout(15000);
  const cancellation = signal ? AbortSignal.any([signal, deadline]) : deadline;
  cancellation.throwIfAborted();
  const session = getDriver().session({
    database: process.env['NEO4J_DATABASE'] ?? 'neo4j',
    defaultAccessMode: neo4j.session.READ,
  });
  const tx = session.beginTransaction({ timeout: 8000 });
  let onAbort: () => void = () => undefined;
  const aborted = new Promise<never>((_resolve, reject) => {
    onAbort = () => {
      reject(cancellation.reason);
      void tx.rollback().catch(() => undefined);
    };
    cancellation.addEventListener('abort', onAbort, { once: true });
    if (cancellation.aborted) onAbort();
  });
  try {
    const query: GraphQuery = async (cypher, params = {}) => {
      cancellation.throwIfAborted();
      // Bolt encodes JS numbers as floats. Cypher LIMIT and year filters need integers.
      const parameters = { ...params };
      for (const key of ['limit', 'candidateLimit', 'year']) {
        const value = parameters[key];
        if (typeof value === 'number') parameters[key] = neo4j.int(value);
      }
      const result = await tx.run(cypher, parameters);
      cancellation.throwIfAborted();
      return result.records.map((record) => record.get('item') as GraphItem);
    };
    return await Promise.race([operation(query), aborted]);
  } finally {
    cancellation.removeEventListener('abort', onAbort);
    // No writes are performed; rollback also releases an interrupted read transaction.
    try {
      await tx.rollback();
    } finally {
      await session.close();
    }
  }
}
