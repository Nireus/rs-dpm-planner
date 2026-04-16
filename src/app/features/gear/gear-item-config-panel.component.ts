import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CONFIG_OPTION_IDS } from '../../../game-data/conventions/mechanics';
import { findGenesisUnlockGroup } from '../../../simulation-engine/gear/configured-equipment-definition';
import type { ItemDefinition, PerkDefinition } from '../../../game-data/types';
import type { ItemInstanceConfig } from '../../../simulation-engine/models';
import { GameDataStoreService } from '../../core/game-data/game-data-store.service';
import { GearBuilderStore } from './gear-builder.store';
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
    '/icons/wiki/shard-of-genesis-essence.png';
  private readonly shadowsEnchantmentIconPath =
    'https://runescape.wiki/w/Special:FilePath/Enchantment_of_shadows.png';
  private readonly metaphysicsEnchantmentIconPath =
    '/icons/wiki/enchantment-of-metaphysics.png';
  private readonly dyeIconPaths: Record<string, string> = {
    red: '/icons/wiki/red-dye.png',
    orange: '/icons/wiki/orange-dye.png',
    yellow: '/icons/wiki/yellow-dye.png',
    green: '/icons/wiki/green-dye.png',
    blue: '/icons/wiki/blue-dye.png',
    purple: '/icons/wiki/purple-dye.png',
    black: '/icons/wiki/black-mushroom-ink.png',
  };
  private readonly gameDataStore = inject(GameDataStoreService);
  private readonly gearBuilderStore = inject(GearBuilderStore);
  @Input({ required: true }) item!: ItemDefinition;
  @Input({ required: true }) perkOptions: PerkDefinition[] = [];
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

  selectedSocketPerks(socketIndex: number): PerkDefinition[] {
    const selectedIds = this.selectedSocketPerkIds(socketIndex);
    return this.perkOptions.filter((perk) => selectedIds.includes(perk.id));
  }

  selectedSocketPerkAt(socketIndex: number, selectionIndex: number): PerkDefinition | null {
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

    return selected.map((perk) => perk.name).join(', ');
  }

  filteredPerkOptions(socketIndex: number): PerkDefinition[] {
    const query = this.perkSearchQuery(socketIndex).trim().toLowerCase();

    if (!query) {
      return this.perkOptions;
    }

    return this.perkOptions.filter((perk) =>
      `${perk.name} ${perk.shortCode ?? ''} ${perk.id}`.toLowerCase().includes(query),
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
    if (optionId === CONFIG_OPTION_IDS.genesisEnchanted) {
      return this.hasGenesisEnchantment();
    }

    const configuredValue = this.resolvedInstance?.instance.configValues?.[optionId];

    if (configuredValue !== undefined) {
      return configuredValue;
    }

    return this.item.configOptions?.find((option) => option.id === optionId)?.defaultValue ?? '';
  }

  isGenesisOption(optionId: string): boolean {
    return optionId === CONFIG_OPTION_IDS.genesisEnchanted;
  }

  isStalkersRingShadowsOption(optionId: string): boolean {
    return optionId === CONFIG_OPTION_IDS.stalkersRingShadowsEnchanted;
  }

  isChannellersRingMetaphysicsOption(optionId: string): boolean {
    return optionId === CONFIG_OPTION_IDS.channellersRingMetaphysicsEnchanted;
  }

  isDyeOption(optionId: string): boolean {
    return optionId === 'applied-dye';
  }

  genesisShardIcon(): string {
    return this.genesisShardIconPath;
  }

  shadowsEnchantmentIcon(): string {
    return this.shadowsEnchantmentIconPath;
  }

  metaphysicsEnchantmentIcon(): string {
    return this.metaphysicsEnchantmentIconPath;
  }

  private hasGenesisEnchantment(): boolean {
    const definitionId = this.resolvedInstance?.instance.definitionId ?? this.item.id;
    const unlockGroup = findGenesisUnlockGroup(definitionId);

    if (!unlockGroup) {
      return this.resolvedInstance?.instance.configValues?.[CONFIG_OPTION_IDS.genesisEnchanted] === true;
    }

    const gearState = this.gearBuilderStore.snapshot();
    return [
      ...Object.values(gearState.equipment).filter((instance): instance is ItemInstanceConfig => Boolean(instance)),
      ...gearState.inventory,
    ].some((instance) =>
      unlockGroup.includes(instance.definitionId) &&
      instance.configValues?.[CONFIG_OPTION_IDS.genesisEnchanted] === true,
    );
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
