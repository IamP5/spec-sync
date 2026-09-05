import { BaseEvent, EventType } from '@ag-ui/client';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { ZardSidebarService } from '@/ui/components/sidebar';

import {
  FakeChatAgent,
  provideFakeChatAgent,
  settled,
  textReply,
  toolCallReply,
} from '../../../../testing/fake-chat-agent';
import { PRESENT_REQUIREMENT_DRAFT_TOOL } from '../../data/requirement-draft';
import { REQUIREMENT_QUALITY_TOOL } from '../../data/requirement-quality';
import { TEXT_REVEAL_ENABLED } from '../../util/text-reveal';
import { ChatPage } from './chat-page';
import { ConversationDetailStore } from './conversation-detail-store';

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
        // The page normally sits inside the shell's sidebar provider.
        ZardSidebarService,
        // The DOM is asserted right after the store settles.
        { provide: TEXT_REVEAL_ENABLED, useValue: false },
      ],
    }).compileComponents();
  });

  it('renders the empty conversation and the prompt', async () => {
    const fixture = TestBed.createComponent(ChatPage);
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('h1')?.textContent).toContain('New chat');
    expect(element.querySelector('textarea#prompt')).not.toBeNull();
    expect(element.querySelector('[role="log"]')?.textContent).toContain(
      'Ask about SpecSync',
    );
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
      (fixture.nativeElement as HTMLElement).querySelector('[role="log"]')
        ?.textContent,
    ).toContain('Ask about SpecSync');
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

  it('advertises the frontend tools to the agent', async () => {
    agent.replyWith((input) => textReply(input, 'ok'));
    const fixture = TestBed.createComponent(ChatPage);
    await fixture.whenStable();

    await sendPrompt(fixture.nativeElement, 'hello');
    await settled(TestBed.inject(ConversationDetailStore));

    expect(agent.runs[0].tools.map((tool) => tool.name)).toContain(
      PRESENT_REQUIREMENT_DRAFT_TOOL,
    );
  });

  it('renders a server tool call as the requirement quality card', async () => {
    agent.replyWith((input) =>
      toolCallReply(
        input,
        REQUIREMENT_QUALITY_TOOL,
        { requirement: 'The system shall be fast.' },
        {
          requirement: 'The system shall be fast.',
          score: 90,
          verdict: 'good',
          findings: [
            {
              rule: 'ambiguous-term',
              severity: 'warning',
              message: '"fast" is not measurable.',
            },
          ],
        },
        'Replace "fast" with a number.',
      ),
    );
    const fixture = TestBed.createComponent(ChatPage);
    await fixture.whenStable();

    await sendPrompt(
      fixture.nativeElement,
      'review: The system shall be fast.',
    );
    await settled(TestBed.inject(ConversationDetailStore));
    await fixture.whenStable();
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    const card = element.querySelector('app-requirement-quality-card');
    expect(card?.textContent).toContain('90/100');
    expect(card?.textContent).toContain('"fast" is not measurable.');
    expect(element.textContent).toContain('Replace "fast" with a number.');
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
        REQUIREMENT_QUALITY_TOOL,
        { requirement: 'A requirement' },
        {
          requirement: 'A requirement',
          score: 90,
          verdict: 'good',
          findings: [],
        },
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
      'A requirement',
    );
    element
      .querySelector<HTMLButtonElement>(
        '[aria-label="Show thinking and tool activity"]',
      )
      ?.click();
    await fixture.whenStable();
    expect(element.querySelector('[data-role="tool-activity"]')).toBeNull();
    expect(
      element.querySelector('app-requirement-quality-card')?.textContent,
    ).toContain('90/100');
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
    expect(turns[0].textContent).toContain(suggestion?.textContent?.trim());
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

  it('keeps a long answer readable and scrolls to a subsequent user prompt', async () => {
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
      scrollHeight: { value: 1200 },
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
    expect(log.scrollTop).not.toBe(1200);

    await sendPrompt(element, 'second');
    await settled(TestBed.inject(ConversationDetailStore));
    await fixture.whenStable();
    expect(log.scrollTop).toBe(1200);
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
