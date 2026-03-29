import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type {
  AdrenalinePotionVariantDefinition,
  AdrenalinePotionVariantId,
} from '../../../simulation-engine/actions/adrenaline-potions';

@Component({
  selector: 'app-rotation-planner-adrenaline-potion-dialog',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './rotation-planner-adrenaline-potion-dialog.component.html',
  styleUrl: './rotation-planner-adrenaline-potion-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RotationPlannerAdrenalinePotionDialogComponent {
  readonly actionTick = input.required<number>();
  readonly options = input.required<readonly AdrenalinePotionVariantDefinition[]>();
  readonly selectedVariantId = input<AdrenalinePotionVariantId | null>(null);

  readonly selectedVariantIdChange = output<AdrenalinePotionVariantId | null>();
  readonly apply = output<void>();
  readonly cancel = output<void>();
  readonly remove = output<void>();

  protected updateSelectedVariantId(value: AdrenalinePotionVariantId | null): void {
    this.selectedVariantIdChange.emit(value);
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
