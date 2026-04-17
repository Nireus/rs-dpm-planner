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

  it('should render primary and project navigation links', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;

    const accountNav = compiled.querySelector('nav[aria-label="Account navigation"]');
    const primaryNav = compiled.querySelector('nav[aria-label="Primary"]');
    const projectNav = compiled.querySelector('nav[aria-label="Project"]');
    const accountLinks = Array.from(accountNav?.querySelectorAll('.nav-link') ?? []).map((link) =>
      link.textContent?.trim(),
    );
    const primaryLinks = Array.from(primaryNav?.querySelectorAll('.nav-link') ?? []).map((link) =>
      link.textContent?.trim(),
    );
    const secondaryLinks = Array.from(projectNav?.querySelectorAll('.nav-link') ?? []).map((link) =>
      link.textContent?.trim(),
    );

    expect(accountLinks).toEqual([
      'Home',
      'Public Builds',
      'My Builds',
    ]);
    expect(primaryLinks).toEqual([
      'Gear',
      'Buffs',
      'Abilities',
      'Spellbook',
      'Rotation Planner',
      'Results',
      'Import / Export',
    ]);
    expect(secondaryLinks).toEqual([
      'Donate',
      'Bug Report / Functionality Request',
      'Changelog',
    ]);
  });
});
