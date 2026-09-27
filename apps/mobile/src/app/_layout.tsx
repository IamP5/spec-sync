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
import { ChatRuntimeProvider } from '../domains/chat/api/bootstrap';
import { queryClient } from '../domains/shared/util-query/query-cache';

export {
  // Catch any errors thrown by the layout and its screens.
  ErrorBoundary,
} from 'expo-router';

/** Composition root: app-wide providers and the navigation stack. */
export default function RootLayout() {
  const { theme } = useUniwind();
  const scheme = theme === 'dark' ? 'dark' : 'light';
  return (
    <GestureHandlerRootView className="flex-1">
      <KeyboardProvider>
        <QueryClientProvider client={queryClient}>
          <ChatRuntimeProvider>
            <ThemeProvider value={NAV_THEME[scheme]}>
              <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
              <Stack>
                <Stack.Screen name="index" options={{ title: 'SpecSync' }} />
              </Stack>
              <PortalHost />
            </ThemeProvider>
          </ChatRuntimeProvider>
        </QueryClientProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
