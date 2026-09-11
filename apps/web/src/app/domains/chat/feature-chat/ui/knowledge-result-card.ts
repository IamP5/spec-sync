import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { AngularToolCall, ToolRenderer } from '@copilotkit/angular';

import { ZardCardComponent } from '@/ui/components/card';

import { knowledgeView, reviewExcerpt } from '../../data/knowledge-view';
import { safeSourceUrl } from '../../util/knowledge-display';
import { ReviewEvidencePane } from './review-evidence-pane';

@Component({
  selector: 'app-knowledge-result-card',
  imports: [ZardCardComponent, ReviewEvidencePane],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <z-card class="rounded-xl p-4 text-sm shadow-none">
      @if (view(); as view) {
        @switch (view.kind) {
          @case ('reviews') {
            <app-review-evidence-pane [result]="view.data" />
          }
          @case ('sources') {
            <strong>Fontes de especificações</strong>
            <p class="my-2 text-muted-foreground" role="status">
              {{
                view.data.status === 'EMPTY'
                  ? 'No specification sources found for this search.'
                  : view.data.message
              }}
            </p>
            <p class="mb-3 text-xs text-muted-foreground">
              Source candidates only. Applicability to the requested vehicle and
              model year has not been verified.
            </p>
            @if (view.data.warnings.length) {
              <ul
                class="mb-3 list-disc space-y-1 pl-5 text-muted-foreground"
                aria-label="Source discovery warnings"
              >
                @for (warning of view.data.warnings; track $index) {
                  <li>{{ warning }}</li>
                }
              </ul>
            }
            <ul class="space-y-4">
              @for (item of view.data.items; track item.url) {
                <li class="space-y-1 border-l-2 pl-3">
                  @if (item.sourceType) {
                    <p class="text-xs text-muted-foreground">
                      {{ sourceTypeLabel(item.sourceType) }}
                    </p>
                  }
                  @if (safeUrl(item.url); as url) {
                    <a
                      class="font-medium underline"
                      [href]="url"
                      target="_blank"
                      rel="noopener noreferrer"
                      >{{ item.title
                      }}<span class="sr-only"> (opens in a new tab)</span></a
                    >
                  } @else {
                    <strong>{{ item.title }}</strong>
                  }
                  @if (item.documentType) {
                    <p class="text-xs">
                      {{
                        item.documentType === 'PDF'
                          ? 'Brochure PDF · not yet read'
                          : 'Web page · not yet read'
                      }}
                    </p>
                  }
                  @if (item.availability === 'OVERSIZE') {
                    <p class="text-xs text-muted-foreground">
                      Document exceeds the current reading limit; another source
                      may be used.
                    </p>
                  }
                  @if (item.availability === 'UNREACHABLE') {
                    <p class="text-xs text-muted-foreground">
                      Source could not be reached; another source may be used.
                    </p>
                  }
                  @if (item.yearHint !== null && item.yearHint !== undefined) {
                    <p class="text-xs text-muted-foreground">
                      Year mentioned in the title or URL: {{ item.yearHint }}.
                      Model-year applicability is unverified.
                    </p>
                  }
                  @if (item.modelMatch === false) {
                    <p class="text-xs text-muted-foreground">
                      Model match is not confirmed by the link text.
                    </p>
                  }
                </li>
              }
            </ul>
          }
          @case ('content') {
            <strong>External source discovery</strong>
            <p class="my-2 text-muted-foreground" role="status">
              {{
                view.data.status === 'EMPTY'
                  ? 'No external links found for this search.'
                  : view.data.message
              }}
            </p>
            <ul class="space-y-3">
              @for (item of view.data.items; track item.url) {
                <li>
                  @if (safeUrl(item.url); as url) {
                    <a
                      class="font-medium underline"
                      [href]="url"
                      target="_blank"
                      rel="noopener noreferrer"
                      >{{ item.title
                      }}<span class="sr-only"> (opens in a new tab)</span></a
                    >
                  } @else {
                    <strong>{{ item.title }}</strong>
                  }
                  <p class="text-xs text-muted-foreground">
                    Discovered link · content not verified or ingested
                  </p>
                </li>
              }
            </ul>
          }
          @case ('capabilities') {
            <strong>Configurations with the requested equipment</strong>
            <p class="my-2 text-muted-foreground" role="status">
              {{ view.data.message }}
            </p>
            <ul class="space-y-3">
              @for (item of view.data.items; track item.observationId) {
                <li class="space-y-1 border-l-2 pl-3">
                  <strong>{{ item.name }}</strong>
                  <p class="text-xs">
                    {{ item.market }} · {{ item.modelYear }} ·
                    {{ item.identityStatus }}
                  </p>
                  <p>
                    {{ item.attributeCode }} ·
                    {{
                      item.availability === 'OPTIONAL'
                        ? 'Optional equipment'
                        : 'Standard equipment'
                    }}
                  </p>
                  @for (pack of item.packages; track $index) {
                    <p class="text-xs">
                      Package: {{ pack.name }} · {{ pack.availability }}
                    </p>
                  }
                  @if (item.qualifiersJson) {
                    <p class="text-xs whitespace-pre-wrap">
                      Conditions: {{ item.qualifiersJson }}
                    </p>
                  }
                  <p class="text-xs text-muted-foreground">
                    {{ item.evidenceIds.length }} source references · confirm
                    specifications in the catalog.
                  </p>
                </li>
              }
            </ul>
          }
          @case ('concepts') {
            <strong>Canonical specifications</strong>
            <p class="my-2 text-muted-foreground" role="status">
              {{ view.data.message }}
            </p>
            <ul class="space-y-3">
              @for (item of view.data.items; track item.id) {
                <li>
                  <strong>{{ item.label }}</strong>
                  <p>{{ item.description }}</p>
                  <p class="text-xs text-muted-foreground">
                    {{ item.code }} · {{ item.unit }}
                  </p>
                </li>
              }
            </ul>
          }
          @case ('attributes') {
            <strong>Available comparison attributes</strong>
            <ul class="mt-3 space-y-2">
              @for (item of view.data.items; track item.id) {
                <li>
                  <strong>{{ item.label }}</strong>
                  <p class="text-xs">
                    {{ item.description }} · {{ item.unit }}
                  </p>
                </li>
              }
            </ul>
          }
          @case ('excerpts') {
            <strong>Source excerpt and context</strong>
            <p class="my-2 text-muted-foreground" role="status">
              {{ view.data.message }}
            </p>
            <ul class="space-y-4">
              @for (item of view.data.items; track item.evidenceId) {
                <li class="space-y-2 border-l-2 pl-3">
                  @if (item.recordType === 'specification-excerpt') {
                    <strong>{{ item.title }}</strong>
                    <blockquote class="whitespace-pre-wrap">
                      {{ item.excerpt }}
                    </blockquote>
                    <p class="text-xs">{{ item.locator }}</p>
                    <p class="text-xs">{{ item.provenance }}</p>
                    @for (source of item.upstreamUrls; track source) {
                      @if (safeUrl(source); as url) {
                        <a
                          class="mr-3 text-xs underline"
                          [href]="url"
                          target="_blank"
                          rel="noopener noreferrer"
                          >Upstream source<span class="sr-only">
                            (opens in a new tab)</span
                          ></a
                        >
                      }
                    }
                  } @else {
                    <app-review-evidence-pane
                      [result]="reviewExcerpt(view.data, item)"
                    />
                  }
                </li>
              }
            </ul>
          }
          @case ('failure') {
            <p role="status">{{ view.data.message }}</p>
          }
        }
      } @else {
        <p role="status">
          {{
            toolCall().status === 'complete'
              ? 'No valid result returned for this tool.'
              : 'Retrieving information…'
          }}
        </p>
      }
    </z-card>
  `,
})
export class KnowledgeResultCard
  implements ToolRenderer<Record<string, unknown>>
{
  readonly toolCall =
    input.required<AngularToolCall<Record<string, unknown>>>();
  protected readonly view = computed(() =>
    knowledgeView(this.toolCall().name ?? '', this.toolCall().result),
  );
  protected readonly safeUrl = safeSourceUrl;
  protected readonly reviewExcerpt = reviewExcerpt;
  protected sourceTypeLabel(
    type:
      | 'MANUFACTURER_WEBSITE'
      | 'LINKED_FROM_MANUFACTURER'
      | 'EXTERNAL_WEBSITE',
  ) {
    return {
      MANUFACTURER_WEBSITE: 'Site do fabricante',
      LINKED_FROM_MANUFACTURER: 'Documento indicado pelo fabricante',
      EXTERNAL_WEBSITE: 'Site externo',
    }[type];
  }
}
