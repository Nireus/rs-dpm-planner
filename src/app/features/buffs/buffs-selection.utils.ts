import type { BuffCategory, BuffDefinition, ItemDefinition, RelicDefinition } from '../../../game-data/types';

export type BuffSelectionKind = 'buff' | 'relic' | 'pocket' | 'equipped-perk';
export type TimelineBuffSelectionKind = 'timeline-generated';

export interface BuffSelectionOption {
  id: string;
  name: string;
  kind: BuffSelectionKind | TimelineBuffSelectionKind;
  categoryLabel: string;
  description: string;
  iconPath?: string;
  wikiUrl?: string;
  detailLines?: string[];
  resourceCost?: number;
  effectRefs?: string[];
}

const CONFIGURABLE_BUFF_CATEGORIES: BuffCategory[] = ['prayer', 'potion', 'passive', 'miscellaneous'];

export function isConfigurableBuffCategory(category: BuffCategory): boolean {
  return CONFIGURABLE_BUFF_CATEGORIES.includes(category);
}

export function toggleSelectionId(currentIds: readonly string[], id: string): string[] {
  return currentIds.includes(id) ? currentIds.filter((entry) => entry !== id) : [...currentIds, id];
}

export function buildBuffOptions(buffDefinitions: readonly BuffDefinition[]): BuffSelectionOption[] {
  return buffDefinitions
    .filter((definition) => isConfigurableBuffCategory(definition.category))
    .map((definition) => ({
      id: definition.id,
      name: definition.name,
      kind: 'buff' as const,
      categoryLabel: formatBuffCategory(definition.category),
      description: formatBuffSource(definition),
      iconPath: definition.iconPath,
      wikiUrl: definition.wikiUrl,
      detailLines: buildBuffDetailLines(definition),
      effectRefs: definition.effectRefs,
    }));
}

export function buildPrayerOptions(buffDefinitions: readonly BuffDefinition[]): BuffSelectionOption[] {
  return buildBuffOptions(buffDefinitions).filter((definition) => definition.categoryLabel === 'Prayer');
}

export function buildPotionOptions(buffDefinitions: readonly BuffDefinition[]): BuffSelectionOption[] {
  return buildBuffOptions(buffDefinitions).filter((definition) => definition.categoryLabel === 'Potion');
}

export function buildPassiveBuffOptions(buffDefinitions: readonly BuffDefinition[]): BuffSelectionOption[] {
  return buildBuffOptions(buffDefinitions).filter((definition) => definition.categoryLabel === 'Passive');
}

export function buildMiscellaneousBuffOptions(buffDefinitions: readonly BuffDefinition[]): BuffSelectionOption[] {
  return buildBuffOptions(buffDefinitions).filter((definition) => definition.categoryLabel === 'Miscellaneous');
}

export function buildSummonOptions(buffDefinitions: readonly BuffDefinition[]): BuffSelectionOption[] {
  return buffDefinitions
    .filter((definition) => definition.category === 'summon')
    .map((definition) => ({
      id: definition.id,
      name: definition.name,
      kind: 'buff' as const,
      categoryLabel: 'Summon',
      description: formatBuffSource(definition),
      iconPath: definition.iconPath,
      wikiUrl: definition.wikiUrl,
      detailLines: buildBuffDetailLines(definition),
      effectRefs: definition.effectRefs,
    }));
}

export function buildRelicOptions(relicDefinitions: readonly RelicDefinition[]): BuffSelectionOption[] {
  return relicDefinitions.map((definition) => ({
    id: definition.id,
    name: definition.name,
    kind: 'relic' as const,
    categoryLabel: 'Relic',
    description:
      definition.description && definition.monolithEnergy
        ? `${definition.description} ${definition.monolithEnergy} monolith energy.`
        : definition.description ?? 'Archaeology relic passive.',
    iconPath: definition.iconPath,
    wikiUrl: definition.wikiUrl,
    detailLines: buildRelicDetailLines(definition),
    resourceCost: definition.monolithEnergy,
    effectRefs: definition.effectRefs,
  }));
}

export function buildTimelineGeneratedBuffOptions(buffDefinitions: readonly BuffDefinition[]): BuffSelectionOption[] {
  return buffDefinitions
    .filter((definition) => isTimelineGeneratedBuff(definition))
    .map((definition) => ({
      id: definition.id,
      name: definition.name,
      kind: 'timeline-generated' as const,
      categoryLabel: 'Timeline Generated',
      description: formatTimelineGeneratedSource(definition),
      iconPath: definition.iconPath,
      effectRefs: definition.effectRefs,
    }));
}

