import { useGlobalSearchParams } from 'expo-router';
import { Drawer } from 'expo-router/drawer';
import { useWindowDimensions } from 'react-native';

import { ThreadSearch } from '../../domains/chat/api/features';

/**
 * The conversations as a side panel (web sidebar, and the phone chat apps'
 * drawer): it slides in from the left and pushes the chat aside, by the
 * header button or a swipe from the left edge.
 */
export default function ChatDrawerLayout() {
  const { threadId } = useGlobalSearchParams<{ threadId?: string }>();
  const { width } = useWindowDimensions();
  return (
    <Drawer
      drawerContent={({ navigation }) => (
        <ThreadSearch
          activeId={threadId}
          onClose={() => navigation.closeDrawer()}
        />
      )}
      screenOptions={{
        headerShown: false,
        drawerType: 'slide',
        drawerStyle: { width: Math.min(width * 0.84, 360) },
        swipeEdgeWidth: 40,
      }}
    />
  );
}
