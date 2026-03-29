export const ADRENALINE_POTION_ACTION_TYPE = 'adrenaline-potion' as const;

export const ADRENALINE_POTION_COOLDOWN_TICKS = 200;
export const ADRENALINE_RENEWAL_DURATION_TICKS = 10;
export const ADRENALINE_RENEWAL_TICK_GAIN = 4;

export const ADRENALINE_POTION_COOLDOWN_BUFF_ID = 'adrenaline-potion-cooldown' as const;
export const ADRENALINE_RENEWAL_BUFF_ID = 'adrenaline-renewal' as const;

export type AdrenalinePotionVariantId =
  | 'adrenaline-potion'
  | 'super-adrenaline-potion'
  | 'adrenaline-renewal-potion';

export interface AdrenalinePotionVariantDefinition {
  id: AdrenalinePotionVariantId;
  label: string;
  shortLabel: string;
  iconPath: string;
  wikiUrl: string;
  immediateGain: number;
  grantsRenewal: boolean;
}

export const ADRENALINE_POTION_VARIANTS: readonly AdrenalinePotionVariantDefinition[] = [
  {
    id: 'adrenaline-potion',
    label: 'Adrenaline Potion',
    shortLabel: 'Adren',
    iconPath: 'https://runescape.wiki/w/Special:FilePath/Adrenaline_potion_(4).png',
    wikiUrl: 'https://runescape.wiki/w/Adrenaline_potion#(4)',
    immediateGain: 25,
    grantsRenewal: false,
  },
  {
    id: 'super-adrenaline-potion',
    label: 'Super Adrenaline Potion',
    shortLabel: 'Super',
    iconPath: 'https://runescape.wiki/w/Special:FilePath/Super_adrenaline_potion_(4).png',
    wikiUrl: 'https://runescape.wiki/w/Super_adrenaline_potion#(4)',
    immediateGain: 30,
    grantsRenewal: false,
  },
  {
    id: 'adrenaline-renewal-potion',
    label: 'Adrenaline Renewal Potion',
    shortLabel: 'Renew',
    iconPath: 'https://runescape.wiki/w/Special:FilePath/Adrenaline_renewal_potion_(4).png',
    wikiUrl: 'https://runescape.wiki/w/Adrenaline_renewal_potion#(4)',
    immediateGain: 0,
    grantsRenewal: true,
  },
] as const;

export function getAdrenalinePotionVariant(
  variantId: string | null | undefined,
): AdrenalinePotionVariantDefinition | null {
  if (!variantId) {
    return null;
  }

  return ADRENALINE_POTION_VARIANTS.find((variant) => variant.id === variantId) ?? null;
}
