/**
 * Onboarding Manager - First-run detection and state management
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { fileURLToPath } from 'url';
import { parseJsonFile } from './json-utils.js';
import { CONFIG_DIR_NAME } from '../constants.js';

export interface OnboardingState {
  isFirstRun: boolean;
  setupCompleted: boolean;
  completedAt?: string;
  version: string;
}

export class OnboardingManager {
  private static readonly FIRST_RUN_MARKER = '.first-run-complete';
  private static readonly USER_CONFIG_DIR = CONFIG_DIR_NAME;

  /**
   * Get the user's AX CLI configuration directory
   */
  private static getUserConfigDir(): string {
    return path.join(os.homedir(), OnboardingManager.USER_CONFIG_DIR);
  }

  /**
   * Get the path to the first-run marker file
   */
  private static getMarkerPath(): string {
    return path.join(
      OnboardingManager.getUserConfigDir(),
      OnboardingManager.FIRST_RUN_MARKER
    );
  }

  /**
   * Detect if this is the user's first run of AX CLI
   */
  static detectFirstRun(): boolean {
    const markerPath = OnboardingManager.getMarkerPath();
    return !fs.existsSync(markerPath);
  }

  /**
   * Mark onboarding as completed
   */
  static markCompleted(): void {
    const configDir = OnboardingManager.getUserConfigDir();
    const markerPath = OnboardingManager.getMarkerPath();

    // Create config directory if it doesn't exist
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    // Create marker file with timestamp
    const state: OnboardingState = {
      isFirstRun: false,
      setupCompleted: true,
      completedAt: new Date().toISOString(),
      version: this.getVersion(),
    };

    // Atomic write using temp file
    const tmpPath = `${markerPath}.tmp`;
    try {
      fs.writeFileSync(tmpPath, JSON.stringify(state, null, 2), 'utf-8');
      fs.renameSync(tmpPath, markerPath); // Atomic on POSIX systems
    } catch (error) {
      // Cleanup temp file on error
      if (fs.existsSync(tmpPath)) {
        try {
          fs.unlinkSync(tmpPath);
        } catch {
          // Ignore cleanup errors
        }
      }
      throw error;
    }
  }

  /**
   * Get current onboarding state
   */
  static getCurrentState(): OnboardingState {
    const markerPath = OnboardingManager.getMarkerPath();

    if (!fs.existsSync(markerPath)) {
      return {
        isFirstRun: true,
        setupCompleted: false,
        version: this.getVersion(),
      };
    }

    const parseResult = parseJsonFile<OnboardingState>(markerPath);
    if (!parseResult.success) {
      // If marker file is corrupted, treat as first run
      return {
        isFirstRun: true,
        setupCompleted: false,
        version: this.getVersion(),
      };
    }

    return parseResult.data;
  }

  /**
   * Reset onboarding state (useful for testing)
   */
  static resetOnboarding(): void {
    const markerPath = OnboardingManager.getMarkerPath();
    if (fs.existsSync(markerPath)) {
      fs.unlinkSync(markerPath);
    }
  }

  /**
   * Check if welcome screen should be shown
   */
  static shouldShowWelcome(): boolean {
    return OnboardingManager.detectFirstRun();
  }

  /**
   * Get current CLI version
   */
  private static getVersion(): string {
    try {
      // Use import.meta.url to find the actual CLI installation path
      const currentModulePath = fileURLToPath(import.meta.url);
      const cliRootPath = path.join(path.dirname(currentModulePath), '../..');
      const packageJsonPath = path.join(cliRootPath, 'package.json');

      if (fs.existsSync(packageJsonPath)) {
        const parseResult = parseJsonFile(packageJsonPath);
        if (parseResult.success) {
          const pkg = parseResult.data as any;
          if (pkg && typeof pkg === 'object' && 'version' in pkg && typeof pkg.version === 'string') {
            return pkg.version;
          }
        }
      }
    } catch {
      // Ignore errors
    }
    return '0.0.0';
  }
}
