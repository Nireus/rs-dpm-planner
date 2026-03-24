# Game Data JSON Conventions

This document defines the first-pass conventions for curated JSON game data in
the MVP.

## File Naming

- use lowercase kebab-case file names
- prefer one primary definition per file for curated MVP data
- use descriptive names based on stable IDs

Examples:

- `bolg.sample.json`
- `rapid-fire.sample.json`
- `deathspore-focus.sample.json`

## IDs

- IDs must be stable
- IDs must be lowercase kebab-case
- IDs must not depend on display-name punctuation or capitalization

Examples:

- `bolg`
- `rapid-fire`
- `deathspore-focus`

## Enum / Tag Usage

- prefer explicit string unions over free-form prose where practical
- combat styles, categories, slots, ammo types, and ability subtypes should use
  curated enum-like values
- mechanic tags may be added as arrays of stable strings when needed

## References Between Files

- cross-document links must use IDs, never display names
- references should stay explicit and one-directional where possible
- unresolved references should fail validation during loading

Examples:

- `effectRefs`
- `weaponOrigin`
- `requiredEquipmentTags`
- `requiredBuffs`

## Effect Descriptors

- use `effectRefs` for mechanic hook references
- keep effect references data-driven and stable
- do not embed long procedural logic in JSON

Example:

```json
{
  "effectRefs": ["bolg-passive", "deathspore-progress"]
}
```

## Cooldown Definitions

- abilities and specials should define cooldowns in ticks
- cooldown fields should be explicit numeric values, such as `cooldownTicks`
- avoid implicit cooldown meaning hidden in description text

## Channel Definitions

- channel-capable abilities should explicitly declare `isChanneled`
- channel duration should be represented with `channelDurationTicks`
- hit timing should be described through `hitSchedule`

## Equipment Requirement Definitions

- requirements should live in a structured `requirements` object
- level requirements should be numeric
- equipment gates should use curated tags or IDs
- blocked combinations should be explicit

Example:

```json
{
  "requirements": {
    "levelRequirements": {
      "ranged": 90
    },
    "requiredEquipmentTags": ["two-handed-bow"]
  }
}
```
