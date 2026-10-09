import { fireEvent, render, screen } from '@testing-library/react-native';

import type {
  Comparison,
  VehicleConfiguration,
} from '../../data/vehicle-contracts';
import {
  detailEvidence,
  detailFacts,
  factByCode,
  referencePriceContext,
  splitReportedFacts,
} from '../vehicle-detail-presentation';
import { VehicleDetailPane } from './vehicle-detail-pane';

// The skeleton animates through Reanimated, whose native part jest lacks.
jest.mock('../../../../design-system/components/ui/skeleton', () => ({
  Skeleton: () => null,
}));

const CONFIGURATION_ID = '08e08761-a2e7-5ae5-b2ad-387e93829fb7';
let sequence = 0;
function uuid(): string {
  sequence += 1;
  return `00000000-0000-4000-8000-${String(sequence).padStart(12, '0')}`;
}

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

function observation(
  value: number | string | null,
  qualifiers: Record<string, unknown> = {},
  availability: 'OPTIONAL' | null = null,
  withEvidence = false,
) {
  return {
    id: uuid(),
    value,
    availability,
    qualifiers,
    rawValue: null,
    reviewStatus: 'ACCEPTED',
    evidence: withEvidence
      ? [
          {
            id: uuid(),
            sourceRevisionId: uuid(),
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
  };
}

function attribute(code: string, label: string, unit: string | null) {
  return {
    id: uuid(),
    code,
    label,
    description: null,
    valueType: 'NUMBER' as const,
    unit,
  };
}

function knownRow(
  code: string,
  label: string,
  unit: string | null,
  value: number | string | null,
  qualifiers: Record<string, unknown> = {},
  availability: 'OPTIONAL' | null = null,
): Comparison['rows'][number] {
  const accepted = observation(
    value,
    qualifiers,
    availability,
    code === 'reference_price',
  );
  return {
    attribute: attribute(code, label, unit),
    cells: [
      {
        configurationId: CONFIGURATION_ID,
        knowledgeStatus: 'KNOWN',
        reason: null,
        selectedObservationId: accepted.id,
        observations: [accepted],
      },
    ],
  };
}

const comparison: Comparison = {
  configurations: [vehicle],
  rows: [
    knownRow('reference_price', 'Reference price', 'BRL', 242_600, {
      current_price_verified: true,
      effective_on: '2026-01-01',
    }),
    knownRow('power_max', 'Power', 'cv', 170),
    {
      attribute: attribute('torque_max', 'Torque', 'Nm'),
      cells: [
        {
          configurationId: CONFIGURATION_ID,
          knowledgeStatus: 'CONFLICTING',
          reason: 'Sources disagree on maximum torque.',
          selectedObservationId: null,
          observations: [observation(405), observation(420)],
        },
      ],
    },
    {
      attribute: attribute('drivetrain', 'Drivetrain', null),
      cells: [
        {
          configurationId: CONFIGURATION_ID,
          knowledgeStatus: 'NOT_REPORTED',
          reason: null,
          selectedObservationId: null,
          observations: [],
        },
      ],
    },
    knownRow('camera_360', '360 camera', null, null, {}, 'OPTIONAL'),
  ],
};

describe('vehicle detail presentation', () => {
  it('keeps catalog uncertainty explicit', () => {
    const facts = detailFacts(comparison, CONFIGURATION_ID, 'pt-BR');
    expect(factByCode(facts, 'reference_price').value).toMatch(
      /R\$\s?242\.600/,
    );
    expect(factByCode(facts, 'power_max').value).toBe('170 cv');
    expect(factByCode(facts, 'torque_max')).toMatchObject({
      value: 'Conflicting',
      status: 'conflicting',
      note: 'Sources disagree on maximum torque.',
    });
    expect(factByCode(facts, 'drivetrain')).toMatchObject({
      value: 'Not reported',
      note: 'Missing information does not establish that equipment is absent.',
    });
    expect(factByCode(facts, 'camera_360').value).toBe('Optional');
    expect(factByCode(facts, 'unknown_code').status).toBe('not-reported');
  });

  it('dates the reference price instead of presenting it as current', () => {
    expect(referencePriceContext(comparison, CONFIGURATION_ID)).toBe(
      'Source observation effective 2026-01-01 · current price verified.',
    );
    expect(referencePriceContext(undefined, CONFIGURATION_ID)).toBe(
      'No accepted reference-price observation.',
    );
  });

  it('puts known and conflicting facts before unreported ones', () => {
    const { reported, unreported } = splitReportedFacts(
      detailFacts(comparison, CONFIGURATION_ID, 'pt-BR'),
    );
    expect(reported.map(({ code }) => code)).toEqual([
      'reference_price',
      'power_max',
      'torque_max',
      'camera_360',
    ]);
    expect(unreported.map(({ code }) => code)).toEqual(['drivetrain']);
  });

  it('collects the distinct evidence of the accepted observations', () => {
    expect(
      detailEvidence(comparison, CONFIGURATION_ID).map(({ title }) => title),
    ).toEqual(['Ford Ranger price list']);
  });
});

describe('VehicleDetailPane', () => {
  const handlers = () => ({
    onClose: jest.fn(),
    onRetry: jest.fn(),
    onAsk: jest.fn(),
    onOpenLink: jest.fn(),
  });

  it('presents the hierarchy, the tabs and only safe source links', () => {
    const callbacks = handlers();
    render(
      <VehicleDetailPane
        vehicle={vehicle}
        comparison={comparison}
        loading={false}
        failed={false}
        {...callbacks}
      />,
    );
    expect(screen.getByText('Provisional identity')).toBeTruthy();
    expect(screen.getByText('Ranger')).toBeTruthy();
    expect(
      screen.getByText(
        'Source observation effective 2026-01-01 · current price verified.',
      ),
    ).toBeTruthy();
    expect(screen.getByText('Catalog confidence')).toBeTruthy();
    expect(screen.getByText(/3 of 5 shown attributes/)).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Specifications'));
    expect(screen.getByLabelText('Conflicting observations')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Evidence'));
    expect(
      screen.getByText('Curated notes, not OEM verification'),
    ).toBeTruthy();
    expect(screen.getByText('Price list excerpt')).toBeTruthy();
    expect(screen.getByText('Vehicle photos unavailable')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Source 1'));
    expect(callbacks.onOpenLink).toHaveBeenCalledWith(
      'https://example.com/ranger-price',
    );
    expect(screen.queryByLabelText('Source 2')).toBeNull();
  });

  it('lists reported specifications first and reveals unreported ones on demand', () => {
    render(
      <VehicleDetailPane
        vehicle={vehicle}
        comparison={comparison}
        loading={false}
        failed={false}
        {...handlers()}
      />,
    );
    fireEvent.press(screen.getByLabelText('Specifications'));
    // "Reference price" is also the header's price label.
    for (const label of ['Power', 'Torque', '360 camera'])
      expect(screen.getByText(label)).toBeTruthy();
    expect(screen.queryByText('Drivetrain')).toBeNull();

    fireEvent.press(
      screen.getByLabelText('Show unavailable specifications (1)'),
    );
    expect(screen.getByText('Drivetrain')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Hide unavailable specifications'));
    expect(screen.queryByText('Drivetrain')).toBeNull();
  });

  it('emits close, ask and retry intentions', () => {
    const callbacks = handlers();
    const { rerender } = render(
      <VehicleDetailPane
        vehicle={vehicle}
        comparison={comparison}
        loading={false}
        failed={false}
        {...callbacks}
      />,
    );
    fireEvent.press(screen.getByLabelText('Close vehicle details'));
    fireEvent.press(screen.getByLabelText('Ask about this vehicle'));
    rerender(
      <VehicleDetailPane
        vehicle={vehicle}
        loading={false}
        failed
        {...callbacks}
      />,
    );
    fireEvent.press(screen.getByLabelText('Try again'));
    expect(callbacks.onClose).toHaveBeenCalledTimes(1);
    expect(callbacks.onAsk).toHaveBeenCalledTimes(1);
    expect(callbacks.onRetry).toHaveBeenCalledTimes(1);
  });
});
