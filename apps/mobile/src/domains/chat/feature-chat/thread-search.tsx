import { PortalHost } from '@rn-primitives/portal';
import { useRouter } from 'expo-router';
import { useDrawerStatus } from 'expo-router/drawer';
import { Search, Settings, SquarePen } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, SectionList, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FordScript } from '../../../design-system/components/brand/ford-script';
import { Button } from '../../../design-system/components/ui/button';
import { Icon } from '../../../design-system/components/ui/icon';
import { Input } from '../../../design-system/components/ui/input';
import { Skeleton } from '../../../design-system/components/ui/skeleton';
import { Text } from '../../../design-system/components/ui/text';
import { useSession } from '../../auth/api/session';
import type { ChatThreadSummary } from '../data/thread';
import { useThreadDetailStore } from './thread-detail-store';
import { useThreadSearchStore } from './thread-search-store';
import { ConfirmDeletePane } from './ui/confirm-delete-pane';
import { ThreadRowPane } from './ui/thread-row-pane';

/** Dialogs of the side panel render above it, not under the chat. */
const PORTAL_HOST = 'thread-search';

/**
 * The chat list in the side panel (web sidebar `ThreadSearch`):
 * conversations grouped by date, filtered by title, opened, renamed and
 * deleted. `activeId` is the thread the chat shows beside it; `onClose`
 * slides the panel away once a conversation opens.
 */
