import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';

import { ZardAvatarComponent } from '@/ui/components/avatar';
import { ZardSkeletonComponent } from '@/ui/components/skeleton';

import { UserDetailStore } from './user-detail-store';

/**
 * The signed-in user's avatar, name and email. It keeps a skeleton of the same
 * size until the profile and its photo are both ready, so the card appears
 * once, complete, instead of a placeholder name followed by the real one.
 */
@Component({
  selector: 'app-user-profile-overview',
  imports: [ZardAvatarComponent, ZardSkeletonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex min-w-0 flex-1 items-center gap-2' },
  template: `
    @if (ready() || store.userError()) {
      <z-avatar
        class="shrink-0 rounded-full animate-in fade-in duration-300"
        [zSrc]="photoShown() ? (user()?.photoUrl ?? '') : ''"
        [zFallback]="photoShown() ? '' : initials()"
        [zAlt]="user()?.displayName || 'User'"
      />
      <span
        class="sidebar-expanded grid min-w-0 text-left leading-tight animate-in fade-in duration-300"
      >
        <span class="truncate text-sm font-medium">{{
          user()?.displayName || 'User'
        }}</span>
        <span class="truncate text-xs text-muted-foreground">{{
          user()?.email
        }}</span>
      </span>
      @if (store.userError()) {
        <span role="alert" class="text-xs">Profile unavailable.</span>
      }
    } @else {
      <span class="sr-only" role="status">Loading your account…</span>
      <z-skeleton
        class="size-8 shrink-0 rounded-full"
        data-role="profile-loading"
      />
      <span
        class="sidebar-expanded grid min-w-0 text-left leading-tight"
        aria-hidden="true"
      >
        <span class="text-sm">
          <z-skeleton class="inline-block h-3 w-24 align-middle" />
        </span>
        <span class="text-xs">
          <z-skeleton class="inline-block h-2.5 w-32 align-middle" />
        </span>
      </span>
    }
  `,
})
export class UserProfileOverview {
  protected readonly store = inject(UserDetailStore);
  protected readonly user = this.store.userValue;
  protected readonly ready = this.store.ready;
  protected readonly photoShown = this.store.photoShown;
  protected readonly initials = computed(() =>
    (this.user()?.displayName ?? 'User')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase(),
  );
}
