import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { ZardSidebarService } from '@/ui/components/sidebar';
import { provideZard } from '@/ui/core';

import {
  FakeChatAgent,
  provideFakeChatAgent,
  textReply,
} from '../../../../testing/fake-chat-agent';
import { ThreadClient } from '../../data/thread-client';
import { ChatCoordinator } from '../chat-coordinator';
import { ConversationDetailStore } from '../chat-page/conversation-detail-store';
import { ThreadSearch } from './thread-search';
import { ThreadSearchStore } from './thread-search-store';

describe('ThreadSearch', () => {
  let agent: FakeChatAgent;

  beforeEach(async () => {
    localStorage.clear();
    agent = new FakeChatAgent();
    await TestBed.configureTestingModule({
      imports: [ThreadSearch],
      providers: [
        ...provideFakeChatAgent(agent),
        provideRouter([]),
        provideZard(),
        ZardSidebarService,
      ],
    }).compileComponents();
  });

  it('lists the conversations the coordinator sends, newest on top', async () => {
    agent.replyWith((input) => textReply(input, 'ok'));
    const coordinator = TestBed.inject(ChatCoordinator);
    await coordinator.send('First question');
    coordinator.startNew();
    await coordinator.send('Second question');

    const fixture = TestBed.createComponent(ThreadSearch);
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    const titles = Array.from(
      element.querySelectorAll('[data-role="thread"] a'),
    ).map((a) => a.textContent?.trim());
    expect(titles).toEqual(['Second question', 'First question']);
    expect(
      element.querySelector('[data-role="thread"] a[aria-current="page"]')
        ?.textContent,
    ).toContain('Second question');
  });

  it('filters the list with the search box', async () => {
    agent.replyWith((input) => textReply(input, 'ok'));
    const coordinator = TestBed.inject(ChatCoordinator);
    await coordinator.send('Password reset');
    coordinator.startNew();
    await coordinator.send('Login throttling');
    const fixture = TestBed.createComponent(ThreadSearch);
    await fixture.whenStable();

    const search = (
      fixture.nativeElement as HTMLElement
    ).querySelector<HTMLInputElement>('input[type="search"]');
    search!.value = 'login';
    search!.dispatchEvent(new Event('input'));
    await fixture.whenStable();

    const titles = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll(
        '[data-role="thread"] a',
      ),
    ).map((a) => a.textContent?.trim());
    expect(titles).toEqual(['Login throttling']);
  });

  it('renames a thread inline', async () => {
    agent.replyWith((input) => textReply(input, 'ok'));
    const coordinator = TestBed.inject(ChatCoordinator);
    await coordinator.send('Draft');
    const id = TestBed.inject(ConversationDetailStore).threadId();
    const fixture = TestBed.createComponent(ThreadSearch);
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    (
      fixture.componentInstance as unknown as { onRename(t: unknown): void }
    ).onRename({ id, title: 'Draft' });
    await fixture.whenStable();
    const input = element.querySelector<HTMLInputElement>(
      'input[aria-label="Conversation title"]',
    );
    expect(input).not.toBeNull();
    input!.value = 'Password policy';
    input!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await fixture.whenStable();

    expect(TestBed.inject(ThreadClient).find(id)?.title).toBe(
      'Password policy',
    );
    expect(TestBed.inject(ConversationDetailStore).title()).toBe(
      'Password policy',
    );
    expect(
      element.querySelector('[data-role="thread"] a')?.textContent,
    ).toContain('Password policy');
  });

  it('opens the account menu with the theme and settings entries', async () => {
    const fixture = TestBed.createComponent(ThreadSearch);
    await fixture.whenStable();

    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('[data-action="user-menu"]')
      ?.click();
    await fixture.whenStable();

    const menu = document.querySelector('[role="menu"]');
    expect(menu?.textContent).toContain('Settings');
    const appearance = menu?.querySelector<HTMLButtonElement>(
      '[data-slot="dropdown-menu-sub-trigger"]',
    );
    appearance?.click();
    await fixture.whenStable();
    expect(document.querySelectorAll('[role="menuitemradio"]')).toHaveLength(3);
  });

  it('navigates to the root for a new chat', async () => {
    const fixture = TestBed.createComponent(ThreadSearch);
    await fixture.whenStable();
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigateByUrl');

    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('[data-action="new-chat"]')
      ?.click();

    expect(navigate).toHaveBeenCalledWith('/');
  });

  it('removes the open thread through the coordinator and starts over', async () => {
    agent.replyWith((input) => textReply(input, 'ok'));
    const coordinator = TestBed.inject(ChatCoordinator);
    await coordinator.send('Doomed');
    const id = TestBed.inject(ConversationDetailStore).threadId();

    expect(coordinator.remove(id)).toBe(true);

    expect(TestBed.inject(ThreadSearchStore).isEmpty()).toBe(true);
    expect(TestBed.inject(ConversationDetailStore).isEmpty()).toBe(true);
    expect(TestBed.inject(ConversationDetailStore).threadId()).not.toBe(id);
  });
});
