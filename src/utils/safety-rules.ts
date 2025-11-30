/**
 * Safety Rules for Auto-accept Mode - Phase 2
 *
 * Defines destructive operations that always require confirmation
 * even when auto-accept mode is enabled.
 *
 * Safety Philosophy:
 * - Auto-accept is for convenience, not carte blanche
 * - Destructive operations ALWAYS require explicit confirmation
 * - Better safe than sorry (false positives acceptable)
 */

export interface DestructiveOperation {
  id: string;
  name: string;
  description: string;
  patterns: RegExp[];
  severity: 'high' | 'medium' | 'low';
}

/**
 * Predefined destructive operations
 */
export const DESTRUCTIVE_OPERATIONS: Record<string, DestructiveOperation> = {
  git_push_main: {
    id: 'git_push_main',
    name: 'Push to Main Branch',
    description: 'Pushing to main/master branch (potential to affect production)',
    patterns: [
      /git\s+push.*\s+(origin\s+)?(main|master)/i,
      /git\s+push.*--force.*\s+(main|master)/i,
    ],
    severity: 'high',
  },

  git_force_push: {
    id: 'git_force_push',
    name: 'Force Push',
    description: 'Force push can rewrite history and cause data loss',
    patterns: [
      /git\s+push.*--force/i,
      /git\s+push.*-f\s/i,
    ],
    severity: 'high',
  },

  mass_delete: {
    id: 'mass_delete',
    name: 'Mass File Deletion',
    description: 'Deleting 25+ files at once',
    patterns: [
      // This will be checked programmatically based on file count
    ],
    severity: 'high',
  },

  rm_rf: {
    id: 'rm_rf',
    name: 'Recursive Force Delete',
    description: 'rm -rf can delete entire directory trees',
    patterns: [
      /rm\s+-rf/i,
      /rm\s+-fr/i,
      /rm\s+.*-r.*-f/i,
      /rm\s+.*-f.*-r/i,
    ],
    severity: 'high',
  },

  npm_publish: {
    id: 'npm_publish',
    name: 'NPM Package Publish',
    description: 'Publishing to npm registry (irreversible)',
    patterns: [
      /npm\s+publish/i,
      /yarn\s+publish/i,
      /pnpm\s+publish/i,
    ],
    severity: 'high',
  },

  drop_database: {
    id: 'drop_database',
    name: 'Drop Database',
    description: 'Dropping database or tables',
    patterns: [
      /DROP\s+DATABASE/i,
      /DROP\s+TABLE/i,
      /DROP\s+SCHEMA/i,
      /TRUNCATE\s+TABLE/i,
    ],
    severity: 'high',
  },

  docker_prune: {
    id: 'docker_prune',
    name: 'Docker System Prune',
    description: 'Removing all unused Docker data',
    patterns: [
      /docker\s+system\s+prune/i,
      /docker\s+volume\s+prune/i,
    ],
    severity: 'medium',
  },

  pip_uninstall_all: {
    id: 'pip_uninstall_all',
    name: 'Uninstall All Packages',
    description: 'Uninstalling all Python packages',
    patterns: [
      /pip\s+freeze.*\|\s*xargs\s+pip\s+uninstall/i,
    ],
    severity: 'medium',
  },
};

/**
 * Check if a command matches any destructive operation patterns
 */
export function isDestructiveCommand(command: string): {
  isDestructive: boolean;
  matchedOperations: DestructiveOperation[];
} {
  const matchedOperations: DestructiveOperation[] = [];

  for (const operation of Object.values(DESTRUCTIVE_OPERATIONS)) {
    for (const pattern of operation.patterns) {
      if (pattern.test(command)) {
        matchedOperations.push(operation);
        break; // Only add each operation once
      }
    }
  }

  return {
    isDestructive: matchedOperations.length > 0,
    matchedOperations,
  };
}

/**
 * Check if a file operation is a mass deletion
 */
export function isMassDelete(fileCount: number): boolean {
  return fileCount >= 25;
}

/**
 * Get human-readable description of destructive operation
 */
export function getOperationDescription(operation: DestructiveOperation): string {
  return `${operation.name}: ${operation.description}`;
}

/**
 * Check if operation ID should always require confirmation
 */
export function shouldAlwaysConfirm(
  operationId: string,
  alwaysConfirmList: string[]
): boolean {
  return alwaysConfirmList.includes(operationId);
}

/**
 * Get all destructive operation IDs
 */
export function getAllOperationIds(): string[] {
  return Object.keys(DESTRUCTIVE_OPERATIONS);
}

/**
 * Get default always-confirm list
 */
export function getDefaultAlwaysConfirm(): string[] {
  return [
    'git_push_main',
    'git_force_push',
    'mass_delete',
    'rm_rf',
    'npm_publish',
    'drop_database',
  ];
}

/**
 * Format operation severity for display
 */
export function formatSeverity(severity: 'high' | 'medium' | 'low'): string {
  switch (severity) {
    case 'high':
      return '🔴 HIGH RISK';
    case 'medium':
      return '🟡 MEDIUM RISK';
    case 'low':
      return '🟢 LOW RISK';
  }
}

/**
 * Check if file operation is destructive
 * Currently checks for:
 * - Editing critical system files
 * - Creating executable files
 * - Editing configuration files in production-like paths
 */
export function isDestructiveFileOperation(filepath: string, operation: 'edit' | 'write' | 'delete'): {
  isDestructive: boolean;
  matchedOperations: DestructiveOperation[];
} {
  const matchedOperations: DestructiveOperation[] = [];

  // Normalize path for consistent matching
  const normalizedPath = filepath.toLowerCase().replace(/\\/g, '/');

  // Check for critical system files
  const criticalFiles = [
    '/etc/passwd',
    '/etc/shadow',
    '/etc/sudoers',
    '/etc/hosts',
    '/boot/',
    'c:/windows/system32',
    '.ssh/authorized_keys',
    '.ssh/id_rsa',
    '.ssh/id_ed25519',
    '.aws/credentials',
    '.env.production',
    'production.env',
  ];

  for (const pattern of criticalFiles) {
    if (normalizedPath.includes(pattern.toLowerCase())) {
      matchedOperations.push({
        id: 'edit_critical_file',
        name: 'Edit Critical System File',
        description: 'Modifying critical system or security files',
        patterns: [],
        severity: 'high',
      });
      break;
    }
  }

  // Check for executable file creation
  if (operation === 'write' && (
    normalizedPath.endsWith('.exe') ||
    normalizedPath.endsWith('.sh') ||
    normalizedPath.endsWith('.bat') ||
    normalizedPath.endsWith('.cmd') ||
    normalizedPath.endsWith('.ps1')
  )) {
    matchedOperations.push({
      id: 'create_executable',
      name: 'Create Executable File',
      description: 'Creating executable or script files',
      patterns: [],
      severity: 'medium',
    });
  }

  return {
    isDestructive: matchedOperations.length > 0,
    matchedOperations,
  };
}
