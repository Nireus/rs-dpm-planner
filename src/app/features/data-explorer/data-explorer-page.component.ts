import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import type { AbilityDefinition, BuffDefinition, ItemDefinition } from '../../../game-data/types';
import { GameDataStoreService } from '../../core/game-data/game-data-store.service';

type ExplorerDefinition = ItemDefinition | AbilityDefinition | BuffDefinition;
type ExplorerKind = 'items' | 'abilities' | 'buffs';

@Component({
  selector: 'app-data-explorer-page',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './data-explorer-page.component.html',
  styleUrl: './data-explorer-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DataExplorerPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly gameDataStore = inject(GameDataStoreService);
  private readonly routeData = computed(() => this.route.snapshot.data);

  protected readonly query = signal('');
  protected readonly storeSummary = this.gameDataStore.summary;

  protected readonly kind = computed(
    () => (this.routeData()['explorerKind'] as ExplorerKind | undefined) ?? 'items',
  );

  protected readonly eyebrow = computed(
    () => (this.routeData()['eyebrow'] as string | undefined) ?? 'Explorer',
  );

  protected readonly title = computed(
    () => (this.routeData()['title'] as string | undefined) ?? 'Data Explorer',
  );

  protected readonly description = computed(
    () =>
      (this.routeData()['description'] as string | undefined) ??
      'Inspect currently loaded curated game definitions.',
  );

  protected readonly definitions = computed<ExplorerDefinition[]>(() => {
    const catalog = this.gameDataStore.snapshot().catalog;

    if (!catalog) {
      return [];
    }

    switch (this.kind()) {
      case 'items':
        return Object.values(catalog.items);
      case 'abilities':
        return Object.values(catalog.abilities);
      case 'buffs':
        return Object.values(catalog.buffs);
    }
  });

  protected readonly definitionCount = computed(() => this.definitions().length);

  protected readonly filteredDefinitions = computed(() => {
    const normalizedQuery = this.query().trim().toLowerCase();

    if (!normalizedQuery) {
      return this.definitions();
    }

    return this.definitions().filter((definition) => {
      const haystack = `${definition.name} ${definition.id}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  });

  protected asItem(definition: ExplorerDefinition): ItemDefinition {
    return definition as ItemDefinition;
  }

  protected asAbility(definition: ExplorerDefinition): AbilityDefinition {
    return definition as AbilityDefinition;
  }

  protected asBuff(definition: ExplorerDefinition): BuffDefinition {
    return definition as BuffDefinition;
  }
}
