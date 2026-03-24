# RS DPM Planner

Desktop-first Angular application for planning manually defined RuneScape ranged
rotations and simulating theoretical ideal-condition damage output.

## Current Scope

- Ranged only
- Single target only
- No backend
- Strict validation
- Portable versioned import/export
- Manual JSON game data stored in the repo

## Tooling

- Angular 21
- TypeScript
- SCSS
- Vitest via Angular's test builder
- Playwright for E2E
- ESLint + Prettier

## Available Scripts

```bash
npm run dev
npm run build
npm run test
npm run test:watch
npm run e2e
npm run lint
```

## Local Development

Start the development server:

```bash
npm run dev
```

Build the app:

```bash
npm run build
```

Run unit tests:

```bash
npm run test
```

Run unit tests in watch mode:

```bash
npm run test:watch
```

Run E2E tests:

```bash
npm run e2e
```

Run lint checks:

```bash
npm run lint
```

## Playwright Browser Install

If Playwright browsers are not installed yet, run:

```bash
npx playwright install
```
