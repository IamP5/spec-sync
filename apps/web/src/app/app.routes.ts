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
    path: '**',
    redirectTo: '',
  },
];
