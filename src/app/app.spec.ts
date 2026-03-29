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

    const navPanels = compiled.querySelectorAll('.nav-panel');
    const primaryLinks = Array.from(navPanels[0]?.querySelectorAll('.nav-link') ?? []).map((link) =>
      link.textContent?.trim(),
    );
    const secondaryLinks = Array.from(navPanels[1]?.querySelectorAll('.nav-link') ?? []).map((link) =>
      link.textContent?.trim(),
    );

    expect(primaryLinks).toEqual([
      'Home',
      'Gear',
      'Buffs',
      'Abilities',
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
