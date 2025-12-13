/**
 * Tests for memory schema validation
 */

import { describe, it, expect } from 'vitest';
import {
  DirectoryConfigSchema,
  SourceConfigSchema,
  ContextSectionsSchema,
  ContextDataSchema,
  CacheStatsSchema,
  ProjectMemorySchema,
  safeValidateProjectMemory,
  safeValidateCacheStats,
  safeValidateSourceConfig,
} from '../../packages/core/src/memory/schemas.js';

describe('DirectoryConfigSchema', () => {
  it('should accept valid directory config', () => {
    const result = DirectoryConfigSchema.safeParse({
      path: '/src',
      max_depth: 3,
    });
    expect(result.success).toBe(true);
  });

  it('should reject empty path', () => {
    const result = DirectoryConfigSchema.safeParse({
      path: '',
      max_depth: 3,
    });
    expect(result.success).toBe(false);
  });

  it('should reject max_depth less than 1', () => {
    const result = DirectoryConfigSchema.safeParse({
      path: '/src',
      max_depth: 0,
    });
    expect(result.success).toBe(false);
  });

  it('should reject max_depth greater than 10', () => {
    const result = DirectoryConfigSchema.safeParse({
      path: '/src',
      max_depth: 11,
    });
    expect(result.success).toBe(false);
  });

  it('should reject non-integer max_depth', () => {
    const result = DirectoryConfigSchema.safeParse({
      path: '/src',
      max_depth: 3.5,
    });
    expect(result.success).toBe(false);
  });
});

describe('SourceConfigSchema', () => {
  it('should accept valid source config', () => {
    const result = SourceConfigSchema.safeParse({
      directories: [{ path: '/src', max_depth: 3 }],
      files: ['README.md', 'package.json'],
      ignore: ['node_modules', '.git'],
    });
    expect(result.success).toBe(true);
  });

  it('should accept empty arrays', () => {
    const result = SourceConfigSchema.safeParse({
      directories: [],
      files: [],
      ignore: [],
    });
    expect(result.success).toBe(true);
  });

  it('should accept multiple directories', () => {
    const result = SourceConfigSchema.safeParse({
      directories: [
        { path: '/src', max_depth: 5 },
        { path: '/tests', max_depth: 2 },
      ],
      files: [],
      ignore: [],
    });
    expect(result.success).toBe(true);
  });

  it('should reject invalid directory in array', () => {
    const result = SourceConfigSchema.safeParse({
      directories: [{ path: '', max_depth: 3 }],
      files: [],
      ignore: [],
    });
    expect(result.success).toBe(false);
  });
});

