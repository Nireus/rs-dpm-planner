import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import type { EquipmentSlot, ItemDefinition } from '../../../game-data/types';
import type { CuratedPerkOption } from '../../../game-data/perks/curated-perk-options';
import type { ResolvedItemInstanceViewModel } from './gear-builder.store';
import { GearItemConfigPanelComponent } from './gear-item-config-panel.component';

@Component({
  selector: 'app-gear-item-detail-dialog',
  standalone: true,
  imports: [GearItemConfigPanelComponent],
  templateUrl: './gear-item-detail-dialog.component.html',
  styleUrl: './gear-item-detail-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GearItemDetailDialogComponent {
  @Input({ required: true }) item!: ItemDefinition;
  @Input() resolvedInstance: ResolvedItemInstanceViewModel | null = null;
  @Input() perkOptions: CuratedPerkOption[] = [];
  @Input() detailLines: string[] = [];
  @Input({ required: true }) formatSlot!: (slot: EquipmentSlot) => string;
  @Input({ required: true }) defaultSummary!: (item: ItemDefinition) => string;
  @Input({ required: true }) initials!: (name: string) => string;

  @Output() close = new EventEmitter<void>();
  @Output() equip = new EventEmitter<void>();
  @Output() addToInventory = new EventEmitter<void>();
  @Output() updateSocketPerks = new EventEmitter<{ socketIndex: number; perkIds: string[] }>();
  @Output() updatePerkRank = new EventEmitter<{ socketIndex: number; perkId: string; rank: number }>();
  @Output() updateBooleanConfig = new EventEmitter<{ optionId: string; checked: boolean }>();
  @Output() updateScalarConfig = new EventEmitter<{ optionId: string; value: string }>();
}
