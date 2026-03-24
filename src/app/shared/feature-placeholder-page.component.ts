import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-feature-placeholder-page',
  standalone: true,
  template: `
    <section class="page">
      <header class="page-header">
        <p class="eyebrow">{{ eyebrow() }}</p>
        <h1>{{ title() }}</h1>
        <p class="description">{{ description() }}</p>
      </header>

      <div class="page-grid">
        <article class="panel">
          <h2>Current Purpose</h2>
          <p>{{ purpose() }}</p>
        </article>

        <article class="panel">
          <h2>Phase Status</h2>
          <p>
            This is a placeholder screen for Phase 1.3 so the navigation,
            routing, and layout shell are in place before deeper feature work
            begins.
          </p>
        </article>
      </div>
    </section>
  `,
  styles: `
    .page {
      display: grid;
      gap: 1.5rem;
    }

    .page-header {
      display: grid;
      gap: 0.75rem;
      padding: clamp(1.5rem, 3vw, 2.25rem);
      border: 1px solid var(--panel-border);
      border-radius: 1.5rem;
      background: var(--panel-surface);
      box-shadow: var(--panel-shadow);
    }

    .eyebrow {
      margin: 0;
      color: var(--accent-primary);
      font-size: 0.8rem;
      font-weight: 700;
      letter-spacing: 0.14em;
      text-transform: uppercase;
    }

    h1 {
      margin: 0;
      color: var(--text-strong);
      font-size: clamp(2rem, 5vw, 3.25rem);
      line-height: 1;
    }

    .description,
    .panel p {
      margin: 0;
      color: var(--text-muted);
      line-height: 1.7;
    }

    .page-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr));
      gap: 1rem;
    }

    .panel {
      padding: 1.25rem;
      border: 1px solid var(--panel-border);
      border-radius: 1.25rem;
      background: var(--panel-surface-alt);
    }

    .panel h2 {
      margin: 0 0 0.75rem;
      color: var(--text-strong);
      font-size: 1rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FeaturePlaceholderPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly pageData = computed(() => this.route.snapshot.data);

  protected readonly eyebrow = computed(
    () => (this.pageData()['eyebrow'] as string | undefined) ?? 'Feature Area',
  );

  protected readonly title = computed(
    () => (this.pageData()['title'] as string | undefined) ?? 'Placeholder Page',
  );

  protected readonly description = computed(
    () =>
      (this.pageData()['description'] as string | undefined) ??
      'This section will be implemented in a later phase.',
  );

  protected readonly purpose = computed(
    () =>
      (this.pageData()['purpose'] as string | undefined) ??
      'Establish the feature boundary and keep the app structure clear.',
  );
}
