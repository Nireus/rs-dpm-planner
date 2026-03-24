import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { GameDataStoreService } from '../core/game-data/game-data-store.service';

@Component({
  selector: 'app-feature-placeholder-page',
  standalone: true,
  templateUrl: './feature-placeholder-page.component.html',
  styleUrl: './feature-placeholder-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FeaturePlaceholderPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly gameDataStore = inject(GameDataStoreService);
  private readonly pageData = computed(() => this.route.snapshot.data);

  protected readonly gameDataSummary = this.gameDataStore.summary;

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
