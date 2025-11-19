import { Command } from "commander";
import { exec } from "child_process";
import { promisify } from "util";
import chalk from "chalk";
import { createInterface } from "readline";

const execAsync = promisify(exec);

const PACKAGE_NAME = "@defai.digital/ax-cli";

/**
 * Get current installed version
 */
async function getCurrentVersion(): Promise<string> {
  try {
    // Try to get from npm global installation
    const { stdout } = await execAsync(
      `npm list -g ${PACKAGE_NAME} --depth=0 --json`
    );
    try {
      const result = JSON.parse(stdout);
      return result.dependencies?.[PACKAGE_NAME]?.version || "unknown";
    } catch {
      // JSON parse failed, fallback
      return "unknown";
    }
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
      const pkg = JSON.parse(content);
      return pkg.version || "unknown";
    } catch {
      return "unknown";
    }
  }
}

/**
 * Get latest version from npm registry
 */
async function getLatestVersion(): Promise<string> {
  const { stdout } = await execAsync(`npm view ${PACKAGE_NAME} version`);
  return stdout.trim();
}

/**
 * Check if version a is newer than version b
 * Handles versions like "5.7.0-beta.1" correctly
 */
function isNewer(a: string, b: string): boolean {
  const parseVersion = (v: string): number[] => {
    const version = v.split("-")[0] || v; // Strip prerelease metadata
    return version.split(".").map(Number);
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

    try {
      const release = JSON.parse(stdout);

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
      // JSON parse failed
      throw new Error('Failed to parse GitHub API response');
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
 */
async function installUpdate(version: string): Promise<void> {
  try {
    const { stderr } = await execAsync(
      `npm install -g ${PACKAGE_NAME}@${version}`,
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

  return new Promise<boolean>((resolve) => {
    rl.question(chalk.yellow(message), (answer) => {
      rl.close();
      resolve(
        answer.toLowerCase() === "y" || answer.toLowerCase() === "yes"
      );
    });
  });
}

/**
 * Create update command
 */
export function createUpdateCommand(): Command {
  const updateCmd = new Command("update");

  updateCmd
    .description("Check for updates and upgrade AX CLI to the latest version")
    .option(
      "-c, --check",
      "Only check for updates without installing",
      false
    )
    .option("-y, --yes", "Skip confirmation prompt", false)
    .action(async (options) => {
      console.log(chalk.blue.bold("\n🔄 AX CLI Update Checker\n"));

      try {
        // 1. Get current version
        const currentVersion = await getCurrentVersion();
        console.log(chalk.gray(`Current version: ${currentVersion}`));

        // 2. Check for latest version
        console.log(chalk.cyan("Checking for updates..."));
        const latestVersion = await getLatestVersion();
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
                `  npm install -g ${PACKAGE_NAME}@${latestVersion}\n`
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
          await installUpdate(latestVersion);

          console.log(
            chalk.green.bold("\n✅ AX CLI updated successfully!\n")
          );
          console.log(chalk.gray("New version:"), chalk.cyan(latestVersion));
          console.log(
            chalk.gray("\nRun"),
            chalk.cyan("ax-cli --version"),
            chalk.gray("to verify.\n")
          );
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
