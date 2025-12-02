import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import {
  addAlias,
  removeAlias,
  listAliases,
  resolveAlias,
  setDefaultFile,
  setDsFile,
  getAlias,
  hasAlias,
  getAliasesForFile,
  loadDesignConfig,
  saveDesignConfig,
  getDesignConfigPath,
} from '../../src/design/figma-alias.js';

describe('figma-alias', () => {
  const testDir = join(process.cwd(), 'test-figma-alias-temp');

  beforeEach(() => {
    // Create test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    // Clean up test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
  });

  describe('getDesignConfigPath', () => {
    it('should return correct path', () => {
      const path = getDesignConfigPath(testDir);
      expect(path).toBe(join(testDir, '.ax-cli', 'design.json'));
    });
  });

  describe('loadDesignConfig', () => {
    it('should return empty config if file does not exist', () => {
      const config = loadDesignConfig(testDir);
      expect(config.aliases).toEqual({});
      expect(config.defaultFile).toBeUndefined();
    });

    it('should load existing config', () => {
      // First save a config using the proper API
      const result = addAlias('my-alias', 'abc', '1:1', { basePath: testDir });
      expect(result.success).toBe(true);

      setDefaultFile('default-file', { basePath: testDir });

      // Now load and verify
      const config = loadDesignConfig(testDir);
      expect(config.aliases['my-alias']).toBeDefined();
      expect(config.defaultFile).toBe('default-file');
    });
  });

  describe('saveDesignConfig', () => {
    it('should create config file and directory', () => {
      const config = {
        aliases: { test: { fileKey: 'abc', nodeId: '1:1', updatedAt: new Date().toISOString() } },
      };

      saveDesignConfig(config, testDir);

      const configPath = getDesignConfigPath(testDir);
      expect(existsSync(configPath)).toBe(true);

      const saved = JSON.parse(readFileSync(configPath, 'utf-8'));
      expect(saved.aliases.test).toBeDefined();
      expect(saved.meta.lastModified).toBeDefined();
    });
  });

  describe('addAlias', () => {
    it('should add a new alias', () => {
      const result = addAlias('button', 'file-123', '1:234', { basePath: testDir });

      expect(result.success).toBe(true);
      expect(result.alias).toBe('button');
      expect(result.target).toBeDefined();
      expect(result.target?.fileKey).toBe('file-123');
      expect(result.target?.nodeId).toBe('1:234');
    });

    it('should add alias with description', () => {
      const result = addAlias('button', 'file-123', '1:234', {
        basePath: testDir,
        description: 'Primary button component',
      });

      expect(result.success).toBe(true);
      expect(result.target?.description).toBe('Primary button component');
    });

    it('should update existing alias', () => {
      addAlias('button', 'file-123', '1:234', { basePath: testDir });
      const result = addAlias('button', 'file-456', '5:678', { basePath: testDir });

      expect(result.success).toBe(true);
      expect(result.message).toContain('Updated');
      expect(result.target?.fileKey).toBe('file-456');
      expect(result.target?.nodeId).toBe('5:678');
    });

    it('should reject empty alias name', () => {
      const result = addAlias('', 'file-123', '1:234', { basePath: testDir });
      expect(result.success).toBe(false);
    });
  });

  describe('removeAlias', () => {
    it('should remove existing alias', () => {
      addAlias('button', 'file-123', '1:234', { basePath: testDir });
      const result = removeAlias('button', { basePath: testDir });

      expect(result.success).toBe(true);
      expect(result.message).toContain('Removed');
    });

    it('should fail to remove non-existent alias', () => {
      const result = removeAlias('nonexistent', { basePath: testDir });

      expect(result.success).toBe(false);
      expect(result.message).toContain('not found');
    });
  });

  describe('listAliases', () => {
    it('should return empty list when no aliases', () => {
      const response = listAliases({ basePath: testDir });

      expect(response.aliases).toEqual([]);
      expect(response.total).toBe(0);
    });

    it('should return all aliases sorted by name', () => {
      addAlias('zebra', 'file-1', '1:1', { basePath: testDir });
      addAlias('alpha', 'file-2', '2:2', { basePath: testDir });
      addAlias('beta', 'file-3', '3:3', { basePath: testDir });

      const response = listAliases({ basePath: testDir });

      expect(response.total).toBe(3);
      expect(response.aliases[0].alias).toBe('alpha');
      expect(response.aliases[1].alias).toBe('beta');
      expect(response.aliases[2].alias).toBe('zebra');
    });

    it('should include default and ds file info', () => {
      setDefaultFile('default-key', { basePath: testDir });
      setDsFile('ds-key', { basePath: testDir });

      const response = listAliases({ basePath: testDir });

      expect(response.defaultFile).toBe('default-key');
      expect(response.dsFile).toBe('ds-key');
    });
  });

  describe('resolveAlias', () => {
    it('should resolve existing alias', () => {
      addAlias('button', 'file-123', '1:234', { basePath: testDir });
      const result = resolveAlias('button', { basePath: testDir });

      expect('error' in result).toBe(false);
      if (!('error' in result)) {
        expect(result.fileKey).toBe('file-123');
        expect(result.nodeId).toBe('1:234');
        expect(result.source).toBe('explicit');
      }
    });

    it('should resolve node ID with default file', () => {
      setDefaultFile('default-file', { basePath: testDir });
      const result = resolveAlias('1:234', { basePath: testDir });

      expect('error' in result).toBe(false);
      if (!('error' in result)) {
        expect(result.fileKey).toBe('default-file');
        expect(result.nodeId).toBe('1:234');
        expect(result.source).toBe('default-file');
      }
    });

    it('should fail to resolve node ID without default file', () => {
      const result = resolveAlias('1:234', { basePath: testDir });

      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.error).toContain('No default file');
      }
    });

    it('should return error with suggestions for unknown alias', () => {
      addAlias('primary-button', 'file-123', '1:234', { basePath: testDir });
      const result = resolveAlias('button', { basePath: testDir });

      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.error).toContain('not found');
        expect(result.suggestions).toContain('primary-button');
      }
    });
  });

  describe('setDefaultFile', () => {
    it('should set default file', () => {
      const result = setDefaultFile('my-file-key', { basePath: testDir });

      expect(result.success).toBe(true);

      const config = loadDesignConfig(testDir);
      expect(config.defaultFile).toBe('my-file-key');
    });

    it('should store file name if provided', () => {
      setDefaultFile('my-file-key', { basePath: testDir, fileName: 'My Design' });

      const config = loadDesignConfig(testDir);
      expect(config.meta?.fileNames?.['my-file-key']).toBe('My Design');
    });
  });

  describe('setDsFile', () => {
    it('should set design system file', () => {
      const result = setDsFile('ds-file-key', { basePath: testDir });

      expect(result.success).toBe(true);

      const config = loadDesignConfig(testDir);
      expect(config.dsFile).toBe('ds-file-key');
    });
  });

  describe('getAlias', () => {
    it('should get existing alias', () => {
      addAlias('button', 'file-123', '1:234', { basePath: testDir });
      const target = getAlias('button', { basePath: testDir });

      expect(target).toBeDefined();
      expect(target?.fileKey).toBe('file-123');
    });

    it('should return null for non-existent alias', () => {
      const target = getAlias('nonexistent', { basePath: testDir });
      expect(target).toBeNull();
    });
  });

  describe('hasAlias', () => {
    it('should return true for existing alias', () => {
      addAlias('button', 'file-123', '1:234', { basePath: testDir });
      expect(hasAlias('button', { basePath: testDir })).toBe(true);
    });

    it('should return false for non-existent alias', () => {
      expect(hasAlias('nonexistent', { basePath: testDir })).toBe(false);
    });
  });

  describe('getAliasesForFile', () => {
    it('should get all aliases for a specific file', () => {
      addAlias('button', 'file-123', '1:234', { basePath: testDir });
      addAlias('card', 'file-123', '5:678', { basePath: testDir });
      addAlias('header', 'file-456', '9:012', { basePath: testDir });

      const aliases = getAliasesForFile('file-123', { basePath: testDir });

      expect(aliases.length).toBe(2);
      expect(aliases.some(a => a.alias === 'button')).toBe(true);
      expect(aliases.some(a => a.alias === 'card')).toBe(true);
    });

    it('should return empty array for file with no aliases', () => {
      const aliases = getAliasesForFile('nonexistent', { basePath: testDir });
      expect(aliases).toEqual([]);
    });
  });
});
