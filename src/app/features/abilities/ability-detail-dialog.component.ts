import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { combatStyleLabel } from '../../../game-data/conventions/combat-styles';

export interface AbilityDetailEntry {
  id: string;
  name: string;
  style: string;
  iconPath?: string;
  hoverSummary?: string;
  description?: string;
  detailLines: string[];
  wikiUrl?: string;
  subtype: string;
  cooldownTicks?: number | null;
  hitCount: number;
  adrenalineGain?: number;
  adrenalineCost?: number;
  baseDamage?: {
    min: number;
    max: number;
  };
  hitSchedule?: {
    id: string;
    tickOffset: number;
    damage: {
      min: number;
      max: number;
    };
  }[];
  effectRefs?: string[];
  displayHitCountLabel?: string;
  displayDamageRangeLabel?: string;
  displayHitScheduleSummary?: string;
  displayHoverSummary?: string;
}

export interface DetailAvailabilityState {
  isAvailable: boolean;
  issues: { message: string }[];
}

@Component({
  selector: 'app-ability-detail-dialog',
  standalone: true,
  templateUrl: './ability-detail-dialog.component.html',
  styleUrl: './ability-detail-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AbilityDetailDialogComponent {
  @Input({ required: true }) entry!: AbilityDetailEntry;
  @Input() availability: DetailAvailabilityState | null = null;
  @Input({ required: true }) initials!: (name: string) => string;

  @Output() close = new EventEmitter<void>();

  protected subtypeLabel(subtype: string): string {
    switch (subtype) {
      case 'enhanced':
        return 'Enhanced';
      case 'basic':
        return 'Basic';
      case 'ultimate':
        return 'Ultimate';
      case 'special':
        return 'Special';
      default:
        return subtype;
    }
  }

  protected styleLabel(style: string): string {
    return combatStyleLabel(style);
  }

  protected cooldownLabel(): string {
    if (this.entry.cooldownTicks === null || this.entry.cooldownTicks === undefined) {
      return 'Varies';
    }

    return `${this.entry.cooldownTicks} ticks`;
  }

  protected adrenalineLabel(): string {
    if (this.entry.adrenalineGain !== undefined) {
      return `+${this.entry.adrenalineGain}%`;
    }

    if (this.entry.adrenalineCost !== undefined) {
      return `-${this.entry.adrenalineCost}%`;
    }

    if (this.entry.subtype === 'special') {
      return 'Varies';
    }

    return '0%';
  }

  protected damageRangeLabel(): string {
    if (this.entry.displayDamageRangeLabel) {
      return this.entry.displayDamageRangeLabel;
    }

    if (!this.entry.baseDamage) {
      return 'Varies';
    }

    const { min, max } = this.entry.baseDamage;

    if (min === 0 && max === 0 && this.entry.subtype === 'special') {
      return 'Varies';
    }

    return `${min}% - ${max}%`;
  }

  protected hitScheduleSummary(): string {
    if (this.entry.displayHitScheduleSummary) {
      return this.entry.displayHitScheduleSummary;
    }

    const schedule = this.entry.hitSchedule ?? [];

    if (schedule.length === 0) {
      return this.entry.subtype === 'special' ? 'Varies by equipped source.' : 'Single resolved hit.';
    }

    if (schedule.length === 1) {
      return `1 hit at tick ${schedule[0].tickOffset}.`;
    }

    const offsets = schedule.map((hit) => hit.tickOffset);
    const preview = offsets.slice(0, 5).join(', ');
    const suffix = offsets.length > 5 ? ', ...' : '';
    return `${schedule.length} hits at ticks ${preview}${suffix}.`;
  }
}
