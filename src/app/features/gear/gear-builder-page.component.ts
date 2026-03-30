import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CONFIG_OPTION_IDS } from '../../../game-data/conventions/mechanics';
import type { EquipmentSlot, ItemDefinition } from '../../../game-data/types';
import type { ItemInstanceConfig } from '../../../simulation-engine/models';
import { CURATED_PERK_OPTIONS, type CuratedPerkOption } from '../../../game-data/perks/curated-perk-options';
import { GameDataStoreService } from '../../core/game-data/game-data-store.service';
import { GearItemDetailDialogComponent } from './gear-item-detail-dialog.component';
import { GearBuilderStore } from './gear-builder.store';
import {
  GEAR_CATALOG_TABS,
  gearCatalogTabEmptyMessage,
  matchesGearCatalogTab,
  type GearCatalogTabId,
} from './gear-catalog-tabs';
import {
  canDropIntoEquipmentSlot,
  canDropIntoInventory,
  formatEquipmentSlot,
  isAugmentableSlot,
  requiresImmediateItemConfiguration,
  type GearDragSource,
} from './gear-builder.utils';

type ConfiguredPerkSelectionLike = NonNullable<ItemInstanceConfig['configuredPerks']>[number];

const QUIVER_SECONDARY_BOLT_AMMO_ID = 'bakriminel-bolts';

