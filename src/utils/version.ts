import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface PackageJson {
  version?: string;
  sdkVersion?: string;
}

/**
 * Get CLI version from package.json
 * This is the version of the command-line tool
 */
export function getVersion(): string {
  try {
    const pkg = getPackageJson();
    return pkg.version || 'unknown';
  } catch (error) {
    console.error('Failed to read version from package.json:', error);
    return 'unknown';
  }
}

/**
 * Get SDK version from package.json
 * This is the version of the programmatic API
 */
export function getSDKVersion(): string {
  try {
    const pkg = getPackageJson();
    return pkg.sdkVersion || pkg.version || 'unknown';
  } catch (error) {
    console.error('Failed to read SDK version from package.json:', error);
    return 'unknown';
  }
}

/**
 * Get formatted version string showing both CLI and SDK versions
 */
export function getVersionString(): string {
  const cliVersion = getVersion();
  const sdkVersion = getSDKVersion();

  if (cliVersion === sdkVersion) {
    return `v${cliVersion}`;
  }

  return `v${cliVersion} (SDK v${sdkVersion})`;
}

/**
 * Get package.json data
 * @internal
 */
function getPackageJson(): PackageJson {
  // In development: src/utils/version.ts -> ../../package.json
  // In production: dist/utils/version.js -> ../../package.json
  const possiblePaths = [
    join(__dirname, '../../package.json'),  // From src/utils or dist/utils
    join(__dirname, '../package.json'),     // Fallback
  ];

  for (const pkgPath of possiblePaths) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as PackageJson;
      if (pkg.version) {
        return pkg;
      }
    } catch {
      // Try next path
      continue;
    }
  }

  throw new Error('package.json not found in any expected location');
}
