import { lexer, type Token, type Tokens } from 'marked';
import { View } from 'react-native';

import { Text } from '../../../../design-system/components/ui/text';
import { cn } from '../../../../design-system/lib/utils';
import { safeSourceUrl } from '../../util/knowledge-display';

/**
 * Assistant Markdown rendered with native text (the web renders it with
 * `marked` too). Formatting only: nothing is parsed out of the text, and
 * links open only when they are http(s) (docs/adr/0001-agentic-ui-contracts.md).
 */
export function MarkdownText({
  text,
  onOpenLink,
}: {
  text: string;
  onOpenLink: (url: string) => void;
}) {
  const tokens = lexer(text, { gfm: true, breaks: true });
  return (
    <View className="gap-3">
      {tokens.map((token, index) => (
        <Block key={index} token={token} onOpenLink={onOpenLink} />
      ))}
    </View>
  );
}

function Block({
  token,
  onOpenLink,
}: {
  token: Token;
  onOpenLink: (url: string) => void;
}) {
  switch (token.type) {
    case 'heading': {
      const heading = token as Tokens.Heading;
      return (
        <Text
          role="heading"
          className={cn(
            'font-semibold',
            heading.depth <= 2 ? 'text-lg' : 'text-base',
          )}
        >
          <Inline tokens={heading.tokens} onOpenLink={onOpenLink} />
        </Text>
      );
    }
    case 'paragraph':
      return (
        <Text selectable className="text-base leading-7">
          <Inline
            tokens={(token as Tokens.Paragraph).tokens}
            onOpenLink={onOpenLink}
          />
        </Text>
      );
    case 'list': {
      const list = token as Tokens.List;
      const start = typeof list.start === 'number' ? list.start : 1;
      return (
        <View className="gap-2.5">
          {list.items.map((item, index) => (
            <View key={index} className="flex-row gap-2 pr-2">
              <Text className="text-muted-foreground min-w-5 text-base leading-7">
                {list.ordered ? `${start + index}.` : '•'}
              </Text>
              <View className="flex-1 gap-1.5">
                {item.tokens.map((child, childIndex) => (
                  <Block
                    key={childIndex}
                    token={child}
                    onOpenLink={onOpenLink}
                  />
                ))}
              </View>
            </View>
          ))}
        </View>
      );
    }
    case 'text': {
      const text = token as Tokens.Text;
      return (
        <Text selectable className="text-base leading-7">
          {text.tokens ? (
            <Inline tokens={text.tokens} onOpenLink={onOpenLink} />
          ) : (
            text.text
          )}
        </Text>
      );
    }
    case 'code':
      return (
        <View className="bg-muted rounded-md px-3 py-2">
          <Text selectable className="font-mono text-sm">
            {(token as Tokens.Code).text}
          </Text>
        </View>
      );
    case 'blockquote':
      return (
        <View className="border-border gap-2 border-l-2 pl-3">
          {(token as Tokens.Blockquote).tokens.map((child, index) => (
            <Block key={index} token={child} onOpenLink={onOpenLink} />
          ))}
        </View>
      );
    case 'table':
      return <Table table={token as Tokens.Table} onOpenLink={onOpenLink} />;
    case 'hr':
      return <View className="bg-border h-px" />;
    case 'space':
      return null;
    default:
      return 'text' in token && typeof token.text === 'string' ? (
        <Text selectable className="text-base leading-7">
          {token.text}
        </Text>
      ) : null;
  }
}

/** A Markdown table as stacked rows: phone width cannot hold wide columns. */
function Table({
  table,
  onOpenLink,
}: {
  table: Tokens.Table;
  onOpenLink: (url: string) => void;
}) {
  return (
    <View className="border-border overflow-hidden rounded-lg border">
      {table.rows.map((row, rowIndex) => (
        <View
          key={rowIndex}
          className={cn(
            'gap-1 px-3 py-2',
            rowIndex > 0 && 'border-border border-t',
          )}
        >
          {row.map((cell, cellIndex) => (
            <View key={cellIndex} className="flex-row gap-2">
              <Text className="text-muted-foreground w-2/5 text-sm">
                <Inline
                  tokens={table.header[cellIndex]?.tokens ?? []}
                  onOpenLink={onOpenLink}
                />
              </Text>
              <Text
                selectable
                className={cn(
                  'flex-1 text-sm',
                  cellIndex === 0 && 'font-semibold',
                )}
              >
                <Inline tokens={cell.tokens} onOpenLink={onOpenLink} />
              </Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

function Inline({
  tokens,
  onOpenLink,
}: {
  tokens: Token[];
  onOpenLink: (url: string) => void;
}) {
  return (
    <>
      {tokens.map((token, index) => {
        switch (token.type) {
          case 'strong':
            return (
              <Text key={index} className="font-semibold">
                <Inline
                  tokens={(token as Tokens.Strong).tokens}
                  onOpenLink={onOpenLink}
                />
              </Text>
            );
          case 'em':
            return (
              <Text key={index} className="italic">
                <Inline
                  tokens={(token as Tokens.Em).tokens}
                  onOpenLink={onOpenLink}
                />
              </Text>
            );
          case 'del':
            return (
              <Text key={index} className="line-through">
                <Inline
                  tokens={(token as Tokens.Del).tokens}
                  onOpenLink={onOpenLink}
                />
              </Text>
            );
          case 'codespan':
            return (
              <Text key={index} className="bg-muted font-mono text-sm">
                {decode((token as Tokens.Codespan).text)}
              </Text>
            );
          case 'br':
            return <Text key={index}>{'\n'}</Text>;
          case 'link': {
            const link = token as Tokens.Link;
            const url = safeSourceUrl(link.href);
            return url ? (
              <Text
                key={index}
                role="link"
                className="text-primary underline"
                onPress={() => onOpenLink(url)}
                accessibilityLabel={`Open ${link.text}`}
              >
                <Inline tokens={link.tokens} onOpenLink={onOpenLink} />
              </Text>
            ) : (
              <Text key={index}>{link.text}</Text>
            );
          }
          case 'text':
          case 'escape': {
            const text = token as Tokens.Text;
            return text.tokens ? (
              <Inline
                key={index}
                tokens={text.tokens}
                onOpenLink={onOpenLink}
              />
            ) : (
              <Text key={index}>{decode(text.text)}</Text>
            );
          }
          default:
            return 'text' in token && typeof token.text === 'string' ? (
              <Text key={index}>{decode(token.text)}</Text>
            ) : null;
        }
      })}
    </>
  );
}

/** `marked` escapes HTML entities in text; native text shows them raw. */
function decode(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}
