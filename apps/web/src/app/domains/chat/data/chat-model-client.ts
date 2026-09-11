import { httpResource } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';

import { SESSION } from '../../auth/api/session';
import {
  CHAT_MODELS_URL,
  chatModelCatalogSchema,
  localizeCatalog,
} from './chat-model';

/** Model catalog reads use Angular HTTP so gateway authentication and cancellation apply. */
@Injectable({ providedIn: 'root' })
export class ChatModelClient {
  private readonly session = inject(SESSION);
  catalogResource() {
    return httpResource(
      () => (this.session.scope() ? { url: CHAT_MODELS_URL } : undefined),
      {
        // The service names modes, roles and efforts in the source language;
        // the browser owns the user's, so the catalog arrives translated.
        parse: (value: unknown) =>
          localizeCatalog(chatModelCatalogSchema.parse(value)),
      },
    );
  }
}
