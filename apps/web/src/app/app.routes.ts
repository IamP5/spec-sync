import { Route, UrlSegment } from '@angular/router';

import { authGuard } from './domains/auth/api/bootstrap';
import { loadChatPage } from './domains/chat/api/features';
import { loadVehicleIngestionPage } from './domains/vehicles/api/features';

/**
 * The application is the assistant: the root is a new conversation and
 * `/c/<id>` a stored one (`threadId` is bound to the page's input).
 */
export const appRoutes: Route[] = [
  { path: '', pathMatch: 'full', loadComponent: loadChatPage },
  { path: 'c/:threadId', loadComponent: loadChatPage },
  {
    // Keep the same page instance and in-memory credentials when a new run gains its URL.
    matcher: (segments) => {
      if (segments[0]?.path !== 'ingestion' || segments.length > 2) return null;
      const posParams: Record<string, UrlSegment> = {};
      if (segments[1]) posParams['runId'] = segments[1];
      return { consumed: segments, posParams };
    },
    canActivate: [authGuard],
    loadComponent: loadVehicleIngestionPage,
  },
  { path: '**', redirectTo: '' },
];
