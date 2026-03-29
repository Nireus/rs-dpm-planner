import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CONFIG_OPTION_IDS } from '../../../game-data/conventions/mechanics';
import type { ItemDefinition } from '../../../game-data/types';
import type { CuratedPerkOption } from '../../../game-data/perks/curated-perk-options';
import { GameDataStoreService } from '../../core/game-data/game-data-store.service';
import type { ResolvedItemInstanceViewModel } from './gear-builder.store';
import { isAugmentableSlot } from './gear-builder.utils';

const QUIVER_SECONDARY_BOLT_AMMO_ID = 'bakriminel-bolts';

@Component({
  selector: 'app-gear-item-config-panel',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './gear-item-config-panel.component.html',
  styleUrl: './gear-item-config-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GearItemConfigPanelComponent {
  private readonly genesisShardIconPath =
    'https://runescape.wiki/w/Special:FilePath/Shard_of_Genesis_Essence.png';
  private readonly dyeIconPaths: Record<string, string> = {
    red: 'https://runescape.wiki/w/Special:FilePath/Red_dye.png',
    orange: 'https://runescape.wiki/w/Special:FilePath/Orange_dye.png',
    yellow: 'https://runescape.wiki/w/Special:FilePath/Yellow_dye.png',
    green: 'https://runescape.wiki/w/Special:FilePath/Green_dye.png',
    blue: 'https://runescape.wiki/w/Special:FilePath/Blue_dye.png',
    purple: 'https://runescape.wiki/w/Special:FilePath/Purple_dye.png',
    black: 'https://runescape.wiki/w/Special:FilePath/Black_mushroom_ink.png',
  };
  private readonly gameDataStore = inject(GameDataStoreService);
  @Input({ required: true }) item!: ItemDefinition;
  @Input({ required: true }) perkOptions: CuratedPerkOption[] = [];
  @Input() resolvedInstance: ResolvedItemInstanceViewModel | null = null;

  @Output() updateSocketPerks = new EventEmitter<{ socketIndex: number; perkIds: string[] }>();
  @Output() updatePerkRank = new EventEmitter<{ socketIndex: number; perkId: string; rank: number }>();
  @Output() updateBooleanConfig = new EventEmitter<{ optionId: string; checked: boolean }>();
  @Output() updateScalarConfig = new EventEmitter<{ optionId: string; value: string }>();

  readonly perkSocketIndexes = [0, 1];
  readonly perkRankSlots = [0, 1];
  protected openSocketDropdown: number | null = null;
  protected readonly perkSearchQueries: Record<number, string> = {};

  supportsPerks(): boolean {
    return isAugmentableSlot(this.item.slot);
  }

  selectedSocketPerkIds(socketIndex: number): string[] {
    return (this.resolvedInstance?.instance.configuredPerks ?? [])
      .filter((perk) => perk.socketIndex === socketIndex)
      .map((perk) => perk.perkId);
  }

  isPerkSelected(socketIndex: number, perkId: string): boolean {
    return this.selectedSocketPerkIds(socketIndex).includes(perkId);
  }

  selectedSocketPerks(socketIndex: number): CuratedPerkOption[] {
    const selectedIds = this.selectedSocketPerkIds(socketIndex);
    return this.perkOptions.filter((perk) => selectedIds.includes(perk.id));
  }

  selectedSocketPerkAt(socketIndex: number, selectionIndex: number): CuratedPerkOption | null {
    return this.selectedSocketPerks(socketIndex)[selectionIndex] ?? null;
  }

  toggleSocketDropdown(socketIndex: number): void {
    this.openSocketDropdown = this.openSocketDropdown === socketIndex ? null : socketIndex;
  }

  isSocketDropdownOpen(socketIndex: number): boolean {
    return this.openSocketDropdown === socketIndex;
  }

  perkSearchQuery(socketIndex: number): string {
    return this.perkSearchQueries[socketIndex] ?? '';
  }

  updatePerkSearchQuery(socketIndex: number, value: string): void {
    this.perkSearchQueries[socketIndex] = value;
  }

  socketSelectionLabel(socketIndex: number): string {
    const selected = this.selectedSocketPerks(socketIndex);

    if (!selected.length) {
      return 'Choose up to 2 perks';
    }

    return selected.map((perk) => perk.label).join(', ');
  }

  filteredPerkOptions(socketIndex: number): CuratedPerkOption[] {
    const query = this.perkSearchQuery(socketIndex).trim().toLowerCase();

    if (!query) {
      return this.perkOptions;
    }

    return this.perkOptions.filter((perk) =>
      `${perk.label} ${perk.shortCode} ${perk.id}`.toLowerCase().includes(query),
    );
  }

  toggleSocketPerk(socketIndex: number, perkId: string): void {
    const selectedIds = this.selectedSocketPerkIds(socketIndex);

    if (selectedIds.includes(perkId)) {
      this.updateSocketPerks.emit({
        socketIndex,
        perkIds: selectedIds.filter((selectedId) => selectedId !== perkId),
      });
      return;
    }

    if (selectedIds.length >= 2) {
      return;
    }

    this.updateSocketPerks.emit({
      socketIndex,
      perkIds: [...selectedIds, perkId],
    });
  }

  isPerkOptionDisabled(socketIndex: number, perkId: string): boolean {
    const selectedIds = this.selectedSocketPerkIds(socketIndex);
    return selectedIds.length >= 2 && !selectedIds.includes(perkId);
  }

  perkRank(socketIndex: number, perkId: string): number {
    const match = (this.resolvedInstance?.instance.configuredPerks ?? []).find(
      (perk) => perk.socketIndex === socketIndex && perk.perkId === perkId,
    );

    return match?.rank ?? 1;
  }

  rankChoices(perkId: string): number[] {
    const perk = this.perkOptions.find((entry) => entry.id === perkId);
    const maxRank = perk?.maxRank ?? 1;
    return Array.from({ length: maxRank }, (_, index) => index + 1);
  }

  configValue(optionId: string): boolean | number | string {
    const configuredValue = this.resolvedInstance?.instance.configValues?.[optionId];

    if (configuredValue !== undefined) {
      return configuredValue;
    }

    return this.item.configOptions?.find((option) => option.id === optionId)?.defaultValue ?? '';
  }

  isGenesisOption(optionId: string): boolean {
    return optionId === 'genesis-enchanted';
  }

  isDyeOption(optionId: string): boolean {
    return optionId === 'applied-dye';
  }

  genesisShardIcon(): string {
    return this.genesisShardIconPath;
  }

  displayConfigChoice(choice: string): string {
    if (choice === 'none') {
      return 'None';
    }

    const itemLabel = this.gameDataStore.snapshot().catalog?.items[choice]?.name;

    if (itemLabel) {
      return itemLabel;
    }

    return choice
      .split('-')
      .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join(' ');
  }

  selectedConfigChoice(optionId: string): string {
    const value = this.configValue(optionId);
    return typeof value === 'string' ? value : String(value);
  }

  configChoiceIcon(optionId: string, choice: string): string | null {
    if (optionId === CONFIG_OPTION_IDS.loadedAmmo) {
      return this.gameDataStore.snapshot().catalog?.items[choice]?.iconPath ?? null;
    }

    if (optionId === 'applied-dye') {
      return this.dyeIconPaths[choice] ?? null;
    }

    return null;
  }

  perkIconPath(perkId: string): string | null {
    return this.gameDataStore.snapshot().catalog?.perks[perkId]?.iconPath ?? null;
  }

  showImplicitQuiverBoltSlot(): boolean {
    return this.item.id === 'pernixs-quiver' && this.resolvedInstance !== null;
  }

  implicitQuiverBoltLabel(): string {
    return this.gameDataStore.snapshot().catalog?.items[QUIVER_SECONDARY_BOLT_AMMO_ID]?.name ?? 'Bakriminel bolts';
  }

  implicitQuiverBoltIcon(): string | null {
    return this.gameDataStore.snapshot().catalog?.items[QUIVER_SECONDARY_BOLT_AMMO_ID]?.iconPath ?? null;
  }
}
