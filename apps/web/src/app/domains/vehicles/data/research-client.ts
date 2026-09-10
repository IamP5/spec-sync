import {
  HttpClient,
  httpResource,
  type HttpResourceRef,
} from '@angular/common/http';
import {
  DestroyRef,
  effect,
  inject,
  Injectable,
  type Signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';

import { SESSION, type SessionScope } from '../../auth/api/session';
import type { IngestionRequest } from './ingestion-contracts';
import {
  parseResearchList,
  RESEARCH_URL,
  type ResearchInterestInput,
  researchPeopleSchema,
  researchSnapshotSchema,
} from './research-contracts';

@Injectable({
  providedIn: 'root',
})
export class ResearchClient {
  private readonly http = inject(HttpClient);
  private readonly session = inject(SESSION);

  detailResource(id: Signal<string>, owner: Signal<SessionScope | null>) {
    return this.scopedResource(
      httpResource(
        () => {
          const scope = owner();
          return id() && scope && this.session.isCurrent(scope)
            ? { url: `${RESEARCH_URL}/${encodeURIComponent(id())}` }
            : undefined;
        },
        { parse: (value) => researchSnapshotSchema.parse(value) },
      ),
    );
  }

  peopleResource(id: Signal<string>, owner: Signal<SessionScope | null>) {
    const resource = this.scopedResource(
      httpResource(
        () => {
          const scope = owner();
          return id() && scope && this.session.isCurrent(scope)
            ? { url: `${RESEARCH_URL}/${encodeURIComponent(id())}/interests` }
            : undefined;
        },
        { parse: (value) => researchPeopleSchema.parse(value) },
      ),
    );
    effect(() => {
      // An idle resource can still have an HTTP stream in flight: explicitly abort on drawer close.
      if (!id()) resource.value.set(undefined);
    });
    return resource;
  }
  saveInterest(id: string, input: ResearchInterestInput) {
    return this.http
      .post<unknown>(
        `${RESEARCH_URL}/${encodeURIComponent(id)}/interests`,
        input,
      )
      .pipe(map((value) => researchPeopleSchema.parse(value)));
  }

  listResource() {
    return this.scopedResource(
      httpResource(
        () => (this.session.scope() ? { url: RESEARCH_URL } : undefined),
        { parse: parseResearchList },
      ),
    );
  }

  create(id: string, request: IngestionRequest) {
    return this.http
      .post<unknown>(RESEARCH_URL, { id, request })
      .pipe(map((value) => researchSnapshotSchema.parse(value)));
  }

  cancel(id: string) {
    return this.http
      .delete<unknown>(`${RESEARCH_URL}/${encodeURIComponent(id)}`)
      .pipe(map((value) => researchSnapshotSchema.parse(value)));
  }

  replay(id: string, newRequestId: string) {
    return this.http
      .post<unknown>(`${RESEARCH_URL}/${encodeURIComponent(id)}/replay`, {
        id: newRequestId,
      })
      .pipe(map((value) => researchSnapshotSchema.parse(value)));
  }

  private scopedResource<T>(resource: HttpResourceRef<T | undefined>) {
    this.session.invalidated$
      .pipe(takeUntilDestroyed(inject(DestroyRef)))
      .subscribe(() => {
        // A direct write also aborts a pending request whose value is undefined.
        resource.value.set(undefined);
      });
    return resource;
  }
}
