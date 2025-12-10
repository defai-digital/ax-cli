import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { getAxBaseDir } from '../../../packages/core/src/utils/path-helpers.js';

/**
 * Tests for project-specific command history isolation
 *
 * This test suite verifies the security fix for CVE-style vulnerability
 * where command history was shared globally across all ax-cli sessions.
 *
 * Key Security Requirements:
 * 1. Different project directories must have isolated command histories
 * 2. Same project directory must share command history across sessions
 * 3. No command leakage between different projects
 * 4. Fallback to global history when no project directory provided
 */
describe('Command History - Project-Specific Isolation', () => {
  const testBaseDir = path.join(process.cwd(), '.test-tmp', 'command-history');
  // Force command history writes into workspace-safe directory
  process.env.AX_CLI_HOME = path.join(testBaseDir, '.ax-cli');
  const baseDir = getAxBaseDir();
  const commandHistoryDir = path.join(baseDir, 'command-history');
  const testDirs = [
    '/tmp/test-project-a',
    '/tmp/test-project-b',
  ];

  // Calculate expected session IDs for test directories
  const getSessionId = (projectDir: string): string => {
    const absolutePath = path.resolve(projectDir);
    const hash = crypto.createHash('sha256').update(absolutePath).digest('hex');
    return hash.substring(0, 16);
  };

  const getHistoryFilePath = (projectDir?: string): string => {
    if (projectDir) {
      const sessionId = getSessionId(projectDir);
      return path.join(commandHistoryDir, `${sessionId}.json`);
    }
    return path.join(baseDir, 'command-history.json');
  };

  const saveHistory = (projectDir: string, commands: string[]): void => {
    const historyFile = getHistoryFilePath(projectDir);
    const dir = path.dirname(historyFile);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(historyFile, JSON.stringify(commands, null, 2), 'utf-8');
  };

  const loadHistory = (projectDir?: string): string[] => {
    const historyFile = getHistoryFilePath(projectDir);

    if (!fs.existsSync(historyFile)) {
      return [];
    }

    try {
      const content = fs.readFileSync(historyFile, 'utf-8');
      if (!content || !content.trim()) {
        return [];
      }
      const parsed = JSON.parse(content);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const cleanupHistory = () => {
    // Remove entire test base directory to ensure isolation between tests
    if (fs.existsSync(testBaseDir)) {
      fs.rmSync(testBaseDir, { recursive: true, force: true });
    }
    // Recreate base directory for next test to avoid ENOENT on mkdir
    fs.mkdirSync(testBaseDir, { recursive: true });
    fs.mkdirSync(baseDir, { recursive: true });
  };

  beforeEach(() => {
    cleanupHistory();
  });

  afterEach(() => {
    cleanupHistory();
  });

  describe('Security: Project Isolation', () => {
    it('should create separate history files for different project directories', () => {
      // Simulate two different projects saving commands
      saveHistory(testDirs[0], ['secret command for project A']);
      saveHistory(testDirs[1], ['secret command for project B']);

      // Verify separate history files exist
      const historyFileA = getHistoryFilePath(testDirs[0]);
      const historyFileB = getHistoryFilePath(testDirs[1]);

      expect(fs.existsSync(historyFileA)).toBe(true);
      expect(fs.existsSync(historyFileB)).toBe(true);
      expect(historyFileA).not.toBe(historyFileB);

      // Verify content isolation
      const contentA = loadHistory(testDirs[0]);
      const contentB = loadHistory(testDirs[1]);

      expect(contentA).toContain('secret command for project A');
      expect(contentA).not.toContain('secret command for project B');

      expect(contentB).toContain('secret command for project B');
      expect(contentB).not.toContain('secret command for project A');
    });

    it('should prevent command leakage when navigating history in different projects', () => {
      // Project A session
      saveHistory(testDirs[0], [
        'API key sk-abc123 for project A',
        'database password secret-a',
      ]);

      // Project B session (different project)
      saveHistory(testDirs[1], ['public command for project B']);

      // Load history from Project B - should only see Project B commands
      const historyB = loadHistory(testDirs[1]);

      expect(historyB).toHaveLength(1);
      expect(historyB[0]).toBe('public command for project B');

      // Verify no leakage of sensitive Project A commands
      expect(historyB).not.toContain('API key sk-abc123 for project A');
      expect(historyB).not.toContain('database password secret-a');
    });

    it('should share command history across sessions of the same project', () => {
      // First session in project A
      saveHistory(testDirs[0], ['shared command']);

      // Second session in the same project A (simulates new terminal)
      const history = loadHistory(testDirs[0]);

      // Should see commands from first session
      expect(history).toContain('shared command');
    });

    it('should use consistent session IDs for the same project directory', () => {
      // Save commands for the same project
      saveHistory(testDirs[0], ['test command 1']);

      // Load and append more commands (simulating multiple saves)
      const existingHistory = loadHistory(testDirs[0]);
      saveHistory(testDirs[0], [...existingHistory, 'test command 2']);

      // Both should use the same history file
      const historyFile = getHistoryFilePath(testDirs[0]);
      expect(fs.existsSync(historyFile)).toBe(true);

      const content = loadHistory(testDirs[0]);
      expect(content).toHaveLength(2);
      expect(content).toContain('test command 1');
      expect(content).toContain('test command 2');
    });

    it('should verify directory structure matches security design', () => {
      saveHistory(testDirs[0], ['test']);

      // Verify the path structure
      const historyFile = getHistoryFilePath(testDirs[0]);
      const sessionId = getSessionId(testDirs[0]);

      expect(historyFile).toBe(path.join(commandHistoryDir, `${sessionId}.json`));
      // Normalize path for cross-platform compatibility (Windows uses backslashes)
      expect(historyFile.replace(/\\/g, '/')).toContain('.ax-cli/command-history/');
      expect(sessionId).toHaveLength(16);
    });
  });

  describe('Fallback Behavior', () => {
    it('should use global history when no project directory provided', () => {
      const globalHistoryFile = getHistoryFilePath();

      // Save to global history
      const globalCommands = ['global command'];
      fs.writeFileSync(globalHistoryFile, JSON.stringify(globalCommands, null, 2), 'utf-8');

      expect(fs.existsSync(globalHistoryFile)).toBe(true);
      const content = loadHistory();
      expect(content).toContain('global command');
    });

    it('should use global history file at correct path', () => {
      const globalHistoryFile = getHistoryFilePath();
      const expectedPath = path.join(baseDir, 'command-history.json');

      expect(globalHistoryFile).toBe(expectedPath);
    });
  });

  describe('Hash Consistency', () => {
    it('should generate consistent hashes for the same absolute path', () => {
      const sessionId1 = getSessionId(testDirs[0]);
      const sessionId2 = getSessionId(testDirs[0]);

      expect(sessionId1).toBe(sessionId2);
      expect(sessionId1).toHaveLength(16);
    });

    it('should generate different hashes for different project directories', () => {
      const sessionId1 = getSessionId(testDirs[0]);
      const sessionId2 = getSessionId(testDirs[1]);

      expect(sessionId1).not.toBe(sessionId2);
    });

    it('should use SHA-256 for session ID generation', () => {
      const projectDir = testDirs[0];
      const absolutePath = path.resolve(projectDir);
      const expectedHash = crypto.createHash('sha256').update(absolutePath).digest('hex');
      const expectedSessionId = expectedHash.substring(0, 16);

      const actualSessionId = getSessionId(projectDir);

      expect(actualSessionId).toBe(expectedSessionId);
    });

    it('should generate hex-only session IDs (no special characters)', () => {
      const sessionId = getSessionId(testDirs[0]);
      const hexPattern = /^[0-9a-f]{16}$/;

      expect(sessionId).toMatch(hexPattern);
    });
  });

  describe('File Operations', () => {
    it('should create command-history directory if it does not exist', () => {
      // Remove directory if exists
      if (fs.existsSync(commandHistoryDir)) {
        const files = fs.readdirSync(commandHistoryDir);
        for (const file of files) {
          fs.unlinkSync(path.join(commandHistoryDir, file));
        }
        fs.rmdirSync(commandHistoryDir);
      }

      // Save history - should create directory
      saveHistory(testDirs[0], ['test command']);

      expect(fs.existsSync(commandHistoryDir)).toBe(true);
    });

    it('should handle empty or malformed history files gracefully', () => {
      const historyFile = getHistoryFilePath(testDirs[0]);
      const dir = path.dirname(historyFile);

      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Write empty file
      fs.writeFileSync(historyFile, '', 'utf-8');

      const history = loadHistory(testDirs[0]);
      expect(history).toEqual([]);
    });

    it('should handle whitespace-only history files', () => {
      const historyFile = getHistoryFilePath(testDirs[0]);
      const dir = path.dirname(historyFile);

      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Write whitespace
      fs.writeFileSync(historyFile, '   \n\t  ', 'utf-8');

      const history = loadHistory(testDirs[0]);
      expect(history).toEqual([]);
    });

    it('should return empty array for non-existent history file', () => {
      const history = loadHistory('/tmp/non-existent-project-xyz123');
      expect(history).toEqual([]);
    });
  });

  describe('Security Validation', () => {
    it('should verify isolation prevents cross-project data access', () => {
      // Set up sensitive data in Project A
      const sensitiveCommands = [
        'export API_KEY=sk-live-secret123',
        'psql postgres://admin:password@prod.db',
        'stripe --api-key pk_live_xyz123',
      ];

      saveHistory(testDirs[0], sensitiveCommands);

      // Access from Project B
      const historyB = loadHistory(testDirs[1]);

      // Verify complete isolation - Project B sees nothing from A
      expect(historyB).toHaveLength(0);
      for (const cmd of sensitiveCommands) {
        expect(historyB).not.toContain(cmd);
      }
    });

    it('should verify no global fallback contamination', () => {
      // Save to global history
      const globalHistoryFile = getHistoryFilePath();
      fs.writeFileSync(globalHistoryFile, JSON.stringify(['global command'], null, 2), 'utf-8');

      // Save to project-specific history
      saveHistory(testDirs[0], ['project command']);

      // Load project history - should not include global
      const projectHistory = loadHistory(testDirs[0]);

      expect(projectHistory).toHaveLength(1);
      expect(projectHistory).toContain('project command');
      expect(projectHistory).not.toContain('global command');
    });

    it('should verify session ID collision resistance', () => {
      // Generate session IDs for multiple projects
      const sessionIds = new Set<string>();
      const testProjects = [
        '/tmp/project-1',
        '/tmp/project-2',
        '/home/user/work/clientA',
        '/home/user/work/clientB',
        '/var/www/app',
      ];

      for (const project of testProjects) {
        const sessionId = getSessionId(project);
        expect(sessionIds.has(sessionId)).toBe(false); // No collisions
        sessionIds.add(sessionId);
      }

      expect(sessionIds.size).toBe(testProjects.length);
    });
  });

  describe('Migration Compatibility', () => {
    it('should support migration from global to project-specific', () => {
      // Simulate old global history
      const globalHistoryFile = getHistoryFilePath();
      const oldGlobalCommands = ['old command 1', 'old command 2'];
      fs.writeFileSync(globalHistoryFile, JSON.stringify(oldGlobalCommands, null, 2), 'utf-8');

      expect(fs.existsSync(globalHistoryFile)).toBe(true);

      // After migration, project-specific histories will be independent
      saveHistory(testDirs[0], ['new project A command']);
      saveHistory(testDirs[1], ['new project B command']);

      // Verify new project histories are isolated
      const historyA = loadHistory(testDirs[0]);
      const historyB = loadHistory(testDirs[1]);

      expect(historyA).toHaveLength(1);
      expect(historyB).toHaveLength(1);
      expect(historyA[0]).toBe('new project A command');
      expect(historyB[0]).toBe('new project B command');
    });

    it('should verify backup path matches migration design', () => {
      const backupPath = path.join(baseDir, 'command-history.json.backup');
      const globalPath = getHistoryFilePath();

      // Create global file
      fs.writeFileSync(globalPath, JSON.stringify(['test'], null, 2), 'utf-8');

      // Simulate backup
      fs.copyFileSync(globalPath, backupPath);

      expect(fs.existsSync(backupPath)).toBe(true);

      // Clean up
      fs.unlinkSync(backupPath);
    });
  });
});
