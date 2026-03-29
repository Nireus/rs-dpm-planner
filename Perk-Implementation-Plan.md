Perk Implementation Plan
Summary
Implement the requested perk set as the only supported perks in the app, using the existing ranged-only MVP boundaries.

Chosen defaults:

chance accumulation uses a 100% virtual threshold, with carry-over between eligible trigger opportunities
perks not in your list are removed from both UI and curated perk data
any perk whose applicability is conditional should become explicitly toggleable from Buffs after the perk is equipped
if a listed perk still needs non-obvious semantic decisions after wiki review, stop and ask you about that specific perk before implementation
Key Changes
1. Curated perk dataset cleanup and replacement
Replace the current partial perk dataset with definitions only for:
Impatient
Flanking
Eruptive
Equilibrium
Dragon Slayer
Demon Slayer
Caroming
Biting
Aftershock
Undead Slayer
Ultimatums
Precise
Invigorating
Remove non-listed perk entries from:
curated perk option UI
sample manifest perk list
any obsolete perk JSON files
Keep perk ids/ranks configured on gear the same way as today so the gear UI model does not need a new configuration shape.
2. Perk icons sourced from wiki pages with Playwright
For each listed perk, use Playwright to open the wiki page, capture the current icon source, and populate iconPath in the curated perk definition.
Reuse those icons in all existing perk display surfaces that already support icon rendering:
gear item detail/config views
equipped item overlays where practical
Buffs page entries for conditional perk toggles
tick inspection / equipment detail where perk definitions are resolved
Follow the project’s current icon strategy unless you tell me otherwise later:
use the scraped wiki icon URL directly in curated data
do not treat local asset mirroring as part of this step
3. Conditional perk applicability via Buffs
Add persistent buff-style toggles for any perk condition that changes whether an equipped perk applies.
These toggles should only appear in Buffs once the related perk exists on equipped gear.
Initial required examples:
Dragon Slayer active
Demon Slayer active
Undead Slayer active
Extend the same pattern to other listed perks when their effect depends on a state the simulator cannot infer from gear alone, for example positional/target-state conditions like Flanking if the wiki behavior confirms that is the right driver.
These toggles should affect simulation only; they do not replace the perk being equipped on gear.
4. Chance-based perk proc accumulator model
Add a shared engine utility for “virtual chance buildup” perks:
each eligible trigger adds its percentage chance into an in-memory accumulator
when the accumulator reaches or exceeds 100%, the perk procs
overflow carries into the next buildup cycle
This accumulator should be timeline-local and reset at the start of each simulation run.
It should be implemented as a reusable rule primitive so multiple perks can share it instead of each re-implementing chance logic.
Surface proc outcomes in explainability where possible, especially for perks that add damage, adrenaline, or cooldown-related effects.
5. Perk mechanics implementation pass
Implement the listed perks in three buckets:

Straightforward numeric modifiers:
Equilibrium
Precise
Biting
Caroming
Conditional equipped-perk + Buffs-toggle modifiers:
Dragon Slayer
Demon Slayer
Undead Slayer
likely Flanking, depending on exact wiki applicability
Stateful / proc / trigger perks using the shared accumulator:
Aftershock
Impatient
Invigorating
Ultimatums
Eruptive if its live behavior is still relevant to ranged MVP scenarios

use links provided by me:
https://runescape.wiki/w/Impatient
https://runescape.wiki/w/Flanking
https://runescape.wiki/w/Eruptive
https://runescape.wiki/w/Equilibrium
https://runescape.wiki/w/Dragon_Slayer_(perk)
https://runescape.wiki/w/Demon_Slayer_(perk)
https://runescape.wiki/w/Caroming
https://runescape.wiki/w/Biting
https://runescape.wiki/w/Aftershock
https://runescape.wiki/w/Undead_Slayer
https://runescape.wiki/w/Ultimatums
https://runescape.wiki/w/Precise
https://runescape.wiki/w/Invigorating

For this pass:

keep all combat logic in simulation-engine
keep perk definitions/effect refs in game-data
keep Angular responsible only for configuration and display
6. Clarification checkpoint for ambiguous perks
Before implementing any listed perk whose live behavior is still unclear or unusually complex after reading the wiki page, stop and ask you for that perk specifically.

The most likely candidates for follow-up clarification are:

Aftershock
Impatient
Invigorating
Flanking
Ultimatums
Eruptive
Public Interfaces / Type Changes
Extend PerkDefinition data to include iconPath and any needed effect refs/config metadata for the listed perks.
Add conditional perk buff definitions in the curated buffs dataset for explicit applicability toggles.
Add a reusable simulation-engine accumulator/state helper for chance-build perks.
If needed for explainability, extend hit/result metadata with perk-proc contributions rather than embedding perk-specific ad hoc notes.
Test Plan
Data validation:
listed perk JSON definitions load successfully
removed perks are no longer exposed through curated options
scraped perk icons resolve into definitions
Engine regression tests:
Precise / Equilibrium numeric damage behavior
Biting crit contribution
Caroming retained or corrected behavior
slayer perks only apply when both equipped and their Buffs toggle is active
chance-build accumulator carries overflow correctly, e.g. 26% + 26% + 26% + 26% => proc + 4% carry
Aftershock / Impatient / Invigorating scenario tests once clarified
UI tests:
perk icons appear where perk metadata is shown
conditional perk toggles appear in Buffs only when the perk is equipped
removed perks no longer appear in gear perk pickers
E2E:
equip a supported perk, enable its conditional buff if applicable, and verify the resulting simulation/output changes
one proc-based perk scenario once the first stateful perk is implemented
Assumptions
We stay within ranged-only MVP behavior; no perk implementation should introduce melee/magic/necro abstractions unless needed for a listed perk’s exact logic.
Existing non-listed perks such as Crackling, Relentless, and Ruthless are removed from curated support in this step.
“Conditional perk buffs” are explicit user-controlled simulation switches, not auto-detected combat state.
Wiki icon scraping is part of implementation; local icon mirroring is not.
Any perk whose exact semantics are too ambiguous after wiki review will trigger a follow-up question before code is written.