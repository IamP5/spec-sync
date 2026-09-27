import { useLocalSearchParams } from 'expo-router';

import { ChatScreen } from '../../../../domains/chat/api/features';

export default function ThreadRoute() {
  const { threadId } = useLocalSearchParams<{ threadId: string }>();
  return <ChatScreen threadId={threadId} />;
}
