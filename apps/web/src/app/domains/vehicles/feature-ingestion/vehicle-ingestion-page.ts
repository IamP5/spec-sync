import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { form, FormField, required } from '@angular/forms/signals';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArrowLeft,
  lucideKeyRound,
  lucideLogOut,
} from '@ng-icons/lucide';

import { ZardButtonComponent } from '@/ui/components/button';
import { ZardInputComponent } from '@/ui/components/input';

import type {
  IngestionLaunchPrefill,
  IngestionRun,
} from '../data/ingestion-contracts';
import { IngestionDetailStore } from './ingestion-detail-store';
import { VehicleIngestionLaunchEdit } from './vehicle-ingestion-launch-edit';
import { VehicleIngestionRunDetail } from './vehicle-ingestion-run-detail';
import { VehicleIngestionSearch } from './vehicle-ingestion-search';

/**
 * Curator workspace at `/ingestion` (new import and recent imports) and
 * `/ingestion/<runId>` (one run). The curator key lives in the session
 * client, so the page, the chat cards and every store share it.
 */
@Component({
  selector: 'app-vehicle-ingestion-page',
  imports: [
    FormField,
    NgIcon,
    RouterLink,
    VehicleIngestionLaunchEdit,
    VehicleIngestionRunDetail,
    VehicleIngestionSearch,
    ZardButtonComponent,
    ZardInputComponent,
  ],
  providers: [IngestionDetailStore],
  viewProviders: [
    provideIcons({ lucideArrowLeft, lucideKeyRound, lucideLogOut }),
  ],
  templateUrl: './vehicle-ingestion-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block h-full overflow-y-auto' },
})
export class VehicleIngestionPage {
  readonly runId = input<string>();
  private readonly session = inject(IngestionDetailStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly search = viewChild(VehicleIngestionSearch);

  protected readonly hasKey = this.session.hasKey;
  protected readonly keyModel = signal({ key: '' });
  protected readonly keyForm = form(this.keyModel, (p) => required(p.key));
  /** Prefill handed over by the chat's `prepareVehicleIngestion` link. */
  protected readonly prefill = computed<IngestionLaunchPrefill>(() => {
    const params = this.route.snapshot.queryParamMap;
    const year = Number(params.get('modelYear'));
    return {
      sourceUrl: params.get('sourceUrl') ?? undefined,
      brand: params.get('brand') ?? undefined,
      model: params.get('model') ?? undefined,
      modelYear: Number.isInteger(year) && year > 0 ? year : undefined,
      configurations: (params.get('configurations') ?? '')
        .split('\n')
        .map((name) => name.trim())
        .filter(Boolean),
    };
  });

  protected connect(event: Event): void {
    event.preventDefault();
    if (this.keyForm().invalid()) return;
    this.session.setKey(this.keyModel().key);
    this.keyModel.set({ key: '' });
  }

  protected disconnect(): void {
    this.session.setKey('');
  }

  protected async onStarted(run: IngestionRun): Promise<void> {
    this.search()?.reload();
    await this.router.navigate(['/ingestion', run.id]);
  }

  protected async open(id: string): Promise<void> {
    await this.router.navigate(['/ingestion', id]);
  }
}
