import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';

import { ZardButtonComponent } from '@/ui/components/button';

import { ResearchSearchStore } from './research-search-store';
import { VehicleResearchDetail } from './vehicle-research-detail';

@Component({
  selector: 'app-vehicle-research-search',
  imports: [VehicleResearchDetail, ZardButtonComponent],
  providers: [ResearchSearchStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block min-w-0' },
  template: `
    @if (store.authenticated()) {
      <details
        class="rounded-xl border bg-background p-3 text-sm"
        (toggle)="onToggle($event)"
        data-research-history
      >
        <summary class="cursor-pointer font-medium" i18n>
          Your vehicle research
          @if (store.requests().length) {
            ({{ store.requests().length }})
          }
        </summary>
        @if (expanded()) {
          <div class="mt-3 max-h-[50vh] space-y-3 overflow-y-auto">
            <p class="text-xs text-muted-foreground" i18n>
              Research persists across chats and page refreshes. Open a request
              to follow its progress.
            </p>
            <button
              z-button
              zType="outline"
              zSize="sm"
              type="button"
              [zDisabled]="store.researchIsLoading()"
              (click)="store.reload()"
              i18n
            >
              Refresh requests
            </button>
            @if (store.researchError()) {
              <p role="alert" i18n>
                Could not load your research requests. Try refreshing.
              </p>
            } @else if (store.researchIsLoading()) {
              <p role="status" i18n>Loading research requests…</p>
            } @else if (!store.requests().length) {
              <p class="text-muted-foreground" i18n>
                No research requests yet. Ask SpecSync to research a vehicle's
                specifications.
              </p>
            }
            @for (request of store.requests(); track request.id) {
              <details
                class="rounded-lg border p-3"
                (toggle)="toggleRequest(request.id, $event)"
              >
                <summary class="cursor-pointer">
                  {{ request.request.brand }} {{ request.request.model }}
                  {{ request.request.modelYear }} ·
                  {{
                    request.requestStatus === 'CANCELLED'
                      ? notFollowing
                      : request.status
                  }}
                </summary>
                @if (openRequests().has(request.id)) {
                  <app-vehicle-research-detail
                    class="mt-3"
                    [requestId]="request.id"
                  />
                }
              </details>
            }
          </div>
        }
      </details>
    }
  `,
})
export class VehicleResearchSearch {
  protected readonly store = inject(ResearchSearchStore);
  protected readonly notFollowing = $localize`Not following`;
  protected readonly expanded = signal(false);
  protected readonly openRequests = signal<ReadonlySet<string>>(new Set());

  protected onToggle(event: Event): void {
    if (event.target !== event.currentTarget) return;
    const open = (event.target as HTMLDetailsElement).open;
    if (open === this.expanded()) return;
    this.expanded.set(open);
    if (open) this.store.reload();
    else this.openRequests.set(new Set());
  }
  protected toggleRequest(id: string, event: Event): void {
    if (event.target !== event.currentTarget) return;
    const open = (event.target as HTMLDetailsElement).open;
    this.openRequests.update((current) => {
      const next = new Set(current);
      if (open) next.add(id);
      else next.delete(id);
      return next;
    });
  }
}
