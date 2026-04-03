import fs from 'node:fs/promises';
import path from 'node:path';

const repoRoot = process.cwd();
const manifestPath = path.join(repoRoot, 'src/game-data/loaders/sample-manifest.ts');
const outputPath = path.join(repoRoot, 'public/game-data/catalog.sample.json');
const categoryKeys = ['items', 'spells', 'abilities', 'buffs', 'eofSpecs', 'perks', 'relics'];

async function main() {
  const manifestSource = await fs.readFile(manifestPath, 'utf8');
  const manifest = parseManifestSource(manifestSource);
  const bundledDocument = {};

  for (const category of categoryKeys) {
    bundledDocument[category] = await Promise.all(
      manifest[category].map(async (assetPath) => {
        const sourcePath = path.join(repoRoot, 'src', assetPath.replace(/^\/game-data\//, 'game-data/'));
        const raw = await fs.readFile(sourcePath, 'utf8');
        return JSON.parse(raw);
      }),
    );
  }

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(bundledDocument, null, 2)}\n`);

  const summary = categoryKeys
    .map((category) => `${category}=${bundledDocument[category].length}`)
    .join(', ');
  console.log(`Generated ${path.relative(repoRoot, outputPath)} (${summary})`);
}

function parseManifestSource(source) {
  const manifest = {};

  for (const category of categoryKeys) {
    const match = source.match(new RegExp(`${category}:\\s*\\[([\\s\\S]*?)\\]`, 'm'));
    if (!match) {
      throw new Error(`Could not locate "${category}" array in sample-manifest.ts`);
    }

    manifest[category] = Array.from(match[1].matchAll(/'([^']+\.json)'/g), (entry) => entry[1]);
  }

  return manifest;
}

await main();

