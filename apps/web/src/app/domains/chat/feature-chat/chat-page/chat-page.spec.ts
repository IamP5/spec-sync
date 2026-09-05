import { TestBed } from '@angular/core/testing';

import {
  FakeChatAgent,
  provideFakeChatAgent,
  settled,
  textReply,
  toolCallReply,
} from '../../../../testing/fake-chat-agent';
import { PRESENT_REQUIREMENT_DRAFT_TOOL } from '../../data/requirement-draft';
import { REQUIREMENT_QUALITY_TOOL } from '../../data/requirement-quality';
import { ChatPage } from './chat-page';
import { ConversationDetailStore } from './conversation-detail-store';

describe('ChatPage', () => {
  let agent: FakeChatAgent;

  beforeEach(async () => {
    agent = new FakeChatAgent();
    await TestBed.configureTestingModule({
      imports: [ChatPage],
      providers: provideFakeChatAgent(agent),
    }).compileComponents();
  });

  it('renders the empty conversation and the prompt', async () => {
    const fixture = TestBed.createComponent(ChatPage);
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('h1')?.textContent).toContain('assistant');
    expect(element.querySelector('textarea#prompt')).not.toBeNull();
    expect(element.querySelector('[role="log"]')?.textContent).toContain(
      'Ask about SpecSync',
    );
  });

  it('sends the prompt and renders the streamed reply as Markdown', async () => {
    agent.replyWith((input) => textReply(input, 'Hi **Tuba**', '\n\n- one'));
    const fixture = TestBed.createComponent(ChatPage);
    fixture.detectChanges();

    await sendPrompt(fixture.nativeElement, 'hello');
    await settled(TestBed.inject(ConversationDetailStore));
    await fixture.whenStable();
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    const turns = element.querySelectorAll('[data-slot="message"]');
    expect(turns).toHaveLength(2);
    expect(turns[0].getAttribute('data-role')).toBe('user');
    expect(turns[0].textContent).toContain('hello');
    expect(turns[1].getAttribute('data-role')).toBe('assistant');
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
    fixture.detectChanges();

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
    fixture.detectChanges();

    await sendPrompt(
      fixture.nativeElement,
      'review: The system shall be fast.',
    );
    await settled(TestBed.inject(ConversationDetailStore));
    await fixture.whenStable();
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    const card = element.querySelector('app-requirement-quality-card');
    expect(card?.textContent).toContain('90/100');
    expect(card?.textContent).toContain('"fast" is not measurable.');
    expect(element.textContent).toContain('Replace "fast" with a number.');
  });

  it('shows a validation alert when the prompt is empty', () => {
    const fixture = TestBed.createComponent(ChatPage);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    element.querySelector('form')?.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

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
