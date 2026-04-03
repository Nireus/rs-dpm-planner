import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';

export interface RotationPlannerSpellSwapOption {
  spellId: string;
  name: string;
  optionLabel: string;
  iconPath?: string;
}

@Component({
  selector: 'app-rotation-planner-spell-swap-dialog',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './rotation-planner-spell-swap-dialog.component.html',
  styleUrl: './rotation-planner-gear-swap-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RotationPlannerSpellSwapDialogComponent {
  readonly actionTick = input.required<number>();
  readonly options = input.required<RotationPlannerSpellSwapOption[]>();
  readonly selectedSpellId = input<string | null>(null);

  readonly selectedSpellIdChange = output<string | null>();
  readonly apply = output<void>();
  readonly cancel = output<void>();
  readonly remove = output<void>();

  protected updateSelectedSpellId(value: string | null): void {
    this.selectedSpellIdChange.emit(value);
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