export function ThreadSearch({
  activeId,
  onClose,
}: {
  activeId?: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const signedIn = useSession().scope !== null;
  const threads = useThreadSearchStore();
  const detail = useThreadDetailStore();
  const [renaming, setRenaming] = useState<string>();
  const [deleting, setDeleting] = useState<ChatThreadSummary>();
  // Only a pull shows the spinner; the refresh on open stays quiet.
  const [pulling, setPulling] = useState(false);
  const insets = useSafeAreaInsets();

  // The list refreshes each time the panel opens, as the web sidebar does
  // on navigation, so a conversation started meanwhile shows up.
  const drawerOpen = useDrawerStatus() === 'open';
  const [wasOpen, setWasOpen] = useState(drawerOpen);
  if (wasOpen !== drawerOpen) {
    setWasOpen(drawerOpen);
    if (drawerOpen && signedIn) threads.refresh();
  }

  function open(id: string) {
    onClose();
    if (id !== activeId)
      router.replace({ pathname: '/c/[threadId]', params: { threadId: id } });
  }

  function newChat() {
    onClose();
    if (activeId) router.replace('/');
  }

  async function rename(thread: ChatThreadSummary, title: string) {
    setRenaming(undefined);
    const next = title.trim();
    if (!next || next === thread.title) return;
    try {
      await detail.rename(thread.id, next);
    } finally {
      threads.refresh();
    }
  }

  async function remove(thread: ChatThreadSummary) {
    setDeleting(undefined);
    try {
      await detail.remove(thread.id);
      if (thread.id === activeId) newChat();
    } finally {
      threads.refresh();
    }
  }

  const settings = (
    <Pressable
      role="button"
      accessibilityLabel="Settings"
      onPress={() => router.push('/settings')}
      className="border-sidebar-border active:bg-sidebar-accent min-h-14 flex-row items-center gap-3 border-t px-5 pt-3"
      style={{ paddingBottom: Math.max(12, insets.bottom) }}
    >
      <Icon as={Settings} className="text-muted-foreground size-5" />
      <Text className="flex-1 text-sm">Settings</Text>
    </Pressable>
  );

  const brand = (
    <View
      role="heading"
      accessibilityLabel="Ford SpecSync"
      className="flex-row items-center gap-2.5 px-5 pb-3 pt-2"
    >
      <FordScript width={44} height={18} />
      <View className="bg-border h-5 w-px rotate-[18deg]" />
      <Text className="text-lg font-semibold tracking-tight">SpecSync</Text>
    </View>
  );

  if (!signedIn) {
    return (
      <View className="bg-sidebar flex-1" style={{ paddingTop: insets.top }}>
        {brand}
        <View className="flex-1 items-center justify-center gap-4 px-8">
          <Text className="text-muted-foreground text-center">
            Sign in to open your conversations.
          </Text>
          <Button
            className="min-h-11"
            onPress={() => router.push('/sign-in')}
            accessibilityLabel="Sign in"
          >
            <Text>Sign in</Text>
          </Button>
        </View>
        {settings}
      </View>
    );
  }

  return (
    <View className="bg-sidebar flex-1" style={{ paddingTop: insets.top }}>
      {brand}
      <View className="gap-1 px-3 pb-2">
        <View className="justify-center">
          <View className="absolute left-3.5 z-10" pointerEvents="none">
            <Icon as={Search} className="text-muted-foreground size-4" />
          </View>
          <Input
            value={threads.query}
            onChangeText={threads.setQuery}
            placeholder="Search conversations"
            accessibilityLabel="Search conversations"
            className="bg-sidebar-accent dark:bg-sidebar-accent min-h-11 rounded-full border-0 pl-10 shadow-none"
            returnKeyType="search"
          />
        </View>
        <Pressable
          role="button"
          accessibilityLabel="New chat"
          onPress={newChat}
          className="active:bg-sidebar-accent min-h-11 flex-row items-center gap-3 rounded-xl px-3"
        >
          <Icon as={SquarePen} className="text-foreground size-5" />
          <Text className="text-sm font-medium">New chat</Text>
        </Pressable>
        {detail.error ? (
          <Text role="alert" className="text-destructive px-3 text-sm">
            {detail.error}
          </Text>
        ) : null}
      </View>
      {threads.loading ? (
        <View
          className="gap-3 px-4 py-2"
          accessibilityLabel="Loading conversations…"
        >
          {[0, 1, 2, 3, 4].map((row) => (
            <Skeleton key={row} className="h-10 w-full rounded-lg" />
          ))}
        </View>
      ) : (
        <SectionList
          sections={threads.groups.map((group) => ({
            title: group.label,
            data: group.threads,
          }))}
          keyExtractor={(thread) => thread.id}
          keyboardShouldPersistTaps="handled"
          contentContainerClassName="px-3 pb-8 grow"
          stickySectionHeadersEnabled={false}
          refreshing={pulling}
          onRefresh={() => {
            setPulling(true);
            void threads.reload().finally(() => setPulling(false));
          }}
          renderSectionHeader={({ section }) => (
            <Text
              role="heading"
              className="text-muted-foreground px-3 pb-1 pt-5 text-xs font-medium"
            >
              {section.title}
            </Text>
          )}
          renderItem={({ item }) => (
            <ThreadRowPane
              title={item.title}
              active={item.id === activeId}
              renaming={renaming === item.id}
              disabled={detail.pending}
              onOpen={() => open(item.id)}
              onStartRename={() => setRenaming(item.id)}
              onRename={(title) => void rename(item, title)}
              onCancelRename={() => setRenaming(undefined)}
              onDelete={() => setDeleting(item)}
            />
          )}
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center px-8 py-16">
              <Text className="text-muted-foreground text-center">
                {threads.failed
                  ? 'Your conversations could not be loaded. Pull to try again.'
                  : threads.query.trim()
                    ? `No conversations match "${threads.query.trim()}".`
                    : 'Your conversations will appear here.'}
              </Text>
            </View>
          }
        />
      )}
      {settings}
      <ConfirmDeletePane
        open={deleting !== undefined}
        title="Delete this conversation?"
        description={`"${deleting?.title ?? ''}" will be removed from your history. This cannot be undone.`}
        portalHost={PORTAL_HOST}
        onCancel={() => setDeleting(undefined)}
        onConfirm={() => {
          if (deleting) void remove(deleting);
        }}
      />
      <PortalHost name={PORTAL_HOST} />
    </View>
  );
}
