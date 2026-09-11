import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';

import type { ReviewEvidenceResult } from '../../data/knowledge-contracts';
import { safeSourceUrl } from '../../util/knowledge-display';

@Component({
  selector: 'app-review-evidence-pane',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block min-w-0' },
  template: `
    @if (result(); as result) {
      <p class="mb-3 text-sm text-muted-foreground" role="status">
        {{ result.message }}
      </p>
      @if (evidence(); as data) {
        @if (data.items.length) {
          <p class="mb-4 text-xs text-muted-foreground">
            Review evidence · opinions and measurements retain their original
            vehicle scope. Review statements do not establish an accepted
            technical specification.
          </p>
          <ul class="space-y-4" aria-label="Review evidence">
            @for (item of data.items; track item.id) {
              <li class="space-y-2 rounded-lg border p-3 text-sm">
                <div class="flex flex-wrap items-start justify-between gap-2">
                  @if (sourceUrl(item); as url) {
                    <a
                      class="font-medium underline underline-offset-4"
                      [href]="url"
                      target="_blank"
                      rel="noopener noreferrer"
                      >{{ item.title
                      }}<span class="sr-only"> (opens in a new tab)</span></a
                    >
                  } @else {
                    <strong>{{ item.title }}</strong>
                  }
                  <span class="rounded-full bg-muted px-2 py-0.5 text-xs">{{
                    item.scope === 'MODEL'
                      ? 'Model-level evidence'
                      : 'Configuration-level evidence'
                  }}</span>
                </div>
                <blockquote
                  class="border-l-2 pl-3 leading-relaxed whitespace-pre-wrap"
                >
                  {{ item.excerpt }}
                </blockquote>
                <div
                  class="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground"
                >
                  @if (item.kind) {
                    <span>{{ item.kind }}</span>
                  }
                  @if (item.sentiment) {
                    <span>Source sentiment: {{ item.sentiment }}</span>
                  }
                  @if (item.author) {
                    <span>{{ item.author }}</span>
                  }
                  @if (item.publishedOn) {
                    <span>Published {{ item.publishedOn }}</span>
                  }
                  @if (item.capturedOn) {
                    <span>Captured {{ item.capturedOn }}</span>
                  }
                  @if (item.locator) {
                    <span>{{ item.locator }}</span>
                  }
                </div>
                @if (item.conditions) {
                  <p class="text-xs">
                    Conditions: {{ conditions(item.conditions) }}
                  </p>
                }
                @if (item.context) {
                  <details class="text-xs">
                    <summary
                      class="cursor-pointer py-1 underline underline-offset-4"
                    >
                      Passage context
                    </summary>
                    <p class="mt-2 whitespace-pre-wrap">{{ item.context }}</p>
                  </details>
                }
              </li>
            }
          </ul>
        } @else if (data.status === 'EMPTY') {
          <p class="text-sm text-muted-foreground">
            No matching indexed review evidence. This does not establish that
            the capability or competitive difference is absent.
          </p>
        }
      }
    } @else {
      <p role="status" class="text-sm text-muted-foreground">
        {{
          complete()
            ? 'No valid evidence result returned.'
            : 'Retrieving source evidence…'
        }}
      </p>
    }
  `,
})
export class ReviewEvidencePane {
  readonly result = input<
    | ReviewEvidenceResult
    | { status: 'ERROR'; message: string; retryable: boolean }
  >();
  readonly complete = input(true);
  protected readonly evidence = computed(() => {
    const result = this.result();
    return result && result.status !== 'ERROR' ? result : undefined;
  });
  protected conditions(value: string | string[]): string {
    return Array.isArray(value) ? value.join('; ') : value;
  }
  protected sourceUrl(
    item: ReviewEvidenceResult['items'][number],
  ): string | undefined {
    const href = safeSourceUrl(item.url);
    if (!href) return undefined;
    const url = new URL(href);
    if (
      item.startSeconds != null &&
      ['youtube.com', 'www.youtube.com', 'youtu.be'].includes(url.hostname)
    )
      url.searchParams.set('t', String(Math.floor(item.startSeconds)));
    return url.href;
  }
}
