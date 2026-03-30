import { CURATED_ABILITY_UI } from './curated-ability-ui';

describe('CURATED_ABILITY_UI', () => {
  it('provides icon metadata for curated melee basic abilities', () => {
    const meleeBasicIds = [
      'attack',
      'adaptive-strike',
      'rend',
      'fury',
      'greater-fury',
      'backhand',
      'punish',
      'barge',
      'bladed-dive',
      'greater-barge',
      'chaos-roar',
    ];

    for (const id of meleeBasicIds) {
      expect(CURATED_ABILITY_UI[id]?.iconPath).toEqual(expect.any(String));
    }
  });
});
