import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideEllipsisVertical,
  lucidePencil,
  lucideSearch,
  lucideTrash2,
} from '@ng-icons/lucide';

import {
  ZardAlertDialogRef,
  ZardAlertDialogService,
} from '@/ui/components/alert-dialog';
import {
  ZardDropdownDirective,
  ZardDropdownMenuContentComponent,
  ZardDropdownMenuItemComponent,
  ZardDropdownMenuSeparatorComponent,
} from '@/ui/components/dropdown';
import { ZardInputComponent } from '@/ui/components/input';
import {
  ZardSidebarContentComponent,
  ZardSidebarGroupComponent,
  ZardSidebarGroupContentComponent,
  ZardSidebarGroupLabelComponent,
  ZardSidebarHeaderComponent,
  ZardSidebarInputDirective,
  ZardSidebarMenuActionComponent,
  ZardSidebarMenuButtonComponent,
  ZardSidebarMenuComponent,
  ZardSidebarMenuItemComponent,
  ZardSidebarService,
} from '@/ui/components/sidebar';
import { ZardSkeletonComponent } from '@/ui/components/skeleton';

import { AuthSessionCoordinator } from '../../../auth/api/authentication';
import { SESSION } from '../../../auth/api/session';
import { ChatThreadSummary, MAX_TITLE_LENGTH } from '../../data/thread';
import { ChatCoordinator } from '../chat-coordinator';
import { ThreadSearchStore } from './thread-search-store';

/**
 * Searchable conversation history grouped by date, with rename and delete
 * actions. The application shell owns the surrounding navigation and account menu.
 *
 * Navigation goes through the router: a thread is a URL (`/c/<id>`), a new
 * chat is the root. The chat page reacts to the URL and opens the thread.
 */
@Component({
  selector: 'app-thread-search',
  imports: [
    NgIcon,
    RouterLink,
    ZardDropdownDirective,
    ZardDropdownMenuContentComponent,
    ZardDropdownMenuItemComponent,
    ZardDropdownMenuSeparatorComponent,
    ZardInputComponent,
    ZardSkeletonComponent,

    ZardSidebarContentComponent,
    ZardSidebarGroupComponent,
    ZardSidebarGroupContentComponent,
    ZardSidebarGroupLabelComponent,
    ZardSidebarHeaderComponent,
    ZardSidebarInputDirective,
    ZardSidebarMenuActionComponent,
    ZardSidebarMenuButtonComponent,
    ZardSidebarMenuComponent,
    ZardSidebarMenuItemComponent,
  ],
  viewProviders: [
    provideIcons({
      lucideEllipsisVertical,
      lucidePencil,
      lucideSearch,
      lucideTrash2,
    }),
  ],
  templateUrl: './thread-search.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'contents',
  },
})
export class ThreadSearch {
  private readonly store = inject(ThreadSearchStore);
  private readonly coordinator = inject(ChatCoordinator);
  private readonly router = inject(Router);
  private readonly sidebar = inject(ZardSidebarService);

  private readonly session = inject(SESSION);
  private readonly auth = inject(AuthSessionCoordinator);
  private confirmation?: ZardAlertDialogRef<unknown>;
  private readonly alertDialog = inject(ZardAlertDialogService);
  private readonly renameInput = viewChild('renameInput', {
    read: ElementRef<HTMLInputElement>,
  });

  readonly navigated = output<void>();
  protected readonly sidebarOpen = computed(
    () => this.sidebar.open() || this.sidebar.isMobile(),
  );
  private readonly searchInput = viewChild('searchInput', {
    read: ElementRef<HTMLInputElement>,
  });
  private readonly focusSearch = signal(false);

  protected readonly groups = this.store.groups;
  protected readonly query = this.store.query;
  protected readonly noThreads = this.store.isEmpty;
  /**
   * Skeleton rows stand in for the history while the session is restored and
   * until the first read answers. A later reload (`load()` after a new
   * conversation) keeps the cached list on screen instead.
   */
  protected readonly loading = computed(
    () =>
      this.auth.pending() ||
      (this.session.authenticated() &&
        ['idle', 'loading'].includes(this.store.historyStatus())),
  );
  /** Rows of the placeholder history, one date section per entry. */
  protected readonly skeletonSections = [
    { label: 'w-10', rows: ['w-4/5', 'w-3/5', 'w-11/12'] },
    { label: 'w-16', rows: ['w-2/3', 'w-5/6', 'w-1/2', 'w-3/4'] },
  ];
  protected readonly activeId = this.coordinator.activeThreadId;
  protected readonly maxTitleLength = MAX_TITLE_LENGTH;

  /** Id of the thread whose title is being edited inline. */
  protected readonly renamingId = signal<string | null>(null);
  protected readonly noMatches = computed(
    () => !this.noThreads() && this.groups().length === 0,
  );

  constructor() {
    this.session.invalidated$.pipe(takeUntilDestroyed()).subscribe(() => {
      this.confirmation?.close();
      this.renamingId.set(null);
    });
    afterRenderEffect(() => {
      if (this.focusSearch() && this.sidebarOpen()) {
        this.searchInput()?.nativeElement.focus();
        this.focusSearch.set(false);
      }
      if (this.renamingId()) {
        const input = this.renameInput()?.nativeElement;
        input?.focus();
        input?.select();
      }
    });
  }

  protected onSearch(): void {
    this.sidebar.setOpen(true);
    this.focusSearch.set(true);
  }

  protected onQuery(event: Event): void {
    this.store.setQuery((event.target as HTMLInputElement).value);
  }

  protected onOpen(): void {
    this.closeOnMobile();
    this.navigated.emit();
  }

  protected onRename(thread: ChatThreadSummary): void {
    this.renamingId.set(thread.id);
  }

  protected onRenameKeydown(event: KeyboardEvent, thread: ChatThreadSummary) {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.commitRename(thread, (event.target as HTMLInputElement).value);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.renamingId.set(null);
    }
  }

  protected onRenameBlur(event: Event, thread: ChatThreadSummary): void {
    if (this.renamingId() === thread.id) {
      this.commitRename(thread, (event.target as HTMLInputElement).value);
    }
  }

  protected onDelete(thread: ChatThreadSummary): void {
    const scope = this.session.scope();
    if (!scope) return;
    this.confirmation = this.alertDialog.confirm({
      zTitle: 'Delete this conversation?',
      zDescription: `"${thread.title}" will be removed from your history. This cannot be undone.`,
      zOkText: 'Delete',
      zOkDestructive: true,
      zOnOk: () => {
        if (!this.session.isCurrent(scope)) return;
        void this.coordinator.remove(thread.id).then((wasOpen) => {
          if (wasOpen) void this.router.navigateByUrl('/');
        });
      },
    });
  }

  private commitRename(thread: ChatThreadSummary, title: string): void {
    this.renamingId.set(null);
    if (title.trim() && title.trim() !== thread.title) {
      void this.coordinator.rename(thread.id, title);
    }
  }

  private closeOnMobile(): void {
    if (this.sidebar.isMobile()) {
      this.sidebar.setOpenMobile(false);
    }
  }
}
