import type { SpellDefinition } from '../../game-data/types';
import type { RotationAction, SimulationConfig } from '../models';
import { normalizeCombatChoices } from './magic-combat-choices';

export function resolveActiveMagicSpellDefinition(
  config: Pick<SimulationConfig, 'combatChoices' | 'gameData' | 'playerStats'>,
): SpellDefinition | null {
  const combatChoices = normalizeCombatChoices(config.playerStats, config.combatChoices);
  return config.gameData.spells?.[combatChoices.magic.activeSpellId] ?? null;
}

export function resolveMagicSpellDefinitionForAction(
  config: Pick<SimulationConfig, 'combatChoices' | 'gameData' | 'playerStats'>,
  action: RotationAction | null,
): SpellDefinition | null {
  if (action?.actionType === 'ability-use' && action.payload['abilityId'] === 'cast-spell') {
    const spellId = action.payload['spellId'];
    if (typeof spellId === 'string' && spellId.length > 0) {
      const spell = config.gameData.spells?.[spellId] ?? null;
      if (spell) {
        return spell;
      }
    }
  }

  return resolveActiveMagicSpellDefinition(config);
}
