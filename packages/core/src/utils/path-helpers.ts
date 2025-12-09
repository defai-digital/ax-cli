import * as path from 'path';
import * as fs from 'fs';
import { getActiveConfigPaths } from '../provider/config.js';

/**
 * Resolve the base directory for AX CLI user data.
 *
 * - Honors AX_CLI_HOME when set (useful for tests and sandboxed environments)
 * - Defaults to ~/.ax-glm or ~/.ax-grok (provider-specific) to preserve existing behavior
 * - Falls back to <cwd>/.ax-glm or <cwd>/.ax-grok when the home directory is not writable
 */
export function getAxBaseDir(): string {
  const override = process.env.AX_CLI_HOME;
  if (override && override.trim().length > 0) {
    return path.resolve(override);
  }

  // Use provider-specific user directory
  const configPaths = getActiveConfigPaths();
  const defaultDir = configPaths.USER_DIR;

  // If defaultDir is writable, use it
  try {
    fs.accessSync(defaultDir, fs.constants.W_OK);
    return defaultDir;
  } catch {
    // Fallback to workspace-local directory to avoid EPERM in sandboxed environments
    const fallbackDir = configPaths.PROJECT_DIR;
    try {
      fs.mkdirSync(fallbackDir, { recursive: true });
    } catch {
      // Ignore mkdir errors - final write attempts will surface meaningful errors
    }
    return fallbackDir;
  }
}
