import { act, render, screen } from '@testing-library/react-native';

import type {
  CatalogPage,
  VehicleConfiguration,
} from '../../../vehicles/api/contracts';
import type { ToolCallView } from '../../data/tool-call';
import {
  VEHICLE_WORKSPACE_CATALOG_ID,
  type VehicleWorkspaceTile,
} from '../../data/vehicle-workspace-contracts';
import { ChatVehicleWorkspaceOverview } from './chat-vehicle-workspace-overview';

// The vehicle features are exercised in their own specs; here they only
// record what the workspace hands them.
interface CatalogProps {
  page?: CatalogPage;
  shortlist?: VehicleConfiguration[];
  onShortlistChange?: (vehicles: VehicleConfiguration[]) => void;
  onCompare: (vehicles: VehicleConfiguration[]) => void;
}
const catalogs: CatalogProps[] = [];
jest.mock('../../../vehicles/api/features', () => ({
  VehicleCatalogOverview: (props: CatalogProps) => {
    catalogs.push(props);
    return null;
  },
  VehicleComparisonOverview: () => null,
}));
jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn() }));
// Reanimated has no native side under jest.
jest.mock('../../../../design-system/components/ui/skeleton', () => ({
  Skeleton: () => null,
}));

const surfaceId = 'workspace-08e08761-a2e7-5ae5-b2ad-387e93829fb7';
const ids = [
  '08e08761-a2e7-5ae5-b2ad-387e93829fb7',
  'f94a2350-0a1a-5ad3-aef8-3c0c472c72a1',
];
const vehicles = ids.map((id, index) => ({
  id,
  brand: 'Ford',
  model: 'Ranger',
  name: index ? 'Limited' : 'Black',
  market: 'BR',
  modelYear: 2026,
  identityStatus: 'CONFIRMED',
  identityNote: null,
  identityEvidenceId: null,
}));

function catalogTile(title: string): VehicleWorkspaceTile {
  return {
    type: 'catalog',
    title,
    args: { q: 'Ranger', limit: 6, offset: 0 },
    result: { items: vehicles, limit: 6, offset: 0, hasMore: false },
  };
}

function workspaceResult(tiles: VehicleWorkspaceTile[], status = 'OK') {
  return JSON.stringify({
    status,
    title: 'Ranger research',
    operations: [
      {
        version: 'v0.9',
        createSurface: { surfaceId, catalogId: VEHICLE_WORKSPACE_CATALOG_ID },
      },
      {
        version: 'v0.9',
        updateComponents: {
          surfaceId,
          components: [
            {
              id: 'root',
              component: 'Column',
              children: tiles.map((_, index) => `tile-${index}`),
            },
            ...tiles.map((_, index) => ({
              id: `tile-${index}`,
              component: 'VehicleCatalog',
              data: { path: `/tiles/${index}` },
            })),
          ],
        },
      },
      {
        version: 'v0.9',
        updateDataModel: { surfaceId, path: '/', value: { tiles } },
      },
    ],
  });
}

function call(overrides: Partial<ToolCallView>): ToolCallView {
  return {
    id: 'call-1',
    name: 'renderVehicleWorkspace',
    args: {},
    status: 'complete',
    ...overrides,
  };
}

const actions = { draft: jest.fn(), send: jest.fn(), canSend: true };

describe('ChatVehicleWorkspaceOverview', () => {
  beforeEach(() => {
    catalogs.length = 0;
    actions.send.mockReset();
    actions.draft.mockReset();
  });

  it('announces the building state and recovers from malformed results', () => {
    const { rerender } = render(
      <ChatVehicleWorkspaceOverview
        call={call({ status: 'executing' })}
        actions={actions}
      />,
    );
    expect(screen.getByText('Building your vehicle workspace…')).toBeTruthy();
    rerender(
      <ChatVehicleWorkspaceOverview
        call={call({ result: '{"operations":[' })}
        actions={actions}
      />,
    );
    expect(
      screen.getByText('This workspace could not be displayed.'),
    ).toBeTruthy();
  });

  it('shares one shortlist across catalogs, capped at the known configurations', () => {
    render(
      <ChatVehicleWorkspaceOverview
        call={call({
          result: workspaceResult([catalogTile('One'), catalogTile('Two')]),
        })}
        actions={actions}
      />,
    );
    expect(screen.getByText('Ranger research')).toBeTruthy();
    expect(catalogs).toHaveLength(2);
    act(() => {
      catalogs[0]?.onShortlistChange?.([
        vehicles[0] as VehicleConfiguration,
        { ...(vehicles[0] as VehicleConfiguration), id: 'invented' },
      ]);
    });
    const latest = catalogs.slice(-2);
    expect(latest.map(({ shortlist }) => shortlist)).toEqual([
      [vehicles[0]],
      [vehicles[0]],
    ]);
    latest[1]?.onCompare(vehicles);
    expect(actions.send).toHaveBeenCalledWith(
      expect.stringContaining('Compare these exact catalog configurations'),
    );
  });

  it('drafts the comparison and says so when the conversation cannot send', () => {
    render(
      <ChatVehicleWorkspaceOverview
        call={call({ result: workspaceResult([catalogTile('One')]) })}
        actions={{ ...actions, canSend: false }}
      />,
    );
    expect(
      screen.getByText(/Sending a follow-up will be available/),
    ).toBeTruthy();
    catalogs[0]?.onCompare(vehicles);
    expect(actions.send).not.toHaveBeenCalled();
    expect(actions.draft).toHaveBeenCalled();
  });
});
