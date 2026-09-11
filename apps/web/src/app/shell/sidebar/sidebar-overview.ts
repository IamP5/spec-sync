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
  ZardSidebarFooterComponent,
  ZardSidebarHeaderComponent,
  ZardSidebarMenuButtonComponent,
  ZardSidebarService,
  ZardSidebarTriggerComponent,
} from '@/ui/components/sidebar';

import { AuthSessionCoordinator } from '../../domains/auth/api/authentication';
import { AuthLoginOverview } from '../../domains/auth/api/features';
import { SESSION } from '../../domains/auth/api/session';
import { ThreadSearch } from '../../domains/chat/api/features';
import { UserProfileOverview } from '../../domains/user/api/features';
import { AccountMenuOverview } from '../account-menu/account-menu-overview';

@Component({
  selector: 'app-sidebar-overview',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgIcon,
    RouterLink,
    ZardButtonComponent,
    ZardSidebarFooterComponent,
    ZardSidebarHeaderComponent,
    ZardSidebarMenuButtonComponent,
    ZardSidebarTriggerComponent,
    ThreadSearch,
    AccountMenuOverview,
    UserProfileOverview,
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
          i18n-aria-label
          aria-label="SpecSync home"
          (click)="onNavigate()"
          >SpecSync</a
        >
        <button
          z-sidebar-trigger
          i18n-aria-label
          aria-label="Toggle sidebar"
        ></button>
      </div>
      <a
        z-sidebar-menu-button
        routerLink="/"
        data-action="new-chat"
        i18n-aria-label
        aria-label="New chat"
        (click)="onNavigate()"
        ><ng-icon
          name="lucideSquarePen"
          class="size-4 shrink-0"
          aria-hidden="true"
        /><span class="sidebar-expanded" i18n>New chat</span></a
      >
      @if (session.authenticated()) {
        <a z-sidebar-menu-button routerLink="/ingestion" (click)="onNavigate()"
          ><ng-icon
            name="lucideFileInput"
            class="size-4 shrink-0"
            aria-hidden="true"
          /><span class="sidebar-expanded" i18n>Vehicle ingestion</span></a
        >
      }
    </z-sidebar-header>
    @if (auth.pending() || session.authenticated()) {
      <app-thread-search (navigated)="onNavigate()" />
      @defer (on immediate) {
        <app-account-menu-overview />
      } @placeholder {
        <z-sidebar-footer class="mt-auto border-t border-sidebar-border p-2">
          <div class="flex min-h-12 items-center gap-2 rounded-md p-2 text-sm">
            <app-user-profile-overview />
          </div>
        </z-sidebar-footer>
      }
    } @else {
      <p class="sidebar-expanded p-4 text-sm text-muted-foreground" i18n>
        Sign in to open your conversations.
      </p>
      <div class="mt-auto p-3">
        <button
          z-button
          type="button"
          class="w-full px-2"
          i18n-aria-label
          aria-label="Sign in"
          (click)="login()"
        >
          <ng-icon
            name="lucideLogIn"
            class="size-4 shrink-0"
            aria-hidden="true"
          />
          <span class="sidebar-expanded" i18n>Sign in</span>
        </button>
      </div>
    }`,
})
export class SidebarOverview {
  readonly navigated = output<void>();
  protected readonly session = inject(SESSION);
  protected readonly auth = inject(AuthSessionCoordinator);
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
      zTitle: $localize`Welcome to SpecSync`,
      zContent: AuthLoginOverview,
      zHideFooter: true,
      zWidth: '24rem',
    });
  }
}
