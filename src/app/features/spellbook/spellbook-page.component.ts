import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { SpellDefinition, SpellRole, SpellbookId } from '../../../game-data/types';
import { CombatChoicesStoreService } from '../../core/combat-choices/combat-choices-store.service';
import { GameDataStoreService } from '../../core/game-data/game-data-store.service';
import { PlayerStatsStoreService } from '../../core/player-stats/player-stats-store.service';

interface SpellbookPageSpellEntry {
  id: string;
  name: string;
  spellbookId: SpellbookId;
  role: SpellRole;
  levelRequirement: number;
  tier: number;
  familyLabel: string;
  description?: string;
  hoverSummary?: string;
  iconPath?: string;
  wikiUrl?: string;
}

interface SpellbookRoleSection {
  key: SpellRole;
  label: string;
  spells: SpellbookPageSpellEntry[];
}

@Component({
  selector: 'app-spellbook-page',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './spellbook-page.component.html',
  styleUrl: './spellbook-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SpellbookPageComponent {
  private readonly gameDataStore = inject(GameDataStoreService);
  private readonly combatChoicesStore = inject(CombatChoicesStoreService);
  private readonly playerStatsStore = inject(PlayerStatsStoreService);

  protected readonly query = signal('');
  protected readonly storeSummary = this.gameDataStore.summary;
  protected readonly playerStats = this.playerStatsStore.stats;
  protected readonly magicChoices = this.combatChoicesStore.magicChoices;
  protected readonly allAvailableSpells = computed<SpellbookPageSpellEntry[]>(() => {
    const normalizedQuery = this.query().trim().toLowerCase();
    const selectedSpellbookId = this.magicChoices().spellbookId;
    const magicLevel = this.playerStats().magicLevel ?? 0;

    const entries = Object.values(this.gameDataStore.snapshot().catalog?.spells ?? {})
      .filter((spell) => spell.spellbookId === selectedSpellbookId)
      .filter((spell) => spell.levelRequirement <= magicLevel)
      .sort((left, right) => right.tier - left.tier || left.name.localeCompare(right.name))
      .map((spell) => buildSpellEntry(spell));

    if (!normalizedQuery) {
      return entries;
    }

    return entries.filter((spell) =>
      `${spell.name} ${spell.id} ${spell.familyLabel} ${spell.tier} ${spell.levelRequirement} ${spell.description ?? ''}`
        .toLowerCase()
        .includes(normalizedQuery),
    );
  });
  protected readonly availableSpells = computed(() => this.allAvailableSpells());
  protected readonly availableCombatSpells = computed(() =>
    this.allAvailableSpells().filter((spell) => spell.role === 'combat'),
  );
  protected readonly spellSections = computed<SpellbookRoleSection[]>(() => {
    return (['combat', 'utility'] as const)
      .map((role) => ({
        key: role,
        label: role === 'combat' ? 'Combat spells' : 'Utility spells',
        spells: this.availableSpells().filter((spell) => spell.role === role),
      }))
      .filter((section) => section.spells.length > 0);
  });
  protected readonly selectedSpellEntry = computed(() =>
    this.availableCombatSpells().find((spell) => spell.id === this.magicChoices().activeSpellId) ?? null,
  );
  protected readonly selectedSpellbookSummary = computed(() => {
    const spellbookId = this.magicChoices().spellbookId;
    const entries = this.allAvailableSpells();
    const highestTier = entries[0]?.tier ?? null;

    return {
      label: spellbookId === 'ancient' ? 'Ancient' : 'Standard',
      spellCount: entries.length,
      highestTier,
    };
  });

  protected updateSelectedSpellbook(value: SpellbookId): void {
    this.combatChoicesStore.updateMagicSpellbook(value);
  }

  protected updateSelectedSpell(value: string): void {
    this.combatChoicesStore.updateActiveMagicSpell(value);
  }

  protected selectSpell(spellId: string): void {
    this.combatChoicesStore.updateActiveMagicSpell(spellId);
  }

  protected spellSummary(entry: SpellbookPageSpellEntry): string {
    if (entry.role === 'utility') {
      return `Support | Level ${entry.levelRequirement}`;
    }

    return `Tier ${entry.tier} | Level ${entry.levelRequirement}`;
  }

  protected spellCardTitle(entry: SpellbookPageSpellEntry): string {
    return [
      entry.hoverSummary ?? null,
      this.spellSummary(entry),
      entry.description ?? null,
    ]
      .filter((part): part is string => Boolean(part))
      .join('\n');
  }

  protected initials(name: string): string {
    return name
      .split(/[\s'-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('');
  }

  protected spellStatusLabel(entry: SpellbookPageSpellEntry): string {
    if (entry.role === 'utility') {
      return 'Support';
    }

    return this.magicChoices().activeSpellId === entry.id ? 'Active' : 'Ready';
  }

}

function buildSpellEntry(spell: SpellDefinition): SpellbookPageSpellEntry {
  return {
    id: spell.id,
    name: spell.name,
    spellbookId: spell.spellbookId,
    role: spell.role,
    levelRequirement: spell.levelRequirement,
    tier: spell.tier,
    familyLabel: resolveSpellFamilyLabel(spell.name),
    description: spell.description,
    hoverSummary: spell.hoverSummary,
    iconPath: spell.iconPath,
    wikiUrl: spell.wikiUrl,
  };
}

function resolveSpellFamilyLabel(name: string): string {
  if (/strike$/i.test(name)) {
    return 'Strike';
  }

  if (/bolt$/i.test(name)) {
    return 'Bolt';
  }

  if (/blast$/i.test(name)) {
    return 'Blast';
  }

  if (/wave$/i.test(name)) {
    return 'Wave';
  }

  if (/surge$/i.test(name)) {
    return 'Surge';
  }

  if (/rush$/i.test(name)) {
    return 'Rush';
  }

  if (/burst$/i.test(name)) {
    return 'Burst';
  }

  if (/blitz$/i.test(name)) {
    return 'Blitz';
  }

  if (/barrage$/i.test(name)) {
    return 'Barrage';
  }

  if (/cloud$/i.test(name)) {
    return 'Cloud';
  }

  if (/anomaly$/i.test(name)) {
    return 'Anomaly';
  }

  return 'Special';
}
