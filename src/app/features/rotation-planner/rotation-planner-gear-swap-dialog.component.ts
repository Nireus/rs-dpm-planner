import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { PlannerGearSwapOption } from './rotation-planner-page.helpers';

@Component({
  selector: 'app-rotation-planner-gear-swap-dialog',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './rotation-planner-gear-swap-dialog.component.html',
  styleUrl: './rotation-planner-gear-swap-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RotationPlannerGearSwapDialogComponent {
  readonly actionTick = input.required<number>();
  readonly options = input.required<PlannerGearSwapOption[]>();
  readonly selectedInstanceId = input<string | null>(null);

  readonly selectedInstanceIdChange = output<string | null>();
  readonly apply = output<void>();
  readonly cancel = output<void>();
  readonly remove = output<void>();

  protected updateSelectedInstanceId(value: string | null): void {
    this.selectedInstanceIdChange.emit(value);
  }

  protected applySelection(): void {
    this.apply.emit();
  }

  protected cancelDialog(): void {
    this.cancel.emit();
  }

  protected removeAction(): void {
    this.remove.emit();
  }
}
