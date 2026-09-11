/** Read-only diagnosis harness. Synthetic messages; no model, network, or database writes. */
import assert from 'node:assert/strict';
import { Agent } from '@mastra/core/agent';
import { MessageList } from '@mastra/core/agent/message-list';
import {
  MastraAgent,
  convertAGUIMessagesToMastra,
} from '../../apps/ai/node_modules/@ag-ui/mastra/dist/index.mjs';
import { build } from 'esbuild';
const compiled = await build({
  entryPoints: ['apps/ai/src/mastra/threads/messages.ts'],
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'node',
  packages: 'external',
});
const { toAGUIMessages } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`
);

const stored = [
  user('u1', 'First research'),
  assistant('a1', 'c1'),
  user('u2', 'Second research'),
  assistant('a2', 'c2'),
];
const history = [
  ...toAGUIMessages(stored),
  { id: 'u3', role: 'user', content: 'Next question' },
];

// The bridge's local-agent check uses instanceof. Only memory is stubbed;
// message selection, conversion, merging and history serialization are real.
const local = Object.create(Agent.prototype);
local.getMemory = async () => ({ recall: async () => ({ messages: stored }) });
const bridge = new MastraAgent({ agent: local, agentId: 'chat' });
const candidate = process.argv.includes('--candidate');

const incoming = candidate ? omitPersistedResults(history, stored) : history;
// Diagnostic access to the installed bridge's TypeScript-private method.
const selected = await bridge.selectNewMessages('thread', 'resource', incoming);
const list = new MessageList({ threadId: 'thread', resourceId: 'resource' });
list.add(convertAGUIMessagesToMastra(selected, history), 'input');
const replayed = list.get.all.db();
console.log(
  'Selected replay messages:',
  selected.map((message) => message.id),
);
console.log('Mastra input:', replayed.map(summary));

assert(
  !replayed.some(
    (message) => message.id === 'a1' && summary(message).calls.includes('c2'),
  ),
  'The upstream replay must not move c2 into a1',
);

// Simulate save-by-id without touching storage, then use the app's real reader.
const saved = new Map(stored.map((message) => [message.id, message]));
for (const message of replayed) saved.set(message.id, message);
const roundTrip = toAGUIMessages([...saved.values()]);
const owners = roundTrip
  .filter((message) => message.role === 'assistant')
  .flatMap((message) =>
    (message.toolCalls ?? []).map((call) => [call.id, message.id]),
  );
console.log('Round-trip tool owners:', owners);
assert.deepEqual(
  owners.filter(([id]) => id === 'c2'),
  [['c2', 'a2']],
  'A later tool call must not be copied into an earlier assistant message',
);

if (candidate) {
  const pending = structuredClone(stored);
  const invocation = pending[3].content.parts[0].toolInvocation;
  invocation.state = 'call';
  delete invocation.result;
  const tail = omitPersistedResults(history, pending);
  assert(
    tail.some(
      (message) => message.role === 'tool' && message.toolCallId === 'c2',
    ),
  );
  assert(
    !tail.some(
      (message) => message.role === 'tool' && message.toolCallId === 'c1',
    ),
  );
  console.log(
    'PASS: completed results omitted; an unpersisted result survives.',
  );
}

function omitPersistedResults(messages, memory) {
  const completed = new Set(
    memory.flatMap((message) =>
      message.content.parts.flatMap((part) =>
        part.type === 'tool-invocation' &&
        part.toolInvocation.state === 'result'
          ? [part.toolInvocation.toolCallId]
          : [],
      ),
    ),
  );
  return messages.filter(
    (message) => message.role !== 'tool' || !completed.has(message.toolCallId),
  );
}

function user(id, text) {
  return {
    id,
    role: 'user',
    threadId: 'thread',
    resourceId: 'resource',
    createdAt: new Date('2026-09-01T00:00:00Z'),
    content: { format: 2, parts: [{ type: 'text', text }] },
  };
}

function assistant(id, callId) {
  return {
    id,
    role: 'assistant',
    threadId: 'thread',
    resourceId: 'resource',
    createdAt: new Date('2026-09-01T00:00:00Z'),
    content: {
      format: 2,
      parts: [
        {
          type: 'tool-invocation',
          toolInvocation: {
            state: 'result',
            toolCallId: callId,
            toolName: 'getVehicleResearch',
            args: { id: `research-${callId}` },
            result: { id: `research-${callId}` },
          },
        },
      ],
    },
  };
}

function summary(message) {
  return {
    id: message.id,
    role: message.role,
    calls: message.content.parts
      .filter((part) => part.type === 'tool-invocation')
      .map((part) => part.toolInvocation.toolCallId),
  };
}
