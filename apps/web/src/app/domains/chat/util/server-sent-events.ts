/**
 * Incremental parser for a `text/event-stream` body. Feed it decoded text in
 * any chunking; it yields the `data` payload of every complete event (multiple
 * `data:` lines are joined with a newline, as the SSE spec requires). Comments
 * and other fields are ignored.
 */
export class ServerSentEventParser {
  private buffer = '';

  /** Consumes the next piece of text and returns the events completed by it. */
  push(text: string): string[] {
    this.buffer += text.replace(/\r\n?/g, '\n');
    const events: string[] = [];

    let separator = this.buffer.indexOf('\n\n');
    while (separator !== -1) {
      const raw = this.buffer.slice(0, separator);
      this.buffer = this.buffer.slice(separator + 2);
      const data = toData(raw);
      if (data !== undefined) {
        events.push(data);
      }
      separator = this.buffer.indexOf('\n\n');
    }
    return events;
  }
}

function toData(rawEvent: string): string | undefined {
  const lines = rawEvent
    .split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).replace(/^ /, ''));
  return lines.length > 0 ? lines.join('\n') : undefined;
}
