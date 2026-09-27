import { gatewayJson } from '../../auth/api/session';
import {
  CHAT_MODELS_URL,
  type ChatModelCatalog,
  chatModelCatalogSchema,
  localizeCatalog,
} from './chat-model';

/** The modes and reasoning efforts the AI service offers right now. */
export function fetchChatModels(
  signal?: AbortSignal,
): Promise<ChatModelCatalog> {
  return gatewayJson(
    CHAT_MODELS_URL,
    (value) => localizeCatalog(chatModelCatalogSchema.parse(value)),
    { signal },
  );
}
