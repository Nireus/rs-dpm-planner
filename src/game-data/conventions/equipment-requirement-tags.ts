import {
  COMBAT_STYLE_ORDER,
  combatStyleLabel,
  isRecognizedCombatStyle,
} from './combat-styles';
import type { CombatStyle, ItemDefinition } from '../types';

const STYLE_TOPOLOGY_SUFFIXES = ['weapon', 'dual-wield', 'off-hand', 'two-handed'] as const;

type StyleTopologySuffix = (typeof STYLE_TOPOLOGY_SUFFIXES)[number];

export function collectEquippedStyleTopologyTags(
  equippedItems: ItemDefinition[],
  isTwoHandedItem: (item: ItemDefinition | null | undefined) => boolean,
): Set<string> {
  const tags = new Set<string>();
  const mainHand = equippedItems.find((item) => item.slot === 'weapon');
  const offHand = equippedItems.find((item) => item.slot === 'offHand');

  if (mainHand) {
    for (const style of mainHand.combatStyleTags) {
      tags.add(buildStyleTopologyTag(style, 'weapon'));

      if (isTwoHandedItem(mainHand)) {
        tags.add(buildStyleTopologyTag(style, 'two-handed'));
      }
    }
  }

  if (offHand) {
    for (const style of offHand.combatStyleTags) {
      tags.add(buildStyleTopologyTag(style, 'off-hand'));
    }
  }

  if (mainHand && offHand && !isTwoHandedItem(mainHand)) {
    for (const style of mainHand.combatStyleTags) {
      if (offHand.combatStyleTags.includes(style)) {
        tags.add(buildStyleTopologyTag(style, 'dual-wield'));
      }
    }
  }

  return tags;
}

export function isRecognizedStyleTopologyRequirementTag(tag: string): boolean {
  return COMBAT_STYLE_ORDER.some((style) =>
    STYLE_TOPOLOGY_SUFFIXES.some((suffix) => tag === buildStyleTopologyTag(style, suffix)),
  );
}

export function formatStyleTopologyRequirementTag(tag: string): string | null {
  const parsedTag = parseStyleTopologyRequirementTag(tag);
  if (!parsedTag) {
    return null;
  }

  const styleLabel = combatStyleLabel(parsedTag.style).toLowerCase();

  switch (parsedTag.suffix) {
    case 'weapon':
      return `Requires an equipped ${styleLabel} weapon.`;
    case 'dual-wield':
      return `Requires dual-wield ${styleLabel} weapons.`;
    case 'off-hand':
      return `Requires an equipped ${styleLabel} off-hand weapon.`;
    case 'two-handed':
      return `Requires a two-handed ${styleLabel} weapon.`;
    default:
      return null;
  }
}

function buildStyleTopologyTag(style: CombatStyle, suffix: StyleTopologySuffix): string {
  return `${style}-${suffix}`;
}

function parseStyleTopologyRequirementTag(
  tag: string,
): { style: CombatStyle; suffix: StyleTopologySuffix } | null {
  for (const suffix of STYLE_TOPOLOGY_SUFFIXES) {
    const style = tag.slice(0, -(`-${suffix}`.length));

    if (tag === `${style}-${suffix}` && isRecognizedCombatStyle(style)) {
      return {
        style,
        suffix,
      };
    }
  }

  return null;
}
