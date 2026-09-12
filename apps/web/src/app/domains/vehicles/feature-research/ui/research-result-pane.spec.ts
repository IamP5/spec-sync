import { TestBed } from '@angular/core/testing';

import {
  researchDraft,
  researchSnapshot,
  researchWithUnmappedFindings,
} from '../../../../testing/research-fixtures';
import { ResearchResultPane } from './research-result-pane';

describe('ResearchResultPane', () => {
  it('opens a selected version and attribute while retaining its original source evidence', async () => {
    const fixture = TestBed.createComponent(ResearchResultPane);
    const draft = researchDraft();
    fixture.componentRef.setInput('research', draft);
    fixture.componentRef.setInput('focus', {
      configuration: draft.configurations[1].name,
      attribute: draft.configurations[1].claims[0].attributeCode,
    });
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelectorAll('[data-configuration]')).toHaveLength(1);
    expect(
      element
        .querySelector('details[data-configuration]')
        ?.getAttribute('open'),
    ).not.toBeNull();
    expect(element.textContent).toContain(
      draft.configurations[1].claims[0].excerpt,
    );
    fixture.componentRef.setInput('focus', null);
    await fixture.whenStable();
    expect(element.querySelectorAll('[data-configuration]')).toHaveLength(2);
  });

  it.each([
    { printed: ['Gasolina'], normalized: ['GASOLINE'], expected: 'Gasolina' },
    {
      printed: ['Gasolina', 'Etanol'],
      normalized: ['GASOLINE', 'ETHANOL'],
      expected: 'Gasolina, Etanol',
    },
    {
      printed: null,
      normalized: ['GASOLINE', 'ETHANOL'],
      expected: 'GASOLINE, ETHANOL',
    },
  ])(
    'displays LIST items as $expected instead of a source heading',
    async ({ printed, normalized, expected }) => {
      const fixture = TestBed.createComponent(ResearchResultPane);
      const draft = researchDraft();
      fixture.componentRef.setInput('research', {
        ...draft,
        configurations: draft.configurations.map((configuration) => ({
          ...configuration,
          claims: [
            {
              ...configuration.claims[0],
              attributeCode: 'fuel_type',
              label: 'Combustível',
              originalTerm: null,
              rawValue: 'Fuel',
              rawUnit: null,
              unit: null,
              listValue: printed,
              value: normalized,
              issues: [],
            },
          ],
        })),
      });
      await fixture.whenStable();
      const values = (fixture.nativeElement as HTMLElement).querySelectorAll(
        '[data-claim-value]',
      );
      expect(values).toHaveLength(2);
      for (const value of values) {
        expect(value.textContent?.trim()).toBe(expected);
        expect(value.textContent).not.toContain('Fuel');
      }
    },
  );

  it('separates proposed terminology from mapped claims and retains original terms and evidence', async () => {
    const fixture = TestBed.createComponent(ResearchResultPane);
    fixture.componentRef.setInput('research', researchWithUnmappedFindings());
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Source term: Potência máxima');
    expect(element.textContent).toContain('Catalog vocabulary revision');
    expect(element.textContent).toContain('numeric-v3');
    const observation = element.querySelector('[data-unmapped-finding]');
    expect(observation?.textContent).toContain('Capacidade de reboque');
    expect(observation?.textContent).toContain('3.492 kg');
    expect(observation?.textContent).toContain('Mapping proposed');
    expect(observation?.textContent).toContain('New catalog field');
    expect(observation?.textContent).toContain('Not specified by the source');
    expect(observation?.textContent).toContain(
      'Page 2, towing row, Limited column',
    );
    expect(observation?.closest('section')?.textContent).toContain(
      'does not accept a vehicle specification into the catalog',
    );
    const summary = element.querySelector('[data-configuration] > summary');
    expect(summary?.textContent).toContain('one mapped finding');
    expect(summary?.textContent).toContain('one awaiting mapping');
    expect(element.querySelectorAll('[aria-label="Power"]')).toHaveLength(2);
  });

  it('translates coded qualifiers and omits a locator that only repeats the cited lines', async () => {
    const fixture = TestBed.createComponent(ResearchResultPane);
    const draft = researchDraft();
    fixture.componentRef.setInput('research', {
      ...draft,
      configurations: draft.configurations.map((configuration) => ({
        ...configuration,
        claims: [
          {
            ...configuration.claims[0],
            qualifiers: { scope: 'model', driverIncluded: 'UNKNOWN' },
            locator: 'line 5',
          },
        ],
      })),
    });
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain(
      'Stated for the whole model range · Driver included: Not stated by the source',
    );
    expect(element.textContent).not.toContain('scope: model');
    expect(element.textContent).toContain('lines 5–6');
    expect(element.textContent).not.toContain('line 5');
  });

  it('distinguishes derived terms from manufacturer wording when no mapping was proposed', async () => {
    const draft = researchWithUnmappedFindings();
    const fixture = TestBed.createComponent(ResearchResultPane);
    fixture.componentRef.setInput('research', {
      ...draft,
      configurations: draft.configurations.map((configuration) => ({
        ...configuration,
        unmappedObservations: configuration.unmappedObservations?.map(
          (observation) => ({
            ...observation,
            termOrigin: 'DERIVED_TEXT',
            proposal: null,
          }),
        ),
      })),
    });
    await fixture.whenStable();
    const observation = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-unmapped-finding]',
    );
    expect(observation?.textContent).toContain(
      "confirm the manufacturer's original wording",
    );
    expect(observation?.textContent).toContain('Catalog mapping needs review');
    expect(observation?.textContent).not.toContain('Mapping proposed');
  });

  it('offers reinterpretation only for completed saved sources and emits an intention', async () => {
    const fixture = TestBed.createComponent(ResearchResultPane);
    fixture.componentRef.setInput('research', researchDraft());
    const replay = vi.fn();
    fixture.componentInstance.replayRequested.subscribe(replay);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const button = [...element.querySelectorAll('button')].find((item) =>
      item.textContent?.includes('Reinterpret saved source'),
    );
    button?.click();
    expect(replay).toHaveBeenCalledOnce();
    fixture.componentRef.setInput('replaying', true);
    await fixture.whenStable();
    expect(button?.disabled).toBe(true);
    expect(button?.textContent).toContain('Starting new interpretation');
    fixture.componentRef.setInput('research', researchSnapshot());
    await fixture.whenStable();
    expect(element.textContent).not.toContain('Reinterpret saved source');
  });

  it('shows all siblings, requested configuration, unreviewed evidence and native accessible controls', async () => {
    const fixture = TestBed.createComponent(ResearchResultPane);
    fixture.componentRef.setInput('research', researchDraft());
    const cancel = vi.fn();
    const refresh = vi.fn();
    fixture.componentInstance.cancelRequested.subscribe(cancel);
    fixture.componentInstance.refreshRequested.subscribe(refresh);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('h2')?.textContent).toContain('Ford Ranger');
    expect(element.textContent).toContain('Joined shared research');
    expect(element.textContent).toContain('Unreviewed source findings');
    expect(element.textContent).toContain(
      'Reliability has not been calibrated',
    );
    expect(element.querySelectorAll('[data-configuration]')).toHaveLength(2);
    expect(
      element.querySelector<HTMLDetailsElement>(
        '[data-configuration="Limited"]',
      )?.open,
    ).toBe(true);
    expect(
      element.querySelector<HTMLDetailsElement>('[data-configuration="XLT"]')
        ?.open,
    ).toBe(false);
    expect(element.textContent).toContain('lines 5–6');
    expect(element.textContent).toContain('Fuel: diesel');
    expect(element.textContent).toContain('Confirm model-year applicability.');
    const source = element.querySelector<HTMLAnchorElement>('a');
    expect(source?.href).toBe('https://example.com/vehicle.pdf');
    expect(source?.rel).toContain('noopener');
    expect(source?.textContent).toContain('opens in a new tab');
    const buttons = [...element.querySelectorAll<HTMLButtonElement>('button')];
    expect(
      buttons.every(
        (button) => button.type === 'button' && !!button.textContent?.trim(),
      ),
    ).toBe(true);
    buttons
      .find((button) => button.textContent?.includes('Stop following'))
      ?.click();
    buttons
      .find((button) => button.textContent?.includes('Refresh research'))
      ?.click();
    expect(cancel).toHaveBeenCalledOnce();
    expect(refresh).toHaveBeenCalledOnce();
  });

  it('explains that detaching leaves other users research running', async () => {
    const fixture = TestBed.createComponent(ResearchResultPane);
    fixture.componentRef.setInput(
      'research',
      researchSnapshot({ requestStatus: 'CANCELLED' }),
    );
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('[role="status"]')?.textContent).toContain(
      'Not following',
    );
    expect(element.textContent).toContain(
      'Shared research can continue for other users',
    );
    expect(
      [...element.querySelectorAll('button')].some((button) =>
        button.textContent?.includes('Stop following'),
      ),
    ).toBe(false);
  });

  it('does not portray every extracted claim as accepted when a reviewed subset was published', async () => {
    const fixture = TestBed.createComponent(ResearchResultPane);
    fixture.componentRef.setInput('research', {
      ...researchDraft(),
      status: 'PUBLISHED',
    });
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'claims outside the published selection',
    );
  });

  it('shows an active retry and readable progress without an obsolete terminal error', async () => {
    const fixture = TestBed.createComponent(ResearchResultPane);
    fixture.componentRef.setInput('research', {
      ...researchDraft(),
      status: 'PROCESSING',
      attempts: 2,
      stage: 'extract-configuration-3',
      error: 'Source processing failed. Submit a new run after three attempts.',
    });
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('[role="status"]')?.textContent).toContain(
      'Retrying research · attempt 2',
    );
    expect(element.textContent).toContain('Extracting specifications');
    expect(element.textContent).toContain('reuses completed work');
    expect(element.textContent).not.toContain('extract-configuration-3');
    expect(element.textContent).not.toContain('Submit a new run');
    expect(element.querySelector('[role="alert"]')).toBeNull();
    expect(element.textContent).toContain('Confirm model-year applicability.');
    expect(element.textContent).toContain('Source coverage ends');
  });

  it('distinguishes a queued retry from an exhausted terminal failure', async () => {
    const fixture = TestBed.createComponent(ResearchResultPane);
    const error =
      'Processing retry limit reached. Submit a new research request.';
    fixture.componentRef.setInput(
      'research',
      researchSnapshot({
        status: 'QUEUED',
        attempts: 1,
        stage: 'queued',
        error,
      }),
    );
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('[role="status"]')?.textContent).toContain(
      'Retry queued after attempt 1',
    );
    expect(element.querySelector('[role="alert"]')).toBeNull();
    fixture.componentRef.setInput(
      'research',
      researchSnapshot({
        status: 'FAILED',
        attempts: 3,
        stage: 'failed',
        error,
      }),
    );
    await fixture.whenStable();
    expect(element.querySelector('[role="status"]')?.textContent).toContain(
      'Research failed',
    );
    expect(element.querySelector('[role="alert"]')?.textContent).toContain(
      error,
    );
    expect(element.textContent).not.toContain('retries automatically');
  });

  it.each([
    ['capture-source', 'Source captured'],
    ['identify-configurations', 'Configurations identified'],
  ])('presents the %s checkpoint in plain language', async (stage, label) => {
    const fixture = TestBed.createComponent(ResearchResultPane);
    fixture.componentRef.setInput('research', researchSnapshot({ stage }));
    await fixture.whenStable();
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('[role="status"]')
        ?.textContent,
    ).toContain(label);
  });

  it('shows revisioned extraction progress without exposing the interpretation hash', async () => {
    const fixture = TestBed.createComponent(ResearchResultPane);
    fixture.componentRef.setInput(
      'research',
      researchSnapshot({
        stage: 'extract-09774cd6189bbe6ef597-configuration-0',
      }),
    );
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('[role="status"]')?.textContent).toContain(
      'Extracting specifications',
    );
    expect(element.textContent).not.toContain('09774cd6189bbe6ef597');
    expect(element.textContent).not.toContain('configuration-0');
  });
});
