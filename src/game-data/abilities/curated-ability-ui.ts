export interface CuratedAbilityUiMetadata {
  iconPath: string;
  hoverSummary: string;
  detailLines: string[];
  wikiUrl: string;
}

export const CURATED_ABILITY_UI: Record<string, CuratedAbilityUiMetadata> = {
  'essence-of-finality': {
    iconPath: 'https://runescape.wiki/w/Special:FilePath/Essence_of_Finality.png',
    hoverSummary: 'Constitution | Special | 0 ticks | Adrenaline varies',
    detailLines: [
      'Harnesses the special attack stored inside an equipped Essence of Finality amulet.',
      'Requires an equipped Essence of Finality with a stored special attack.',
      'Adrenaline cost and exact behavior vary with the stored weapon special.',
    ],
    wikiUrl: 'https://runescape.wiki/w/Essence_of_Finality',
  },
  ranged: {
    iconPath: 'https://runescape.wiki/w/Special:FilePath/Ranged_(ability).png',
    hoverSummary: 'Basic | 3 ticks | 1 hit | +9% adrenaline',
    detailLines: [
      '90%-110% ranged damage.',
      'Default ranged basic attack.',
      'Automatically triggered when auto attack is enabled.',
    ],
    wikiUrl: 'https://runescape.wiki/w/Ranged_(ability)',
  },
  'binding-shot': {
    iconPath: 'https://runescape.wiki/w/Special:FilePath/Binding_Shot.png',
    hoverSummary: 'Basic | 25 ticks | 1 hit | +9% adrenaline',
    detailLines: [
      '65%-75% ranged damage.',
      'Stuns the target for 1.2s and binds for 9.6s.',
      'Generates 9% adrenaline.',
      'Can gain an extra charge after Scare Tactics.',
    ],
    wikiUrl: 'https://runescape.wiki/w/Binding_Shot',
  },
  bombardment: {
    iconPath: 'https://runescape.wiki/w/Special:FilePath/Bombardment.png',
    hoverSummary: 'Enhanced | 0 ticks | 1 hit | -25% adrenaline',
    detailLines: [
      '220%-260% ranged damage to the target and nearby enemies.',
      'Area-target enhanced ability.',
      'Damage is 60% effective in PvP.',
    ],
    wikiUrl: 'https://runescape.wiki/w/Bombardment',
  },
  'corruption-shot': {
    iconPath: 'https://runescape.wiki/w/Special:FilePath/Corruption_Shot.png',
    hoverSummary: 'Basic | 25 ticks | 5 hits | +8% adrenaline',
    detailLines: [
      '60%-80% ranged damage, then 80%, 60%, 40%, and 20% of that hit every 1.2s.',
      'Hits the target and up to 5 nearby enemies.',
      'Damage over time effect that does not interact like a normal direct-hit ranged ability.',
    ],
    wikiUrl: 'https://runescape.wiki/w/Corruption_Shot',
  },
  deadshot: {
    iconPath: 'https://runescape.wiki/w/Special:FilePath/Deadshot.png',
    hoverSummary: 'Ultimate | 50 ticks | 4 hits | -60% adrenaline',
    detailLines: [
      'Base version: 105%-125% ranged damage per hit for 4 near-instant hits.',
      'Igneous capes change it to 55%-75% per hit for 8 near-instant hits.',
      'Damage is 60% effective in PvP.',
    ],
    wikiUrl: 'https://runescape.wiki/w/Deadshot',
  },
  'deaths-swiftness': {
    iconPath: "https://runescape.wiki/w/Special:FilePath/Death's_Swiftness.png",
    hoverSummary: 'Ultimate | 100 ticks | 1 hit | -100% adrenaline',
    detailLines: [
      'Creates a shroud of death for 30s.',
      'Ranged attacks deal 2.5x damage while inside.',
      'Members-only ultimate.',
    ],
    wikiUrl: "https://runescape.wiki/w/Death's_Swiftness",
  },
  galeshot: {
    iconPath: 'https://runescape.wiki/w/Special:FilePath/Galeshot.png',
    hoverSummary: 'Basic | 34 ticks | 1 hit | +9% adrenaline',
    detailLines: [
      '100%-120% ranged damage.',
      'Applies Searing Winds to self for 6s.',
      'Searing Winds adds 20% bonus damage to ranged hits.',
    ],
    wikiUrl: 'https://runescape.wiki/w/Galeshot',
  },
  'greater-ricochet': {
    iconPath: 'https://runescape.wiki/w/Special:FilePath/Greater_Ricochet.png',
    hoverSummary: 'Basic | 17 ticks | 7 hits | +9% adrenaline',
    detailLines: [
      'Against a single target: 75%-85%, then 15%-20% twice, then 4%-6% four times.',
      'All returning hits land one tick after the initial shot.',
      'Caroming adds +4% ability damage per rank to every hit.',
    ],
    wikiUrl: 'https://runescape.wiki/w/Greater_Ricochet',
  },
  'imbue-shadows': {
    iconPath: 'https://runescape.wiki/w/Special:FilePath/Imbue-_Shadows.png',
    hoverSummary: 'Enhanced | 100 ticks | Self-target | -40% adrenaline',
    detailLines: [
      'Applies Shadow Imbued for 30s.',
      'Ranged attacks against your target generate 5% adrenaline with each hit.',
      'Shadow Tendrils extends Shadow Imbued by 3.6s.',
      'No direct hit damage.',
    ],
    wikiUrl: 'https://runescape.wiki/w/Imbue:_Shadows',
  },
  'piercing-shot': {
    iconPath: 'https://runescape.wiki/w/Special:FilePath/Piercing_Shot.png',
    hoverSummary: 'Basic | 5 ticks | 2 hits | +9% adrenaline',
    detailLines: [
      '45%-55% ranged damage per hit.',
      '2 hits.',
      'Each hit reduces Snipe cooldown by 2.4s.',
      'Fleeting boots increase that reduction by 1.2s per hit.',
    ],
    wikiUrl: 'https://runescape.wiki/w/Piercing_Shot',
  },
  'rapid-fire': {
    iconPath: 'https://runescape.wiki/w/Special:FilePath/Rapid_Fire.png',
    hoverSummary: 'Enhanced | 34 ticks | 8 hits | -25% adrenaline',
    detailLines: [
      '75%-85% ranged damage per hit every 0.6s.',
      '8-hit channeled attack.',
      'Binds for 6s and extends Searing Winds by 0.6s per hit.',
    ],
    wikiUrl: 'https://runescape.wiki/w/Rapid_Fire',
  },
  ricochet: {
    iconPath: 'https://runescape.wiki/w/Special:FilePath/Ricochet.png',
    hoverSummary: 'Basic | 17 ticks | 3 hits | +9% adrenaline',
    detailLines: [
      'Against a single target: 75%-85%, then 15%-20% twice.',
      'Returning hits land one tick after the initial shot.',
      'Caroming adds +4% ability damage per rank to every hit.',
    ],
    wikiUrl: 'https://runescape.wiki/w/Ricochet',
  },
  'shadow-tendrils': {
    iconPath: 'https://runescape.wiki/w/Special:FilePath/Shadow_Tendrils.png',
    hoverSummary: 'Enhanced | 75 ticks | 1 hit | -15% adrenaline',
    detailLines: [
      '200%-270% ranged damage.',
      'Deals 100%-135% self-damage.',
      'Guaranteed critical strike and extends Shadow Imbued by 3.6s.',
    ],
    wikiUrl: 'https://runescape.wiki/w/Shadow_Tendrils',
  },
  'snap-shot': {
    iconPath: 'https://runescape.wiki/w/Special:FilePath/Snap_Shot.png',
    hoverSummary: 'Enhanced | 0 ticks | 2 hits | -25% adrenaline',
    detailLines: [
      '135%-155% ranged damage per hit.',
      '2-hit single-target enhanced ability.',
      'Damage is 60% effective in PvP.',
    ],
    wikiUrl: 'https://runescape.wiki/w/Snap_Shot',
  },
  snipe: {
    iconPath: 'https://runescape.wiki/w/Special:FilePath/Snipe.png',
    hoverSummary: 'Enhanced | 100 ticks | 1 hit | 0% adrenaline',
    detailLines: [
      '300%-360% ranged damage after 1.8s.',
      'Channeled precision shot.',
      'Damage is 75% effective in PvP.',
    ],
    wikiUrl: 'https://runescape.wiki/w/Snipe',
  },
  'weapon-special-attack': {
    iconPath: 'https://runescape.wiki/w/Special:FilePath/Weapon_Special_Attack.png',
    hoverSummary: 'Constitution | Special | 0 ticks | Adrenaline varies',
    detailLines: [
      'Generic special attack ability for equipped weapons that support one.',
      'Requires an equipped weapon with a special attack.',
      'The exact effect and adrenaline cost depend on the current weapon.',
    ],
    wikiUrl: 'https://runescape.wiki/w/Weapon_Special_Attack',
  },
};
