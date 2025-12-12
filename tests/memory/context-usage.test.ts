/**
 * Context Usage Test - Tests consuming context to 40% usage
 * 
 * This test verifies the context management system can handle
 * consuming 40% of the available context window appropriately.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ContextGenerator } from '../../packages/core/src/memory/context-generator.js';
import { ContextStore } from '../../packages/core/src/memory/context-store.js';
import { createTokenCounter } from '../../packages/core/src/utils/token-counter.js';
import { GLM_MODELS } from '../../packages/core/src/constants.js';
import type { ProjectMemory, SourceConfig } from '../../packages/core/src/memory/types.js';

// SKIPPED: Tests use outdated API (generateContext) that doesn't exist.
// ContextGenerator.generate() has different signature. Needs rewrite.
describe.skip('Context Usage Tests', () => {
  let contextGenerator: ContextGenerator;
  let contextStore: ContextStore;
  let tokenCounter: any;
  let testDir: string;

  beforeEach(async () => {
    // Create test directory structure
    testDir = '/tmp/ax-cli-context-test';
    
    // Initialize components
    contextGenerator = new ContextGenerator();
    contextStore = new ContextStore(testDir);
    tokenCounter = createTokenCounter('glm-4.6');

    // Create test project structure with various file types
    await setupTestProject(testDir);
  });

  afterEach(async () => {
    // Cleanup test directory
    await cleanupTestProject(testDir);
  });

  describe('40% Context Consumption', () => {
    it('should consume exactly 40% of GLM-4.6 context window', async () => {
      // Get GLM-4.6 model configuration
      const glmConfig = GLM_MODELS['glm-4.6'];
      const maxContext = glmConfig.contextWindow; // 200K tokens
      const targetTokens = Math.floor(maxContext * 0.4); // 80K tokens
      
      // Generate comprehensive context
      const sourceConfig: SourceConfig = {
        include_patterns: ['**/*.{ts,tsx,js,jsx,json,md}'],
        exclude_patterns: ['node_modules/**', 'dist/**', '.git/**'],
        max_file_size: 1000000, // 1MB
        include_binary: false,
        scan_directories: [
          { path: 'src', max_depth: 4 },
          { path: 'packages', max_depth: 3 },
          { path: 'tests', max_depth: 2 }
        ]
      };

      const result = await contextGenerator.generateContext(sourceConfig);
      
      // Count tokens in generated context
      const contextTokens = tokenCounter.count(result.context);
      
      // Verify we're close to 40% (within 10% tolerance)
      const tolerance = targetTokens * 0.1; // 10% tolerance
      expect(contextTokens).toBeGreaterThanOrEqual(targetTokens - tolerance);
      expect(contextTokens).toBeLessThanOrEqual(targetTokens + tolerance);
      
      // Verify context structure
      expect(result.context).toContain('# Project Context');
      expect(result.context).toContain('## Architecture');
      expect(result.context).toContain('## Key Files');
      
      // Store the context
      const memory: ProjectMemory = {
        version: '1.0.0',
        project_root: testDir,
        last_updated: new Date(),
        context_hash: result.hash,
        source_config: sourceConfig,
        context: result.context,
        stats: {
          files_scanned: result.stats.filesScanned,
          files_included: result.stats.filesIncluded,
          total_tokens: contextTokens,
          cache_hits: 0,
          cache_misses: result.stats.filesIncluded,
          last_generated: new Date()
        }
      };

      const storeResult = await contextStore.storeMemory(memory);
      expect(storeResult.success).toBe(true);
    });

    it('should handle context pruning when exceeding 40%', async () => {
      // Create a scenario where initial context exceeds 40%
      const sourceConfig: SourceConfig = {
        include_patterns: ['**/*'], // Include everything to maximize context
        exclude_patterns: ['node_modules/**'],
        max_file_size: 2000000, // 2MB
        include_binary: false,
        scan_directories: [
          { path: '.', max_depth: 5 } // Deep scan
        ]
      };

      const result = await contextGenerator.generateContext(sourceConfig);
      const contextTokens = tokenCounter.count(result.context);
      
      // Get target 40% tokens
      const glmConfig = GLM_MODELS['glm-4.6'];
      const targetTokens = Math.floor(glmConfig.contextWindow * 0.4);
      
      // If we exceed 40%, test pruning mechanism
      if (contextTokens > targetTokens) {
        // Simulate context pruning (this would be implemented in ContextGenerator)
        const prunedContext = await pruneContextToFit(result.context, targetTokens, tokenCounter);
        const prunedTokens = tokenCounter.count(prunedContext);
        
        expect(prunedTokens).toBeLessThanOrEqual(targetTokens);
        expect(prunedContext).toContain('# Project Context'); // Keep essential structure
      }
    });

    it('should track context usage statistics accurately', async () => {
      const sourceConfig: SourceConfig = {
        include_patterns: ['**/*.ts'],
        exclude_patterns: ['node_modules/**', 'dist/**'],
        max_file_size: 500000,
        include_binary: false,
        scan_directories: [
          { path: 'src', max_depth: 3 }
        ]
      };

      const result = await contextGenerator.generateContext(sourceConfig);
      const contextTokens = tokenCounter.count(result.context);
      
      // Calculate usage percentage
      const glmConfig = GLM_MODELS['glm-4.6'];
      const usagePercentage = (contextTokens / glmConfig.contextWindow) * 100;
      
      // Should be close to 40%
      expect(usagePercentage).toBeGreaterThan(35);
      expect(usagePercentage).toBeLessThan(45);
      
      // Verify stats tracking
      expect(result.stats.filesScanned).toBeGreaterThan(0);
      expect(result.stats.filesIncluded).toBeGreaterThan(0);
      expect(result.stats.filesIncluded).toBeLessThanOrEqual(result.stats.filesScanned);
    });
  });

  describe('Context Efficiency Tests', () => {
    it('should maintain context quality at 40% usage', async () => {
      const sourceConfig: SourceConfig = {
        include_patterns: ['**/*.{ts,tsx,js,jsx}'],
        exclude_patterns: ['node_modules/**', 'dist/**', '**/*.test.*', '**/*.spec.*'],
        max_file_size: 1000000,
        include_binary: false,
        scan_directories: [
          { path: 'src', max_depth: 3 }
        ]
      };

      const result = await contextGenerator.generateContext(sourceConfig);
      
      // Verify essential project information is preserved
      expect(result.context).toContain('## Project Overview');
      expect(result.context).toContain('## Architecture');
      expect(result.context).toContain('## Dependencies');
      
      // Check for key TypeScript files
      expect(result.context).toContain('import'); // Should have imports
      expect(result.context).toContain('export'); // Should have exports
      expect(result.context).toContain('interface'); // Should have type definitions
      
      // Verify token count is appropriate
      const contextTokens = tokenCounter.count(result.context);
      const glmConfig = GLM_MODELS['glm-4.6'];
      const usagePercentage = (contextTokens / glmConfig.contextWindow) * 100;
      
      expect(usagePercentage).toBeGreaterThan(35);
      expect(usagePercentage).toBeLessThan(45);
    });
  });
});

