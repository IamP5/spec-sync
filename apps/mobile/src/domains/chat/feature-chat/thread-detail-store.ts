import { useMutation } from '@tanstack/react-query';

import {
  clearThreads,
  removeThread,
  renameThread,
} from '../data/thread-client';

/** Renaming and deleting conversations (web `ThreadDetailStore`). */
export function useThreadDetailStore() {
  const rename = useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) =>
      renameThread(id, title),
  });
  const remove = useMutation({ mutationFn: removeThread });
  const clear = useMutation({ mutationFn: clearThreads });
  const failed = rename.error ?? remove.error ?? clear.error;
  return {
    rename: (id: string, title: string) => rename.mutateAsync({ id, title }),
    remove: (id: string) => remove.mutateAsync(id),
    clear: () => clear.mutateAsync(),
    pending: rename.isPending || remove.isPending || clear.isPending,
    error: failed
      ? 'The conversation could not be changed. Please try again.'
      : undefined,
  };
}
