import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideChevronDown,
  lucideDownload,
  lucideExternalLink,
  lucideTriangleAlert,
} from '@ng-icons/lucide';

import { ZardBadgeComponent } from '@/ui/components/badge';
import { ZardButtonComponent } from '@/ui/components/button';

import { safeSourceUrl } from '../../util/vehicle-display';

export interface IngestionSourceView {
  readonly url: string;
  readonly title: string;
  readonly mimeType: string;
  readonly parserVersion: string;
  readonly text: string;
}

/** The captured source: link, capture kind, coverage warnings and the evidence text. */
@Component({
  selector: 'app-ingestion-source-pane',
  imports: [NgIcon, ZardBadgeComponent, ZardButtonComponent],
  viewProviders: [
    provideIcons({
      lucideChevronDown,
      lucideDownload,
      lucideExternalLink,
      lucideTriangleAlert,
    }),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div class="min-w-0">
        <h3 class="font-semibold">Source</h3>
        @if (href(); as link) {
          <a
            class="mt-1 inline-flex max-w-full items-center gap-1 break-all text-sm underline"
            [href]="link"
            target="_blank"
            rel="noopener noreferrer"
            >{{ source().title }}
            <ng-icon
              name="lucideExternalLink"
              class="size-3 shrink-0"
              aria-hidden="true"
          /></a>
        } @else {
          <p class="mt-1 break-all text-sm">{{ source().title }}</p>
        }
        <div class="mt-2 flex flex-wrap gap-1.5">
          <z-badge zType="outline">{{ kind() }}</z-badge>
          @if (visual()) {
            <z-badge zType="secondary">AI visual transcript</z-badge>
          }
          <z-badge zType="outline">{{ lineCount() }} lines</z-badge>
        </div>
      </div>
      <button
        z-button
        zType="outline"
        zSize="sm"
        type="button"
        [zDisabled]="downloading()"
        (click)="downloadRequested.emit()"
      >
        <ng-icon name="lucideDownload" aria-hidden="true" />
        {{ downloading() ? 'Downloading…' : 'Download original' }}
      </button>
    </div>
    @if (downloadFailed()) {
      <p class="mt-2 text-sm text-destructive" role="alert">
        Could not download the captured file. Check the curator key and try
        again.
      </p>
    }
    @if (visual()) {
      <p class="mt-3 text-sm text-muted-foreground">
        Evidence below comes from an AI transcript of the rendered pages.
        Compare table columns, symbols and footnotes with the downloaded
        original before publishing.
      </p>
    }
    @if (warnings().length) {
      <ul class="mt-3 space-y-1.5" aria-label="Coverage notes">
        @for (warning of warnings(); track $index) {
          <li class="flex items-start gap-2 text-sm">
            <ng-icon
              name="lucideTriangleAlert"
              class="mt-0.5 shrink-0 text-warning"
              aria-hidden="true"
            />
            <span>{{ warning }}</span>
          </li>
        }
      </ul>
    }
    <button
      type="button"
      class="mt-3 inline-flex items-center gap-1 rounded text-sm underline focus-visible:outline-2 focus-visible:outline-ring"
      [attr.aria-expanded]="expanded()"
      (click)="expanded.set(!expanded())"
    >
      <ng-icon
        name="lucideChevronDown"
        class="transition-transform"
        [class.rotate-180]="expanded()"
        aria-hidden="true"
      />
      {{ expanded() ? 'Hide' : 'Show' }} captured text
    </button>
    @if (expanded()) {
      <pre
        tabindex="0"
        class="mt-2 max-h-96 overflow-auto rounded-lg bg-muted p-3 text-xs whitespace-pre-wrap"
        >{{ numbered() }}</pre
      >
    }
  `,
})
export class IngestionSourcePane {
  readonly source = input.required<IngestionSourceView>();
  readonly warnings = input<string[]>([]);
  readonly downloading = input(false);
  readonly downloadFailed = input(false);
  readonly downloadRequested = output<void>();

  protected readonly expanded = signal(false);
  protected readonly href = computed(() => safeSourceUrl(this.source().url));
  protected readonly visual = computed(() =>
    this.source().parserVersion.startsWith('specsync-visual-pdf'),
  );
  protected readonly kind = computed(() =>
    this.source().mimeType === 'application/pdf' ? 'PDF' : 'HTML page',
  );
  protected readonly lineCount = computed(
    () => this.source().text.split('\n').length,
  );
  protected readonly numbered = computed(() =>
    this.source()
      .text.split('\n')
      .map((line, index) => `${String(index + 1).padStart(4, ' ')}  ${line}`)
      .join('\n'),
  );
}
