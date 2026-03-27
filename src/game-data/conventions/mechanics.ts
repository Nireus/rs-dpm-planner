export const CONFIG_OPTION_IDS = {
  loadedAmmo: 'loaded-ammo',
  storedSpecial: 'stored-special',
} as const;

export const REQUIREMENT_TAGS = {
  equippedWeaponSpecialAccess: 'equipped-effect:weapon-special-access',
  equippedEofSpecialAccess: 'equipped-effect:eof-special-access',
  eofStoredSpecialConfigured: 'eof-stored-special-configured',
} as const;

export const EFFECT_REF_IDS = {
  bolgPassive: 'bolg-passive',
  conservationOfEnergy: 'conservation-of-energy',
  dracolichSet: 'dracolich-set',
  damageOverTime: 'damage-over-time',
  deathsporeProgress: 'deathspore-progress',
  eliteDracolichSet: 'elite-dracolich-set',
  eofSpecialAccess: 'eof-special-access',
  fulArrowsHeat: 'ful-arrows-heat',
  furyOfTheSmall: 'fury-of-the-small',
  guaranteedCriticalStrikeChance: 'critical-strike-chance:+100%',
  gloomfireDarkfang: 'gloomfire-darkfang',
  heightenedSenses: 'heightened-senses',
  igneousKalXilPassive: 'igneous-kal-xil-passive',
  igneousKalZukPassive: 'igneous-kal-zuk-passive',
  quiverPassive: 'quiver-passive',
  shadowImbuedHitAdrenaline: 'ranged-hit-adrenaline:+5%',
  vigourPassive: 'vigour-passive',
  weaponSpecialAccess: 'weapon-special-access',
  weaponSpecialBalanceByForce: 'weapon-special:balance-by-force',
  weaponSpecialShadowfall: 'weapon-special:shadowfall',
} as const;

const EXACT_EFFECT_REFS = new Set<string>([
  ...Object.values(EFFECT_REF_IDS),
  'amulet-of-souls-passive',
  'anguish',
  'berserkers-fury',
  'binding-shot-bind',
  'blessing-of-het',
  'corruption-shot',
  'dazing-shot',
  'deathspore-cooldown',
  'deathspore-free-cast',
  'deaths-swiftness',
  'death-ward',
  'desolation',
  'divine-rage',
  'demoralise',
  EFFECT_REF_IDS.dracolichSet,
  'eclipsed-soul-heal',
  EFFECT_REF_IDS.eliteDracolichSet,
  'elite-sirenic-set',
  'equilibrium',
  'font-of-life',
  'fragmentation-shot-bleed',
  EFFECT_REF_IDS.fulArrowsHeat,
  'greater-dazing-shot',
  'greater-deaths-swiftness',
  'greater-ricochet',
  'hexhunter-passive',
  'incendiary-shot',
  'jas-dragonbane-arrows',
  'masterwork-ranged-set',
  'needle-strike-buff',
  'perfect-equilibrium-status',
  'piercing-shot',
  'rapid-fire-channel',
  'reaper-necklace-passive',
  'rigour',
  'ring-of-death-adrenaline',
  'rout',
  'salt-the-wound',
  'scripture-of-ful',
  'scripture-of-jas',
  'searing-winds',
  'shadow-imbued',
  'shadow-tendrils',
  'shadows-grace',
  'sirenic-set',
  'tight-bindings',
  'vulnerability-bomb',
  'wen-arrows-icy-chill',
]);

const PARAMETERIZED_EFFECT_REF_PREFIXES = [
  'basic-adrenaline:',
  'critical-strike-chance:',
  'critical-strike-damage:',
  'target-damage-taken:',
  'eof-',
  'hit-chance:',
  'overload-tier-',
  'perfect-equilibrium-threshold:',
  'piercing-shot-snipe-reduction:',
  'ranged-critical-strike-chance:',
  'ranged-damage-multiplier:',
  'ranged-hit-adrenaline:',
  'ranged-hit-flat-bonus-ability-damage:',
  'weapon-special:',
] as const;

export function isRecognizedEffectRef(effectRef: string): boolean {
  return (
    EXACT_EFFECT_REFS.has(effectRef) ||
    PARAMETERIZED_EFFECT_REF_PREFIXES.some((prefix) => effectRef.startsWith(prefix))
  );
}

export function isRecognizedRequirementTag(tag: string): boolean {
  return (
    tag === REQUIREMENT_TAGS.equippedWeaponSpecialAccess ||
    tag === REQUIREMENT_TAGS.equippedEofSpecialAccess ||
    tag === REQUIREMENT_TAGS.eofStoredSpecialConfigured ||
    tag.startsWith('equipped-effect:')
  );
}
