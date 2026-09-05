import { vi } from 'vitest';

/** One Mastra stream event, serialised as the server would. */
export function sseEvent(chunk: object): string {
  return `data: ${JSON.stringify(chunk)}\n\n`;
}

/** Text deltas as the `chat` agent streams them. */
export function textDeltas(...texts: string[]): string {
  return texts
    .map((text) => sseEvent({ type: 'text-delta', payload: { text } }))
    .join('');
}

/**
 * Stubs `fetch` with a Server-Sent Events response whose body is `events`,
 * delivered in the given `chunks` (defaults to one chunk). Returns the spy so
 * tests can inspect the request.
 */
export function stubAiStream(
  events: string,
  {
    status = 200,
    chunks = [events],
  }: { status?: number; chunks?: string[] } = {},
) {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(status >= 200 && status < 300 ? body : null, {
      status,
      headers: { 'content-type': 'text/event-stream' },
    }),
  );
}
