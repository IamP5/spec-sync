import { ApplicationRef, resource } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

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
import { ThreadSearchStore } from './thread-search-store';

type ThreadSearch = InstanceType<typeof ThreadSearchStore>;

/**
 * The thread list is read once and then kept as a cache that follows every
 * change the browser makes. These tests count the reads of the service to
 * prove that; the store is exercised through the coordinator, as the page
 * and the sidebar use it.
 */
describe('ThreadSearchStore', () => {
  let agent: FakeChatAgent;
  let threads: FakeThreadClient;
  let reads: number;

  beforeEach(async () => {
    localStorage.clear();
    reads = 0;
    agent = new FakeChatAgent().replyWith((input) => textReply(input, 'ok'));
    await TestBed.configureTestingModule({
      providers: [
        provideFakeUser(),
        provideFakeAuth(),
        ...provideFakeChatAgent(agent),
        ...provideFakeThreads(),
        provideRouter([]),
        provideZard(),
      ],
    }).compileComponents();
    threads = TestBed.inject(FakeThreadClient);
    // The session exists before any store does, as in the running app.
    testSession();
    // Reads only when asked, unlike the fake's own resource, which follows
    // every write to the fake; this is how the real `httpResource` behaves.
    vi.spyOn(threads, 'listResource').mockImplementation(() =>
      resource({
        loader: () => {
          reads++;
          return Promise.resolve(
            threads.all().map(({ id, title, createdAt, updatedAt }) => ({
              id,
              title,
              createdAt,
              updatedAt,
            })),
          );
        },
        defaultValue: [] as ChatThreadSummary[],
      }),
    );
  });

  /** Flushes effects (which start resource loads) and waits for the loads. */
  async function settle(): Promise<void> {
    TestBed.tick();
    await TestBed.inject(ApplicationRef).whenStable();
  }

  async function loaded(): Promise<ThreadSearch> {
    const store = TestBed.inject(ThreadSearchStore);
    await settle();
    expect(reads).toBe(1);
    expect(store.historyIsLoading()).toBe(false);
    return store;
  }

  function ids(store: ThreadSearch): string[] {
    return store.groups().flatMap((group) => group.threads.map((t) => t.id));
  }

  it('shows a new conversation at once and reads the list once for its title', async () => {
    threads.seed(storedThread('old', 'Older question', 1));
    const store = await loaded();
    const coordinator = TestBed.inject(ChatCoordinator);
    const conversation = TestBed.inject(ConversationDetailStore);

    const sending = coordinator.send('# Compare\nRanger versions');
    const id = conversation.threadId();
    expect(ids(store)).toEqual([id, 'old']);
    expect(store.groups()[0].threads[0].title).toBe('Compare');
    expect(reads).toBe(1);
    // What the service stored during the run, with the title it generated.
    threads.record(storedThread(id, 'Ranger comparison', Date.now()));
    await sending;
    await settle();
    expect(reads).toBe(2);
    expect(store.groups()[0].threads[0].title).toBe('Ranger comparison');

    await coordinator.send('And the Maverick?');
    await settle();
    expect(reads).toBe(2);
    expect(ids(store)).toEqual([conversation.threadId(), 'old']);
  });

  it('moves a continued conversation to the top without reading again', async () => {
    threads.seed(
      storedThread('t-1', 'First', 1, [
        { id: 'm-1', role: 'user', content: 'Compare the Ranger versions' },
      ]),
      storedThread('t-2', 'Second', 2),
    );
    const store = await loaded();
    const coordinator = TestBed.inject(ChatCoordinator);
    await coordinator.open('t-1');
    expect(ids(store)).toEqual(['t-2', 't-1']);

    await coordinator.send('more');
    await settle();

    expect(ids(store)).toEqual(['t-1', 't-2']);
    expect(reads).toBe(1);
  });

  it('applies rename, remove and clear from the confirmed writes', async () => {
    threads.seed(
      storedThread('t-1', 'First', 1),
      storedThread('t-2', 'Second', 2),
      storedThread('t-3', 'Third', 3),
    );
    const store = await loaded();
    const coordinator = TestBed.inject(ChatCoordinator);

    await coordinator.rename('t-2', 'Renamed');
    expect(store.threads().find((t) => t.id === 't-2')?.title).toBe('Renamed');

    await coordinator.remove('t-3');
    expect(ids(store)).toEqual(['t-2', 't-1']);

    await coordinator.clear();
    await settle();
    expect(store.isEmpty()).toBe(true);
    expect(reads).toBe(1);
  });
});
