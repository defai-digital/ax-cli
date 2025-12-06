#!/usr/bin/env node
/**
 * Restore workspace symlink after npm publish
 *
 * This script restores the workspace symlink that was replaced during publishing.
 */

import { rmSync, symlinkSync, existsSync, lstatSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const rootDir = join(__dirname, '..');
const dest = join(rootDir, 'node_modules', '@defai.digital', 'ax-schemas');
const destParent = join(rootDir, 'node_modules', '@defai.digital');
const relativeSource = '../../packages/schemas';

console.log('🔗 Restoring workspace symlink...');

// Ensure parent directory exists
if (!existsSync(destParent)) {
  mkdirSync(destParent, { recursive: true });
}

// Remove existing directory or symlink
try {
  const stat = lstatSync(dest);
  if (stat.isDirectory() || stat.isSymbolicLink()) {
    console.log('🗑️  Removing copied directory at:', dest);
    rmSync(dest, { recursive: true, force: true });
  }
} catch {
  // Path doesn't exist, that's fine
}

// Recreate symlink
try {
  symlinkSync(relativeSource, dest);
  console.log('✅ Symlink restored:', dest, '->', relativeSource);
} catch (error) {
  console.warn('⚠️  Could not restore symlink (this is okay):', error.message);
  console.log('   Run "npm install" to restore workspace links');
}
