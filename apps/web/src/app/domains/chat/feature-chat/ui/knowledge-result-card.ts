import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { AngularToolCall, ToolRenderer } from '@copilotkit/angular';
import { z } from 'zod';

import { ZardCardComponent } from '@/ui/components/card';

import { displayValue, safeSourceUrl } from '../../util/knowledge-display';
import { parseResult } from '../../util/parse-result';

const schema = z.object({
  status: z.string().optional(),
  message: z.string().optional(),
  items: z.array(z.record(z.unknown())).optional(),
  warnings: z.unknown().optional(),
});
@Component({
  selector: 'app-knowledge-result-card',
  imports: [ZardCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block', '[class.hidden]': 'internal() && !failed()' },
  template: `
    @if (!internal() || failed()) {
      <z-card class="rounded-xl p-4 text-sm shadow-none">
        <strong>{{ title() }}</strong>
        @if (result(); as data) {
          <p class="my-2 text-muted-foreground" role="status">
            {{ emptyContent() ? noExternalLinks : data.message }}
          </p>
          @if (specificationDiscovery()) {
            @if (data.items?.length) {
              <p class="mb-3 text-xs text-muted-foreground" i18n>
                Source candidates only. Applicability to the requested vehicle
                and model year has not been verified.
              </p>
            }
            @if (discoveryWarnings().length) {
              <ul
                class="mb-3 list-disc space-y-1 pl-5 text-muted-foreground"
                i18n-aria-label
                aria-label="Source discovery warnings"
              >
                @for (warning of discoveryWarnings(); track $index) {
                  <li>{{ warning }}</li>
                }
              </ul>
            }
          }
          @if (data.items?.length) {
            <ul class="space-y-4">
              @for (item of data.items; track $index) {
                <li class="border-l-2 pl-3">
                  @if (specificationDiscovery() && item['sourceType']) {
                    <p class="mb-1 text-xs text-muted-foreground">
                      {{ sourceTypeLabel(item['sourceType']) }}
                    </p>
                  }
                  @if (link(item); as href) {
                    <a
                      class="font-medium underline"
                      [href]="href"
                      target="_blank"
                      rel="noopener noreferrer"
                      >{{ label(item) }}
                      @if (specificationDiscovery()) {
                        <span class="sr-only" i18n>(opens in a new tab)</span>
                      }
                    </a>
                  } @else {
                    <strong>{{ label(item) }}</strong>
                  }
                  @if (item['verification']) {
                    <p class="text-xs" i18n>
                      Discovered link · content not verified or ingested
                    </p>
                  }
                  @if (item['documentType']) {
                    <p class="text-xs">
                      {{
                        item['documentType'] === 'PDF'
                          ? brochureNotRead
                          : webPageNotRead
                      }}
                    </p>
                  }
                  @if (specificationDiscovery()) {
                    @if (item['availability'] === 'OVERSIZE') {
                      <p class="mt-1 text-xs text-muted-foreground" i18n>
                        Document exceeds the current reading limit; another
                        source may be used.
                      </p>
                    } @else if (item['availability'] === 'UNREACHABLE') {
                      <p class="mt-1 text-xs text-muted-foreground" i18n>
                        Source could not be reached; another source may be used.
                      </p>
                    }
                    @if (yearHint(item); as year) {
                      <p class="mt-1 text-xs text-muted-foreground" i18n>
                        Year mentioned in the title or URL: {{ year }}.
                        Model-year applicability is unverified.
                      </p>
                    }
                    @if (item['modelMatch'] === false) {
                      <p class="mt-1 text-xs text-muted-foreground" i18n>
                        Model match is not confirmed by the link text.
                      </p>
                    }
                  }
                  @if (item['excerpt']) {
                    <blockquote class="my-2">
                      {{ format(item['excerpt']) }}
                    </blockquote>
                  }
                  @if (!specificationDiscovery() && item['market']) {
                    <p class="text-xs">
                      {{ format(item['market']) }} ·
                      {{ format(item['modelYear']) }} ·
                      {{ format(item['identityStatus']) }}
                    </p>
                  }
                  @if (item['author'] || item['publishedOn']) {
                    <p class="text-xs">
                      {{ format(item['author']) }} ·
                      {{ format(item['publishedOn']) }}
                    </p>
                  }
                  @if (item['scope']) {
                    <p class="text-xs" i18n>
                      Scope: {{ format(item['scope']) }} ·
                      {{ format(item['kind']) }} ·
                      {{ format(item['sentiment']) }}
                    </p>
                  }
                  @if (item['locator']) {
                    <p class="text-xs">{{ format(item['locator']) }}</p>
                  }
                  @if (item['conditions']) {
                    <p class="text-xs" i18n>
                      Conditions: {{ format(item['conditions']) }}
                    </p>
                  }
                  @if (!specificationDiscovery() && item['availability']) {
                    <p>{{ format(item['availability']) }}</p>
                  }
                  @if (item['packages']) {
                    <p class="text-xs" i18n>
                      Packages: {{ format(item['packages']) }}
                    </p>
                  }
                  @if (item['context']) {
                    <details>
                      <summary class="cursor-pointer underline" i18n>
                        Passage context
                      </summary>
                      <p>{{ format(item['context']) }}</p>
                    </details>
                  }
                </li>
              }
            </ul>
          } @else if (!data.message) {
            <p i18n>No matching results.</p>
          }
        } @else {
          <p role="status">
            {{ toolCall().status === 'complete' ? noValidResult : retrieving }}
          </p>
        }
      </z-card>
    }
  `,
})
export class KnowledgeResultCard
  implements ToolRenderer<Record<string, unknown>>
{
  readonly toolCall =
    input.required<AngularToolCall<Record<string, unknown>>>();
  protected readonly result = computed(() =>
    parseResult(this.toolCall().result, schema),
  );
  protected readonly specificationDiscovery = computed(
    () => this.toolCall().name === 'discoverVehicleSpecificationSources',
  );
  protected readonly discoveryWarnings = computed(() => {
    const warnings = z.array(z.string()).safeParse(this.result()?.warnings);
    return warnings.success ? warnings.data : [];
  });
  protected readonly internal = computed(() =>
    [
      'searchVehicleConfigurations',
      'listComparisonAttributes',
      'resolveComparisonConcepts',
    ].includes(this.toolCall().name ?? ''),
  );
  protected readonly failed = computed(
    () =>
      ['ERROR', 'UNAVAILABLE'].includes(this.result()?.status ?? '') ||
      (this.toolCall().status === 'complete' && !this.result()),
  );
  protected readonly emptyContent = computed(
    () =>
      this.toolCall().name === 'discoverVehicleContent' &&
      this.result()?.status === 'EMPTY',
  );
  protected readonly title = computed(() =>
    this.emptyContent()
      ? $localize`External content search`
      : toolTitle(this.toolCall().name ?? ''),
  );
  protected readonly noExternalLinks = $localize`No external links found for this search.`;
  protected readonly brochureNotRead = $localize`Brochure PDF · not yet read`;
  protected readonly webPageNotRead = $localize`Web page · not yet read`;
  protected readonly noValidResult = $localize`No valid result returned.`;
  protected readonly retrieving = $localize`Retrieving information…`;
  protected readonly format = displayValue;
  protected yearHint(item: Record<string, unknown>): number | undefined {
    const value = item['yearHint'];
    return typeof value === 'number' && Number.isInteger(value)
      ? value
      : undefined;
  }
  protected sourceTypeLabel(value: unknown): string {
    return value === 'MANUFACTURER_WEBSITE'
      ? $localize`Manufacturer website`
      : value === 'LINKED_FROM_MANUFACTURER'
        ? $localize`Document linked from the manufacturer website`
        : $localize`External site — confirm authorship and evidence`;
  }

  protected label(item: Record<string, unknown>) {
    return displayValue(
      item['title'] ??
        item['name'] ??
        item['label'] ??
        item['code'] ??
        $localize`Evidence`,
    );
  }
  protected link(item: Record<string, unknown>) {
    const href = safeSourceUrl(item['url']);
    if (!href) return undefined;
    const url = new URL(href);
    const seconds = item['startSeconds'];
    if (
      typeof seconds === 'number' &&
      seconds >= 0 &&
      (url.hostname === 'www.youtube.com' ||
        url.hostname === 'youtube.com' ||
        url.hostname === 'youtu.be')
    )
      url.searchParams.set('t', String(Math.floor(seconds)));
    return url.href;
  }
}

function toolTitle(name: string): string {
  return (
    (
      {
        searchVehicleConfigurations: $localize`Vehicle search`,
        listComparisonAttributes: $localize`Available specifications`,
        resolveComparisonConcepts: $localize`Specification identification`,
        findConfigurationsByCapabilities: $localize`Vehicles with the requested equipment`,
        searchReviewEvidence: $localize`Reviews and reports`,
        getRelatedReviews: $localize`Related reviews`,
        getEvidenceExcerpt: $localize`Source excerpt and context`,
        discoverVehicleContent: $localize`Articles, blogs and videos found`,
        discoverVehicleSpecificationSources: $localize`Specification sources`,
      } as Record<string, string>
    )[name] ?? $localize`Query result`
  );
}
