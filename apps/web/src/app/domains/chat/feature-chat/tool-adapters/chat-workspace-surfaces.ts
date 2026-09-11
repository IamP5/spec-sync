import { InjectionToken } from '@angular/core';

import type { CompetitiveSurfaceView } from '../../data/competitive-surface-views';

/** The page projects explicit revision contracts from this conversation only. */
export const CHAT_WORKSPACE_SURFACES = new InjectionToken<
  (surfaceId: string) => CompetitiveSurfaceView | undefined
>('CHAT_WORKSPACE_SURFACES');
