export interface CuratedAbilityUiMetadata {
  iconPath: string;
  hoverSummary: string;
  detailLines: string[];
  wikiUrl: string;
}

export const CURATED_ABILITY_UI: Record<string, CuratedAbilityUiMetadata> = {
  attack: {
    iconPath: 'https://runescape.wiki/w/Special:FilePath/Attack_(ability).png',
    hoverSummary: 'Basic | 3 ticks | 1 hit | +9% adrenaline',
    detailLines: [
      '110%-130% melee damage.',
      'Default melee basic attack.',
      'Generates 1 Bloodlust stack on the live page.',
    ],
    wikiUrl: 'https://runescape.wiki/w/Attack_(ability)',
  },
  'adaptive-strike': {
    iconPath: 'https://runescape.wiki/w/Special:FilePath/Adaptive_Strike.png',
    hoverSummary: 'Basic | 9 ticks | 1 hit | +12% adrenaline',
    detailLines: [
      'Main-hand-only and two-handed setups deal a single 120%-140% hit.',
      'Dual-wield setups deal two hits of 60%-75% each.',
      'Requires a melee weapon.',
      'Two-handed live behavior also gains cone AoE, which remains descriptive-only in the single-target simulator.',
    ],
    wikiUrl: 'https://runescape.wiki/w/Adaptive_Strike',
  },
  assault: {
    iconPath: 'https://runescape.wiki/w/Special:FilePath/Assault.png',
    hoverSummary: 'Enhanced | 10 ticks | 4 hits | -25% adrenaline',
    detailLines: [
      '130%-150% melee damage per hit every 1.2s.',
      '4-hit channeled attack with live hit timings.',
      'Bloodlust empowerment remains descriptive only for now.',
    ],
    wikiUrl: 'https://runescape.wiki/w/Assault',
  },
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
  backhand: {
    iconPath: 'https://runescape.wiki/w/Special:FilePath/Backhand.png',
    hoverSummary: 'Basic | 25 ticks | 1 hit | +9% adrenaline',
    detailLines: [
      '95%-105% melee damage.',
      'Stuns and binds the target for 1.8s.',
      'Single-hit melee control basic.',
    ],
    wikiUrl: 'https://runescape.wiki/w/Backhand',
  },
  barge: {
    iconPath: 'https://runescape.wiki/w/Special:FilePath/Barge.png',
    hoverSummary: 'Basic | 34 ticks | 1 hit | +9% adrenaline',
    detailLines: [
      '75%-95% melee damage.',
      'Moves up to 10 tiles to the target and clears binds.',
      'Applies a bind on hit.',
    ],
    wikiUrl: 'https://runescape.wiki/w/Barge',
  },
  berserk: {
    iconPath: 'https://runescape.wiki/w/Special:FilePath/Berserk.png',
    hoverSummary: 'Ultimate | 100 ticks | Self-target | -100% adrenaline',
    detailLines: [
      'Empowers melee attacks for 19.8s.',
      'Melee damage dealt is multiplied by 1.75x.',
      'Damage taken is increased by 25%.',
    ],
    wikiUrl: 'https://runescape.wiki/w/Berserk',
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
  'bladed-dive': {
    iconPath: 'https://runescape.wiki/w/Special:FilePath/Bladed_Dive.png',
    hoverSummary: 'Basic | 34 ticks | 1 hit | +9% adrenaline',
    detailLines: [
      '75%-95% melee damage in the current curated baseline.',
      'Requires dual-wield melee weapons.',
      'Live during-GCD movement utility still needs dedicated action-model support.',
    ],
    wikiUrl: 'https://runescape.wiki/w/Bladed_Dive',
  },
  'chaos-roar': {
    iconPath: 'https://runescape.wiki/w/Special:FilePath/Chaos_Roar.png',
    hoverSummary: 'Basic | 100 ticks | 1 hit | +9% adrenaline',
    detailLines: [
      '100%-120% melee damage.',
      'Empowers the next melee ability within 7.2s.',
      'Current data keeps the empowerment descriptive outside supported mechanics.',
    ],
    wikiUrl: 'https://runescape.wiki/w/Chaos_Roar',
  },
  dive: {
    iconPath: 'https://runescape.wiki/w/Special:FilePath/Dive.png',
    hoverSummary: 'Utility | 34 ticks | Self-target | 0% adrenaline',
    detailLines: [
      'Moves up to 10 tiles toward the targeted tile.',
      'Can be cast during the global cooldown.',
      'Requires level 5 Agility on the live game page.',
    ],
    wikiUrl: 'https://runescape.wiki/w/Dive',
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
  dismember: {
    iconPath: 'https://runescape.wiki/w/Special:FilePath/Dismember.png',
    hoverSummary: 'Enhanced | 40 ticks | 8 hits | 0% adrenaline',
    detailLines: [
      '25%-31% melee damage per hit every 1.2s.',
      '8-hit bleed with healing based on damage dealt.',
      'Live recast chaining into Slaughter and Massacre is not modeled yet.',
    ],
    wikiUrl: 'https://runescape.wiki/w/Dismember',
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
  flurry: {
    iconPath: 'https://runescape.wiki/w/Special:FilePath/Flurry.png',
    hoverSummary: 'Enhanced | 34 ticks | 8 hits | -25% adrenaline',
    detailLines: [
      '60%-70% melee damage per hit every 0.6s.',
      'Dual-wield 8-hit channeled attack.',
      'Live stun, bind, and Bloodlust missing-health scaling are not simulated yet.',
    ],
    wikiUrl: 'https://runescape.wiki/w/Flurry',
  },
  fury: {
    iconPath: 'https://runescape.wiki/w/Special:FilePath/Fury.png',
    hoverSummary: 'Basic | 25 ticks | 1 hit | +9% adrenaline',
    detailLines: [
      '110%-130% melee damage.',
      'Your next melee attack gains +25% critical strike chance.',
      'Core dual-wield-capable melee basic.',
    ],
    wikiUrl: 'https://runescape.wiki/w/Fury',
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
  'greater-flurry': {
    iconPath: 'https://runescape.wiki/w/Special:FilePath/Greater_Flurry.png',
    hoverSummary: 'Enhanced | 34 ticks | 8 hits | -25% adrenaline',
    detailLines: [
      '60%-70% melee damage per hit every 0.6s.',
      'Dual-wield 8-hit channeled attack.',
      'Each live hit extends Berserk by 0.6s, but that buff interaction is not simulated yet.',
    ],
    wikiUrl: 'https://runescape.wiki/w/Greater_Flurry',
  },
  'greater-barge': {
    iconPath: 'https://runescape.wiki/w/Special:FilePath/Greater_Barge.png',
    hoverSummary: 'Basic | 34 ticks | 1 hit | +9% adrenaline',
    detailLines: [
      '75%-95% melee damage.',
      'Upgraded Barge with extra live downtime and channeled-attack interactions.',
      'Those secondary interactions remain descriptive-only for now.',
    ],
    wikiUrl: 'https://runescape.wiki/w/Greater_Barge',
  },
  'greater-fury': {
    iconPath: 'https://runescape.wiki/w/Special:FilePath/Greater_Fury.png',
    hoverSummary: 'Basic | 25 ticks | 1 hit | +9% adrenaline',
    detailLines: [
      '120%-140% melee damage.',
      'Your next melee attack within 15s is guaranteed to critically strike.',
      'Upgraded version of Fury.',
    ],
    wikiUrl: 'https://runescape.wiki/w/Greater_Fury',
  },
  hurricane: {
    iconPath: 'https://runescape.wiki/w/Special:FilePath/Hurricane.png',
    hoverSummary: 'Enhanced | 34 ticks | 2 hits | -25% adrenaline',
    detailLines: [
      '135%-165%, then 155%-185% melee damage to the main target.',
      'Requires a two-handed melee weapon.',
      'Live area hits and cooldown reduction per enemy hit are not simulated yet.',
    ],
    wikiUrl: 'https://runescape.wiki/w/Hurricane',
  },
  'meteor-strike': {
    iconPath: 'https://runescape.wiki/w/Special:FilePath/Meteor_Strike.png',
    hoverSummary: 'Ultimate | 100 ticks | 1 hit | -60% adrenaline',
    detailLines: [
      '220%-250% melee damage to the target and nearby enemies.',
      'Applies a 30s melee-only adrenaline buff.',
      'Melee basics gain 1.5x adrenaline and you gain 4.5% adrenaline every 0.6s while a melee weapon is equipped.',
      'Area targeting varies with main-hand melee range.',
    ],
    wikiUrl: 'https://runescape.wiki/w/Meteor_Strike',
  },
  massacre: {
    iconPath: 'https://runescape.wiki/w/Special:FilePath/Massacre.png',
    hoverSummary: 'Enhanced | Recast bleed | 7 hits | -25% adrenaline',
    detailLines: [
      '110%-130% melee damage, then six 100% bleed hits every 2.4s.',
      'Live version is the third Dismember recast.',
      'Current data models it conservatively until recast-family support exists.',
    ],
    wikiUrl: 'https://runescape.wiki/w/Massacre',
  },
  overpower: {
    iconPath: 'https://runescape.wiki/w/Special:FilePath/Overpower.png',
    hoverSummary: 'Ultimate | 50 ticks | 1 hit | -60% adrenaline',
    detailLines: [
      '520%-570% melee damage.',
      'Hits 3 ticks after cast.',
      'Igneous capes upgrade it to a stronger two-hit version.',
    ],
    wikiUrl: 'https://runescape.wiki/w/Overpower',
  },
  punish: {
    iconPath: 'https://runescape.wiki/w/Special:FilePath/Punish.png',
    hoverSummary: 'Basic | 40 ticks | 1 hit | +9% adrenaline',
    detailLines: [
      '110%-130% melee damage.',
      'Deals 2.5x damage against targets below 50% life points.',
      'Current damage model uses the base hit only.',
    ],
    wikiUrl: 'https://runescape.wiki/w/Punish',
  },
  pulverise: {
    iconPath: 'https://runescape.wiki/w/Special:FilePath/Pulverise.png',
    hoverSummary: 'Ultimate | 100 ticks | 1 hit | -60% adrenaline',
    detailLines: [
      '300%-340% melee damage.',
      'Requires a two-handed melee weapon.',
      'Applies Pulverised for 30s and can refund adrenaline on kill.',
    ],
    wikiUrl: 'https://runescape.wiki/w/Pulverise',
  },
  slaughter: {
    iconPath: 'https://runescape.wiki/w/Special:FilePath/Slaughter.png',
    hoverSummary: 'Enhanced | Recast bleed | 6 hits | -25% adrenaline',
    detailLines: [
      '80%-100% melee damage per hit every 1.8s.',
      'Live version is the second Dismember recast.',
      'Current data models it conservatively until recast-family support exists.',
    ],
    wikiUrl: 'https://runescape.wiki/w/Slaughter',
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
  rend: {
    iconPath: 'https://runescape.wiki/w/Special:FilePath/Rend.png',
    hoverSummary: 'Basic | 17 ticks | 1 hit | +9% adrenaline',
    detailLines: [
      '135%-165% melee damage.',
      'Generates 2 Bloodlust stacks on the live page.',
      'Also drives Gloves of Passage synergy in supported melee loops.',
    ],
    wikiUrl: 'https://runescape.wiki/w/Rend',
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
    hoverSummary: 'Enhanced | 75 ticks | 1 hit | 0% adrenaline',
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
