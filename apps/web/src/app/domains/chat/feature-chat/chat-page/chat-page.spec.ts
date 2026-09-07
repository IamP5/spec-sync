import { BaseEvent, EventType } from '@ag-ui/client';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { ZardSidebarService } from '@/ui/components/sidebar';
import { provideZard } from '@/ui/core';

import {
  FakeChatAgent,
  provideFakeChatAgent,
  settled,
  textReply,
  toolCallReply,
} from '../../../../testing/fake-chat-agent';
import { matrix } from '../../../../testing/vehicle-fixtures';
import { TEXT_REVEAL_ENABLED } from '../../util/text-reveal';
import { PreferencesDetailStore } from '../settings-edit/preferences-detail-store';
import { ChatPage } from './chat-page';
import { ConversationDetailStore } from './conversation-detail-store';

const MODEL_CATALOG = {
  defaultModelId: 'gemini-2.5-flash',
  models: [
    { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', provider: 'vertex' },
    { id: 'gpt-5.6-luna', label: 'GPT 5.6 Luna', provider: 'openai' },
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
        ...provideFakeChatAgent(agent),
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

  it('renders the empty conversation and the prompt', async () => {
    const fixture = TestBed.createComponent(ChatPage);
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('h1')?.textContent).toContain('New chat');
    expect(element.querySelector('textarea#prompt')).not.toBeNull();
    expect(element.querySelector('[aria-label="Suggestions"]')).not.toBeNull();
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

  it('offers the models the service reports and sends the picked one with the run', async () => {
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
      // The pill names the effort; the model sits one level in.
      expect(trigger?.getAttribute('aria-label')).toContain(
        'Model: Gemini 2.5 Flash',
      );

      trigger?.click();
      await fixture.whenStable();
      const modelRow = document.querySelector<HTMLElement>(
        '[data-role="model-select"]',
      );
      expect(modelRow?.textContent).toContain('Gemini 2.5 Flash');
      modelRow?.click();
      await fixture.whenStable();
      const option = document.querySelector<HTMLElement>(
        '[data-role="model-option"][data-value="gpt-5.6-luna"]',
      );
      expect(option?.textContent).toContain('GPT 5.6 Luna');
      // Options are grouped by provider.
      expect(option?.previousElementSibling?.getAttribute('data-role')).toBe(
        'model-group',
      );
      expect(option?.previousElementSibling?.textContent).toContain('OpenAI');
      option?.click();
      await fixture.whenStable();
      expect(TestBed.inject(PreferencesDetailStore).model()).toBe(
        'gpt-5.6-luna',
      );
      // Picking a model returns to the effort view, now naming the new model.
      expect(
        document.querySelector('[data-role="model-select"]')?.textContent,
      ).toContain('GPT 5.6 Luna');
      expect(trigger?.getAttribute('aria-label')).toContain(
        'Model: GPT 5.6 Luna',
      );
      expect(localStorage.getItem('specsync.chat.preferences.v1')).toContain(
        'gpt-5.6-luna',
      );

      await sendPrompt(element, 'Hi');
      await settled(TestBed.inject(ConversationDetailStore));
      expect(agent.runs[agent.runs.length - 1]?.forwardedProps).toMatchObject({
        model: 'gpt-5.6-luna',
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
      // Nothing picked yet: the service default is shown.
      expect(trigger?.textContent).toContain('Auto');

      trigger?.click();
      await fixture.whenStable();
      const track = document.querySelector<HTMLElement>(
        '[data-role="effort-select"]',
      );
      expect(track?.textContent).toContain('Auto');
      const option = track?.querySelector<HTMLElement>(
        '[data-role="effort-option"][data-value="high"]',
      );
      expect(option?.getAttribute('aria-label')).toBe('High');
      option?.click();
      await fixture.whenStable();
      expect(TestBed.inject(PreferencesDetailStore).effort()).toBe('high');
      expect(option?.getAttribute('aria-checked')).toBe('true');
      expect(track?.textContent).toContain('High');
      // The panel stays open, like a slider; the pill follows the pick.
      expect(trigger?.textContent).toContain('High');
      expect(localStorage.getItem('specsync.chat.preferences.v1')).toContain(
        '"effort":"high"',
      );

      // Arrow keys move the selection like a radio group.
      option?.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }),
      );
      await fixture.whenStable();
      expect(TestBed.inject(PreferencesDetailStore).effort()).toBe('low');

      await sendPrompt(element, 'Hi');
      await settled(TestBed.inject(ConversationDetailStore));
      expect(agent.runs[agent.runs.length - 1]?.forwardedProps).toMatchObject({
        effort: 'low',
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('names the model on the pill while the service offers no efforts', async () => {
    stubCatalog({ ...MODEL_CATALOG, efforts: [] });
    try {
      const fixture = TestBed.createComponent(ChatPage);
      await fixture.whenStable();
      await fixture.whenStable();
      const trigger = (
        fixture.nativeElement as HTMLElement
      ).querySelector<HTMLElement>('[data-role="run-options"]');
      expect(trigger?.textContent).toContain('Gemini 2.5 Flash');
      trigger?.click();
      await fixture.whenStable();
      expect(document.querySelector('[data-role="effort-select"]')).toBeNull();
      // The panel opens straight on the model list.
      expect(
        document.querySelector(
          '[data-role="model-option"][data-value="gpt-5.6-luna"]',
        ),
      ).not.toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('hides the model row while the service offers a single model', async () => {
    stubCatalog({ ...MODEL_CATALOG, models: MODEL_CATALOG.models.slice(0, 1) });
    try {
      const fixture = TestBed.createComponent(ChatPage);
      await fixture.whenStable();
      await fixture.whenStable();
      const trigger = (
        fixture.nativeElement as HTMLElement
      ).querySelector<HTMLElement>('[data-role="run-options"]');
      expect(trigger?.getAttribute('aria-label')).not.toContain('Model');
      trigger?.click();
      await fixture.whenStable();
      expect(document.querySelector('[data-role="model-select"]')).toBeNull();
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
      models: MODEL_CATALOG.models.slice(0, 1),
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
