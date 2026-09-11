import { BaseEvent, EventType } from '@ag-ui/client';
import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Subject } from 'rxjs';

import { ZardSidebarService } from '@/ui/components/sidebar';
import { provideZard } from '@/ui/core';

import { testSession } from '../../../../testing/fake-auth';
import {
  failedRun,
  FakeChatAgent,
  provideFakeChatAgent,
  settled,
  textReply,
  toolCallReply,
} from '../../../../testing/fake-chat-agent';
import {
  disabledWallet,
  exhaustedWallet,
  FakeCreditsClient,
  lowWallet,
  provideFakeCredits,
} from '../../../../testing/fake-credits';
import {
  FakeThreadClient,
  provideFakeThreads,
  storedThread,
} from '../../../../testing/fake-threads';
import { matrix } from '../../../../testing/vehicle-fixtures';
import { workspaceFixture } from '../../../../testing/vehicle-workspace-fixtures';
import { UserPreferencesCoordinator } from '../../../user/api/preferences';
import { ChatThread } from '../../data/thread';
import { TEXT_REVEAL_ENABLED } from '../../util/text-reveal';
import { ChatPage } from './chat-page';
import { ConversationDetailStore } from './conversation-detail-store';

const MODEL_CATALOG = {
  defaultModeId: 'normal',
  resolvedMode: null,
  modes: [
    {
      id: 'velocity',
      label: 'Velocity',
      description: 'Fastest answers, lowest cost.',
      chatModelId: 'google/gemini-3.5-flash-lite',
      estimatedCredits: 200_000,
      relativeCost: 0.2,
      affordable: true,
    },
    {
      id: 'normal',
      label: 'Normal',
      description: 'The everyday balance.',
      chatModelId: 'google/gemini-3.8-flash',
      estimatedCredits: 1_000_000,
      relativeCost: 1,
      affordable: true,
    },
    {
      id: 'intelligent',
      label: 'Intelligent',
      description: 'A better reasoner.',
      chatModelId: 'anthropic/claude-sonnet-5',
      estimatedCredits: 3_200_000,
      relativeCost: 3.2,
      affordable: true,
    },
    {
      id: 'auto',
      label: 'Auto',
      description: 'Picks a mode from your message.',
      chatModelId: null,
      estimatedCredits: null,
      relativeCost: null,
      affordable: true,
    },
  ],
  roles: [
    {
      id: 'chat',
      label: 'Chat',
      models: ['google/gemini-3.8-flash', 'anthropic/claude-sonnet-5'],
    },
    {
      id: 'vision',
      label: 'Document reading',
      models: ['google/gemini-3.8-flash'],
    },
  ],
  models: [
    {
      id: 'google/gemini-3.8-flash',
      label: 'Gemini 3.5 Flash',
      vendor: 'google',
      provider: 'openrouter',
    },
    {
      id: 'anthropic/claude-sonnet-5',
      label: 'Claude Sonnet 5',
      vendor: 'anthropic',
      provider: 'openrouter',
    },
  ],
  defaultEffortId: 'auto',
  efforts: [
    { id: 'auto', label: 'Auto' },
    { id: 'low', label: 'Low' },
    { id: 'high', label: 'High' },
  ],
};

