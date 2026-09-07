import { TestBed } from '@angular/core/testing';

import { CHAT_CARD_ACTIONS } from './chat-card-actions';
import { ChatVehicleSourceOverview } from './chat-vehicle-source-overview';

const preview = {
  status: 'OK',
  source: {
    url: 'https://www.ford.com.br/ranger.pdf',
    title: 'ranger.pdf',
    mimeType: 'application/pdf',
    pageCount: 6,
  },
  configurations: [
    {
      name: 'XLT 2.0',
      powertrain: '2.0 Diesel AT 4x4',
      column: 'XLT',
      locator: 'Page 3, column 2',
      excerpt: 'XLT',
    },
    {
      name: 'LIMITED 3.0 V6',
      powertrain: '3.0 V6 Diesel AT 4x4',
      column: 'LIMITED',
      locator: 'Page 3, column 3',
      excerpt: 'LIMITED',
    },
  ],
  legend: [{ symbol: 'S', meaning: 'série' }],
  modelYearNote: 'Model year 2026 stated on page 1',
  notes: [],
  message: 'The source presents 2 configuration(s).',
};

describe('Chat source preview card', () => {
  async function setup() {
    const actions = { draft: vi.fn(), send: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [ChatVehicleSourceOverview],
      providers: [{ provide: CHAT_CARD_ACTIONS, useValue: actions }],
    }).compileComponents();
    const fixture = TestBed.createComponent(ChatVehicleSourceOverview);
    fixture.componentRef.setInput('toolCall', {
      name: 'previewVehicleSource',
      args: {
        sourceUrl: preview.source.url,
        brand: 'Ford',
        model: 'Ranger',
        modelYear: 2026,
      },
      status: 'complete',
      result: JSON.stringify(preview),
    });
    await fixture.whenStable();
    return { fixture, actions, element: fixture.nativeElement as HTMLElement };
  }

  it('lists the configurations and asks the agent to import the ticked ones', async () => {
    const { fixture, actions, element } = await setup();
    expect(element.textContent).toContain('2 found');
    expect(element.textContent).toContain('LIMITED 3.0 V6');
    expect(element.textContent).toContain('S = série');
    const boxes = element.querySelectorAll<HTMLInputElement>(
      'input[type="checkbox"]',
    );
    expect(boxes.length).toBe(2);
    const importButton = element.querySelector<HTMLButtonElement>(
      '[data-action="import"]',
    )!;
    expect(importButton.disabled).toBe(true);
    boxes[1].click();
    await fixture.whenStable();
    expect(importButton.disabled).toBe(false);
    importButton.click();
    expect(actions.send).toHaveBeenCalledTimes(1);
    const prompt = actions.send.mock.calls[0][0] as string;
    expect(prompt).toContain('LIMITED 3.0 V6');
    expect(prompt).not.toContain('XLT 2.0');
    expect(prompt).toContain('Ford Ranger 2026');
    expect(prompt).toContain(preview.source.url);
    expect(prompt).toContain('startVehicleIngestion');
  });

  it('imports everything without naming configurations', async () => {
    const { actions, element } = await setup();
    element
      .querySelector<HTMLButtonElement>('[data-action="import-all"]')!
      .click();
    expect(actions.send.mock.calls[0][0]).toContain(
      'every configuration the source presents',
    );
  });
});
