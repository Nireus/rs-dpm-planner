import { computed, inject, Injectable } from '@angular/core';
import {
  isRecognizedStyleTopologyRequirementTag,
} from '../../../game-data/conventions/equipment-requirement-tags';
import type { AbilityDefinition, CombatStyle, ItemDefinition } from '../../../game-data/types';
import { GameDataStoreService } from '../game-data/game-data-store.service';
import { GearBuilderStore } from '../gear/gear-builder.store';
import { PlayerStatsStoreService } from '../player-stats/player-stats-store.service';
import {
  evaluateAbilityAvailability,
  type AbilityAvailabilityResult,
} from '../../../simulation-engine/rules/ability-availability';

@Injectable({
  providedIn: 'root',
})
export class AbilityAvailabilityService {
  private readonly gameDataStore = inject(GameDataStoreService);
  private readonly gearBuilderStore = inject(GearBuilderStore);
  private readonly playerStatsStore = inject(PlayerStatsStoreService);

  readonly availabilityMap = computed(() => {
    const catalog = this.gameDataStore.snapshot().catalog;

    if (!catalog) {
      return {};
    }

    const equippedItems = this.gearBuilderStore
      .equippedSlots()
      .flatMap((entry) => (entry.definition ? [entry.definition] : []));

    const inventoryItems = this.gearBuilderStore
      .inventoryEntries()
      .flatMap((entry) => (entry.definition ? [entry.definition] : []));

    const equippedInstances = this.gearBuilderStore
      .equippedSlots()
      .flatMap((entry) => (entry.instance ? [entry.instance] : []));

    return Object.fromEntries(
      Object.values(catalog.abilities).map((ability) => [
        ability.id,
        relaxAbilityAvailabilityForPalette(
          ability,
          evaluateAbilityAvailability(ability, {
            playerStats: this.playerStatsStore.stats(),
            equippedItems,
            inventoryItems,
            equippedInstances,
          }),
          equippedItems,
          inventoryItems,
        ),
      ]),
    );
  });
}

export function relaxAbilityAvailabilityForPalette(
  ability: AbilityDefinition,
  availability: AbilityAvailabilityResult,
  equippedItems: ItemDefinition[],
  inventoryItems: ItemDefinition[],
): AbilityAvailabilityResult {
  if (availability.isAvailable) {
    return availability;
  }

  if (!availability.issues.length || availability.issues.some((issue) => issue.code !== 'missing-tag')) {
    return availability;
  }

  const lenientRequirementTags = resolveLenientPaletteRequirementTags(ability);
  if (!lenientRequirementTags.length) {
    return availability;
  }

  const achievableTags = collectAchievablePaletteTags([...equippedItems, ...inventoryItems]);
  if (!lenientRequirementTags.every((tag) => achievableTags.has(tag))) {
    return availability;
  }

  return {
    ...availability,
    isAvailable: true,
    issues: [],
  };
}

function resolveLenientPaletteRequirementTags(ability: AbilityDefinition): string[] {
  const requiredEquipmentTags = ability.requires?.requiredEquipmentTags ?? [];

  if (requiredEquipmentTags.length === 1) {
    const [tag] = requiredEquipmentTags;
    if (
      tag === 'melee-weapon' ||
      tag === 'ranged-weapon' ||
      tag === 'magic-weapon' ||
      isRecognizedStyleTopologyRequirementTag(tag)
    ) {
      return [tag];
    }

    return [];
  }

  if (requiredEquipmentTags.length > 1 || ability.subtype === 'special') {
    return [];
  }

  switch (ability.style) {
    case 'melee':
      return ['melee-weapon'];
    case 'ranged':
      return ['ranged-weapon'];
    case 'magic':
      return ['magic-weapon'];
    default:
      return [];
  }
}

function collectAchievablePaletteTags(items: ItemDefinition[]): Set<string> {
  const tags = new Set<string>();

  for (const style of ['melee', 'ranged', 'magic'] as const) {
    const mainHands = items.filter((item) => isMainHandStyleWeapon(item, style));
    const offHands = items.filter((item) => isOffHandStyleWeapon(item, style));
    const twoHanded = mainHands.filter((item) => item.equipBehavior === 'two-handed');
    const oneHandedMainHands = mainHands.filter((item) => item.equipBehavior !== 'two-handed');

    if (mainHands.length) {
      tags.add(`${style}-weapon`);
    }

    if (twoHanded.length) {
      tags.add(`${style}-two-handed`);
    }

    if (offHands.length) {
      tags.add(`${style}-off-hand`);
    }

    if (oneHandedMainHands.length && offHands.length) {
      tags.add(`${style}-dual-wield`);
    }
  }

  return tags;
}

function isMainHandStyleWeapon(item: ItemDefinition, style: CombatStyle): boolean {
  return item.category === 'weapon' && item.slot === 'weapon' && item.combatStyleTags.includes(style);
}

function isOffHandStyleWeapon(item: ItemDefinition, style: CombatStyle): boolean {
  return item.category === 'weapon' && item.slot === 'offHand' && item.combatStyleTags.includes(style);
}
