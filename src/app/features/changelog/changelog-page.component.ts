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
