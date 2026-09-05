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
import { Router, RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideChevronsUpDown,
  lucideEllipsisVertical,
  lucideMonitor,
  lucideMoon,
  lucidePencil,
  lucideSearch,
  lucideSettings,
  lucideSquarePen,
  lucideSun,
  lucideTrash2,
} from '@ng-icons/lucide';

import { ZardAlertDialogService } from '@/ui/components/alert-dialog';
import { ZardAvatarComponent } from '@/ui/components/avatar';
import { ZardDialogService } from '@/ui/components/dialog';
import {
  ZardDropdownDirective,
  ZardDropdownMenuContentComponent,
  ZardDropdownMenuItemComponent,
  ZardDropdownMenuLabelComponent,
  ZardDropdownMenuSeparatorComponent,
  ZardDropdownMenuShortcutComponent,
  ZardDropdownMenuSubContentComponent,
  ZardDropdownMenuSubTriggerComponent,
} from '@/ui/components/dropdown';
import { ZardInputComponent } from '@/ui/components/input';
import { ZardKbdComponent } from '@/ui/components/kbd';
import {
  ZardSidebarContentComponent,
  ZardSidebarFooterComponent,
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
  ZardSidebarTriggerComponent,
} from '@/ui/components/sidebar';
import { EDarkModes, ZardDarkMode } from '@/ui/services';

import { ChatThreadSummary, MAX_TITLE_LENGTH } from '../../data/thread';
import { ChatCoordinator } from '../chat-coordinator';
import { PreferencesDetailStore } from '../settings-edit/preferences-detail-store';
import { SettingsEdit } from '../settings-edit/settings-edit';
import { ThreadSearchStore } from './thread-search-store';

/**
 * Sidebar of the application: new chat, the searchable conversation history
 * grouped by date (rename and delete per thread) and, in the footer, the user
 * menu with the theme switch and the settings dialog.
 *
 * Navigation goes through the router: a thread is a URL (`/c/<id>`), a new
 * chat is the root. The chat page reacts to the URL and opens the thread.
 */
@Component({
  selector: 'app-thread-search',
  imports: [
    NgIcon,
    RouterLink,
    ZardAvatarComponent,
    ZardDropdownDirective,
    ZardDropdownMenuContentComponent,
    ZardDropdownMenuItemComponent,
    ZardDropdownMenuLabelComponent,
    ZardDropdownMenuSeparatorComponent,
    ZardDropdownMenuShortcutComponent,
    ZardDropdownMenuSubContentComponent,
    ZardDropdownMenuSubTriggerComponent,
    ZardInputComponent,
    ZardKbdComponent,
    ZardSidebarContentComponent,
    ZardSidebarFooterComponent,
    ZardSidebarGroupComponent,
    ZardSidebarGroupContentComponent,
    ZardSidebarGroupLabelComponent,
    ZardSidebarHeaderComponent,
    ZardSidebarInputDirective,
    ZardSidebarMenuActionComponent,
    ZardSidebarMenuButtonComponent,
    ZardSidebarMenuComponent,
    ZardSidebarMenuItemComponent,
    ZardSidebarTriggerComponent,
  ],
  viewProviders: [
    provideIcons({
      lucideChevronsUpDown,
      lucideEllipsisVertical,
      lucideMonitor,
      lucideMoon,
      lucidePencil,
      lucideSearch,
      lucideSettings,
      lucideSquarePen,
      lucideSun,
      lucideTrash2,
    }),
  ],
  templateUrl: './thread-search.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'contents',
    '(document:keydown.meta.shift.o)': 'onNewChatShortcut($event)',
    '(document:keydown.control.shift.o)': 'onNewChatShortcut($event)',
  },
})
export class ThreadSearch {
  private readonly store = inject(ThreadSearchStore);
  private readonly preferences = inject(PreferencesDetailStore);
  private readonly coordinator = inject(ChatCoordinator);
  private readonly router = inject(Router);
  private readonly sidebar = inject(ZardSidebarService);
  private readonly darkMode = inject(ZardDarkMode);
  private readonly dialog = inject(ZardDialogService);
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
  protected readonly activeId = this.coordinator.activeThreadId;
  protected readonly displayName = this.preferences.displayName;
  protected readonly hasName = this.preferences.hasName;
  protected readonly initials = this.preferences.initials;
  protected readonly theme = this.darkMode.currentTheme;
  protected readonly themes = EDarkModes;
  protected readonly maxTitleLength = MAX_TITLE_LENGTH;

  /** Id of the thread whose title is being edited inline. */
  protected readonly renamingId = signal<string | null>(null);
  protected readonly noMatches = computed(
    () => !this.noThreads() && this.groups().length === 0,
  );

  constructor() {
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

  protected onNewChat(): void {
    this.closeOnMobile();
    this.navigated.emit();
    void this.router.navigateByUrl('/');
  }

  protected onNewChatShortcut(event: Event): void {
    event.preventDefault();
    this.onNewChat();
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
    this.alertDialog.confirm({
      zTitle: 'Delete this conversation?',
      zDescription: `"${thread.title}" will be removed from your history. This cannot be undone.`,
      zOkText: 'Delete',
      zOkDestructive: true,
      zOnOk: () => {
        if (this.coordinator.remove(thread.id)) {
          void this.router.navigateByUrl('/');
        }
      },
    });
  }

  protected onTheme(theme: EDarkModes): void {
    this.darkMode.toggleTheme(theme);
  }

  protected onSettings(): void {
    this.dialog.create({
      zTitle: 'Settings',
      zDescription:
        'Personalise the assistant. Everything is stored in this browser.',
      zContent: SettingsEdit,
      zHideFooter: true,
      zWidth: '32rem',
    });
  }

  private commitRename(thread: ChatThreadSummary, title: string): void {
    this.renamingId.set(null);
    if (title.trim() && title.trim() !== thread.title) {
      this.coordinator.rename(thread.id, title);
    }
  }

  private closeOnMobile(): void {
    if (this.sidebar.isMobile()) {
      this.sidebar.setOpenMobile(false);
    }
  }
}
