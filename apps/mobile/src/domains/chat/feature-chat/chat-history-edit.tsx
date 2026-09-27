import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Button } from '../../../design-system/components/ui/button';
import { Text } from '../../../design-system/components/ui/text';
import { useSession } from '../../auth/api/session';
import { useThreadDetailStore } from './thread-detail-store';
import { ConfirmDeletePane } from './ui/confirm-delete-pane';

/** "Conversation history" of the settings (web `SettingsEdit`): delete everything. */
export function ChatHistoryEdit({
  portalHost,
}: {
  /** The `PortalHost` of the screen that shows this section. */
  portalHost?: string;
}) {
  const router = useRouter();
  const signedIn = useSession().scope !== null;
  const detail = useThreadDetailStore();
  const [confirming, setConfirming] = useState(false);

  async function clear() {
    setConfirming(false);
    try {
      await detail.clear();
      if (router.canDismiss()) router.dismissAll();
      router.replace('/');
    } catch {
      // `detail.error` explains the failure.
    }
  }

  if (!signedIn) return null;
  return (
    <View className="gap-2">
      <Text className="text-sm font-medium">Conversation history</Text>
      <View className="flex-row items-center gap-4">
        <Text className="text-muted-foreground flex-1 text-xs">
          Removes every conversation from your history.
        </Text>
        <Button
          variant="destructive"
          className="min-h-11"
          onPress={() => setConfirming(true)}
          disabled={detail.pending}
          accessibilityLabel="Delete all conversations"
        >
          <Text>Delete all</Text>
        </Button>
      </View>
      {detail.error ? (
        <Text role="alert" className="text-destructive text-sm">
          {detail.error}
        </Text>
      ) : null}
      <ConfirmDeletePane
        open={confirming}
        title="Delete all conversations?"
        description="Every conversation in your history will be removed. This cannot be undone."
        confirmLabel="Delete all"
        portalHost={portalHost}
        onCancel={() => setConfirming(false)}
        onConfirm={() => void clear()}
      />
    </View>
  );
}
