import { TestBed } from '@angular/core/testing';

import { stubAiStream, textDeltas } from '../../../../testing/ai-stream';
import { ChatPage } from './chat-page';
import { ConversationDetailStore } from './conversation-detail-store';

describe('ChatPage', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChatPage],
    }).compileComponents();
  });

  afterEach(() => {
    TestBed.inject(ConversationDetailStore).reset();
    vi.restoreAllMocks();
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

  it('sends the prompt and renders the streamed reply', async () => {
    stubAiStream(textDeltas('Hi ', 'Tuba'));
    const fixture = TestBed.createComponent(ChatPage);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    const prompt =
      element.querySelector<HTMLTextAreaElement>('textarea#prompt');
    const form = element.querySelector<HTMLFormElement>('form');
    if (!prompt || !form) {
      throw new Error('Expected the prompt form to render');
    }

    prompt.value = 'hello';
    prompt.dispatchEvent(new Event('input'));
    form.dispatchEvent(new Event('submit'));
    // `submit` validates asynchronously before it calls the store; the stream
    // then resolves on later macrotasks.
    for (let i = 0; i < 20; i++) {
      await new Promise((resolve) => setTimeout(resolve));
    }
    await fixture.whenStable();
    fixture.detectChanges();

    const turns = element.querySelectorAll('[data-slot="message"]');
    expect(turns).toHaveLength(2);
    expect(turns[0].getAttribute('data-role')).toBe('user');
    expect(turns[0].textContent).toContain('hello');
    expect(turns[1].getAttribute('data-role')).toBe('assistant');
    expect(turns[1].textContent).toContain('Hi Tuba');
    expect(prompt.value).toBe('');
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
