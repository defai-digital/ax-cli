import { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'fs/promises';
import * as path from 'path';
import { ConsoleMessenger } from '../utils/console-messenger.js';
import { CONFIG_PATHS } from '../constants.js';
import { extractErrorMessage } from '../utils/error-handler.js';
import { getPlanStorage } from '../planner/plan-storage.js';
import { PlanStatus } from '../planner/types.js';

async function readReportDirectory(outputDir: string): Promise<string[] | null> {
  try {
    return await fs.readdir(outputDir);
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

function printMissingReportDir(outputDir: string): void {
  console.log(chalk.yellow('No status reports found.'));
  console.log(chalk.gray(`Expected location: ${outputDir}`));
  console.log();
  console.log(chalk.gray('💡 Status reports are generated when:'));
  console.log(chalk.gray('   - A multi-phase plan completes'));
  console.log(chalk.gray('   - You run: ax status generate'));
  console.log();
}

/**
 * Create the status command
 *
 * Provides status reports and summaries for task execution
 */
export function createStatusCommand(): Command {
  const statusCommand = new Command('status');
  statusCommand.description('View task execution status and summaries');

  // Show latest status report
  statusCommand
    .command('show')
    .description('Show the latest status report')
    .option('-n, --count <number>', 'Number of reports to show', '1')
    .option('-j, --json', 'Output in JSON format')
    .action(async (options) => {
      try {
        const outputDir = CONFIG_PATHS.AUTOMATOSX_TMP;

        // Find all status reports
        const files = await readReportDirectory(outputDir);
        if (files === null) {
          printMissingReportDir(outputDir);
          return;
        }

        const statusFiles = files
          .filter(f => f.startsWith('status-') && f.endsWith('.md'))
          .sort()
          .reverse();

        if (statusFiles.length === 0) {
          printMissingReportDir(outputDir);
          return;
        }

        // BUG FIX: Validate parseInt result to prevent NaN causing empty slice
        const parsedCount = parseInt(options.count, 10);
        const count = Math.min(isNaN(parsedCount) ? 5 : parsedCount, statusFiles.length);
        const reportsToShow = statusFiles.slice(0, count);

        if (options.json) {
          const reports = await Promise.all(
            reportsToShow.map(async (file) => ({
              filename: file,
              path: path.join(outputDir, file),
              content: await fs.readFile(path.join(outputDir, file), 'utf-8')
            }))
          );
          console.log(JSON.stringify(reports, null, 2));
          return;
        }

        // Display in human-readable format
        for (const file of reportsToShow) {
          const filePath = path.join(outputDir, file);
          const content = await fs.readFile(filePath, 'utf-8');

          console.log();
          console.log(chalk.bold.blue('📊 Status Report'));
          console.log(chalk.gray('─'.repeat(60)));
          console.log(chalk.gray(`File: ${file}`));
          console.log(chalk.gray(`Path: ${filePath}`));
          console.log(chalk.gray('─'.repeat(60)));
          console.log();
          console.log(content);
          console.log();
        }

        if (statusFiles.length > count) {
          console.log(chalk.gray(`💡 ${statusFiles.length - count} more report(s) available.`));
          console.log(chalk.gray(`   Use: ax status show -n ${statusFiles.length} to see all`));
          console.log();
        }

      } catch (error: unknown) {
        ConsoleMessenger.error('status_commands.error_showing_status', { error: extractErrorMessage(error) });
        process.exit(1);
      }
    });

  // List all status reports and summaries
  statusCommand
    .command('list')
    .description('List all status reports and summaries')
    .option('-s, --summaries', 'Show summaries instead of status reports')
    .option('-a, --all', 'Show both status reports and summaries')
    .action(async (options) => {
      try {
        const outputDir = CONFIG_PATHS.AUTOMATOSX_TMP;

        // Find files
        const files = await readReportDirectory(outputDir);
        if (files === null) {
          printMissingReportDir(outputDir);
          return;
        }
        const statusFiles = files.filter(f => f.startsWith('status-') && f.endsWith('.md')).sort().reverse();
        const summaryFiles = files.filter(f => f.startsWith('summary-') && f.endsWith('.md')).sort().reverse();

        console.log();
        console.log(chalk.bold.blue('📊 Available Reports'));
        console.log(chalk.gray('─'.repeat(60)));
        console.log();

        if (options.all || !options.summaries) {
          console.log(chalk.bold('Status Reports:'));
          if (statusFiles.length === 0) {
            console.log(chalk.gray('  No status reports found'));
          } else {
            for (const file of statusFiles) {
              const stats = await fs.stat(path.join(outputDir, file));
              const timestamp = stats.mtime.toLocaleString();
              console.log(`  ${chalk.cyan(file)} ${chalk.gray(`(${timestamp})`)}`);
            }
          }
          console.log();
        }

        if (options.all || options.summaries) {
          console.log(chalk.bold('Context Summaries:'));
          if (summaryFiles.length === 0) {
            console.log(chalk.gray('  No summaries found'));
          } else {
            for (const file of summaryFiles) {
              const stats = await fs.stat(path.join(outputDir, file));
              const timestamp = stats.mtime.toLocaleString();
              console.log(`  ${chalk.cyan(file)} ${chalk.gray(`(${timestamp})`)}`);
            }
          }
          console.log();
        }

        console.log(chalk.gray('💡 View a report: ax status show'));
        console.log(chalk.gray('   View location: ' + outputDir));
        console.log();

      } catch (error: unknown) {
        ConsoleMessenger.error('status_commands.error_listing_reports', { error: extractErrorMessage(error) });
        process.exit(1);
      }
    });

  // Generate a status report on demand
  statusCommand
    .command('generate')
    .description('Generate a status report from current session')
    .action(async () => {
      try {
        console.log(chalk.yellow('⚠️  Status report generation requires an active agent session.'));
        console.log(chalk.gray('   This command is not yet implemented for on-demand generation.'));
        console.log();
        console.log(chalk.gray('💡 Status reports are automatically generated when:'));
        console.log(chalk.gray('   - A multi-phase plan completes successfully'));
        console.log(chalk.gray('   - Context window approaches limit (summaries)'));
        console.log();
        console.log(chalk.gray('   To view existing reports: ax status show'));
        console.log();
      } catch (error: unknown) {
        ConsoleMessenger.error('status_commands.error_generating_report', { error: extractErrorMessage(error) });
        process.exit(1);
      }
    });

  // Clean up old reports
  statusCommand
    .command('clean')
    .description('Clean up old status reports and summaries')
    .option('-d, --days <number>', 'Keep reports from last N days', '7')
    .option('-f, --force', 'Skip confirmation')
    .action(async (options) => {
      try {
        const outputDir = CONFIG_PATHS.AUTOMATOSX_TMP;
        // BUG FIX: Validate parseInt result to prevent Invalid Date in comparisons
        const parsedDays = parseInt(options.days, 10);
        const days = isNaN(parsedDays) || parsedDays < 0 ? 7 : parsedDays;
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);

        // Find files
        const files = await readReportDirectory(outputDir);
        if (files === null) {
          printMissingReportDir(outputDir);
          return;
        }
        const reportFiles = files.filter(f =>
          (f.startsWith('status-') || f.startsWith('summary-')) && f.endsWith('.md')
        );

        const filesToDelete: string[] = [];
        for (const file of reportFiles) {
          const filePath = path.join(outputDir, file);
          const stats = await fs.stat(filePath);
          if (stats.mtime < cutoffDate) {
            filesToDelete.push(file);
          }
        }

        if (filesToDelete.length === 0) {
          console.log(chalk.green('✓ No old reports to clean up'));
          console.log(chalk.gray(`  All reports are from the last ${days} day(s)`));
          console.log();
          return;
        }

        console.log();
        console.log(chalk.yellow(`⚠️  Found ${filesToDelete.length} report(s) older than ${days} day(s):`));
        console.log();
        for (const file of filesToDelete) {
          const stats = await fs.stat(path.join(outputDir, file));
          console.log(`  ${chalk.gray(file)} ${chalk.gray(`(${stats.mtime.toLocaleDateString()})`)}`);
        }
        console.log();

        if (!options.force) {
          console.log(chalk.yellow('Use --force to delete these files'));
          console.log();
          return;
        }

        // Delete files
        for (const file of filesToDelete) {
          await fs.unlink(path.join(outputDir, file));
        }

        console.log(chalk.green(`✓ Deleted ${filesToDelete.length} old report(s)`));
        console.log();

      } catch (error: unknown) {
        ConsoleMessenger.error('status_commands.error_cleaning_reports', { error: extractErrorMessage(error) });
        process.exit(1);
      }
    });

  // Manage plan sessions (view, clean stale sessions)
  const sessionsCmd = statusCommand
    .command('sessions')
    .description('View and manage plan sessions (fixes stale cached data)');

  // List all sessions
  sessionsCmd
    .command('list')
    .description('List all plan sessions')
    .option('-s, --stale', 'Show only stale sessions (older than 1 day)')
    .option('-r, --resumable', 'Show only resumable sessions')
    .option('-d, --days <number>', 'Days threshold for stale detection', '1')
    .action(async (options) => {
      try {
        const storage = getPlanStorage();
        const parsedDays = parseInt(options.days, 10);
        const staleDays = isNaN(parsedDays) || parsedDays < 0 ? 1 : parsedDays;

        let plans;
        let title;

        if (options.stale) {
          plans = await storage.listStalePlans(staleDays);
          title = `Stale Sessions (inactive > ${staleDays} day${staleDays === 1 ? '' : 's'})`;
        } else if (options.resumable) {
          plans = await storage.listResumablePlans();
          title = 'Resumable Sessions';
        } else {
          plans = await storage.listPlans();
          title = 'All Plan Sessions';
        }

        console.log();
        console.log(chalk.bold.blue(`📋 ${title}`));
        console.log(chalk.gray('─'.repeat(60)));
        console.log();

        if (plans.length === 0) {
          console.log(chalk.gray('  No sessions found.'));
          console.log();
          return;
        }

        for (const plan of plans) {
          const statusIcon = getStatusIcon(plan.status);
          const statusColor = getStatusColor(plan.status);
          const age = getAge(plan.updatedAt);

          console.log(`  ${statusIcon} ${chalk.bold(plan.id.slice(0, 8))}`);
          console.log(`     ${chalk.gray('Task:')} ${plan.originalPrompt.slice(0, 60)}${plan.originalPrompt.length > 60 ? '...' : ''}`);
          console.log(`     ${chalk.gray('Status:')} ${statusColor(plan.status)} ${chalk.gray(`(${age} ago)`)}`);
          console.log(`     ${chalk.gray('Progress:')} ${plan.completedPhases}/${plan.totalPhases} phases`);
          console.log();
        }

        if (options.stale && plans.length > 0) {
          console.log(chalk.yellow('💡 To clean stale sessions, run:'));
          console.log(chalk.cyan(`   ax status sessions clean --days ${staleDays}`));
          console.log();
        }

      } catch (error: unknown) {
        ConsoleMessenger.error('status_commands.error_listing_sessions', { error: extractErrorMessage(error) });
        process.exit(1);
      }
    });

  // Clean stale sessions
  sessionsCmd
    .command('clean')
    .description('Clean up stale/interrupted sessions')
    .option('-d, --days <number>', 'Days threshold for stale detection', '1')
    .option('-f, --force', 'Delete stale sessions immediately (otherwise marks as abandoned)')
    .option('--delete-abandoned', 'Also delete sessions already marked as abandoned')
    .action(async (options) => {
      try {
        const storage = getPlanStorage();
        const parsedDays = parseInt(options.days, 10);
        const staleDays = isNaN(parsedDays) || parsedDays < 0 ? 1 : parsedDays;

        // First, show what will be cleaned
        const stalePlans = await storage.listStalePlans(staleDays);

        console.log();
        console.log(chalk.bold.blue('🧹 Session Cleanup'));
        console.log(chalk.gray('─'.repeat(60)));
        console.log();

        if (stalePlans.length === 0) {
          console.log(chalk.green('✓ No stale sessions to clean up.'));
          console.log(chalk.gray(`  All sessions have been updated within ${staleDays} day${staleDays === 1 ? '' : 's'}.`));
          console.log();

          // Check for abandoned plans if --delete-abandoned is set
          if (options.deleteAbandoned) {
            const allPlans = await storage.listPlans();
            const abandoned = allPlans.filter(p => p.status === PlanStatus.ABANDONED);
            if (abandoned.length > 0) {
              console.log(chalk.yellow(`Found ${abandoned.length} abandoned session(s) to delete.`));
              for (const plan of abandoned) {
                await storage.deletePlan(plan.id);
              }
              console.log(chalk.green(`✓ Deleted ${abandoned.length} abandoned session(s).`));
              console.log();
            }
          }
          return;
        }

        console.log(chalk.yellow(`Found ${stalePlans.length} stale session(s) (inactive > ${staleDays} day${staleDays === 1 ? '' : 's'}):`));
        console.log();

        for (const plan of stalePlans) {
          const statusIcon = getStatusIcon(plan.status);
          const age = getAge(plan.updatedAt);
          console.log(`  ${statusIcon} ${plan.id.slice(0, 8)} - ${plan.originalPrompt.slice(0, 50)}... (${age} ago)`);
        }
        console.log();

        // Clean up
        const cleanedCount = await storage.cleanupStalePlans(staleDays, options.force);

        if (options.force) {
          console.log(chalk.green(`✓ Deleted ${cleanedCount} stale session(s).`));
        } else {
          console.log(chalk.green(`✓ Marked ${cleanedCount} session(s) as abandoned.`));
          console.log(chalk.gray('  Use --force to delete them immediately, or'));
          console.log(chalk.gray('  use --delete-abandoned to clean up abandoned sessions.'));
        }
        console.log();

        // Also handle --delete-abandoned if set
        if (options.deleteAbandoned) {
          const allPlans = await storage.listPlans();
          const abandoned = allPlans.filter(p => p.status === PlanStatus.ABANDONED);
          if (abandoned.length > 0) {
            for (const plan of abandoned) {
              await storage.deletePlan(plan.id);
            }
            console.log(chalk.green(`✓ Also deleted ${abandoned.length} abandoned session(s).`));
            console.log();
          }
        }

      } catch (error: unknown) {
        ConsoleMessenger.error('status_commands.error_cleaning_sessions', { error: extractErrorMessage(error) });
        process.exit(1);
      }
    });

  // Default sessions action (list all)
  sessionsCmd.action(async () => {
    const listCmd = sessionsCmd.commands.find(cmd => cmd.name() === 'list');
    if (listCmd) {
      await listCmd.parseAsync([], { from: 'user' });
    }
  });

  // Default action (show latest)
  statusCommand.action(async () => {
    await statusCommand.commands.find(cmd => cmd.name() === 'show')?.parseAsync(['node', 'ax', 'status', 'show'], { from: 'user' });
  });

  return statusCommand;
}

/**
 * Get status icon for plan status
 */
function getStatusIcon(status: string): string {
  const icons: Record<string, string> = {
    created: '📝',
    approved: '✅',
    executing: '▶️',
    paused: '⏸️',
    completed: '✅',
    failed: '❌',
    abandoned: '🗑️',
  };
  return icons[status] || '❓';
}

/**
 * Get status color function for plan status
 */
function getStatusColor(status: string): (text: string) => string {
  const colors: Record<string, (text: string) => string> = {
    created: chalk.blue,
    approved: chalk.cyan,
    executing: chalk.yellow,
    paused: chalk.yellow,
    completed: chalk.green,
    failed: chalk.red,
    abandoned: chalk.gray,
  };
  return colors[status] || chalk.white;
}

/**
 * Get human-readable age string from a date
 */
function getAge(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffDays > 0) {
    return `${diffDays} day${diffDays === 1 ? '' : 's'}`;
  } else if (diffHours > 0) {
    return `${diffHours} hour${diffHours === 1 ? '' : 's'}`;
  } else if (diffMins > 0) {
    return `${diffMins} minute${diffMins === 1 ? '' : 's'}`;
  } else {
    return 'just now';
  }
}
