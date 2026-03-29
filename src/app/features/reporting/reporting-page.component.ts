import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-reporting-page',
  standalone: true,
  templateUrl: './reporting-page.component.html',
  styleUrl: './reporting-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportingPageComponent {
  protected readonly emailAddress = 'sweatyrotationplanner@gmail.com';

  protected readonly bugChecklist = [
    'Short summary of the problem',
    'What you expected to happen',
    'What actually happened',
    'Steps to reproduce it',
    'Export JSON from Import / Export so the issue can be reproduced locally',
    'Screenshots if the issue is visual',
  ];

  protected readonly featureChecklist = [
    'Short summary of the requested mechanic or workflow',
    'Why it matters for rotations or results',
    'Any RuneScape Wiki or testing references that define the behavior',
    'If relevant, an example rotation or export JSON that would benefit from it',
  ];
}
