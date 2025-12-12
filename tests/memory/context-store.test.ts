/**
 * Tests for memory/context-store.ts
 * Tests the context store for managing project memory
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// Mock the modules that cause config loading issues
vi.mock('../../packages/core/src/constants.js', () => ({
  CONFIG_DIR_NAME: '.ax-cli',
  APP_NAME: 'ax-cli',
}));

vi.mock('../../packages/core/src/utils/json-utils.js', () => ({
  parseJsonFile: vi.fn(),
}));

vi.mock('../../packages/core/src/memory/schemas.js', () => ({
  safeValidateProjectMemory: vi.fn(),
}));

// Mock fs module
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual,
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn(),
    renameSync: vi.fn(),
    unlinkSync: vi.fn(),
  };
});

import {
  ContextStore,
  getContextStore,
  resetDefaultStore,
} from '../../packages/core/src/memory/context-store.js';
import { parseJsonFile } from '../../packages/core/src/utils/json-utils.js';
import { safeValidateProjectMemory } from '../../packages/core/src/memory/schemas.js';

// Create a properly structured ProjectMemory for testing
const createValidMemory = (tokenEstimate: number = 1000) => ({
  version: 1 as const,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  project_root: '/test/project',
  content_hash: 'sha256:' + 'a'.repeat(64),
  source: {
    directories: [{ path: 'src', max_depth: 3 }],
    files: ['README.md'],
    ignore: ['node_modules'],
  },
  context: {
    formatted: 'Test context content',
    token_estimate: tokenEstimate,
    sections: {
      structure: 500,
      readme: 300,
      config: 200,
    },
  },
  stats: {
    usage_count: 5,
    total_tokens_saved: 10000,
    last_used_at: new Date().toISOString(),
  },
});

describe('ContextStore', () => {
  const testProjectRoot = '/test/project';
  let store: ContextStore;

  beforeEach(() => {
    vi.resetAllMocks();
    resetDefaultStore();
    store = new ContextStore(testProjectRoot);
  });

  afterEach(() => {
    vi.resetAllMocks();
    resetDefaultStore();
  });

  describe('constructor', () => {
    it('should set correct paths', () => {
      expect(store.getMemoryPath()).toBe(
        path.join(testProjectRoot, '.ax-cli', 'memory.json')
      );
      expect(store.getConfigDir()).toBe(
        path.join(testProjectRoot, '.ax-cli')
      );
    });

    it('should use cwd when no projectRoot provided', () => {
      const defaultStore = new ContextStore();
      expect(defaultStore.getConfigDir()).toContain('.ax-cli');
    });
  });

  describe('getMemoryPath', () => {
    it('should return memory path', () => {
      const memoryPath = store.getMemoryPath();
      expect(memoryPath).toContain('memory.json');
    });
  });

  describe('getConfigDir', () => {
    it('should return config directory', () => {
      const configDir = store.getConfigDir();
      expect(configDir).toContain('.ax-cli');
    });
  });

  describe('exists', () => {
    it('should return true when memory file exists', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      expect(store.exists()).toBe(true);
    });

    it('should return false when memory file does not exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      expect(store.exists()).toBe(false);
    });
  });

  describe('configDirExists', () => {
    it('should return true when config dir exists', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      expect(store.configDirExists()).toBe(true);
    });

    it('should return false when config dir does not exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      expect(store.configDirExists()).toBe(false);
    });
  });

  describe('load', () => {
    it('should return error when file does not exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const result = store.load();

      expect(result.success).toBe(false);
      expect((result as { error: string }).error).toContain('not found');
    });

    it('should return error for invalid JSON', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(parseJsonFile).mockReturnValue({
        success: false,
        error: 'Failed to parse JSON'
      });

      const result = store.load();

      expect(result.success).toBe(false);
      expect((result as { error: string }).error).toContain('parse');
    });

    it('should load valid memory file', () => {
      const memory = createValidMemory();
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(parseJsonFile).mockReturnValue({ success: true, data: memory });
      vi.mocked(safeValidateProjectMemory).mockReturnValue({ success: true, data: memory });

      const result = store.load();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.project_root).toBe('/test/project');
      }
    });

    it('should return error for invalid schema', () => {
      const invalidMemory = { invalid: 'data' };
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(parseJsonFile).mockReturnValue({ success: true, data: invalidMemory });
      vi.mocked(safeValidateProjectMemory).mockReturnValue({
        success: false,
        error: 'Invalid schema'
      });

      const result = store.load();

      expect(result.success).toBe(false);
      expect((result as { error: string }).error).toContain('schema');
    });
  });

  describe('save', () => {
    it('should create config directory if not exists', () => {
      const memory = createValidMemory();
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(safeValidateProjectMemory).mockReturnValue({ success: true, data: memory });

      store.save(memory);

      expect(fs.mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('.ax-cli'),
        { recursive: true }
      );
    });

    it('should write to temp file and rename', () => {
      const memory = createValidMemory();
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(safeValidateProjectMemory).mockReturnValue({ success: true, data: memory });

      const result = store.save(memory);

      expect(result.success).toBe(true);
      expect(fs.writeFileSync).toHaveBeenCalled();
      expect(fs.renameSync).toHaveBeenCalled();
    });

    it('should return error for invalid memory data', () => {
      const invalidMemory = { invalid: 'data' };
      vi.mocked(safeValidateProjectMemory).mockReturnValue({
        success: false,
        error: 'Invalid data'
      });

      const result = store.save(invalidMemory as unknown as ReturnType<typeof createValidMemory>);

      expect(result.success).toBe(false);
      expect((result as { error: string }).error).toContain('Invalid');
    });

    it('should handle write errors', () => {
      const memory = createValidMemory();
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(safeValidateProjectMemory).mockReturnValue({ success: true, data: memory });
      vi.mocked(fs.writeFileSync).mockImplementation(() => {
        throw new Error('Write failed');
      });

      const result = store.save(memory);

      expect(result.success).toBe(false);
      expect((result as { error: string }).error).toContain('Write failed');
    });

    it('should clean up temp file on error', () => {
      const memory = createValidMemory();
      vi.mocked(fs.existsSync).mockImplementation((p) => {
        if (String(p).endsWith('.tmp')) return true;
        return true;
      });
      vi.mocked(safeValidateProjectMemory).mockReturnValue({ success: true, data: memory });
      vi.mocked(fs.writeFileSync).mockImplementation(() => {
        throw new Error('Write failed');
      });

      store.save(memory);

      expect(fs.unlinkSync).toHaveBeenCalled();
    });
  });

  describe('updateStats', () => {
    it('should update stats in memory', () => {
      const memory = createValidMemory();
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(parseJsonFile).mockReturnValue({ success: true, data: memory });
      // Mock validation to return success for any input (called by both load and save)
      vi.mocked(safeValidateProjectMemory).mockImplementation((data) => ({
        success: true,
        data: data as ReturnType<typeof createValidMemory>
      }));

      const result = store.updateStats({ usage_count: 10 });

      expect(result.success).toBe(true);
      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('should return error if load fails', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const result = store.updateStats({ usage_count: 10 });

      expect(result.success).toBe(false);
    });
  });

  describe('recordUsage', () => {
    it('should increment usage count and record tokens', () => {
      const memory = createValidMemory();
      memory.stats = {
        usage_count: 5,
        total_tokens_saved: 1000,
        last_used_at: new Date().toISOString(),
      };
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(parseJsonFile).mockReturnValue({ success: true, data: memory });
      // Mock validation to return success for any input (called multiple times)
      vi.mocked(safeValidateProjectMemory).mockImplementation((data) => ({
        success: true,
        data: data as ReturnType<typeof createValidMemory>
      }));

      const result = store.recordUsage(100, 50);

      expect(result.success).toBe(true);
    });

    it('should return error if memory does not exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const result = store.recordUsage(100, 50);

      expect(result.success).toBe(false);
      expect((result as { error: string }).error).toContain('stats not recorded');
    });
  });

  describe('clear', () => {
    it('should delete memory file', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);

      const result = store.clear();

      expect(result.success).toBe(true);
      expect(fs.unlinkSync).toHaveBeenCalled();
    });

    it('should succeed if file does not exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const result = store.clear();

      expect(result.success).toBe(true);
      expect(fs.unlinkSync).not.toHaveBeenCalled();
    });

    it('should return error on delete failure', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.unlinkSync).mockImplementation(() => {
        throw new Error('Delete failed');
      });

      const result = store.clear();

      expect(result.success).toBe(false);
      expect((result as { error: string }).error).toContain('Delete failed');
    });
  });

  describe('getMetadata', () => {
    it('should return exists: false when file does not exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const metadata = store.getMetadata();

      expect(metadata.exists).toBe(false);
      expect(metadata.tokenEstimate).toBeUndefined();
    });

    it('should return metadata when file exists', () => {
      const memory = createValidMemory(5000);
      memory.stats = { usage_count: 10, last_used_at: new Date().toISOString() };
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(parseJsonFile).mockReturnValue({ success: true, data: memory });
      vi.mocked(safeValidateProjectMemory).mockReturnValue({ success: true, data: memory });

      const metadata = store.getMetadata();

      expect(metadata.exists).toBe(true);
      expect(metadata.tokenEstimate).toBe(5000);
      expect(metadata.usageCount).toBe(10);
    });

    it('should return exists: false when load fails', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(parseJsonFile).mockReturnValue({ success: false, error: 'Parse error' });

      const metadata = store.getMetadata();

      expect(metadata.exists).toBe(false);
    });
  });
});

describe('getContextStore', () => {
  beforeEach(() => {
    resetDefaultStore();
  });

  afterEach(() => {
    resetDefaultStore();
  });

  it('should return singleton instance without projectRoot', () => {
    const store1 = getContextStore();
    const store2 = getContextStore();
    expect(store1).toBe(store2);
  });

  it('should return new instance with projectRoot', () => {
    const store1 = getContextStore('/project1');
    const store2 = getContextStore('/project2');
    expect(store1).not.toBe(store2);
  });

  it('should return different instance from singleton', () => {
    const singleton = getContextStore();
    const custom = getContextStore('/custom');
    expect(singleton).not.toBe(custom);
  });
});

describe('resetDefaultStore', () => {
  it('should reset singleton', () => {
    const store1 = getContextStore();
    resetDefaultStore();
    const store2 = getContextStore();
    expect(store1).not.toBe(store2);
  });
});
