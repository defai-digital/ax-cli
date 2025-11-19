import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Get version from package.json
 * This is the single source of truth for version info
 */
export function getVersion(): string {
  try {
    // In development: src/utils/version.ts -> ../../package.json
    // In production: dist/utils/version.js -> ../../package.json
    const possiblePaths = [
      join(__dirname, '../../package.json'),  // From src/utils or dist/utils
      join(__dirname, '../package.json'),     // Fallback
    ];

    for (const pkgPath of possiblePaths) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { version?: string };
        if (pkg.version) {
          return pkg.version;
        }
      } catch {
        // Try next path
        continue;
      }
    }

    throw new Error('package.json not found in any expected location');
  } catch (error) {
    console.error('Failed to read version from package.json:', error);
    return 'unknown';
  }
}
