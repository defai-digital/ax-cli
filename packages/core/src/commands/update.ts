import { Command } from "commander";
import { exec, execSync, spawnSync } from "child_process";
import { promisify } from "util";
import chalk from "chalk";
import { createInterface } from "readline";
import { parseJson } from "../utils/json-utils.js";
import { equalsIgnoreCase } from "../utils/string-utils.js";
import { getSettingsManager } from "../utils/settings-manager.js";
import type { ProviderDefinition } from "../provider/config.js";

const execAsync = promisify(exec);

export const PACKAGE_NAME = "@defai.digital/ax-cli";

/**
 * Get package name for a provider
 */
function getProviderPackageName(provider?: ProviderDefinition): string {
  if (!provider) return PACKAGE_NAME;

  switch (provider.name) {
    case 'glm':
      return '@defai.digital/ax-glm';
    case 'grok':
      return '@defai.digital/ax-grok';
    default:
      return PACKAGE_NAME;
  }
}

/**
 * Check if AutomatosX (ax) is installed globally
 */
function isAutomatosXInstalled(): boolean {
  try {
    const result = spawnSync('ax', ['--version'], {
      encoding: 'utf-8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    return result.status === 0;
  } catch {
    return false;
  }
}

/**
 * Update AutomatosX to the latest version
 */
async function updateAutomatosX(): Promise<boolean> {
  try {
    execSync('ax update -y', {
      stdio: 'inherit',
      timeout: 120000 // 2 minute timeout
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get current installed version
 * @param packageName - Optional package name (defaults to PACKAGE_NAME)
 */
export async function getCurrentVersion(packageName: string = PACKAGE_NAME): Promise<string> {
  try {
    // Try to get from npm global installation
    const { stdout } = await execAsync(
      `npm list -g ${packageName} --depth=0 --json`,
      { timeout: 10000 } // 10 second timeout
    );

    // Use json-utils for safe parsing
    const parseResult = parseJson<{
      dependencies?: { [key: string]: { version?: string } };
    }>(stdout);

    if (!parseResult.success) {
      // JSON parse failed, fallback
      return "unknown";
    }

    return parseResult.data.dependencies?.[packageName]?.version || "unknown";
  } catch {
    // Fallback to package.json
    try {
      const { readFile } = await import("fs/promises");
      const { dirname, join } = await import("path");
      const { fileURLToPath } = await import("url");

      const __filename = fileURLToPath(import.meta.url);
      const __dirname = dirname(__filename);
      const pkgPath = join(__dirname, "../../package.json");

      const content = await readFile(pkgPath, "utf-8");

      // Use json-utils for safe parsing
      const parseResult = parseJson<{ version?: string }>(content);
      if (!parseResult.success) {
        return "unknown";
      }

      return parseResult.data.version || "unknown";
    } catch {
      return "unknown";
    }
  }
}

/**
 * Get latest version from npm registry
 * Timeout after 10 seconds to avoid blocking CLI startup
 * @param packageName - Optional package name (defaults to PACKAGE_NAME)
 */
export async function getLatestVersion(packageName: string = PACKAGE_NAME): Promise<string> {
  const { stdout } = await execAsync(`npm view ${packageName} version`, {
    timeout: 10000, // 10 second timeout
  });
  const version = stdout.trim();
  return version || "unknown";
}

/**
 * Check if version a is newer than version b
 * Handles versions like "5.7.0-beta.1" correctly
 */
export function isNewer(a: string, b: string): boolean {
  const parseVersion = (v: string): number[] => {
    const version = v.split("-")[0] || v; // Strip prerelease metadata
    const cleanVersion = version.startsWith('v') ? version.substring(1) : version;
    const parts = cleanVersion.split(".").map(Number);

    // Validate all parts are valid numbers
    if (parts.some(isNaN)) {
      throw new Error(`Invalid version format: ${v}`);
    }

    return parts;
  };

  const [aMajor = 0, aMinor = 0, aPatch = 0] = parseVersion(a);
  const [bMajor = 0, bMinor = 0, bPatch = 0] = parseVersion(b);

  return aMajor !== bMajor ? aMajor > bMajor
       : aMinor !== bMinor ? aMinor > bMinor
       : aPatch > bPatch;
}

/**
 * Show changelog from GitHub releases
 */
async function showChangelog(_from: string, to: string): Promise<void> {
  try {
    console.log(chalk.cyan("\nWhat's new:\n"));

    // Fetch changelog from GitHub releases
    const { stdout } = await execAsync(
      `curl -s https://api.github.com/repos/defai-digital/ax-cli/releases/tags/v${to}`
    );

    // Use json-utils for safe parsing
    const parseResult = parseJson<{ body?: string }>(stdout);

    if (!parseResult.success) {
      // JSON parse failed
      throw new Error('Failed to parse GitHub API response');
    }

    const release = parseResult.data;

    if (release.body) {
      // Parse and display first few lines
      const lines = release.body.split("\n").slice(0, 10);
      lines.forEach((line: string) => {
        if (line.startsWith("#")) {
          console.log(chalk.bold(line));
        } else if (line.trim()) {
          console.log(chalk.gray(line));
        }
      });
      console.log(chalk.gray("\n..."));
      console.log(
        chalk.gray(
          `Full changelog: https://github.com/defai-digital/ax-cli/releases/tag/v${to}`
        )
      );
    }
  } catch {
    // If changelog fetch fails, continue silently
    console.log(
      chalk.gray(
        `\nView changelog: https://github.com/defai-digital/ax-cli/releases/tag/v${to}`
      )
    );
  }
}

/**
 * Install update
 * @param version - Version to install
 * @param packageName - Optional package name (defaults to PACKAGE_NAME)
 */
export async function installUpdate(version: string, packageName: string = PACKAGE_NAME): Promise<void> {
  try {
    const { stderr } = await execAsync(
      `npm install -g ${packageName}@${version}`,
      { maxBuffer: 10 * 1024 * 1024 } // Increase buffer for large outputs
    );

    if (stderr && !stderr.includes("npm warn")) {
      console.warn(chalk.yellow("Update installation warnings:"), stderr);
    }
  } catch (error) {
    throw new Error(
      `Failed to install update: ${(error as Error).message}`
    );
  }
}

/**
 * Prompt user for confirmation
 */
async function promptConfirm(message: string): Promise<boolean> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    return await new Promise<boolean>((resolve) => {
      rl.question(chalk.yellow(message), (answer) => {
        resolve(
          equalsIgnoreCase(answer, "y") || equalsIgnoreCase(answer, "yes")
        );
      });
    });
  } finally {
    rl.close();
  }
}

/**
 * Create update command
 * @param provider - Optional provider definition for provider-specific updates
 */
export function createUpdateCommand(provider?: ProviderDefinition): Command {
  const updateCmd = new Command("update");
  const packageName = getProviderPackageName(provider);
  const cliName = provider?.branding.cliName || 'ax-cli';
  const displayName = cliName.toUpperCase();

  updateCmd
    .description(`Check for updates and upgrade ${displayName} to the latest version`)
    .option(
      "-c, --check",
      "Only check for updates without installing",
      false
    )
    .option("-y, --yes", "Skip confirmation prompt", false)
    .action(async (options) => {
      console.log(chalk.blue.bold(`\n🔄 ${displayName} Update Checker\n`));

      try {
        // 1. Get current version
        const currentVersion = await getCurrentVersion(packageName);
        console.log(chalk.gray(`Current version: ${currentVersion}`));

        // 2. Check for latest version
        console.log(chalk.cyan("Checking for updates..."));
        const latestVersion = await getLatestVersion(packageName);
        console.log(chalk.gray(`Latest version:  ${latestVersion}\n`));

        // 3. Compare versions
        if (currentVersion === latestVersion) {
          console.log(
            chalk.green("✅ You are already running the latest version!\n")
          );
          return;
        }

        if (isNewer(latestVersion, currentVersion)) {
          console.log(
            chalk.yellow(
              `📦 New version available: ${currentVersion} → ${latestVersion}`
            )
          );

          // 4. Show changelog
          await showChangelog(currentVersion, latestVersion);

          // 5. If only checking, exit here
          if (options.check) {
            console.log(chalk.gray("\nTo install the update, run:"));
            console.log(
              chalk.cyan(
                `  npm install -g ${packageName}@${latestVersion}\n`
              )
            );
            return;
          }

          // 6. Confirm update (unless --yes flag)
          if (!options.yes) {
            const confirmed = await promptConfirm(
              "Would you like to update now? (y/N) "
            );

            if (!confirmed) {
              console.log(chalk.gray("\nUpdate cancelled.\n"));
              return;
            }
          }

          // 7. Perform update
          console.log(chalk.cyan("\n📥 Installing update...\n"));
          await installUpdate(latestVersion, packageName);

          console.log(
            chalk.green.bold(`\n✅ ${displayName} updated successfully!\n`)
          );
          console.log(chalk.gray("New version:"), chalk.cyan(latestVersion));
          console.log(
            chalk.gray("\nRun"),
            chalk.cyan(`${cliName} --version`),
            chalk.gray("to verify.\n")
          );

          // 8. Update AutomatosX if installed
          if (isAutomatosXInstalled()) {
            console.log(chalk.blue("\n🔄 Updating AutomatosX...\n"));
            const axUpdated = await updateAutomatosX();
            if (axUpdated) {
              console.log(chalk.green("✅ AutomatosX updated successfully!\n"));
            } else {
              console.log(chalk.yellow("⚠️  AutomatosX update failed. You can try manually: ax update -y\n"));
            }
          }
        } else {
          console.log(
            chalk.yellow(
              `⚠️  Your version (${currentVersion}) is newer than published (${latestVersion})\n`
            )
          );
        }
      } catch (error) {
        console.error(
          chalk.red("\n❌ Error checking for updates:"),
          (error as Error).message
        );
        process.exit(1);
      }
    });

  return updateCmd;
}

/**
 * Result of a startup update check
 */
export interface StartupUpdateCheckResult {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  skipped: boolean;
  error?: string;
}

/**
 * Check for updates on startup (non-blocking, respects user settings)
 * This function is designed to be called during CLI startup and will:
 * 1. Check if auto-update is enabled in settings
 * 2. Check if enough time has passed since last check
 * 3. If an update is available, prompt the user
 *
 * @returns Promise<StartupUpdateCheckResult> - The result of the check
 */
export async function checkForUpdatesOnStartup(): Promise<StartupUpdateCheckResult> {
  const manager = getSettingsManager();

  // Check if we should perform an update check
  if (!manager.shouldCheckForUpdates()) {
    return {
      hasUpdate: false,
      currentVersion: "unknown",
      latestVersion: "unknown",
      skipped: true,
    };
  }

  try {
    // Get versions
    const currentVersion = await getCurrentVersion();
    const latestVersion = await getLatestVersion();

    // Record that we checked
    manager.recordUpdateCheck();

    // Skip comparison if either version is unknown
    if (currentVersion === "unknown" || latestVersion === "unknown") {
      return {
        hasUpdate: false,
        currentVersion,
        latestVersion,
        skipped: true,
      };
    }

    // Compare versions
    if (currentVersion !== latestVersion && isNewer(latestVersion, currentVersion)) {
      return {
        hasUpdate: true,
        currentVersion,
        latestVersion,
        skipped: false,
      };
    }

    return {
      hasUpdate: false,
      currentVersion,
      latestVersion,
      skipped: false,
    };
  } catch (error) {
    // Don't fail startup if update check fails
    return {
      hasUpdate: false,
      currentVersion: "unknown",
      latestVersion: "unknown",
      skipped: true,
      error: (error as Error).message,
    };
  }
}

/**
 * Prompt user to update and install if they accept
 * @param currentVersion Current installed version
 * @param latestVersion Latest available version
 * @param cliName CLI name for display in messages (default: "ax-cli")
 * @returns true if update was installed, false otherwise
 */
export async function promptAndInstallUpdate(
  currentVersion: string,
  latestVersion: string,
  cliName: string = "ax-cli"
): Promise<boolean> {
  console.log(
    chalk.yellow(
      `\n📦 Update available: ${currentVersion} → ${latestVersion}`
    )
  );

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise<boolean>((resolve) => {
    // Handle Ctrl+C or stream close
    rl.on("close", () => {
      resolve(false);
    });

    rl.question(
      chalk.yellow("Would you like to update now? (y/N) "),
      async (answer) => {
        rl.close();

        if (equalsIgnoreCase(answer, "y") || equalsIgnoreCase(answer, "yes")) {
          try {
            console.log(chalk.cyan("\n📥 Installing update...\n"));
            await installUpdate(latestVersion);
            console.log(
              chalk.green.bold("✅ AX CLI updated successfully!")
            );
            console.log(chalk.gray("New version:"), chalk.cyan(latestVersion));

            // Also update AutomatosX if installed
            if (isAutomatosXInstalled()) {
              console.log(chalk.blue("\n🔄 Updating AutomatosX...\n"));
              const axUpdated = await updateAutomatosX();
              if (axUpdated) {
                console.log(chalk.green("✅ AutomatosX updated successfully!"));
              } else {
                console.log(chalk.yellow("⚠️  AutomatosX update failed. You can try manually: ax update -y"));
              }
            }

            console.log(
              chalk.gray(`\nPlease restart ${cliName} to use the new version.\n`)
            );
            resolve(true);
          } catch (error) {
            console.error(
              chalk.red("❌ Failed to install update:"),
              (error as Error).message
            );
            console.log(
              chalk.gray("You can manually update with:"),
              chalk.cyan(`npm install -g ${PACKAGE_NAME}@${latestVersion}\n`)
            );
            resolve(false);
          }
        } else {
          console.log(chalk.gray("Update skipped.\n"));
          resolve(false);
        }
      }
    );
  });
}
