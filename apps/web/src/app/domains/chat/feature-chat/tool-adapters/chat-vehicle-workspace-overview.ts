import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
} from '@angular/core';
import { AngularToolCall, ToolRenderer } from '@copilotkit/angular';

import type { VehicleConfiguration } from '../../../vehicles/api/contracts';
import {
  type VehicleWorkspace,
  vehicleWorkspaceSchema,
  type VehicleWorkspaceTile,
  vehicleWorkspaceTiles,
} from '../../data/vehicle-workspace-contracts';
import { parseResult } from '../../util/parse-result';
import { KnowledgeResultCard } from '../ui/knowledge-result-card';
import { CHAT_CARD_ACTIONS } from './chat-card-actions';
import { ChatVehicleCatalogOverview } from './chat-vehicle-catalog-overview';
import { ChatVehicleComparisonOverview } from './chat-vehicle-comparison-overview';

@Component({
  selector: 'app-chat-vehicle-workspace-overview',
  imports: [
    ChatVehicleCatalogOverview,
    ChatVehicleComparisonOverview,
    KnowledgeResultCard,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block w-full min-w-0' },
  template: `
    @if (workspace(); as current) {
      <section
        class="space-y-4 rounded-xl border bg-card p-4 sm:p-5"
        [attr.aria-label]="current.title"
      >
        <header class="space-y-1">
          <p
            class="text-xs font-medium uppercase tracking-wide text-muted-foreground"
          >
            Vehicle workspace
          </p>
          <h2 class="text-lg font-semibold tracking-tight">
            {{ current.title }}
          </h2>
          <p class="text-sm text-muted-foreground">
            Explore the catalog, inspect sources, and carry your selections into
            the conversation.
          </p>
        </header>
        @if (current.status !== 'OK') {
          <p class="rounded-lg bg-muted p-3 text-sm" role="status">
            {{
              current.status === 'PARTIAL'
                ? 'Some sections could not be loaded. The available results are ready to explore.'
                : 'This workspace could not retrieve its data. Try a narrower search or ask again.'
            }}
          </p>
        }
        @if (actions?.canSend && !actions.canSend()) {
          <p class="text-sm text-muted-foreground" role="status">
            You can explore these results now. Sending a follow-up will be
            available when the conversation is ready.
          </p>
        }
        <div class="grid min-w-0 grid-cols-1 gap-4">
          @for (tile of tiles(); track tile.id) {
            <section class="min-w-0 space-y-2" [attr.aria-label]="tile.title">
              <h3 class="text-sm font-semibold">{{ tile.title }}</h3>
              @switch (tile.type) {
                @case ('catalog') {
                  <app-chat-vehicle-catalog-overview
                    [toolCall]="tile.toolCall"
                    [shortlist]="shortlist()"
                    (shortlistChanged)="updateShortlist($event)"
                  />
                }
                @case ('comparison') {
                  <app-chat-vehicle-comparison-overview
                    [toolCall]="tile.toolCall"
                  />
                }
                @case ('specifications') {
                  <app-chat-vehicle-comparison-overview
                    [toolCall]="tile.toolCall"
                  />
                }
                @case ('reviews') {
                  <app-knowledge-result-card [toolCall]="tile.toolCall" />
                }
              }
            </section>
          }
        </div>
      </section>
    } @else if (toolCall().status !== 'complete') {
      <section
        class="space-y-3 rounded-xl border bg-card p-4"
        aria-label="Building vehicle workspace"
        aria-busy="true"
      >
        <p class="text-sm font-medium" role="status">
          Building your vehicle workspace…
        </p>
        <p class="text-sm text-muted-foreground">
          Gathering catalog data, specifications, and evidence for your request.
        </p>
        <div
          class="h-24 rounded-lg bg-muted motion-safe:animate-pulse"
          aria-hidden="true"
        ></div>
      </section>
    } @else {
      <section
        class="space-y-2 rounded-xl border bg-card p-4"
        aria-label="Vehicle workspace unavailable"
      >
        <p class="text-sm font-medium" role="status">
          This workspace could not be displayed.
        </p>
        <p class="text-sm text-muted-foreground">
          Ask again with the vehicles or specifications you want to explore.
        </p>
      </section>
    }
  `,
})
export class ChatVehicleWorkspaceOverview
  implements ToolRenderer<Record<string, unknown>>
{
  readonly toolCall =
    input.required<AngularToolCall<Record<string, unknown>>>();
  protected readonly actions = inject(CHAT_CARD_ACTIONS, { optional: true });

  // Transcript updates replace the envelope. Parse only changed result text to
  // preserve the local state of each catalog, comparison, and evidence card.
  private readonly resultText = computed(() => this.toolCall().result);
  protected readonly workspace = computed(() =>
    parseResult(this.resultText(), vehicleWorkspaceSchema),
  );
  protected readonly tiles = computed(() => {
    const current = this.workspace();
    if (!current) return [];
    const surfaceId = current.operations[0].createSurface.surfaceId;
    return vehicleWorkspaceTiles(current).map((tile, index) =>
      workspaceTileView(tile, index, surfaceId),
    );
  });
  private readonly catalogState = computed(() =>
    workspaceCatalogState(this.workspace()),
  );
  protected readonly shortlist = linkedSignal<
    ReturnType<typeof workspaceCatalogState>,
    VehicleConfiguration[]
  >({
    source: this.catalogState,
    computation: (current, previous) =>
      current.surfaceId === previous?.source.surfaceId
        ? (previous?.value ?? []).flatMap(
            ({ id }) => current.configurations.get(id) ?? [],
          )
        : [],
  });

  protected updateShortlist(vehicles: VehicleConfiguration[]): void {
    const available = this.catalogState().configurations;
    const ids = [...new Set(vehicles.map(({ id }) => id))].slice(0, 5);
    this.shortlist.set(ids.flatMap((id) => available.get(id) ?? []));
  }
}

function workspaceCatalogState(workspace: VehicleWorkspace | undefined) {
  const configurations = new Map<string, VehicleConfiguration>();
  if (workspace) {
    for (const tile of vehicleWorkspaceTiles(workspace)) {
      if (tile.type === 'catalog' && 'items' in tile.result) {
        for (const vehicle of tile.result.items)
          configurations.set(vehicle.id, vehicle);
      }
    }
  }
  return {
    surfaceId: workspace?.operations[0].createSurface.surfaceId,
    configurations,
  };
}

function workspaceTileView(
  tile: VehicleWorkspaceTile,
  index: number,
  surfaceId: string,
) {
  const names = {
    catalog: 'searchVehicleConfigurations',
    comparison: 'compareVehicleConfigurations',
    specifications: 'getVehicleSpecifications',
    reviews: 'searchReviewEvidence',
  };
  const toolCall: AngularToolCall<Record<string, unknown>> = {
    name: names[tile.type],
    args: tile.args,
    status: 'complete',
    result: JSON.stringify(tile.result),
  };
  return {
    id: `${surfaceId}:tile-${index}`,
    title: tile.title,
    type: tile.type,
    toolCall,
  };
}
