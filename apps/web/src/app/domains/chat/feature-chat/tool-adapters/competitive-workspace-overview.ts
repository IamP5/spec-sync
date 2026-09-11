import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  signal,
  viewChild,
} from '@angular/core';
import type { AngularToolCall, ToolRenderer } from '@copilotkit/angular';

import { ZardButtonComponent } from '@/ui/components/button';

import type {
  CatalogPage,
  Comparison,
  VehicleConfiguration,
  VehicleQuestion,
} from '../../../vehicles/api/contracts';
import {
  VehicleCatalogOverview,
  VehicleComparisonOverview,
  VehicleResearchDetail,
} from '../../../vehicles/api/features';
import type {
  AnalystContext,
  WorkspaceAction,
} from '../../data/competitive-workspace-actions';
import {
  competitiveRejectionSchema,
  type CompetitiveWorkspace,
  competitiveWorkspaceSchema,
  type EvidenceGaps,
  type ResolvedCompetitivePanel,
  sameWorkspaceJson,
  type TargetScenario,
} from '../../data/competitive-workspace-contracts';
import type { ReviewEvidenceResult } from '../../data/knowledge-contracts';
import { parseResult } from '../../util/parse-result';
import { EvidenceGapsPane } from '../ui/evidence-gaps-pane';
import { ReviewEvidencePane } from '../ui/review-evidence-pane';
import { AnalystBriefEdit } from './analyst-brief-edit';
import { CHAT_CARD_ACTIONS } from './chat-card-actions';
import { CHAT_WORKSPACE_SURFACES } from './chat-workspace-surfaces';
import { TargetScenarioEdit } from './target-scenario-edit';
import { catalogPagePrompt, vehicleQuestionPrompt } from './vehicle-prompts';

