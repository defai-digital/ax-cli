/**
 * Tests for utils/project-index-manager module
 * Tests project index and summary management, caching, and regeneration
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';

// Mock fs module
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  statSync: vi.fn(),
  renameSync: vi.fn(),
  unlinkSync: vi.fn(),
}));

// Mock constants
vi.mock('../../packages/core/src/constants.js', () => ({
  FILE_NAMES: {
    AX_INDEX_JSON: 'ax.index.json',
    AX_SUMMARY_JSON: 'ax.summary.json',
  },
}));

// Mock ProjectAnalyzer
const mockAnalyze = vi.fn();
vi.mock('../../packages/core/src/utils/project-analyzer.js', () => ({
  ProjectAnalyzer: class MockProjectAnalyzer {
    constructor(_projectRoot: string) {}
    analyze = mockAnalyze;
  },
}));

// Mock LLMOptimizedInstructionGenerator
const mockGenerateIndex = vi.fn();
const mockGenerateSummary = vi.fn();
vi.mock('../../packages/core/src/utils/llm-optimized-instruction-generator.js', () => ({
  LLMOptimizedInstructionGenerator: class MockLLMOptimizedInstructionGenerator {
    constructor(_options?: unknown) {}
    generateIndex = mockGenerateIndex;
    generateSummary = mockGenerateSummary;
  },
}));

import {
  ProjectIndexManager,
  getProjectIndexManager,
  resetProjectIndexManager,
} from '../../packages/core/src/utils/project-index-manager.js';

describe('ProjectIndexManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetProjectIndexManager();
    // Default mock behavior
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(fs.readFileSync).mockReturnValue('');
    vi.mocked(fs.statSync).mockReturnValue({
      mtimeMs: Date.now(),
    } as fs.Stats);
    mockAnalyze.mockResolvedValue({ success: false });
    mockGenerateIndex.mockReturnValue('{}');
    mockGenerateSummary.mockReturnValue('{}');
  });

  describe('constructor', () => {
    it('should create manager with custom project root', () => {
      const manager = new ProjectIndexManager('/custom/path');
      expect(manager.getIndexPath()).toBe('/custom/path/ax.index.json');
      expect(manager.getSummaryPath()).toBe('/custom/path/ax.summary.json');
    });

    it('should create manager with default project root (cwd)', () => {
      const manager = new ProjectIndexManager();
      expect(manager.getIndexPath()).toContain('ax.index.json');
      expect(manager.getSummaryPath()).toContain('ax.summary.json');
    });
  });

  describe('getIndexPath / getSummaryPath', () => {
    it('should return correct index path', () => {
      const manager = new ProjectIndexManager('/project');
      expect(manager.getIndexPath()).toBe('/project/ax.index.json');
    });

    it('should return correct summary path', () => {
      const manager = new ProjectIndexManager('/project');
      expect(manager.getSummaryPath()).toBe('/project/ax.summary.json');
    });
  });

  describe('exists', () => {
    it('should return true when index file exists', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);

      const manager = new ProjectIndexManager('/project');
      expect(manager.exists()).toBe(true);
    });

    it('should return false when index file does not exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const manager = new ProjectIndexManager('/project');
      expect(manager.exists()).toBe(false);
    });
  });

  describe('summaryExists', () => {
    it('should return true when summary file exists', () => {
      vi.mocked(fs.existsSync).mockImplementation((path) =>
        String(path).includes('summary')
      );

      const manager = new ProjectIndexManager('/project');
      expect(manager.summaryExists()).toBe(true);
    });

    it('should return false when summary file does not exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const manager = new ProjectIndexManager('/project');
      expect(manager.summaryExists()).toBe(false);
    });
  });

  describe('getStatus', () => {
    it('should return not exists status when index does not exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const manager = new ProjectIndexManager('/project');
      const status = manager.getStatus();

      expect(status.exists).toBe(false);
      expect(status.isStale).toBe(true);
      expect(status.path).toBe('/project/ax.index.json');
    });

    it('should return fresh status when index is less than 24 hours old', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.statSync).mockReturnValue({
        mtimeMs: Date.now() - 1000 * 60 * 60, // 1 hour ago
      } as fs.Stats);

      const manager = new ProjectIndexManager('/project');
      const status = manager.getStatus();

      expect(status.exists).toBe(true);
      expect(status.isStale).toBe(false);
      expect(status.ageHours).toBeCloseTo(1, 0);
    });

    it('should return stale status when index is more than 24 hours old', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.statSync).mockReturnValue({
        mtimeMs: Date.now() - 1000 * 60 * 60 * 30, // 30 hours ago
      } as fs.Stats);

      const manager = new ProjectIndexManager('/project');
      const status = manager.getStatus();

      expect(status.exists).toBe(true);
      expect(status.isStale).toBe(true);
      expect(status.ageHours).toBeCloseTo(30, 0);
    });

    it('should include summary status', () => {
      vi.mocked(fs.existsSync).mockImplementation((path) =>
        String(path).includes('summary')
      );

      const manager = new ProjectIndexManager('/project');
      const status = manager.getStatus();

      expect(status.summaryExists).toBe(true);
      expect(status.summaryPath).toBe('/project/ax.summary.json');
    });

    it('should return not exists when statSync throws', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.statSync).mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const manager = new ProjectIndexManager('/project');
      const status = manager.getStatus();

      expect(status.exists).toBe(false);
      expect(status.isStale).toBe(true);
    });
  });

  describe('isStale', () => {
    it('should return true when index does not exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const manager = new ProjectIndexManager('/project');
      expect(manager.isStale()).toBe(true);
    });

    it('should return true when index is older than 24 hours', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.statSync).mockReturnValue({
        mtimeMs: Date.now() - 1000 * 60 * 60 * 25, // 25 hours ago
      } as fs.Stats);

      const manager = new ProjectIndexManager('/project');
      expect(manager.isStale()).toBe(true);
    });

    it('should return false when index is fresh', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.statSync).mockReturnValue({
        mtimeMs: Date.now() - 1000 * 60 * 60, // 1 hour ago
      } as fs.Stats);

      const manager = new ProjectIndexManager('/project');
      expect(manager.isStale()).toBe(false);
    });
  });

  describe('load', () => {
    it('should return null when index does not exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const manager = new ProjectIndexManager('/project');
      expect(manager.load()).toBeNull();
    });

    it('should load and return index content', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue('{"projectName":"test"}');

      const manager = new ProjectIndexManager('/project');
      const content = manager.load();

      expect(content).toBe('{"projectName":"test"}');
    });

    it('should cache loaded content', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue('{"cached":"data"}');

      const manager = new ProjectIndexManager('/project');

      manager.load();
      manager.load();

      expect(fs.readFileSync).toHaveBeenCalledTimes(1);
    });

    it('should return null when readFileSync throws', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockImplementation(() => {
        throw new Error('Read error');
      });

      const manager = new ProjectIndexManager('/project');
      expect(manager.load()).toBeNull();
    });
  });

  describe('loadData', () => {
    it('should return null when load fails', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const manager = new ProjectIndexManager('/project');
      expect(manager.loadData()).toBeNull();
    });

    it('should parse and return JSON data', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue('{"projectName":"test","projectType":"node"}');

      const manager = new ProjectIndexManager('/project');
      const data = manager.loadData();

      expect(data?.projectName).toBe('test');
      expect(data?.projectType).toBe('node');
    });

    it('should cache parsed data', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue('{"projectName":"cached"}');

      const manager = new ProjectIndexManager('/project');

      manager.loadData();
      manager.loadData();

      expect(fs.readFileSync).toHaveBeenCalledTimes(1);
    });

    it('should return null for invalid JSON', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue('not valid json');

      const manager = new ProjectIndexManager('/project');
      expect(manager.loadData()).toBeNull();
    });
  });

  describe('loadSummary', () => {
    it('should return null when summary does not exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const manager = new ProjectIndexManager('/project');
      expect(manager.loadSummary()).toBeNull();
    });

    it('should load and return summary content', () => {
      vi.mocked(fs.existsSync).mockImplementation((path) =>
        String(path).includes('summary')
      );
      vi.mocked(fs.readFileSync).mockReturnValue('{"schemaVersion":"1.0"}');

      const manager = new ProjectIndexManager('/project');
      const content = manager.loadSummary();

      expect(content).toBe('{"schemaVersion":"1.0"}');
    });

    it('should cache loaded summary', () => {
      vi.mocked(fs.existsSync).mockImplementation((path) =>
        String(path).includes('summary')
      );
      vi.mocked(fs.readFileSync).mockReturnValue('{"cached":"summary"}');

      const manager = new ProjectIndexManager('/project');

      manager.loadSummary();
      manager.loadSummary();

      expect(fs.readFileSync).toHaveBeenCalledTimes(1);
    });

    it('should return null when readFileSync throws', () => {
      vi.mocked(fs.existsSync).mockImplementation((path) =>
        String(path).includes('summary')
      );
      vi.mocked(fs.readFileSync).mockImplementation(() => {
        throw new Error('Read error');
      });

      const manager = new ProjectIndexManager('/project');
      expect(manager.loadSummary()).toBeNull();
    });
  });

  describe('loadSummaryData', () => {
    it('should return null when loadSummary fails', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const manager = new ProjectIndexManager('/project');
      expect(manager.loadSummaryData()).toBeNull();
    });

    it('should parse and return summary JSON data', () => {
      vi.mocked(fs.existsSync).mockImplementation((path) =>
        String(path).includes('summary')
      );
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({
        schemaVersion: '1.0',
        generatedAt: '2024-01-01',
        project: { name: 'test', type: 'node', language: 'typescript' },
        indexFile: 'ax.index.json',
      }));

      const manager = new ProjectIndexManager('/project');
      const data = manager.loadSummaryData();

      expect(data?.schemaVersion).toBe('1.0');
      expect(data?.project.name).toBe('test');
    });

    it('should cache parsed summary data', () => {
      vi.mocked(fs.existsSync).mockImplementation((path) =>
        String(path).includes('summary')
      );
      vi.mocked(fs.readFileSync).mockReturnValue('{"schemaVersion":"1.0","generatedAt":"2024-01-01","project":{"name":"test","type":"node","language":"ts"},"indexFile":"ax.index.json"}');

      const manager = new ProjectIndexManager('/project');

      manager.loadSummaryData();
      manager.loadSummaryData();

      expect(fs.readFileSync).toHaveBeenCalledTimes(1);
    });

    it('should return null for invalid JSON', () => {
      vi.mocked(fs.existsSync).mockImplementation((path) =>
        String(path).includes('summary')
      );
      vi.mocked(fs.readFileSync).mockReturnValue('invalid json');

      const manager = new ProjectIndexManager('/project');
      expect(manager.loadSummaryData()).toBeNull();
    });
  });

  describe('clearCache', () => {
    it('should clear all caches', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue('{"test":"data"}');

      const manager = new ProjectIndexManager('/project');

      // Load to populate cache
      manager.load();
      manager.loadData();

      // Clear cache
      manager.clearCache();

      // Next load should read from file again
      manager.load();

      expect(fs.readFileSync).toHaveBeenCalledTimes(2);
    });
  });

  describe('regenerate', () => {
    it('should return false when analysis fails', async () => {
      mockAnalyze.mockResolvedValue({ success: false, error: 'Analysis failed' });

      const manager = new ProjectIndexManager('/project');
      const result = await manager.regenerate();

      expect(result).toBe(false);
    });

    it('should return false when analysis has no projectInfo', async () => {
      mockAnalyze.mockResolvedValue({ success: true, projectInfo: null });

      const manager = new ProjectIndexManager('/project');
      const result = await manager.regenerate();

      expect(result).toBe(false);
    });

    it('should generate index and summary on success', async () => {
      mockAnalyze.mockResolvedValue({
        success: true,
        projectInfo: { name: 'test-project' },
      });
      mockGenerateIndex.mockReturnValue('{"generated":"index"}');
      mockGenerateSummary.mockReturnValue('{"generated":"summary"}');

      const manager = new ProjectIndexManager('/project');
      const result = await manager.regenerate();

      expect(result).toBe(true);
      expect(mockGenerateIndex).toHaveBeenCalled();
      expect(mockGenerateSummary).toHaveBeenCalled();
      expect(fs.writeFileSync).toHaveBeenCalledTimes(2);
      expect(fs.renameSync).toHaveBeenCalledTimes(2);
    });

    it('should write files atomically with temp files', async () => {
      mockAnalyze.mockResolvedValue({
        success: true,
        projectInfo: { name: 'test' },
      });

      const manager = new ProjectIndexManager('/project');
      await manager.regenerate();

      // Should write to temp files first
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        '/project/ax.index.json.tmp',
        expect.any(String),
        'utf-8'
      );
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        '/project/ax.summary.json.tmp',
        expect.any(String),
        'utf-8'
      );

      // Then rename to final paths
      expect(fs.renameSync).toHaveBeenCalledWith(
        '/project/ax.index.json.tmp',
        '/project/ax.index.json'
      );
    });

    it('should clear cache after successful regeneration', async () => {
      mockAnalyze.mockResolvedValue({
        success: true,
        projectInfo: { name: 'test' },
      });

      // Pre-populate cache
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue('{"old":"data"}');

      const manager = new ProjectIndexManager('/project');
      manager.load(); // Populate cache

      await manager.regenerate();

      // Next load should read from file again
      vi.mocked(fs.readFileSync).mockReturnValue('{"new":"data"}');
      const content = manager.load();

      expect(content).toBe('{"new":"data"}');
    });

    it('should log verbose messages when verbose option is true', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      mockAnalyze.mockResolvedValue({
        success: true,
        projectInfo: { name: 'test' },
      });

      const manager = new ProjectIndexManager('/project');
      await manager.regenerate({ verbose: true });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Regenerated project index')
      );
      consoleSpy.mockRestore();
    });

    it('should cleanup temp files on error', async () => {
      mockAnalyze.mockResolvedValue({
        success: true,
        projectInfo: { name: 'test' },
      });
      vi.mocked(fs.writeFileSync).mockImplementation(() => {
        throw new Error('Write error');
      });
      vi.mocked(fs.existsSync).mockReturnValue(true);

      const manager = new ProjectIndexManager('/project');
      const result = await manager.regenerate();

      expect(result).toBe(false);
      expect(fs.unlinkSync).toHaveBeenCalled();
    });
  });

  describe('ensureFresh', () => {
    it('should return cached content when not stale', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.statSync).mockReturnValue({
        mtimeMs: Date.now() - 1000 * 60 * 60, // 1 hour ago
      } as fs.Stats);
      vi.mocked(fs.readFileSync).mockReturnValue('{"fresh":"data"}');

      const manager = new ProjectIndexManager('/project');
      const result = await manager.ensureFresh();

      expect(result).toBe('{"fresh":"data"}');
      expect(mockAnalyze).not.toHaveBeenCalled();
    });

    it('should regenerate when force option is true', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.statSync).mockReturnValue({
        mtimeMs: Date.now() - 1000 * 60, // 1 minute ago (fresh)
      } as fs.Stats);
      vi.mocked(fs.readFileSync).mockReturnValue('{"data":"value"}');
      mockAnalyze.mockResolvedValue({
        success: true,
        projectInfo: { name: 'test' },
      });

      const manager = new ProjectIndexManager('/project');
      await manager.ensureFresh({ force: true });

      expect(mockAnalyze).toHaveBeenCalled();
    });

    it('should regenerate when index is stale', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.statSync).mockReturnValue({
        mtimeMs: Date.now() - 1000 * 60 * 60 * 30, // 30 hours ago
      } as fs.Stats);
      vi.mocked(fs.readFileSync).mockReturnValue('{"stale":"data"}');
      mockAnalyze.mockResolvedValue({
        success: true,
        projectInfo: { name: 'test' },
      });

      const manager = new ProjectIndexManager('/project');
      await manager.ensureFresh();

      expect(mockAnalyze).toHaveBeenCalled();
    });

    it('should regenerate when index does not exist', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      mockAnalyze.mockResolvedValue({
        success: true,
        projectInfo: { name: 'test' },
      });

      const manager = new ProjectIndexManager('/project');
      await manager.ensureFresh();

      expect(mockAnalyze).toHaveBeenCalled();
    });

    it('should return old index if regeneration fails but index exists', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.statSync).mockReturnValue({
        mtimeMs: Date.now() - 1000 * 60 * 60 * 30, // 30 hours ago (stale)
      } as fs.Stats);
      vi.mocked(fs.readFileSync).mockReturnValue('{"old":"data"}');
      mockAnalyze.mockResolvedValue({ success: false });

      const manager = new ProjectIndexManager('/project');
      const result = await manager.ensureFresh();

      expect(result).toBe('{"old":"data"}');
    });

    it('should return null if regeneration fails and no index exists', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      mockAnalyze.mockResolvedValue({ success: false });

      const manager = new ProjectIndexManager('/project');
      const result = await manager.ensureFresh();

      expect(result).toBeNull();
    });
  });

  describe('getPromptContext', () => {
    it('should return null when no summary or index exists', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const manager = new ProjectIndexManager('/project');
      expect(manager.getPromptContext()).toBeNull();
    });

    it('should format summary data for prompt when summary exists', () => {
      vi.mocked(fs.existsSync).mockImplementation((path) =>
        String(path).includes('summary')
      );
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({
        schemaVersion: '1.0',
        generatedAt: '2024-01-01',
        project: {
          name: 'test-project',
          type: 'node',
          language: 'typescript',
          techStack: ['react', 'express'],
        },
        directories: { src: 'Source code', tests: 'Test files' },
        commands: { build: 'npm run build', test: 'npm test' },
        gotchas: ['Use pnpm', 'Run build first'],
        indexFile: 'ax.index.json',
      }));

      const manager = new ProjectIndexManager('/project');
      const context = manager.getPromptContext();

      expect(context).toContain('<project-context>');
      expect(context).toContain('Project: test-project');
      expect(context).toContain('Type: node');
      expect(context).toContain('Language: typescript');
      expect(context).toContain('Tech Stack: react, express');
      expect(context).toContain('Directories:');
      expect(context).toContain('Commands:');
      expect(context).toContain('Key Notes:');
      expect(context).toContain('</project-context>');
    });

    it('should generate dynamic summary from index when summary is missing', () => {
      // Index exists but not summary
      vi.mocked(fs.existsSync).mockImplementation((path) =>
        String(path).includes('index') && !String(path).includes('summary')
      );
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({
        name: 'fallback-project',
        projectType: 'library',
        primaryLanguage: 'javascript',
        techStack: ['webpack'],
      }));

      const manager = new ProjectIndexManager('/project');
      const context = manager.getPromptContext();

      expect(context).toContain('<project-context>');
      expect(context).toContain('Project: fallback-project');
      expect(context).toContain('Type: library');
      expect(context).toContain('Language: javascript');
    });

    it('should handle invalid JSON in index with minimal context', () => {
      vi.mocked(fs.existsSync).mockImplementation((path) =>
        String(path).includes('index') && !String(path).includes('summary')
      );
      vi.mocked(fs.readFileSync).mockReturnValue('invalid json');

      const manager = new ProjectIndexManager('/project');
      const context = manager.getPromptContext();

      expect(context).toContain('ax.index.json');
    });

    it('should include directories and commands from index fallback', () => {
      vi.mocked(fs.existsSync).mockImplementation((path) =>
        String(path).includes('index') && !String(path).includes('summary')
      );
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({
        projectName: 'test',
        directories: { src: 'Source', lib: 'Libraries' },
        scripts: { build: 'npm build', test: 'npm test', lint: 'npm lint' },
        gotchas: ['Warning 1', 'Warning 2'],
      }));

      const manager = new ProjectIndexManager('/project');
      const context = manager.getPromptContext();

      expect(context).toContain('Directories:');
      expect(context).toContain('Commands:');
      expect(context).toContain('Key Notes:');
    });
  });
});

describe('getProjectIndexManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetProjectIndexManager();
  });

  it('should return singleton instance without projectRoot', () => {
    const manager1 = getProjectIndexManager();
    const manager2 = getProjectIndexManager();

    expect(manager1).toBe(manager2);
  });

  it('should return new instance with custom projectRoot', () => {
    const defaultManager = getProjectIndexManager();
    const customManager = getProjectIndexManager('/custom/path');

    expect(defaultManager).not.toBe(customManager);
  });

  it('should create new instances for different projectRoots', () => {
    const manager1 = getProjectIndexManager('/path1');
    const manager2 = getProjectIndexManager('/path2');

    expect(manager1).not.toBe(manager2);
  });
});

describe('resetProjectIndexManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should reset singleton so new instance is created', () => {
    const manager1 = getProjectIndexManager();

    resetProjectIndexManager();

    const manager2 = getProjectIndexManager();

    expect(manager1).not.toBe(manager2);
  });
});
