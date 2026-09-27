import * as Clipboard from 'expo-clipboard';
import { Stack, useNavigation, useRouter } from 'expo-router';
import { DrawerActions } from 'expo-router/react-navigation';
import * as WebBrowser from 'expo-web-browser';
import {
  ArrowDown,
  Brain,
  CircleAlert,
  PanelLeft,
  SquarePen,
} from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import {
  type FlatList,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  View,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '../../../design-system/components/ui/alert';
import { Button } from '../../../design-system/components/ui/button';
import { Icon } from '../../../design-system/components/ui/icon';
import { Skeleton } from '../../../design-system/components/ui/skeleton';
import { Text } from '../../../design-system/components/ui/text';
import { hasContent, type TranscriptItem } from '../data/chat-message';
import type { ChatCardActions, ToolCallView } from '../data/tool-call';
import { toolLabel } from '../util/tool-label';
import { useChatCoordinator } from './chat-coordinator';
import { ChatToolCallOverview } from './tool-adapters/chat-tool-call-overview';
import { AssistantTurn } from './ui/assistant-turn';
import { ChatComposer, MAX_PROMPT_LENGTH } from './ui/chat-composer';
import { ChatEmptyState } from './ui/chat-empty-state';
import { CreditsPill } from './ui/credits-pill';
import { DisclosurePane } from './ui/disclosure-pane';
import { HomeBackdrop } from './ui/home-backdrop';
import { MarkdownText } from './ui/markdown-text';
import { MessageBubble } from './ui/message-bubble';
import { MessageList } from './ui/message-list';
import { ModePicker } from './ui/mode-picker';
import { RunStatus, StoppedMarker } from './ui/run-status';
import { TranscriptFade } from './ui/transcript-fade';

/** The prompt behind the catalog suggestion (web `CATALOG_SUGGESTION`). */
const CATALOG_SUGGESTION =
  'Show me the Ford vehicle catalog. Search the Ford configurations available in Brazil and display them in one interactive catalog, listing Ranger, F-150, Territory, Maverick and Mustang first and the rest of the Ford lineup after them.';
const COMPARISON_SUGGESTION =
  'Compare the Ford F-150 Lariat with the RAM 2500 Laramie, Brazil, model year 2026, on power, transmission and drivetrain.';

const COPIED_FEEDBACK_MS = 1500;
/** Distance from the end that still counts as "at the bottom". */
const AT_BOTTOM_THRESHOLD = 32;
/** How far up the reader must be before the composer folds away. */
const COMPOSER_COLLAPSE_DISTANCE = 160;
/** Room between the last message and the composer (web: 80px). */
const TRANSCRIPT_CLEARANCE = 32;

/**
 * The chat (web `ChatPage`): a new conversation at `/`, a stored one at
 * `/c/<threadId>`. Owns the draft, navigation between threads, sign-in for
 * guests, following new content, and the card actions.
 */
export function ChatScreen({ threadId }: { threadId?: string }) {
  'use no memo';
  const chat = useChatCoordinator();
  const router = useRouter();
  const navigation = useNavigation();
  const listRef = useRef<FlatList<TranscriptItem>>(null);
  const [draft, setDraft] = useState('');
  const [pendingPrompt, setPendingPrompt] = useState<string>();
  // Follow new content while the reader is at the bottom (a ref: the check
  // runs in the same frame as the content change).
  const following = useRef(true);
  const lastOffset = useRef(0);
  const [atBottom, setAtBottom] = useState(true);
  // The composer folds into a slim pill while the reader looks back through
  // the conversation (web `compactComposer`), and unfolds when they return,
  // focus it, or start typing.
  const [readingEarlier, setReadingEarlier] = useState(false);
  const [composerFocused, setComposerFocused] = useState(false);
  const [composerHeight, setComposerHeight] = useState(120);
  const [copiedId, setCopiedId] = useState<string>();
  const insets = useSafeAreaInsets();

  // Route sync: open the stored thread, or start a new one at `/`.
  useEffect(() => {
    if (!chat.ready) return;
    if (threadId) {
      void chat.open(threadId).then((found) => {
        if (!found) router.replace('/');
      });
    } else if (!chat.empty) {
      chat.startNew();
    }
    following.current = true;
    setAtBottom(true);
    setReadingEarlier(false);
    // Only a route or session change re-syncs; the conversation's own
    // updates must not reopen the thread.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId, chat.ready]);

  // A guest's first message waits for sign-in, then goes out.
  useEffect(() => {
    if (chat.ready && pendingPrompt) {
      setPendingPrompt(undefined);
      submit(pendingPrompt);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat.ready, pendingPrompt]);

  const blocked = chat.exhausted || chat.loading;
  const canSend = chat.ready && !chat.running && !blocked;

  function submit(text: string) {
    const prompt = text.trim();
    if (!prompt || prompt.length > MAX_PROMPT_LENGTH) return;
    if (!chat.signedIn) {
      setPendingPrompt(prompt);
      router.push('/sign-in');
      return;
    }
    if (!canSend) return;
    setDraft('');
    following.current = true;
    setAtBottom(true);
    setReadingEarlier(false);
    requestAnimationFrame(() =>
      listRef.current?.scrollToEnd({ animated: true }),
    );
    const wasNew = !threadId;
    void chat.send(prompt);
    if (wasNew) {
      router.replace({
        pathname: '/c/[threadId]',
        params: { threadId: chat.threadId },
      });
    }
  }

  const actions: ChatCardActions = {
    draft: (prompt) =>
      setDraft((current) =>
        current.trim() ? `${current}\n\n${prompt}` : prompt,
      ),
    send: (prompt) => submit(prompt),
    canSend,
  };

  function newChat() {
    chat.startNew();
    router.replace('/');
  }

  async function copy(item: Extract<TranscriptItem, { kind: 'assistant' }>) {
    try {
      await Clipboard.setStringAsync(item.text);
      setCopiedId(item.id);
      setTimeout(() => setCopiedId(undefined), COPIED_FEEDBACK_MS);
    } catch {
      setCopiedId(undefined);
    }
  }

  function openLink(url: string) {
    void WebBrowser.openBrowserAsync(url);
  }

  // Only turns that render take a place (and a gap) in the list.
  const visibleItems = chat.transcript.filter((item) =>
    item.kind === 'user'
      ? true
      : item.kind === 'reasoning'
        ? chat.showActivity
        : hasContent(item, chat.showActivity),
  );

  function goToResearch(researchId: string) {
    const index = visibleItems.findIndex(
      (item) =>
        item.kind === 'assistant' &&
        item.toolCalls.some((call) => researchIdOf(call) === researchId),
    );
    if (index >= 0) {
      listRef.current?.scrollToIndex({ index, viewPosition: 0 });
    }
  }

  function onScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const distance =
      contentSize.height - layoutMeasurement.height - contentOffset.y;
    // Only the reader scrolling up stops following; programmatic scrolls to
    // the end and growing content never move the offset up.
    if (distance <= AT_BOTTOM_THRESHOLD) following.current = true;
    else if (contentOffset.y < lastOffset.current) following.current = false;
    lastOffset.current = contentOffset.y;
    setAtBottom(following.current);
    if (following.current) setReadingEarlier(false);
    else if (distance > COMPOSER_COLLAPSE_DISTANCE) setReadingEarlier(true);
  }

  function scrollToLatest() {
    following.current = true;
    setAtBottom(true);
    setReadingEarlier(false);
    listRef.current?.scrollToEnd({ animated: true });
  }

  function onComposerFocus(focused: boolean) {
    setComposerFocused(focused);
    // Focusing ends the reading pause; leaving keeps the composer open until
    // the transcript scrolls again.
    if (focused) setReadingEarlier(false);
  }

  function follow() {
    if (following.current) listRef.current?.scrollToEnd({ animated: false });
  }

  const lastAssistant = [...chat.transcript]
    .reverse()
    .find((item) => item.kind === 'assistant');

  function renderItem(item: TranscriptItem) {
    if (item.kind === 'user') return <MessageBubble text={item.text} />;
    if (item.kind === 'reasoning') {
      return chat.showActivity ? (
        <DisclosurePane title="Thinking summary">
          <Text className="text-muted-foreground text-xs">
            A summary provided by the model. It may be incomplete.
          </Text>
          <MarkdownText text={item.text} onOpenLink={openLink} />
        </DisclosurePane>
      ) : null;
    }
    if (!hasContent(item, chat.showActivity)) return null;
    const last = item.id === lastAssistant?.id;
    return (
      <AssistantTurn
        item={item}
        showActivity={chat.showActivity}
        renderToolCall={(call) => (
          <ChatToolCallOverview call={call} actions={actions} />
        )}
        footer={!(last && chat.running)}
        copied={copiedId === item.id}
        onCopy={() => void copy(item)}
        onRegenerate={
          last && !chat.running && chat.ready
            ? () => void chat.regenerate()
            : undefined
        }
        onGoToResearch={goToResearch}
        onOpenLink={openLink}
      />
    );
  }

  const header = (
    <Stack.Screen
      options={{
        title: chat.title,
        headerTitle: () => (
          <View className="max-w-48 flex-row items-center gap-3">
            <View className="bg-border h-4 w-px" />
            <Text numberOfLines={1} className="shrink text-sm font-medium">
              {chat.title}
            </Text>
          </View>
        ),
        headerLeft: () => (
          <HeaderButton
            icon={PanelLeft}
            label="Conversations"
            onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
          />
        ),
        headerRight: () => (
          <View className="flex-row">
            <HeaderButton
              icon={Brain}
              label={
                chat.showActivity
                  ? 'Hide thinking and tool activity'
                  : 'Show thinking and tool activity'
              }
              active={chat.showActivity}
              disabled={!chat.signedIn}
              onPress={() => chat.setShowActivity(!chat.showActivity)}
            />
            <HeaderButton
              icon={SquarePen}
              label="New chat"
              disabled={chat.empty || chat.running}
              onPress={newChat}
            />
          </View>
        ),
      }}
    />
  );

  const loadingThread = chat.loading && chat.transcript.length === 0;
  const home = chat.empty && !loadingThread;
  const compact =
    !home &&
    !loadingThread &&
    !atBottom &&
    readingEarlier &&
    !composerFocused &&
    draft.length === 0;

  return (
    <KeyboardAvoidingView behavior="padding" className="bg-background flex-1">
      {header}
      <View className="flex-1">
        {home ? <HomeBackdrop /> : null}
        {loadingThread ? (
          <View
            className="flex-1 gap-7 px-4 pt-4"
            accessibilityLabel="Loading conversation…"
          >
            <Skeleton className="h-11 w-3/5 self-end rounded-3xl" />
            <View className="gap-3">
              <Skeleton className="h-4 w-11/12" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-4 w-3/5" />
            </View>
            <Skeleton className="h-11 w-2/5 self-end rounded-3xl" />
          </View>
        ) : (
          <MessageList
            listRef={listRef}
            items={visibleItems}
            renderItem={renderItem}
            onScroll={onScroll}
            onContentSizeChange={follow}
            bottomInset={composerHeight + (home ? 0 : TRANSCRIPT_CLEARANCE)}
            empty={
              <ChatEmptyState
                disabled={chat.checkingSession || chat.running}
                onCatalog={() => submit(CATALOG_SUGGESTION)}
                onComparison={() => submit(COMPARISON_SUGGESTION)}
              />
            }
            footer={
              chat.running ? (
                <RunStatus label={runStatus(chat.transcript)} />
              ) : chat.stopped ? (
                <StoppedMarker onRetry={() => void chat.regenerate()} />
              ) : undefined
            }
          />
        )}
        {home ? null : <TranscriptFade solidHeight={composerHeight - 16} />}
        {!atBottom && chat.transcript.length > 0 ? (
          <View
            className="absolute inset-x-0 items-center"
            style={{ bottom: composerHeight + 16 }}
            pointerEvents="box-none"
          >
            <Button
              variant="outline"
              size="icon"
              className="bg-background size-11 rounded-full shadow-md"
              onPress={scrollToLatest}
              accessibilityLabel="Scroll to the latest message"
            >
              <Icon as={ArrowDown} className="text-foreground size-5" />
            </Button>
          </View>
        ) : null}
        <View
          className="absolute inset-x-0 bottom-0 px-4 pt-2"
          style={{ paddingBottom: Math.max(12, insets.bottom) }}
          pointerEvents="box-none"
          onLayout={(event) =>
            setComposerHeight(Math.ceil(event.nativeEvent.layout.height))
          }
        >
          <ChatAlerts chat={chat} />
          <ChatComposer
            value={draft}
            onChangeText={setDraft}
            onSubmit={() => submit(draft)}
            onStop={chat.stop}
            onFocusChange={onComposerFocus}
            running={chat.running}
            compact={compact}
            disabled={chat.signedIn ? !canSend : chat.checkingSession}
            controls={
              <>
                {chat.signedIn ? (
                  <ModePicker
                    modes={chat.modes}
                    selected={chat.selectedMode}
                    disabled={chat.running}
                    costOf={chat.modeCost}
                    needsConfirmation={chat.needsConfirmation}
                    messagesCovered={chat.messagesCovered}
                    onChange={chat.setMode}
                  />
                ) : null}
                {chat.wallet ? <CreditsPill wallet={chat.wallet} /> : null}
              </>
            }
          />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

/** Credits and run failures above the composer (web chat page alerts). */
function ChatAlerts({ chat }: { chat: ReturnType<typeof useChatCoordinator> }) {
  if (chat.exhausted) {
    return (
      <View className="pb-2">
        <Alert icon={CircleAlert} variant="destructive">
          <AlertTitle>Credits used up</AlertTitle>
          <AlertDescription>
            Your AI credits are used up. You can keep reading your
            conversations.
          </AlertDescription>
        </Alert>
      </View>
    );
  }
  if (chat.creditsError?.code === 'INSUFFICIENT_CREDITS') {
    return (
      <View className="gap-2 pb-2">
        <Alert icon={CircleAlert} variant="destructive">
          <AlertTitle>Not enough credits</AlertTitle>
          <AlertDescription>{chat.creditsError.message}</AlertDescription>
        </Alert>
        {chat.offersInstant ? (
          <Button
            variant="outline"
            className="min-h-11"
            onPress={() => void chat.switchToInstant()}
            accessibilityLabel="Switch to Instant mode"
          >
            <Text>Switch to Instant mode</Text>
          </Button>
        ) : null}
      </View>
    );
  }
  if (chat.creditsError?.code === 'CREDITS_UNAVAILABLE') {
    return (
      <RetryAlert
        message="The credits service is unavailable. Try again in a moment."
        onRetry={() => void chat.regenerate()}
      />
    );
  }
  if (chat.errorMessage) {
    return (
      <RetryAlert
        message={chat.errorMessage}
        onRetry={() => void chat.retry()}
      />
    );
  }
  return null;
}

function RetryAlert({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <View className="gap-2 pb-2">
      <Alert icon={CircleAlert} variant="destructive">
        <AlertDescription>{message}</AlertDescription>
      </Alert>
      <Button
        variant="outline"
        className="min-h-11"
        onPress={onRetry}
        accessibilityLabel="Try again"
      >
        <Text>Try again</Text>
      </Button>
    </View>
  );
}

function HeaderButton({
  icon,
  label,
  onPress,
  disabled = false,
  active = false,
}: {
  icon: typeof Brain;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <Button
      variant={active ? 'secondary' : 'ghost'}
      size="icon"
      className="size-11"
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={label}
      accessibilityState={{ selected: active, disabled }}
    >
      <Icon as={icon} className="text-foreground size-5" />
    </Button>
  );
}

/** What the assistant is doing, for the status line while a reply streams. */
function runStatus(transcript: TranscriptItem[]): string {
  const last = transcript.at(-1);
  if (last?.kind === 'assistant') {
    const call = last.activities.at(-1);
    return call ? toolLabel(call.name) : 'Writing a response';
  }
  return 'Thinking';
}

/** The research a research tool call opened, from its real result. */
function researchIdOf(call: ToolCallView): string | undefined {
  try {
    const result: unknown = JSON.parse(call.result ?? 'null');
    return result &&
      typeof result === 'object' &&
      'id' in result &&
      typeof result.id === 'string'
      ? result.id
      : undefined;
  } catch {
    return undefined;
  }
}
