import { Command } from 'commander';
import chalk from 'chalk';
import * as prompts from '@clack/prompts';
import { readdir, stat, rm } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { homedir } from 'os';
import { ConsoleMessenger } from '../utils/console-messenger.js';
import { extractErrorMessage } from '../utils/error-handler.js';
import { getFileCache, clearAllCaches } from '../utils/file-cache.js';
import { CONFIG_DIR_NAME } from '../constants.js';
import { formatBytes, formatDate } from './utils.js';

interface ShowOptions {
  namespace: string;
  json?: boolean;
}

interface ClearOptions {
  namespace?: string;
  all?: boolean;
}

interface PruneOptions {
  namespace: string;
}

interface ListOptions {
  json?: boolean;
}

/**
 * Handle 'cache show' subcommand
 */
async function handleShowCache(options: ShowOptions): Promise<void> {
  try {
    const cache = getFileCache(options.namespace);
    await cache.init();

    const stats = cache.getStats();
    const metadata = cache.getMetadata();

    if (options.json) {
      console.log(JSON.stringify({ namespace: options.namespace, stats, metadata }, null, 2));
      return;
    }

    prompts.intro(chalk.cyan('Cache Statistics'));

    const namespaceInfo = [
      `Namespace: ${chalk.cyan(options.namespace)}`,
      `Version: ${metadata.version}`,
      metadata.toolVersion ? `Tool Version: ${metadata.toolVersion}` : null,
    ].filter(Boolean).join('\n');
    prompts.note(namespaceInfo, 'Configuration');

    const hitRatePercent = (stats.hitRate * 100).toFixed(1);
    const hitRateColor = stats.hitRate > 0.7 ? chalk.green : stats.hitRate > 0.4 ? chalk.yellow : chalk.red;

    const statsInfo = [
      `Total Entries:     ${chalk.cyan(stats.totalEntries.toLocaleString())}`,
      `Cache Size:        ${chalk.cyan(formatBytes(stats.cacheSize))}`,
      `Cache Hits:        ${chalk.green(stats.hits.toLocaleString())}`,
      `Cache Misses:      ${chalk.yellow(stats.misses.toLocaleString())}`,
      `Invalidations:     ${chalk.red(stats.invalidations.toLocaleString())}`,
      `Hit Rate:          ${hitRateColor(hitRatePercent + '%')}`,
    ].join('\n');
    prompts.note(statsInfo, 'Statistics');

    const metaInfo = [
      `Created At:        ${formatDate(metadata.createdAt)}`,
      `Last Accessed:     ${formatDate(metadata.lastAccessedAt)}`,
      `Total Cached Size: ${chalk.cyan(formatBytes(metadata.totalSize))}`,
    ].join('\n');
    prompts.note(metaInfo, 'Metadata');

    printPerformanceInsights(stats);
    prompts.outro(chalk.dim('Use "ax cache clear" to reset or "ax cache prune" to remove expired entries'));
  } catch (error: unknown) {
    prompts.log.error(`Error: ${extractErrorMessage(error)}`);
    process.exit(1);
  }
}

/**
 * Print performance insights based on cache stats
 */
function printPerformanceInsights(stats: { totalEntries: number; hitRate: number; hits: number; misses: number }): void {
  if (stats.totalEntries === 0) {
    prompts.log.info('Cache is empty. Files will be cached on first analysis.');
    return;
  }
  if (stats.hitRate > 0.7) {
    prompts.log.success('Excellent cache performance! Most files are being reused.');
    return;
  }
  if (stats.hitRate < 0.3 && stats.hits + stats.misses > 10) {
    prompts.log.warn('Low cache hit rate. Consider:');
    console.log(chalk.dim('  • Files may be changing frequently'));
    console.log(chalk.dim('  • Cache may need to be cleared'));
    console.log(chalk.dim('  • Tool version may have changed'));
  }
}

/**
 * Handle 'cache clear' subcommand
 */
async function handleClearCache(options: ClearOptions): Promise<void> {
  try {
    if (options.all) {
      await clearAllCaches();
      const cacheDir = join(homedir(), CONFIG_DIR_NAME, 'cache');
      if (existsSync(cacheDir)) {
        await rm(cacheDir, { recursive: true, force: true });
      }
      console.log(chalk.green('✓ All caches cleared'));
      return;
    }

    const namespace = options.namespace || 'default';
    const cache = getFileCache(namespace);
    await cache.init();
    await cache.clear();
    console.log(chalk.green(`✓ Cache "${namespace}" cleared`));
  } catch (error: unknown) {
    ConsoleMessenger.error('cache_commands.error_clearing_cache', { error: extractErrorMessage(error) });
    process.exit(1);
  }
}

