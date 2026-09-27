import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';

import {
  loadHighlights,
  loadSpecifications,
  searchConfigurations,
} from '../data/vehicle-catalog-client';
import type {
  CatalogPage,
  VehicleConfiguration,
} from '../data/vehicle-contracts';
import { VehicleCatalogOverview } from './vehicle-catalog-overview';

jest.mock('../data/vehicle-catalog-client', () => ({
  loadHighlights: jest.fn(),
  loadSpecifications: jest.fn(),
  searchConfigurations: jest.fn(),
}));
// Reanimated and the portal-based select have no native side under jest.
jest.mock('../../../design-system/components/ui/skeleton', () => ({
  Skeleton: () => null,
}));
jest.mock('../../../design-system/components/ui/select', () => ({
  Select: ({ children }: { children: unknown }) => children,
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: () => null,
  SelectItem: () => null,
}));
jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn() }));

const ids = [
  '08e08761-a2e7-5ae5-b2ad-387e93829fb7',
  'f94a2350-0a1a-5ad3-aef8-3c0c472c72a1',
  '1c5f0a50-4c1e-5d8e-9a0e-0d6a2b7c9e11',
  '2d6f1b61-5d2f-5e9f-8b1f-1e7b3c8d0f22',
];

function vehicle(index: number, model: string, name: string) {
  return {
    id: ids[index] ?? '',
    brand: 'Ford',
    model,
    name,
    market: 'BR',
    modelYear: 2026,
    identityStatus: 'CONFIRMED',
    identityNote: null,
    identityEvidenceId: null,
  } satisfies VehicleConfiguration;
}

const black = vehicle(0, 'Ranger', 'Black');
const limited = vehicle(1, 'Ranger', 'Limited');
const maverick = vehicle(2, 'Maverick', 'Lariat');
const page: CatalogPage = {
  items: [black, limited],
  limit: 20,
  offset: 0,
  hasMore: true,
  nextSearches: [{ q: 'Ford', limit: 20, offset: 2 }],
};

function renderCatalog(
  props: Partial<Parameters<typeof VehicleCatalogOverview>[0]> = {},
) {
  const client = new QueryClient({
    // No garbage-collection timers survive the test.
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { gcTime: Infinity },
    },
  });
  const handlers = { onQuestion: jest.fn(), onCompare: jest.fn() };
  render(
    <QueryClientProvider client={client}>
      <VehicleCatalogOverview page={page} complete {...handlers} {...props} />
    </QueryClientProvider>,
  );
  return handlers;
}

describe('VehicleCatalogOverview', () => {
  beforeEach(() => {
    jest.mocked(loadHighlights).mockResolvedValue({
      configurations: [],
      rows: [],
    });
    jest.mocked(loadSpecifications).mockResolvedValue({
      configurations: [],
      rows: [],
    });
    jest.mocked(searchConfigurations).mockReset();
  });

  it('loads the next catalog page in place without asking the agent', async () => {
    jest.mocked(searchConfigurations).mockResolvedValue({
      // An already listed configuration is not repeated.
      items: [limited, maverick],
      limit: 20,
      offset: 2,
      hasMore: false,
    });
    const handlers = renderCatalog();
    expect(screen.getByText(/showing 2 of 2 loaded/)).toBeTruthy();

    await act(async () => {
      // The strip's end card and the footer both offer the next page.
      fireEvent.press(
        screen.getAllByLabelText('Load next 20 from the catalog')[0],
      );
    });

    await waitFor(() =>
      expect(screen.getByText(/showing 3 of 3 loaded/)).toBeTruthy(),
    );
    expect(searchConfigurations).toHaveBeenCalledWith({
      q: 'Ford',
      limit: 20,
      offset: 2,
    });
    expect(
      screen.queryAllByLabelText('Load next 20 from the catalog'),
    ).toHaveLength(0);
    expect(handlers.onQuestion).not.toHaveBeenCalled();
    expect(handlers.onCompare).not.toHaveBeenCalled();
  });

  it('reports a failed next page and keeps the loaded catalog', async () => {
    jest.mocked(searchConfigurations).mockRejectedValue(new Error('503'));
    renderCatalog();
    await act(async () => {
      // The strip's end card and the footer both offer the next page.
      fireEvent.press(
        screen.getAllByLabelText('Load next 20 from the catalog')[0],
      );
    });
    await waitFor(() =>
      expect(
        screen.getByText('Could not load more of the catalog.'),
      ).toBeTruthy(),
    );
    expect(screen.getByText(/showing 2 of 2 loaded/)).toBeTruthy();
  });

  it('narrows to a model family and clears it when selected again', async () => {
    renderCatalog({
      page: { ...page, items: [black, limited, maverick], hasMore: false },
    });
    await act(async () => {
      fireEvent.press(screen.getByLabelText('Maverick, 1 configurations'));
    });
    expect(screen.getByText(/showing 1 of 1 loaded/)).toBeTruthy();
    await act(async () => {
      fireEvent.press(screen.getByLabelText('Maverick, 1 configurations'));
    });
    expect(screen.getByText(/showing 3 of 3 loaded/)).toBeTruthy();
  });

  it('compares only the explicit shortlist', async () => {
    const handlers = renderCatalog();
    await act(async () => {
      fireEvent.press(screen.getByLabelText('Add Ranger Black to comparison'));
    });
    expect(
      screen.getByLabelText('Compare in chat').props.accessibilityState,
    ).toMatchObject({ disabled: true });
    await act(async () => {
      fireEvent.press(
        screen.getByLabelText('Add Ranger Limited to comparison'),
      );
    });
    await act(async () => {
      fireEvent.press(screen.getByLabelText('Compare in chat'));
    });
    expect(handlers.onCompare).toHaveBeenCalledWith([black, limited]);
  });

  it('asks about the vehicle opened in the detail sheet', async () => {
    const handlers = renderCatalog();
    await act(async () => {
      fireEvent.press(screen.getByLabelText('Open Ford Ranger Black details'));
    });
    await act(async () => {
      fireEvent.press(screen.getByLabelText('Ask about this vehicle'));
    });
    expect(handlers.onQuestion).toHaveBeenCalledWith({
      kind: 'vehicle',
      vehicle: black,
    });
  });
});
