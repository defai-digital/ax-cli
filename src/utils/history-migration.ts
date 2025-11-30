import * as fs from 'fs';
import * as path from 'path';
import { getAxBaseDir } from './path-helpers.js';

/**
 * Migrate global command history to project-specific history
 * Run once on first launch after update
 *
 * This migration addresses a critical security vulnerability where command
 * history was shared globally across all ax-cli sessions, potentially
 * leaking sensitive information between different projects.
 */
export function migrateCommandHistory(): void {
  const baseDir = getAxBaseDir();
  const oldHistoryFile = path.join(baseDir, 'command-history.json');
  const migrationFlag = path.join(baseDir, '.command-history-migrated');

  // Skip if already migrated
  if (fs.existsSync(migrationFlag)) {
    return;
  }

  try {
    if (fs.existsSync(oldHistoryFile)) {
      // Backup old global history
      const backupFile = path.join(
        baseDir,
        'command-history.json.backup'
      );

      fs.copyFileSync(oldHistoryFile, backupFile);

      // Delete old global history (users will build new project-specific histories)
      fs.unlinkSync(oldHistoryFile);

      console.log('[Migration] Command history migrated to project-specific storage');
      console.log(`[Migration] Backup saved to: ${backupFile}`);
    }

    // Mark as migrated
    fs.writeFileSync(migrationFlag, new Date().toISOString());
  } catch (error) {
    console.error('[Migration] Failed to migrate command history:', error);
  }
}