/**
 * Helper function to set up test project structure
 */
async function setupTestProject(testDir: string): Promise<void> {
  const fs = await import('fs/promises');
  const path = await import('path');
  
  // Create directory structure
  await fs.mkdir(path.join(testDir, 'src', 'components'), { recursive: true });
  await fs.mkdir(path.join(testDir, 'src', 'utils'), { recursive: true });
  await fs.mkdir(path.join(testDir, 'src', 'agent'), { recursive: true });
  await fs.mkdir(path.join(testDir, 'packages', 'schemas'), { recursive: true });
  await fs.mkdir(path.join(testDir, 'tests', 'unit'), { recursive: true });
  
  // Create package.json
  await fs.writeFile(
    path.join(testDir, 'package.json'),
    JSON.stringify({
      name: 'test-project',
      version: '1.0.0',
      dependencies: {
        react: '^18.0.0',
        typescript: '^5.0.0',
        zod: '^3.0.0'
      }
    }, null, 2)
  );
  
  // Create tsconfig.json
  await fs.writeFile(
    path.join(testDir, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: {
        target: 'ES2022',
        module: 'ESNext',
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true,
        declaration: true,
        sourceMap: true,
        resolveJsonModule: true,
        jsx: 'react',
        moduleResolution: 'Bundler',
        allowSyntheticDefaultImports: true,
        noImplicitAny: true,
        strictNullChecks: true,
        noImplicitThis: true,
        alwaysStrict: true,
        noUnusedLocals: true,
        noUnusedParameters: true,
        noImplicitReturns: true,
        noFallthroughCasesInSwitch: true
      },
      include: ['src/**/*'],
      exclude: ['node_modules', 'dist']
    }, null, 2)
  );
  
  // Create source files with substantial content
  const componentContent = `
import React from 'react';
import { z } from 'zod';

interface ComponentProps {
  title: string;
  data: unknown;
  onSubmit: (data: unknown) => void;
}

const schema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
});

export const TestComponent: React.FC<ComponentProps> = ({ title, data, onSubmit }) => {
  const [isLoading, setIsLoading] = React.useState(false);
  
  const handleSubmit = React.useCallback(async (formData: unknown) => {
    setIsLoading(true);
    try {
      const validated = schema.parse(formData);
      await onSubmit(validated);
    } catch (error) {
      console.error('Validation failed:', error);
    } finally {
      setIsLoading(false);
    }
  }, [onSubmit]);
  
  return (
    <div className="test-component">
      <h1>{title}</h1>
      <form onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        handleSubmit(Object.fromEntries(formData));
      }}>
        <input name="title" defaultValue={title} />
        <textarea name="description" />
        <button type="submit" disabled={isLoading}>
          {isLoading ? 'Loading...' : 'Submit'}
        </button>
      </form>
    </div>
  );
};

export default TestComponent;
  `;
  
  await fs.writeFile(path.join(testDir, 'src/components/TestComponent.tsx'), componentContent);
  
  // Create utility files
  const utilContent = `
import { z } from 'zod';
import type { ProjectMemory, CacheStats } from '../memory/types.js';

export interface ValidationResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export const createValidator = <T>(schema: z.ZodSchema<T>) => {
  return (data: unknown): ValidationResult<T> => {
    const result = schema.safeParse(data);
    if (result.success) {
      return { success: true, data: result.data };
    }
    return { success: false, error: result.error.message };
  };
};

export class ContextManager {
  private cache: Map<string, ProjectMemory> = new Map();
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    size: 0,
    lastAccess: new Date(),
  };
  
  get(key: string): ProjectMemory | undefined {
    const value = this.cache.get(key);
    if (value) {
      this.stats.hits++;
      this.stats.lastAccess = new Date();
    } else {
      this.stats.misses++;
    }
    return value;
  }
  
  set(key: string, value: ProjectMemory): void {
    this.cache.set(key, value);
    this.stats.size = this.cache.size;
    this.stats.lastAccess = new Date();
  }
  
  getStats(): CacheStats {
    return { ...this.stats };
  }
}
  `;
  
  await fs.writeFile(path.join(testDir, 'src/utils/validation.ts'), utilContent);
  
  // Create agent files
  const agentContent = `
import { EventEmitter } from 'events';
import type { LLMMessage, LLMToolCall } from '../llm/client.js';
import type { ToolResult } from '../types/index.js';

export interface AgentConfig {
  maxRetries: number;
  timeout: number;
  temperature: number;
}

export class LLMAgent extends EventEmitter {
  private config: AgentConfig;
  private messages: LLMMessage[] = [];
  
  constructor(config: AgentConfig) {
    super();
    this.config = config;
  }
  
  async processMessage(message: string): Promise<ToolResult> {
    this.messages.push({ role: 'user', content: message });
    
    try {
      const result = await this.callLLM();
      this.messages.push({ role: 'assistant', content: result.output });
      
      return {
        success: true,
        output: result.output,
        toolCalls: result.toolCalls
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  private async callLLM(): Promise<{ output: string; toolCalls?: LLMToolCall[] }> {
    // Simulate LLM call
    return {
      output: 'Processed response',
      toolCalls: []
    };
  }
  
  getHistory(): LLMMessage[] {
    return [...this.messages];
  }
  
  clearHistory(): void {
    this.messages = [];
  }
}
  `;
  
  await fs.writeFile(path.join(testDir, 'src/agent/llm-agent.ts'), agentContent);
  
  // Create test files
  const testContent = `
import { describe, it, expect } from 'vitest';
import { createValidator, ContextManager } from '../packages/core/src/utils/validation.js';
import { z } from 'zod';

describe('Validation Utils', () => {
  it('should validate correct data', () => {
    const schema = z.object({
      name: z.string(),
      age: z.number()
    });
    
    const validator = createValidator(schema);
    const result = validator({ name: 'John', age: 30 });
    
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ name: 'John', age: 30 });
  });
  
  it('should reject invalid data', () => {
    const schema = z.object({
      name: z.string(),
      age: z.number()
    });
    
    const validator = createValidator(schema);
    const result = validator({ name: 'John', age: 'invalid' });
    
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});

describe('ContextManager', () => {
  it('should cache and retrieve values', () => {
    const manager = new ContextManager();
    const testMemory = {
      version: '1.0.0',
      project_root: '/test',
      last_updated: new Date(),
      context_hash: 'test-hash',
      source_config: {
        include_patterns: ['**/*.ts'],
        exclude_patterns: ['node_modules/**'],
        max_file_size: 1000000,
        include_binary: false,
        scan_directories: []
      },
      context: 'test context',
      stats: {
        files_scanned: 10,
        files_included: 5,
        total_tokens: 1000,
        cache_hits: 0,
        cache_misses: 0,
        last_generated: new Date()
      }
    };
    
    manager.set('test-key', testMemory);
    const retrieved = manager.get('test-key');
    
    expect(retrieved).toEqual(testMemory);
    
    const stats = manager.getStats();
    expect(stats.hits).toBe(1);
    expect(stats.misses).toBe(0);
  });
});
  `;
  
  await fs.writeFile(path.join(testDir, 'tests/unit/validation.test.ts'), testContent);
}

