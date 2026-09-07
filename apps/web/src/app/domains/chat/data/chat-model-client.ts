import { httpResource } from '@angular/common/http';
import { Injectable } from '@angular/core';

import { CHAT_MODELS_URL, chatModelCatalogSchema } from './chat-model';

/** Model catalog reads use Angular HTTP so gateway authentication and cancellation apply. */
@Injectable({ providedIn: 'root' })
export class ChatModelClient {
  catalogResource() {
    return httpResource(() => CHAT_MODELS_URL, {
      parse: chatModelCatalogSchema.parse,
    });
  }
}
