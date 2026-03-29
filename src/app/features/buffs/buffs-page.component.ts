import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CURATED_PERK_OPTIONS } from '../../../game-data/perks/curated-perk-options';
import { BuffConfigurationStoreService } from '../../core/buffs/buff-configuration-store.service';
import { GameDataStoreService } from '../../core/game-data/game-data-store.service';
import { PlayerStatsStoreService } from '../../core/player-stats/player-stats-store.service';
import { GearBuilderStore } from '../gear/gear-builder.store';
import { BuffDetailDialogComponent } from './buff-detail-dialog.component';
import {
  activateExclusivePotion,
  buildBuffOptions,
  buildMiscellaneousBuffOptions,
  calculateRelicEnergy,
  buildPotionOptions,
  buildPrayerOptions,
  buildPassiveBuffOptions,
  buildRelicOptions,
  canActivateRelicWithinCap,
  type BuffSelectionOption,
} from './buffs-selection.utils';

interface BuffOptionGroup {
  key: string;
  label: string;
  options: BuffSelectionOption[];
  showCategoryLabel?: boolean;
}

const RELIC_POWER_CAP = 650;

@Component({
  selector: 'app-buffs-page',
  standalone: true,
  imports: [FormsModule, BuffDetailDialogComponent],
  templateUrl: './buffs-page.component.html',
  styleUrl: './buffs-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BuffsPageComponent {
  private readonly gameDataStore = inject(GameDataStoreService);
  private readonly buffConfigurationStore = inject(BuffConfigurationStoreService);
  private readonly gearBuilderStore = inject(GearBuilderStore);
  private readonly playerStatsStore = inject(PlayerStatsStoreService);

  protected readonly query = signal('');
  protected readonly selectedOption = signal<BuffSelectionOption | null>(null);
  protected readonly dragOptionId = signal<string | null>(null);
  protected readonly dragSourceKind = signal<'active' | 'catalog' | null>(null);
  protected readonly dragTarget = signal<string | null>(null);
  protected readonly storeSummary = this.gameDataStore.summary;
  protected readonly playerStats = this.playerStatsStore.stats;
  protected readonly buffOptions = computed(() =>
    buildBuffOptions(Object.values(this.gameDataStore.snapshot().catalog?.buffs ?? {})),
  );
  protected readonly prayerOptions = computed(() =>
    buildPrayerOptions(Object.values(this.gameDataStore.snapshot().catalog?.buffs ?? {})),
  );
  protected readonly potionOptions = computed(() =>
    buildPotionOptions(Object.values(this.gameDataStore.snapshot().catalog?.buffs ?? {})),
  );
  protected readonly passiveBuffOptions = computed(() =>
    this.filterConditionalPerkBuffOptions(
      buildPassiveBuffOptions(Object.values(this.gameDataStore.snapshot().catalog?.buffs ?? {})),
    ),
  );
  protected readonly miscellaneousBuffOptions = computed(() =>
    buildMiscellaneousBuffOptions(Object.values(this.gameDataStore.snapshot().catalog?.buffs ?? {})),
  );
  protected readonly relicOptions = computed(() =>
    buildRelicOptions(Object.values(this.gameDataStore.snapshot().catalog?.relics ?? {})),
  );
  protected readonly equippedPerkOptions = computed<BuffSelectionOption[]>(() => {
    const perkDefinitions = this.gameDataStore.snapshot().catalog?.perks ?? {};

    return this.gearBuilderStore
      .equippedSlots()
      .flatMap((slot) =>
        (slot.instance?.configuredPerks ?? []).map((configuredPerk) => {
          const definition = perkDefinitions[configuredPerk.perkId];
          const curated = CURATED_PERK_OPTIONS.find((option) => option.id === configuredPerk.perkId);
          const rank = configuredPerk.rank ? ` ${configuredPerk.rank}` : '';

          return {
            id: `${slot.slot}:${configuredPerk.socketIndex}:${configuredPerk.perkId}`,
            name: `${definition?.name ?? configuredPerk.perkId}${rank}`,
            kind: 'equipped-perk' as const,
            categoryLabel: `Perk · ${slot.label}`,
            description: `Derived from equipped ${slot.definition?.name ?? 'item'} in socket ${configuredPerk.socketIndex + 1}.`,
            iconPath: definition?.iconPath,
            effectRefs: definition?.effectRefs ?? (curated ? [curated.id] : undefined),
          };
        }),
      );
  });
  protected readonly activeIds = computed(() => ({
    buffs: new Set(this.buffConfigurationStore.activeBuffIds()),
    relics: new Set(this.buffConfigurationStore.activeRelicIds()),
    pockets: new Set(this.buffConfigurationStore.activePocketItemIds()),
  }));
  protected readonly validationMessage = signal<string | null>(null);

  protected readonly filteredGroups = computed<BuffOptionGroup[]>(() => {
    const normalizedQuery = this.query().trim().toLowerCase();
    const groups: BuffOptionGroup[] = [
      {
        key: 'prayers',
        label: 'Prayers',
        options: this.prayerOptions(),
        showCategoryLabel: false,
      },
      {
        key: 'potions',
        label: 'Potions',
        options: this.potionOptions(),
        showCategoryLabel: false,
      },
      {
        key: 'passive-buffs',
        label: 'Passive Buffs',
        options: this.passiveBuffOptions(),
        showCategoryLabel: false,
      },
      {
        key: 'miscellaneous-buffs',
        label: 'Miscellaneous',
        options: this.miscellaneousBuffOptions(),
        showCategoryLabel: false,
      },
      {
        key: 'relics',
        label: 'Relics',
        options: this.relicOptions(),
        showCategoryLabel: false,
      },
    ];

    return groups
      .map((group) => ({
        ...group,
        options: normalizedQuery
          ? group.options.filter((option) =>
              `${option.name} ${option.id} ${option.categoryLabel} ${option.description} ${option.effectRefs?.join(' ') ?? ''}`
                .toLowerCase()
                .includes(normalizedQuery),
            )
          : group.options,
      }))
      .filter((group) => group.options.length > 0);
  });

  protected readonly activeOptions = computed(() => {
    const active = this.activeIds();

    return [
      ...this.buffOptions().filter((option) => active.buffs.has(option.id)),
      ...this.relicOptions().filter((option) => active.relics.has(option.id)),
    ];
  });
  protected readonly activeRelicEnergy = computed(() =>
    calculateRelicEnergy(this.buffConfigurationStore.activeRelicIds(), this.relicOptions()),
  );

  protected readonly selectedOptionIsActive = computed(() => {
    const selected = this.selectedOption();
    return selected ? this.isActive(selected) : false;
  });

  protected toggleOption(option: BuffSelectionOption): void {
    this.validationMessage.set(null);

    switch (option.kind) {
      case 'buff':
        if (option.categoryLabel === 'Potion' && !this.activeIds().buffs.has(option.id)) {
          const nextBuffIds = activateExclusivePotion(
            this.buffConfigurationStore.activeBuffIds(),
            this.potionOptions(),
            option.id,
          );

          this.replaceBuffSelections(nextBuffIds);
          return;
        }

        this.buffConfigurationStore.toggleBuff(option.id);
        return;
      case 'relic':
        if (!this.activeIds().relics.has(option.id)) {
          const canActivate = canActivateRelicWithinCap(
            this.buffConfigurationStore.activeRelicIds(),
            this.relicOptions(),
            option.id,
            RELIC_POWER_CAP,
          );

          if (!canActivate) {
            this.validationMessage.set(`Relics cannot exceed ${RELIC_POWER_CAP} monolith energy.`);
            return;
          }
        }

        this.buffConfigurationStore.toggleRelic(option.id);
        return;
      case 'pocket':
        this.buffConfigurationStore.togglePocketItem(option.id);
        return;
      case 'equipped-perk':
        return;
      case 'timeline-generated':
        return;
    }
  }

  protected isReadonly(option: BuffSelectionOption): boolean {
    return option.kind === 'equipped-perk';
  }

  protected openOptionDetail(option: BuffSelectionOption): void {
    this.selectedOption.set(option);
  }

  protected closeOptionDetail(): void {
    this.selectedOption.set(null);
  }

  protected toggleSelectedOption(): void {
    const selected = this.selectedOption();

    if (!selected || this.isReadonly(selected)) {
      return;
    }

    this.toggleOption(selected);
  }

  protected onDragStart(option: BuffSelectionOption, sourceKind: 'active' | 'catalog', event: DragEvent): void {
    if (this.isReadonly(option)) {
      return;
    }

    this.dragOptionId.set(option.id);
    this.dragSourceKind.set(sourceKind);
    event.dataTransfer?.setData('text/plain', option.id);
    event.dataTransfer!.effectAllowed = 'move';
  }

  protected onDragEnd(): void {
    this.dragOptionId.set(null);
    this.dragSourceKind.set(null);
    this.dragTarget.set(null);
  }

  protected allowDrop(event: DragEvent): void {
    event.preventDefault();
  }

  protected setDragTarget(target: string | null): void {
    this.dragTarget.set(target);
  }

  protected dropToActive(event: DragEvent): void {
    event.preventDefault();
    const option = this.findOptionByDraggedId();

    if (!option || this.isReadonly(option)) {
      this.onDragEnd();
      return;
    }

    if (!this.isActive(option)) {
      this.toggleOption(option);
    }

    this.onDragEnd();
  }

  protected dropToGroup(group: BuffOptionGroup, event: DragEvent): void {
    event.preventDefault();
    const option = this.findOptionByDraggedId();

    if (!option || this.isReadonly(option)) {
      this.onDragEnd();
      return;
    }

    if (this.dragSourceKind() === 'active' && this.isActive(option)) {
      this.toggleOption(option);
      this.onDragEnd();
      return;
    }

    if (group.options.some((entry) => entry.id === option.id) && this.isActive(option)) {
      this.toggleOption(option);
    }

    this.onDragEnd();
  }

  protected isDragged(option: BuffSelectionOption): boolean {
    return this.dragOptionId() === option.id;
  }

  protected isActiveDropTarget(): boolean {
    return this.dragTarget() === 'active';
  }

  protected isGroupDropTarget(groupKey: string): boolean {
    return this.dragTarget() === groupKey;
  }

  protected canDropToActive(): boolean {
    const option = this.findOptionByDraggedId();
    return !!option && !this.isReadonly(option);
  }

  protected canDropToGroup(group: BuffOptionGroup): boolean {
    const option = this.findOptionByDraggedId();

    if (!option || this.isReadonly(option)) {
      return false;
    }

    if (this.dragSourceKind() === 'active' && this.isActive(option)) {
      return true;
    }

    return group.options.some((entry) => entry.id === option.id);
  }

  protected isActive(option: BuffSelectionOption): boolean {
    const active = this.activeIds();

    switch (option.kind) {
      case 'buff':
        return active.buffs.has(option.id);
      case 'relic':
        return active.relics.has(option.id);
      case 'pocket':
        return active.pockets.has(option.id);
      case 'equipped-perk':
        return true;
      case 'timeline-generated':
        return true;
    }
  }

  protected summaryLine(option: BuffSelectionOption): string {
    const effects = option.effectRefs?.length ? `Effects: ${option.effectRefs.join(', ')}` : 'No effect refs yet.';
    return `${option.categoryLabel} | ${effects}`;
  }

  protected tileSummary(option: BuffSelectionOption): string {
    if (option.kind === 'equipped-perk') {
      return option.description;
    }

    if (option.kind === 'pocket') {
      return 'Pocket effect';
    }

    return option.effectRefs?.join(', ') ?? option.description;
  }

  protected initials(name: string): string {
    return name
      .split(/[\s'-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('');
  }

  protected updatePrayerLevel(value: string | number | null): void {
    this.playerStatsStore.updateStat('prayerLevel', this.parseLevel(value));
  }

  private findOptionByDraggedId(): BuffSelectionOption | null {
    const draggedId = this.dragOptionId();

    if (!draggedId) {
      return null;
    }

    const allOptions = [
      ...this.buffOptions(),
      ...this.relicOptions(),
    ];

    return allOptions.find((option) => option.id === draggedId) ?? null;
  }

  private parseLevel(value: string | number | null): number | undefined {
    if (value === null || value === undefined) {
      return undefined;
    }

    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : undefined;
    }

    const trimmed = value.trim();
    if (!trimmed) {
      return undefined;
    }

    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  private replaceBuffSelections(nextBuffIds: string[]): void {
    const currentBuffIds = this.buffConfigurationStore.activeBuffIds();

    for (const buffId of currentBuffIds) {
      if (!nextBuffIds.includes(buffId)) {
        this.buffConfigurationStore.toggleBuff(buffId);
      }
    }

    for (const buffId of nextBuffIds) {
      if (!currentBuffIds.includes(buffId)) {
        this.buffConfigurationStore.toggleBuff(buffId);
      }
    }
  }

  private filterConditionalPerkBuffOptions(options: readonly BuffSelectionOption[]): BuffSelectionOption[] {
    const equippedPerkIds = new Set(
      this.gearBuilderStore
        .equippedSlots()
        .flatMap((slot) => (slot.instance?.configuredPerks ?? []).map((perk) => perk.perkId)),
    );

    return options.filter((option) => {
      switch (option.id) {
        case 'dragon-slayer-active':
          return equippedPerkIds.has('dragon-slayer');
        case 'demon-slayer-active':
          return equippedPerkIds.has('demon-slayer');
        case 'undead-slayer-active':
          return equippedPerkIds.has('undead-slayer');
        case 'flanking-active':
          return equippedPerkIds.has('flanking');
        default:
          return true;
      }
    });
  }
}
