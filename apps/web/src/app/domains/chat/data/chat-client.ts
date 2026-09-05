import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { ServerSentEventParser } from '../util/server-sent-events';
import { ChatMessage } from './chat-message';
import { ChatRequestError } from './chat-request-error';

/**
 * Shape of the Mastra stream events this client cares about. Every event is a
 * JSON object with a `type`; text arrives as `text-delta` chunks and failures
 * as an `error` chunk (the server still answers 200 in that case).
 */
const STREAM_DONE = '[DONE]';

interface StreamChunk {
  type: string;
  payload?: {
    text?: string;
    error?: string | { message?: string };
  };
}

/**
 * Data access for the Mastra AI service, reached through the `/ai` proxy of
 * the web server (nginx in the cloud, `proxy.conf.json` with `nx serve web`).
 * Stateless: it only turns a conversation into a stream of text deltas. The
 * store owns the messages.
 *
 * `fetch` is used instead of `HttpClient` because the reply is a Server-Sent
 * Events stream that must be consumed incrementally.
 */
@Injectable({ providedIn: 'root' })
export class ChatClient {
  private readonly streamUrl = '/ai/api/agents/chat/stream';

  /**
   * Sends the whole conversation and emits the assistant's reply as text
   * deltas. Unsubscribing aborts the request.
   */
  streamReply(messages: ChatMessage[]): Observable<string> {
    return new Observable<string>((subscriber) => {
      const controller = new AbortController();

      this.readStream(messages, controller.signal, (delta) =>
        subscriber.next(delta),
      ).then(
        () => subscriber.complete(),
        (error: unknown) => {
          if (!controller.signal.aborted) {
            subscriber.error(error);
          }
        },
      );

      return () => controller.abort();
    });
  }

  private async readStream(
    messages: ChatMessage[],
    signal: AbortSignal,
    onDelta: (delta: string) => void,
  ): Promise<void> {
    const response = await fetch(this.streamUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'text/event-stream',
      },
      body: JSON.stringify({ messages }),
      signal,
    });

    if (!response.ok || !response.body) {
      throw new ChatRequestError(response.status);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const parser = new ServerSentEventParser();

    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        return;
      }
      for (const event of parser.push(
        decoder.decode(value, { stream: true }),
      )) {
        // The server closes the stream with a literal `[DONE]` event.
        if (event === STREAM_DONE) {
          return;
        }
        const chunk = JSON.parse(event) as StreamChunk;
        if (chunk.type === 'text-delta' && chunk.payload?.text) {
          onDelta(chunk.payload.text);
        } else if (chunk.type === 'error') {
          throw new Error(toErrorMessage(chunk.payload?.error));
        }
      }
    }
  }
}

function toErrorMessage(error: string | { message?: string } | undefined) {
  if (typeof error === 'string') {
    return error;
  }
  return error?.message ?? 'The AI service reported an error';
}
