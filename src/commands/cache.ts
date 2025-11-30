import { Command } from 'commander';
import chalk from 'chalk';
import { readdir, stat, rm } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { homedir } from 'os';
import { ConsoleMessenger } from '../utils/console-messenger.js';
import { extractErrorMessage } from '../utils/error-handler.js';
import { getFileCache, clearAllCaches } from '../utils/file-cache.js';
import { CONFIG_DIR_NAME } from '../constants.js';

/**
 * Create the cache command
 *
 * Manages file analysis caches for improved performance
 */
export function createCacheCommand(): Command {
  const cacheCommand = new Command('cache');
  cacheCommand.description('Manage file analysis caches');

  // Show cache statistics
  cacheCommand
    .command('show')
    .description('Show cache statistics')
    .option('-n, --namespace <name>', 'Show specific cache namespace', 'default')
    .option('-j, --json', 'Output in JSON format')
    .action(async (options) => {
      try {
        const cache = getFileCache(options.namespace);
        await cache.init();

        const stats = cache.getStats();
        const metadata = cache.getMetadata();

        if (options.json) {
          console.log(JSON.stringify({
            namespace: options.namespace,
            stats,
            metadata,
          }, null, 2));
          return;
        }

        // Display in human-readable format
        console.log();
        console.log(chalk.bold.blue('📦 Cache Statistics'));
        console.log(chalk.gray('─'.repeat(60)));
        console.log();

        console.log(chalk.bold('Namespace:'), chalk.cyan(options.namespace));
        console.log(chalk.bold('Version:'), metadata.version);
        if (metadata.toolVersion) {
          console.log(chalk.bold('Tool Version:'), metadata.toolVersion);
        }
        console.log();

        console.log(chalk.bold('Statistics:'));
        console.log(`  Total Entries:       ${chalk.cyan(stats.totalEntries.toLocaleString())}`);
        console.log(`  Cache Size:          ${chalk.cyan(formatBytes(stats.cacheSize))}`);
        console.log(`  Cache Hits:          ${chalk.green(stats.hits.toLocaleString())}`);
        console.log(`  Cache Misses:        ${chalk.yellow(stats.misses.toLocaleString())}`);
        console.log(`  Invalidations:       ${chalk.red(stats.invalidations.toLocaleString())}`);

        const hitRatePercent = (stats.hitRate * 100).toFixed(1);
        const hitRateColor = stats.hitRate > 0.7 ? chalk.green : stats.hitRate > 0.4 ? chalk.yellow : chalk.red;
        console.log(`  Hit Rate:            ${hitRateColor(hitRatePercent + '%')}`);
        console.log();

        console.log(chalk.bold('Metadata:'));
        console.log(`  Created At:          ${formatDate(metadata.createdAt)}`);
        console.log(`  Last Accessed:       ${formatDate(metadata.lastAccessedAt)}`);
        console.log(`  Total Cached Size:   ${chalk.cyan(formatBytes(metadata.totalSize))}`);
        console.log();

        if (stats.totalEntries === 0) {
          console.log(chalk.yellow('💡 Cache is empty. Files will be cached on first analysis.'));
          console.log();
        } else if (stats.hitRate > 0.7) {
          console.log(chalk.green('✨ Excellent cache performance! Most files are being reused.'));
          console.log();
        } else if (stats.hitRate < 0.3 && stats.hits + stats.misses > 10) {
          console.log(chalk.yellow('⚠️  Low cache hit rate. Consider:'));
          console.log(chalk.gray('   - Files may be changing frequently'));
          console.log(chalk.gray('   - Cache may need to be cleared'));
          console.log(chalk.gray('   - Tool version may have changed'));
          console.log();
        }

      } catch (error: unknown) {
        ConsoleMessenger.error('cache_commands.error_showing_cache', { error: extractErrorMessage(error) });
        process.exit(1);
      }
    });

  // Clear cache
  cacheCommand
    .command('clear')
    .description('Clear cache entries')
    .option('-n, --namespace <name>', 'Clear specific cache namespace')
    .option('-a, --all', 'Clear all cache namespaces')
    .action(async (options) => {
      try {
        if (options.all) {
          await clearAllCaches();

          // Also delete physical cache files
          const homeDir = homedir();
          const cacheDir = join(homeDir, CONFIG_DIR_NAME, 'cache');

          if (existsSync(cacheDir)) {
            await rm(cacheDir, { recursive: true, force: true });
          }

          console.log(chalk.green('✓ All caches cleared'));
        } else {
          const namespace = options.namespace || 'default';
          const cache = getFileCache(namespace);
          await cache.init();
          await cache.clear();
          console.log(chalk.green(`✓ Cache "${namespace}" cleared`));
        }
      } catch (error: unknown) {
        ConsoleMessenger.error('cache_commands.error_clearing_cache', { error: extractErrorMessage(error) });
        process.exit(1);
      }
    });

  // Prune expired entries
  cacheCommand
    .command('prune')
    .description('Remove expired cache entries')
    .option('-n, --namespace <name>', 'Prune specific cache namespace', 'default')
    .action(async (options) => {
      try {
        const cache = getFileCache(options.namespace);
        await cache.init();

        const pruned = await cache.prune();

        if (pruned > 0) {
          console.log(chalk.green(`✓ Pruned ${pruned} expired ${pruned === 1 ? 'entry' : 'entries'} from cache "${options.namespace}"`));
        } else {
          console.log(chalk.gray(`No expired entries found in cache "${options.namespace}"`));
        }
      } catch (error: unknown) {
        ConsoleMessenger.error('cache_commands.error_pruning_cache', { error: extractErrorMessage(error) });
        process.exit(1);
      }
    });

  // List all cache namespaces
  cacheCommand
    .command('list')
    .description('List all cache namespaces')
    .option('-j, --json', 'Output in JSON format')
    .action(async (options) => {
      try {
        const homeDir = homedir();
        const cacheDir = join(homeDir, CONFIG_DIR_NAME, 'cache');

        if (!existsSync(cacheDir)) {
          if (options.json) {
            console.log(JSON.stringify({ caches: [] }, null, 2));
          } else {
            console.log(chalk.yellow('No caches found.'));
          }
          return;
        }

        const files = await readdir(cacheDir);
        const cacheFiles = files.filter(f => f.endsWith('.json'));

        if (cacheFiles.length === 0) {
          if (options.json) {
            console.log(JSON.stringify({ caches: [] }, null, 2));
          } else {
            console.log(chalk.yellow('No caches found.'));
          }
          return;
        }

        const caches = await Promise.all(
          cacheFiles.map(async (file) => {
            const namespace = file.replace('.json', '');
            const filePath = join(cacheDir, file);
            const fileStat = await stat(filePath);

            return {
              namespace,
              file,
              size: fileStat.size,
              modified: fileStat.mtime,
            };
          })
        );

        if (options.json) {
          console.log(JSON.stringify({ caches }, null, 2));
          return;
        }

        console.log();
        console.log(chalk.bold.blue('📦 Cache Namespaces'));
        console.log(chalk.gray('─'.repeat(60)));
        console.log();

        for (const cache of caches) {
          console.log(chalk.bold(cache.namespace));
          console.log(`  File:        ${cache.file}`);
          console.log(`  Size:        ${formatBytes(cache.size)}`);
          console.log(`  Modified:    ${formatDate(cache.modified)}`);
          console.log();
        }

        const totalSize = caches.reduce((sum, c) => sum + c.size, 0);
        console.log(chalk.bold('Total:'), caches.length, 'cache(s),', formatBytes(totalSize));
        console.log();

      } catch (error: unknown) {
        ConsoleMessenger.error('cache_commands.error_listing_caches', { error: extractErrorMessage(error) });
        process.exit(1);
      }
    });

  // Info about cache system
  cacheCommand
    .command('info')
    .description('Show information about the cache system')
    .action(() => {
      console.log();
      console.log(chalk.bold.blue('📦 Cache System Information'));
      console.log(chalk.gray('─'.repeat(60)));
      console.log();

      const homeDir = homedir();
      const cacheDir = join(homeDir, CONFIG_DIR_NAME, 'cache');

      console.log(chalk.bold('Cache Directory:'));
      console.log(`  ${cacheDir}`);
      console.log();

      console.log(chalk.bold('How It Works:'));
      console.log('  The cache system stores analysis results to avoid re-reading');
      console.log('  and re-analyzing unchanged files. This significantly speeds up');
      console.log('  repeated operations and reduces I/O and CPU usage.');
      console.log();

      console.log(chalk.bold('Change Detection:'));
      console.log('  1. Git status (fastest) - detects uncommitted changes');
      console.log('  2. Modification time - checks file mtime');
      console.log('  3. File size - quick size comparison');
      console.log('  4. Content hash (SHA-256) - accurate verification');
      console.log();

      console.log(chalk.bold('Configuration:'));
      console.log('  • TTL: 7 days (entries expire after this period)');
      console.log('  • Max Entries: 10,000 per namespace');
      console.log('  • Max Size: 100MB per namespace');
      console.log('  • Git Integration: Enabled by default');
      console.log();

      console.log(chalk.bold('Commands:'));
      console.log('  ax cache show         Show cache statistics');
      console.log('  ax cache list         List all cache namespaces');
      console.log('  ax cache clear        Clear a specific cache');
      console.log('  ax cache clear --all  Clear all caches');
      console.log('  ax cache prune        Remove expired entries');
      console.log();

      console.log(chalk.bold('Performance Tips:'));
      console.log('  • High hit rate (>70%) is excellent');
      console.log('  • Prune regularly to remove expired entries');
      console.log('  • Clear cache after major tool updates');
      console.log('  • Use git to track changes for best performance');
      console.log();
    });

  // Default action (show cache)
  cacheCommand.action(async () => {
    await cacheCommand.commands.find(cmd => cmd.name() === 'show')?.parseAsync(['node', 'ax', 'cache', 'show'], { from: 'user' });
  });

  return cacheCommand;
}

/**
 * Format bytes to human-readable string
 * BUG FIX: Handle edge cases for sub-byte and NaN values
 */
function formatBytes(bytes: number): string {
  // BUG FIX: Handle NaN and invalid inputs
  if (!Number.isFinite(bytes)) return '0 B';
  if (bytes === 0) return '0 B';
  if (bytes < 0) return '-' + formatBytes(-bytes);
  // BUG FIX: Handle sub-byte values where Math.log produces unreliable results
  if (bytes < 1) return '< 1 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);

  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

/**
 * Format date to human-readable string
 */
function formatDate(date: Date | number): string {
  const d = typeof date === 'number' ? new Date(date) : date;
  return d.toLocaleString();
}
