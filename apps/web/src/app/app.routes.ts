import { Route } from '@angular/router';

import { loadChatPage } from './domains/chat/feature-chat';

/**
 * The application is the assistant: the root is a new conversation and
 * `/c/<id>` a stored one (`threadId` is bound to the page's input).
 */
export const appRoutes: Route[] = [
  { path: '', pathMatch: 'full', loadComponent: loadChatPage },
  { path: 'c/:threadId', loadComponent: loadChatPage },
  { path: '**', redirectTo: '' },
];
