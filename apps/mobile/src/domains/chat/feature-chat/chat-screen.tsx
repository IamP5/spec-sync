import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';

import { Text } from '../../../design-system/components/ui/text';
import { useChatConversationStore } from './chat-conversation-store';
import { ChatComposer } from './ui/chat-composer';
import { MessageList } from './ui/message-list';

/** The chat workflow: transcript, run progress, failures and the draft. */
export function ChatScreen() {
  const conversation = useChatConversationStore();
  const [draft, setDraft] = useState('');

  function submit() {
    const text = draft;
    setDraft('');
    void conversation.send(text);
  }

  return (
    <KeyboardAvoidingView behavior="padding" className="bg-background flex-1">
      <MessageList
        messages={conversation.messages}
        empty={
          <View className="flex-1 items-center justify-center gap-2 px-8">
            <Text variant="h3">What can I help you find?</Text>
            <Text className="text-muted-foreground text-center">
              Ask about specifications, trims or comparisons.
            </Text>
          </View>
        }
        footer={
          conversation.running ? (
            <ActivityIndicator
              accessibilityLabel="The assistant is answering"
              className="self-start"
            />
          ) : undefined
        }
      />
      {conversation.error ? (
        <Text
          role="alert"
          className="text-destructive px-4 pb-2 text-sm"
          selectable
        >
          {conversation.error}
        </Text>
      ) : null}
      <ChatComposer
        value={draft}
        onChangeText={setDraft}
        onSubmit={submit}
        disabled={!conversation.ready || conversation.running}
      />
    </KeyboardAvoidingView>
  );
}
