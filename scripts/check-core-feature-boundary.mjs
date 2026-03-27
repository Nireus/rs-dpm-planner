import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();
const coreDir = path.join(rootDir, 'src', 'app', 'core');
const violations = [];

scanDirectory(coreDir);

if (violations.length > 0) {
  console.error('Architecture boundary violations found:');
  for (const violation of violations) {
    console.error(`- ${violation.file}: ${violation.importPath}`);
  }
  process.exit(1);
}

console.log('No app/core -> app/features import violations found.');

function scanDirectory(directory) {
  for (const entry of readdirSync(directory)) {
    const absolutePath = path.join(directory, entry);
    const stats = statSync(absolutePath);

    if (stats.isDirectory()) {
      scanDirectory(absolutePath);
      continue;
    }

    if (!absolutePath.endsWith('.ts') && !absolutePath.endsWith('.tsx')) {
      continue;
    }

    scanFile(absolutePath);
  }
}

function scanFile(filePath) {
  const fileText = readFileSync(filePath, 'utf8');
  const importMatches = fileText.matchAll(/from\s+['"]([^'"]+)['"]/g);

  for (const match of importMatches) {
    const importPath = match[1];

    if (isFeatureImport(filePath, importPath)) {
      violations.push({
        file: path.relative(rootDir, filePath),
        importPath,
      });
    }
  }
}

function isFeatureImport(filePath, importPath) {
  if (importPath.includes('/features/') || importPath.includes('\\features\\')) {
    return true;
  }

  if (!importPath.startsWith('.')) {
    return false;
  }

  const resolvedImport = path.resolve(path.dirname(filePath), importPath);
  return resolvedImport.includes(`${path.sep}src${path.sep}app${path.sep}features${path.sep}`);
}
