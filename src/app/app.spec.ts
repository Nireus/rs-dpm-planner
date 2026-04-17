import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { routes } from './app.routes';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter(routes)],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render the brand logo', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.brand-logo')).toBeTruthy();
  });

  it('should render the current app navigation links', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;

    const primaryNav = compiled.querySelector('nav[aria-label="Primary"]');
    const workspaceNav = compiled.querySelector('nav[aria-label="Workspace"]');
    const topBar = compiled.querySelector('header[aria-label="Workspace utilities"]');
    const brandLink = compiled.querySelector<HTMLAnchorElement>('.brand-link');
    const primaryLinks = Array.from(primaryNav?.querySelectorAll('.nav-link') ?? []).map((link) =>
      link.textContent?.trim(),
    );
    const workspaceLinks = Array.from(workspaceNav?.querySelectorAll('.nav-link') ?? []).map((link) =>
      link.textContent?.trim(),
    );
    const topLinks = Array.from(topBar?.querySelectorAll('.top-link') ?? []).map((link) =>
      link.textContent?.trim(),
    );

    expect(brandLink?.getAttribute('aria-label')).toBe('Go to home');
    expect(primaryLinks).toEqual([
      'Gear',
      'Buffs',
      'Abilities',
      'Spellbook',
      'Rotation Planner',
      'Results',
    ]);
    expect(workspaceLinks).toEqual(['Import / Export']);
    expect(topLinks).toEqual([
      'Public Builds',
      'My Builds',
      'Donate',
    ]);
  });
});
