export interface ScreenHelpSection {
  title: string;
  bullets: string[];
}

export interface ScreenHelpInfo {
  eyebrow: string;
  title: string;
  description: string;
  sections?: ScreenHelpSection[];
}

export const GEAR_SCREEN_HELP: ScreenHelpInfo = {
  eyebrow: 'Loadout',
  title: 'Gear',
  description: 'This screen defines the equipment state the simulation starts from.',
  sections: [
    {
      title: 'What you can do here',
      bullets: [
        'Equip weapons, armour, ammo, pocket items, rings, and jewellery.',
        'Configure perks on supported gear.',
        'Set quiver arrows and stored Essence of Finality specials.',
        'Add extra items to the backpack so they are available for timeline swaps later.',
        'Remove equipped items or backpack items when you want to rebuild the loadout.',
      ],
    },
    {
      title: 'Why it matters',
      bullets: [
        'Backpack items are part of the sim because gear swaps can pull from them mid-rotation.',
        'Configured perks, quiver ammo, and stored specials flow directly into calculations.',
        'If something is not equipped or in the backpack here, the planner cannot swap into it later.',
      ],
    },
  ],
};

export const BUFFS_SCREEN_HELP: ScreenHelpInfo = {
  eyebrow: 'Persistent Setup',
  title: 'Buffs',
  description: 'Use this screen for always-on or pre-fight effects that persist across the whole build.',
  sections: [
    {
      title: 'What you can do here',
      bullets: [
        'Enable relics, prayers, potions, auras, and other persistent buffs.',
        'Set prayer-related state, including prayer level.',
        'Toggle conditional perk effects when a perk needs manual applicability control.',
      ],
    },
    {
      title: 'What to know',
      bullets: [
        'This is not the place for timeline actions like casting Death\'s Swiftness or swapping gear.',
        'These settings shape the whole simulation before the first planner tick starts.',
        'Conditional perk toggles only appear when the matching perk is actually equipped.',
      ],
    },
  ],
};

export const ABILITIES_SCREEN_HELP: ScreenHelpInfo = {
  eyebrow: 'Reference',
  title: 'Abilities',
  description: 'This screen is a quick ranged ability reference for planning and sanity-checking.',
  sections: [
    {
      title: 'What you can do here',
      bullets: [
        'Browse the curated ranged ability list.',
        'Inspect damage profiles, hit structure, subtype, adrenaline impact, and cooldowns.',
        'Check how supported special interactions are currently represented in the app.',
      ],
    },
    {
      title: 'What to know',
      bullets: [
        'This screen does not change the build directly.',
        'Use it when you want to verify how an ability is modeled before placing it on the planner.',
      ],
    },
  ],
};

export const ROTATION_PLANNER_SCREEN_HELP: ScreenHelpInfo = {
  eyebrow: 'Timeline',
  title: 'Rotation Planner',
  description: 'This is the main planning surface where the rotation is assembled tick by tick.',
  sections: [
    {
      title: 'What you can do here',
      bullets: [
        'Place abilities on exact ticks.',
        'Add non-GCD actions like gear swaps and supported specials.',
        'Inspect tick-by-tick adrenaline, cooldowns, buffs, hits, and damage math.',
        'See buff and cooldown lanes alongside the action timeline.',
        'Set the combat level input used for damage calculations, such as ranged level.',
      ],
    },
    {
      title: 'Validation behaviour',
      bullets: [
        'The planner lets you sketch invalid ideas instead of blocking them immediately.',
        'If an action is not valid, it will be highlighted and explained in the validation area and tick inspection.',
        'Use this screen to experiment first, then clean up the warnings.',
      ],
    },
  ],
};

export const RESULTS_SCREEN_HELP: ScreenHelpInfo = {
  eyebrow: 'Output',
  title: 'Results',
  description: 'This screen turns the current setup and planner state into damage output and explainability.',
  sections: [
    {
      title: 'What you can do here',
      bullets: [
        'Review total minimum, average, and maximum damage.',
        'Compare DPM and per-ability contribution.',
        'Inspect detailed hit-by-hit breakdowns and derived effects like perk or passive procs.',
      ],
    },
    {
      title: 'How to use it well',
      bullets: [
        'Use average damage for practical planning and comparison.',
        'Use min and max to understand the lower and upper ceiling of the same rotation.',
        'Cross-check suspicious outcomes against the explainability panel before trusting them.',
      ],
    },
  ],
};

export const IMPORT_EXPORT_SCREEN_HELP: ScreenHelpInfo = {
  eyebrow: 'Portability',
  title: 'Import / Export',
  description: 'Use this screen to move builds in and out of the app as portable JSON.',
  sections: [
    {
      title: 'What you can do here',
      bullets: [
        'Export the current build to portable JSON.',
        'Copy the JSON for sharing or backup.',
        'Import a saved config back into the app.',
        'Validate pasted JSON before replacing the current workspace state.',
      ],
    },
    {
      title: 'What to know',
      bullets: [
        'Importing replaces the current local workspace state.',
        'The exported document is meant to be portable and simulation-focused, not account-specific.',
      ],
    },
  ],
};
