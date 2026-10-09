import { ArrowUp, Info } from 'lucide-react-native';
import { View } from 'react-native';

import { Button } from '../../../../design-system/components/ui/button';
import { Icon } from '../../../../design-system/components/ui/icon';
import { Text } from '../../../../design-system/components/ui/text';
import type { ToolNote } from '../../data/chat-message';
import { DisclosurePane } from './disclosure-pane';

/**
 * Notes that stand in for repeated or empty tool cards (web
 * `toolPresentation`): a research already shown above, empty searches, and
 * source candidates of a research started in the same turn.
 */
export function ToolNotesPane({
  notes,
  onGoToResearch,
  onOpenLink,
}: {
  notes: ToolNote[];
  onGoToResearch: (researchId: string) => void;
  onOpenLink: (url: string) => void;
}) {
  return (
    <View className="gap-2">
      {notes.map((note) =>
        note.sources?.length ? (
          <DisclosurePane key={note.id} title={note.text}>
            {note.sources.map((source) => (
              <Text
                key={source.url}
                role="link"
                className="text-primary text-sm underline"
                onPress={() => onOpenLink(source.url)}
                accessibilityLabel={`Open ${source.title}`}
              >
                {source.title}
              </Text>
            ))}
            {(note.warnings ?? []).map((warning) => (
              <Text key={warning} className="text-muted-foreground text-xs">
                {warning}
              </Text>
            ))}
          </DisclosurePane>
        ) : (
          <View key={note.id} className="gap-1.5">
            <View className="flex-row items-start gap-2">
              <Icon as={Info} className="text-muted-foreground mt-0.5 size-4" />
              <Text
                role="status"
                className="text-muted-foreground flex-1 text-sm"
              >
                {note.text}
              </Text>
            </View>
            {(note.warnings ?? []).map((warning) => (
              <Text
                key={warning}
                className="text-muted-foreground pl-6 text-xs"
              >
                {warning}
              </Text>
            ))}
            {note.researchId ? (
              <Button
                variant="ghost"
                size="sm"
                className="min-h-11 self-start"
                onPress={() => onGoToResearch(note.researchId ?? '')}
                accessibilityLabel="Go to the research"
              >
                <Icon as={ArrowUp} className="text-foreground size-4" />
                <Text>Go to the research</Text>
              </Button>
            ) : null}
          </View>
        ),
      )}
    </View>
  );
}
