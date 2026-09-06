import { Route } from '@angular/router';

const chatPage = () =>
  import('./domains/chat/feature-chat/chat-page/chat-page').then(
    (m) => m.ChatPage,
  );

const vehicleCatalogPrototype = () =>
  import(
    './domains/chat/feature-chat/vehicle-catalog-prototype/vehicle-catalog-prototype'
  ).then((m) => m.VehicleCatalogPrototype);

/**
 * The application is the assistant: the root is a new conversation and
 * `/c/<id>` a stored one (`threadId` is bound to the page's input).
 */
export const appRoutes: Route[] = [
  { path: '', pathMatch: 'full', loadComponent: chatPage },
  { path: 'c/:threadId', loadComponent: chatPage },
  {
    path: 'prototype/vehicle-catalog',
    loadComponent: vehicleCatalogPrototype,
    title: 'Vehicle catalog prototype · SpecSync',
  },
  { path: '**', redirectTo: '' },
];
