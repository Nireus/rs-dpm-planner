import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import type { BuffSelectionOption } from './buffs-selection.utils';

@Component({
  selector: 'app-buff-detail-dialog',
  standalone: true,
  templateUrl: './buff-detail-dialog.component.html',
  styleUrl: './buff-detail-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BuffDetailDialogComponent {
  @Input({ required: true }) entry!: BuffSelectionOption;
  @Input({ required: true }) isActive = false;
  @Input({ required: true }) isReadonly = false;
  @Input({ required: true }) initials!: (name: string) => string;

  @Output() close = new EventEmitter<void>();
  @Output() toggle = new EventEmitter<void>();

  protected statusLabel(): string {
    if (this.isReadonly) {
      return 'Derived';
    }

    return this.isActive ? 'Active' : 'Inactive';
  }
}
