import { type } from '@ngrx/signals';
import { eventGroup } from '@ngrx/signals/events';

import type { SessionScope } from '../../auth/api/session';
import type { ResearchPeople } from './research-contracts';
export const researchInterestEvents = eventGroup({
  source: 'Research interests',
  events: {
    saved: type<{ id: string; scope: SessionScope; page: ResearchPeople }>(),
  },
});
