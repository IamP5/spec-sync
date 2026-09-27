import '../global.css';

import { PortalHost } from '@rn-primitives/portal';
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { ThemeProvider } from 'expo-router/react-navigation';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { useUniwind } from 'uniwind';

import { NAV_THEME } from '../design-system/theme';
import { AuthSessionOverview } from '../domains/auth/api/features';
import { ChatRuntimeProvider } from '../domains/chat/api/bootstrap';
import { queryClient } from '../domains/shared/util-query/query-cache';
import { UserAppearanceOverview } from '../domains/user/api/features';

export {
  // Catch any errors thrown by the layout and its screens.
  ErrorBoundary,
} from 'expo-router';

/**
 * Composition root: app-wide providers, the session and appearance keepers,
 * and the navigation stack. The chat, with the conversations in its side
 * panel, is the home; settings and sign-in open over it.
 */
export default function RootLayout() {
  const { theme } = useUniwind();
  const scheme = theme === 'dark' ? 'dark' : 'light';
  return (
    <GestureHandlerRootView className="flex-1">
      <KeyboardProvider>
        <QueryClientProvider client={queryClient}>
          <AuthSessionOverview />
          <UserAppearanceOverview />
          <ChatRuntimeProvider>
            <ThemeProvider value={NAV_THEME[scheme]}>
              <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
              <Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal' }}>
                <Stack.Screen
                  name="(drawer)"
                  options={{ headerShown: false }}
                />
                <Stack.Screen
                  name="settings"
                  options={{ title: 'Settings', presentation: 'modal' }}
                />
                <Stack.Screen
                  name="sign-in"
                  options={{ title: 'Sign in', presentation: 'modal' }}
                />
                <Stack.Screen
                  name="oauthredirect"
                  options={{
                    headerShown: false,
                    presentation: 'transparentModal',
                    animation: 'none',
                  }}
                />
              </Stack>
              <PortalHost />
            </ThemeProvider>
          </ChatRuntimeProvider>
        </QueryClientProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
