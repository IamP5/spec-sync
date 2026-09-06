import neo4j from 'neo4j-driver';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { closeGraph, withGraphRead } from './connection';

const fake = vi.hoisted(() => ({
  run: vi.fn(),
  rollback: vi.fn(),
  beginTransaction: vi.fn(),
  closeSession: vi.fn(),
  session: vi.fn(),
  closeDriver: vi.fn(),
  driver: vi.fn(),
}));
vi.mock('neo4j-driver', async (importOriginal) => {
  const original = await importOriginal<typeof import('neo4j-driver')>();
  return { ...original, default: { ...original.default, driver: fake.driver } };
});
beforeEach(() => {
  vi.stubEnv('NEO4J_URI', 'neo4j+s://example.databases.neo4j.io');
  vi.stubEnv('NEO4J_USERNAME', 'neo4j');
  vi.stubEnv('NEO4J_PASSWORD', 'test');
  vi.stubEnv('NEO4J_DATABASE', 'neo4j');
  fake.rollback.mockResolvedValue(undefined);
  fake.closeSession.mockResolvedValue(undefined);
  fake.closeDriver.mockResolvedValue(undefined);
  fake.run.mockResolvedValue({ records: [{ get: () => ({ count: 1 }) }] });
  fake.beginTransaction.mockReturnValue({
    run: fake.run,
    rollback: fake.rollback,
  });
  fake.session.mockReturnValue({
    beginTransaction: fake.beginTransaction,
    close: fake.closeSession,
  });
  fake.driver.mockReturnValue({
    session: fake.session,
    close: fake.closeDriver,
  });
});
afterEach(async () => {
  await closeGraph();
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});
it('reuses the pool, opens read sessions and encodes integer parameters correctly', async () => {
  await withGraphRead((query) =>
    query('RETURN $limit AS item', { limit: 3, embedding: [0.5] }),
  );
  await withGraphRead((query) => query('RETURN 1 AS item'));
  expect(fake.driver).toHaveBeenCalledOnce();
  expect(fake.session).toHaveBeenCalledWith({
    database: 'neo4j',
    defaultAccessMode: neo4j.session.READ,
  });
  expect(fake.run.mock.calls[0]?.[1]).toEqual({
    limit: neo4j.int(3),
    embedding: [0.5],
  });
  expect(fake.beginTransaction).toHaveBeenCalledWith({ timeout: 8000 });
  expect(fake.closeSession).toHaveBeenCalledTimes(2);
});
it('cleans up the session on a failed query', async () => {
  fake.run.mockRejectedValueOnce(new Error('Service unavailable'));
  await expect(
    withGraphRead((query) => query('RETURN 1 AS item')),
  ).rejects.toThrow('Service unavailable');
  expect(fake.rollback).toHaveBeenCalled();
  expect(fake.closeSession).toHaveBeenCalledOnce();
});
it('rolls back an in-flight query when the caller cancels', async () => {
  fake.run.mockImplementationOnce(() => new Promise(() => undefined));
  const controller = new AbortController();
  const pending = withGraphRead(
    (query) => query('RETURN 1 AS item'),
    controller.signal,
  );
  controller.abort(new Error('Cancelled'));
  await expect(pending).rejects.toThrow('Cancelled');
  expect(fake.rollback).toHaveBeenCalled();
  expect(fake.closeSession).toHaveBeenCalledOnce();
});
it('rejects insecure production URIs before opening a connection', async () => {
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('NEO4J_URI', 'bolt://example.com');
  await expect(withGraphRead(async () => [])).rejects.toThrow('verified TLS');
  expect(fake.driver).not.toHaveBeenCalled();
});
