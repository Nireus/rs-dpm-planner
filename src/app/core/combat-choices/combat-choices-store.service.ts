import { computed, effect, inject, Injectable, signal } from '@angular/core';
import type { CombatChoices } from '../../../simulation-engine/models';
import {
  normalizeCombatChoices,
  resolveDefaultCombatSpellId,
} from '../../../simulation-engine/spells/magic-combat-choices';
import { PlayerStatsStoreService } from '../player-stats/player-stats-store.service';
import { WorkspaceRepositoryService } from '../workspace/workspace-repository.service';

@Injectable({
  providedIn: 'root',
})
export class CombatChoicesStoreService {
  private readonly workspaceRepository = inject(WorkspaceRepositoryService);
  private readonly playerStatsStore = inject(PlayerStatsStoreService);
  readonly combatChoices = signal<CombatChoices>(
    normalizeCombatChoices(
      this.playerStatsStore.stats(),
      this.workspaceRepository.readCombatChoices(),
    ),
  );
  readonly magicChoices = computed(() => this.combatChoices().magic);

  constructor() {
    effect(() => {
      const current = this.combatChoices();
      const normalized = normalizeCombatChoices(
        this.playerStatsStore.stats(),
        current,
      );

      if (
        current.magic.spellbookId !== normalized.magic.spellbookId ||
        current.magic.activeSpellId !== normalized.magic.activeSpellId
      ) {
        this.combatChoices.set(normalized);
        return;
      }

      this.workspaceRepository.updateCombatChoices(normalized);
    }, { allowSignalWrites: true });
  }

  updateMagicSpellbook(spellbookId: CombatChoices['magic']['spellbookId']): void {
    this.combatChoices.update((current) => ({
      ...current,
      magic: {
        spellbookId,
        activeSpellId: resolveDefaultCombatSpellId(
          spellbookId,
          this.playerStatsStore.stats().magicLevel,
        ),
      },
    }));
  }

  updateActiveMagicSpell(activeSpellId: string): void {
    this.combatChoices.update((current) => ({
      ...current,
      magic: {
        ...current.magic,
        activeSpellId,
      },
    }));
  }

  reset(): void {
    this.combatChoices.set(normalizeCombatChoices(this.playerStatsStore.stats(), undefined));
  }

  loadCombatChoices(combatChoices: CombatChoices): void {
    this.combatChoices.set(normalizeCombatChoices(this.playerStatsStore.stats(), combatChoices));
  }
}
