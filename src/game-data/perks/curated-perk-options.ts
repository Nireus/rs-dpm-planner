export interface CuratedPerkOption {
  id: string;
  label: string;
  maxRank: number;
  shortCode: string;
}

export const CURATED_PERK_OPTIONS: CuratedPerkOption[] = [
  { id: 'aftershock', label: 'Aftershock', maxRank: 4, shortCode: 'A' },
  { id: 'biting', label: 'Biting', maxRank: 4, shortCode: 'B' },
  { id: 'caroming', label: 'Caroming', maxRank: 4, shortCode: 'C' },
  { id: 'crackling', label: 'Crackling', maxRank: 4, shortCode: 'Cr' },
  { id: 'equilibrium', label: 'Equilibrium', maxRank: 4, shortCode: 'E' },
  { id: 'impatient', label: 'Impatient', maxRank: 4, shortCode: 'I' },
  { id: 'precise', label: 'Precise', maxRank: 6, shortCode: 'P' },
  { id: 'relentless', label: 'Relentless', maxRank: 5, shortCode: 'Rl' },
  { id: 'ruthless', label: 'Ruthless', maxRank: 3, shortCode: 'Ru' },
];
