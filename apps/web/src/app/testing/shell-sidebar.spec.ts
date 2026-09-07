import { DeferBlockBehavior, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { ZardSidebarService } from '@/ui/components/sidebar';
import { provideZard } from '@/ui/core';

import { SidebarOverview } from '../shell/sidebar/sidebar-overview';
import { provideFakeAuth } from './fake-auth';
import { FakeChatAgent, provideFakeChatAgent } from './fake-chat-agent';
import { provideFakeUser } from './fake-user';

describe('SidebarOverview', () => {
  let agent: FakeChatAgent;

  beforeEach(async () => {
    localStorage.clear();
    agent = new FakeChatAgent();
    await TestBed.configureTestingModule({
      deferBlockBehavior: DeferBlockBehavior.Playthrough,
      providers: [
        provideFakeUser(),
        provideFakeAuth(),
        ...provideFakeChatAgent(agent),
        provideRouter([]),
        provideZard(),
        ZardSidebarService,
      ],
    }).compileComponents();
  });

  it('shows the Google profile photo and email without rendering roles', async () => {
    const fixture = TestBed.createComponent(SidebarOverview);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('img')?.getAttribute('src')).toContain(
      'lh3.googleusercontent.com/alice',
    );
    expect(element.textContent).toContain('Alice Smith');
    expect(element.textContent).toContain('alice@example.com');
    expect(element.textContent).not.toContain('reviewer');
  });

  it('opens the account menu with the theme and settings entries', async () => {
    const fixture = TestBed.createComponent(SidebarOverview);
    await fixture.whenStable();

    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('[data-action="user-menu"]')
      ?.click();
    await fixture.whenStable();

    const menu = document.querySelector('[role="menu"]');
    expect(menu?.textContent).toContain('Settings');
    const appearance = menu?.querySelector<HTMLButtonElement>(
      '[data-slot="dropdown-menu-sub-trigger"]',
    );
    appearance?.click();
    await fixture.whenStable();
    expect(document.querySelectorAll('[role="menuitemradio"]')).toHaveLength(3);
  });

  it('navigates to the root for a new chat', async () => {
    const fixture = TestBed.createComponent(SidebarOverview);
    await fixture.whenStable();
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigateByUrl');

    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('[data-action="new-chat"]')
      ?.click();

    expect(navigate).toHaveBeenCalled();
  });
});
