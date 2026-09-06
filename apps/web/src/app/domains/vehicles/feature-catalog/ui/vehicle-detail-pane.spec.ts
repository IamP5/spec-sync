import { ComponentFixture, TestBed } from '@angular/core/testing';

import type {
  Comparison,
  VehicleConfiguration,
} from '../../data/vehicle-contracts';
import { VehicleDetailPane } from './vehicle-detail-pane';

describe('VehicleDetailPane', () => {
  let fixture: ComponentFixture<VehicleDetailPane>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VehicleDetailPane],
    }).compileComponents();

    fixture = TestBed.createComponent(VehicleDetailPane);
    fixture.componentRef.setInput('vehicle', vehicle);
    fixture.componentRef.setInput('comparison', comparison);
    await fixture.whenStable();
  });

  it('presents the prototype hierarchy without flattening catalog uncertainty', async () => {
    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Ford');
    expect(element.textContent).toContain('Ranger');
    expect(element.textContent).toContain('Black');
    expect(element.textContent).toContain('Provisional identity');
    expect(element.textContent).toContain('R$ 242.600');
    expect(element.textContent).toContain(
      'Source observation effective 2026-01-01 · current price verified',
    );
    expect(element.textContent).toContain('Catalog confidence');
    expect(element.textContent).toContain(
      '3 of 5 shown attributes have accepted observations',
    );

    buttonNamed(element, 'Specifications').click();
    await fixture.whenStable();
    expect(element.textContent).toContain('Conflicting');
    expect(element.textContent).toContain('Not reported');
    expect(element.textContent).toContain('Optional');
    expect(
      element.querySelector('[aria-label="Conflicting observations"]'),
    ).toBeTruthy();

    buttonNamed(element, 'Evidence').click();
    await fixture.whenStable();
    expect(element.textContent).toContain(
      'Curated notes, not OEM verification',
    );
    expect(element.textContent).toContain('Price list excerpt');
    expect(element.querySelector<HTMLAnchorElement>('a')?.href).toBe(
      'https://example.com/ranger-price',
    );
    expect(element.textContent).toContain('Media contract missing');
  });

  it('emits close, retry, and ask intents from the panel controls', async () => {
    const component = fixture.componentInstance;
    const element = fixture.nativeElement as HTMLElement;
    const closed = vi.fn();
    const retried = vi.fn();
    const asked = vi.fn();
    component.closed.subscribe(closed);
    component.retried.subscribe(retried);
    component.askRequested.subscribe(asked);

    element
      .querySelector<HTMLButtonElement>('[aria-label="Close vehicle details"]')
      ?.click();
    element
      .querySelector<HTMLButtonElement>('[data-action="ask-about-vehicle"]')
      ?.click();
    fixture.componentRef.setInput('failed', true);
    await fixture.whenStable();
    buttonNamed(element, 'Try again').click();

    expect(closed).toHaveBeenCalledOnce();
    expect(asked).toHaveBeenCalledOnce();
    expect(retried).toHaveBeenCalledOnce();
  });
});

const CONFIGURATION_ID = '08e08761-a2e7-5ae5-b2ad-387e93829fb7';

const vehicle: VehicleConfiguration = {
  id: CONFIGURATION_ID,
  brand: 'Ford',
  model: 'Ranger',
  name: 'Black',
  market: 'BR',
  modelYear: 2026,
  identityStatus: 'PROVISIONAL',
  identityNote: 'Trim identity was resolved from a curated source note.',
  identityEvidenceId: null,
};

const comparison: Comparison = {
  configurations: [vehicle],
  rows: [
    knownRow('reference_price', 'Reference price', 'BRL', 242_600, {
      current_price_verified: true,
      effective_on: '2026-01-01',
    }),
    knownRow('power_max', 'Power', 'cv', 170),
    conflictingRow('torque_max', 'Torque', 'Nm'),
    notReportedRow('drivetrain', 'Drivetrain'),
    knownRow('camera_360', '360 camera', null, null, {}, 'OPTIONAL'),
  ],
};

function knownRow(
  code: string,
  label: string,
  unit: string | null,
  value: number | string | null,
  qualifiers: Record<string, unknown> = {},
  availability: 'OPTIONAL' | null = null,
): Comparison['rows'][number] {
  const observationId = crypto.randomUUID();
  return {
    attribute: {
      id: crypto.randomUUID(),
      code,
      label,
      description: null,
      valueType: availability ? 'AVAILABILITY' : 'NUMBER',
      unit,
    },
    cells: [
      {
        configurationId: CONFIGURATION_ID,
        knowledgeStatus: 'KNOWN',
        reason: null,
        selectedObservationId: observationId,
        observations: [
          {
            id: observationId,
            value,
            availability,
            qualifiers,
            rawValue: null,
            reviewStatus: 'ACCEPTED',
            evidence:
              code === 'reference_price'
                ? [
                    {
                      id: crypto.randomUUID(),
                      sourceRevisionId: crypto.randomUUID(),
                      title: 'Ford Ranger price list',
                      path: 'catalog/ranger.md',
                      sha256: 'abc123',
                      provenance: 'CURATED_NOTE',
                      capturedOn: '2026-01-02',
                      publishedOn: null,
                      upstreamUrls: [
                        'https://example.com/ranger-price',
                        'javascript:alert(1)',
                      ],
                      lineStart: 12,
                      lineEnd: 12,
                      locator: 'line 12',
                      excerpt: 'Price list excerpt',
                    },
                  ]
                : [],
          },
        ],
      },
    ],
  };
}

function conflictingRow(
  code: string,
  label: string,
  unit: string,
): Comparison['rows'][number] {
  return {
    attribute: {
      id: crypto.randomUUID(),
      code,
      label,
      description: null,
      valueType: 'NUMBER',
      unit,
    },
    cells: [
      {
        configurationId: CONFIGURATION_ID,
        knowledgeStatus: 'CONFLICTING',
        reason: 'Sources disagree on maximum torque.',
        selectedObservationId: null,
        observations: [observation(405), observation(420)],
      },
    ],
  };
}

function observation(value: number) {
  return {
    id: crypto.randomUUID(),
    value,
    availability: null,
    qualifiers: {},
    rawValue: null,
    reviewStatus: 'ACCEPTED',
    evidence: [],
  };
}

function notReportedRow(
  code: string,
  label: string,
): Comparison['rows'][number] {
  return {
    attribute: {
      id: crypto.randomUUID(),
      code,
      label,
      description: null,
      valueType: 'TEXT',
      unit: null,
    },
    cells: [
      {
        configurationId: CONFIGURATION_ID,
        knowledgeStatus: 'NOT_REPORTED',
        reason: null,
        selectedObservationId: null,
        observations: [],
      },
    ],
  };
}

function buttonNamed(element: HTMLElement, name: string): HTMLButtonElement {
  const button = [
    ...element.querySelectorAll<HTMLButtonElement>('button'),
  ].find((candidate) => candidate.textContent?.includes(name));
  if (!button) throw new Error(`Button ${name} was not rendered`);
  return button;
}
