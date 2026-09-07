import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { provideFakeAuth } from '../../../testing/fake-auth';
import { AuthSessionOverview } from './auth-session-overview';

@Component({
  selector: 'app-session-test',
  imports: [AuthSessionOverview],
  template:
    '<app-auth-session-overview><ng-template><p data-protected>Workspace</p></ng-template></app-auth-session-overview>',
})
class SessionTest {}

describe('auth session shell', () => {
  it('shows the public Google login without instantiating protected content', async () => {
    TestBed.configureTestingModule({ providers: [provideFakeAuth(false)] });
    const fixture = TestBed.createComponent(SessionTest);
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Continue with Google');
    expect(fixture.nativeElement.querySelector('[data-protected]')).toBeNull();
  });
  it('renders protected content after the gateway verifies the user', async () => {
    TestBed.configureTestingModule({ providers: [provideFakeAuth()] });
    const fixture = TestBed.createComponent(SessionTest);
    await fixture.whenStable();
    expect(
      fixture.nativeElement.querySelector('[data-protected]'),
    ).not.toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('reviewer');
  });
});
