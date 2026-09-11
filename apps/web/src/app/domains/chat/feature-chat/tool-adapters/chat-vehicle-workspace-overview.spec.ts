import { provideHttpClient } from '@angular/common/http';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { matrix } from '../../../../testing/vehicle-fixtures';
import { workspaceFixture } from '../../../../testing/vehicle-workspace-fixtures';
import type { VehicleConfiguration } from '../../../vehicles/api/contracts';
import type { VehicleWorkspaceTile } from '../../data/vehicle-workspace-contracts';
import { CHAT_CARD_ACTIONS } from './chat-card-actions';
import { ChatVehicleCatalogOverview } from './chat-vehicle-catalog-overview';
import { ChatVehicleWorkspaceOverview } from './chat-vehicle-workspace-overview';

describe('ChatVehicleWorkspaceOverview', () => {
  const draft = vi.fn();
  const send = vi.fn();
  const canSend = signal(true);
  let fixture: ComponentFixture<ChatVehicleWorkspaceOverview>;

  beforeEach(() => {
    draft.mockReset();
    send.mockReset();
    canSend.set(true);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify(matrix))),
    );
    TestBed.configureTestingModule({
      imports: [ChatVehicleWorkspaceOverview],
      providers: [
        provideHttpClient(),
        { provide: CHAT_CARD_ACTIONS, useValue: { draft, send, canSend } },
      ],
    });
    fixture = TestBed.createComponent(ChatVehicleWorkspaceOverview);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('announces the building state and recovers from incomplete or malformed results', async () => {
    fixture.componentRef.setInput('toolCall', {
      name: 'renderVehicleWorkspace',
      args: {},
      status: 'executing',
      result: undefined,
    });
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(element.querySelector('[role="status"]')?.textContent).toContain(
      'Building your vehicle workspace',
    );
    setResult(fixture, '{"operations":[');
    await fixture.whenStable();
    expect(element.querySelector('[aria-busy="true"]')).toBeNull();
    expect(element.textContent).toContain(
      'This workspace could not be displayed',
    );
    expect(
      element.querySelector('app-chat-vehicle-catalog-overview'),
    ).toBeNull();
  });

  it('renders available sections when one section fails and explains an entirely failed workspace', async () => {
    const failed: VehicleWorkspaceTile = {
      type: 'comparison',
      title: 'Requested comparison',
      args: {
        configurationIds: matrix.configurations.map(({ id }) => id),
        attributes: matrix.rows.map(({ attribute }) => attribute.code),
      },
      result: {
        status: 'ERROR',
        message: 'The comparison service is unavailable.',
        retryable: true,
      },
    };
    setResult(fixture, workspaceFixture([catalogTile(), failed]));
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Some sections could not be loaded');
    expect(element.textContent).toContain('comparison service is unavailable');
    expect(element.querySelectorAll('[data-configuration-id]')).toHaveLength(2);
    setResult(fixture, workspaceFixture([failed]));
    await fixture.whenStable();
    expect(element.textContent).toContain(
      'This workspace could not retrieve its data',
    );
  });

  it('shares the shortlist across catalog panels and sends the selected configurations through chat actions', async () => {
    setResult(
      fixture,
      workspaceFixture([
        catalogTile([matrix.configurations[0]], 'Ranger choices'),
        catalogTile([matrix.configurations[1]], 'Other choices'),
      ]),
    );
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const requests = vi.mocked(fetch).mock.calls.length;
    const panels = [
      ...element.querySelectorAll('app-chat-vehicle-catalog-overview'),
    ];
    panels[0]
      .querySelector<HTMLButtonElement>('[data-action="add-shortlist"]')
      ?.click();
    await fixture.whenStable();
    panels[1]
      .querySelector<HTMLButtonElement>('[data-action="add-shortlist"]')
      ?.click();
    await fixture.whenStable();
    for (const panel of panels)
      expect(panel.textContent).toContain('2 selected');
    const compare = panels[0].querySelector<HTMLButtonElement>(
      '[data-action="compare-shortlist"]',
    );
    expect(compare?.disabled).toBe(false);
    compare?.click();
    expect(send).toHaveBeenCalledOnce();
    expect(send).toHaveBeenCalledWith(
      expect.stringContaining(matrix.configurations[0].id),
    );
    expect(send).toHaveBeenCalledWith(
      expect.stringContaining(matrix.configurations[1].id),
    );
    expect(draft).not.toHaveBeenCalled();
    expect(vi.mocked(fetch).mock.calls.length).toBe(requests);
  });

  it('keeps repeated tool instances independent even when their saved surface IDs match', async () => {
    const second = TestBed.createComponent(ChatVehicleWorkspaceOverview);
    setResult(fixture, workspaceFixture([catalogTile()]));
    setResult(second, workspaceFixture([catalogTile()]));
    await fixture.whenStable();
    await second.whenStable();
    const firstElement = fixture.nativeElement as HTMLElement;
    const secondElement = second.nativeElement as HTMLElement;
    firstElement
      .querySelector<HTMLButtonElement>('[data-action="add-shortlist"]')
      ?.click();
    await fixture.whenStable();
    expect(
      firstElement.querySelectorAll('[data-action="remove-shortlist"]'),
    ).toHaveLength(1);
    expect(
      secondElement.querySelectorAll('[data-action="remove-shortlist"]'),
    ).toHaveLength(0);
    const searchIds = [
      ...firstElement.querySelectorAll('input'),
      ...secondElement.querySelectorAll('input'),
    ].map((input) => input.id);
    expect(new Set(searchIds).size).toBe(searchIds.length);
    second.destroy();
  });

  it('preserves child payload identity, catalog filters, and selection during unrelated transcript updates', async () => {
    const result = JSON.stringify(workspaceFixture([catalogTile()]));
    setResult(fixture, result);
    await fixture.whenStable();
    const child = fixture.debugElement.query(
      By.directive(ChatVehicleCatalogOverview),
    ).componentInstance as ChatVehicleCatalogOverview;
    const previousToolCall = child.toolCall();
    const element = fixture.nativeElement as HTMLElement;
    element
      .querySelector<HTMLButtonElement>('[data-action="add-shortlist"]')
      ?.click();
    await fixture.whenStable();
    const search = element.querySelector<HTMLInputElement>(
      '[data-catalog-search]',
    );
    if (!search) throw new Error('Search input missing');
    search.value = 'Black';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    await fixture.whenStable();
    const requests = vi.mocked(fetch).mock.calls.length;
    setResult(fixture, result);
    await fixture.whenStable();
    expect(child.toolCall()).toBe(previousToolCall);
    expect(search.value).toBe('Black');
    expect(element.querySelectorAll('[data-configuration-id]')).toHaveLength(1);
    expect(
      element.querySelectorAll('[data-action="remove-shortlist"]'),
    ).toHaveLength(1);
    expect(vi.mocked(fetch).mock.calls.length).toBe(requests);
  });

  it('renders revised data for the same surface and removes unavailable configurations from the shortlist', async () => {
    setResult(fixture, workspaceFixture([catalogTile()]));
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    element
      .querySelector<HTMLButtonElement>('[data-action="add-shortlist"]')
      ?.click();
    await fixture.whenStable();
    element
      .querySelector<HTMLButtonElement>('[data-action="add-shortlist"]')
      ?.click();
    await fixture.whenStable();
    expect(element.textContent).toContain('2 selected');
    setResult(
      fixture,
      workspaceFixture([
        catalogTile([{ ...matrix.configurations[1], name: 'Revised Limited' }]),
      ]),
    );
    await fixture.whenStable();
    expect(element.textContent).toContain('Revised Limited');
    expect(element.textContent).toContain('1 selected');
    expect(element.querySelectorAll('[data-configuration-id]')).toHaveLength(1);
    const compare = element.querySelector<HTMLButtonElement>(
      '[data-action="compare-shortlist"]',
    );
    expect(compare?.disabled).toBe(true);
    const search = element.querySelector<HTMLInputElement>(
      '[data-catalog-search]',
    );
    if (!search) throw new Error('Search input missing');
    search.value = 'Limited';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    await fixture.whenStable();
    setResult(
      fixture,
      workspaceFixture(
        [catalogTile()],
        'workspace-f94a2350-0a1a-5ad3-aef8-3c0c472c72a1',
      ),
    );
    await fixture.whenStable();
    expect(
      element.querySelectorAll('[data-action="remove-shortlist"]'),
    ).toHaveLength(0);
    expect(
      element.querySelector<HTMLInputElement>('[data-catalog-search]')?.value,
    ).toBe('');
    expect(
      element.querySelector<HTMLInputElement>('[data-catalog-search]'),
    ).not.toBe(search);
  });

  it('caps the shared shortlist at five configurations', async () => {
    const configurations = Array.from({ length: 6 }, (_, index) => ({
      ...matrix.configurations[0],
      id: crypto.randomUUID(),
      name: `Configuration ${index + 1}`,
    }));
    setResult(
      fixture,
      workspaceFixture([
        catalogTile(configurations.slice(0, 3)),
        catalogTile(configurations.slice(3)),
      ]),
    );
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    for (const button of element.querySelectorAll<HTMLButtonElement>(
      '[data-action="add-shortlist"]',
    )) {
      button.click();
      await fixture.whenStable();
    }
    expect(
      element.querySelectorAll('[data-action="remove-shortlist"]'),
    ).toHaveLength(5);
    expect(element.textContent).toContain('Choose up to 5 configurations');
  });

  it('renders evidence as escaped text and only permits safe source links', async () => {
    setResult(
      fixture,
      workspaceFixture([
        {
          type: 'reviews',
          title: 'Review evidence',
          args: {
            configurationId: matrix.configurations[0].id,
            q: '',
            limit: 4,
          },
          result: {
            status: 'OK',
            message: '',
            projectionVersion: null,
            items: [
              {
                id: '00000000-0000-4000-8000-000000000001',
                evidenceId: '00000000-0000-4000-8000-000000000002',
                scope: 'MODEL',
                title: '<script>bad()</script>',
                excerpt: '<img onerror="bad()">',
                url: 'javascript:bad()',
              },
              {
                id: '00000000-0000-4000-8000-000000000003',
                evidenceId: '00000000-0000-4000-8000-000000000004',
                scope: 'CONFIGURATION',
                title: 'Road test',
                excerpt: 'A sourced passage.',
                url: 'https://example.com/review',
              },
            ],
          },
        },
      ]),
    );
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('script, img')).toBeNull();
    expect(element.textContent).toContain('<script>bad()</script>');
    const links = [...element.querySelectorAll('a')];
    expect(links).toHaveLength(1);
    expect(links[0].href).toBe('https://example.com/review');
    expect(links[0].rel).toContain('noopener');
  });

  it('explains when the current conversation cannot accept follow-up sends', async () => {
    canSend.set(false);
    setResult(fixture, workspaceFixture());
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'when the conversation is ready',
    );
    canSend.set(true);
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain(
      'when the conversation is ready',
    );
  });
});

function catalogTile(
  configurations: VehicleConfiguration[] = matrix.configurations,
  title = 'Catalog choices',
): VehicleWorkspaceTile {
  return {
    type: 'catalog',
    title,
    args: { q: 'Ranger', limit: 6, offset: 0 },
    result: { items: configurations, offset: 0, limit: 6, hasMore: false },
  };
}

function setResult(
  fixture: ComponentFixture<ChatVehicleWorkspaceOverview>,
  result: unknown,
): void {
  fixture.componentRef.setInput('toolCall', {
    name: 'renderVehicleWorkspace',
    args: {},
    status: 'complete',
    result: typeof result === 'string' ? result : JSON.stringify(result),
  });
}
