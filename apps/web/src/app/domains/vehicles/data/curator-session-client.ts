import { computed, Injectable, signal } from '@angular/core';

/**
 * Holds the curator key for this page load only. It never touches storage:
 * a reload or a new tab forgets it, and it is sent only as a request header
 * to the API. The chat and the ingestion page share it so a curator enters
 * it once per session.
 */
@Injectable({ providedIn: 'root' })
export class CuratorSessionClient {
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
