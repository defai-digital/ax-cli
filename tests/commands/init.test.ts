/**
 * Tests for commands/init module
 * Tests project initialization and analysis
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Command } from 'commander';

// Mock fs module
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
  renameSync: vi.fn(),
  unlinkSync: vi.fn(),
}));

// Mock path module
vi.mock('path', async (importOriginal) => {
  const actual = await importOriginal<typeof import('path')>();
  return {
    ...actual,
    join: vi.fn((...parts) => parts.join('/')),
    resolve: vi.fn((p) => `/resolved${p}`),
  };
});

// Mock @clack/prompts
vi.mock('@clack/prompts', () => ({
  intro: vi.fn(),
  outro: vi.fn(),
  log: {
    info: vi.fn(),
    success: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  note: vi.fn(),
  spinner: vi.fn(() => ({
    start: vi.fn(),
    stop: vi.fn(),
  })),
}));

// Mock project analyzer
vi.mock('../../packages/core/src/utils/project-analyzer.js', () => ({
  ProjectAnalyzer: class MockProjectAnalyzer {
    constructor(_root: string) {}
    async analyze() {
      return {
        success: true,
        projectInfo: {
          name: 'test-project',
          projectType: 'node',
          primaryLanguage: 'TypeScript',
          techStack: ['express', 'typescript'],
        },
      };
    }
  },
}));

// Mock LLM instruction generator
vi.mock('../../packages/core/src/utils/llm-optimized-instruction-generator.js', () => ({
  LLMOptimizedInstructionGenerator: class MockGenerator {
    generateInstructions() {
      return '# Test Instructions\n\nProject-specific guidance.';
    }
    generateAxMd() {
      return '# Test Instructions\n\nProject-specific guidance.';
    }
    generateIndex() {
      return JSON.stringify({ project: 'test' });
    }
    generateSummary() {
      return JSON.stringify({ summary: 'test' });
    }
    generateDeepAnalysis() {
      return JSON.stringify({ deep: 'analysis' });
    }
  },
}));

// Mock init validator
vi.mock('../../packages/core/src/utils/init-validator.js', () => ({
  InitValidator: class MockValidator {
    constructor(_root: string) {}
    validate() {
      return {
        valid: true,
        warnings: [],
        suggestions: [],
        errors: [],
      };
    }
    static formatValidationResult(result: { valid: boolean }) {
      return result.valid ? 'Validation passed' : 'Validation failed';
    }
  },
}));

// Mock init wizard
vi.mock('../../packages/core/src/commands/init/wizard.js', () => ({
  InitWizard: class MockWizard {
    constructor(_options: Record<string, unknown>) {}
    async run() {
      return { selectedTemplate: undefined };
    }
  },
}));

// Mock error-handler
vi.mock('../../packages/core/src/utils/error-handler.js', () => ({
  extractErrorMessage: vi.fn((error) =>
    error instanceof Error ? error.message : String(error)
  ),
}));

// Mock rules-parser
vi.mock('../../packages/core/src/utils/rules-parser.js', () => ({
  parseProjectRules: vi.fn(() => ({
    parsedFiles: [],
    allRules: [],
  })),
  getRulesSummary: vi.fn(() => ''),
}));

// Mock migrator
vi.mock('../../packages/core/src/commands/init/migrator.js', () => ({
  migrateFromLegacyFormat: vi.fn(),
  detectLegacyFormat: vi.fn(() => ({
    hasLegacyFiles: false,
    files: [],
  })),
}));

// Mock constants
vi.mock('../../packages/core/src/constants.js', () => ({
  FILE_NAMES: {
    CUSTOM_MD: 'CUSTOM.md',
    AX_INDEX_JSON: 'ax.index.json',
    AX_SUMMARY_JSON: 'ax.summary.json',
    AX_MD: 'AX.md',
    UNIFIED_CONFIG_DIR: '.ax',
    ANALYSIS_JSON: 'analysis.json',
  },
}));

// Mock provider config
vi.mock('../../packages/core/src/provider/config.js', () => ({
  getActiveConfigPaths: vi.fn(() => ({
    DIR_NAME: '.ax-cli',
    USER_DIR: '/home/user/.ax-cli',
  })),
}));

import { createInitCommand } from '../../packages/core/src/commands/init.js';
import * as fs from 'fs';
import * as prompts from '@clack/prompts';

describe('Init Command', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: in a project directory
    vi.mocked(fs.existsSync).mockImplementation((path) => {
      const pathStr = String(path);
      if (pathStr.includes('.git') || pathStr.includes('package.json')) {
        return true;
      }
      return false;
    });
  });

  describe('createInitCommand', () => {
    it('should create a Command instance', () => {
      const cmd = createInitCommand();
      expect(cmd).toBeInstanceOf(Command);
      expect(cmd.name()).toBe('init');
    });

    it('should have description', () => {
      const cmd = createInitCommand();
      expect(cmd.description()).toContain('Initialize');
    });

    it('should have --force option', () => {
      const cmd = createInitCommand();
      const options = cmd.options;
      const forceOpt = options.find((o) => o.long === '--force');
      expect(forceOpt).toBeDefined();
    });

    it('should have --verbose option', () => {
      const cmd = createInitCommand();
      const options = cmd.options;
      const verboseOpt = options.find((o) => o.long === '--verbose');
      expect(verboseOpt).toBeDefined();
    });

    it('should have --directory option', () => {
      const cmd = createInitCommand();
      const options = cmd.options;
      const dirOpt = options.find((o) => o.long === '--directory');
      expect(dirOpt).toBeDefined();
    });

    it('should have --yes option', () => {
      const cmd = createInitCommand();
      const options = cmd.options;
      const yesOpt = options.find((o) => o.long === '--yes');
      expect(yesOpt).toBeDefined();
    });

    it('should have --dry-run option', () => {
      const cmd = createInitCommand();
      const options = cmd.options;
      const dryRunOpt = options.find((o) => o.long === '--dry-run');
      expect(dryRunOpt).toBeDefined();
    });

    it('should have --validate option', () => {
      const cmd = createInitCommand();
      const options = cmd.options;
      const validateOpt = options.find((o) => o.long === '--validate');
      expect(validateOpt).toBeDefined();
    });

    it('should have --template option', () => {
      const cmd = createInitCommand();
      const options = cmd.options;
      const templateOpt = options.find((o) => o.long === '--template');
      expect(templateOpt).toBeDefined();
    });

    it('should have --preview option', () => {
      const cmd = createInitCommand();
      const options = cmd.options;
      const previewOpt = options.find((o) => o.long === '--preview');
      expect(previewOpt).toBeDefined();
    });

    it('should have --skip-analysis option', () => {
      const cmd = createInitCommand();
      const options = cmd.options;
      const skipAnalysisOpt = options.find((o) => o.long === '--skip-analysis');
      expect(skipAnalysisOpt).toBeDefined();
    });
  });

  describe('init command execution', () => {
    it('should warn when not in a project directory', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const cmd = createInitCommand();
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('exit');
      });

      try {
        await cmd.parseAsync(['node', 'test', '--yes']);
      } catch (e) {
        // Expected - process.exit throws
      }

      expect(prompts.log.warn).toHaveBeenCalledWith(
        expect.stringContaining('No project detected')
      );
      exitSpy.mockRestore();
    });

    it('should NOT create config directory with --skip-analysis (no deep analysis)', async () => {
      vi.mocked(fs.existsSync).mockImplementation((path) => {
        const pathStr = String(path);
        if (pathStr.includes('.git')) return true;
        return false;
      });

      const cmd = createInitCommand();
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('exit');
      });

      try {
        await cmd.parseAsync(['node', 'test', '--yes', '--skip-analysis']);
      } catch (e) {
        // Expected
      }

      // With --skip-analysis, no deep analysis is done, so no .ax/ directory is created
      // The new init command only creates .ax/ for full/security depth with analysis
      expect(fs.mkdirSync).not.toHaveBeenCalled();
      exitSpy.mockRestore();
    });

    it('should handle dry-run mode', async () => {
      vi.mocked(fs.existsSync).mockImplementation((path) => {
        const pathStr = String(path);
        if (pathStr.includes('.git') || pathStr.includes('package.json')) {
          return true;
        }
        return false;
      });

      const cmd = createInitCommand();
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('exit');
      });

      try {
        await cmd.parseAsync(['node', 'test', '--yes', '--dry-run']);
      } catch (e) {
        // Expected
      }

      // The new message is "Dry-run mode - no changes made"
      expect(prompts.log.info).toHaveBeenCalledWith(
        expect.stringContaining('Dry-run mode - no changes made')
      );
      // Should not write files in dry-run mode
      expect(fs.writeFileSync).not.toHaveBeenCalled();
      exitSpy.mockRestore();
    });

    it('should auto-refresh AX.md when it exists without --force', async () => {
      vi.mocked(fs.existsSync).mockImplementation((path) => {
        const pathStr = String(path);
        if (pathStr.includes('.git') || pathStr.includes('AX.md')) {
          return true;
        }
        return false;
      });

      const cmd = createInitCommand();
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('exit');
      });

      try {
        await cmd.parseAsync(['node', 'test', '--yes', '--skip-analysis', '--verbose']);
      } catch (e) {
        // Expected
      }

      // New behavior: auto-refresh when AX.md exists
      // With --verbose, it logs "AX.md exists, refreshing..."
      expect(prompts.log.info).toHaveBeenCalledWith(
        expect.stringContaining('exists, refreshing')
      );
      exitSpy.mockRestore();
    });

    it('should use verbose logging when --verbose is set', async () => {
      vi.mocked(fs.existsSync).mockImplementation((path) => {
        const pathStr = String(path);
        return pathStr.includes('.git');
      });

      const cmd = createInitCommand();
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('exit');
      });

      try {
        await cmd.parseAsync(['node', 'test', '--yes', '--verbose', '--skip-analysis']);
      } catch (e) {
        // Expected
      }

      expect(prompts.log.info).toHaveBeenCalledWith(
        expect.stringContaining('Working directory')
      );
      exitSpy.mockRestore();
    });
  });
});
