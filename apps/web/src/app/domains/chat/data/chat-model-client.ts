import { Injectable, resource } from '@angular/core';

import {
  CHAT_MODELS_URL,
  type ChatModelCatalog,
  chatModelCatalogSchema,
} from './chat-model';

/**
 * Data access for the model catalog of the AI service: which models the chat
 * can run on and which one is the default. Read once per session; the store
 * exposes the resource and can reload it after a failure.
 */
@Injectable({ providedIn: 'root' })
export class ChatModelClient {
  catalogResource() {
    return resource({
      loader: ({ abortSignal }) => loadCatalog(abortSignal),
    });
  }
}

async function loadCatalog(
  abortSignal: AbortSignal,
): Promise<ChatModelCatalog> {
  const response = await fetch(CHAT_MODELS_URL, {
    signal: abortSignal,
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error('Chat model catalog request failed');
  return chatModelCatalogSchema.parse(await response.json());
}
