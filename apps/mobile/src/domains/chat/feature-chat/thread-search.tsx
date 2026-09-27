import { PortalHost } from '@rn-primitives/portal';
import { useRouter } from 'expo-router';
import { MessageSquarePlus, Search } from 'lucide-react-native';
import { useState } from 'react';
import { SectionList, View } from 'react-native';

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

/** Dialogs of this modal screen render above it, not under it. */
const PORTAL_HOST = 'thread-search';

/**
 * The chat list (web sidebar `ThreadSearch`): conversations grouped by date,
 * filtered by title, opened, renamed and deleted. `activeId` is the thread
 * the chat shows underneath.
 */
export function ThreadSearch({ activeId }: { activeId?: string }) {
  const router = useRouter();
  const signedIn = useSession().scope !== null;
  const threads = useThreadSearchStore();
  const detail = useThreadDetailStore();
  const [renaming, setRenaming] = useState<string>();
  const [deleting, setDeleting] = useState<ChatThreadSummary>();

  function open(id: string) {
    if (router.canDismiss()) router.dismissAll();
    router.replace({ pathname: '/c/[threadId]', params: { threadId: id } });
  }

  function newChat() {
    if (router.canDismiss()) router.dismissAll();
    router.replace('/');
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

  if (!signedIn) {
    return (
      <View className="bg-background flex-1 items-center justify-center gap-4 px-8">
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
    );
  }

  return (
    <View className="bg-background flex-1">
      <View className="gap-3 px-4 pb-2 pt-3">
        <View className="flex-row items-center gap-2">
          <View className="flex-1 justify-center">
            <View className="absolute left-3 z-10" pointerEvents="none">
              <Icon as={Search} className="text-muted-foreground size-4" />
            </View>
            <Input
              value={threads.query}
              onChangeText={threads.setQuery}
              placeholder="Search conversations"
              accessibilityLabel="Search conversations"
              className="min-h-11 pl-9"
              returnKeyType="search"
            />
          </View>
          <Button
            variant="outline"
            size="icon"
            className="size-11"
            onPress={newChat}
            accessibilityLabel="New chat"
          >
            <Icon as={MessageSquarePlus} className="text-foreground size-5" />
          </Button>
        </View>
        {detail.error ? (
          <Text role="alert" className="text-destructive text-sm">
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
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
          contentContainerClassName="px-2 pb-8 grow"
          stickySectionHeadersEnabled={false}
          refreshing={threads.refreshing}
          onRefresh={threads.refresh}
          renderSectionHeader={({ section }) => (
            <Text
              role="heading"
              className="text-muted-foreground px-3 pb-1 pt-4 text-xs font-medium uppercase"
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