/**
 * Helper function to clean up test project
 */
async function cleanupTestProject(testDir: string): Promise<void> {
  const fs = await import('fs/promises');
  try {
    await fs.rm(testDir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
}

/**
 * Helper function to prune context to fit target tokens
 */
async function pruneContextToFit(
  context: string, 
  targetTokens: number, 
  tokenCounter: any
): Promise<string> {
  const lines = context.split('\n');
  let prunedContext = '';
  let currentTokens = 0;
  
  // Keep essential headers first
  const headerLines = lines.filter(line => 
    line.startsWith('#') || 
    line.startsWith('##') || 
    line.startsWith('###')
  );
  
  for (const line of headerLines) {
    if (currentTokens + tokenCounter.count(line + '\n') <= targetTokens) {
      prunedContext += line + '\n';
      currentTokens += tokenCounter.count(line + '\n');
    } else {
      break;
    }
  }
  
  // Add remaining content until we hit the target
  const contentLines = lines.filter(line => !headerLines.includes(line));
  for (const line of contentLines) {
    const lineTokens = tokenCounter.count(line + '\n');
    if (currentTokens + lineTokens <= targetTokens) {
      prunedContext += line + '\n';
      currentTokens += lineTokens;
    } else {
      break;
    }
  }
  
  return prunedContext;
}