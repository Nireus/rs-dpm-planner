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
  { id: 'demon-slayer', label: 'Demon Slayer', maxRank: 1, shortCode: 'DS' },
  { id: 'dragon-slayer', label: 'Dragon Slayer', maxRank: 1, shortCode: 'DrS' },
  { id: 'equilibrium', label: 'Equilibrium', maxRank: 4, shortCode: 'Eq' },
  { id: 'eruptive', label: 'Eruptive', maxRank: 4, shortCode: 'E' },
  { id: 'flanking', label: 'Flanking', maxRank: 4, shortCode: 'F' },
  { id: 'impatient', label: 'Impatient', maxRank: 4, shortCode: 'I' },
  { id: 'invigorating', label: 'Invigorating', maxRank: 4, shortCode: 'In' },
  { id: 'precise', label: 'Precise', maxRank: 6, shortCode: 'P' },
  { id: 'ultimatums', label: 'Ultimatums', maxRank: 4, shortCode: 'U' },
  { id: 'undead-slayer', label: 'Undead Slayer', maxRank: 1, shortCode: 'US' },
];
