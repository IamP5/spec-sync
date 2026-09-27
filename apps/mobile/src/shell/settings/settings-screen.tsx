import { PortalHost } from '@rn-primitives/portal';
import { ScrollView, View } from 'react-native';

import { Separator } from '../../design-system/components/ui/separator';
import { Text } from '../../design-system/components/ui/text';
import { AuthLogoutOverview } from '../../domains/auth/api/features';
import { useSession } from '../../domains/auth/api/session';
import {
  ChatCreditsOverview,
  ChatHistoryEdit,
} from '../../domains/chat/api/features';
import {
  UserPreferencesEdit,
  UserProfileOverview,
} from '../../domains/user/api/features';

/** Dialogs of this modal screen render above it, not under it. */
const PORTAL_HOST = 'settings';

/**
 * Account and settings (web account menu + settings dialog): the Google
 * profile, AI credits, personal preferences, conversation history and
 * sign-out, composed from the domains' public features.
 */
export function SettingsScreen() {
  const signedIn = useSession().scope !== null;
  return (
    <View className="bg-background flex-1">
      <ScrollView
        className="bg-background flex-1"
        contentContainerClassName="gap-6 px-5 py-6"
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
      >
        {signedIn ? (
          <>
            <UserProfileOverview />
            <ChatCreditsOverview />
            <Separator />
          </>
        ) : (
          <Text className="text-muted-foreground">
            Sign in to personalise the assistant. Preferences are stored on this
            device.
          </Text>
        )}
        <View className="gap-1">
          <Text variant="large">Settings</Text>
          <Text className="text-muted-foreground text-sm">
            Personalise the assistant. Preferences are stored on this device.
          </Text>
        </View>
        <UserPreferencesEdit />
        <Separator />
        <ChatHistoryEdit portalHost={PORTAL_HOST} />
        <AuthLogoutOverview />
      </ScrollView>
      <PortalHost name={PORTAL_HOST} />
    </View>
  );
}
