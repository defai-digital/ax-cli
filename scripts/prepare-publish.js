#!/usr/bin/env node
/**
 * Prepare for npm publish
 *
 * This script replaces the workspace symlink with a real directory
 * so that bundleDependencies properly includes @ax-cli/schemas in the npm tarball.
 *
 * Problem: npm workspaces create a symlink at node_modules/@ax-cli/schemas -> packages/schemas
 * When npm packs with bundleDependencies, it doesn't follow symlinks properly.
 *
 * Solution: Replace the symlink with a real copy of the package before publishing.
 */

import { rmSync, cpSync, existsSync, lstatSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const rootDir = join(__dirname, '..');
const source = join(rootDir, 'packages', 'schemas');
const dest = join(rootDir, 'node_modules', '@defai.digital', 'ax-schemas');
const destParent = join(rootDir, 'node_modules', '@defai.digital');

console.log('📦 Preparing @defai.digital/ax-schemas for npm publish...');

// Verify source exists
if (!existsSync(source)) {
  console.error('❌ Source not found:', source);
  process.exit(1);
}

// Verify source has dist folder (built)
if (!existsSync(join(source, 'dist'))) {
  console.error('❌ Source not built. Run "npm run build:schemas" first.');
  process.exit(1);
}

// Ensure parent directory exists
if (!existsSync(destParent)) {
  mkdirSync(destParent, { recursive: true });
}

// Remove existing symlink or directory
try {
  const stat = lstatSync(dest);
  if (stat.isSymbolicLink() || stat.isDirectory()) {
    console.log('🔗 Removing existing symlink/directory at:', dest);
    rmSync(dest, { recursive: true, force: true });
  }
} catch {
  // Path doesn't exist, that's fine
}

// Copy the package (without node_modules and tests)
console.log('📋 Copying package from:', source);
console.log('   To:', dest);

cpSync(source, dest, {
  recursive: true,
  filter: (src) => {
    // Skip node_modules and test files
    if (src.includes('node_modules')) return false;
    if (src.includes('.test.')) return false;
    if (src.endsWith('/tests') || src.includes('/tests/')) return false;
    return true;
  }
});

console.log('✅ @defai.digital/ax-schemas prepared for publishing');
console.log('');
console.log('Files copied:');
console.log('  - package.json');
console.log('  - dist/');
console.log('  - README.md');
