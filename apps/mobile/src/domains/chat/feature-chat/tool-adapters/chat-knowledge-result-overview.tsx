import * as WebBrowser from 'expo-web-browser';

import { knowledgeView } from '../../data/knowledge-result';
import { safeSourceUrl } from '../../util/knowledge-display';
import { KnowledgeResultCard } from '../ui/knowledge-result-card';
import type { ToolAdapterProps } from './chat-tool-registry';

/**
 * The knowledge tools (attributes, concepts, capabilities, reviews,
 * excerpts, discovered content and specification sources): the real tool
 * result, validated and rendered by the knowledge card.
 */
export function ChatKnowledgeResultOverview({ call }: ToolAdapterProps) {
  return (
    <KnowledgeResultCard
      view={knowledgeView(call.name, call.status === 'complete', call.result)}
      onOpenLink={(url) => {
        const href = safeSourceUrl(url);
        if (href) void WebBrowser.openBrowserAsync(href);
      }}
    />
  );
}
