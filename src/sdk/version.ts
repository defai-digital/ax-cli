/**
 * SDK Version Information
 *
 * Provides version constants for the AX CLI SDK.
 * Useful for debugging, logging, and version compatibility checks.
 *
 * @packageDocumentation
 */

/**
 * Current SDK version
 *
 * This matches the package.json version and is updated automatically
 * during the release process.
 */
export const SDK_VERSION = '3.7.0';

/**
 * SDK API version
 *
 * This is incremented for breaking changes to the SDK API.
 * Patch and minor versions keep the same API_VERSION.
 *
 * Version history:
 * - 1: Initial SDK release (v3.6.0+)
 * - 2: (Reserved for future breaking changes)
 */
export const SDK_API_VERSION = 1;

/**
 * Get SDK version string
 *
 * @returns Version string in format "v{version}"
 *
 * @example
 * ```typescript
 * import { getSDKVersion } from '@defai.digital/ax-cli/sdk';
 *
 * console.log('Using SDK:', getSDKVersion());
 * // Output: "Using SDK: v3.7.0"
 * ```
 */
export function getSDKVersion(): string {
  return `v${SDK_VERSION}`;
}

/**
 * Get full SDK info
 *
 * @returns Object with version details
 *
 * @example
 * ```typescript
 * import { getSDKInfo } from '@defai.digital/ax-cli/sdk';
 *
 * const info = getSDKInfo();
 * console.log(info);
 * // Output: { version: "3.7.0", apiVersion: 1, versionString: "v3.7.0" }
 * ```
 */
export function getSDKInfo(): {
  version: string;
  apiVersion: number;
  versionString: string;
} {
  return {
    version: SDK_VERSION,
    apiVersion: SDK_API_VERSION,
    versionString: `v${SDK_VERSION}`,
  };
}