describe('ContextSectionsSchema', () => {
  it('should accept valid context sections', () => {
    const result = ContextSectionsSchema.safeParse({
      structure: 1000,
      readme: 500,
      config: 200,
      patterns: 300,
    });
    expect(result.success).toBe(true);
  });

  it('should accept partial context sections', () => {
    const result = ContextSectionsSchema.safeParse({
      structure: 1000,
    });
    expect(result.success).toBe(true);
  });

  it('should accept empty object', () => {
    const result = ContextSectionsSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('should reject negative values', () => {
    const result = ContextSectionsSchema.safeParse({
      structure: -1,
    });
    expect(result.success).toBe(false);
  });
});

describe('ContextDataSchema', () => {
  it('should accept valid context data', () => {
    const result = ContextDataSchema.safeParse({
      formatted: '# Project Context\n...',
      token_estimate: 5000,
      sections: { structure: 1000, readme: 500 },
    });
    expect(result.success).toBe(true);
  });

  it('should accept empty formatted string', () => {
    const result = ContextDataSchema.safeParse({
      formatted: '',
      token_estimate: 0,
      sections: {},
    });
    expect(result.success).toBe(true);
  });

  it('should reject negative token_estimate', () => {
    const result = ContextDataSchema.safeParse({
      formatted: 'content',
      token_estimate: -1,
      sections: {},
    });
    expect(result.success).toBe(false);
  });
});

describe('CacheStatsSchema', () => {
  it('should accept valid cache stats', () => {
    const result = CacheStatsSchema.safeParse({
      last_cached_tokens: 5000,
      last_prompt_tokens: 3000,
      total_tokens_saved: 10000,
      usage_count: 50,
      last_used_at: '2024-01-15T10:30:00Z',
    });
    expect(result.success).toBe(true);
  });

  it('should accept empty object', () => {
    const result = CacheStatsSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('should accept partial stats', () => {
    const result = CacheStatsSchema.safeParse({
      usage_count: 10,
    });
    expect(result.success).toBe(true);
  });

  it('should reject invalid datetime', () => {
    const result = CacheStatsSchema.safeParse({
      last_used_at: 'not-a-date',
    });
    expect(result.success).toBe(false);
  });

  it('should reject negative values', () => {
    const result = CacheStatsSchema.safeParse({
      total_tokens_saved: -100,
    });
    expect(result.success).toBe(false);
  });
});

describe('ProjectMemorySchema', () => {
  const validProjectMemory = {
    version: 1,
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-15T12:00:00Z',
    project_root: '/home/user/project',
    content_hash: 'sha256:' + 'a'.repeat(64),
    source: {
      directories: [{ path: '/src', max_depth: 3 }],
      files: ['README.md'],
      ignore: ['node_modules'],
    },
    context: {
      formatted: '# Context',
      token_estimate: 1000,
      sections: { structure: 500 },
    },
  };

  it('should accept valid project memory', () => {
    const result = ProjectMemorySchema.safeParse(validProjectMemory);
    expect(result.success).toBe(true);
  });

  it('should accept project memory with stats', () => {
    const result = ProjectMemorySchema.safeParse({
      ...validProjectMemory,
      stats: {
        usage_count: 10,
        total_tokens_saved: 5000,
      },
    });
    expect(result.success).toBe(true);
  });

  it('should reject version other than 1', () => {
    const result = ProjectMemorySchema.safeParse({
      ...validProjectMemory,
      version: 2,
    });
    expect(result.success).toBe(false);
  });

  it('should reject invalid created_at', () => {
    const result = ProjectMemorySchema.safeParse({
      ...validProjectMemory,
      created_at: 'invalid',
    });
    expect(result.success).toBe(false);
  });

  it('should reject empty project_root', () => {
    const result = ProjectMemorySchema.safeParse({
      ...validProjectMemory,
      project_root: '',
    });
    expect(result.success).toBe(false);
  });

  it('should reject invalid content_hash format', () => {
    const result = ProjectMemorySchema.safeParse({
      ...validProjectMemory,
      content_hash: 'invalid-hash',
    });
    expect(result.success).toBe(false);
  });

  it('should reject content_hash without sha256 prefix', () => {
    const result = ProjectMemorySchema.safeParse({
      ...validProjectMemory,
      content_hash: 'md5:' + 'a'.repeat(64),
    });
    expect(result.success).toBe(false);
  });

  it('should reject content_hash with wrong length', () => {
    const result = ProjectMemorySchema.safeParse({
      ...validProjectMemory,
      content_hash: 'sha256:' + 'a'.repeat(32), // Should be 64
    });
    expect(result.success).toBe(false);
  });
});

describe('safeValidateProjectMemory', () => {
  const validData = {
    version: 1,
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-15T12:00:00Z',
    project_root: '/project',
    content_hash: 'sha256:' + 'b'.repeat(64),
    source: { directories: [], files: [], ignore: [] },
    context: { formatted: '', token_estimate: 0, sections: {} },
  };

  it('should return success for valid data', () => {
    const result = safeValidateProjectMemory(validData);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.version).toBe(1);
      expect(result.data.project_root).toBe('/project');
    }
  });

  it('should return error for invalid data', () => {
    const result = safeValidateProjectMemory({ invalid: true });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeDefined();
      expect(typeof result.error).toBe('string');
    }
  });

  it('should format multiple errors', () => {
    const result = safeValidateProjectMemory({
      version: 2, // Invalid
      project_root: '', // Invalid
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      // Should contain error info
      expect(result.error.length).toBeGreaterThan(0);
    }
  });
});

describe('safeValidateCacheStats', () => {
  it('should return success for valid cache stats', () => {
    const result = safeValidateCacheStats({
      usage_count: 10,
      total_tokens_saved: 5000,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.usage_count).toBe(10);
    }
  });

  it('should return success for empty object', () => {
    const result = safeValidateCacheStats({});
    expect(result.success).toBe(true);
  });

  it('should return error for invalid data', () => {
    const result = safeValidateCacheStats({
      usage_count: -1, // Invalid
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeDefined();
    }
  });
});

describe('safeValidateSourceConfig', () => {
  it('should return success for valid source config', () => {
    const result = safeValidateSourceConfig({
      directories: [{ path: '/src', max_depth: 3 }],
      files: ['README.md'],
      ignore: ['node_modules'],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.directories).toHaveLength(1);
    }
  });

  it('should return success for empty source config', () => {
    const result = safeValidateSourceConfig({
      directories: [],
      files: [],
      ignore: [],
    });
    expect(result.success).toBe(true);
  });

  it('should return error for invalid directory', () => {
    const result = safeValidateSourceConfig({
      directories: [{ path: '', max_depth: 0 }],
      files: [],
      ignore: [],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeDefined();
    }
  });

  it('should return error for missing fields', () => {
    const result = safeValidateSourceConfig({
      directories: [],
      // Missing files and ignore
    });
    expect(result.success).toBe(false);
  });
});
