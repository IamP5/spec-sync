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
            {{ data.message }}
          </p>
          @if (data.items?.length) {
            <ul class="space-y-4">
              @for (item of data.items; track $index) {
                <li class="border-l-2 pl-3">
                  @if (link(item); as href) {
                    <a
                      class="font-medium underline"
                      [href]="href"
                      target="_blank"
                      rel="noopener noreferrer"
                      >{{ label(item) }}</a
                    >
                  } @else {
                    <strong>{{ label(item) }}</strong>
                  }
                  @if (item['verification']) {
                    <p class="text-xs">
                      Discovered link · content not verified or ingested
                    </p>
                  }
                  @if (item['documentType']) {
                    <p class="text-xs">
                      {{
                        item['documentType'] === 'PDF'
                          ? 'Brochure PDF · not yet read'
                          : 'Web page · not yet read'
                      }}
                    </p>
                  }
                  @if (item['excerpt']) {
                    <blockquote class="my-2">
                      {{ format(item['excerpt']) }}
                    </blockquote>
                  }
                  @if (item['market']) {
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
                    <p class="text-xs">
                      Scope: {{ format(item['scope']) }} ·
                      {{ format(item['kind']) }} ·
                      {{ format(item['sentiment']) }}
                    </p>
                  }
                  @if (item['locator']) {
                    <p class="text-xs">{{ format(item['locator']) }}</p>
                  }
                  @if (item['conditions']) {
                    <p class="text-xs">
                      Conditions: {{ format(item['conditions']) }}
                    </p>
                  }
                  @if (item['availability']) {
                    <p>{{ format(item['availability']) }}</p>
                  }
                  @if (item['packages']) {
                    <p class="text-xs">
                      Packages: {{ format(item['packages']) }}
                    </p>
                  }
                  @if (item['context']) {
                    <details>
                      <summary class="cursor-pointer underline">
                        Passage context
                      </summary>
                      <p>{{ format(item['context']) }}</p>
                    </details>
                  }
                </li>
              }
            </ul>
          } @else if (!data.message) {
            <p>No matching results.</p>
          }
        } @else {
          <p role="status">
            {{
              toolCall().status === 'complete'
                ? 'No valid result returned.'
                : 'Retrieving information…'
            }}
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
  protected readonly title = computed(() =>
    toolTitle(this.toolCall().name ?? ''),
  );
  protected readonly format = displayValue;
  protected label(item: Record<string, unknown>) {
    return displayValue(
      item['title'] ??
        item['name'] ??
        item['label'] ??
        item['code'] ??
        'Evidence',
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
        searchVehicleConfigurations: 'Busca de veículos',
        listComparisonAttributes: 'Especificações disponíveis',
        resolveComparisonConcepts: 'Identificação de especificações',
        findConfigurationsByCapabilities:
          'Veículos com os equipamentos solicitados',
        searchReviewEvidence: 'Avaliações e relatos',
        getRelatedReviews: 'Avaliações relacionadas',
        getEvidenceExcerpt: 'Trecho e contexto da fonte',
        discoverVehicleContent: 'Artigos, blogs e vídeos encontrados',
      } as Record<string, string>
    )[name] ?? 'Resultado da consulta'
  );
}
