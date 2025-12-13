/**
 * Safety Rules for Auto-accept Mode - Phase 2
 *
 * Single source of truth for:
 * - Destructive operations that always require confirmation
 * - Command permission tiers (auto-approve, notify, confirm, block)
 * - Sensitive file patterns
 *
 * Safety Philosophy:
 * - Auto-accept is for convenience, not carte blanche
 * - Destructive operations ALWAYS require explicit confirmation
 * - Better safe than sorry (false positives acceptable)
 */

/**
 * Permission tiers for command classification
 */
export type CommandTier = 'auto_approve' | 'notify' | 'confirm' | 'block';

export interface DestructiveOperation {
  id: string;
  name: string;
  description: string;
  patterns: RegExp[];
  severity: 'high' | 'medium' | 'low';
}

/**
 * Command pattern with associated permission tier
 */
interface CommandPattern {
  pattern: RegExp;
  tier: CommandTier;
  description?: string;
}

/**
 * Consolidated command patterns for permission checking
 * Order matters: first match wins
 */
const COMMAND_PATTERNS: CommandPattern[] = [
  // === BLOCK: Never allow these ===
  { pattern: /rm\s+-rf\s+\/(?!tmp)/, tier: 'block', description: 'Recursive delete from root (except /tmp)' },
  { pattern: /:\(\)\{\s*:\|:&\s*\};:/, tier: 'block', description: 'Fork bomb' },
  { pattern: /\bdd\b.*of=\/dev\//, tier: 'block', description: 'Direct disk write' },

  // === CONFIRM: Require explicit approval ===
  { pattern: /^rm\s/, tier: 'confirm', description: 'Delete command' },
  { pattern: /^(sudo|chmod|chown|mv|cp)\b/, tier: 'confirm', description: 'File system modification' },
  { pattern: /\|\s*(sh|bash|zsh)\b/, tier: 'confirm', description: 'Pipe to shell' },
  { pattern: /(&&|;|\|).*rm\b/, tier: 'confirm', description: 'Chained delete command' },

  // === NOTIFY: Show notification but allow ===
  { pattern: /^(npm|npx|node|pnpm|yarn)\s+(test|run|list|ls)\b/, tier: 'notify' },
  { pattern: /^git\s+(add|commit|push|pull|checkout|merge)\b/, tier: 'notify' },

  // === AUTO-APPROVE: Safe read-only commands ===
  { pattern: /^(ls|cat|echo|pwd|date|whoami|which|type|file)\b/, tier: 'auto_approve' },
  { pattern: /^git\s+(status|log|diff|branch|show)\b/, tier: 'auto_approve' },
];

/**
 * Sensitive file patterns that require confirmation for modifications
 */
export const SENSITIVE_FILE_PATTERNS: string[] = [
  '*.config.*',
  '.env*',
  'package.json',
  'tsconfig.json',
  '*.key',
  '*.pem',
  '*.crt',
  'secrets.*',
  'credentials.*',
  '.ssh/*',
  '.aws/*',
];

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

// ============================================================================
// Command Permission Tier Functions (consolidated from PermissionManager)
// ============================================================================

/**
 * Get the permission tier for a bash command
 * This is the single source of truth for command classification
 *
 * @param command The bash command to check
 * @returns The permission tier, or null if no pattern matches (use default)
 */
export function getCommandTier(command: string): CommandTier | null {
  for (const { pattern, tier } of COMMAND_PATTERNS) {
    if (pattern.test(command)) {
      return tier;
    }
  }
  return null;
}

/**
 * Check if a file path matches sensitive file patterns
 * Uses simple glob matching with ReDoS prevention
 *
 * @param filePath The file path to check
 * @param patterns Optional custom patterns (defaults to SENSITIVE_FILE_PATTERNS)
 * @returns true if the file matches any sensitive pattern
 */
export function isSensitiveFile(filePath: string, patterns: string[] = SENSITIVE_FILE_PATTERNS): boolean {
  const fileName = filePath.split('/').pop() || filePath;

  for (const pattern of patterns) {
    // Simple glob matching with ReDoS prevention
    // BUG FIX: Use possessive-like matching to prevent catastrophic backtracking
    // Instead of .* which can backtrack, we use a more controlled pattern
    const regexPattern = '^' + pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')  // Escape special regex chars
      .replace(/\*\*/g, '(?:[^/]*(?:/[^/]*)*)') // ** matches path segments safely (non-backtracking)
      .replace(/\*/g, '[^/]*')  // * matches anything except /
      .replace(/\?/g, '[^/]') + '$';  // ? matches single char

    try {
      const regex = new RegExp(regexPattern, 'i');
      if (regex.test(fileName) || regex.test(filePath)) {
        return true;
      }
    } catch {
      // Invalid pattern, skip
    }
  }

  return false;
}

/**
 * Assess risk level for a command
 * Consolidated from PermissionManager.assessRisk
 */
export function assessCommandRisk(command: string): 'low' | 'medium' | 'high' | 'critical' {
  const cmd = command.toLowerCase();

  // Critical risk patterns
  if (cmd.includes('rm -rf') || cmd.includes('sudo')) {
    return 'critical';
  }

  // High risk patterns
  if (cmd.includes('rm ') || cmd.includes('mv ') || cmd.includes('chmod')) {
    return 'high';
  }

  // Medium risk patterns
  if (cmd.includes('git push') || cmd.includes('npm publish')) {
    return 'medium';
  }

  return 'low';
}

/**
 * Assess risk level for a file path
 */
export function assessFileRisk(filePath: string): 'low' | 'medium' | 'high' | 'critical' {
  const path = filePath.toLowerCase();

  // High risk - secrets and credentials
  if (path.includes('.env') || path.includes('secret') || path.includes('credential')) {
    return 'high';
  }

  // Medium risk - configuration
  if (path.includes('config') || path.includes('package.json')) {
    return 'medium';
  }

  return 'low';
}
