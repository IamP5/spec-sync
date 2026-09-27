import { useRouter } from 'expo-router';
import { CircleAlert, Info } from 'lucide-react-native';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '../../../design-system/components/ui/alert';
import { Button } from '../../../design-system/components/ui/button';
import { Text } from '../../../design-system/components/ui/text';
import { useAuthLoginStore } from './auth-login-store';

/**
 * Google sign-in (web `AuthLoginOverview`). Shown as the sign-in sheet; with
 * `dismissOnSignIn` it closes itself once the gateway verified the user.
 */
export function AuthLoginOverview({
  dismissOnSignIn = false,
}: {
  dismissOnSignIn?: boolean;
}) {
  const auth = useAuthLoginStore();
  const router = useRouter();

  useEffect(() => {
    if (dismissOnSignIn && auth.authenticated && router.canGoBack()) {
      router.back();
    }
  }, [dismissOnSignIn, auth.authenticated, router]);

  return (
    <View className="gap-6 px-6 py-8">
      <View className="gap-2">
        <Text variant="h3">Welcome to SpecSync</Text>
        <Text className="text-muted-foreground">
          Sign in to send your message and open your conversations.
        </Text>
      </View>
      <Button
        size="lg"
        onPress={auth.login}
        disabled={!auth.canSignIn}
        accessibilityLabel="Continue with Google"
        className="min-h-12"
      >
        {auth.pending ? (
          <ActivityIndicator
            accessibilityLabel="Signing in"
            className="text-primary-foreground"
          />
        ) : null}
        <Text>Continue with Google</Text>
      </Button>
      {auth.checking ? (
        <Text role="status" className="text-muted-foreground text-sm">
          Checking your session…
        </Text>
      ) : null}
      {auth.unavailable ? (
        <Alert icon={Info}>
          <AlertTitle>Sign-in unavailable</AlertTitle>
          <AlertDescription>{auth.unavailable}</AlertDescription>
        </Alert>
      ) : null}
      {auth.signInError ? (
        <Alert icon={CircleAlert} variant="destructive">
          <AlertTitle>Sign-in failed</AlertTitle>
          <AlertDescription>{auth.signInError}</AlertDescription>
        </Alert>
      ) : null}
      {auth.sessionFailed ? (
        <Button
          variant="outline"
          onPress={auth.retry}
          accessibilityLabel="Check the session again"
          className="min-h-11"
        >
          <Text>Try again</Text>
        </Button>
      ) : null}
    </View>
  );
}
