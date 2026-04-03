import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { SpellRole } from '../../../game-data/types';

export interface RotationPlannerCastSpellOption {
  spellId: string;
  name: string;
  role: SpellRole;
  optionLabel: string;
  iconPath?: string;
}

@Component({
  selector: 'app-rotation-planner-cast-spell-dialog',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './rotation-planner-cast-spell-dialog.component.html',
  styleUrl: './rotation-planner-gear-swap-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RotationPlannerCastSpellDialogComponent {
  readonly actionTick = input.required<number>();
  readonly options = input.required<RotationPlannerCastSpellOption[]>();
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
