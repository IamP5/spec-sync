import { DeferBlockBehavior, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { ZardSidebarService } from '@/ui/components/sidebar';
import { provideZard } from '@/ui/core';

import { PhotoClient } from '../domains/user/data/photo-client';
import { SidebarOverview } from '../shell/sidebar/sidebar-overview';
import { provideFakeAuth, testSession } from './fake-auth';
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

  it('holds the account skeleton until the profile photo is decoded', async () => {
    let decoded!: (shown: boolean) => void;
    const [, photos] = provideFakeUser(
      undefined,
      () => new Promise<boolean>((resolve) => (decoded = resolve)),
    );
    TestBed.overrideProvider(PhotoClient, { useValue: photos.useValue });
    const fixture = TestBed.createComponent(SidebarOverview);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    await vi.waitFor(() => expect(decoded).toBeDefined());
    fixture.detectChanges();

    expect(
      element.querySelector('[data-role="profile-loading"]'),
    ).not.toBeNull();
    expect(element.textContent).not.toContain('Alice Smith');
    expect(element.textContent).not.toContain('User');

    decoded(true);
    await fixture.whenStable();
    expect(element.querySelector('[data-role="profile-loading"]')).toBeNull();
    expect(element.textContent).toContain('Alice Smith');
    expect(element.querySelector('img')?.getAttribute('src')).toContain(
      'lh3.googleusercontent.com/alice',
    );
  });

  it('shows history and account skeletons instead of the sign-in prompt while the session is restored', async () => {
    const fixture = TestBed.createComponent(SidebarOverview);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;

    testSession().invalidate('restoring');
    await fixture.whenStable();
    expect(
      element.querySelector('[data-role="history-loading"]'),
    ).not.toBeNull();
    expect(
      element.querySelector('[data-role="profile-loading"]'),
    ).not.toBeNull();
    expect(element.querySelector('[aria-label="Sign in"]')).toBeNull();

    testSession().invalidate();
    await fixture.whenStable();
    expect(element.querySelector('[data-role="history-loading"]')).toBeNull();
    expect(element.querySelector('[data-role="profile-loading"]')).toBeNull();
    expect(element.querySelector('[aria-label="Sign in"]')).not.toBeNull();
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
