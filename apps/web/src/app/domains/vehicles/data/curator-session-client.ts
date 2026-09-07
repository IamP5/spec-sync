import { computed, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Events } from '@ngrx/signals/events';

import { sessionEvents } from '../../auth/api/events';

/**
 * Holds the curator key for this page load only. It never touches storage:
 * a reload or a new tab forgets it, and it is sent only as a request header
 * to the API. The chat and the ingestion page share it so a curator enters
 * it once per session.
 */
@Injectable({ providedIn: 'root' })
export class CuratorSessionClient {
  constructor() {
    inject(Events)
      .on(sessionEvents.invalidated)
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.clear());
  }

  private readonly _key = signal('');
  readonly key = this._key.asReadonly();
  readonly hasKey = computed(() => this._key().length > 0);

  set(key: string): void {
    this._key.set(key.trim());
  }

  clear(): void {
    this._key.set('');
  }
}
