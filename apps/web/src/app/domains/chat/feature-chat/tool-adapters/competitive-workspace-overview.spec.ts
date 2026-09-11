import { provideHttpClient } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import {
  competitiveMatrix,
  competitiveWorkspaceFixture,
  competitiveWorkspaceMessages,
  reviseCompetitiveWorkspace,
} from '../../../../testing/competitive-workspace-fixtures';
import { VehicleCatalogOverview } from '../../../vehicles/api/features';
import { createCompetitiveSurfaceProjection } from '../../data/competitive-surface-views';
import type { CompetitiveWorkspace } from '../../data/competitive-workspace-contracts';
import { AnalystBriefEdit } from './analyst-brief-edit';
import { CHAT_CARD_ACTIONS } from './chat-card-actions';
import { CHAT_WORKSPACE_SURFACES } from './chat-workspace-surfaces';
import { CompetitiveWorkspaceOverview } from './competitive-workspace-overview';

describe('CompetitiveWorkspaceOverview', () => {
  const canSend = signal(true),
    workspaceAction = vi.fn(async () => true),
    draft = vi.fn(),
    send = vi.fn();
  beforeEach(() => {
    canSend.set(true);
    workspaceAction.mockClear();
    draft.mockClear();
    send.mockClear();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify(competitiveMatrix))),
    );
    TestBed.configureTestingModule({
      imports: [CompetitiveWorkspaceOverview],
      providers: [
        provideHttpClient(),
        {
          provide: CHAT_CARD_ACTIONS,
          useValue: { canSend, workspace: workspaceAction, draft, send },
        },
      ],
    });
  });
  afterEach(() => vi.unstubAllGlobals());
  function setup(
    workspace: CompetitiveWorkspace = competitiveWorkspaceFixture(),
  ) {
    const fixture = TestBed.createComponent(CompetitiveWorkspaceOverview);
    fixture.componentRef.setInput('toolCall', {
      name: 'renderCompetitiveWorkspace',
      args: {},
      status: 'complete',
      result: JSON.stringify(workspace),
    });
    return fixture;
  }
  it('shows accessible building and malformed states without mounting unsupported data', async () => {
    const fixture = setup();
    fixture.componentRef.setInput('toolCall', {
      name: 'renderCompetitiveWorkspace',
      args: {},
      status: 'executing',
    });
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('[aria-busy=true]')).not.toBeNull();
    fixture.componentRef.setInput('toolCall', {
      name: 'renderCompetitiveWorkspace',
      args: {},
      status: 'complete',
      result: '{"html":"<script>"}',
    });
    await fixture.whenStable();
    expect(element.textContent).toContain(
      'did not match its supported contract',
    );
    expect(element.querySelector('app-analyst-brief-edit')).toBeNull();
  });
  it('sends an explicit revisioned brief action without overwriting the chat draft', async () => {
    const fixture = setup();
    await fixture.whenStable();
    fixture.debugElement
      .query(By.directive(AnalystBriefEdit))
      .componentInstance.requestApply();
    await fixture.whenStable();
    expect(workspaceAction).toHaveBeenCalledWith(
      expect.objectContaining({
        version: 1,
        surfaceId: competitiveWorkspaceFixture().surfaceId,
        expectedRevision: 1,
        actionId: expect.any(String),
        componentId: 'brief',
        action: 'applyBrief',
        values: competitiveWorkspaceFixture().snapshot.plan.context,
      }),
    );
    expect(draft).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'No revised workspace was returned',
    );
  });
  it('keeps catalog state across unrelated transcript updates and never sends actions while busy', async () => {
    const fixture = setup();
    await fixture.whenStable();
    const catalog = fixture.debugElement.query(
      By.directive(VehicleCatalogOverview),
    ).componentInstance as VehicleCatalogOverview;
    const before = catalog.page();
    fixture.componentRef.setInput('toolCall', {
      name: 'renderCompetitiveWorkspace',
      args: {},
      status: 'complete',
      result: JSON.stringify(competitiveWorkspaceFixture()),
    });
    await fixture.whenStable();
    expect(catalog.page()).toBe(before);
    canSend.set(false);
    await fixture.whenStable();
    fixture.debugElement
      .query(By.directive(AnalystBriefEdit))
      .componentInstance.requestApply();
    await fixture.whenStable();
    expect(workspaceAction).not.toHaveBeenCalled();
  });
  it('updates the original surface in place through explicit snapshots and renders later calls as receipts', async () => {
    const initial = competitiveWorkspaceFixture(),
      project = createCompetitiveSurfaceProjection();
    const messages = signal(competitiveWorkspaceMessages(initial));
    TestBed.overrideProvider(CHAT_WORKSPACE_SURFACES, {
      useValue: (id: string) => project(messages()).get(id),
    });
    const fixture = setup(initial);
    await fixture.whenStable();
    const catalog = fixture.debugElement.query(
      By.directive(VehicleCatalogOverview),
    ).componentInstance;
    const localObjective = (fixture.nativeElement as HTMLElement).querySelector(
      'textarea',
    ) as HTMLTextAreaElement;
    localObjective.value = 'Unsubmitted analyst refinement';
    localObjective.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    const catalogPage = (catalog as VehicleCatalogOverview).page();
    const next = reviseCompetitiveWorkspace(initial, {
      title: 'Revised analyst scope',
    });
    messages.set([
      ...messages(),
      ...competitiveWorkspaceMessages(next, 'update'),
    ]);
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'revision 2',
    );
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Revised analyst scope',
    );
    expect(
      fixture.debugElement.query(By.directive(VehicleCatalogOverview))
        .componentInstance,
    ).toBe(catalog);
    expect(localObjective.value).toBe('Unsubmitted analyst refinement');
    expect((catalog as VehicleCatalogOverview).page()).toBe(catalogPage);
    const receipt = setup(next);
    await receipt.whenStable();
    expect(
      (receipt.nativeElement as HTMLElement).querySelector(
        'app-analyst-brief-edit',
      ),
    ).toBeNull();
    expect(
      (receipt.nativeElement as HTMLElement)
        .querySelector('a')
        ?.getAttribute('href'),
    ).toBe('#' + initial.surfaceId);
  });
  it('keeps an independently edited brief for separate surface instances', async () => {
    const first = setup(),
      second = setup(
        competitiveWorkspaceFixture(
          {},
          1,
          'competitive-f94a2350-0a1a-5ad3-aef8-3c0c472c72a1',
        ),
      );
    await first.whenStable();
    await second.whenStable();
    const text = (first.nativeElement as HTMLElement).querySelector(
      'textarea',
    ) as HTMLTextAreaElement;
    text.value = 'My local draft';
    text.dispatchEvent(new Event('input'));
    await first.whenStable();
    expect(
      (
        (second.nativeElement as HTMLElement).querySelector(
          'textarea',
        ) as HTMLTextAreaElement
      ).value,
    ).toBe(competitiveWorkspaceFixture().snapshot.plan.context.objective);
  });
});
