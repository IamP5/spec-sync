import { resource } from '@angular/core';
import { DeferBlockBehavior, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { ZardSidebarService } from '@/ui/components/sidebar';
import { provideZard } from '@/ui/core';

import { provideFakeAuth, testSession } from '../../../../testing/fake-auth';
import {
  FakeChatAgent,
  provideFakeChatAgent,
  textReply,
} from '../../../../testing/fake-chat-agent';
import {
  FakeThreadClient,
  provideFakeThreads,
  storedThread,
} from '../../../../testing/fake-threads';
import { provideFakeUser } from '../../../../testing/fake-user';
import { ChatThreadSummary } from '../../data/thread';
import { ChatCoordinator } from '../chat-coordinator';
import { ConversationDetailStore } from '../chat-page/conversation-detail-store';
import { ThreadSearch } from './thread-search';
import { ThreadSearchStore } from './thread-search-store';

describe('ThreadSearch', () => {
  let agent: FakeChatAgent;
  let threads: FakeThreadClient;

  beforeEach(async () => {
    localStorage.clear();
    agent = new FakeChatAgent();
    await TestBed.configureTestingModule({
      deferBlockBehavior: DeferBlockBehavior.Playthrough,
      imports: [ThreadSearch],
      providers: [
        provideFakeUser(),
        provideFakeAuth(),
        ...provideFakeChatAgent(agent),
        ...provideFakeThreads(),
        provideRouter([]),
        provideZard(),
        ZardSidebarService,
      ],
    }).compileComponents();
    threads = TestBed.inject(FakeThreadClient);
  });

  async function render() {
    const fixture = TestBed.createComponent(ThreadSearch);
    await fixture.whenStable();
    return fixture;
  }

  function titles(fixture: { nativeElement: unknown }): (string | undefined)[] {
    return Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll(
        '[data-role="thread"] a',
      ),
    ).map((anchor) => anchor.textContent?.trim());
  }

  it('shows history skeletons instead of an empty state until threads arrive', async () => {
    let finish!: (threads: ChatThreadSummary[]) => void;
    vi.spyOn(threads, 'listResource').mockImplementation(() =>
      resource({
        loader: () =>
          new Promise<ChatThreadSummary[]>((resolve) => {
            finish = resolve;
          }),
        defaultValue: [],
      }),
    );
    const fixture = TestBed.createComponent(ThreadSearch);
    const element = fixture.nativeElement as HTMLElement;
    await vi.waitFor(() =>
      expect(
        element.querySelector('[data-role="history-loading"] z-skeleton'),
      ).not.toBeNull(),
    );
    expect(element.querySelector('[data-role="history-empty"]')).toBeNull();
    expect(titles(fixture)).toEqual([]);

    finish([storedThread('loaded', 'Loaded conversation')]);
    await fixture.whenStable();
    expect(element.querySelector('[data-role="history-loading"]')).toBeNull();
    expect(titles(fixture)).toEqual(['Loaded conversation']);
  });

  it('keeps the cached list on screen while the history reloads', async () => {
    const answers: ((threads: ChatThreadSummary[]) => void)[] = [];
    vi.spyOn(threads, 'listResource').mockImplementation(() =>
      resource({
        loader: () =>
          new Promise<ChatThreadSummary[]>((resolve) => {
            answers.push(resolve);
          }),
        defaultValue: [],
      }),
    );
    const fixture = TestBed.createComponent(ThreadSearch);
    const element = fixture.nativeElement as HTMLElement;
    await vi.waitFor(() => expect(answers).toHaveLength(1));
    answers[0]([storedThread('loaded', 'Loaded conversation')]);
    await fixture.whenStable();
    expect(titles(fixture)).toEqual(['Loaded conversation']);

    const store = TestBed.inject(ThreadSearchStore);
    store.load();
    await vi.waitFor(() => expect(store.historyStatus()).toBe('reloading'));
    fixture.detectChanges();

    expect(element.querySelector('[data-role="history-loading"]')).toBeNull();
    expect(titles(fixture)).toEqual(['Loaded conversation']);
  });

  it('shows history skeletons while the session is restored', async () => {
    const fixture = await render();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('[data-role="history-loading"]')).toBeNull();

    testSession().invalidate('restoring');
    await fixture.whenStable();
    expect(
      element.querySelector('[data-role="history-loading"] z-skeleton'),
    ).not.toBeNull();
    expect(element.querySelector('[data-role="history-empty"]')).toBeNull();

    testSession().invalidate();
    await fixture.whenStable();
    expect(element.querySelector('[data-role="history-loading"]')).toBeNull();
    expect(element.querySelector('[data-role="history-empty"]')).not.toBeNull();
  });

  it('lists the conversations the service stores, newest on top', async () => {
    threads.seed(
      storedThread('t-1', 'First question', 1),
      storedThread('t-2', 'Second question', 2),
    );
    agent.replyWith((input) => textReply(input, 'ok'));
    await TestBed.inject(ChatCoordinator).open('t-2');

    const fixture = await render();

    expect(titles(fixture)).toEqual(['Second question', 'First question']);
    expect(
      (fixture.nativeElement as HTMLElement).querySelector(
        '[data-role="thread"] a[aria-current="page"]',
      )?.textContent,
    ).toContain('Second question');
  });

  it('filters the list with the search box', async () => {
    threads.seed(
      storedThread('t-1', 'Password reset', 1),
      storedThread('t-2', 'Login throttling', 2),
    );
    const fixture = await render();

    const search = (
      fixture.nativeElement as HTMLElement
    ).querySelector<HTMLInputElement>('input[type="search"]');
    search!.value = 'login';
    search!.dispatchEvent(new Event('input'));
    await fixture.whenStable();

    expect(titles(fixture)).toEqual(['Login throttling']);
  });

  it('renames a thread inline', async () => {
    threads.seed(storedThread('t-1', 'Draft'));
    agent.replyWith((input) => textReply(input, 'ok'));
    await TestBed.inject(ChatCoordinator).open('t-1');
    const fixture = await render();

    (
      fixture.componentInstance as unknown as { onRename(t: unknown): void }
    ).onRename({ id: 't-1', title: 'Draft' });
    await fixture.whenStable();
    const input = (
      fixture.nativeElement as HTMLElement
    ).querySelector<HTMLInputElement>('input[aria-label="Conversation title"]');
    expect(input).not.toBeNull();
    input!.value = 'Password policy';
    input!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await fixture.whenStable();

    expect(threads.all()[0]?.title).toBe('Password policy');
    expect(TestBed.inject(ConversationDetailStore).title()).toBe(
      'Password policy',
    );
    expect(titles(fixture)).toEqual(['Password policy']);
  });

  it('removes the open thread through the coordinator and starts over', async () => {
    threads.seed(storedThread('t-1', 'Doomed'));
    const coordinator = TestBed.inject(ChatCoordinator);
    await coordinator.open('t-1');
    await render();

    await expect(coordinator.remove('t-1')).resolves.toBe(true);

    expect(TestBed.inject(ThreadSearchStore).isEmpty()).toBe(true);
    expect(TestBed.inject(ConversationDetailStore).isEmpty()).toBe(true);
    expect(TestBed.inject(ConversationDetailStore).threadId()).not.toBe('t-1');
    expect(threads.all()).toEqual([]);
  });
});
