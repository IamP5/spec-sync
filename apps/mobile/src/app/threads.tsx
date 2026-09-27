import { useLocalSearchParams } from 'expo-router';

import { ThreadSearch } from '../domains/chat/api/features';

export default function ThreadsRoute() {
  const { active } = useLocalSearchParams<{ active?: string }>();
  return <ThreadSearch activeId={active} />;
}
