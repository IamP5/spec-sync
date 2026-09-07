import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';

import { ZardAvatarComponent } from '@/ui/components/avatar';

import { UserDetailStore } from './user-detail-store';

@Component({
  selector: 'app-user-profile-overview',
  imports: [ZardAvatarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex min-w-0 flex-1 items-center gap-2' },
  template: `
    <z-avatar
      class="shrink-0 rounded-full"
      [zSrc]="user()?.photoUrl ?? ''"
      [zFallback]="initials()"
      [zAlt]="user()?.displayName || 'User'"
    />
    <span class="sidebar-expanded grid min-w-0 text-left leading-tight">
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
  `,
})
export class UserProfileOverview {
  protected readonly store = inject(UserDetailStore);
  protected readonly user = this.store.userValue;
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
