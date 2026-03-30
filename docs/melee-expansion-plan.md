# Melee Expansion Plan

## Shared Sources of Truth
- [Ability damage](https://runescape.wiki/w/Ability_damage)
- [Melee abilities](https://runescape.wiki/w/Melee_abilities)

## Source Verification Rule
- Before implementing any step that references a wiki link in this plan, open that link with Playwright MCP and use the live rendered page as the source of truth.
- Do not rely on memory, cached snippets, or earlier assumptions when a linked page exists in this plan.
- If a linked page cannot be accessed with Playwright MCP, stop and say so explicitly instead of guessing.
- When a step references multiple links, inspect each relevant page directly before implementing mechanics, data, or copy derived from it.

## Summary
- Target file: `docs/melee-expansion-plan.md`.
- Goal: make the app style-extensible first, then add the first melee-ready gear, abilities, and simulation slices without breaking the current ranged product.
- Locked product decisions:
  - Gear catalog tabs: `Melee`, `Ranged`, `Magic`, `Necromancy`, `Jewellery + Utility`.
  - Planner and Abilities tabs: `Ranged`, `Melee`, `Magic`, `Necromancy`, `Constitution`.
  - Style colors: ranged stays green, melee becomes orange, magic blue, necromancy purple, constitution neutral.
  - Planner type order: `Basic`, `Enhanced`, `Ultimate`, then `Special` and `Utility`.

## Public Interface Changes
- Expand `CombatStyle` to include `melee`, `magic`, and `necromancy`, while keeping `constitution`.
- Keep the existing `weapon` slot id as the main-hand slot, and add a new `offHand` slot instead of renaming `weapon`.
- Expand `PlayerStats` from `rangedLevel` + `prayerLevel` into explicit style/stat fields needed for melee and future styles: `attackLevel`, `strengthLevel`, `defenceLevel`, `rangedLevel`, `magicLevel`, `necromancyLevel`, and `prayerLevel`.
- Generalize requirement/equipment tags so availability and validation can express melee weapon topology instead of only ranged-specific tags.
- Bump the portable config/workspace schema to include `offHand` and the new player stat fields, with backward-compatible migration defaults.

## Implementation Steps
1. Create `docs/melee-expansion-plan.md` and pin the shared melee source-of-truth pages at the top so later implementation always starts from the live references. Sources: [Ability damage](https://runescape.wiki/w/Ability_damage), [Melee abilities](https://runescape.wiki/w/Melee_abilities).

2. Generalize the shared combat model so another style can exist cleanly without ranged-only assumptions in types, loaders, selectors, or UI view models. This step covers the central style registry, display labels, and style theme tokens that will later drive tile colors. Sources: [Ability damage](https://runescape.wiki/w/Ability_damage), [Melee abilities](https://runescape.wiki/w/Melee_abilities).

3. Generalize gear topology for main-hand/off-hand/2h play. Add `offHand`, teach the gear builder, projected gear state, timeline swaps, and strict validation about one-hand vs off-hand vs blocked two-handed states, and keep the existing â€śswap takes effect next tickâ€ť rule. Default behavior: equipping a 2h weapon auto-moves the current off-hand item to backpack, while equipping an off-hand item is blocked until a 2h main-hand is removed. Sources: [Ability damage](https://runescape.wiki/w/Ability_damage), [Dark Sliver of Leng](https://runescape.wiki/w/Dark_Sliver_of_Leng), [Malevolent kiteshield](https://runescape.wiki/w/Malevolent_kiteshield), [Off-hand dragon claw](https://runescape.wiki/w/Off-hand_dragon_claw).

4. Expand player stat handling so melee can be validated and calculated correctly. The first melee-ready stat set must support ability requirements from Attack, damage from Strength, gear requirements from Defence, and current Prayer support, while preserving current ranged defaults and import/export behavior. Sources: [Ability damage](https://runescape.wiki/w/Ability_damage), [Melee abilities](https://runescape.wiki/w/Melee_abilities).

5. Rework the Gear page into tabbed catalog browsing using `Melee`, `Ranged`, `Magic`, `Necromancy`, and `Jewellery + Utility`. Style-neutral items like rings, amulets, capes, pocket items, EOF, and enchantments live in `Jewellery + Utility`; equipped layout gains an `Off-hand` slot and visually blocks it when a 2h setup is active. Sources: [Champion's ring](https://runescape.wiki/w/Champion%27s_ring), [Enchantment of heroism](https://runescape.wiki/w/Enchantment_of_heroism), [Igneous Kal-Ket](https://runescape.wiki/w/Igneous_Kal-Ket), [Malevolent kiteshield](https://runescape.wiki/w/Malevolent_kiteshield).

6. Rework the Abilities page and planner palette into style tabs. The Abilities page should reuse the existing grouping logic but make it explicit and style-colored; the planner palette should switch from a single icon grid to tabs sorted by type as `Basic`, `Enhanced`, `Ultimate`, then `Special` and `Utility`. Sources: [Melee abilities](https://runescape.wiki/w/Melee_abilities), [Attack](https://runescape.wiki/w/Attack_(ability)), [Assault](https://runescape.wiki/w/Assault), [Berserk](https://runescape.wiki/w/Berserk), [Dive](https://runescape.wiki/w/Dive).

7. Add a shared style theme registry and apply it consistently to ability cards, planner palette chips, placed ability tiles, validation styling, and any future per-style tabs. Use the locked palette: ranged green, melee orange, magic blue, necromancy purple, constitution neutral. Sources: [Melee abilities](https://runescape.wiki/w/Melee_abilities), [Fury](https://runescape.wiki/w/Fury), [Berserk](https://runescape.wiki/w/Berserk).

8. Generalize ability availability, requirement tags, and projected equipment state so melee abilities can express weapon topology rules without hardcoded ranged assumptions. Add support for tags equivalent to melee weapon, melee dual-wield, melee off-hand, and melee two-handed requirements. Sources: [Melee abilities](https://runescape.wiki/w/Melee_abilities), [Abyssal scourge](https://runescape.wiki/w/Abyssal_scourge), [Dark Shard of Leng](https://runescape.wiki/w/Dark_Shard_of_Leng), [Dark Sliver of Leng](https://runescape.wiki/w/Dark_Sliver_of_Leng).

9. Add a melee base damage calculator and route damage entrypoints by combat style instead of extending the ranged calculator forever. The melee implementation must follow the live formulas from the wiki, including separate main-hand, off-hand, and 2h ability-damage paths and Strength-based scaling. Sources: [Ability damage](https://runescape.wiki/w/Ability_damage).

10. Add the first melee gear data batch as static curated definitions with correct slot, category, combat style tags, requirements, icon, wiki URL, offensive stats, and effect refs taken from the linked pages. This batch should cover the broad 2h/core equipment slice first: [Ek-ZekKil](https://runescape.wiki/w/Ek-ZekKil), [Zaros godsword](https://runescape.wiki/w/Zaros_godsword), [Terrasaur maul](https://runescape.wiki/w/Terrasaur_maul), [Noxious scythe](https://runescape.wiki/w/Noxious_scythe), [Laniakea's spear](https://runescape.wiki/w/Laniakea%27s_spear), [Masterwork Spear of Annihilation](https://runescape.wiki/w/Masterwork_Spear_of_Annihilation), [Masterwork melee equipment](https://runescape.wiki/w/Masterwork_melee_equipment), [Vestments of havoc armour](https://runescape.wiki/w/Vestments_of_havoc_armour), [Am-hej](https://runescape.wiki/w/Am-hej), [Jaws of the Abyss](https://runescape.wiki/w/Jaws_of_the_Abyss), [Laceration boots](https://runescape.wiki/w/Laceration_boots), [Gloves of passage](https://runescape.wiki/w/Gloves_of_passage), [Enhanced gloves of passage](https://runescape.wiki/w/Enhanced_gloves_of_passage), [Igneous Kal-Ket](https://runescape.wiki/w/Igneous_Kal-Ket), [Champion's ring](https://runescape.wiki/w/Champion%27s_ring), [Enchantment of heroism](https://runescape.wiki/w/Enchantment_of_heroism).

11. Add the second melee gear data batch for dual-wield, off-hand, and shield topology: [Abyssal scourge](https://runescape.wiki/w/Abyssal_scourge), [Dark Shard of Leng](https://runescape.wiki/w/Dark_Shard_of_Leng), [Dark Sliver of Leng](https://runescape.wiki/w/Dark_Sliver_of_Leng), [Khopesh of Elidinis](https://runescape.wiki/w/Khopesh_of_Elidinis), [Tumeken's Light](https://runescape.wiki/w/Tumeken%27s_Light), [Khopesh of Tumeken](https://runescape.wiki/w/Khopesh_of_Tumeken), [Malevolent kiteshield](https://runescape.wiki/w/Malevolent_kiteshield).

12. Add the third melee gear data batch for EOF/special-source and later effect-heavy melee items: [Dragon claw](https://runescape.wiki/w/Dragon_claw), [Off-hand dragon claw](https://runescape.wiki/w/Off-hand_dragon_claw), [Annihilation](https://runescape.wiki/w/Annihilation), [Varanus's Mercy](https://runescape.wiki/w/Varanus%27s_Mercy).

13. Add melee ability definitions from the verified live basic list: [Attack](https://runescape.wiki/w/Attack_(ability)), [Adaptive Strike](https://runescape.wiki/w/Adaptive_Strike), [Rend](https://runescape.wiki/w/Rend), [Fury](https://runescape.wiki/w/Fury), [Greater Fury](https://runescape.wiki/w/Greater_Fury), [Backhand](https://runescape.wiki/w/Backhand), [Punish](https://runescape.wiki/w/Punish), [Barge](https://runescape.wiki/w/Barge), [Bladed Dive](https://runescape.wiki/w/Bladed_Dive), [Greater Barge](https://runescape.wiki/w/Greater_Barge), [Chaos Roar](https://runescape.wiki/w/Chaos_Roar).

14. Add melee ability definitions from the verified live enhanced list: [Assault](https://runescape.wiki/w/Assault), [Hurricane](https://runescape.wiki/w/Hurricane), [Flurry](https://runescape.wiki/w/Flurry), [Greater Flurry](https://runescape.wiki/w/Greater_Flurry), [Dismember](https://runescape.wiki/w/Dismember), [Slaughter](https://runescape.wiki/w/Slaughter), [Massacre](https://runescape.wiki/w/Massacre).

15. Add melee ability definitions from the verified live ultimate and utility list: [Overpower](https://runescape.wiki/w/Overpower), [Pulverise](https://runescape.wiki/w/Pulverise), [Berserk](https://runescape.wiki/w/Berserk), [Meteor Strike](https://runescape.wiki/w/Meteor_Strike), [Dive](https://runescape.wiki/w/Dive).

16. Deliver the first playable melee milestone as a small supported subset before chasing every passive in the item list. The first end-to-end loop should include one 2h setup and one dual-wield setup, with exact support for a core ability set such as [Attack](https://runescape.wiki/w/Attack_(ability)), [Rend](https://runescape.wiki/w/Rend), [Fury](https://runescape.wiki/w/Fury), [Assault](https://runescape.wiki/w/Assault), [Hurricane](https://runescape.wiki/w/Hurricane), [Dismember](https://runescape.wiki/w/Dismember), [Overpower](https://runescape.wiki/w/Overpower), and [Berserk](https://runescape.wiki/w/Berserk). Keep [Bladed Dive](https://runescape.wiki/w/Bladed_Dive) and [Dive](https://runescape.wiki/w/Dive) behind a dedicated â€śmelee utility during GCD / non-GCDâ€ť subtask if the current action model cannot represent them cleanly yet.

17. Implement melee gear mechanics in combat-loop order rather than item-list order. First pass should prioritize high-rotation-impact passives and buffs such as [Jaws of the Abyss](https://runescape.wiki/w/Jaws_of_the_Abyss), [Gloves of passage](https://runescape.wiki/w/Gloves_of_passage), [Enhanced gloves of passage](https://runescape.wiki/w/Enhanced_gloves_of_passage), [Abyssal scourge](https://runescape.wiki/w/Abyssal_scourge), [Masterwork Spear of Annihilation](https://runescape.wiki/w/Masterwork_Spear_of_Annihilation), [Vestments of havoc armour](https://runescape.wiki/w/Vestments_of_havoc_armour), [Champion's ring](https://runescape.wiki/w/Champion%27s_ring), [Enchantment of heroism](https://runescape.wiki/w/Enchantment_of_heroism), then add weapon specials and later passives from [Ek-ZekKil](https://runescape.wiki/w/Ek-ZekKil), [Zaros godsword](https://runescape.wiki/w/Zaros_godsword), [Dark Shard of Leng](https://runescape.wiki/w/Dark_Shard_of_Leng), [Dark Sliver of Leng](https://runescape.wiki/w/Dark_Sliver_of_Leng), [Dragon claw](https://runescape.wiki/w/Dragon_claw), [Off-hand dragon claw](https://runescape.wiki/w/Off-hand_dragon_claw), [Annihilation](https://runescape.wiki/w/Annihilation), [Varanus's Mercy](https://runescape.wiki/w/Varanus%27s_Mercy), [Terrasaur maul](https://runescape.wiki/w/Terrasaur_maul), and [Malevolent kiteshield](https://runescape.wiki/w/Malevolent_kiteshield).

## Test Plan
- Add schema and migration tests proving old exports/workspaces load with an empty `offHand` and default new stats, while new exports round-trip with `offHand` and expanded stats. Sources: [Ability damage](https://runescape.wiki/w/Ability_damage), [Melee abilities](https://runescape.wiki/w/Melee_abilities).
- Add gear topology tests for 2h/off-hand behavior, including equip, drag/drop, inventory displacement, and next-tick gear swaps. Sources: [Dark Sliver of Leng](https://runescape.wiki/w/Dark_Sliver_of_Leng), [Malevolent kiteshield](https://runescape.wiki/w/Malevolent_kiteshield), [Off-hand dragon claw](https://runescape.wiki/w/Off-hand_dragon_claw).
- Add UI tests for Gear tabs, planner style tabs, Abilities tabs, and style color classes, including the dedicated `Constitution` tab. Sources: [Melee abilities](https://runescape.wiki/w/Melee_abilities), [Fury](https://runescape.wiki/w/Fury), [Berserk](https://runescape.wiki/w/Berserk).
- Add golden tests for melee main-hand, off-hand, and 2h ability damage against the live formulas. Sources: [Ability damage](https://runescape.wiki/w/Ability_damage).
- Add scenario tests for a first playable 2h melee rotation and a first playable dual-wield melee rotation before implementing later passive-heavy gear. Sources: [Assault](https://runescape.wiki/w/Assault), [Hurricane](https://runescape.wiki/w/Hurricane), [Berserk](https://runescape.wiki/w/Berserk), [Dark Shard of Leng](https://runescape.wiki/w/Dark_Shard_of_Leng), [Dark Sliver of Leng](https://runescape.wiki/w/Dark_Sliver_of_Leng).

## Assumptions
- The new plan file lives at `docs/melee-expansion-plan.md`.
- `weapon` remains the main-hand slot id to minimize migration churn; `offHand` is additive.
- New default player stats are maxed-style-friendly for current theorycrafting: `attack`, `strength`, `defence`, `ranged`, `magic`, and `necromancy` default to `99`, and `prayer` defaults to `99`.
- The first melee milestone remains single-target, desktop-first, strict-validation, and ideal-condition only.
- Gear catalog tabs change, but backpack behavior stays mixed and does not become style-tabbed.
- Internal ability subtype ids stay as they are today, and the display label remains `Enhanced`.
- `Constitution` gets its own tab in the Abilities page and planner so current ranged rotations do not lose access to abilities like Shadow Tendrils.

