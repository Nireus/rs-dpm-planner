# App / UI Layer

This directory contains the Angular application layer.

Responsibilities:

- routing and screen composition
- user interaction and local UI state
- feature panels and forms
- planner and results presentation
- import / export user workflows

Non-responsibilities:

- combat math
- cooldown resolution
- adrenaline resolution
- hit scheduling
- damage calculation

Keep simulation logic in `src/simulation-engine` and curated definitions in
`src/game-data`.
