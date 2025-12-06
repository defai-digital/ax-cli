import { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import { ConsoleMessenger } from '../utils/console-messenger.js';

const execAsync = promisify(exec);

// BUG FIX: ESM-compatible __dirname (was causing ReferenceError)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * VSCode Extension Information
 */
const EXTENSION_ID = 'defai-digital.ax-cli-vscode';
const VSIX_BASENAME = 'ax-cli-vscode';
// Fallback if we can't discover the VSIX dynamically (kept in sync with vscode-extension/package.json)
const DEFAULT_VSIX = 'ax-cli-vscode-0.3.1.vsix';

/**
 * Detect if VSCode is installed
 */
async function isVSCodeInstalled(): Promise<boolean> {
  try {
    // Try 'code' command
    await execAsync('code --version');
    return true;
  } catch {
    try {
      // Try alternative paths on macOS
      await execAsync('/usr/local/bin/code --version');
      return true;
    } catch {
      try {
        // Try VSCodium
        await execAsync('codium --version');
        return true;
      } catch {
        return false;
      }
    }
  }
}

/**
 * Get the code command (code, codium, or full path)
 */
async function getCodeCommand(): Promise<string> {
  try {
    await execAsync('code --version');
    return 'code';
  } catch {
    try {
      await execAsync('/usr/local/bin/code --version');
      return '/usr/local/bin/code';
    } catch {
      try {
        await execAsync('codium --version');
        return 'codium';
      } catch {
        throw new Error('VSCode command not found');
      }
    }
  }
}

/**
 * Check if AX CLI extension is installed
 */
async function isExtensionInstalled(): Promise<boolean> {
  try {
    const codeCmd = await getCodeCommand();
    const { stdout } = await execAsync(`${codeCmd} --list-extensions`);
    return stdout.includes(EXTENSION_ID);
  } catch {
    return false;
  }
}

/**
 * Get extension version if installed
 */
async function getInstalledVersion(): Promise<string | null> {
  try {
    const codeCmd = await getCodeCommand();
    const { stdout } = await execAsync(`${codeCmd} --list-extensions --show-versions`);
    const lines = stdout.split('\n');
    const extensionLine = lines.find(line => line.startsWith(EXTENSION_ID));
    if (extensionLine) {
      const match = extensionLine.match(/@(.+)$/);
      return match ? match[1] : null;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Find the VSIX file in the vscode-extension directory
 */
async function findVSIXFile(): Promise<string | null> {
  try {
    // Check in the vscode-extension directory relative to the package
    const candidateDirs = [
      // Development: relative to src/commands/
      path.resolve(__dirname, '../../vscode-extension'),
      // Installed package: in node_modules
      path.resolve(__dirname, '../../../vscode-extension'),
      // Alternative: check parent directory (monorepo/workspace)
      path.resolve(__dirname, '../../../../vscode-extension'),
    ];

    const foundPaths: string[] = [];

    for (const dir of candidateDirs) {
      // Always check the default VSIX name first (fast path)
      const defaultVsixPath = path.join(dir, DEFAULT_VSIX);
      try {
        await fs.access(defaultVsixPath);
        foundPaths.push(defaultVsixPath);
      } catch {
        // Ignore and continue searching for any versioned VSIX
      }

      try {
        const entries = await fs.readdir(dir);
        for (const entry of entries) {
          if (
            entry.startsWith(`${VSIX_BASENAME}-`) &&
            entry.endsWith('.vsix')
          ) {
            foundPaths.push(path.join(dir, entry));
          }
        }
      } catch {
        // Directory might not exist in this installation layout
      }
    }

    // Deduplicate and pick the highest semver we can find
    const uniquePaths = Array.from(new Set(foundPaths));
    if (uniquePaths.length === 0) {
      return null;
    }

    const extractVersion = (filePath: string): string | null => {
      const match = path.basename(filePath).match(/ax-cli-vscode-(\d+\.\d+\.\d+)\.vsix$/);
      return match ? match[1] : null;
    };

    const compareSemverDesc = (a: string, b: string): number => {
      const vA = extractVersion(a);
      const vB = extractVersion(b);

      if (vA && vB) {
        const partsA = vA.split('.').map(Number);
        const partsB = vB.split('.').map(Number);
        const len = Math.max(partsA.length, partsB.length);
        for (let i = 0; i < len; i++) {
          const diff = (partsB[i] || 0) - (partsA[i] || 0);
          if (diff !== 0) return diff;
        }
        return 0;
      }

      // Prefer the one with a version
      if (vA && !vB) return -1;
      if (!vA && vB) return 1;

      // Stable fallback comparison
      return path.basename(a).localeCompare(path.basename(b));
    };

    return uniquePaths.sort(compareSemverDesc)[0] ?? null;
  } catch {
    return null;
  }
}

/**
 * Install the VSIX extension
 */
async function installExtension(vsixPath: string): Promise<void> {
  const codeCmd = await getCodeCommand();
  await execAsync(`${codeCmd} --install-extension "${vsixPath}"`);
}

/**
 * Uninstall the extension
 */
async function uninstallExtension(): Promise<void> {
  const codeCmd = await getCodeCommand();
  await execAsync(`${codeCmd} --uninstall-extension ${EXTENSION_ID}`);
}

/**
 * Create the vscode command
 *
 * Manages VSCode extension installation and status
 */
export function createVSCodeCommand(): Command {
  const vscodeCommand = new Command('vscode');
  vscodeCommand.description('Manage AX CLI VSCode extension');

  // Check extension status
  vscodeCommand
    .command('status')
    .description('Check VSCode extension installation status')
    .action(async () => {
      try {
        console.log();
        console.log(chalk.bold.blue('📊 VSCode Extension Status'));
        console.log(chalk.gray('─'.repeat(60)));
        console.log();

        // Check VSCode installation
        const vscodeInstalled = await isVSCodeInstalled();
        if (!vscodeInstalled) {
          console.log(chalk.red('✗ VSCode not found'));
          console.log();
          console.log(chalk.gray('💡 Install VSCode from:'));
          console.log(chalk.gray('   https://code.visualstudio.com/'));
          console.log();
          return;
        }

        const codeCmd = await getCodeCommand();
        console.log(chalk.green(`✓ VSCode installed (${codeCmd})`));

        // Check extension installation
        const extensionInstalled = await isExtensionInstalled();
        if (!extensionInstalled) {
          console.log(chalk.yellow('○ AX CLI extension not installed'));
          console.log();
          console.log(chalk.gray('💡 Install with:'));
          console.log(chalk.gray('   ax-cli vscode install'));
          console.log();
          return;
        }

        const version = await getInstalledVersion();
        console.log(chalk.green(`✓ AX CLI extension installed${version ? ` (v${version})` : ''}`));
        console.log();

        // Check for VSIX file
        const vsixPath = await findVSIXFile();
        if (vsixPath) {
          console.log(chalk.gray(`📦 VSIX file available: ${vsixPath}`));
        } else {
          console.log(chalk.yellow('⚠️  VSIX file not found (reinstall may not be available)'));
        }

        console.log();
        console.log(chalk.gray('💡 Commands:'));
        console.log(chalk.gray('   ax-cli vscode install    - Install/update extension'));
        console.log(chalk.gray('   ax-cli vscode uninstall  - Remove extension'));
        console.log();

      } catch (error: any) {
        ConsoleMessenger.error('vscode_commands.error_checking_status', { error: error.message });
        process.exit(1);
      }
    });

  // Install extension
  vscodeCommand
    .command('install')
    .description('Install or update the AX CLI VSCode extension')
    .option('-f, --force', 'Force reinstall even if already installed')
    .action(async (options) => {
      try {
        console.log();
        console.log(chalk.bold.blue('📦 Installing AX CLI VSCode Extension'));
        console.log(chalk.gray('─'.repeat(60)));
        console.log();

        // Check VSCode installation
        const vscodeInstalled = await isVSCodeInstalled();
        if (!vscodeInstalled) {
          console.log(chalk.red('✗ VSCode not found'));
          console.log();
          console.log(chalk.gray('💡 Please install VSCode first:'));
          console.log(chalk.gray('   https://code.visualstudio.com/'));
          console.log();
          process.exit(1);
        }

        const codeCmd = await getCodeCommand();
        console.log(chalk.green(`✓ VSCode found (${codeCmd})`));

        // Check if already installed
        if (!options.force) {
          const extensionInstalled = await isExtensionInstalled();
          if (extensionInstalled) {
            const version = await getInstalledVersion();
            console.log(chalk.yellow(`○ Extension already installed${version ? ` (v${version})` : ''}`));
            console.log();
            console.log(chalk.gray('💡 Use --force to reinstall'));
            console.log();
            return;
          }
        }

        // Find VSIX file
        const vsixPath = await findVSIXFile();
        if (!vsixPath) {
          console.log(chalk.red('✗ VSIX file not found'));
          console.log();
          console.log(chalk.gray('Expected locations:'));
          console.log(chalk.gray(`   ./vscode-extension/${DEFAULT_VSIX}`));
          console.log(chalk.gray(`   ../vscode-extension/${DEFAULT_VSIX}`));
          console.log();
          console.log(chalk.gray('💡 Build the extension first:'));
          console.log(chalk.gray('   cd vscode-extension'));
          console.log(chalk.gray('   npm run package:vsix'));
          console.log(chalk.gray(`   # Expected file pattern: ${VSIX_BASENAME}-<version>.vsix`));
          console.log();
          process.exit(1);
        }

        console.log(chalk.green(`✓ VSIX file found: ${path.basename(vsixPath)}`));
        console.log();

        // Uninstall if forcing
        if (options.force) {
          const extensionInstalled = await isExtensionInstalled();
          if (extensionInstalled) {
            console.log(chalk.yellow('○ Uninstalling previous version...'));
            await uninstallExtension();
            console.log(chalk.green('✓ Previous version uninstalled'));
          }
        }

        // Install extension
        console.log(chalk.yellow('○ Installing extension...'));
        await installExtension(vsixPath);
        console.log(chalk.green('✓ Extension installed successfully!'));
        console.log();

        console.log(chalk.bold.green('🎉 AX CLI VSCode Extension Ready!'));
        console.log();
        console.log(chalk.gray('Next steps:'));
        console.log(chalk.gray('  1. Reload VSCode if it\'s already open'));
        console.log(chalk.gray('  2. Press Cmd+Shift+A (Mac) or Ctrl+Shift+A (Windows/Linux)'));
        console.log(chalk.gray('  3. Start chatting with AX CLI!'));
        console.log();

      } catch (error: any) {
        ConsoleMessenger.error('vscode_commands.error_installing', { error: error.message });
        process.exit(1);
      }
    });

  // Uninstall extension
  vscodeCommand
    .command('uninstall')
    .description('Uninstall the AX CLI VSCode extension')
    .action(async () => {
      try {
        console.log();
        console.log(chalk.bold.yellow('🗑️  Uninstalling AX CLI VSCode Extension'));
        console.log(chalk.gray('─'.repeat(60)));
        console.log();

        // Check VSCode installation
        const vscodeInstalled = await isVSCodeInstalled();
        if (!vscodeInstalled) {
          console.log(chalk.yellow('○ VSCode not found'));
          console.log();
          return;
        }

        // Check if extension is installed
        const extensionInstalled = await isExtensionInstalled();
        if (!extensionInstalled) {
          console.log(chalk.yellow('○ Extension not installed'));
          console.log();
          return;
        }

        // Uninstall
        console.log(chalk.yellow('○ Uninstalling extension...'));
        await uninstallExtension();
        console.log(chalk.green('✓ Extension uninstalled successfully'));
        console.log();

      } catch (error: any) {
        ConsoleMessenger.error('vscode_commands.error_uninstalling', { error: error.message });
        process.exit(1);
      }
    });

  // Auto-install command (silent, for startup check)
  vscodeCommand
    .command('auto-install')
    .description('Automatically install extension if VSCode is detected (silent)')
    .option('--check-only', 'Only check, don\'t install')
    .action(async (options) => {
      try {
        // Silent check - only show output if action needed
        const vscodeInstalled = await isVSCodeInstalled();
        if (!vscodeInstalled) {
          // VSCode not installed, skip silently
          return;
        }

        const extensionInstalled = await isExtensionInstalled();
        if (extensionInstalled) {
          // Already installed, skip silently
          return;
        }

        if (options.checkOnly) {
          // Just checking, report status
          console.log(chalk.yellow('AX CLI VSCode extension not installed'));
          console.log(chalk.gray('Run: ax-cli vscode install'));
          return;
        }

        // Try to auto-install
        const vsixPath = await findVSIXFile();
        if (!vsixPath) {
          // VSIX not available, skip silently
          return;
        }

        console.log();
        console.log(chalk.blue('📦 Installing AX CLI VSCode extension...'));
        await installExtension(vsixPath);
        console.log(chalk.green('✓ Extension installed! Reload VSCode to activate.'));
        console.log();

      } catch {
        // Silent failure - don't interrupt CLI startup
        // User can manually install with 'ax-cli vscode install'
      }
    });

  // Default action (show status)
  vscodeCommand.action(async () => {
    await vscodeCommand.commands.find(cmd => cmd.name() === 'status')?.parseAsync(['node', 'ax', 'vscode', 'status'], { from: 'user' });
  });

  return vscodeCommand;
}
