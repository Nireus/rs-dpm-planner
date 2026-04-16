import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-changelog-page',
  standalone: true,
  templateUrl: './changelog-page.component.html',
  styleUrl: './changelog-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChangelogPageComponent {
  protected readonly entries = [
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
        'Fixxed runic charge bugs. Implemented crit interactions with Tsunami and FSOA.',
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
        'Initial first-release scope is live with ranged single-target rotation planning, theoretical min/avg/max damage simulation, import/export, and major planner inspection tools. The release also includes a broad first-pass mechanic set for key ranged weapons, ammo, buffs, perks, and utility actions.',
    },
  ];
}
