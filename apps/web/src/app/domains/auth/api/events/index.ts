import { type } from '@ngrx/signals';
import { eventGroup } from '@ngrx/signals/events';

export const sessionEvents = eventGroup({
  source: 'Auth Session',
  events: {
    invalidated: type<{ generation: number }>(),
    refreshed: type<{ uid: string; generation: number }>(),
    established: type<{ uid: string; generation: number }>(),
  },
});
