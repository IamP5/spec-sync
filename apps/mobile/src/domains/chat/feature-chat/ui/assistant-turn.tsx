import { Check, Copy, RefreshCw } from 'lucide-react-native';
import type { ReactElement } from 'react';
import { View } from 'react-native';

import { Button } from '../../../../design-system/components/ui/button';
import { Icon } from '../../../../design-system/components/ui/icon';
import type { TranscriptItem } from '../../data/chat-message';
import type { ToolCallView } from '../../data/tool-call';
import { ActivityPane } from './activity-pane';
import { MarkdownText } from './markdown-text';
import { ToolNotesPane } from './tool-notes-pane';

type AssistantItem = Extract<TranscriptItem, { kind: 'assistant' }>;

/**
 * An assistant turn: Markdown text, the tool activity when asked for, notes,
 * the registered tool components, and copy / regenerate once it is done.
 */
export function AssistantTurn({
  item,
  showActivity,
  renderToolCall,
  footer,
  copied,
  onCopy,
  onRegenerate,
  onGoToResearch,
  onOpenLink,
}: {
  item: AssistantItem;
  showActivity: boolean;
  renderToolCall: (call: ToolCallView) => ReactElement | null;
  /** Show copy (and regenerate, when `onRegenerate` is set). */
  footer: boolean;
  copied: boolean;
  onCopy: () => void;
  onRegenerate?: () => void;
  onGoToResearch: (researchId: string) => void;
  onOpenLink: (url: string) => void;
}) {
  return (
    <View className="gap-3">
      {item.text ? (
        <MarkdownText text={item.text} onOpenLink={onOpenLink} />
      ) : null}
      {showActivity && item.activities.length > 0 ? (
        <ActivityPane activities={item.activities} />
      ) : null}
      {item.notes.length > 0 ? (
        <ToolNotesPane
          notes={item.notes}
          onGoToResearch={onGoToResearch}
          onOpenLink={onOpenLink}
        />
      ) : null}
      {item.toolCalls.map((call) => (
        <View key={call.id}>{renderToolCall(call)}</View>
      ))}
      {footer && item.text ? (
        <View className="-ml-2 flex-row">
          <Button
            variant="ghost"
            size="icon"
            className="size-11"
            onPress={onCopy}
            accessibilityLabel={copied ? 'Copied' : 'Copy reply'}
          >
            <Icon
              as={copied ? Check : Copy}
              className="text-muted-foreground size-4"
            />
          </Button>
          {onRegenerate ? (
            <Button
              variant="ghost"
              size="icon"
              className="size-11"
              onPress={onRegenerate}
              accessibilityLabel="Regenerate reply"
            >
              <Icon as={RefreshCw} className="text-muted-foreground size-4" />
            </Button>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
