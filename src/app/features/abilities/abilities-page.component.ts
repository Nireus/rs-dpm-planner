import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  ABILITY_STYLE_TABS,
  abilityStyleEmptyMessage,
  displayAbilitySubtypeLabel,
  filterAbilitiesByStyle,
  groupAbilitiesBySubtype,
} from '../../core/abilities/ability-style-tabs';
import type { AbilityDefinition, CombatStyle } from '../../../game-data/types';
import { AbilityAvailabilityService } from '../../core/abilities/ability-availability.service';
import { BuffConfigurationStoreService } from '../../core/buffs/buff-configuration-store.service';
import { GameDataStoreService } from '../../core/game-data/game-data-store.service';
import { GearBuilderStore } from '../../core/gear/gear-builder.store';
import { PlayerStatsStoreService } from '../../core/player-stats/player-stats-store.service';
import { buildSimulationConfigFromAppState } from '../../core/simulation/simulation-config.builder';
import { resolveEffectiveAbilityDefinition } from '../../../simulation-engine/abilities/effective-ability';
import {
  AbilityDetailDialogComponent,
  type AbilityDetailEntry,
  type DetailAvailabilityState,
} from './ability-detail-dialog.component';

interface AbilityBrowserEntry extends AbilityDetailEntry {
  style: CombatStyle;
  subtype: AbilityDefinition['subtype'];
}

@Component({
  selector: 'app-abilities-page',
  standalone: true,
  imports: [FormsModule, AbilityDetailDialogComponent],
  templateUrl: './abilities-page.component.html',
  styleUrl: './abilities-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AbilitiesPageComponent {
  private readonly gameDataStore = inject(GameDataStoreService);
  private readonly abilityAvailabilityService = inject(AbilityAvailabilityService);
  private readonly gearBuilderStore = inject(GearBuilderStore);
  private readonly buffConfigurationStore = inject(BuffConfigurationStoreService);
  private readonly playerStatsStore = inject(PlayerStatsStoreService);

  protected readonly query = signal('');
  protected readonly styleTabs = ABILITY_STYLE_TABS;
  protected readonly selectedStyleTab = signal<CombatStyle>('ranged');
  protected readonly selectedEntryId = signal<string | null>(null);
  protected readonly storeSummary = this.gameDataStore.summary;
  protected readonly abilityAvailabilityMap = this.abilityAvailabilityService.availabilityMap;
  protected readonly abilityDefinitions = computed<AbilityBrowserEntry[]>(() => {
    const catalog = this.gameDataStore.snapshot().catalog;
    if (!catalog) {
      return [];
    }

    const simulationConfig = buildSimulationConfigFromAppState({
      catalog,
      playerStats: this.playerStatsStore.stats(),
      gearState: this.gearBuilderStore.snapshot(),
      buffState: this.buffConfigurationStore.state(),
      rotationPlan: {
        startingAdrenaline: 100,
        tickCount: 1,
        nonGcdActions: [],
        abilityActions: [],
      },
    });

    return Object.values(catalog.abilities)
      .filter((ability) => !ability.displayHints?.hiddenFromUi)
      .map((ability) =>
        buildAbilityBrowserEntry(simulationConfig, ability, (resolvedAbility) =>
          this.buildAbilityDetailLines(resolvedAbility),
        ),
      );
  });
  protected readonly filteredAbilities = computed(() => {
    const normalizedQuery = this.query().trim().toLowerCase();
    const abilities = filterAbilitiesByStyle(this.abilityDefinitions(), this.selectedStyleTab());

    if (!normalizedQuery) {
      return abilities;
    }

    return abilities.filter((ability) =>
      `${ability.name} ${ability.id} ${ability.subtype} ${ability.style}`.toLowerCase().includes(normalizedQuery),
    );
  });
  protected readonly groupedAbilities = computed(() => groupAbilitiesBySubtype(this.filteredAbilities()));
  protected readonly selectedStyleLabel = computed(
    () => this.styleTabs.find((tab) => tab.id === this.selectedStyleTab())?.label ?? this.selectedStyleTab(),
  );
  protected readonly selectedStyleThemeClass = computed(
    () => this.styleTabs.find((tab) => tab.id === this.selectedStyleTab())?.themeClass ?? '',
  );
  protected readonly abilitiesEmptyHeading = computed(() =>
    this.query().trim() ? 'No Matches' : 'Coming Soon',
  );
  protected readonly abilitiesEmptyCopy = computed(() =>
    this.query().trim()
      ? 'No loaded abilities match the current search.'
      : abilityStyleEmptyMessage(this.selectedStyleTab()),
  );
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
      entry.displayHoverSummary ?? entry.hoverSummary ?? this.compactMeta(entry),
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
      entry.displayHitCountLabel ?? (entry.hitCount > 0 ? `${entry.hitCount} hit(s)` : 'Varies'),
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
    return displayAbilitySubtypeLabel(subtype);
  }

  protected selectStyleTab(style: CombatStyle): void {
    this.selectedStyleTab.set(style);
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
    if (entry.displayHitScheduleSummary) {
      return entry.displayHitScheduleSummary;
    }

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
  ): string[] {
    if (ability.detailLines?.length) {
      return ability.detailLines;
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

export function buildAbilityBrowserEntry(
  simulationConfig: Parameters<typeof resolveEffectiveAbilityDefinition>[0],
  ability: AbilityDefinition,
  buildDetailLines: (ability: AbilityDefinition) => string[],
): AbilityBrowserEntry {
  const resolvedAbility = resolveEffectiveAbilityDefinition(simulationConfig, {
    id: `ability-browser:${ability.id}`,
    tick: 0,
    lane: 'ability',
    actionType: 'ability-use',
    payload: {
      abilityId: ability.id,
    },
  }) ?? ability;
  const displayHints = resolvedAbility.displayHints;

  return {
    ...resolvedAbility,
    detailLines: buildDetailLines(resolvedAbility),
    hitCount: resolvedAbility.hitSchedule.length,
    displayHoverSummary: displayHints?.hoverSummary,
    displayHitCountLabel: displayHints?.hitCountLabel,
    displayDamageRangeLabel: displayHints?.damageRangeLabel,
    displayHitScheduleSummary: displayHints?.hitScheduleSummary,
  };
}
