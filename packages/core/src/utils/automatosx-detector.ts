/**
 * AutomatosX Detector Utility
 *
 * Checks if AutomatosX CLI is installed and available in the system.
 */

import { findOnPath } from './path-helpers.js';

let cachedResult: boolean | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL = 60000; // 1 minute cache

/**
 * Check if AutomatosX (ax) command is available in the system
 * Results are cached for 1 minute to avoid excessive shell calls
 */
export async function isAutomatosXAvailable(): Promise<boolean> {
  const now = Date.now();

  // Return cached result if still valid
  if (cachedResult !== null && (now - cacheTimestamp) < CACHE_TTL) {
    return cachedResult;
  }

  // Check if 'ax' command exists using cross-platform findOnPath
  const axPath = await findOnPath('ax');
  const isAvailable = axPath !== null;

  // Update cache
  cachedResult = isAvailable;
  cacheTimestamp = now;

  return isAvailable;
}

/**
 * Synchronous check using cached value only
 * Returns false if no cached value exists
 */
export function isAutomatosXAvailableSync(): boolean {
  return cachedResult ?? false;
}

/**
 * Clear the cache to force a fresh check
 */
export function clearAutomatosXCache(): void {
  cachedResult = null;
  cacheTimestamp = 0;
}
