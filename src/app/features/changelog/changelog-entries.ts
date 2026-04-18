export interface ChangelogEntry {
  readonly date: string;
  readonly change: string;
}

export const CHANGELOG_ENTRIES: readonly ChangelogEntry[] = [
  {
    date: '18.04.2026',
    change:
      'Added blocked-language checks for public-facing names. Profile display names and public build names are now checked in the app, and Supabase constraints enforce the same rule for new public writes.',
  },
  {
    date: '18.04.2026',
    change:
      'Added pre-fight planning to Rotation Planner. Prebuild and Ability Stall now live on the same timeline before T0, support abilities and non-GCD setup, preserve import/export, expose gap-to-fight timing in Configuration, and allow tick inspection across pre-fight actions, buffs, gear/ammo, damage math, and cooldowns. The simulator now ages pre-fight buffs and cooldowns, releases stalled abilities with the first main action, handles gear swaps ending channels, and improves strict validation for pre-fight warnings. Also corrected Rapid Fire hit timing, Wen arrow stack behavior, and Seren godbow Crystal Rain target-size damage with proper Perfect Equilibrium stack handling.',
  },
  {
    date: '17.04.2026',
    change:
      'Fixed the Rotation Planner Perfect Equilibrium proc marker so it now uses the correct status icon instead of the Equilibrium perk icon or Bow of the Last Guardian item thumbnail. Also added minor UX polish by moving several remaining style, gear, buff, and perk icons to local assets and improving Import / Export text entry reliability.',
  },
  {
    date: '16.04.2026',
    change:
      'Added Supabase-backed account and build-sharing foundations: email magic-link sign-in, profile display names and optional social links with per-build public opt-in, manual cloud saves, publishable public builds, public gallery search/filter/sort, build import, voting support, dev/prod environment placeholders, SQL migrations, and a step-by-step Supabase setup guide.',
  },
  {
    date: '16.04.2026',
    change:
      "Added a Load BIS Melee preset with Ek-ZekKil, Vestments of Havoc, enhanced Gloves of Passage with Enchantment of agony, Am-hej, Nodon spike harness, Reaver's ring, Leng weapon swaps, melee EOF specials, Malevolence, Rampage, and supporting melee perks/content. Gear BIS buttons now sit above Equipped in their own compact section, and the Buffs page layout now uses collapsed left/right stacks with Prayers, Potions, and Summons on the left and Relics plus Miscellaneous on the right.",
  },
  {
    date: '16.04.2026',
    change:
      "Added a Load BIS Magic preset with configured FSOA/Tumeken's gear, EOF swaps, Grasping rune pouch, Affliction, Kal'gerion demon, and Incite Fear selection. Added the Summons buff section, Ripper Demon for ranged BIS, Channeller's ring Enchantment of metaphysics toggle/indicator, and full magic channelled crit stacking where Runic Embrace and the enchantment combine for +6.5% crit contribution per hit step.",
  },
  {
    date: '16.04.2026',
    change:
      "Added a Load BIS Ranged preset on the Gear screen with configurable gear replacement, planner clearing, and BIS buff loading. The preset includes configured ranged gear, backpack EOF/quiver swaps, Stalker's ring Enchantment of shadows support, Reaper Crew, and new Relentless/Devoted perk data.",
  },
  {
    date: '16.04.2026',
    change:
      "Added Erethdor's grimoire as a pocket item with its active +12% critical strike chance effect, including support for pocket item effects selected through persistent buff configuration.",
  },
  {
    date: '11.04.2026',
    change:
      'Fixed runic charge bugs. Implemented crit interactions with Tsunami and FSOA.',
  },
  {
    date: '04.04.2026',
    change:
      'Gear and planner validation polish: two-handed swaps now correctly move displaced off-hands into backpack, the ability palette is more lenient when valid melee/ranged/magic swaps are available from accessible gear, and Shard of Genesis Essence support now covers Fractured Staff of Armadyl, Roar of Awakening, Ode to Deceit, and shared dual-wield set unlock behavior.',
  },
  {
    date: '04.04.2026',
    change:
      'Magic expansion is now live in the planner with spellbook selection, combat and utility spell support, non-GCD Spell Swap, Cast Spell actions, first-pass magic abilities/gear/buffs/specials, spell-aware damage and inspection, and a dedicated Spellbook page for choosing the starting combat spell.',
  },
  {
    date: '30.03.2026',
    change: "Initial melee abilities and gear added to tool. Ready for testing individual interactions.",
  },
  {
    date: '29.03.2026',
    change:
      "Fixed a validation bug where Warped gem could incorrectly let Death's Swiftness be used below 100% adrenaline. Warped gem now only applies its special-attack discount instead of behaving like a full Ring of Vigour passive.",
  },
  {
    date: '29.03.2026',
    change:
      'Added a second project-links nav section, a reporting guide page, and a changelog page, while tightening the sidebar layout for better 1080p desktop fit. Rotation Planner configuration also now supports starting stack values for BoLG and Deathspore when those mechanics are equipped at fight start.',
  },
  {
    date: '29.03.2026',
    change:
      'Initial first-release scope is live with ranged single-target rotation planning, theoretical min/avg/max damage simulation, import/export, and major planner inspection tools.',
  },
];
