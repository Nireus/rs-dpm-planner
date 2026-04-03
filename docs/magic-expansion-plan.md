# Magic Expansion Plan

## Shared Sources of Truth
- [Ability damage](https://runescape.wiki/w/Ability_damage)
- [Magic abilities](https://runescape.wiki/w/Magic_abilities)
- [Standard spells](https://runescape.wiki/w/Standard_spells)
- [Ancient Magicks](https://runescape.wiki/w/Ancient_Magicks)
- [Incite Fear](https://runescape.wiki/w/Incite_Fear)

## Source Verification Rule
- Before implementing any step that references a wiki link in this plan, open that link with Playwright MCP and use the live rendered page as the source of truth.
- Do not rely on memory, cached snippets, or earlier assumptions when a linked page exists in this plan.
- If a linked page cannot be accessed with Playwright MCP, stop and say so explicitly instead of guessing.
- This rule applies to every page listed below, including item, ability, buff, spell, and EOF-special pages.

## Provided Magic Sources

### Gear
- [Obliteration](https://runescape.wiki/w/Obliteration)
- [Kerapac's wrist wraps](https://runescape.wiki/w/Kerapac%27s_wrist_wraps)
- [Blast diffusion boots](https://runescape.wiki/w/Blast_diffusion_boots)
- [Tectonic mask](https://runescape.wiki/w/Tectonic_mask)
- [Tectonic robe top](https://runescape.wiki/w/Tectonic_robe_top)
- [Tectonic robe bottom](https://runescape.wiki/w/Tectonic_robe_bottom)
- [Elite tectonic mask](https://runescape.wiki/w/Elite_tectonic_mask)
- [Elite tectonic robe top](https://runescape.wiki/w/Elite_tectonic_robe_top)
- [Elite tectonic robe bottom](https://runescape.wiki/w/Elite_tectonic_robe_bottom)
- [Roar of Awakening](https://runescape.wiki/w/Roar_of_Awakening)
- [Ode to Deceit](https://runescape.wiki/w/Ode_to_Deceit)
- [Fractured Staff of Armadyl](https://runescape.wiki/w/Fractured_Staff_of_Armadyl)
- [Noxious staff](https://runescape.wiki/w/Noxious_staff)
- [Staff of Sliske](https://runescape.wiki/w/Staff_of_Sliske)
- [Wand of the praesul](https://runescape.wiki/w/Wand_of_the_praesul)
- [Imperium core](https://runescape.wiki/w/Imperium_core)
- [Igneous Kal-Mej](https://runescape.wiki/w/Igneous_Kal-Mej)
- [Seismic wand](https://runescape.wiki/w/Seismic_wand)
- [Boots of Tumeken's resplendence](https://runescape.wiki/w/Boots_of_Tumeken%27s_resplendence)
- [Gloves of Tumeken's resplendence](https://runescape.wiki/w/Gloves_of_Tumeken%27s_resplendence)
- [Robe bottom of Tumeken's resplendence](https://runescape.wiki/w/Robe_bottom_of_Tumeken%27s_resplendence)
- [Robe top of Tumeken's resplendence](https://runescape.wiki/w/Robe_top_of_Tumeken%27s_resplendence)
- [Mask of Tumeken's resplendence](https://runescape.wiki/w/Mask_of_Tumeken%27s_resplendence)
- [Seismic singularity](https://runescape.wiki/w/Seismic_singularity)
- [Masterwork magic hat](https://runescape.wiki/w/Masterwork_magic_hat)
- [Masterwork magic robe top](https://runescape.wiki/w/Masterwork_magic_robe_top)
- [Masterwork magic robe bottom](https://runescape.wiki/w/Masterwork_magic_robe_bottom)
- [Masterwork magic gloves](https://runescape.wiki/w/Masterwork_magic_gloves)
- [Masterwork magic boots](https://runescape.wiki/w/Masterwork_magic_boots)
- [Channeller's ring](https://runescape.wiki/w/Channeller%27s_ring)
- [Enchantment of metaphysics](https://runescape.wiki/w/Enchantment_of_metaphysics)

### Abilities - Basic
- [Magic](https://runescape.wiki/w/Magic_(ability))
- [Greater Sonic Wave](https://runescape.wiki/w/Greater_Sonic_Wave)
- [Sonic Wave](https://runescape.wiki/w/Sonic_Wave)
- [Dragon Breath](https://runescape.wiki/w/Dragon_Breath)
- [Impact](https://runescape.wiki/w/Impact)
- [Combust](https://runescape.wiki/w/Combust)
- [Chain](https://runescape.wiki/w/Chain)
- [Greater Chain](https://runescape.wiki/w/Greater_Chain)
- [Concentrated Blast](https://runescape.wiki/w/Concentrated_Blast)
- [Greater Concentrated Blast](https://runescape.wiki/w/Greater_Concentrated_Blast)

### Abilities - Enhanced
- [Wild Magic](https://runescape.wiki/w/Wild_Magic)
- [Asphyxiate](https://runescape.wiki/w/Asphyxiate)
- [Corruption Blast](https://runescape.wiki/w/Corruption_Blast)
- [Smoke Tendrils](https://runescape.wiki/w/Smoke_Tendrils)
- [Magma Tempest](https://runescape.wiki/w/Magma_Tempest)

### Abilities - Ultimate
- [Omnipower](https://runescape.wiki/w/Omnipower)
- [Sunshine](https://runescape.wiki/w/Sunshine)
- [Greater Sunshine](https://runescape.wiki/w/Greater_Sunshine)
- [Tsunami](https://runescape.wiki/w/Tsunami)

### Abilities - Utility
- [Surge](https://runescape.wiki/w/Surge)
- [Runic Charge](https://runescape.wiki/w/Runic_Charge)

### Buffs
- [Augury](https://runescape.wiki/w/Augury)
- [Affliction](https://runescape.wiki/w/Affliction)
- [Torment](https://runescape.wiki/w/Torment)

### EOF specials
- [Guthix staff](https://runescape.wiki/w/Guthix_staff)
- [Iban's staff](https://runescape.wiki/w/Iban%27s_staff)
- Every live `Special attack` section present on the listed magic weapon pages above, verified via Playwright at implementation time.

## Summary
- Target file: `docs/magic-expansion-plan.md`.
- Goal: add the first full magic-ready slice without repeating the early cross-style groundwork already completed for melee.
- Locked decisions:
  - `utility` becomes a real `AbilitySubtype`.
  - Magic supports full `Standard + Ancient` spell choice.
  - `Surge` and `Runic Charge` get live-style during-GCD/manual timing support now.
  - `Spell swap` is a first-class non-GCD action so rotations can change active spell mid-plan instead of relying only on pre-fight config.
- Unique mechanic families that require explicit engine work:
  - spellbook and active-spell selection
  - spell swap projection
  - `Flow` / `Greater Flow`
  - `Concentrated Blast` / `Greater Concentrated Blast`
  - `Runic Charge`
  - `Sunshine` / `Greater Sunshine`
  - `Tsunami` + `Incite Fear`
  - `Kerapac's wrist wraps`
  - `Blast diffusion boots`
  - `Channeller's ring` + `Enchantment of metaphysics`
  - `Tectonic` / `Elite tectonic`
  - `Tumeken's Resplendence`
  - `Fractured Staff of Armadyl`
  - `Roar of Awakening` + `Ode to Deceit`
  - `Guthix staff` / `Iban's staff` EOF specials

## Public Interface Changes
- Add `utility` to `AbilitySubtype`.
- Add `SpellbookId = 'standard' | 'ancient'`.
- Add `SpellDefinition` and a bundled `spells` catalog collection.
- Add `combatChoices.magic` to portable/workspace/simulation config:
  - `spellbookId`
  - `activeSpellId`
- Add non-GCD action type `spell-swap` with payload:
  - `spellbookId`
  - `spellId`
  - label/icon metadata for planner rendering
- Add execution metadata for abilities so utility abilities can declare `canCastDuringGcd`, `manualOnly`, preferred lane, and shared cooldown groups.
- Bump portable/workspace schema so legacy configs migrate to a valid magic setup.

## Implementation Steps
1. Create `docs/magic-expansion-plan.md` with the shared source pages, the full provided source inventory above, and the Playwright-first verification rule at the top.

2. Add the magic config foundation: `SpellbookId`, `SpellDefinition`, bundled `spells` support, `combatChoices.magic`, `spell-swap` action schema, and portable/workspace migration. Legacy configs should migrate to the Standard spellbook with the highest unlocked Standard combat spell for the player's Magic level.

3. Add curated Standard + Ancient combat spell data, including full active-spell selection in UI and config. First-pass spell-specific mechanics should be implemented where they directly affect listed magic ability behavior, especially [Incite Fear](https://runescape.wiki/w/Incite_Fear) and [Tsunami](https://runescape.wiki/w/Tsunami).

4. Add spell projection support across the simulation pipeline. The planner must be able to resolve the currently active spell at any tick from starting combat choices plus non-GCD `spell-swap` actions, and magic damage/state logic must use the projected spell rather than a static pre-fight value.

5. Promote `utility` into a real subtype across schemas, loaders, Abilities page grouping, planner palette ordering, dialog metadata, and any existing utility abilities currently using `other`.

6. Extend the action model so ability definitions can legally run on the non-GCD lane when their live behavior allows it. The first pass must support [Surge](https://runescape.wiki/w/Surge) and [Runic Charge](https://runescape.wiki/w/Runic_Charge) with during-GCD/manual-use behavior and shared cooldown handling where the live page requires it.

7. Add `Spell swap` to the planner non-GCD system alongside gear swap and utility actions. The planner should expose a spell-swap template, a dialog/picker for `spellbook + spell`, and projected validation so later ticks use the new spell. Spell swaps should follow the same projected-state timing rule as gear and ammo swaps: they affect calculations starting on the next tick.

8. Add magic weapon-topology availability and validation support using the existing generalized equipment model. Support `magic-weapon`, `magic-dual-wield`, `magic-off-hand`, and `magic-two-handed` requirement tags, with main-hand magic weapon requirements matching [Magic abilities](https://runescape.wiki/w/Magic_abilities).

9. Add the magic base damage calculator and route it through the shared style damage entrypoint. The implementation must follow [Ability damage](https://runescape.wiki/w/Ability_damage), including Magic level scaling, main-hand/off-hand/2h paths, selected spell tier contribution, and summed Magic bonus from equipped gear.

10. Add the first magic gear data batch for core 2h weapons, baseline armour, and foundational utility pieces. This batch should include [Obliteration](https://runescape.wiki/w/Obliteration), [Fractured Staff of Armadyl](https://runescape.wiki/w/Fractured_Staff_of_Armadyl), [Noxious staff](https://runescape.wiki/w/Noxious_staff), [Staff of Sliske](https://runescape.wiki/w/Staff_of_Sliske), [Tectonic mask](https://runescape.wiki/w/Tectonic_mask), [Tectonic robe top](https://runescape.wiki/w/Tectonic_robe_top), [Tectonic robe bottom](https://runescape.wiki/w/Tectonic_robe_bottom), [Elite tectonic mask](https://runescape.wiki/w/Elite_tectonic_mask), [Elite tectonic robe top](https://runescape.wiki/w/Elite_tectonic_robe_top), [Elite tectonic robe bottom](https://runescape.wiki/w/Elite_tectonic_robe_bottom), [Masterwork magic hat](https://runescape.wiki/w/Masterwork_magic_hat), [Masterwork magic robe top](https://runescape.wiki/w/Masterwork_magic_robe_top), [Masterwork magic robe bottom](https://runescape.wiki/w/Masterwork_magic_robe_bottom), [Masterwork magic gloves](https://runescape.wiki/w/Masterwork_magic_gloves), [Masterwork magic boots](https://runescape.wiki/w/Masterwork_magic_boots), [Igneous Kal-Mej](https://runescape.wiki/w/Igneous_Kal-Mej), [Kerapac's wrist wraps](https://runescape.wiki/w/Kerapac%27s_wrist_wraps), [Blast diffusion boots](https://runescape.wiki/w/Blast_diffusion_boots), [Channeller's ring](https://runescape.wiki/w/Channeller%27s_ring), and [Enchantment of metaphysics](https://runescape.wiki/w/Enchantment_of_metaphysics). Each definition should include correct category, slot, icon, tier, augmentability where applicable, Shard of Genesis support where applicable, and detailed wiki-backed metadata.

11. Add the second magic gear data batch for dual-wield and modern set-heavy magic gear. This batch should include [Roar of Awakening](https://runescape.wiki/w/Roar_of_Awakening), [Ode to Deceit](https://runescape.wiki/w/Ode_to_Deceit), [Wand of the praesul](https://runescape.wiki/w/Wand_of_the_praesul), [Imperium core](https://runescape.wiki/w/Imperium_core), [Seismic wand](https://runescape.wiki/w/Seismic_wand), [Seismic singularity](https://runescape.wiki/w/Seismic_singularity), [Boots of Tumeken's resplendence](https://runescape.wiki/w/Boots_of_Tumeken%27s_resplendence), [Gloves of Tumeken's resplendence](https://runescape.wiki/w/Gloves_of_Tumeken%27s_resplendence), [Robe bottom of Tumeken's resplendence](https://runescape.wiki/w/Robe_bottom_of_Tumeken%27s_resplendence), [Robe top of Tumeken's resplendence](https://runescape.wiki/w/Robe_top_of_Tumeken%27s_resplendence), and [Mask of Tumeken's resplendence](https://runescape.wiki/w/Mask_of_Tumeken%27s_resplendence).

12. Add the EOF/special-source batch. Always include [Guthix staff](https://runescape.wiki/w/Guthix_staff) and [Iban's staff](https://runescape.wiki/w/Iban%27s_staff), and for every listed weapon page above, inspect the live `Special attack` section with Playwright and add a normal special ability plus EOF spec if and only if the page exposes one.

13. Add the basic magic ability definitions from the verified live list: [Magic](https://runescape.wiki/w/Magic_(ability)), [Greater Sonic Wave](https://runescape.wiki/w/Greater_Sonic_Wave), [Sonic Wave](https://runescape.wiki/w/Sonic_Wave), [Dragon Breath](https://runescape.wiki/w/Dragon_Breath), [Impact](https://runescape.wiki/w/Impact), [Combust](https://runescape.wiki/w/Combust), [Chain](https://runescape.wiki/w/Chain), [Greater Chain](https://runescape.wiki/w/Greater_Chain), [Concentrated Blast](https://runescape.wiki/w/Concentrated_Blast), and [Greater Concentrated Blast](https://runescape.wiki/w/Greater_Concentrated_Blast).

14. Add the enhanced magic ability definitions from the verified live list: [Wild Magic](https://runescape.wiki/w/Wild_Magic), [Asphyxiate](https://runescape.wiki/w/Asphyxiate), [Corruption Blast](https://runescape.wiki/w/Corruption_Blast), [Smoke Tendrils](https://runescape.wiki/w/Smoke_Tendrils), and [Magma Tempest](https://runescape.wiki/w/Magma_Tempest).

15. Add the ultimate and utility magic ability definitions from the verified live list: [Omnipower](https://runescape.wiki/w/Omnipower), [Sunshine](https://runescape.wiki/w/Sunshine), [Greater Sunshine](https://runescape.wiki/w/Greater_Sunshine), [Tsunami](https://runescape.wiki/w/Tsunami), [Surge](https://runescape.wiki/w/Surge), and [Runic Charge](https://runescape.wiki/w/Runic_Charge).

16. Add the listed persistent buff data plus the generated statuses required by the magic kit. This step should include [Augury](https://runescape.wiki/w/Augury), [Affliction](https://runescape.wiki/w/Affliction), [Torment](https://runescape.wiki/w/Torment), and generated definitions for `Flow`, `Greater Flow`, `Anima Charged`, `Channelled Might`, `Sunshine`, `Greater Sunshine`, `Glacial Embrace`, `Tsunami` adrenaline buff, `Blast Infused`, `Instability`, `Essence Corruption`, `Conflagrate`, and `Soulfire` state.

17. Deliver the first playable magic milestone before chasing every passive-heavy weapon interaction. The first supported loops should include:
- one Standard-spell dual-wield setup using `Greater Sonic Wave`, `Greater Concentrated Blast`, `Wild Magic`, `Asphyxiate`, and `Sunshine`
- one Ancient-spell setup using `Dragon Breath`, `Combust`, `Tsunami`, `Runic Charge`, and at least one planner `spell-swap`
This milestone must include exact support for spell choice, spell swap projection, core damage formulas, prayer buffs, `Flow` / `Greater Flow`, `Greater Concentrated Blast` crit setup, `Runic Charge`, `Sunshine` / `Greater Sunshine`, and `Tsunami` + `Incite Fear`.

18. Implement the first magic gear-mechanics pass in combat-loop order: [Kerapac's wrist wraps](https://runescape.wiki/w/Kerapac%27s_wrist_wraps), [Blast diffusion boots](https://runescape.wiki/w/Blast_diffusion_boots), [Channeller's ring](https://runescape.wiki/w/Channeller%27s_ring), [Enchantment of metaphysics](https://runescape.wiki/w/Enchantment_of_metaphysics), [Tectonic mask](https://runescape.wiki/w/Tectonic_mask) / [Tectonic robe top](https://runescape.wiki/w/Tectonic_robe_top) / [Tectonic robe bottom](https://runescape.wiki/w/Tectonic_robe_bottom), [Elite tectonic mask](https://runescape.wiki/w/Elite_tectonic_mask) / [Elite tectonic robe top](https://runescape.wiki/w/Elite_tectonic_robe_top) / [Elite tectonic robe bottom](https://runescape.wiki/w/Elite_tectonic_robe_bottom), and the full [Tumeken's Resplendence](https://runescape.wiki/w/Mask_of_Tumeken%27s_resplendence) set. This pass must include:
- `Dragon Breath` -> `Combust`
- `Wild Magic` -> `Blast Infused`
- channelled crit chance/damage stacking
- Sunshine-gated crit bonuses
- altered `Asphyxiate` hit pattern and `Channelled Might`

19. Implement the second magic mechanics pass for passive-heavy weapons and EOF specials: [Fractured Staff of Armadyl](https://runescape.wiki/w/Fractured_Staff_of_Armadyl), [Roar of Awakening](https://runescape.wiki/w/Roar_of_Awakening), [Ode to Deceit](https://runescape.wiki/w/Ode_to_Deceit), [Guthix staff](https://runescape.wiki/w/Guthix_staff), [Iban's staff](https://runescape.wiki/w/Iban%27s_staff), and any other listed weapon page that exposes a verified special attack section. This pass must cover:
- `Surging Storm`
- `Instability` -> `Lightning Surge`
- `Soulfire`
- `Conflagrate`
- `Song of Destruction`
- `Essence Corruption` stacks and thresholds
- the listed EOF special damage/debuff payloads

20. Finish the magic expansion by wiring the new spell, spell-swap, utility, and stack states into the planner and inspection UX: spellbook and active-spell selection, non-GCD utility ability placement, non-GCD spell-swap placement, shared cooldown validation, buff-lane visibility, stack/tick inspection for `Glacial Embrace` and `Essence Corruption`, and user-facing validation for unsupported or weapon-invalid magic actions.

## Test Plan
- Add schema and migration tests for `utility` subtype, `SpellDefinition`, bundled `spells`, `combatChoices.magic`, `spell-swap` actions, and legacy-config migration.
- Add golden tests for magic base damage with 2h staff, dual-wield wand/off-hand, different spell tiers, and Standard vs Ancient spell choice.
- Add spell-projection tests for:
  - starting selected spell
  - non-GCD `spell-swap` changing projected spell on the next tick
  - Standard-to-Ancient and Ancient-to-Standard swaps
  - spell-dependent damage and status behavior after swaps
- Add utility-action tests for [Surge](https://runescape.wiki/w/Surge) and [Runic Charge](https://runescape.wiki/w/Runic_Charge), including during-GCD placement, shared cooldown validation, and manual-only behavior.
- Add scenario tests for:
  - Standard-spell dual-wield under [Sunshine](https://runescape.wiki/w/Sunshine)
  - Ancient-spell loop with [Incite Fear](https://runescape.wiki/w/Incite_Fear), [Tsunami](https://runescape.wiki/w/Tsunami), and spell swap
  - [Kerapac's wrist wraps](https://runescape.wiki/w/Kerapac%27s_wrist_wraps) + [Dragon Breath](https://runescape.wiki/w/Dragon_Breath) -> [Combust](https://runescape.wiki/w/Combust)
  - [Blast diffusion boots](https://runescape.wiki/w/Blast_diffusion_boots) + [Wild Magic](https://runescape.wiki/w/Wild_Magic)
  - [Channeller's ring](https://runescape.wiki/w/Channeller%27s_ring) + [Enchantment of metaphysics](https://runescape.wiki/w/Enchantment_of_metaphysics)
  - [Fractured Staff of Armadyl](https://runescape.wiki/w/Fractured_Staff_of_Armadyl)
  - [Roar of Awakening](https://runescape.wiki/w/Roar_of_Awakening) / [Ode to Deceit](https://runescape.wiki/w/Ode_to_Deceit) DoT loop with `Soulfire`
- Add UI tests for spell selector persistence, spell-swap dialog/placement, `Utility` grouping, magic detail dialogs, and stack inspection for the new magic statuses.

## Assumptions
- The new plan file lives at `docs/magic-expansion-plan.md`.
- The first magic milestone remains single-target, desktop-first, strict-validation, and ideal-condition only.
- Multi-target portions of [Chain](https://runescape.wiki/w/Chain), [Greater Chain](https://runescape.wiki/w/Greater_Chain), [Dragon Breath](https://runescape.wiki/w/Dragon_Breath), [Magma Tempest](https://runescape.wiki/w/Magma_Tempest), [Sunshine](https://runescape.wiki/w/Sunshine), [Greater Sunshine](https://runescape.wiki/w/Greater_Sunshine), and [Tsunami](https://runescape.wiki/w/Tsunami) remain descriptive-only where the current single-target simulator cannot represent extra-target behavior cleanly.
- Spell choice covers full Standard + Ancient combat spell selection, but first-pass spell-specific mechanics are only implemented where they directly affect the listed magic abilities and interactions.
- `Spell swap` is a non-GCD action and, like gear/ammo swap projection, takes effect starting on the next tick.
- Legacy configs migrate to a Standard spellbook default with the highest unlocked Standard combat spell for the player's Magic level.
- `utility` is a real subtype everywhere, not an alias for `other`.
