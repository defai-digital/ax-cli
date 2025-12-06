/**
 * SDK Version Information
 *
 * Provides version constants for the AX CLI SDK.
 * Useful for debugging, logging, and version compatibility checks.
 *
 * ## Version Strategy
 *
 * AX CLI uses **dual versioning** to avoid confusion:
 *
 * - **CLI Version** (e.g., 3.8.0): Changes frequently with CLI features, bug fixes, UI updates
 * - **SDK Version** (e.g., 1.2.0): Only changes when SDK API changes (stable)
 *
 * This allows the CLI to evolve rapidly without implying SDK breaking changes.
 *
 * @packageDocumentation
 */

/**
 * CLI tool version (from package.json)
 *
 * This is the version of the AX CLI command-line tool.
 * Changes frequently with CLI features, commands, and UI improvements.
 *
 * **Use this for:**
 * - Reporting CLI version to users
 * - Checking CLI compatibility
 * - Debugging CLI-specific issues
 *
 * **IMPORTANT**: Keep this in sync with package.json version!
 * TODO: Consider reading from package.json at build time
 */
export const CLI_VERSION = '4.1.14';

/**
 * SDK library version (semantic versioning for API stability)
 *
 * This is the version of the programmatic SDK API.
 * Only changes when SDK API changes (follows semantic versioning strictly).
 *
 * **Versioning rules:**
 * - **Major (x.0.0)**: Breaking changes to SDK API
 * - **Minor (1.x.0)**: New SDK features, backward compatible
 * - **Patch (1.2.x)**: Bug fixes only
 *
 * **Use this for:**
 * - npm dependency management
 * - Checking SDK API compatibility
 * - Version locking in package.json
 *
 * **Version history:**
 * - 1.0.0: Initial SDK release (SDK best practices)
 * - 1.1.0: Progress reporting, unified logging
 * - 1.2.0: MCP v2 API, lifecycle hooks, tool registry
 * - 1.3.0: Z.AI MCP integration (web search, web reader, vision)
 * - 1.4.0: Multi-provider support (ProviderContext, createGLMAgent, createGrokAgent, file locking)
 */
export const SDK_VERSION = '1.4.0';

/**
 * SDK API version (integer for major version tracking)
 *
 * This is incremented only for breaking changes to the SDK API.
 * Patch and minor versions keep the same API_VERSION.
 *
 * **Use this for:**
 * - Quick compatibility checks
 * - API feature detection
 *
 * **Version history:**
 * - 1: Initial SDK release (v1.0.0+)
 * - 2: (Reserved for future breaking changes)
 */
export const SDK_API_VERSION = 1;

/**
 * Get CLI version string
 *
 * @returns CLI version string in format "v{version}"
 *
 * @example
 * ```typescript
 * import { getCLIVersion } from '@defai.digital/ax-cli/sdk';
 *
 * console.log('CLI:', getCLIVersion());
 * // Output: "CLI: v4.1.14"
 * ```
 */
export function getCLIVersion(): string {
  return `v${CLI_VERSION}`;
}

/**
 * Get SDK version string
 *
 * @returns SDK version string in format "v{version}"
 *
 * @example
 * ```typescript
 * import { getSDKVersion } from '@defai.digital/ax-cli/sdk';
 *
 * console.log('Using SDK:', getSDKVersion());
 * // Output: "Using SDK: v1.4.0"
 * ```
 */
export function getSDKVersion(): string {
  return `v${SDK_VERSION}`;
}

/**
 * Get full SDK info (recommended for debugging)
 *
 * @returns Object with complete version details
 *
 * @example
 * ```typescript
 * import { getSDKInfo } from '@defai.digital/ax-cli/sdk';
 *
 * const info = getSDKInfo();
 * console.log(info);
 * // Output: {
 * //   cliVersion: "4.1.14",
 * //   sdkVersion: "1.4.0",
 * //   apiVersion: 1,
 * //   cliVersionString: "v4.1.14",
 * //   sdkVersionString: "v1.4.0"
 * // }
 * ```
 */
export function getSDKInfo(): {
  /** CLI tool version (changes frequently) */
  cliVersion: string;
  /** SDK library version (stable) */
  sdkVersion: string;
  /** SDK API version (major version only) */
  apiVersion: number;
  /** CLI version with 'v' prefix */
  cliVersionString: string;
  /** SDK version with 'v' prefix */
  sdkVersionString: string;
} {
  return {
    cliVersion: CLI_VERSION,
    sdkVersion: SDK_VERSION,
    apiVersion: SDK_API_VERSION,
    cliVersionString: `v${CLI_VERSION}`,
    sdkVersionString: `v${SDK_VERSION}`,
  };
}

/**
 * Get version info formatted for display
 *
 * @returns Human-readable version string
 *
 * @example
 * ```typescript
 * import { getVersionString } from '@defai.digital/ax-cli/sdk';
 *
 * console.log(getVersionString());
 * // Output: "AX CLI v4.1.14 (SDK v1.4.0)"
 * ```
 */
export function getVersionString(): string {
  return `AX CLI v${CLI_VERSION} (SDK v${SDK_VERSION})`;
}

/**
 * Check if SDK version is compatible with minimum required version
 *
 * @param minVersion - Minimum SDK version required (e.g., "1.1.0")
 * @returns True if current SDK version is >= minimum version
 *
 * @throws Error if minVersion is not a valid semantic version string
 *
 * @example
 * ```typescript
 * import { isSDKVersionCompatible } from '@defai.digital/ax-cli/sdk';
 *
 * if (!isSDKVersionCompatible('1.1.0')) {
 *   throw new Error('SDK v1.1.0+ required');
 * }
 * ```
 */
export function isSDKVersionCompatible(minVersion: string): boolean {
  // Validate version string format before parsing
  if (typeof minVersion !== 'string' || !minVersion.trim()) {
    throw new Error(`Invalid version string: "${minVersion}"`);
  }

  // Remove leading 'v' if present (e.g., "v1.2.3" -> "1.2.3")
  const normalizedVersion = minVersion.trim().replace(/^v/i, '');

  // Split and validate version parts
  const parts = normalizedVersion.split('.');

  // Warn about non-standard version formats (more or less than 3 parts)
  if (parts.length > 3) {
    console.warn(`[AX SDK] Version "${minVersion}" has more than 3 parts; extra parts will be ignored`);
  }

  const [minMajorStr, minMinorStr = '0', minPatchStr = '0'] = parts;
  const minMajor = parseInt(minMajorStr, 10);
  const minMinor = parseInt(minMinorStr, 10);
  const minPatch = parseInt(minPatchStr, 10);

  // Check for NaN (invalid number in version string)
  if (isNaN(minMajor) || isNaN(minMinor) || isNaN(minPatch)) {
    throw new Error(`Invalid version format: "${minVersion}" (must be semantic version like "1.2.3")`);
  }

  // Validate version numbers are non-negative
  if (minMajor < 0 || minMinor < 0 || minPatch < 0) {
    throw new Error(`Invalid version format: "${minVersion}" (version numbers cannot be negative)`);
  }

  const [curMajor, curMinor = 0, curPatch = 0] = SDK_VERSION.split('.').map(Number);

  // Major version comparison
  if (curMajor > minMajor) return true;
  if (curMajor < minMajor) return false;

  // Minor version comparison
  if (curMinor > minMinor) return true;
  if (curMinor < minMinor) return false;

  // Patch version comparison
  return curPatch >= minPatch;
}
