import { ToolCallCard } from '../ui/tool-call-card';
import { TOOL_ADAPTERS, type ToolAdapterProps } from './chat-tool-registry';

/**
 * Renders one tool call through the component registered for its name, or
 * the generic activity card (web `ToolCallCard`, the `'*'` renderer).
 */
export function ChatToolCallOverview({ call, actions }: ToolAdapterProps) {
  const Adapter = TOOL_ADAPTERS[call.name];
  if (Adapter) return <Adapter call={call} actions={actions} />;
  return (
    <ToolCallCard
      name={call.name}
      running={call.status !== 'complete'}
      failed={call.error !== undefined}
    />
  );
}
