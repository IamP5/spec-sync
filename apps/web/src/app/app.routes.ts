import { Route } from '@angular/router';

export const appRoutes: Route[] = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () =>
      import(
        './domains/greeting/feature-greeting/greeting-page/greeting-page'
      ).then((m) => m.GreetingPage),
  },
  {
    path: 'chat',
    loadComponent: () =>
      import('./domains/chat/feature-chat/chat-page/chat-page').then(
        (m) => m.ChatPage,
      ),
  },
  {
    path: '**',
    redirectTo: '',
  },
];
