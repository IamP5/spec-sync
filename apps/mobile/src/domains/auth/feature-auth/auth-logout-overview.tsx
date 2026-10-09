import { useRouter } from 'expo-router';
import { LogOut } from 'lucide-react-native';
import { useEffect } from 'react';
import { View } from 'react-native';

import { Button } from '../../../design-system/components/ui/button';
import { Icon } from '../../../design-system/components/ui/icon';
import { Text } from '../../../design-system/components/ui/text';
import { useAuthLoginStore } from './auth-login-store';

/** "Sign out" (web `AuthLogoutOverview`); returns to the chat afterwards. */
export function AuthLogoutOverview() {
  const auth = useAuthLoginStore();
  const router = useRouter();

  useEffect(() => {
    if (!auth.signedOut) return;
    if (router.canDismiss()) router.dismissAll();
    else router.replace('/');
  }, [auth.signedOut, router]);

  if (!auth.authenticated) return null;
  return (
    <View className="gap-2">
      <Button
        variant="outline"
        onPress={auth.logout}
        disabled={auth.logoutPending}
        accessibilityLabel="Sign out"
        className="min-h-11 justify-start"
      >
        <Icon as={LogOut} className="text-foreground size-4" />
        <Text>Sign out</Text>
      </Button>
      {auth.logoutError ? (
        <Text role="alert" className="text-destructive text-sm">
          {auth.logoutError}
        </Text>
      ) : null}
    </View>
  );
}
