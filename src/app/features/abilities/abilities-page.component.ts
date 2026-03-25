import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { AbilityDefinition } from '../../../game-data/types';
import { CURATED_ABILITY_UI } from '../../../game-data/abilities/curated-ability-ui';
import { AbilityAvailabilityService } from '../../core/abilities/ability-availability.service';
import { GameDataStoreService } from '../../core/game-data/game-data-store.service';
import { PlayerStatsPanelComponent } from './player-stats-panel.component';
import {
  AbilityDetailDialogComponent,
  type AbilityDetailEntry,
  type DetailAvailabilityState,
} from './ability-detail-dialog.component';

interface GroupedAbilityCategory {
  key: string;
  label: string;
  abilities: AbilityBrowserEntry[];
}

interface GroupedAbilityStyle {
  style: string;
  displayStyle: string;
  categories: GroupedAbilityCategory[];
}

interface AbilityBrowserEntry extends AbilityDetailEntry {
  style: string;
}

@Component({
  selector: 'app-abilities-page',
  standalone: true,
  imports: [FormsModule, PlayerStatsPanelComponent, AbilityDetailDialogComponent],
  templateUrl: './abilities-page.component.html',
  styleUrl: './abilities-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AbilitiesPageComponent {
  private readonly gameDataStore = inject(GameDataStoreService);
  private readonly abilityAvailabilityService = inject(AbilityAvailabilityService);

  protected readonly query = signal('');
  protected readonly selectedEntryId = signal<string | null>(null);
  protected readonly storeSummary = this.gameDataStore.summary;
  protected readonly abilityAvailabilityMap = this.abilityAvailabilityService.availabilityMap;
  protected readonly abilityDefinitions = computed<AbilityBrowserEntry[]>(() =>
    Object.values(this.gameDataStore.snapshot().catalog?.abilities ?? {}).map((ability) => ({
      ...ability,
      ...CURATED_ABILITY_UI[ability.id],
      detailLines: this.buildAbilityDetailLines(ability, CURATED_ABILITY_UI[ability.id]?.detailLines),
      hitCount: ability.hitSchedule.length,
    })),
  );
  protected readonly filteredAbilities = computed(() => {
    const normalizedQuery = this.query().trim().toLowerCase();
    const abilities = this.abilityDefinitions();

    if (!normalizedQuery) {
      return abilities;
    }

    return abilities.filter((ability) =>
      `${ability.name} ${ability.id} ${ability.subtype} ${ability.style}`.toLowerCase().includes(normalizedQuery),
    );
  });
  protected readonly groupedAbilities = computed<GroupedAbilityStyle[]>(() => {
    const styleOrder = ['ranged', 'constitution', 'magic', 'melee', 'necromancy'];
    const categoryOrder = ['basic', 'enhanced', 'ultimate', 'special', 'other'];
    const styleGroups = new Map<string, GroupedAbilityStyle>();

    for (const ability of this.filteredAbilities()) {
      const styleKey = ability.style;
      const categoryKey = ability.subtype;
      const styleGroup = styleGroups.get(styleKey) ?? {
        style: styleKey,
        displayStyle: this.displayStyleLabel(styleKey),
        categories: [],
      };
      let category = styleGroup.categories.find((entry) => entry.key === categoryKey);

      if (!category) {
        category = {
          key: categoryKey,
          label: this.displaySubtypeLabel(categoryKey),
          abilities: [],
        };
        styleGroup.categories.push(category);
      }

      category.abilities.push(ability);
      styleGroups.set(styleKey, styleGroup);
    }

    return Array.from(styleGroups.values())
      .sort((left, right) => styleOrder.indexOf(left.style) - styleOrder.indexOf(right.style))
      .map((styleGroup) => ({
        ...styleGroup,
        categories: styleGroup.categories
          .map((category) => ({
            ...category,
            abilities: [...category.abilities].sort((left, right) => left.name.localeCompare(right.name)),
          }))
          .sort((left, right) => categoryOrder.indexOf(left.key) - categoryOrder.indexOf(right.key)),
      }));
  });
  protected readonly selectedEntry = computed<AbilityBrowserEntry | null>(() => {
    const selectedId = this.selectedEntryId();
    if (!selectedId) {
      return null;
    }

    return this.abilityDefinitions().find((entry) => entry.id === selectedId) ?? null;
  });

  protected openAbilityDetail(entryId: string): void {
    this.selectedEntryId.set(entryId);
  }

  protected closeAbilityDetail(): void {
    this.selectedEntryId.set(null);
  }

  protected abilityAvailability(entry: AbilityBrowserEntry): DetailAvailabilityState | null {
    return this.abilityAvailabilityMap()[entry.id] ?? null;
  }

  protected hoverText(entry: AbilityBrowserEntry): string {
    const availability = this.abilityAvailability(entry);
    const lines = [
      entry.hoverSummary ?? this.compactMeta(entry),
      `Damage: ${this.damageRangeLabel(entry)}`,
      `Schedule: ${this.hitScheduleSummary(entry)}`,
      availability
        ? `Status: ${availability.isAvailable ? 'Available' : availability.issues[0]?.message ?? 'Unavailable'}`
        : null,
    ];

    return lines.filter((line): line is string => Boolean(line)).join('\n');
  }

  protected compactMeta(entry: AbilityBrowserEntry): string {
    const segments = [
      this.displaySubtypeLabel(entry.subtype),
      entry.cooldownTicks !== null && entry.cooldownTicks !== undefined ? `${entry.cooldownTicks} ticks` : null,
      entry.hitCount > 0 ? `${entry.hitCount} hit(s)` : 'Varies',
      entry.adrenalineGain !== undefined
        ? `+${entry.adrenalineGain}% adrenaline`
        : entry.adrenalineCost !== undefined
          ? `-${entry.adrenalineCost}% adrenaline`
          : entry.subtype === 'special'
            ? 'Adrenaline varies'
            : '0% adrenaline',
    ];

    return segments.filter((segment): segment is string => Boolean(segment)).join(' | ');
  }

  protected cardMeta(entry: AbilityBrowserEntry): string {
    const segments = [
      entry.cooldownTicks !== null && entry.cooldownTicks !== undefined ? `${entry.cooldownTicks}t` : null,
      entry.hitCount > 0 ? `${entry.hitCount}h` : 'Varies',
      entry.adrenalineGain !== undefined
        ? `+${entry.adrenalineGain}%`
        : entry.adrenalineCost !== undefined
          ? `-${entry.adrenalineCost}%`
          : entry.subtype === 'special'
            ? 'Varies'
            : '0%',
    ];

    return segments.filter((segment): segment is string => Boolean(segment)).join(' | ');
  }

  protected initials(name: string): string {
    return name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('');
  }

  protected displaySubtypeLabel(subtype: string): string {
    switch (subtype) {
      case 'enhanced':
        return 'Enhanced';
      case 'basic':
        return 'Basic';
      case 'ultimate':
        return 'Ultimate';
      case 'special':
        return 'Special';
      default:
        return subtype;
    }
  }

  protected displayStyleLabel(style: string): string {
    if (style === 'constitution') {
      return 'Constitution';
    }

    return style.charAt(0).toUpperCase() + style.slice(1);
  }

  private damageRangeLabel(entry: AbilityBrowserEntry): string {
    if (!entry.baseDamage) {
      return 'Varies';
    }

    const { min, max } = entry.baseDamage;

    if (min === 0 && max === 0 && entry.subtype === 'special') {
      return 'Varies';
    }

    return `${min}% - ${max}%`;
  }

  private hitScheduleSummary(entry: AbilityBrowserEntry): string {
    const schedule = entry.hitSchedule ?? [];

    if (schedule.length === 0) {
      return entry.subtype === 'special' ? 'Varies by equipped source.' : 'Single resolved hit.';
    }

    if (schedule.length === 1) {
      return `1 hit at tick ${schedule[0].tickOffset}`;
    }

    const offsets = schedule.map((hit) => hit.tickOffset);
    const preview = offsets.slice(0, 5).join(', ');
    return `${schedule.length} hits at ticks ${preview}${offsets.length > 5 ? ', ...' : ''}`;
  }

  private buildAbilityDetailLines(
    ability: AbilityDefinition,
    curatedDetailLines?: string[],
  ): string[] {
    if (curatedDetailLines?.length) {
      return curatedDetailLines;
    }

    const lines = [
      ability.requires?.levelRequirements?.['ranged']
        ? `Requires level ${ability.requires.levelRequirements['ranged']} Ranged.`
        : null,
      ability.isChanneled ? `Channels for ${ability.channelDurationTicks ?? ability.hitSchedule.length} ticks.` : null,
      ability.effectRefs?.length ? `Effects: ${ability.effectRefs.join(', ')}` : null,
    ];

    return lines.filter((line): line is string => Boolean(line));
  }
}
