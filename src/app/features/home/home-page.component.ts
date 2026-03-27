import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-home-page',
  imports: [RouterLink],
  templateUrl: './home-page.component.html',
  styleUrl: './home-page.component.scss',
})
export class HomePageComponent {
  protected readonly screens = [
    {
      title: 'Gear',
      path: '/gear',
      eyebrow: 'Loadout',
      description:
        'Build the ranged setup, backpack, quiver ammo, EOF special, and perks that define the simulation state.',
    },
    {
      title: 'Buffs',
      path: '/buffs',
      eyebrow: 'Persistent Setup',
      description:
        'Choose pre-fight relics, prayers, potions, and miscellaneous passive effects that stay active through the rotation.',
    },
    {
      title: 'Abilities',
      path: '/abilities',
      eyebrow: 'Reference',
      description:
        'Check the curated ranged ability list, damage profiles, cooldowns, and special interactions before you build the rotation.',
    },
    {
      title: 'Rotation Planner',
      path: '/rotation-planner',
      eyebrow: 'Timeline',
      description:
        'Map the rotation on the timeline, place swaps and abilities, and inspect adrenaline, buffs, cooldowns, and state as the plan unfolds.',
    },
    {
      title: 'Results',
      path: '/results',
      eyebrow: 'Output',
      description:
        'Review min, average, and max damage, DPM, per-ability contribution, and hit-by-hit explainability once the plan is locked in.',
    },
    {
      title: 'Import / Export',
      path: '/import-export',
      eyebrow: 'Portability',
      description:
        'Reserved for portable configuration workflows so builds can later be saved, shared, and restored consistently.',
    },
  ];

  protected readonly assumptions = [
    'This is an ideal-theory calculator for ranged on a single target, built for players who want to optimize cleanly and push damage plans hard.',
    'The simulation assumes the rotation is executed well: no missed inputs, no movement loss, no interruptions, and no fight-specific downtime.',
    'Accuracy and target defence are not part of the model, so damage is evaluated as if every eligible hit connects.',
    'Minimum damage shows the lowest roll, and if a non-critical hit is possible it stays non-critical there.',
    'Maximum damage shows the highest roll, and if a critical hit is possible it assumes that top-end critical outcome.',
    'Average damage is the practical expected-value view, blending normal rolls and crit behaviour into one realistic planning number.',
  ];
}
