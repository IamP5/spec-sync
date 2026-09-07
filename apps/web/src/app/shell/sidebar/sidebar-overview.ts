import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  output,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideFileInput,
  lucideLogIn,
  lucideSquarePen,
} from '@ng-icons/lucide';

import { ZardButtonComponent } from '@/ui/components/button';
import { ZardDialogRef, ZardDialogService } from '@/ui/components/dialog';
import {
  ZardSidebarHeaderComponent,
  ZardSidebarMenuButtonComponent,
  ZardSidebarService,
  ZardSidebarTriggerComponent,
} from '@/ui/components/sidebar';

import { AuthLoginOverview } from '../../domains/auth/api/features';
import { SESSION } from '../../domains/auth/api/session';
import { ChatConnectionCoordinator } from '../../domains/chat/api/connection';
import { ThreadSearch } from '../../domains/chat/api/features';
import { AccountMenuOverview } from '../account-menu/account-menu-overview';

@Component({
  selector: 'app-sidebar-overview',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgIcon,
    RouterLink,
    ZardButtonComponent,
    ZardSidebarHeaderComponent,
    ZardSidebarMenuButtonComponent,
    ZardSidebarTriggerComponent,
    ThreadSearch,
    AccountMenuOverview,
  ],
  viewProviders: [
    provideIcons({ lucideSquarePen, lucideFileInput, lucideLogIn }),
  ],
  host: {
    class: 'contents',
    '(document:keydown.meta.shift.o)': 'newChat($event)',
    '(document:keydown.control.shift.o)': 'newChat($event)',
  },
  template: ` <z-sidebar-header class="gap-3 p-3">
      <div class="flex h-8 items-center justify-between">
        <a
          class="sidebar-expanded text-lg font-semibold"
          routerLink="/"
          aria-label="SpecSync home"
          (click)="onNavigate()"
          >SpecSync</a
        >
        <button z-sidebar-trigger aria-label="Toggle sidebar"></button>
      </div>
      <a
        z-sidebar-menu-button
        routerLink="/"
        data-action="new-chat"
        aria-label="New chat"
        (click)="onNavigate()"
        ><ng-icon
          name="lucideSquarePen"
          class="size-4 shrink-0"
          aria-hidden="true"
        /><span class="sidebar-expanded">New chat</span></a
      >
      @if (session.authenticated()) {
        <a z-sidebar-menu-button routerLink="/ingestion" (click)="onNavigate()"
          ><ng-icon
            name="lucideFileInput"
            class="size-4 shrink-0"
            aria-hidden="true"
          /><span class="sidebar-expanded">Vehicle ingestion</span></a
        >
      }
    </z-sidebar-header>
    @if (session.authenticated()) {
      @if (connection.ready()) {
        <app-thread-search (navigated)="onNavigate()" />
      }
      @defer (on immediate) {
        <app-account-menu-overview />
      }
    } @else {
      <p class="sidebar-expanded p-4 text-sm text-muted-foreground">
        Sign in to open your conversations.
      </p>
      <div class="mt-auto p-3">
        <button
          z-button
          type="button"
          class="w-full px-2"
          aria-label="Sign in"
          (click)="login()"
        >
          <ng-icon
            name="lucideLogIn"
            class="size-4 shrink-0"
            aria-hidden="true"
          />
          <span class="sidebar-expanded">Sign in</span>
        </button>
      </div>
    }`,
})
export class SidebarOverview {
  readonly navigated = output<void>();
  protected readonly session = inject(SESSION);
  protected readonly connection = inject(ChatConnectionCoordinator);
  private readonly sidebar = inject(ZardSidebarService);
  private readonly router = inject(Router);
  private readonly dialogs = inject(ZardDialogService);
  private dialog?: ZardDialogRef<AuthLoginOverview>;
  constructor() {
    inject(DestroyRef).onDestroy(() => this.dialog?.close());
    effect(() => {
      if (this.session.authenticated()) this.dialog?.close();
    });
  }
  protected onNavigate() {
    if (this.sidebar.isMobile()) this.sidebar.setOpenMobile(false);
    this.navigated.emit();
  }
  protected newChat(event: Event) {
    event.preventDefault();
    this.onNavigate();
    void this.router.navigateByUrl('/');
  }
  protected login() {
    this.dialog = this.dialogs.create({
      zTitle: 'Welcome to SpecSync',
      zContent: AuthLoginOverview,
      zHideFooter: true,
      zWidth: '24rem',
    });
  }
}
