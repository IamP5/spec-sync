import { httpResource } from '@angular/common/http';
import { Injectable, Signal } from '@angular/core';

import { Greeting } from './greeting';

/**
 * Data access for the greeting API. Stateless: it only builds resources and
 * requests. Stores own the state (see apps/web/docs/architecture-boundaries.md,
 * "Data Access Services").
 */
@Injectable({ providedIn: 'root' })
export class GreetingClient {
  private readonly baseUrl = '/api/greeting';

  /**
   * Resource that loads a greeting for `name`. While `name` is empty no
   * request is sent and the resource stays idle.
   */
  greetingResource(name: Signal<string>) {
    return httpResource<Greeting>(() => {
      const value = name();
      return value ? { url: this.baseUrl, params: { name: value } } : undefined;
    });
  }
}
