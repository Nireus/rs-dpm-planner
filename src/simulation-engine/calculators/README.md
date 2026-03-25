# Calculators

Pure calculation modules for damage, modifiers, and aggregation.
## Calculators

This layer contains pure damage-aggregation entry points.

Current coverage:

- `simulateBaseDamage(...)`
  - schedules hits from ability definitions
  - aggregates per-hit, per-tick, per-ability, and total min/avg/max
  - reuses strict validation plus cooldown/adrenaline resolvers
  - leaves additive, multiplicative, and expected-value modifier buckets ready for later phases
