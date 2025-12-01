/**
 * Unit tests for Safety Rules System (Phase 2)
 *
 * Tests destructive operation detection, pattern matching,
 * and safety rule utilities.
 */

import { describe, it, expect } from 'vitest';
import {
  isDestructiveCommand,
  isMassDelete,
  shouldAlwaysConfirm,
  getAllOperationIds,
  getDefaultAlwaysConfirm,
  formatSeverity,
  DESTRUCTIVE_OPERATIONS,
} from '../../src/utils/safety-rules.js';

describe('Safety Rules System', () => {
  describe('isDestructiveCommand', () => {
    describe('git_push_main detection', () => {
      it('should detect git push to main branch', () => {
        const result = isDestructiveCommand('git push origin main');
        expect(result.isDestructive).toBe(true);
        expect(result.matchedOperations).toHaveLength(1);
        expect(result.matchedOperations[0].id).toBe('git_push_main');
      });

      it('should detect git push to master branch', () => {
        const result = isDestructiveCommand('git push origin master');
        expect(result.isDestructive).toBe(true);
        expect(result.matchedOperations[0].id).toBe('git_push_main');
      });

      it('should detect git push main without origin', () => {
        const result = isDestructiveCommand('git push main');
        expect(result.isDestructive).toBe(true);
        expect(result.matchedOperations[0].id).toBe('git_push_main');
      });

      it('should be case insensitive', () => {
        const result = isDestructiveCommand('GIT PUSH ORIGIN MAIN');
        expect(result.isDestructive).toBe(true);
        expect(result.matchedOperations[0].id).toBe('git_push_main');
      });

      it('should handle extra whitespace', () => {
        const result = isDestructiveCommand('git  push   origin   main');
        expect(result.isDestructive).toBe(true);
        expect(result.matchedOperations[0].id).toBe('git_push_main');
      });

      it('should detect force push to main', () => {
        const result = isDestructiveCommand('git push --force origin main');
        expect(result.isDestructive).toBe(true);
        // Should match BOTH git_force_push AND git_push_main
        expect(result.matchedOperations.length).toBeGreaterThanOrEqual(1);
        const ids = result.matchedOperations.map(op => op.id);
        expect(ids).toContain('git_push_main');
      });

      it('should not detect push to feature branch', () => {
        const result = isDestructiveCommand('git push origin feature/my-feature');
        expect(result.isDestructive).toBe(false);
        expect(result.matchedOperations).toHaveLength(0);
      });
    });

    describe('git_force_push detection', () => {
      it('should detect git push with --force flag', () => {
        const result = isDestructiveCommand('git push --force origin feature');
        expect(result.isDestructive).toBe(true);
        expect(result.matchedOperations[0].id).toBe('git_force_push');
      });

      it('should detect git push with -f flag', () => {
        const result = isDestructiveCommand('git push -f origin feature');
        expect(result.isDestructive).toBe(true);
        expect(result.matchedOperations[0].id).toBe('git_force_push');
      });

      it('should detect force flag at end of command', () => {
        const result = isDestructiveCommand('git push origin feature --force');
        expect(result.isDestructive).toBe(true);
        expect(result.matchedOperations[0].id).toBe('git_force_push');
      });

      it('should be case insensitive', () => {
        const result = isDestructiveCommand('GIT PUSH --FORCE');
        expect(result.isDestructive).toBe(true);
        expect(result.matchedOperations[0].id).toBe('git_force_push');
      });
    });

    describe('rm_rf detection', () => {
      it('should detect rm -rf command', () => {
        const result = isDestructiveCommand('rm -rf /tmp/test');
        expect(result.isDestructive).toBe(true);
        expect(result.matchedOperations[0].id).toBe('rm_rf');
      });

      it('should detect rm -fr command (reversed flags)', () => {
        const result = isDestructiveCommand('rm -fr /tmp/test');
        expect(result.isDestructive).toBe(true);
        expect(result.matchedOperations[0].id).toBe('rm_rf');
      });

      it('should detect rm with separate -r -f flags', () => {
        const result = isDestructiveCommand('rm -r -f /tmp/test');
        expect(result.isDestructive).toBe(true);
        expect(result.matchedOperations[0].id).toBe('rm_rf');
      });

      it('should detect rm with -f -r flags (reversed order)', () => {
        const result = isDestructiveCommand('rm -f -r /tmp/test');
        expect(result.isDestructive).toBe(true);
        expect(result.matchedOperations[0].id).toBe('rm_rf');
      });

      it('should be case insensitive', () => {
        const result = isDestructiveCommand('RM -RF /tmp/test');
        expect(result.isDestructive).toBe(true);
        expect(result.matchedOperations[0].id).toBe('rm_rf');
      });

      it('should not detect rm without -r flag', () => {
        const result = isDestructiveCommand('rm -f file.txt');
        expect(result.isDestructive).toBe(false);
      });

      it('should not detect rm without -f flag', () => {
        const result = isDestructiveCommand('rm -r directory');
        expect(result.isDestructive).toBe(false);
      });
    });

    describe('npm_publish detection', () => {
      it('should detect npm publish', () => {
        const result = isDestructiveCommand('npm publish');
        expect(result.isDestructive).toBe(true);
        expect(result.matchedOperations[0].id).toBe('npm_publish');
      });

      it('should detect npm publish with flags', () => {
        const result = isDestructiveCommand('npm publish --access public');
        expect(result.isDestructive).toBe(true);
        expect(result.matchedOperations[0].id).toBe('npm_publish');
      });

      it('should detect yarn publish', () => {
        const result = isDestructiveCommand('yarn publish');
        expect(result.isDestructive).toBe(true);
        expect(result.matchedOperations[0].id).toBe('npm_publish');
      });

      it('should detect pnpm publish', () => {
        const result = isDestructiveCommand('pnpm publish');
        expect(result.isDestructive).toBe(true);
        expect(result.matchedOperations[0].id).toBe('npm_publish');
      });

      it('should be case insensitive', () => {
        const result = isDestructiveCommand('NPM PUBLISH');
        expect(result.isDestructive).toBe(true);
        expect(result.matchedOperations[0].id).toBe('npm_publish');
      });

      it('should not detect npm install', () => {
        const result = isDestructiveCommand('npm install');
        expect(result.isDestructive).toBe(false);
      });
    });

    describe('drop_database detection', () => {
      it('should detect DROP DATABASE', () => {
        const result = isDestructiveCommand('DROP DATABASE mydb');
        expect(result.isDestructive).toBe(true);
        expect(result.matchedOperations[0].id).toBe('drop_database');
      });

      it('should detect DROP TABLE', () => {
        const result = isDestructiveCommand('DROP TABLE users');
        expect(result.isDestructive).toBe(true);
        expect(result.matchedOperations[0].id).toBe('drop_database');
      });

      it('should detect DROP SCHEMA', () => {
        const result = isDestructiveCommand('DROP SCHEMA public');
        expect(result.isDestructive).toBe(true);
        expect(result.matchedOperations[0].id).toBe('drop_database');
      });

      it('should detect TRUNCATE TABLE', () => {
        const result = isDestructiveCommand('TRUNCATE TABLE users');
        expect(result.isDestructive).toBe(true);
        expect(result.matchedOperations[0].id).toBe('drop_database');
      });

      it('should be case insensitive', () => {
        const result = isDestructiveCommand('drop database mydb');
        expect(result.isDestructive).toBe(true);
        expect(result.matchedOperations[0].id).toBe('drop_database');
      });
    });

    describe('docker_prune detection', () => {
      it('should detect docker system prune', () => {
        const result = isDestructiveCommand('docker system prune');
        expect(result.isDestructive).toBe(true);
        expect(result.matchedOperations[0].id).toBe('docker_prune');
      });

      it('should detect docker volume prune', () => {
        const result = isDestructiveCommand('docker volume prune');
        expect(result.isDestructive).toBe(true);
        expect(result.matchedOperations[0].id).toBe('docker_prune');
      });

      it('should detect with flags', () => {
        const result = isDestructiveCommand('docker system prune -a --volumes');
        expect(result.isDestructive).toBe(true);
        expect(result.matchedOperations[0].id).toBe('docker_prune');
      });

      it('should be case insensitive', () => {
        const result = isDestructiveCommand('DOCKER SYSTEM PRUNE');
        expect(result.isDestructive).toBe(true);
        expect(result.matchedOperations[0].id).toBe('docker_prune');
      });
    });

    describe('pip_uninstall_all detection', () => {
      it('should detect pip freeze with xargs uninstall', () => {
        const result = isDestructiveCommand('pip freeze | xargs pip uninstall -y');
        expect(result.isDestructive).toBe(true);
        expect(result.matchedOperations[0].id).toBe('pip_uninstall_all');
      });

      it('should be case insensitive', () => {
        const result = isDestructiveCommand('PIP FREEZE | XARGS PIP UNINSTALL');
        expect(result.isDestructive).toBe(true);
        expect(result.matchedOperations[0].id).toBe('pip_uninstall_all');
      });
    });

    describe('multiple matches', () => {
      it('should match multiple operations for force push to main', () => {
        const result = isDestructiveCommand('git push --force origin main');
        expect(result.isDestructive).toBe(true);
        expect(result.matchedOperations.length).toBeGreaterThanOrEqual(2);
        const ids = result.matchedOperations.map(op => op.id);
        expect(ids).toContain('git_force_push');
        expect(ids).toContain('git_push_main');
      });

      it('should not duplicate matches for same operation', () => {
        const result = isDestructiveCommand('git push origin main');
        const ids = result.matchedOperations.map(op => op.id);
        const uniqueIds = new Set(ids);
        expect(ids.length).toBe(uniqueIds.size); // No duplicates
      });
    });

    describe('safe commands', () => {
      it('should not flag git status as destructive', () => {
        const result = isDestructiveCommand('git status');
        expect(result.isDestructive).toBe(false);
        expect(result.matchedOperations).toHaveLength(0);
      });

      it('should not flag ls command as destructive', () => {
        const result = isDestructiveCommand('ls -la');
        expect(result.isDestructive).toBe(false);
        expect(result.matchedOperations).toHaveLength(0);
      });

      it('should not flag git pull as destructive', () => {
        const result = isDestructiveCommand('git pull origin main');
        expect(result.isDestructive).toBe(false);
        expect(result.matchedOperations).toHaveLength(0);
      });

      it('should not flag npm install as destructive', () => {
        const result = isDestructiveCommand('npm install package-name');
        expect(result.isDestructive).toBe(false);
        expect(result.matchedOperations).toHaveLength(0);
      });
    });
  });

  describe('isMassDelete', () => {
    it('should return true for 25 files (threshold)', () => {
      expect(isMassDelete(25)).toBe(true);
    });

    it('should return true for more than 25 files', () => {
      expect(isMassDelete(100)).toBe(true);
    });

    it('should return false for fewer than 25 files', () => {
      expect(isMassDelete(24)).toBe(false);
    });

    it('should return false for 0 files', () => {
      expect(isMassDelete(0)).toBe(false);
    });

    it('should return false for 1 file', () => {
      expect(isMassDelete(1)).toBe(false);
    });

    it('should return true for very large numbers', () => {
      expect(isMassDelete(10000)).toBe(true);
    });
  });

  describe('shouldAlwaysConfirm', () => {
    it('should return true if operation is in always confirm list', () => {
      const alwaysConfirm = ['git_push_main', 'rm_rf'];
      expect(shouldAlwaysConfirm('git_push_main', alwaysConfirm)).toBe(true);
    });

    it('should return false if operation is not in always confirm list', () => {
      const alwaysConfirm = ['git_push_main', 'rm_rf'];
      expect(shouldAlwaysConfirm('docker_prune', alwaysConfirm)).toBe(false);
    });

    it('should return false for empty always confirm list', () => {
      expect(shouldAlwaysConfirm('git_push_main', [])).toBe(false);
    });

    it('should handle multiple items in list', () => {
      const alwaysConfirm = ['git_push_main', 'git_force_push', 'rm_rf', 'npm_publish'];
      expect(shouldAlwaysConfirm('npm_publish', alwaysConfirm)).toBe(true);
      expect(shouldAlwaysConfirm('docker_prune', alwaysConfirm)).toBe(false);
    });
  });

  describe('getAllOperationIds', () => {
    it('should return all operation IDs', () => {
      const ids = getAllOperationIds();
      expect(ids).toContain('git_push_main');
      expect(ids).toContain('git_force_push');
      expect(ids).toContain('mass_delete');
      expect(ids).toContain('rm_rf');
      expect(ids).toContain('npm_publish');
      expect(ids).toContain('drop_database');
      expect(ids).toContain('docker_prune');
      expect(ids).toContain('pip_uninstall_all');
    });

    it('should return exactly 8 operation IDs', () => {
      const ids = getAllOperationIds();
      expect(ids).toHaveLength(8);
    });

    it('should return unique IDs', () => {
      const ids = getAllOperationIds();
      const uniqueIds = new Set(ids);
      expect(ids.length).toBe(uniqueIds.size);
    });
  });

  describe('getDefaultAlwaysConfirm', () => {
    it('should return default always confirm list', () => {
      const defaults = getDefaultAlwaysConfirm();
      expect(defaults).toContain('git_push_main');
      expect(defaults).toContain('git_force_push');
      expect(defaults).toContain('mass_delete');
      expect(defaults).toContain('rm_rf');
      expect(defaults).toContain('npm_publish');
      expect(defaults).toContain('drop_database');
    });

    it('should return exactly 6 items', () => {
      const defaults = getDefaultAlwaysConfirm();
      expect(defaults).toHaveLength(6);
    });

    it('should not include medium severity operations by default', () => {
      const defaults = getDefaultAlwaysConfirm();
      expect(defaults).not.toContain('docker_prune');
      expect(defaults).not.toContain('pip_uninstall_all');
    });
  });

  describe('formatSeverity', () => {
    it('should format high severity', () => {
      expect(formatSeverity('high')).toBe('🔴 HIGH RISK');
    });

    it('should format medium severity', () => {
      expect(formatSeverity('medium')).toBe('🟡 MEDIUM RISK');
    });

    it('should format low severity', () => {
      expect(formatSeverity('low')).toBe('🟢 LOW RISK');
    });
  });

  describe('DESTRUCTIVE_OPERATIONS', () => {
    it('should have git_push_main operation', () => {
      expect(DESTRUCTIVE_OPERATIONS.git_push_main).toBeDefined();
      expect(DESTRUCTIVE_OPERATIONS.git_push_main.id).toBe('git_push_main');
      expect(DESTRUCTIVE_OPERATIONS.git_push_main.severity).toBe('high');
    });

    it('should have git_force_push operation', () => {
      expect(DESTRUCTIVE_OPERATIONS.git_force_push).toBeDefined();
      expect(DESTRUCTIVE_OPERATIONS.git_force_push.id).toBe('git_force_push');
      expect(DESTRUCTIVE_OPERATIONS.git_force_push.severity).toBe('high');
    });

    it('should have mass_delete operation', () => {
      expect(DESTRUCTIVE_OPERATIONS.mass_delete).toBeDefined();
      expect(DESTRUCTIVE_OPERATIONS.mass_delete.id).toBe('mass_delete');
      expect(DESTRUCTIVE_OPERATIONS.mass_delete.severity).toBe('high');
    });

    it('should have rm_rf operation', () => {
      expect(DESTRUCTIVE_OPERATIONS.rm_rf).toBeDefined();
      expect(DESTRUCTIVE_OPERATIONS.rm_rf.id).toBe('rm_rf');
      expect(DESTRUCTIVE_OPERATIONS.rm_rf.severity).toBe('high');
    });

    it('should have npm_publish operation', () => {
      expect(DESTRUCTIVE_OPERATIONS.npm_publish).toBeDefined();
      expect(DESTRUCTIVE_OPERATIONS.npm_publish.id).toBe('npm_publish');
      expect(DESTRUCTIVE_OPERATIONS.npm_publish.severity).toBe('high');
    });

    it('should have drop_database operation', () => {
      expect(DESTRUCTIVE_OPERATIONS.drop_database).toBeDefined();
      expect(DESTRUCTIVE_OPERATIONS.drop_database.id).toBe('drop_database');
      expect(DESTRUCTIVE_OPERATIONS.drop_database.severity).toBe('high');
    });

    it('should have docker_prune operation', () => {
      expect(DESTRUCTIVE_OPERATIONS.docker_prune).toBeDefined();
      expect(DESTRUCTIVE_OPERATIONS.docker_prune.id).toBe('docker_prune');
      expect(DESTRUCTIVE_OPERATIONS.docker_prune.severity).toBe('medium');
    });

    it('should have pip_uninstall_all operation', () => {
      expect(DESTRUCTIVE_OPERATIONS.pip_uninstall_all).toBeDefined();
      expect(DESTRUCTIVE_OPERATIONS.pip_uninstall_all.id).toBe('pip_uninstall_all');
      expect(DESTRUCTIVE_OPERATIONS.pip_uninstall_all.severity).toBe('medium');
    });

    it('should have patterns array for each operation', () => {
      Object.values(DESTRUCTIVE_OPERATIONS).forEach(operation => {
        expect(Array.isArray(operation.patterns)).toBe(true);
        // mass_delete has no patterns (checked programmatically)
        if (operation.id !== 'mass_delete') {
          expect(operation.patterns.length).toBeGreaterThan(0);
        }
      });
    });

    it('should have name and description for each operation', () => {
      Object.values(DESTRUCTIVE_OPERATIONS).forEach(operation => {
        expect(operation.name).toBeDefined();
        expect(operation.name.length).toBeGreaterThan(0);
        expect(operation.description).toBeDefined();
        expect(operation.description.length).toBeGreaterThan(0);
      });
    });
  });
});