/**
 * Handle 'cache prune' subcommand
 */
async function handlePruneCache(options: PruneOptions): Promise<void> {
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
}

/**
 * Handle 'cache list' subcommand
 */
async function handleListCaches(options: ListOptions): Promise<void> {
  try {
    const cacheDir = join(homedir(), CONFIG_DIR_NAME, 'cache');

    if (!existsSync(cacheDir)) {
      outputEmptyCacheList(options.json);
      return;
    }

    const files = await readdir(cacheDir);
    const cacheFiles = files.filter(f => f.endsWith('.json'));

    if (cacheFiles.length === 0) {
      outputEmptyCacheList(options.json);
      return;
    }

    const cacheResults = await Promise.allSettled(
      cacheFiles.map(async (file) => {
        const namespace = file.replace('.json', '');
        const filePath = join(cacheDir, file);
        const fileStat = await stat(filePath);
        return { namespace, file, size: fileStat.size, modified: fileStat.mtime };
      })
    );

    const caches = cacheResults
      .filter((r): r is PromiseFulfilledResult<{ namespace: string; file: string; size: number; modified: Date }> =>
        r.status === 'fulfilled'
      )
      .map(r => r.value);

    const failedCount = cacheResults.filter(r => r.status === 'rejected').length;
    if (failedCount > 0 && !options.json) {
      console.log(chalk.yellow(`⚠ ${failedCount} cache file(s) could not be read`));
    }

    if (options.json) {
      console.log(JSON.stringify({ caches }, null, 2));
      return;
    }

    printCacheList(caches);
  } catch (error: unknown) {
    ConsoleMessenger.error('cache_commands.error_listing_caches', { error: extractErrorMessage(error) });
    process.exit(1);
  }
}

/**
 * Output empty cache list in appropriate format
 */
function outputEmptyCacheList(json?: boolean): void {
  if (json) {
    console.log(JSON.stringify({ caches: [] }, null, 2));
  } else {
    console.log(chalk.yellow('No caches found.'));
  }
}

/**
 * Print formatted cache list to console
 */
function printCacheList(caches: { namespace: string; file: string; size: number; modified: Date }[]): void {
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
}

/**
 * Handle 'cache info' subcommand
 */
function handleCacheInfo(): void {
  console.log();
  console.log(chalk.bold.blue('📦 Cache System Information'));
  console.log(chalk.gray('─'.repeat(60)));
  console.log();

  const cacheDir = join(homedir(), CONFIG_DIR_NAME, 'cache');
  console.log(chalk.bold('Cache Directory:'));
  console.log(`  ${cacheDir}`);
  console.log();

  printCacheInfoSections();
}

/**
 * Print cache info documentation sections
 */
function printCacheInfoSections(): void {
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
}

/**
 * Create the cache command
 *
 * Manages file analysis caches for improved performance
 */
export function createCacheCommand(): Command {
  const cacheCommand = new Command('cache');
  cacheCommand.description('Manage file analysis caches');

  cacheCommand
    .command('show')
    .description('Show cache statistics')
    .option('-n, --namespace <name>', 'Show specific cache namespace', 'default')
    .option('-j, --json', 'Output in JSON format')
    .action(handleShowCache);

  cacheCommand
    .command('clear')
    .description('Clear cache entries')
    .option('-n, --namespace <name>', 'Clear specific cache namespace')
    .option('-a, --all', 'Clear all cache namespaces')
    .action(handleClearCache);

  cacheCommand
    .command('prune')
    .description('Remove expired cache entries')
    .option('-n, --namespace <name>', 'Prune specific cache namespace', 'default')
    .action(handlePruneCache);

  cacheCommand
    .command('list')
    .description('List all cache namespaces')
    .option('-j, --json', 'Output in JSON format')
    .action(handleListCaches);

  cacheCommand
    .command('info')
    .description('Show information about the cache system')
    .action(handleCacheInfo);

  cacheCommand.action(async () => {
    await cacheCommand.commands.find(cmd => cmd.name() === 'show')?.parseAsync(['node', 'ax', 'cache', 'show'], { from: 'user' });
  });

  return cacheCommand;
}

// formatBytes and formatDate imported from ./utils.js
