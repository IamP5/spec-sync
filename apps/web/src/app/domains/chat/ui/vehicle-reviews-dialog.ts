import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { form, FormField } from '@angular/forms/signals';

import { ZardBadgeComponent } from '@/ui/components/badge';
import { ZardButtonComponent } from '@/ui/components/button';
import { injectDialogData, ZardDialogRef } from '@/ui/components/dialog';
import { ZardInputComponent } from '@/ui/components/input';
import { ZardSkeletonComponent } from '@/ui/components/skeleton';

import { cellObservations, displayValue } from '../data/vehicle-comparison';
import type { Comparison } from '../data/vehicle-contracts';
import {
  type RelatedReview,
  reviewMedia,
  reviewPrompt,
  reviewUrl,
} from '../data/vehicle-reviews';
import { VehicleReviewsSearchStore } from './vehicle-reviews-search-store';

export interface VehicleReviewsDialogData {
  comparison: Comparison;
  row: Comparison['rows'][number];
  configurationId?: string;
  draft: (prompt: string) => void;
}
@Component({
  selector: 'app-vehicle-reviews-dialog',
  imports: [
    FormField,
    ZardBadgeComponent,
    ZardButtonComponent,
    ZardInputComponent,
    ZardSkeletonComponent,
  ],
  providers: [VehicleReviewsSearchStore],
  templateUrl: './vehicle-reviews-dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VehicleReviewsDialog {
  protected readonly data = injectDialogData<VehicleReviewsDialogData>();
  protected readonly store = inject(VehicleReviewsSearchStore);
  private readonly ref = inject(ZardDialogRef);
  private pendingPrompt?: string;
  private readonly queryInput =
    viewChild<ElementRef<HTMLInputElement>>('reviewQuery');
  protected readonly filters = signal({
    vehicle: this.data.configurationId ?? '',
    media: '',
    query: '',
  });
  protected readonly filterForm = form(this.filters);
  protected readonly selected = signal<string[]>([]);
  protected readonly items = computed(
    () => this.store.reviewsValue()?.items ?? [],
  );
  protected readonly visible = computed(() =>
    filterReviews(this.items(), this.filters()),
  );
  protected readonly selectedReviews = computed(() =>
    this.items().filter((r) => this.selected().includes(r.id)),
  );
  protected readonly media = computed(() => [
    ...new Set(this.items().map((r) => reviewMedia(r.mediaType))),
  ]);
  protected readonly failedNames = computed(() =>
    failedVehicles(
      this.data.comparison,
      this.store.reviewsValue()?.failedConfigurationIds ?? [],
    ),
  );
  protected readonly format = displayValue;
  protected readonly mediaLabel = reviewMedia;
  protected readonly kindLabel = reviewKind;
  protected readonly link = reviewUrl;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      const prompt = this.pendingPrompt;
      if (prompt) queueMicrotask(() => this.data.draft(prompt));
    });
    this.store.load({
      configurationIds: this.data.comparison.configurations.map((c) => c.id),
      attributeCode: this.data.row.attribute.code,
    });
  }
  protected close() {
    this.ref.close();
  }
  protected toggle(id: string) {
    this.selected.update((ids) =>
      ids.includes(id)
        ? ids.filter((x) => x !== id)
        : ids.length < 8
          ? [...ids, id]
          : ids,
    );
  }
  protected reset() {
    this.filters.set({ vehicle: '', media: '', query: '' });
    this.queryInput()?.nativeElement.focus();
  }
  protected vehicleName(review: RelatedReview) {
    if (review.scope === 'MODEL')
      return 'Sobre o modelo · versão não confirmada';
    return (
      this.data.comparison.configurations.find(
        (c) => c.id === review.configurationId,
      )?.name ?? 'Versão da avaliação'
    );
  }
  protected specification(id: string) {
    const cell = this.data.row.cells.find((c) => c.configurationId === id);
    if (!cell || cell.knowledgeStatus === 'NOT_REPORTED')
      return 'Não informado';
    if (cell.knowledgeStatus === 'CONFLICTING') return 'Dados divergentes';
    return cellObservations(cell)
      .map((o) => {
        const availability = (
          {
            STANDARD: 'De série',
            OPTIONAL: 'Opcional',
            ABSENT: 'Não disponível',
            NOT_APPLICABLE: 'Não se aplica',
          } as Record<string, string>
        )[o.availability ?? ''];
        const value =
          o.value === null
            ? ''
            : `${displayValue(o.value)} ${this.data.row.attribute.unit ?? ''}`.trim();
        const rpm = o.qualifiers['engine_speed_rpm'];
        return [
          value,
          availability,
          typeof rpm === 'number'
            ? `${rpm.toLocaleString('pt-BR')} rpm`
            : undefined,
        ]
          .filter(Boolean)
          .join(' · ');
      })
      .join(' · ');
  }
  protected ask() {
    if (!this.selectedReviews().length) return;
    this.finish(
      reviewPrompt(
        this.data.row.attribute.code,
        this.data.comparison.configurations.map((c) => c.id),
        this.selectedReviews(),
      ),
    );
  }
  protected discover() {
    const configurations = this.data.comparison.configurations.filter(
      (c) => !this.filters().vehicle || c.id === this.filters().vehicle,
    );
    this.finish(
      `Busque artigos, blogs e vídeos sobre ${this.data.row.attribute.label} de ${configurations.map((c) => `${c.brand} ${c.model} ${c.name}, ${c.market} ${c.modelYear} (ID ${c.id})`).join('; ')}. Distinga links descobertos de avaliações já verificadas.`,
    );
  }
  private finish(prompt: string) {
    // Run after Zard restores the trigger's focus, so the composer receives focus last.
    this.pendingPrompt = prompt;
    this.ref.close();
  }
}
function filterReviews(
  items: RelatedReview[],
  filters: { vehicle: string; media: string; query: string },
) {
  const query = filters.query.trim().toLocaleLowerCase();
  return items.filter(
    (r) =>
      (!filters.vehicle ||
        r.relatedConfigurationIds.includes(filters.vehicle)) &&
      (!filters.media || reviewMedia(r.mediaType) === filters.media) &&
      `${r.title} ${r.author ?? ''} ${r.excerpt} ${displayValue(r.conditions)}`
        .toLocaleLowerCase()
        .includes(query),
  );
}
function failedVehicles(comparison: Comparison, ids: string[]) {
  return comparison.configurations
    .filter((c) => ids.includes(c.id))
    .map((c) => c.name)
    .join(', ');
}

function reviewKind(kind: string | null | undefined) {
  return (
    (
      {
        OPINION: 'Opinião do avaliador',
        MEASUREMENT: 'Medição do avaliador',
        REPORTED_SPEC: 'Especificação citada no relato',
        OWNER_EXPERIENCE: 'Experiência de proprietário',
      } as Record<string, string>
    )[kind ?? ''] ?? 'Relato'
  );
}
