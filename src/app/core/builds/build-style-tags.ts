import type { GameDataCatalog } from '../../../game-data/loaders';
import type { CombatStyle } from '../../../game-data/types';
import type { RotationPlan } from '../../../simulation-engine/models';
import type { BuildStyleTag } from './build-sharing.models';

const BUILD_STYLE_ORDER: BuildStyleTag[] = ['ranged', 'melee', 'magic', 'necromancy', 'hybrid'];
const BUILD_COMBAT_STYLES = new Set<BuildStyleTag>(['ranged', 'melee', 'magic', 'necromancy']);
const ALL_BUILD_STYLE_TAGS = new Set<BuildStyleTag>(BUILD_STYLE_ORDER);

export function deriveBuildStyleTagsFromRotation(
  rotationPlan: RotationPlan,
  catalog: Pick<GameDataCatalog, 'abilities'>,
): BuildStyleTag[] {
  const styles = new Set<BuildStyleTag>();

  for (const action of rotationPlan.abilityActions) {
    if (action.actionType !== 'ability-use') {
      continue;
    }

    const abilityId = action.payload['abilityId'];
    if (typeof abilityId !== 'string') {
      continue;
    }

    const style = abilityId ? catalog.abilities[abilityId]?.style : null;

    if (isBuildStyleTag(style)) {
      styles.add(style);
    }
  }

  if (styles.size > 1) {
    styles.add('hybrid');
  }

  return sortBuildStyleTags([...styles]);
}

export function normalizeBuildStyleTags(tags: readonly string[]): BuildStyleTag[] {
  return sortBuildStyleTags(tags.filter(isBuildStyleTag));
}

export function sortBuildStyleTags(tags: readonly BuildStyleTag[]): BuildStyleTag[] {
  const unique = new Set(tags);
  return BUILD_STYLE_ORDER.filter((style) => unique.has(style));
}

function isBuildStyleTag(value: CombatStyle | string | null | undefined): value is BuildStyleTag {
  return typeof value === 'string' && ALL_BUILD_STYLE_TAGS.has(value as BuildStyleTag);
}
