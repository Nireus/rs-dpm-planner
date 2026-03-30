import type { EntityId, EquipmentSlot, HitDefinition } from '../../game-data/types';
import type { TimelineGeneratedBuffSource } from './config';

export type ValidationSeverity = 'info' | 'warning' | 'error';

export interface ValidationIssue {
  code: string;
  severity: ValidationSeverity;
  tick?: number;
  relatedActionId?: string;
  message: string;
}

export interface DamageModifierContribution {
  sourceId: string;
  label: string;
  value: number;
}

export interface DamageBreakdown {
  abilityId: EntityId;
  hitId: string;
  tick: number;
  baseDamage: {
    min: number;
    avg: number;
    max: number;
  };
  additiveModifiers: DamageModifierContribution[];
  multiplicativeModifiers: DamageModifierContribution[];
  expectedValueModifiers: DamageModifierContribution[];
  finalDamage: {
    min: number;
    avg: number;
    max: number;
  };
  derivedParts?: {
    inheritedTriggerDamage?: DamageSummary;
  };
  percentageOfTotal?: number;
}

export interface TickState {
  tickIndex: number;
  activeEquipmentState: Partial<Record<EquipmentSlot, string>>;
  activeAmmoState?: string;
  adrenaline: number;
  deathsporeStacks?: number;
  perfectEquilibriumStacks?: number;
  activePersistentBuffIds: EntityId[];
  activeTimelineBuffIds: EntityId[];
  activeBuffIds: EntityId[];
  cooldowns: Record<EntityId, number>;
  channelState?: {
    sourceActionId: string;
    abilityId: EntityId;
    remainingTicks: number;
  };
  actionsStartingThisTick: string[];
  hitsResolvingThisTick: HitDefinition[];
  validationIssues: ValidationIssue[];
}

export interface DamageSummary {
  min: number;
  avg: number;
  max: number;
}

export interface AbilityDamageSummary extends DamageSummary {
  abilityId: EntityId;
}

export interface SimulationExplainabilityArtifacts {
  damageBreakdowns: DamageBreakdown[];
  notes?: string[];
}

export interface SimulationResult {
  isValid: boolean;
  validationIssues: ValidationIssue[];
  totalDamage: DamageSummary;
  damageByAbility: AbilityDamageSummary[];
  damageByTick: Record<number, DamageSummary>;
  adrenalineTimeline: number[];
  buffTimeline: Record<number, EntityId[]>;
  timelineGeneratedBuffSources: TimelineGeneratedBuffSource[];
  cooldownTimeline: Record<number, Record<EntityId, number>>;
  tickStates: TickState[];
  explainability: SimulationExplainabilityArtifacts;
}