@Component({
  selector: 'app-gear-builder-page',
  standalone: true,
  imports: [FormsModule, GearItemDetailDialogComponent],
  templateUrl: './gear-builder-page.component.html',
  styleUrl: './gear-builder-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GearBuilderPageComponent {
  private readonly genesisShardIconPath =
    'https://runescape.wiki/w/Special:FilePath/Shard_of_Genesis_Essence.png';
  private readonly gameDataStore = inject(GameDataStoreService);
  private readonly gearBuilderStore = inject(GearBuilderStore);

  protected readonly query = signal('');
  protected readonly catalogTabs = GEAR_CATALOG_TABS;
  protected readonly selectedCatalogTab = signal<GearCatalogTabId>('ranged');
  protected readonly dragSource = signal<GearDragSource | null>(null);
  protected readonly hoveredSlot = signal<EquipmentSlot | null>(null);
  protected readonly inventoryHovering = signal(false);
  protected readonly dragHint = signal('Drag items into equipment slots or the backpack.');
  protected readonly selectedItemId = signal<string | null>(null);
  protected readonly selectedInstanceId = signal<string | null>(null);
  protected readonly perkOptions = CURATED_PERK_OPTIONS;
  protected readonly perkSocketIndexes = [0, 1];
  protected readonly equipmentSlots = this.gearBuilderStore.equipmentSlots;
  protected readonly equippedSlots = this.gearBuilderStore.equippedSlots;
  protected readonly inventoryEntries = this.gearBuilderStore.inventoryEntries;
  protected readonly storeSummary = this.gameDataStore.summary;
  protected readonly itemDefinitions = computed(
    () => this.gameDataStore.snapshot().catalog?.items ?? {},
  );
  protected readonly gearState = this.gearBuilderStore.snapshot;
  protected readonly selectedItem = computed(() => {
    const selectedId = this.selectedItemId();
    if (!selectedId) {
      return null;
    }

    return this.itemDefinitions()[selectedId] ?? null;
  });
  protected readonly selectedResolvedInstance = computed(() => {
    const instanceId = this.selectedInstanceId();

    if (!instanceId) {
      return null;
    }

    return this.gearBuilderStore.resolveInstance(instanceId);
  });
  protected readonly equippedCount = computed(
    () => this.equippedSlots().filter((entry) => entry.definition).length,
  );
  protected readonly visibleCatalogItems = computed(() => {
    const items = this.gearBuilderStore.availableItems();
    return items.filter((item) => matchesGearCatalogTab(item, this.selectedCatalogTab()));
  });
  protected readonly filteredItems = computed(() => {
    const normalizedQuery = this.query().trim().toLowerCase();
    const items = this.visibleCatalogItems();

    if (!normalizedQuery) {
      return items;
    }

    return items.filter((item) => `${item.name} ${item.id}`.toLowerCase().includes(normalizedQuery));
  });
  protected readonly catalogEmptyHeading = computed(() =>
    this.query().trim() ? 'No Matches' : 'Coming Soon',
  );
  protected readonly catalogEmptyCopy = computed(() =>
    this.query().trim()
      ? 'No loaded item definitions match the current search.'
      : gearCatalogTabEmptyMessage(this.selectedCatalogTab()),
  );

  protected selectCatalogTab(tabId: GearCatalogTabId): void {
    this.selectedCatalogTab.set(tabId);
  }

  protected openCatalogDetail(item: ItemDefinition | null): void {
    this.selectedItemId.set(item?.id ?? null);
    this.selectedInstanceId.set(null);
  }

  protected openEquippedDetail(slot: EquipmentSlot): void {
    const entry = this.equippedSlots().find((candidate) => candidate.slot === slot);
    this.selectedItemId.set(entry?.definition?.id ?? null);
    this.selectedInstanceId.set(entry?.instance?.instanceId ?? null);
  }

  protected openInventoryDetail(instanceId: string): void {
    const entry = this.inventoryEntries().find((candidate) => candidate.instance.instanceId === instanceId);
    this.selectedItemId.set(entry?.definition?.id ?? null);
    this.selectedInstanceId.set(entry?.instance.instanceId ?? null);
  }

  protected closeDetail(): void {
    this.selectedItemId.set(null);
    this.selectedInstanceId.set(null);
  }

  protected equipDefinition(item: ItemDefinition): void {
    const instanceId = this.gearBuilderStore.equipDefinition(item.id);
    this.handleConfiguredPlacement(item, instanceId);
  }

  protected addToInventory(item: ItemDefinition): void {
    const instanceId = this.gearBuilderStore.addToInventory(item.id);
    this.handleConfiguredPlacement(item, instanceId);
  }

  protected clearSlot(slot: EquipmentSlot): void {
    this.gearBuilderStore.clearSlot(slot);
  }

  protected removeFromInventory(instanceId: string): void {
    this.gearBuilderStore.removeFromInventory(instanceId);
  }

  protected removeSelectedResolvedInstance(): void {
    const resolved = this.selectedResolvedInstance();
    if (!resolved) {
      return;
    }

    if (resolved.locationKind === 'equipment' && resolved.slot) {
      this.clearSlot(resolved.slot);
    } else {
      this.removeFromInventory(resolved.instance.instanceId);
    }

    this.closeDetail();
  }

  protected equipInventoryItem(instanceId: string, slot: EquipmentSlot): void {
    const resolved = this.gearBuilderStore.resolveInstance(instanceId);
    const movedInstanceId = this.gearBuilderStore.equipInventoryItem(instanceId, slot);

    if (resolved?.definition) {
      this.handleConfiguredPlacement(resolved.definition, movedInstanceId);
    }
  }

  protected formatSlot(slot: EquipmentSlot): string {
    return formatEquipmentSlot(slot);
  }

  protected shortName(name: string): string {
    if (name.length <= 16) {
      return name;
    }

    return `${name.slice(0, 13)}...`;
  }

  protected compactMeta(item: ItemDefinition): string {
    const parts = [item.slot ? this.formatSlot(item.slot) : null, item.tier ? `T${item.tier}` : null];
    return parts.filter((part): part is string => Boolean(part)).join(' | ') || item.category;
  }

  protected initials(name: string): string {
    return name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('');
  }

  protected hoverText(item: ItemDefinition): string {
    return item.hoverSummary ?? `${item.name}${item.tier ? ` - tier ${item.tier}` : ''}`;
  }

  protected defaultSummary(item: ItemDefinition): string {
    const parts = [
      item.tier ? `Tier ${item.tier}` : null,
      item.slot ? this.formatSlot(item.slot) : null,
      item.category,
    ];

    return parts.filter((part): part is string => Boolean(part)).join(' | ');
  }

  protected detailLines(item: ItemDefinition): string[] {
    if (item.detailLines?.length) {
      return item.detailLines;
    }

    const lines: string[] = [];

    if (item.requirements?.levelRequirements) {
      const requirements = Object.entries(item.requirements.levelRequirements).map(
        ([stat, value]) => `${stat} ${value}`,
      );

      if (requirements.length) {
        lines.push(`Requirements: ${requirements.join(', ')}`);
      }
    }

    if (item.effectRefs?.length) {
      lines.push(`Effects: ${item.effectRefs.join(', ')}`);
    }

    if (item.inventoryOnlyBehavior) {
      lines.push(item.inventoryOnlyBehavior);
    }

    return lines;
  }

  protected perkSocketBadges(instance: ItemInstanceConfig | null): string[] {
    if (!instance?.configuredPerks?.length) {
      return [];
    }

    return [0, 1]
      .map((socketIndex) =>
        instance.configuredPerks
          ?.filter((perk) => perk.socketIndex === socketIndex)
          .map((perk) => this.perkBadgeLabel(perk.perkId, perk.rank))
          .join('') ?? '',
      )
      .filter(Boolean);
  }

  protected perkSocketTooltips(instance: ItemInstanceConfig | null): string[] {
    if (!instance?.configuredPerks?.length) {
      return [];
    }

    return [0, 1]
      .map((socketIndex) => this.perkSocketTooltip(instance.configuredPerks ?? [], socketIndex))
      .filter(Boolean);
  }

  protected eofStoredSpecialBadge(
    item: ItemDefinition | null,
    instance: ItemInstanceConfig | null,
  ): string | null {
    const storedSpecial = this.resolveStringConfigValue(item, instance, 'stored-special');

    if (!storedSpecial || storedSpecial === 'none') {
      return null;
    }

    switch (storedSpecial) {
      case 'dark-bow':
        return 'DB';
      case 'seren-godbow':
        return 'SGB';
      default:
        return storedSpecial
          .split('-')
          .filter(Boolean)
          .map((segment) => segment[0]?.toUpperCase() ?? '')
          .join('')
          .slice(0, 4);
    }
  }

  protected eofStoredSpecialLabel(
    item: ItemDefinition | null,
    instance: ItemInstanceConfig | null,
  ): string | null {
    const storedSpecial = this.resolveStringConfigValue(item, instance, 'stored-special');

    if (!storedSpecial || storedSpecial === 'none') {
      return null;
    }

    return this.itemDefinitions()[storedSpecial]?.name ?? storedSpecial;
  }

  protected hasGenesisEnchantment(instance: ItemInstanceConfig | null): boolean {
    return instance?.configValues?.['genesis-enchanted'] === true;
  }

  protected quiverAmmoIcon(
    item: ItemDefinition | null,
    instance: ItemInstanceConfig | null,
  ): string | null {
    const ammoId = this.resolveStringConfigValue(item, instance, CONFIG_OPTION_IDS.loadedAmmo);

    if (!ammoId || ammoId === 'none') {
      return null;
    }

    return this.itemDefinitions()[ammoId]?.iconPath ?? null;
  }

  protected quiverAmmoLabel(
    item: ItemDefinition | null,
    instance: ItemInstanceConfig | null,
  ): string | null {
    const ammoId = this.resolveStringConfigValue(item, instance, CONFIG_OPTION_IDS.loadedAmmo);

    if (!ammoId || ammoId === 'none') {
      return null;
    }

    const ammoName = this.itemDefinitions()[ammoId]?.name ?? ammoId;
    return `Loaded arrows: ${ammoName}`;
  }

  protected quiverAmmoShortLabel(
    item: ItemDefinition | null,
    instance: ItemInstanceConfig | null,
  ): string | null {
    const ammoId = this.resolveStringConfigValue(item, instance, CONFIG_OPTION_IDS.loadedAmmo);

    if (!ammoId || ammoId === 'none') {
      return null;
    }

    switch (ammoId) {
      case 'deathspore-arrows':
        return 'DS';
      case 'ful-arrows':
        return 'FUL';
      default:
        return ammoId
          .split('-')
          .filter(Boolean)
          .map((segment) => segment[0]?.toUpperCase() ?? '')
          .join('')
          .slice(0, 4);
    }
  }

  protected quiverBoltIcon(
    item: ItemDefinition | null,
    instance: ItemInstanceConfig | null,
  ): string | null {
    if (!this.isQuiver(item, instance)) {
      return null;
    }

    return this.itemDefinitions()[QUIVER_SECONDARY_BOLT_AMMO_ID]?.iconPath ?? null;
  }

  protected quiverBoltLabel(
    item: ItemDefinition | null,
    instance: ItemInstanceConfig | null,
  ): string | null {
    if (!this.isQuiver(item, instance)) {
      return null;
    }

    const ammoName = this.itemDefinitions()[QUIVER_SECONDARY_BOLT_AMMO_ID]?.name ?? QUIVER_SECONDARY_BOLT_AMMO_ID;
    return `Loaded bolts: ${ammoName}`;
  }

  protected quiverBoltShortLabel(
    item: ItemDefinition | null,
    instance: ItemInstanceConfig | null,
  ): string | null {
    if (!this.isQuiver(item, instance)) {
      return null;
    }

    return 'BOLT';
  }

  protected itemIconPath(item: ItemDefinition | null, instance: ItemInstanceConfig | null = null): string | null {
    if (!item) {
      return null;
    }

    const appliedDye = this.resolveStringConfigValue(item, instance, 'applied-dye');

    if (
      appliedDye &&
      appliedDye !== 'default' &&
      item.dyeVariantIconPaths?.[appliedDye]
    ) {
      return item.dyeVariantIconPaths[appliedDye] ?? item.iconPath ?? null;
    }

    return item.iconPath ?? null;
  }

  protected genesisShardIcon(): string {
    return this.genesisShardIconPath;
  }

  protected supportsPerks(item: ItemDefinition): boolean {
    return isAugmentableSlot(item.slot);
  }

  protected updateSocketPerks(socketIndex: number, perkIds: string[]): void {
    const instanceId = this.selectedInstanceId();

    if (!instanceId) {
      return;
    }

    this.gearBuilderStore.updatePerkSocket(instanceId, socketIndex, perkIds);
  }

  protected updatePerkRank(socketIndex: number, perkId: string, rank: number): void {
    const instanceId = this.selectedInstanceId();

    if (!instanceId) {
      return;
    }

    this.gearBuilderStore.updatePerkRank(instanceId, socketIndex, perkId, rank);
  }

  protected updateBooleanConfig(optionId: string, checked: boolean): void {
    const instanceId = this.selectedInstanceId();

    if (!instanceId) {
      return;
    }

    this.gearBuilderStore.updateInstanceConfigValue(instanceId, optionId, checked);
  }

  protected updateScalarConfig(optionId: string, value: string): void {
    const instanceId = this.selectedInstanceId();

    if (!instanceId) {
      return;
    }

    this.gearBuilderStore.updateInstanceConfigValue(instanceId, optionId, value);
  }

  protected startCatalogDrag(event: DragEvent, item: ItemDefinition): void {
    this.startDrag(event, { kind: 'catalog', definitionId: item.id }, `Dragging ${item.name}.`);
  }

  protected startInventoryDrag(event: DragEvent, instanceId: string): void {
    const entry = this.inventoryEntries().find((candidate) => candidate.instance.instanceId === instanceId);
    const label = entry?.definition?.name ?? entry?.instance.definitionId ?? 'item';
    this.startDrag(event, { kind: 'inventory', instanceId }, `Dragging ${label} from backpack.`);
  }

  protected startEquippedDrag(event: DragEvent, slot: EquipmentSlot): void {
    const entry = this.equippedSlots().find((candidate) => candidate.slot === slot);
    const label = entry?.definition?.name ?? formatEquipmentSlot(slot);
    this.startDrag(event, { kind: 'equipped', slot }, `Dragging ${label} from ${formatEquipmentSlot(slot)}.`);
  }

  protected finishDrag(): void {
    this.dragSource.set(null);
    this.hoveredSlot.set(null);
    this.inventoryHovering.set(false);
    this.dragHint.set('Drag items into equipment slots or the backpack.');
  }

  protected handleSlotDragOver(event: DragEvent, slot: EquipmentSlot): void {
    if (this.canDropOnSlot(slot)) {
      event.preventDefault();
    }

    this.inventoryHovering.set(false);
    this.hoveredSlot.set(slot);
  }

  protected clearDropPreview(slot: EquipmentSlot): void {
    if (this.hoveredSlot() === slot) {
      this.hoveredSlot.set(null);
    }
  }

  protected handleSlotDrop(event: DragEvent, slot: EquipmentSlot): void {
    event.preventDefault();

    const source = this.dragSource();
    const dropped = source ? this.applyDropToSlot(source, slot) : false;

    this.finishDrag();
    this.dragHint.set(
      dropped
        ? `Placed item into ${formatEquipmentSlot(slot)}.`
        : `That item cannot be dropped into ${formatEquipmentSlot(slot)}.`,
    );
  }

  protected handleInventoryDragOver(event: DragEvent): void {
    if (this.canDropOnInventory()) {
      event.preventDefault();
    }

    this.hoveredSlot.set(null);
    this.inventoryHovering.set(true);
  }

  protected clearInventoryDropPreview(): void {
    this.inventoryHovering.set(false);
  }

  protected handleInventoryDrop(event: DragEvent): void {
    event.preventDefault();

    const source = this.dragSource();
    const dropped = source ? this.applyDropToInventory(source) : false;

    this.finishDrag();
    this.dragHint.set(
      dropped ? 'Moved item into the backpack.' : 'That drop target is not valid for this item.',
    );
  }

  protected isSlotDropActive(slot: EquipmentSlot): boolean {
    return this.hoveredSlot() === slot && this.canDropOnSlot(slot);
  }

  protected isSlotDropAvailable(slot: EquipmentSlot): boolean {
    return this.dragSource() !== null && this.canDropOnSlot(slot);
  }

  protected isSlotDropBlocked(slot: EquipmentSlot): boolean {
    return this.hoveredSlot() === slot && !this.canDropOnSlot(slot);
  }

  protected isInventoryDropActive(): boolean {
    return this.inventoryHovering() && this.canDropOnInventory();
  }

  protected isInventoryDropAvailable(): boolean {
    return this.dragSource() !== null && this.canDropOnInventory();
  }

  protected isInventoryDropBlocked(): boolean {
    return this.inventoryHovering() && !this.canDropOnInventory();
  }

  private canDropOnSlot(slot: EquipmentSlot): boolean {
    return canDropIntoEquipmentSlot(
      this.dragSource(),
      slot,
      this.itemDefinitions(),
      this.gearState(),
    );
  }

  private canDropOnInventory(): boolean {
    return canDropIntoInventory(this.dragSource(), this.gearState());
  }

  private applyDropToSlot(source: GearDragSource, slot: EquipmentSlot): boolean {
    switch (source.kind) {
      case 'catalog': {
        const definition = this.itemDefinitions()[source.definitionId] ?? null;
        const instanceId = this.gearBuilderStore.equipDefinition(source.definitionId, slot);

        if (definition) {
          this.handleConfiguredPlacement(definition, instanceId);
        }

        return Boolean(instanceId);
      }
      case 'inventory': {
        const resolved = this.gearBuilderStore.resolveInstance(source.instanceId);
        const instanceId = this.gearBuilderStore.equipInventoryItem(source.instanceId, slot);

        if (resolved?.definition) {
          this.handleConfiguredPlacement(resolved.definition, instanceId);
        }

        return Boolean(instanceId);
      }
      case 'equipped':
        return Boolean(this.gearBuilderStore.moveEquippedItem(source.slot, slot));
    }
  }

  private applyDropToInventory(source: GearDragSource): boolean {
    switch (source.kind) {
      case 'catalog': {
        const definition = this.itemDefinitions()[source.definitionId] ?? null;
        const instanceId = this.gearBuilderStore.addToInventory(source.definitionId);

        if (definition) {
          this.handleConfiguredPlacement(definition, instanceId);
        }

        return Boolean(instanceId);
      }
      case 'inventory':
        return false;
      case 'equipped':
        this.gearBuilderStore.clearSlot(source.slot);
        return true;
    }
  }

  private startDrag(event: DragEvent, source: GearDragSource, hint: string): void {
    this.dragSource.set(source);
    this.dragHint.set(hint);

    if (event.dataTransfer) {
      event.dataTransfer.setData('text/plain', JSON.stringify(source));
      event.dataTransfer.effectAllowed = 'move';
    }
  }

  private handleConfiguredPlacement(item: ItemDefinition, instanceId: string | null): void {
    if (!instanceId || !requiresImmediateItemConfiguration(item)) {
      this.selectedItemId.set(null);
      this.selectedInstanceId.set(null);
      return;
    }

    this.selectedItemId.set(item.id);
    this.selectedInstanceId.set(instanceId);
  }

  private perkBadgeLabel(perkId: string, rank: number | undefined): string {
    const perk = this.perkOptions.find((option) => option.id === perkId);
    const rankSuffix = rank ?? 1;
    return `${perk?.shortCode ?? perkId.slice(0, 2).toUpperCase()}${rankSuffix}`;
  }

  private perkSocketTooltip(
    configuredPerks: ConfiguredPerkSelectionLike[],
    socketIndex: number,
  ): string {
    const socketPerks = configuredPerks.filter((perk) => perk.socketIndex === socketIndex);

    if (!socketPerks.length) {
      return '';
    }

    const description = socketPerks
      .map((perk) => {
        const option = this.perkOptions.find((entry) => entry.id === perk.perkId);
        const name = option?.label ?? perk.perkId;
        const rank = perk.rank ?? 1;
        return `${name} ${rank}`;
      })
      .join(', ');

    return `Socket ${socketIndex + 1}: ${description}`;
  }

  private resolveStringConfigValue(
    item: ItemDefinition | null,
    instance: ItemInstanceConfig | null,
    optionId: string,
  ): string | null {
    const configuredValue = instance?.configValues?.[optionId];

    if (typeof configuredValue === 'string') {
      return configuredValue;
    }

    const defaultValue = item?.configOptions?.find((option) => option.id === optionId)?.defaultValue;
    return typeof defaultValue === 'string' ? defaultValue : null;
  }

  private isQuiver(item: ItemDefinition | null, instance: ItemInstanceConfig | null): boolean {
    return item?.id === 'pernixs-quiver' && instance !== null;
  }
}
