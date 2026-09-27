import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import {
  RESEARCH_ID,
  researchDraft,
  researchSnapshot,
  SECOND_RESEARCH_ID,
} from '../../../testing/research-fixtures';
import {
  cancelResearch,
  getResearch,
  replayResearch,
} from '../data/research-client';
import {
  RESEARCH_POLL_MS,
  useResearchDetailStore,
} from './research-detail-store';

const scope = { uid: 'alice', generation: 1 };
let mockCurrent: typeof scope | null = scope;

jest.mock('../../auth/api/session', () => ({
  useSession: () => ({
    status: 'signed-in',
    scope: mockCurrent,
    generation: 1,
  }),
  session: {
    isCurrent: (value: { uid: string; generation: number }) =>
      mockCurrent?.uid === value.uid &&
      mockCurrent.generation === value.generation,
  },
}));
jest.mock('../data/research-client', () => ({
  getResearch: jest.fn(),
  cancelResearch: jest.fn(),
  replayResearch: jest.fn(),
}));
jest.mock('expo-crypto', () => ({
  randomUUID: () => '9f0f7d4e-5b0a-4d4c-9d7e-8c1f2e3a4b5c',
}));

const get = jest.mocked(getResearch);
const cancel = jest.mocked(cancelResearch);
const replay = jest.mocked(replayResearch);

function setup(requestId = RESEARCH_ID, onReplayed?: (id: string) => void) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(
    ({ id }: { id: string }) => useResearchDetailStore(id, onReplayed),
    { wrapper, initialProps: { id: requestId } },
  );
}

describe('useResearchDetailStore', () => {
  beforeEach(() => {
    mockCurrent = scope;
    jest.clearAllMocks();
  });

  it('polls an active request and stops at review, independently of any chat run', async () => {
    jest.useFakeTimers();
    try {
      get
        .mockResolvedValueOnce(researchSnapshot())
        .mockResolvedValueOnce(researchDraft());
      const { result } = setup();
      await waitFor(() => expect(result.current.research).not.toBeNull());
      expect(result.current.polling).toBe(true);
      await act(async () => {
        jest.advanceTimersByTime(RESEARCH_POLL_MS);
      });
      await waitFor(() =>
        expect(result.current.research?.status).toBe('REVIEW'),
      );
      expect(result.current.polling).toBe(false);
      await act(async () => {
        jest.advanceTimersByTime(RESEARCH_POLL_MS * 3);
      });
      expect(get).toHaveBeenCalledTimes(2);
    } finally {
      jest.useRealTimers();
    }
  });

  it('a confirmed detach wins over the polling snapshot', async () => {
    get.mockResolvedValue(researchSnapshot());
    cancel.mockResolvedValue(researchSnapshot({ requestStatus: 'CANCELLED' }));
    const { result } = setup();
    await waitFor(() => expect(result.current.research).not.toBeNull());
    act(() => result.current.detach());
    await waitFor(() =>
      expect(result.current.research?.requestStatus).toBe('CANCELLED'),
    );
    expect(cancel).toHaveBeenCalledWith(RESEARCH_ID);
    expect(result.current.polling).toBe(false);
  });

  it('reinterprets saved evidence once and follows the new persisted request', async () => {
    const replayed = researchSnapshot({
      id: SECOND_RESEARCH_ID,
      replayedFromWorkId: researchDraft().workId,
    });
    get.mockImplementation(async (id) =>
      id === SECOND_RESEARCH_ID ? replayed : researchDraft(),
    );
    replay.mockResolvedValue(replayed);
    const onReplayed = jest.fn();
    const { result } = setup(RESEARCH_ID, onReplayed);
    await waitFor(() => expect(result.current.research).not.toBeNull());
    act(() => result.current.reinterpret());
    await waitFor(() => expect(result.current.id).toBe(SECOND_RESEARCH_ID));
    expect(replay).toHaveBeenCalledWith(
      RESEARCH_ID,
      '9f0f7d4e-5b0a-4d4c-9d7e-8c1f2e3a4b5c',
    );
    expect(result.current.research?.id).toBe(SECOND_RESEARCH_ID);
    expect(onReplayed).toHaveBeenCalledWith(SECOND_RESEARCH_ID);
  });

  it('keeps the idempotency key when a replay answer is uncertain', async () => {
    get.mockResolvedValue(researchDraft());
    replay.mockRejectedValue(new Error('network'));
    const { result } = setup();
    await waitFor(() => expect(result.current.research).not.toBeNull());
    act(() => result.current.reinterpret());
    await waitFor(() =>
      expect(result.current.reinterpretationError).toBe(
        'Could not reinterpret the saved source. Try again.',
      ),
    );
    act(() => result.current.reinterpret());
    await waitFor(() => expect(replay).toHaveBeenCalledTimes(2));
    expect(replay.mock.calls[1]).toEqual(replay.mock.calls[0]);
  });

  it('shows nothing and loads nothing while signed out', () => {
    mockCurrent = null;
    const { result } = setup();
    expect(result.current.signedIn).toBe(false);
    expect(result.current.research).toBeNull();
    expect(get).not.toHaveBeenCalled();
  });
});
