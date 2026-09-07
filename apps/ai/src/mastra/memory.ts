import { Memory } from '@mastra/memory';
import { PostgresStore } from '@mastra/pg';

import { vertex } from './models';

const DEFAULT_TITLE_MODEL = 'gemini-2.5-flash-lite';

const TITLE_INSTRUCTIONS = `Write a title for this conversation from the user's first message.
Reply with the title only: at most seven words, no quotes, no trailing punctuation, in the language of the message.`;

export const MEMORY_SCHEMA = 'mastra';

export const memoryDatabaseUrl = process.env['SPECSYNC_MEMORY_DATABASE_URL'];

export function postgresStorage(): PostgresStore | undefined {
  if (!memoryDatabaseUrl) {
    return undefined;
  }
  return new PostgresStore({
    id: 'ai-memory',
    connectionString: memoryDatabaseUrl,
    schemaName: MEMORY_SCHEMA,
    max: 5,
  });
}

export const chatMemory = new Memory({
  options: {
    lastMessages: 40,
    generateTitle: {
      model: vertex(process.env['VERTEX_TITLE_MODEL'] ?? DEFAULT_TITLE_MODEL),
      instructions: TITLE_INSTRUCTIONS,
    },
  },
});
