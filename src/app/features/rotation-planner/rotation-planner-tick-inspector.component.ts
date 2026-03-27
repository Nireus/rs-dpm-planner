import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { RotationPlannerTickInspection } from './rotation-planner-inspection';

@Component({
  selector: 'app-rotation-planner-tick-inspector',
  standalone: true,
  templateUrl: './rotation-planner-tick-inspector.component.html',
  styleUrl: './rotation-planner-tick-inspector.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RotationPlannerTickInspectorComponent {
  readonly inspection = input.required<RotationPlannerTickInspection>();
}
