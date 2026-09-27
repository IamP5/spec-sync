import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  viewChild,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideArrowLeft } from '@ng-icons/lucide';

import { ZardButtonComponent } from '@/ui/components/button';

import type {
  IngestionLaunchPrefill,
  IngestionRun,
} from '../data/ingestion-contracts';
import { VehicleIngestionLaunchEdit } from './vehicle-ingestion-launch-edit';
import { VehicleIngestionRunDetail } from './vehicle-ingestion-run-detail';
import { VehicleIngestionSearch } from './vehicle-ingestion-search';

/**
 * Curator workspace at `/ingestion` (new import and recent imports) and
 * `/ingestion/<runId>` (one run). Every request carries the signed-in user's
 * ID token; the API decides by the token's roles whether the account may
 * curate, and its 401/403 answers are explained where they surface.
 */
@Component({
  selector: 'app-vehicle-ingestion-page',
  imports: [
    NgIcon,
    RouterLink,
    VehicleIngestionLaunchEdit,
    VehicleIngestionRunDetail,
    VehicleIngestionSearch,
    ZardButtonComponent,
  ],
  viewProviders: [provideIcons({ lucideArrowLeft })],
  templateUrl: './vehicle-ingestion-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block h-full overflow-y-auto' },
})
export class VehicleIngestionPage {
  readonly runId = input<string>();
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly search = viewChild(VehicleIngestionSearch);

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

  protected async onStarted(run: IngestionRun): Promise<void> {
    this.search()?.reload();
    await this.router.navigate(['/ingestion', run.id]);
  }

  protected async open(id: string): Promise<void> {
    await this.router.navigate(['/ingestion', id]);
  }
}
