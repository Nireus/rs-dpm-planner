export function parseBasicAdrenalineBonusMultiplier(effectRef: string): number {
  const match = /^basic-adrenaline:\+(\d+(?:\.\d+)?)%$/.exec(effectRef.trim());
  if (!match) {
    return 0;
  }

  return Number.parseFloat(match[1] ?? '0') / 100;
}

export function parsePerfectEquilibriumThreshold(effectRef: string): number | null {
  const match = /^perfect-equilibrium-threshold:(\d+)$/.exec(effectRef.trim());
  if (!match) {
    return null;
  }

  const value = Number.parseInt(match[1] ?? '', 10);
  return Number.isFinite(value) ? value : null;
}

export function parseRangedHitAdrenalineGain(effectRef: string): number {
  const match = /^ranged-hit-adrenaline:\+(\d+(?:\.\d+)?)%$/.exec(effectRef.trim());
  if (!match) {
    return 0;
  }

  return Number.parseFloat(match[1] ?? '0');
}