@Component({
  selector: 'app-competitive-workspace-overview',
  imports: [
    AnalystBriefEdit,
    TargetScenarioEdit,
    VehicleCatalogOverview,
    VehicleComparisonOverview,
    VehicleResearchDetail,
    EvidenceGapsPane,
    ReviewEvidencePane,
    ZardButtonComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block w-full min-w-0' },
  template: `
    @if (initial(); as initial) {
      @if (initial.revision === 1) {
        @if (workspace(); as current) {
          <section
            class="space-y-4 rounded-xl border bg-card p-4 sm:p-5"
            [id]="current.surfaceId"
            [attr.aria-label]="current.snapshot.plan.title"
            [attr.aria-busy]="pending()"
          >
            <header class="space-y-1">
              <p
                class="text-xs font-medium uppercase tracking-wide text-muted-foreground"
              >
                Competitive analysis · revision {{ current.revision }}
              </p>
              <h2 class="text-lg font-semibold">
                {{ current.snapshot.plan.title }}
              </h2>
              <p class="text-sm text-muted-foreground">
                Ford baseline and competitors · scoped specifications, source
                evidence and research gaps
              </p>
            </header>
            @if (surface()?.notice || localNotice(); as notice) {
              <p class="rounded-lg bg-muted p-3 text-sm" role="status">
                {{ notice }}
              </p>
            }
            @if (pending()) {
              <p role="status" class="text-sm text-muted-foreground">
                Applying the analyst action. Your current analysis remains
                available…
              </p>
            }
            @if (current.status === 'PARTIAL') {
              <p class="text-sm text-muted-foreground" role="status">
                Some panels need input or have unavailable evidence. Available
                results remain ready to inspect.
              </p>
            }
            @if (current.status === 'ERROR') {
              <p class="text-sm" role="status">
                The analysis could not retrieve its data. Start a new analysis
                or retry your last conversation turn.
              </p>
            }
            @if (!canApply() && !pending() && current.status !== 'ERROR') {
              <p class="text-xs text-muted-foreground">
                Explore the current results while the conversation is busy.
                Applying changes is available when the conversation is ready.
              </p>
            }
            <div
              class="grid min-w-0 grid-cols-1 items-start gap-4"
              [class.xl:grid-cols-3]="
                current.snapshot.plan.layout === 'analysis'
              "
            >
              <app-analyst-brief-edit
                class="min-w-0"
                [context]="current.snapshot.plan.context"
                [availableAttributes]="current.snapshot.availableAttributes"
                [selectedConfigurations]="shortlist()"
                [enabled]="canApply()"
                (briefApplied)="applyBrief($event)"
              />
              @for (panel of panels(); track panel.identity) {
                <section
                  class="min-w-0 space-y-3 rounded-xl border p-3 sm:p-4"
                  [class.xl:col-span-2]="
                    current.snapshot.plan.layout === 'analysis' && panel.wide
                  "
                  [attr.aria-label]="panel.title"
                >
                  <h3 class="font-semibold">{{ panel.title }}</h3>
                  @if (panel.message) {
                    <p class="text-sm text-muted-foreground" role="status">
                      {{ panel.message }}
                    </p>
                  }
                  @if (panel.catalog; as catalog) {
                    @for (notice of catalog.notices ?? []; track $index) {
                      <p class="text-sm text-muted-foreground">{{ notice }}</p>
                    }
                    <app-vehicle-catalog-overview
                      [page]="catalog"
                      [complete]="true"
                      [shortlist]="shortlist()"
                      (shortlistChanged)="selectConfigurations($event)"
                      (comparisonRequested)="applySelectedBrief()"
                      (questionRequested)="ask($event, panel)"
                    />
                  }
                  @if (panel.comparison; as comparison) {
                    <app-vehicle-comparison-overview
                      [comparison]="comparison"
                      [complete]="true"
                      [questionsEnabled]="!!actions"
                      (questionRequested)="ask($event, panel)"
                    />
                  }
                  @if (panel.evidence; as evidence) {
                    <app-review-evidence-pane [result]="evidence" />
                  }
                  @if (panel.gaps; as gaps) {
                    <app-evidence-gaps-pane
                      [result]="gaps"
                      [enabled]="canApply()"
                      (investigateRequested)="investigateGap(panel.id, $event)"
                    />
                  }
                  @if (panel.researchId; as requestId) {
                    <app-vehicle-research-detail [requestId]="requestId" />
                  }
                  @if (panel.scenarioArgs; as args) {
                    <app-target-scenario-edit
                      [attributeCode]="args.attributeCode"
                      [targetValue]="args.targetValue"
                      [availableAttributes]="
                        current.snapshot.availableAttributes
                      "
                      [configurations]="configurations()"
                      [result]="panel.scenario"
                      [enabled]="canApply()"
                      (targetApplied)="applyScenario(panel.id, $event)"
                    />
                  }
                  @if (panel.retryable) {
                    <button
                      z-button
                      zType="outline"
                      zSize="sm"
                      [zDisabled]="!canApply()"
                      (click)="retryPanel(panel.id)"
                    >
                      Retry this panel
                    </button>
                  }
                </section>
              }
            </div>
          </section>
        } @else {
          <p class="rounded-lg border p-3 text-sm" role="status">
            This workspace has conflicting revisions and cannot be displayed.
            Start a new analysis.
          </p>
        }
      } @else {
        <p class="rounded-lg border bg-muted/30 p-3 text-sm" role="status">
          Competitive analysis revision {{ initial.revision }} received.
          <a
            class="underline underline-offset-4"
            [href]="'#' + initial.surfaceId"
            >View the current analysis above</a
          >
          @if (surface()?.notice) {
            <span class="block mt-1">{{ surface()?.notice }}</span>
          }
        </p>
      }
    } @else if (toolCall().status !== 'complete') {
      <section
        class="space-y-3 rounded-xl border bg-card p-4"
        aria-label="Building competitive analysis"
        aria-busy="true"
      >
        <p role="status" class="font-medium">
          Building your competitive analysis…
        </p>
        <p class="text-sm text-muted-foreground">
          Retrieving the requested market configurations, specification evidence
          and research context.
        </p>
        <div
          class="h-24 rounded-lg bg-muted motion-safe:animate-pulse"
          aria-hidden="true"
        ></div>
      </section>
    } @else {
      <p class="rounded-lg border p-4 text-sm" role="status">
        {{
          rejection()?.message ??
            'This competitive workspace did not match its supported contract. The previous analysis remains unchanged; retry the request or start a new analysis.'
        }}
      </p>
    }
  `,
})
export class CompetitiveWorkspaceOverview
  implements ToolRenderer<Record<string, unknown>>
{
  readonly toolCall =
    input.required<AngularToolCall<Record<string, unknown>>>();
  protected readonly actions = inject(CHAT_CARD_ACTIONS, { optional: true });
  private readonly surfaces = inject(CHAT_WORKSPACE_SURFACES, {
    optional: true,
  });
  private readonly resultText = computed(() => this.toolCall().result);
  protected readonly initial = computed(() =>
    parseResult(this.resultText(), competitiveWorkspaceSchema),
  );
  protected readonly rejection = computed(() =>
    parseResult(this.resultText(), competitiveRejectionSchema),
  );
  protected readonly surface = computed(() => {
    const initial = this.initial();
    return initial ? this.surfaces?.(initial.surfaceId) : undefined;
  });
  protected readonly workspace = computed(() =>
    this.surfaces ? this.surface()?.workspace : this.initial(),
  );
  protected readonly panels = computed(
    () =>
      this.workspace()?.snapshot.panels.map((panel) => ({
        ...panelView(panel),
        identity: this.workspace()?.surfaceId + ':' + panel.id,
      })) ?? [],
  );
  protected readonly configurations = computed(
    () => workspaceConfigurations(this.workspace()),
    { equal: sameWorkspaceJson },
  );
  private readonly selectedIds = computed(
    () =>
      this.workspace()?.snapshot.plan.context.selectedConfigurationIds ?? [],
    { equal: sameWorkspaceJson },
  );
  protected readonly shortlist = linkedSignal(() =>
    this.configurations().filter((vehicle) =>
      this.selectedIds().includes(vehicle.id),
    ),
  );
  protected readonly pending = signal(false);
  protected readonly localNotice = linkedSignal({
    source: () => this.workspace()?.revision,
    computation: () => '',
  });
  protected readonly canApply = computed(
    () =>
      !!this.actions?.workspace &&
      (!this.actions.canSend || this.actions.canSend()) &&
      !this.pending() &&
      !this.surface()?.conflicted &&
      this.workspace()?.status !== 'ERROR',
  );
  private readonly brief = viewChild(AnalystBriefEdit);
  protected selectConfigurations(vehicles: VehicleConfiguration[]): void {
    const available = new Map(
      this.configurations().map((vehicle) => [vehicle.id, vehicle]),
    );
    this.shortlist.set(
      [...new Set(vehicles.map((vehicle) => vehicle.id))]
        .slice(0, 5)
        .flatMap((id) => available.get(id) ?? []),
    );
  }
  protected applySelectedBrief(): void {
    this.brief()?.requestApply();
  }
  protected applyBrief(values: AnalystContext): void {
    void this.dispatch({ action: 'applyBrief', componentId: 'brief', values });
  }
  protected investigateGap(
    componentId: string,
    values: { configurationId: string; attributeCode: string },
  ): void {
    void this.dispatch({ action: 'investigateGap', componentId, values });
  }
  protected applyScenario(
    componentId: string,
    values: { attributeCode: string; targetValue: number },
  ): void {
    void this.dispatch({ action: 'applyScenario', componentId, values });
  }
  protected retryPanel(componentId: string): void {
    void this.dispatch({ action: 'retryPanel', componentId, values: {} });
  }
  protected ask(question: VehicleQuestion, panel: PanelView): void {
    if (question.kind === 'catalog-page')
      this.actions?.send(
        catalogPagePrompt(question, panel.args, panel.catalog?.nextSearches),
      );
    else this.actions?.draft(vehicleQuestionPrompt(question));
  }
  private async dispatch(intent: ActionIntent): Promise<void> {
    const workspace = this.workspace();
    if (!workspace || !this.canApply() || !this.actions?.workspace) return;
    const action = {
      ...intent,
      version: 1 as const,
      actionId: crypto.randomUUID(),
      surfaceId: workspace.surfaceId,
      expectedRevision: workspace.revision,
    } as WorkspaceAction;
    this.pending.set(true);
    this.localNotice.set('');
    try {
      const sent = await this.actions.workspace(action);
      if (!sent)
        this.localNotice.set(
          'The action could not complete. Your current analysis and local inputs are preserved.',
        );
      else if (
        this.workspace()?.revision === workspace.revision &&
        !this.surface()?.notice
      )
        this.localNotice.set(
          'No revised workspace was returned. Your current analysis is preserved; retry the action.',
        );
    } catch {
      this.localNotice.set(
        'The action could not complete. Your current analysis and local inputs are preserved.',
      );
    } finally {
      this.pending.set(false);
    }
  }
}
type ActionIntent = WorkspaceAction extends infer Action
  ? Action extends WorkspaceAction
    ? Pick<Action, 'action' | 'componentId' | 'values'>
    : never
  : never;
interface PanelView {
  id: string;
  title: string;
  wide: boolean;
  args: Record<string, unknown>;
  message?: string;
  retryable: boolean;
  catalog?: CatalogPage;
  comparison?: Comparison;
  evidence?: ReviewEvidenceResult;
  gaps?: EvidenceGaps;
  researchId?: string;
  scenario?: TargetScenario;
  scenarioArgs?: { attributeCode: string; targetValue?: number };
}
function panelView(panel: ResolvedCompetitivePanel): PanelView {
  const status = 'status' in panel.result ? panel.result.status : undefined;
  const view: PanelView = {
    id: panel.id,
    title: panel.title,
    args: panel.args,
    wide: ['selection', 'comparison', 'scenario'].includes(panel.type),
    retryable: !!status && ['ERROR', 'UNAVAILABLE', 'PARTIAL'].includes(status),
    message: 'message' in panel.result ? panel.result.message : undefined,
  };
  switch (panel.type) {
    case 'selection':
      if ('items' in panel.result) view.catalog = panel.result;
      break;
    case 'comparison':
      if ('configurations' in panel.result) view.comparison = panel.result;
      break;
    case 'evidence':
      if ('kind' in panel.result) view.evidence = panel.result;
      break;
    case 'gaps':
      if (panel.result.status === 'OK') view.gaps = panel.result;
      break;
    case 'research':
      if ('id' in panel.result) view.researchId = panel.result.id;
      break;
    case 'scenario':
      if (panel.args.type === 'scenario') view.scenarioArgs = panel.args;
      if (panel.result.status === 'OK') view.scenario = panel.result;
      break;
  }
  return view;
}
export function workspaceConfigurations(
  workspace: CompetitiveWorkspace | undefined,
): VehicleConfiguration[] {
  const items =
    workspace?.snapshot.panels.flatMap((panel) =>
      panel.type === 'selection' && 'items' in panel.result
        ? panel.result.items
        : panel.type === 'comparison' && 'configurations' in panel.result
          ? panel.result.configurations
          : panel.type === 'gaps' && panel.result.status === 'OK'
            ? panel.result.comparison.configurations
            : [],
    ) ?? [];
  return [...new Map(items.map((vehicle) => [vehicle.id, vehicle])).values()];
}
