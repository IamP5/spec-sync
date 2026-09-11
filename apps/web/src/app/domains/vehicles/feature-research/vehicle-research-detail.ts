import { BreakpointObserver } from '@angular/cdk/layout';
import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  linkedSignal,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  form,
  FormField,
  maxLength,
  required,
  validate,
} from '@angular/forms/signals';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideX } from '@ng-icons/lucide';

import { ZardButtonComponent } from '@/ui/components/button';
import {
  ZardDrawerComponent,
  ZardDrawerTitleComponent,
} from '@/ui/components/drawer';
import { ZardInputComponent } from '@/ui/components/input';

import type { IngestionRunSummary } from '../data/ingestion-contracts';
import { researchContactUrlSchema } from '../data/research-contracts';
import type { ResearchEvidenceFocus } from '../data/research-presentation';
import { VehicleIngestionRunDetail } from '../feature-ingestion';
import { ResearchDetailStore } from './research-detail-store';
import { ResearchInterestDetailStore } from './research-interest-detail-store';
import { ResearchInterestSearchStore } from './research-interest-search-store';
import { ResearchComparisonPane } from './ui/research-comparison-pane';
import { ResearchResultPane } from './ui/research-result-pane';

@Component({
  selector: 'app-vehicle-research-detail',
  imports: [
    VehicleIngestionRunDetail,
    FormField,
    ZardInputComponent,
    ResearchComparisonPane,
    ResearchResultPane,
    ZardButtonComponent,
    ZardDrawerComponent,
    ZardDrawerTitleComponent,
    NgIcon,
  ],
  providers: [
    ResearchDetailStore,
    ResearchInterestSearchStore,
    ResearchInterestDetailStore,
  ],
  viewProviders: [provideIcons({ lucideX })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block min-w-0 w-full' },
  templateUrl: './vehicle-research-detail.html',
})
export class VehicleResearchDetail {
  protected readonly refreshFailed = $localize`The progress could not be updated. The research continues; we will try again.`;
  protected readonly backToResults = $localize`Back to the research results`;
  protected readonly seePublication = $localize`See the catalog publication`;
  protected readonly reviewAndImport = $localize`Review and import into the catalog`;
  protected readonly evidenceTitle = $localize`Research evidence`;
  protected readonly peopleTitle = $localize`Interested people`;
  protected readonly myProfileTitle = $localize`Your profile on this research`;
  protected readonly joinTitle = $localize`Join the conversation`;
  protected readonly profileShared = $localize`Profile shared.`;
  protected readonly profileRemoved = $localize`Your profile was removed.`;
  protected readonly savingLabel = $localize`Saving…`;
  protected readonly saveProfileLabel = $localize`Save profile`;
  protected readonly shareProfileLabel = $localize`Share my profile`;

  protected contactLabel(name: string): string {
    return $localize`Open ${name}:name:'s contact in another tab`;
  }

  protected readonly people = inject(ResearchInterestSearchStore);
  protected readonly participation = inject(ResearchInterestDetailStore);
  protected readonly profileModel = linkedSignal({
    source: () => this.people.view()?.mine,
    computation: (mine) => ({
      name: mine?.name ?? '',
      contactUrl: mine?.contactUrl ?? '',
      consent: false,
    }),
  });
  protected readonly profileForm = form(this.profileModel, (p) => {
    required(p.name);
    maxLength(p.name, 80);
    required(p.contactUrl);
    maxLength(p.contactUrl, 500);
    validate(p.contactUrl, ({ value }) =>
      researchContactUrlSchema.safeParse(value().trim()).success
        ? undefined
        : { kind: 'https', message: 'Use um link HTTPS completo.' },
    );
  });
  protected shareProfile(): void {
    if (this.profileForm().invalid() || !this.profileModel().consent) return;
    const { name, contactUrl } = this.profileModel();
    this.participation.submit({
      visible: true,
      name: name.trim(),
      contactUrl: contactUrl.trim(),
    });
  }
  readonly requestId = input.required<string>();
  readonly reviewInitiallyOpen = input(false);
  protected readonly reviewOpen = linkedSignal({
    source: () => `${this.requestId()}:${this.reviewInitiallyOpen()}`,
    computation: () => this.reviewInitiallyOpen(),
  });
  protected reviewed(run: IngestionRunSummary): void {
    if (run.status === 'PUBLISHED' && this.store.view()?.status !== 'PUBLISHED')
      this.store.reload();
  }
  protected readonly store = inject(ResearchDetailStore);
  protected readonly mobileScreen = toSignal(
    inject(BreakpointObserver).observe('(max-width: 767px)'),
    { initialValue: { matches: false, breakpoints: {} } },
  );
  protected readonly detailsOpen = linkedSignal({
    source: () => this.store.view()?.id,
    computation: () => false,
  });
  protected readonly detailsKind = linkedSignal<
    string | undefined,
    'evidence' | 'people'
  >({ source: () => this.store.view()?.id, computation: () => 'evidence' });

  constructor() {
    effect(() => {
      const id =
        this.detailsOpen() && this.detailsKind() === 'people'
          ? (this.store.view()?.id ?? '')
          : '';
      untracked(() => {
        this.people.load(id);
        this.participation.load(id);
      });
    });
    effect(() => {
      const id = this.requestId();
      const scope = this.store.sessionScope();
      untracked(() => this.store.load(scope ? id : ''));
    });
  }
  protected readonly evidenceFocus = linkedSignal<
    string | undefined,
    ResearchEvidenceFocus | null
  >({ source: () => this.store.view()?.id, computation: () => null });
  protected openEvidence(focus: ResearchEvidenceFocus | null): void {
    this.evidenceFocus.set(focus);
    this.openDetails('evidence');
  }
  protected openDetails(kind: 'evidence' | 'people'): void {
    this.detailsKind.set(kind);
    this.detailsOpen.set(true);
  }
  protected closeDetails(): void {
    this.detailsOpen.set(false);
  }
}
