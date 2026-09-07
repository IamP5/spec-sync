import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { ZardDialogService } from '@/ui/components/dialog';
import { ZardSidebarService } from '@/ui/components/sidebar';
import { provideZard } from '@/ui/core';

import { provideFakeAuth, testSession } from '../../../../testing/fake-auth';
import {
  FakeChatAgent,
  provideFakeChatAgent,
  settled,
  textReply,
} from '../../../../testing/fake-chat-agent';
import { TEXT_REVEAL_ENABLED } from '../../util/text-reveal';
import { ChatPage } from './chat-page';
import { ConversationDetailStore } from './conversation-detail-store';

describe('public chat authentication flow', () => {
  let agent: FakeChatAgent;
  const close = vi.fn();
  const create = vi.fn(() => ({ close }));
  beforeEach(() => {
    localStorage.clear();
    create.mockClear();
    close.mockClear();
    agent = new FakeChatAgent().replyWith((input) => textReply(input, 'Hello'));
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        ...provideFakeChatAgent(agent),
        ...provideFakeAuth(false),
        provideRouter([
          { path: '', children: [] },
          { path: 'c/:threadId', children: [] },
        ]),
        provideZard(),
        ZardSidebarService,
        { provide: ZardDialogService, useValue: { create } },
        { provide: TEXT_REVEAL_ENABLED, useValue: false },
      ],
    });
  });
  function signIn(uid = 'alice') {
    const session = testSession();
    session.establish(uid, session.begin(uid));
  }
  async function draft() {
    const fixture = TestBed.createComponent(ChatPage);
    await fixture.whenStable();
    const textarea = fixture.nativeElement.querySelector(
      'textarea',
    ) as HTMLTextAreaElement;
    textarea.value = 'Compare Ford vehicles';
    textarea.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    return fixture;
  }
  it.each(['restoring', 'verifying'] as const)(
    'keeps a new chat and its draft available while the account is %s',
    async (status) => {
      const fixture = await draft();
      testSession().invalidate(status);
      await fixture.whenStable();

      const element = fixture.nativeElement as HTMLElement;
      expect(element.querySelector('[data-role="chat-loading"]')).toBeNull();
      expect(element.querySelector('h1')?.textContent).toContain('New chat');
      expect(element.querySelector('textarea')?.value).toBe(
        'Compare Ford vehicles',
      );

      testSession().invalidate();
      await fixture.whenStable();
      expect(element.querySelector('textarea')?.value).toBe(
        'Compare Ford vehicles',
      );
      expect(agent.runs).toHaveLength(0);
    },
  );
  it('lets guests draft without creating a conversation or sending AI requests', async () => {
    const fixture = await draft();
    expect(agent.runs).toHaveLength(0);
    expect(
      fixture.nativeElement.querySelector('[data-action="catalog"]'),
    ).not.toBeNull();
    expect(
      fixture.nativeElement.querySelector('.chat-composer'),
    ).not.toBeNull();
    expect(create).not.toHaveBeenCalled();
  });
  it('resumes an explicitly requested send once after successful sign-in', async () => {
    const fixture = await draft();
    fixture.nativeElement
      .querySelector('form')
      .dispatchEvent(new Event('submit', { cancelable: true }));
    expect(create).toHaveBeenCalledOnce();
    expect(agent.runs).toHaveLength(0);
    signIn();
    await fixture.whenStable();
    await settled(TestBed.inject(ConversationDetailStore));
    await fixture.whenStable();
    expect(agent.runs).toHaveLength(1);
    expect(agent.runs[0].messages[0]).toMatchObject({
      content: 'Compare Ford vehicles',
    });
    const session = testSession();
    session.establish('alice', session.begin('alice'));
    await fixture.whenStable();
    expect(agent.runs).toHaveLength(1);
    expect(close).toHaveBeenCalled();
  });
  it('keeps a draft on sidebar sign-in without automatically sending', async () => {
    const fixture = await draft();
    const composer = fixture.nativeElement.querySelector('textarea');
    signIn();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('textarea')).toBe(composer);
    expect(agent.runs).toHaveLength(0);
    expect(fixture.nativeElement.querySelector('textarea').value).toBe(
      'Compare Ford vehicles',
    );
  });
  it('preserves a cancelled draft but removes the pending send intent', async () => {
    const fixture = await draft();
    const dialogService = TestBed.inject(ZardDialogService);
    const spy = vi.spyOn(dialogService, 'create');
    fixture.nativeElement
      .querySelector('form')
      .dispatchEvent(new Event('submit', { cancelable: true }));
    const options = spy.mock.calls[spy.mock.calls.length - 1]?.[0];
    const cancel = options?.zOnCancel;
    if (typeof cancel === 'function') Reflect.apply(cancel, undefined, []);
    signIn();
    await fixture.whenStable();
    expect(agent.runs).toHaveLength(0);
    expect(fixture.nativeElement.querySelector('textarea').value).toBe(
      'Compare Ford vehicles',
    );
  });
  it('clears account state even when logout and the next login happen in one tick', async () => {
    const fixture = await draft();
    signIn();
    await fixture.whenStable();
    const session = testSession();
    session.invalidate();
    signIn('bob');
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('textarea').value).toBe('');
    expect(TestBed.inject(ConversationDetailStore).messages()).toEqual([]);
  });
});