export function buildPocketOption(item: ItemDefinition | null): BuffSelectionOption | null {
  if (!item) {
    return null;
  }

  return {
    id: item.id,
    name: item.name,
    kind: 'pocket',
    categoryLabel: 'Pocket',
    description: item.hoverSummary ?? 'Effect from currently equipped pocket item.',
    iconPath: item.iconPath,
    detailLines: item.detailLines,
    effectRefs: item.effectRefs,
  };
}

export function activateExclusivePotion(
  currentBuffIds: readonly string[],
  potionOptions: readonly BuffSelectionOption[],
  potionId: string,
): string[] {
  const potionIds = new Set(potionOptions.map((option) => option.id));
  const withoutExistingPotions = currentBuffIds.filter((id) => !potionIds.has(id));
  return [...withoutExistingPotions, potionId];
}

export function calculateRelicEnergy(
  activeRelicIds: readonly string[],
  relicOptions: readonly BuffSelectionOption[],
): number {
  const optionMap = new Map(relicOptions.map((option) => [option.id, option] as const));

  return activeRelicIds.reduce((total, id) => total + (optionMap.get(id)?.resourceCost ?? 0), 0);
}

export function canActivateRelicWithinCap(
  activeRelicIds: readonly string[],
  relicOptions: readonly BuffSelectionOption[],
  relicId: string,
  cap: number,
): boolean {
  const currentEnergy = calculateRelicEnergy(activeRelicIds, relicOptions);
  const currentOption = relicOptions.find((option) => option.id === relicId);
  const nextEnergy = currentEnergy + (currentOption?.resourceCost ?? 0);
  return nextEnergy <= cap;
}

function formatBuffCategory(category: BuffCategory): string {
  switch (category) {
    case 'prayer':
      return 'Prayer';
    case 'potion':
      return 'Potion';
    case 'passive':
      return 'Passive';
    case 'miscellaneous':
      return 'Miscellaneous';
    case 'summon':
      return 'Summon';
    default:
      return category;
  }
}

function formatBuffSource(definition: BuffDefinition): string {
  if (definition.category === 'prayer') {
    return 'Persistent damage-affecting prayer.';
  }

  if (definition.category === 'potion') {
    const variantSummary =
      definition.variantNames && definition.variantNames.length
        ? ` Includes: ${definition.variantNames.join(', ')}.`
        : '';

    return `Pre-fight potion buff.${variantSummary}`;
  }

  if (definition.category === 'miscellaneous') {
    return definition.sourceType === 'player-config'
      ? 'Manual passive utility modifier.'
      : 'Miscellaneous persistent modifier.';
  }

  if (definition.category === 'summon') {
    return 'Configured familiar or familiar scroll effect.';
  }

  return definition.sourceType === 'player-config'
    ? 'Manual passive modifier.'
    : 'Persistent external modifier.';
}

function isTimelineGeneratedBuff(definition: BuffDefinition): boolean {
  if (definition.category === 'temporary') {
    return true;
  }

  return !isConfigurableBuffCategory(definition.category) && definition.sourceType !== 'player-config';
}

function formatTimelineGeneratedSource(definition: BuffDefinition): string {
  switch (definition.sourceType) {
    case 'ability':
      return 'Generated later by an ability during simulation.';
    case 'item':
      return 'Generated later by an equipped item or ammo effect during simulation.';
    case 'perk':
      return 'Generated later by a perk-triggered effect during simulation.';
    default:
      return 'Generated later by simulation events instead of pre-fight setup.';
  }
}

function buildBuffDetailLines(definition: BuffDefinition): string[] {
  return [
    `${formatBuffCategory(definition.category)} modifier`,
    definition.isPermanent ? 'Configured before the rotation starts.' : 'May expire during rotation.',
    ...(definition.variantNames?.length ? [`Includes: ${definition.variantNames.join(', ')}`] : []),
  ];
}

function buildRelicDetailLines(definition: RelicDefinition): string[] {
  return [
    ...(definition.monolithEnergy ? [`Monolith energy: ${definition.monolithEnergy}`] : []),
    ...(definition.description ? [definition.description] : []),
  ];
}