describe('ChatPage', () => {
  let agent: FakeChatAgent;

  beforeEach(async () => {
    localStorage.clear();
    agent = new FakeChatAgent();
    await TestBed.configureTestingModule({
      imports: [ChatPage],
      providers: [
        provideHttpClient(),
        ...provideFakeChatAgent(agent),
        ...provideFakeThreads(),
        ...provideFakeCredits(),
        provideRouter([
          { path: '', children: [] },
          { path: 'c/:threadId', children: [] },
        ]),
        // Zard event modifiers (the popover trigger listens to `click.stop`).
        provideZard(),
        // The page normally sits inside the shell's sidebar provider.
        ZardSidebarService,
        // The DOM is asserted right after the store settles.
        { provide: TEXT_REVEAL_ENABLED, useValue: false },
      ],
    }).compileComponents();
  });

  it('renders the vehicle comparison from server results through CopilotKit', async () => {
    agent.replyWith((input) =>
      toolCallReply(
        input,
        'compareVehicleConfigurations',
        {},
        matrix,
        'Compared vehicles',
      ),
    );
    const fixture = TestBed.createComponent(ChatPage);
    await fixture.whenStable();
    await sendPrompt(fixture.nativeElement, 'Compare vehicles');
    await settled(TestBed.inject(ConversationDetailStore));
    await fixture.whenStable();
    await fixture.whenStable();
    const card = fixture.nativeElement.querySelector(
      'app-vehicle-comparison-card',
    );
    expect(card?.textContent).toContain('Opcional');
    expect(card?.textContent).toContain('Black');
    expect(card?.querySelectorAll('.comparison-legend li').length).toBe(2);
  });

  it('renders an A2UI workspace through CopilotKit and restores it from saved history', async () => {
    const workspace = workspaceFixture();
    agent.replyWith((input) =>
      toolCallReply(
        input,
        'renderVehicleWorkspace',
        {},
        workspace,
        'Your workspace is ready.',
      ),
    );
    const fixture = TestBed.createComponent(ChatPage);
    await fixture.whenStable();
    await sendPrompt(fixture.nativeElement, 'Build a research workspace');
    const store = TestBed.inject(ConversationDetailStore);
    await settled(store);
    await fixture.whenStable();
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(
      element.querySelector('app-chat-vehicle-workspace-overview')?.textContent,
    ).toContain(workspace.title);
    expect(
      element.querySelector('app-vehicle-comparison-card')?.textContent,
    ).toContain('Black');
    expect(
      element.querySelector('[data-role="tool-activity"] summary')?.textContent,
    ).toContain('Building your research workspace');

    const id = store.threadId();
    TestBed.inject(FakeThreadClient).seed(
      storedThread(id, 'Saved workspace', 1, store.messages()),
    );
    store.reset();
    fixture.componentRef.setInput('threadId', id);
    await fixture.whenStable();
    await fixture.whenStable();
    expect(
      element.querySelectorAll('app-chat-vehicle-workspace-overview'),
    ).toHaveLength(1);
    expect(
      element.querySelector('app-vehicle-comparison-card')?.textContent,
    ).toContain('Black');
    expect(agent.runs).toHaveLength(1);
  });

  it('renders one server catalog containing Shark and Ranger through CopilotKit with saved replay', async () => {
    const shark = {
      ...matrix.configurations[0],
      id: 'c28c64e4-801a-5d29-b4c2-083a888a79f3',
      brand: 'BYD',
      model: 'Shark',
      name: 'GS',
    };
    agent.replyWith((input) =>
      toolCallReply(
        input,
        'searchVehicleConfigurations',
        { searches: [{ q: 'BYD Shark' }, { q: 'Ford Ranger' }] },
        {
          items: [shark, ...matrix.configurations],
          offset: 0,
          limit: 40,
          hasMore: false,
          status: 'OK',
          nextSearches: [],
          notices: [],
        },
        'Select vehicles to compare.',
      ),
    );
    const fixture = TestBed.createComponent(ChatPage);
    await fixture.whenStable();
    await sendPrompt(fixture.nativeElement, 'Compare Shark and Ranger');
    const store = TestBed.inject(ConversationDetailStore);
    await settled(store);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelectorAll('app-vehicle-catalog-card')).toHaveLength(
      1,
    );
    expect(element.querySelectorAll('[data-configuration-id]')).toHaveLength(3);
    expect(
      element.querySelector('app-vehicle-catalog-card')?.textContent,
    ).toContain('Shark');
    expect(
      element.querySelector('app-vehicle-catalog-card')?.textContent,
    ).toContain('Ranger');

    const id = store.threadId();
    TestBed.inject(FakeThreadClient).seed(
      storedThread(id, 'Shark and Ranger', 1, store.messages()),
    );
    store.reset();
    fixture.componentRef.setInput('threadId', id);
    await fixture.whenStable();
    await fixture.whenStable();
    expect(element.querySelectorAll('app-vehicle-catalog-card')).toHaveLength(
      1,
    );
    expect(element.querySelectorAll('[data-configuration-id]')).toHaveLength(3);
    expect(
      store.messages().filter((message) => message.role === 'tool'),
    ).toHaveLength(1);

    const add = element.querySelectorAll<HTMLButtonElement>(
      '[data-action="add-shortlist"]',
    );
    add[0].click();
    await fixture.whenStable();
    add[1].click();
    await fixture.whenStable();
    agent.replyWith((input) => textReply(input, 'Comparing your selection.'));
    element
      .querySelector<HTMLButtonElement>('[data-action="compare-shortlist"]')
      ?.click();
    await settled(store);
    const prompt = agent.runs[1]?.messages
      .filter((message) => message.role === 'user')
      .pop()?.content;
    expect(prompt).toContain(shark.id);
    expect(prompt).toContain(matrix.configurations[0].id);
  });

  it('renders compact empty results through real CopilotKit while retaining inspectable activity', async () => {
    agent.replyWith((input) =>
      toolCallReply(
        input,
        'searchVehicleConfigurations',
        { q: 'Ford F-150', modelYear: 2026 },
        { items: [], limit: 20, offset: 0, hasMore: false },
        'The catalog has no matching configurations.',
      ),
    );
    const fixture = TestBed.createComponent(ChatPage);
    await fixture.whenStable();
    await sendPrompt(fixture.nativeElement, 'Find Ford F-150');
    await settled(TestBed.inject(ConversationDetailStore));
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('app-vehicle-catalog-card')).toBeNull();
    expect(
      element.querySelector('app-chat-vehicle-catalog-overview')?.textContent,
    ).toContain('Ford F-150 · 2026');
    expect(
      element.querySelector('[data-role="tool-activity"]')?.textContent,
    ).toContain('searchVehicleConfigurations');
    expect(
      TestBed.inject(ConversationDetailStore)
        .messages()
        .some((message) => message.role === 'tool'),
    ).toBe(true);
  });

  it('renders the empty conversation and the prompt', async () => {
    const fixture = TestBed.createComponent(ChatPage);
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('h1')?.textContent).toContain('New chat');
    expect(element.querySelector('textarea#prompt')).not.toBeNull();
    expect(element.querySelector('[aria-label="Suggestions"]')).not.toBeNull();
  });

  it('shows conversation skeletons for a stored chat while the account is restored', async () => {
    const fixture = TestBed.createComponent(ChatPage);
    fixture.componentRef.setInput('threadId', 'saved-chat');
    testSession().invalidate('restoring');
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    const loading = element.querySelector('[data-role="chat-loading"]');
    expect(loading?.textContent).toContain('Loading your account');
    expect(loading?.querySelector('z-skeleton')).not.toBeNull();
    expect(element.querySelector('textarea')).not.toBeNull();
    expect(
      element.querySelector<HTMLButtonElement>('[aria-label="Send message"]')
        ?.disabled,
    ).toBe(true);
    expect(element.textContent).not.toContain('New chat');
  });

  it('shows message skeletons until the opened conversation arrives', async () => {
    const response = new Subject<ChatThread>();
    vi.spyOn(TestBed.inject(FakeThreadClient), 'find').mockReturnValue(
      response,
    );
    const fixture = TestBed.createComponent(ChatPage);
    await fixture.whenStable();
    fixture.componentRef.setInput('threadId', 'saved-chat');
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    expect(
      element.querySelector('[data-role="chat-loading"] z-skeleton'),
    ).not.toBeNull();
    expect(element.querySelector('textarea')).not.toBeNull();
    expect(
      element.querySelector<HTMLButtonElement>('[aria-label="Send message"]')
        ?.disabled,
    ).toBe(true);
    expect(element.textContent).not.toContain('New chat');

    response.next(
      storedThread('saved-chat', 'Saved conversation', 1, [
        {
          id: 'saved-message',
          role: 'user',
          content: 'Compare the Ranger versions',
        },
      ]),
    );
    response.complete();
    await vi.waitFor(() =>
      expect(TestBed.inject(ConversationDetailStore).loading()).toBe(false),
    );
    await fixture.whenStable();

    expect(element.querySelector('[data-role="chat-loading"]')).toBeNull();
    expect(element.querySelector('h1')?.textContent).toContain(
      'Saved conversation',
    );
    expect(element.textContent).toContain('Compare the Ranger versions');
    expect(element.querySelector('textarea')).not.toBeNull();
  });

  it.each([false, true])(
    'handles Return safely with touch keyboard %s',
    async (touch) => {
      vi.stubGlobal('matchMedia', (query: string) => ({
        matches: query === '(hover: none) and (pointer: coarse)' && touch,
        media: query,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }));
      try {
        const fixture = TestBed.createComponent(ChatPage);
        await fixture.whenStable();
        const element = fixture.nativeElement as HTMLElement;
        const prompt = element.querySelector<HTMLTextAreaElement>('#prompt')!;
        const submit = vi
          .spyOn(element.querySelector('form')!, 'requestSubmit')
          .mockImplementation(() => undefined);
        for (const modifiers of [
          {},
          { shiftKey: true },
          { isComposing: true },
        ]) {
          const event = new KeyboardEvent('keydown', {
            key: 'Enter',
            bubbles: true,
            cancelable: true,
            ...modifiers,
          });
          prompt.dispatchEvent(event);
          expect(event.defaultPrevented).toBe(
            !touch && Object.keys(modifiers).length === 0,
          );
        }
        expect(submit).toHaveBeenCalledTimes(touch ? 0 : 1);
      } finally {
        vi.unstubAllGlobals();
      }
    },
  );

  it('starts a new catalog chat from the home call to action', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(matrix), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );
    agent.replyWith((input) =>
      toolCallReply(
        input,
        'searchVehicleConfigurations',
        { q: '', limit: 20, offset: 0 },
        {
          items: matrix.configurations,
          limit: 20,
          offset: 0,
          hasMore: false,
        },
        'Here is the current catalog.',
      ),
    );
    try {
      const fixture = TestBed.createComponent(ChatPage);
      await fixture.whenStable();
      const element = fixture.nativeElement as HTMLElement;
      element
        .querySelector<HTMLButtonElement>('[data-action="catalog"]')
        ?.click();
      await settled(TestBed.inject(ConversationDetailStore));
      await fixture.whenStable();
      await fixture.whenStable();

      expect(TestBed.inject(Router).url).toMatch(/^\/c\//);
      expect(
        element.querySelector('[data-role="user"]')?.textContent,
      ).toContain('Show me the current vehicle catalog');
      expect(element.querySelector('app-vehicle-catalog-card')).not.toBeNull();
      expect(element.textContent).toContain('showing 2 of 2 on this page');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('keeps an empty composer neutral after focus, blur, or Enter', async () => {
    const fixture = TestBed.createComponent(ChatPage);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const prompt = element.querySelector<HTMLTextAreaElement>('#prompt');
    prompt?.focus();
    prompt?.blur();
    await fixture.whenStable();
    expect(prompt?.getAttribute('aria-invalid')).not.toBe('true');
    expect(
      element.querySelector('#prompt-validation')?.textContent?.trim(),
    ).toBe('');
    prompt?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
    );
    await fixture.whenStable();
    expect(prompt?.getAttribute('aria-invalid')).not.toBe('true');
    expect(
      element.querySelector('#prompt-validation')?.textContent?.trim(),
    ).toBe('');
    expect(TestBed.inject(ConversationDetailStore).isEmpty()).toBe(true);
  });

  it('moves to the thread URL with the first message and titles the page', async () => {
    agent.replyWith((input) => textReply(input, 'sure'));
    const fixture = TestBed.createComponent(ChatPage);
    await fixture.whenStable();

    await sendPrompt(fixture.nativeElement, 'Reset password by email');
    await settled(TestBed.inject(ConversationDetailStore));
    await fixture.whenStable();

    const store = TestBed.inject(ConversationDetailStore);
    expect(TestBed.inject(Router).url).toBe(`/c/${store.threadId()}`);
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('h1')?.textContent).toContain(
      'Reset password by email',
    );
  });

  it('opens the stored thread named by the route input', async () => {
    agent.replyWith((input) => textReply(input, 'stored reply'));
    const store = TestBed.inject(ConversationDetailStore);
    await store.send('earlier question');
    const id = store.threadId();
    TestBed.inject(FakeThreadClient).seed(
      storedThread(id, 'earlier question', 1, store.messages()),
    );
    store.reset();
    expect(store.isEmpty()).toBe(true);

    const fixture = TestBed.createComponent(ChatPage);
    fixture.componentRef.setInput('threadId', id);
    await fixture.whenStable();

    expect(store.threadId()).toBe(id);
    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('earlier question');
    expect(element.textContent).toContain('stored reply');
  });

  it('shows reopened replies immediately even when text reveal is enabled', async () => {
    TestBed.overrideProvider(TEXT_REVEAL_ENABLED, { useValue: true });
    agent.replyWith((input) => textReply(input, 'The complete saved reply.'));
    const store = TestBed.inject(ConversationDetailStore);
    await store.send('Earlier question');
    const id = store.threadId();
    TestBed.inject(FakeThreadClient).seed(
      storedThread(id, 'Earlier question', 1, store.messages()),
    );
    store.reset();
    const frame = vi
      .spyOn(globalThis, 'requestAnimationFrame')
      .mockReturnValue(1);
    try {
      const fixture = TestBed.createComponent(ChatPage);
      fixture.componentRef.setInput('threadId', id);
      await fixture.whenStable();
      const element = fixture.nativeElement as HTMLElement;
      expect(
        element.querySelector('[data-role="assistant"]')?.textContent,
      ).toContain('The complete saved reply.');
      expect(element.querySelector('[data-action="copy"]')).not.toBeNull();
      fixture.destroy();
    } finally {
      frame.mockRestore();
    }
  });

  it('still reveals newly requested replies progressively', async () => {
    TestBed.overrideProvider(TEXT_REVEAL_ENABLED, { useValue: true });
    agent.replyWith((input) =>
      textReply(input, 'A new response to reveal progressively.'),
    );
    const frame = vi
      .spyOn(globalThis, 'requestAnimationFrame')
      .mockReturnValue(1);
    try {
      const fixture = TestBed.createComponent(ChatPage);
      await fixture.whenStable();
      await sendPrompt(fixture.nativeElement, 'New question');
      await settled(TestBed.inject(ConversationDetailStore));
      await fixture.whenStable();
      const element = fixture.nativeElement as HTMLElement;
      expect(
        element.querySelector('[data-role="assistant"]')?.textContent,
      ).not.toContain('A new response to reveal progressively.');
      expect(element.querySelector('[data-action="copy"]')).toBeNull();
      fixture.destroy();
    } finally {
      frame.mockRestore();
    }
  });

  it('starts a new conversation when the route input is cleared', async () => {
    agent.replyWith((input) => textReply(input, 'ok'));
    const fixture = TestBed.createComponent(ChatPage);
    await fixture.whenStable();
    await sendPrompt(fixture.nativeElement, 'hello');
    await settled(TestBed.inject(ConversationDetailStore));
    fixture.componentRef.setInput(
      'threadId',
      TestBed.inject(ConversationDetailStore).threadId(),
    );
    await fixture.whenStable();

    fixture.componentRef.setInput('threadId', undefined);
    await fixture.whenStable();

    expect(TestBed.inject(ConversationDetailStore).isEmpty()).toBe(true);
    expect(
      (fixture.nativeElement as HTMLElement).querySelector(
        '[aria-label="Suggestions"]',
      ),
    ).not.toBeNull();
  });

  it('sends the prompt and renders the streamed reply as Markdown', async () => {
    agent.replyWith((input) => textReply(input, 'Hi **Tuba**', '\n\n- one'));
    const fixture = TestBed.createComponent(ChatPage);
    await fixture.whenStable();

    await sendPrompt(fixture.nativeElement, 'hello');
    await settled(TestBed.inject(ConversationDetailStore));
    await fixture.whenStable();
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    const turns = element.querySelectorAll('[data-slot="message"]');
    expect(turns).toHaveLength(2);
    expect(turns[0].getAttribute('data-role')).toBe('user');
    expect(turns[0].textContent).toContain('hello');
    expect(turns[1].getAttribute('data-role')).toBe('assistant');
    expect(turns[1].querySelector('z-bubble')).toBeNull();
    expect(turns[1].querySelector('.chat-markdown strong')?.textContent).toBe(
      'Tuba',
    );
    expect(turns[1].querySelector('.chat-markdown li')?.textContent).toBe(
      'one',
    );
    expect(element.querySelector<HTMLTextAreaElement>('#prompt')?.value).toBe(
      '',
    );
  });

  it('advertises only the ingestion start tool, never server renderers, as frontend tools', async () => {
    agent.replyWith((input) => textReply(input, 'ok'));
    const fixture = TestBed.createComponent(ChatPage);
    await fixture.whenStable();

    await sendPrompt(fixture.nativeElement, 'hello');
    await settled(TestBed.inject(ConversationDetailStore));

    expect(agent.runs[0].tools.map((tool) => tool.name)).toEqual([
      'startVehicleIngestion',
    ]);
  });

  it('discloses thinking separately from the answer and hides activity on request', async () => {
    agent.replyWith((input) => {
      const events = textReply(input, 'The answer');
      return [
        events[0],
        { type: EventType.REASONING_START, messageId: 'thought' },
        {
          type: EventType.REASONING_MESSAGE_START,
          messageId: 'thought',
          role: 'assistant',
        },
        {
          type: EventType.REASONING_MESSAGE_CONTENT,
          messageId: 'thought',
          delta: 'Checking measurable criteria.',
        },
        { type: EventType.REASONING_MESSAGE_END, messageId: 'thought' },
        { type: EventType.REASONING_END, messageId: 'thought' },
        ...events.slice(1),
      ] as BaseEvent[];
    });
    const fixture = TestBed.createComponent(ChatPage);
    await fixture.whenStable();
    await sendPrompt(fixture.nativeElement, 'review this');
    await settled(TestBed.inject(ConversationDetailStore));
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    const details = element.querySelector<HTMLDetailsElement>(
      '[data-role="reasoning"]',
    );
    expect(details?.open).toBe(false);
    expect(details?.textContent).toContain('Checking measurable criteria.');
    expect(
      element.querySelector('[data-role="assistant"]')?.textContent,
    ).not.toContain('Checking measurable');
    details?.querySelector('summary')?.click();
    expect(details?.open).toBe(true);

    const toggle = element.querySelector<HTMLButtonElement>(
      '[aria-label="Show thinking and tool activity"]',
    );
    toggle?.click();
    await fixture.whenStable();
    expect(toggle?.getAttribute('aria-pressed')).toBe('false');
    expect(element.querySelector('[data-role="reasoning"]')).toBeNull();
    expect(element.textContent).toContain('The answer');
  });

  it('keeps useful tool output visible when activity details are hidden', async () => {
    agent.replyWith((input) =>
      toolCallReply(
        input,
        'compareVehicleConfigurations',
        { configurationIds: matrix.configurations.map((item) => item.id) },
        matrix,
        'Done',
      ),
    );
    const fixture = TestBed.createComponent(ChatPage);
    await fixture.whenStable();
    await sendPrompt(fixture.nativeElement, 'review this');
    await settled(TestBed.inject(ConversationDetailStore));
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const details = element.querySelector<HTMLDetailsElement>(
      '[data-role="tool-activity"]',
    );
    expect(details?.open).toBe(false);
    expect(details?.textContent).toContain('Completed');
    details?.querySelector('summary')?.click();
    expect(details?.open).toBe(true);
    expect(details?.querySelector('pre')?.textContent).toContain(
      matrix.configurations[0].id,
    );
    element
      .querySelector<HTMLButtonElement>(
        '[aria-label="Show thinking and tool activity"]',
      )
      ?.click();
    await fixture.whenStable();
    expect(element.querySelector('[data-role="tool-activity"]')).toBeNull();
    expect(
      element.querySelector('app-vehicle-comparison-card')?.textContent,
    ).toContain('Limited');
  });

  it('explains the character limit and prevents an oversized prompt', async () => {
    const fixture = TestBed.createComponent(ChatPage);
    await fixture.whenStable();
    await sendPrompt(fixture.nativeElement, 'a'.repeat(4001));
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('#prompt-validation')?.textContent).toContain(
      '4,000',
    );
    expect(
      element.querySelector<HTMLButtonElement>('[type="submit"]')?.disabled,
    ).toBe(true);
    expect(agent.runs).toHaveLength(0);
  });

  it('sends a suggestion as the prompt', async () => {
    agent.replyWith((input) => textReply(input, 'sure'));
    const fixture = TestBed.createComponent(ChatPage);
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    const suggestion = element.querySelector<HTMLButtonElement>(
      '[aria-label="Suggestions"] button',
    );
    expect(suggestion).not.toBeNull();
    suggestion?.click();
    await settled(TestBed.inject(ConversationDetailStore));
    await fixture.whenStable();
    await fixture.whenStable();

    const turns = element.querySelectorAll('[data-slot="message"]');
    expect(turns[0].textContent).toContain('Compare Ranger Black and Limited');
    expect(element.querySelector('[aria-label="Suggestions"]')).toBeNull();
  });

  it('offers copy and regenerate on the finished reply', async () => {
    agent.replyWith((input) => textReply(input, 'first'));
    const fixture = TestBed.createComponent(ChatPage);
    await fixture.whenStable();

    await sendPrompt(fixture.nativeElement, 'hello');
    await settled(TestBed.inject(ConversationDetailStore));
    await fixture.whenStable();
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('[data-action="copy"]')).not.toBeNull();

    agent.replyWith((input) => textReply(input, 'second'));
    element
      .querySelector<HTMLButtonElement>('[data-action="regenerate"]')
      ?.click();
    await settled(TestBed.inject(ConversationDetailStore));
    await fixture.whenStable();
    await fixture.whenStable();

    const replies = element.querySelectorAll('[data-role="assistant"]');
    expect(replies).toHaveLength(1);
    expect(replies[0].textContent).toContain('second');
  });

  it('preserves a draft while a card sends an independent follow-up', async () => {
    agent.replyWith((input) => textReply(input, 'Ready'));
    const fixture = TestBed.createComponent(ChatPage);
    await fixture.whenStable();
    await sendPrompt(fixture.nativeElement, 'Find vehicles');
    const store = TestBed.inject(ConversationDetailStore);
    await settled(store);
    await fixture.whenStable();

    fixture.componentInstance.prepareDraft('My unfinished question');
    fixture.componentInstance.sendFromCard('Compare my selected vehicles');
    await settled(store);
    await fixture.whenStable();

    const run = agent.runs[agent.runs.length - 1];
    expect(run.messages[run.messages.length - 1]?.content).toBe(
      'Compare my selected vehicles',
    );
    expect(
      (fixture.nativeElement as HTMLElement).querySelector<HTMLTextAreaElement>(
        '#prompt',
      )?.value,
    ).toBe('My unfinished question');
  });

  it('rejects empty and oversized card prompts without changing the draft', async () => {
    const fixture = TestBed.createComponent(ChatPage);
    await fixture.whenStable();
    fixture.componentInstance.prepareDraft('Keep this draft');
    fixture.componentInstance.sendFromCard('   ');
    fixture.componentInstance.sendFromCard('x'.repeat(4001));
    await fixture.whenStable();

    expect(agent.runs).toHaveLength(0);
    expect(
      (fixture.nativeElement as HTMLElement).querySelector<HTMLTextAreaElement>(
        '#prompt',
      )?.value,
    ).toBe('Keep this draft');
  });

  it('marks a stopped reply', async () => {
    agent.replyWith((input) => textReply(input, 'partial'));
    const fixture = TestBed.createComponent(ChatPage);
    await fixture.whenStable();

    // Stop before the fake agent gets to answer on the next tick.
    const store = TestBed.inject(ConversationDetailStore);
    const sending = store.send('hello');
    store.stop();
    await sending;
    await fixture.whenStable();
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    expect(
      element.querySelector('[data-role="stopped"]')?.textContent,
    ).toContain('Reply stopped');
  });

  it('follows answers beyond the viewport, pauses for reading and resumes at the latest message', async () => {
    agent.replyWith((input) => textReply(input, 'Initial answer'));
    const fixture = TestBed.createComponent(ChatPage);
    await fixture.whenStable();
    await sendPrompt(fixture.nativeElement, 'first');
    await settled(TestBed.inject(ConversationDetailStore));
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const log = element.querySelector<HTMLElement>('[role="log"]')!;
    const answer = element.querySelector<HTMLElement>(
      '[data-role="assistant"]',
    )!;
    Object.defineProperties(log, {
      clientHeight: { value: 300 },
      scrollHeight: { value: 1200, configurable: true },
    });
    Object.defineProperty(answer, 'offsetHeight', { value: 700 });
    agent.setMessages(
      agent.messages.map((message) =>
        message.role === 'assistant'
          ? { ...message, content: 'A much longer answer' }
          : message,
      ),
    );
    await fixture.whenStable();
    expect(log.scrollTop).toBe(1200);
    expect(
      element.querySelector('[aria-label="Scroll to the latest message"]'),
    ).toBeNull();

    // A delayed scroll event after content growth is not an upward user scroll.
    Object.defineProperty(log, 'scrollHeight', {
      value: 1800,
      configurable: true,
    });
    log.dispatchEvent(new Event('scroll'));
    agent.setMessages(
      agent.messages.map((message) =>
        message.role === 'assistant'
          ? { ...message, content: 'An even longer answer' }
          : message,
      ),
    );
    await fixture.whenStable();
    expect(log.scrollTop).toBe(1800);

    log.scrollTop = 400;
    log.dispatchEvent(new Event('scroll'));
    await fixture.whenStable();
    agent.setMessages(
      agent.messages.map((message) =>
        message.role === 'assistant'
          ? { ...message, content: 'More text while reading earlier messages' }
          : message,
      ),
    );
    await fixture.whenStable();
    expect(log.scrollTop).toBe(400);
    element
      .querySelector<HTMLButtonElement>(
        '[aria-label="Scroll to the latest message"]',
      )!
      .click();
    await fixture.whenStable();
    expect(log.scrollTop).toBe(1800);
    expect(
      element.querySelector('[aria-label="Scroll to the latest message"]'),
    ).toBeNull();

    // Sending a prompt also restores following after scrolling away.
    log.scrollTop = 400;
    log.dispatchEvent(new Event('scroll'));
    Object.defineProperty(log, 'scrollHeight', { value: 1200 });
    await sendPrompt(element, 'second');
    await settled(TestBed.inject(ConversationDetailStore));
    await fixture.whenStable();
    expect(log.scrollTop).toBe(1200);
  });

  it('follows layout resizing only while pinned and disconnects its observers', async () => {
    let resize: ResizeObserverCallback | undefined;
    const observers: { disconnect: ReturnType<typeof vi.fn> }[] = [];
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(private readonly callback: ResizeObserverCallback) {
          observers.push(this);
        }
        observe = vi.fn((target: Element) => {
          if (target.getAttribute('role') === 'log') resize = this.callback;
        });
        disconnect = vi.fn();
      },
    );
    try {
      agent.replyWith((input) => textReply(input, 'Initial answer'));
      const fixture = TestBed.createComponent(ChatPage);
      await fixture.whenStable();
      await sendPrompt(fixture.nativeElement, 'first');
      await settled(TestBed.inject(ConversationDetailStore));
      await fixture.whenStable();
      const element = fixture.nativeElement as HTMLElement;
      const log = element.querySelector<HTMLElement>('[role="log"]')!;
      Object.defineProperties(log, {
        clientHeight: { value: 300 },
        scrollHeight: { value: 1200, configurable: true },
      });
      const notifyResize = () => resize!([], {} as ResizeObserver);
      notifyResize();
      expect(log.scrollTop).toBe(1200);

      log.scrollTop = 400;
      log.dispatchEvent(new Event('scroll'));
      Object.defineProperty(log, 'scrollHeight', { value: 1800 });
      notifyResize();
      expect(log.scrollTop).toBe(400);

      // Manually returning to the bottom resumes following.
      log.scrollTop = 1500;
      log.dispatchEvent(new Event('scroll'));
      notifyResize();
      expect(log.scrollTop).toBe(1800);

      fixture.destroy();
      for (const observer of observers)
        expect(observer.disconnect).toHaveBeenCalledOnce();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('offers the modes the service reports and sends the picked one with the run', async () => {
    stubCatalog(MODEL_CATALOG);
    try {
      agent.replyWith((input) => textReply(input, 'Hello'));
      const fixture = TestBed.createComponent(ChatPage);
      await fixture.whenStable();
      await fixture.whenStable();
      const element = fixture.nativeElement as HTMLElement;
      const trigger = element.querySelector<HTMLElement>(
        '[data-role="run-options"]',
      );
      expect(trigger).not.toBeNull();
      // Nothing picked yet: the mode the service answers in by default.
      expect(trigger?.textContent).toContain('Normal');
      expect(trigger?.getAttribute('aria-label')).toContain('Mode: Normal');

      trigger?.click();
      await fixture.whenStable();
      const velocity = document.querySelector<HTMLElement>(
        '[data-role="mode-option"][data-value="velocity"]',
      );
      // Every row names what it costs per message, cheapest mode first.
      expect(velocity?.textContent).toContain('0.20 credits per message');
      expect(velocity?.textContent).toContain('Fastest answers, lowest cost.');
      // Only what costs more than Normal carries a multiplier.
      expect(
        velocity?.querySelector('[data-role="mode-multiplier"]'),
      ).toBeNull();
      expect(
        document
          .querySelector('[data-role="mode-option"][data-value="intelligent"]')
          ?.querySelector('[data-role="mode-multiplier"]')?.textContent,
      ).toContain('3.2×');
      // Auto has no estimate of its own.
      expect(
        document.querySelector(
          '[data-role="mode-option"][data-value="auto"] [data-role="mode-detail"]',
        )?.textContent,
      ).toContain('Picks a mode from your message.');

      velocity?.click();
      await fixture.whenStable();
      expect(TestBed.inject(UserPreferencesCoordinator).mode()).toBe(
        'velocity',
      );
      expect(trigger?.textContent).toContain('Velocity');
      expect(localStorage.getItem('specsync.chat.preferences.v1')).toContain(
        '"mode":"velocity"',
      );

      await sendPrompt(element, 'Hi');
      await settled(TestBed.inject(ConversationDetailStore));
      expect(agent.runs[agent.runs.length - 1]?.forwardedProps).toMatchObject({
        mode: 'velocity',
      });
      expect(
        (
          agent.runs[agent.runs.length - 1]?.forwardedProps as Record<
            string,
            unknown
          >
        )['effort'],
      ).toBeUndefined();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('names the mode auto resolved to on the pill', async () => {
    stubCatalog({ ...MODEL_CATALOG, resolvedMode: 'normal' });
    try {
      const fixture = TestBed.createComponent(ChatPage);
      await fixture.whenStable();
      await fixture.whenStable();
      const element = fixture.nativeElement as HTMLElement;
      element.querySelector<HTMLElement>('[data-role="run-options"]')?.click();
      await fixture.whenStable();
      document
        .querySelector<HTMLElement>(
          '[data-role="mode-option"][data-value="auto"]',
        )
        ?.click();
      await fixture.whenStable();

      const trigger = element.querySelector<HTMLElement>(
        '[data-role="run-options"]',
      );
      expect(trigger?.textContent).toContain('Auto');
      expect(
        trigger?.querySelector('[data-role="run-options-resolved"]')
          ?.textContent,
      ).toContain('Normal');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('overrides one role behind Advanced and sends it with the run', async () => {
    stubCatalog(MODEL_CATALOG);
    try {
      agent.replyWith((input) => textReply(input, 'Hello'));
      const fixture = TestBed.createComponent(ChatPage);
      await fixture.whenStable();
      await fixture.whenStable();
      const element = fixture.nativeElement as HTMLElement;
      element.querySelector<HTMLElement>('[data-role="run-options"]')?.click();
      await fixture.whenStable();

      document
        .querySelector<HTMLElement>('[data-role="advanced-open"]')
        ?.click();
      await fixture.whenStable();
      const role = document.querySelector<HTMLElement>(
        '[data-role="role-row"][data-value="chat"]',
      );
      // Every role follows the mode until it is given a model of its own.
      expect(role?.textContent).toContain('Follow mode');
      expect(role?.getAttribute('aria-expanded')).toBe('false');
      role?.click();
      await fixture.whenStable();
      expect(role?.getAttribute('aria-expanded')).toBe('true');
      // "Follow mode" is the first radio and is the one checked.
      const options = document.querySelectorAll(
        '[data-role="role-model-option"]',
      );
      expect(options[0].getAttribute('data-value')).toBe('');
      expect(options[0].getAttribute('aria-checked')).toBe('true');

      document
        .querySelector<HTMLElement>(
          '[data-role="role-model-option"][data-value="anthropic/claude-sonnet-5"]',
        )
        ?.click();
      await fixture.whenStable();
      expect(TestBed.inject(UserPreferencesCoordinator).roleModels()).toEqual({
        chat: 'anthropic/claude-sonnet-5',
      });
      expect(
        document.querySelector('[data-role="role-row"][data-value="chat"]')
          ?.textContent,
      ).toContain('Claude Sonnet 5');

      await sendPrompt(element, 'Hi');
      await settled(TestBed.inject(ConversationDetailStore));
      expect(agent.runs[agent.runs.length - 1]?.forwardedProps).toMatchObject({
        roleModels: { chat: 'anthropic/claude-sonnet-5' },
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('asks before an expensive mode the wallet barely covers, and keeps the mode on cancel', async () => {
    stubCatalog(MODEL_CATALOG);
    try {
      TestBed.inject(FakeCreditsClient).answerWith(lowWallet());
      const fixture = TestBed.createComponent(ChatPage);
      await fixture.whenStable();
      await fixture.whenStable();
      const element = fixture.nativeElement as HTMLElement;
      element.querySelector<HTMLElement>('[data-role="run-options"]')?.click();
      await fixture.whenStable();

      document
        .querySelector<HTMLElement>(
          '[data-role="mode-option"][data-value="intelligent"]',
        )
        ?.click();
      await fixture.whenStable();

      const confirm = document.querySelector('[data-role="mode-confirm"]');
      expect(confirm?.textContent).toContain('Switch to Intelligent?');
      expect(confirm?.textContent).toContain('3 credits per message');
      // 0.60 credits left is not one reply in that mode.
      expect(confirm?.textContent).toContain('cover about 0 messages');
      // Nothing changed while the question is open.
      expect(TestBed.inject(UserPreferencesCoordinator).mode()).toBe('normal');

      document
        .querySelector<HTMLElement>('[data-action="mode-cancel"]')
        ?.click();
      await fixture.whenStable();
      expect(document.querySelector('[data-role="mode-confirm"]')).toBeNull();
      expect(TestBed.inject(UserPreferencesCoordinator).mode()).toBe('normal');

      document
        .querySelector<HTMLElement>(
          '[data-role="mode-option"][data-value="intelligent"]',
        )
        ?.click();
      await fixture.whenStable();
      document
        .querySelector<HTMLElement>('[data-action="mode-confirm"]')
        ?.click();
      await fixture.whenStable();
      expect(TestBed.inject(UserPreferencesCoordinator).mode()).toBe(
        'intelligent',
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('switches to an expensive mode without asking while the wallet covers it', async () => {
    stubCatalog(MODEL_CATALOG);
    try {
      const fixture = TestBed.createComponent(ChatPage);
      await fixture.whenStable();
      await fixture.whenStable();
      (fixture.nativeElement as HTMLElement)
        .querySelector<HTMLElement>('[data-role="run-options"]')
        ?.click();
      await fixture.whenStable();
      document
        .querySelector<HTMLElement>(
          '[data-role="mode-option"][data-value="intelligent"]',
        )
        ?.click();
      await fixture.whenStable();

      expect(document.querySelector('[data-role="mode-confirm"]')).toBeNull();
      expect(TestBed.inject(UserPreferencesCoordinator).mode()).toBe(
        'intelligent',
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('offers the reasoning efforts the service reports and sends the picked one with the run', async () => {
    stubCatalog(MODEL_CATALOG);
    try {
      agent.replyWith((input) => textReply(input, 'Hello'));
      const fixture = TestBed.createComponent(ChatPage);
      await fixture.whenStable();
      await fixture.whenStable();
      const element = fixture.nativeElement as HTMLElement;
      const trigger = element.querySelector<HTMLElement>(
        '[data-role="run-options"]',
      );
      expect(trigger).not.toBeNull();
      // The pill names the mode; the effort sits inside the panel.
      expect(trigger?.getAttribute('aria-label')).toContain(
        'Reasoning effort: Auto',
      );

      trigger?.click();
      await fixture.whenStable();
      const track = document.querySelector<HTMLElement>(
        '[data-role="effort-select"]',
      );
      // Nothing picked yet: the effort the service applies by default.
      expect(track?.textContent).toContain('Reasoning effort: Auto');
      const option = track?.querySelector<HTMLElement>(
        '[data-role="effort-option"][data-value="high"]',
      );
      expect(option?.getAttribute('aria-label')).toBe('High');
      option?.click();
      await fixture.whenStable();
      expect(TestBed.inject(UserPreferencesCoordinator).effort()).toBe('high');
      expect(option?.getAttribute('aria-checked')).toBe('true');
      expect(track?.textContent).toContain('High');
      // The panel stays open, like a slider.
      expect(trigger?.getAttribute('aria-label')).toContain(
        'Reasoning effort: High',
      );
      expect(localStorage.getItem('specsync.chat.preferences.v1')).toContain(
        '"effort":"high"',
      );

      // Arrow keys move the selection like a radio group.
      option?.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }),
      );
      await fixture.whenStable();
      expect(TestBed.inject(UserPreferencesCoordinator).effort()).toBe('low');

      await sendPrompt(element, 'Hi');
      await settled(TestBed.inject(ConversationDetailStore));
      expect(agent.runs[agent.runs.length - 1]?.forwardedProps).toMatchObject({
        effort: 'low',
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('shows the modes alone while the service offers no efforts', async () => {
    stubCatalog({ ...MODEL_CATALOG, efforts: [] });
    try {
      const fixture = TestBed.createComponent(ChatPage);
      await fixture.whenStable();
      await fixture.whenStable();
      const trigger = (
        fixture.nativeElement as HTMLElement
      ).querySelector<HTMLElement>('[data-role="run-options"]');
      expect(trigger?.textContent).toContain('Normal');
      expect(trigger?.getAttribute('aria-label')).not.toContain('effort');
      trigger?.click();
      await fixture.whenStable();
      expect(document.querySelector('[data-role="effort-select"]')).toBeNull();
      expect(
        document.querySelector('[data-role="mode-select"]'),
      ).not.toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('hides the advanced row while the service offers no per-role choice', async () => {
    stubCatalog({ ...MODEL_CATALOG, roles: [], models: [] });
    try {
      const fixture = TestBed.createComponent(ChatPage);
      await fixture.whenStable();
      await fixture.whenStable();
      (fixture.nativeElement as HTMLElement)
        .querySelector<HTMLElement>('[data-role="run-options"]')
        ?.click();
      await fixture.whenStable();
      expect(document.querySelector('[data-role="advanced-open"]')).toBeNull();
      expect(
        document.querySelector('[data-role="effort-select"]'),
      ).not.toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('hides the mode list while the service offers a single mode', async () => {
    stubCatalog({ ...MODEL_CATALOG, modes: MODEL_CATALOG.modes.slice(1, 2) });
    try {
      const fixture = TestBed.createComponent(ChatPage);
      await fixture.whenStable();
      await fixture.whenStable();
      const trigger = (
        fixture.nativeElement as HTMLElement
      ).querySelector<HTMLElement>('[data-role="run-options"]');
      trigger?.click();
      await fixture.whenStable();
      expect(document.querySelector('[data-role="mode-select"]')).toBeNull();
      expect(
        document.querySelector('[data-role="effort-select"]'),
      ).not.toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('hides the picker while the service offers nothing to pick', async () => {
    stubCatalog({
      ...MODEL_CATALOG,
      modes: MODEL_CATALOG.modes.slice(1, 2),
      efforts: [],
    });
    try {
      const fixture = TestBed.createComponent(ChatPage);
      await fixture.whenStable();
      await fixture.whenStable();
      expect(
        fixture.nativeElement.querySelector('[data-role="run-options"]'),
      ).toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('shows the credits pill with the balance left', async () => {
    const fixture = TestBed.createComponent(ChatPage);
    await fixture.whenStable();
    await fixture.whenStable();

    const pill = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-role="credits"]',
    );
    expect(pill?.textContent).toContain('146 credits');
    expect(pill?.getAttribute('aria-label')).toContain('146 of 200');
  });

  it('lists the model prices and the recent replies in the credits panel', async () => {
    const fixture = TestBed.createComponent(ChatPage);
    await fixture.whenStable();
    await fixture.whenStable();

    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLElement>('[data-role="credits"]')
      ?.click();
    await fixture.whenStable();

    const panel = document.querySelector('[data-role="credits-panel"]');
    expect(panel?.textContent).toContain('AI Credits');
    expect(panel?.textContent).toContain('146 of 200');
    expect(panel?.textContent).toContain('Used 54');
    // Money never reaches the surface.
    expect(panel?.textContent).not.toContain('R$');
    expect(
      panel?.querySelectorAll('[data-role="credits-model"]').length,
    ).toBeGreaterThan(0);
    expect(
      panel?.querySelectorAll('[data-role="credits-runs"] li').length,
    ).toBeGreaterThan(0);
  });

  it('blocks the composer and explains it when the credits are used up', async () => {
    TestBed.inject(FakeCreditsClient).answerWith(exhaustedWallet());
    const fixture = TestBed.createComponent(ChatPage);
    await fixture.whenStable();
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    const alert = element.querySelector('[data-role="credits-exhausted"]');
    expect(alert?.textContent).toContain('Your AI credits are used up');
    expect(alert?.textContent).toContain('keep reading your conversations');
    expect(
      element.querySelector<HTMLTextAreaElement>('textarea#prompt')?.disabled,
    ).toBe(true);
    expect(
      element.querySelector<HTMLButtonElement>('[aria-label="Send message"]')
        ?.disabled,
    ).toBe(true);
    expect(
      element.querySelector('[data-role="credits"]')?.textContent,
    ).toContain('0 credits');
  });

  it('offers Velocity mode when the service refuses the run for lack of credits', async () => {
    stubCatalog(MODEL_CATALOG);
    try {
      TestBed.inject(FakeCreditsClient).answerWith(lowWallet());
      agent.replyWith((input) =>
        failedRun(
          input,
          'INSUFFICIENT_CREDITS: Your AI credits (0.60) do not cover a reply in Intelligent mode.',
        ),
      );
      const fixture = TestBed.createComponent(ChatPage);
      await fixture.whenStable();
      await sendPrompt(fixture.nativeElement, 'hello');
      await settled(TestBed.inject(ConversationDetailStore));
      await fixture.whenStable();
      await fixture.whenStable();

      const element = fixture.nativeElement as HTMLElement;
      const alert = element.querySelector('[data-role="credits-insufficient"]');
      expect(alert?.textContent).toContain('do not cover a reply');
      // The generic failure banner stays away; this one says what happened.
      expect(element.querySelector('[data-action="retry"]')).toBeNull();
      const button = element.querySelector<HTMLButtonElement>(
        '[data-action="switch-mode"]',
      );
      expect(button?.textContent).toContain('Switch to Velocity mode');

      button?.click();
      await fixture.whenStable();
      expect(TestBed.inject(UserPreferencesCoordinator).mode()).toBe(
        'velocity',
      );
      expect(agent.runs.length).toBeGreaterThan(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('offers no way out while the service reports no cheaper mode', async () => {
    stubCatalog({ ...MODEL_CATALOG, modes: MODEL_CATALOG.modes.slice(1) });
    try {
      TestBed.inject(FakeCreditsClient).answerWith(lowWallet());
      agent.replyWith((input) =>
        failedRun(
          input,
          'INSUFFICIENT_CREDITS: Your AI credits (0.60) do not cover a reply in Normal mode.',
        ),
      );
      const fixture = TestBed.createComponent(ChatPage);
      await fixture.whenStable();
      await sendPrompt(fixture.nativeElement, 'hello');
      await settled(TestBed.inject(ConversationDetailStore));
      await fixture.whenStable();
      await fixture.whenStable();

      const element = fixture.nativeElement as HTMLElement;
      expect(
        element.querySelector('[data-role="credits-insufficient"]'),
      ).not.toBeNull();
      expect(element.querySelector('[data-action="switch-mode"]')).toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('does not claim a reply was stopped when the run was refused outright', async () => {
    TestBed.inject(FakeCreditsClient).answerWith(lowWallet());
    agent.replyWith((input) =>
      failedRun(
        input,
        'INSUFFICIENT_CREDITS: Your AI credits (0.60) do not cover a reply in Intelligent mode.',
      ),
    );
    const fixture = TestBed.createComponent(ChatPage);
    await fixture.whenStable();
    await sendPrompt(fixture.nativeElement, 'hello');
    await settled(TestBed.inject(ConversationDetailStore));
    await fixture.whenStable();

    // Nothing streamed, and the reload after the refusal reports an empty wallet.
    TestBed.inject(FakeCreditsClient).answerWith(exhaustedWallet());
    await fixture.whenStable();
    await fixture.whenStable();

    const banner = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-role="credits-exhausted"]',
    );
    expect(banner?.textContent).toContain('Your AI credits are used up');
    expect(banner?.textContent).not.toContain('The reply was stopped');
  });

  it('says the reply was cut short when the credits ran out during it', async () => {
    agent.replyWith((input) => textReply(input, 'partial'));
    const fixture = TestBed.createComponent(ChatPage);
    await fixture.whenStable();
    await sendPrompt(fixture.nativeElement, 'hello');
    await settled(TestBed.inject(ConversationDetailStore));
    await fixture.whenStable();

    // What the reload after the run brings back: the last step used the rest.
    TestBed.inject(FakeCreditsClient).answerWith(exhaustedWallet());
    await fixture.whenStable();
    await fixture.whenStable();

    expect(
      (fixture.nativeElement as HTMLElement).querySelector(
        '[data-role="credits-exhausted"]',
      )?.textContent,
    ).toContain('The reply was stopped because your credits ran out.');
  });

  it('offers to try again when the credits service cannot be reached', async () => {
    agent.replyWith((input) =>
      failedRun(input, 'CREDITS_UNAVAILABLE: The wallet did not answer.'),
    );
    const fixture = TestBed.createComponent(ChatPage);
    await fixture.whenStable();
    await sendPrompt(fixture.nativeElement, 'hello');
    await settled(TestBed.inject(ConversationDetailStore));
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    const alert = element.querySelector('[data-role="credits-unavailable"]');
    expect(alert?.textContent).toContain(
      'The credits service is unavailable. Try again in a moment.',
    );
    expect(
      element.querySelector('[data-action="credits-retry"]'),
    ).not.toBeNull();
  });

  it('shows nothing about credits while the service reports them as disabled', async () => {
    TestBed.inject(FakeCreditsClient).answerWith(disabledWallet());
    const fixture = TestBed.createComponent(ChatPage);
    await fixture.whenStable();
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('[data-role="credits"]')).toBeNull();
    expect(element.querySelector('[data-role="credits-exhausted"]')).toBeNull();
    expect(
      element.querySelector<HTMLTextAreaElement>('textarea#prompt')?.disabled,
    ).toBe(false);
  });

  it('prevents sending an empty prompt', async () => {
    const fixture = TestBed.createComponent(ChatPage);
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    element.querySelector('form')?.dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    expect(TestBed.inject(ConversationDetailStore).isEmpty()).toBe(true);
  });
});

async function sendPrompt(host: HTMLElement, text: string): Promise<void> {
  const prompt = host.querySelector<HTMLTextAreaElement>('textarea#prompt');
  const form = host.querySelector<HTMLFormElement>('form');
  if (!prompt || !form) {
    throw new Error('Expected the prompt form to render');
  }
  prompt.value = text;
  prompt.dispatchEvent(new Event('input'));
  form.dispatchEvent(new Event('submit'));
  // `submit` validates asynchronously before it calls the store.
  for (let i = 0; i < 10; i++) {
    await new Promise((resolve) => setTimeout(resolve));
  }
}

/** Serves the catalog on `/ai/chat/models`; every other fetch gets an empty object. */
function stubCatalog(catalog: unknown): void {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockImplementation((input: string | URL | Request) =>
        Promise.resolve(
          new Response(
            JSON.stringify(
              String(input).includes('/ai/chat/models') ? catalog : {},
            ),
            { status: 200, headers: { 'content-type': 'application/json' } },
          ),
        ),
      ),
  );
}
