import { Memory } from '@mastra/memory';
import { PostgresStore } from '@mastra/pg';

import { modelForRole } from './models';

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
      // No request context: titles never follow a user's mode and stay on
      // SpecSync's own budget (SPECSYNC_TITLE_MODEL).
      model: modelForRole('title'),
      instructions: TITLE_INSTRUCTIONS,
    },
  },
});
