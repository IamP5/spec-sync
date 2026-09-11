import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';

import { ZardBadgeComponent } from '@/ui/components/badge';
import { ZardButtonComponent } from '@/ui/components/button';

import type {
  IngestionClaim,
  IngestionUnmappedObservation,
} from '../../data/ingestion-contracts';
import {
  researchIsActive,
  type ResearchSnapshot,
} from '../../data/research-contracts';
import type { ResearchEvidenceFocus } from '../../data/research-presentation';

@Component({
  selector: 'app-research-result-pane',
  imports: [ZardBadgeComponent, ZardButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block min-w-0' },
  template: `
    <section class="text-sm" data-research-result>
      <div class="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 class="font-semibold">
            {{ research().request.brand }} {{ research().request.model }} ·
            {{ research().request.modelYear }} · BR
          </h2>
          <p class="mt-1 text-muted-foreground" role="status">{{ status() }}</p>
        </div>
        <z-badge zType="secondary">{{ sharing() }}</z-badge>
      </div>
      @if (active()) {
        <p class="mt-2 text-muted-foreground" i18n>
          @if (retrying()) {
            Research retries automatically and reuses completed work.
          }
          Progress updates automatically. You can leave this chat and reopen the
          research later.
        </p>
      }
      @if (research().requestStatus === 'CANCELLED') {
        <p class="mt-2" i18n>
          You stopped following this request. Shared research can continue for
          other users.
        </p>
      }
      @if (research().replayedFromWorkId) {
        <p class="mt-2 text-xs text-muted-foreground" i18n>
          New interpretation of the saved source. The original research is
          preserved; this request is also available in your research history.
        </p>
      }
      @if (research().configurations.length) {
        <p class="mt-3 rounded-lg bg-muted p-2 text-xs" i18n>
          @if (research().status === 'PUBLISHED') {
            A reviewed catalog update was published. The source findings below
            may include claims outside the published selection.
          } @else {
            Unreviewed source findings. These specifications have not been
            accepted into the catalog.
          }
          Reliability has not been calibrated; inspect the evidence and issues.
        </p>
      }
      @if (terminalError(); as error) {
        <p class="mt-3 text-destructive" role="alert">{{ error }}</p>
      }
      @if (error()) {
        <p class="mt-3 text-destructive" role="alert">{{ error() }}</p>
      }
      @if (research().warnings.length) {
        <details class="mt-3" [open]="!focus()">
          <summary class="cursor-pointer text-xs font-medium" i18n>
            {research().warnings.length, plural,
              =1 {one warning about the source}
              other {{{ research().warnings.length }} warnings about the source}
            }
          </summary>
          <ul
            class="mt-3 list-disc space-y-1 pl-5 text-muted-foreground"
            i18n-aria-label
            aria-label="Research warnings"
          >
            @for (warning of research().warnings; track $index) {
              <li>{{ warning }}</li>
            }
          </ul>
        </details>
      }
      @if (research().source; as source) {
        <div class="mt-3 min-w-0">
          <a
            [href]="source.url"
            target="_blank"
            rel="noopener noreferrer"
            class="break-all underline underline-offset-2"
            >{{ source.title || source.url }}
            <span class="sr-only" i18n>(opens in a new tab)</span></a
          >
          <details class="mt-1 text-xs text-muted-foreground">
            <summary class="cursor-pointer" i18n>Source revision</summary>
            <dl class="mt-2 space-y-1 break-all">
              <dt i18n>Original SHA-256</dt>
              <dd>{{ source.originalSha256 }}</dd>
              <dt i18n>Transcript SHA-256</dt>
              <dd>{{ source.textSha256 }}</dd>
              <dt i18n>Reader</dt>
              <dd>{{ source.parserVersion }}</dd>
              @if (research().ontologyRevision !== undefined) {
                <dt i18n>Catalog vocabulary revision</dt>
                <dd>{{ research().ontologyRevision }}</dd>
              }
              @if (research().normalizationRevision; as normalization) {
                <dt i18n>Value normalization</dt>
                <dd>{{ normalization }}</dd>
              }
            </dl>
          </details>
        </div>
      }
      @if (research().configurations.length) {
        <h3 class="mt-4 font-medium">
          {{ focus() ? selectedEvidence : configurationsFromSource() }}
        </h3>
        <div class="mt-2 space-y-2">
          @for (configuration of configurations(); track configuration.name) {
            <details
              class="rounded-lg border p-3"
              [open]="!!focus() || requested(configuration.name)"
              [attr.data-configuration]="configuration.name"
            >
              <summary class="cursor-pointer font-medium" i18n>
                {{ configuration.name }} ·
                {{ configuration.claims.length }} mapped findings
                @if (configuration.unmappedObservations?.length; as count) {
                  · {{ count }} awaiting mapping
                }
                @if (requested(configuration.name)) {
                  <z-badge zType="secondary" class="ml-2">Requested</z-badge>
                }
              </summary>
              <p class="mt-2 text-xs text-muted-foreground" i18n>
                Identity evidence · lines
                {{ configuration.identityLineStart }}–{{
                  configuration.identityLineEnd
                }}
              </p>
              <blockquote
                class="mt-1 whitespace-pre-wrap border-l-2 pl-3 text-xs"
              >
                {{ configuration.identityExcerpt }}
              </blockquote>
              @if (configuration.warnings.length) {
                <ul class="mt-2 list-disc pl-5 text-xs text-muted-foreground">
                  @for (warning of configuration.warnings; track $index) {
                    <li>{{ warning }}</li>
                  }
                </ul>
              }
              <div class="mt-3 divide-y">
                @for (claim of configuration.claims; track $index) {
                  <section class="py-3" [attr.aria-label]="claim.label">
                    <h4 class="font-medium">{{ claim.label }}</h4>
                    @if (claim.originalTerm; as originalTerm) {
                      <p class="mt-1 text-xs text-muted-foreground" i18n>
                        Source term: {{ originalTerm }}
                      </p>
                    }
                    <p data-claim-value>
                      {{ displayValue(claim) }}
                      {{ claim.rawUnit || claim.unit || '' }}
                      @if (claim.availability) {
                        · {{ claim.availability }}
                      }
                    </p>
                    @if (qualifiers(claim.qualifiers); as conditions) {
                      <p class="mt-1 text-xs text-muted-foreground">
                        {{ conditions }}
                      </p>
                    }
                    <details class="mt-2 text-xs" [open]="!!focus()">
                      <summary
                        class="cursor-pointer text-muted-foreground"
                        i18n
                      >
                        Evidence · lines {{ claim.lineStart }}–{{
                          claim.lineEnd
                        }}
                        @if (claim.locator) {
                          · {{ claim.locator }}
                        }
                      </summary>
                      <blockquote
                        class="mt-2 whitespace-pre-wrap border-l-2 pl-3"
                      >
                        {{ claim.excerpt }}
                      </blockquote>
                    </details>
                    @if (claim.issues.length) {
                      <ul
                        class="mt-2 list-disc pl-5 text-xs text-destructive"
                        i18n-aria-label
                        aria-label="Claim issues"
                      >
                        @for (issue of claim.issues; track $index) {
                          <li>{{ issue }}</li>
                        }
                      </ul>
                    }
                  </section>
                }
              </div>
              @if (configuration.unmappedObservations?.length) {
                <section
                  class="mt-3 rounded-lg bg-muted p-3"
                  i18n-aria-label
                  aria-label="Findings awaiting catalog mapping"
                >
                  <h4 class="font-medium" i18n>
                    Findings awaiting catalog mapping
                  </h4>
                  <p class="mt-1 text-xs text-muted-foreground" i18n>
                    These source observations are retained separately from
                    mapped specifications. A proposed mapping does not accept a
                    vehicle specification into the catalog.
                  </p>
                  @for (
                    observation of configuration.unmappedObservations;
                    track $index
                  ) {
                    <article class="mt-3 border-t pt-3" data-unmapped-finding>
                      <h5 class="font-medium">
                        {{ observation.originalTerm }}
                      </h5>
                      <p>
                        {{ observation.rawValue }}
                        {{ observation.sourceUnit || '' }}
                      </p>
                      @if (observation.termOrigin === 'DERIVED_TEXT') {
                        <p class="mt-1 text-xs text-muted-foreground" i18n>
                          This term comes from the document interpretation;
                          confirm the manufacturer's original wording.
                        </p>
                      }
                      @if (qualifiers(observation.qualifiers); as conditions) {
                        <p class="mt-1 text-xs text-muted-foreground">
                          {{ conditions }}
                        </p>
                      }
                      @if (observation.proposal; as proposal) {
                        <p class="mt-2 text-xs">
                          <z-badge zType="secondary" i18n
                            >Mapping proposed</z-badge
                          >
                          {{ proposalKind(proposal) }}
                          @if (proposal.label) {
                            · {{ proposal.label }}
                          }
                        </p>
                        <p class="mt-1 text-xs text-muted-foreground">
                          {{ proposal.definition }}
                        </p>
                      } @else {
                        <p class="mt-2 text-xs text-muted-foreground" i18n>
                          Catalog mapping needs review.
                        </p>
                      }
                      <details class="mt-2 text-xs">
                        <summary
                          class="cursor-pointer text-muted-foreground"
                          i18n
                        >
                          Evidence · lines {{ observation.lineStart }}–{{
                            observation.lineEnd
                          }}
                          @if (observation.locator) {
                            · {{ observation.locator }}
                          }
                        </summary>
                        <blockquote
                          class="mt-2 whitespace-pre-wrap border-l-2 pl-3"
                        >
                          {{ observation.excerpt }}
                        </blockquote>
                      </details>
                    </article>
                  }
                </section>
              }
            </details>
          }
        </div>
      }
      <div class="mt-4 flex flex-wrap items-center gap-2">
        <button
          z-button
          zType="outline"
          zSize="sm"
          type="button"
          [zDisabled]="updating() || busy() || replaying()"
          (click)="refreshRequested.emit()"
          i18n
        >
          Refresh research
        </button>
        @if (canReplay()) {
          <button
            z-button
            zType="outline"
            zSize="sm"
            type="button"
            [zDisabled]="updating() || busy() || replaying()"
            (click)="replayRequested.emit()"
          >
            {{ replaying() ? startingInterpretation : reinterpretSource }}
          </button>
        }
        @if (research().requestStatus === 'ACTIVE') {
          <button
            z-button
            zType="ghost"
            zSize="sm"
            type="button"
            [zDisabled]="busy() || replaying()"
            (click)="cancelRequested.emit()"
          >
            {{ busy() ? stoppingFollow : stopFollowing }}
          </button>
        }
      </div>
    </section>
  `,
})
export class ResearchResultPane {
  readonly research = input.required<ResearchSnapshot>();
  protected readonly selectedEvidence = $localize`Selected specification evidence`;
  protected readonly startingInterpretation = $localize`Starting new interpretation…`;
  protected readonly reinterpretSource = $localize`Reinterpret saved source`;
  protected readonly stoppingFollow = $localize`Stopping follow…`;
  protected readonly stopFollowing = $localize`Stop following`;

  protected configurationsFromSource(): string {
    const count = this.research().configurations.length;
    return $localize`${count}:count: configurations from the source`;
  }
  readonly focus = input<ResearchEvidenceFocus | null>(null);
  protected readonly configurations = computed(() => {
    const focus = this.focus();
    const configurations = this.research().configurations;
    return focus
      ? configurations
          .filter((item) => item.name === focus.configuration)
          .map((item) => ({
            ...item,
            claims: item.claims.filter(
              (claim) => claim.attributeCode === focus.attribute,
            ),
          }))
      : configurations;
  });
  readonly busy = input(false);
  readonly replaying = input(false);
  readonly updating = input(false);
  readonly error = input('');
  readonly cancelRequested = output<void>();
  readonly refreshRequested = output<void>();
  readonly replayRequested = output<void>();
  protected readonly active = computed(() => researchIsActive(this.research()));
  protected readonly canReplay = computed(() => {
    const research = this.research();
    return (
      research.requestStatus === 'ACTIVE' &&
      !!research.source &&
      (research.status === 'REVIEW' || research.status === 'PUBLISHED')
    );
  });
  protected readonly retrying = computed(
    () =>
      this.active() &&
      (this.research().attempts > 1 ||
        (this.research().status === 'QUEUED' && this.research().attempts > 0)),
  );
  protected readonly terminalError = computed(() => {
    const research = this.research();
    return research.status === 'FAILED' || research.status === 'REJECTED'
      ? research.error
      : null;
  });
  protected readonly sharing = computed(
    () =>
      ({
        CREATED: 'Research started',
        JOINED: 'Joined shared research',
        REUSED: 'Existing research reused',
      })[this.research().disposition],
  );
  protected readonly status = computed(() => {
    const research = this.research();
    if (research.requestStatus === 'CANCELLED') return 'Not following';
    if (this.active()) {
      if (research.status === 'QUEUED')
        return this.retrying()
          ? `Retry queued after attempt ${research.attempts}`
          : 'Queued';
      const progress = this.progress(research.stage);
      return this.retrying()
        ? `Retrying research · attempt ${research.attempts} · ${progress}`
        : progress;
    }
    return {
      REVIEW: 'Ready for review',
      PUBLISHED: 'Catalog update published',
      FAILED: 'Research failed',
      REJECTED: 'Research rejected',
      QUEUED: 'Queued',
      PROCESSING: 'Researching sources',
    }[research.status];
  });
  protected requested(name: string): boolean {
    const requested = this.research().request.configurations;
    return (
      requested.length === 0 ||
      requested.some(
        (value) =>
          value.trim().toLocaleLowerCase() === name.trim().toLocaleLowerCase(),
      )
    );
  }
  protected qualifiers(value: Record<string, string>): string {
    return Object.entries(value)
      .map(([key, item]) => `${key}: ${item}`)
      .join(' · ');
  }
  protected displayValue(claim: IngestionClaim): string {
    if (claim.listValue?.length) return claim.listValue.join(', ');
    if (
      !claim.issues.length &&
      Array.isArray(claim.value) &&
      claim.value.length &&
      claim.value.every((value) => typeof value === 'string' && value.trim())
    )
      return claim.value.join(', ');
    return claim.rawValue;
  }
  protected proposalKind(
    proposal: NonNullable<IngestionUnmappedObservation['proposal']>,
  ): string {
    return {
      ADD_ATTRIBUTE: 'New catalog field',
      ADD_ALIAS: 'Manufacturer terminology',
      EXTEND_VOCABULARY: 'New catalog value',
      REVIEW_SEMANTICS: 'Meaning needs review',
    }[proposal.kind];
  }
  private progress(stage: string): string {
    if (stage === 'capture-source') return 'Source captured';
    if (stage === 'identify-configurations') return 'Configurations identified';
    if (/^extract-(?:[a-f0-9]{20}-)?configuration-\d+$/.test(stage))
      return 'Extracting specifications for the document’s configurations';
    return 'Researching sources';
  }
}
