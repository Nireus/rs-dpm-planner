import type { AbilityDefinition } from '../../../game-data/types';
import type {
  DamageBreakdown,
  DamageModifierContribution,
  DamageSummary,
  SimulationResult,
} from '../../../simulation-engine/models';

export interface AbilityExplainabilitySummary {
  abilityId: string;
  name: string;
  totalDamage: DamageSummary;
  percentageOfRotation: number;
  hitBreakdowns: DamageBreakdown[];
}

export interface DamageModifierGroupSummary {
  title: string;
  total: number;
  entries: DamageModifierContribution[];
}

export function buildAbilityExplainabilitySummary(
  abilityId: string,
  result: SimulationResult,
  abilities: Record<string, AbilityDefinition>,
): AbilityExplainabilitySummary | null {
  const totalDamage = result.damageByAbility.find((entry) => entry.abilityId === abilityId);

  if (!totalDamage) {
    return null;
  }

  const hitBreakdowns = result.explainability.damageBreakdowns.filter((entry) => entry.abilityId === abilityId);
  const definition = abilities[abilityId];

  return {
    abilityId,
    name: definition?.name ?? humanizeEntityId(abilityId),
    totalDamage,
    percentageOfRotation: result.totalDamage.avg > 0 ? totalDamage.avg / result.totalDamage.avg : 0,
    hitBreakdowns,
  };
}

export function getDefaultSelectedHitId(summary: AbilityExplainabilitySummary | null): string | null {
  return summary?.hitBreakdowns[0]?.hitId ?? null;
}

export function findSelectedHitBreakdown(
  summary: AbilityExplainabilitySummary | null,
  hitId: string | null,
): DamageBreakdown | null {
  if (!summary || !hitId) {
    return null;
  }

  return summary.hitBreakdowns.find((entry) => entry.hitId === hitId) ?? null;
}

export function buildDamageModifierGroupSummaries(
  breakdown: DamageBreakdown | null,
): DamageModifierGroupSummary[] {
  if (!breakdown) {
    return [];
  }

  return [
    buildGroup('Base Hit', [{ sourceId: 'base-hit', label: 'Base hit damage', value: breakdown.baseDamage.avg }]),
    buildGroup('Additive', breakdown.additiveModifiers),
    buildGroup('Multiplicative', breakdown.multiplicativeModifiers),
    buildGroup('Expected Value', breakdown.expectedValueModifiers),
  ];
}

function buildGroup(
  title: string,
  entries: DamageModifierContribution[],
): DamageModifierGroupSummary {
  return {
    title,
    total: roundContribution(entries.reduce((sum, entry) => sum + entry.value, 0)),
    entries,
  };
}

function roundContribution(value: number): number {
  return Math.round(value * 100) / 100;
}

function humanizeEntityId(value: string): string {
  return value
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}
