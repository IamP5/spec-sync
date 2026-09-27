import { Stack } from 'expo-router';
import { useUniwind } from 'uniwind';

import { NAV_THEME } from '../../../design-system/theme';

/**
 * The chat's stack: a new conversation at `/`, a stored one at
 * `/c/<threadId>`. The header sits on the page, without a bar or a rule
 * (web header).
 */
export default function ChatStackLayout() {
  const { theme } = useUniwind();
  const scheme = theme === 'dark' ? 'dark' : 'light';
  return (
    <Stack
      screenOptions={{
        headerBackButtonDisplayMode: 'minimal',
        headerShadowVisible: false,
        headerStyle: { backgroundColor: NAV_THEME[scheme].colors.background },
        title: 'SpecSync',
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="c/[threadId]" options={{ animation: 'fade' }} />
    </Stack>
  );
}
