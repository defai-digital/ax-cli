/**
 * Context Usage 40% Test - Tests consuming context to exactly 40% usage
 * 
 * This test verifies the context management system can handle
 * consuming 40% of the available context window appropriately.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ContextGenerator } from '../../src/memory/context-generator.js';
import { ContextStore } from '../../src/memory/context-store.js';
import { createTokenCounter } from '../../src/utils/token-counter.js';
import { GLM_MODELS } from '../../src/constants.js';
import type { ProjectMemory, SourceConfig, WarmupResult } from '../../src/memory/types.js';

describe('Context Usage 40% Tests', () => {
  let contextGenerator: ContextGenerator;
  let contextStore: ContextStore;
  let tokenCounter: any;
  let testDir: string;

  beforeEach(async () => {
    // Create test directory structure
    testDir = '/tmp/ax-cli-context-test';
    
    // Create test project structure with various file types
    await setupTestProject(testDir);
    
    // Initialize components
    contextGenerator = new ContextGenerator(testDir);
    contextStore = new ContextStore(testDir);
    tokenCounter = createTokenCounter('glm-4.6');
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
      
      // Generate context with specific token limit
      const result: WarmupResult = await contextGenerator.generate({
        depth: 4,
        maxTokens: targetTokens,
        verbose: false
      });
      
      expect(result.success).toBe(true);
      expect(result.memory).toBeDefined();
      
      const memory = result.memory!;
      const contextTokens = memory.context.token_estimate;
      
      // Verify we're close to 40% (within 5% tolerance)
      const tolerance = targetTokens * 0.05; // 5% tolerance
      expect(contextTokens).toBeGreaterThanOrEqual(targetTokens - tolerance);
      expect(contextTokens).toBeLessThanOrEqual(targetTokens + tolerance);
      
      // Verify context structure
      expect(memory.context.formatted).toContain('# Project Context');
      
      // Store the context
      const storeResult = await contextStore.storeMemory(memory);
      expect(storeResult.success).toBe(true);
    });

    it('should handle context pruning when exceeding 40%', async () => {
      // Get GLM-4.6 model configuration
      const glmConfig = GLM_MODELS['glm-4.6'];
      const maxContext = glmConfig.contextWindow;
      const targetTokens = Math.floor(maxContext * 0.4); // 80K tokens
      
      // Try to generate with a very high limit to test pruning
      const result: WarmupResult = await contextGenerator.generate({
        depth: 6, // Deep scan
        maxTokens: targetTokens * 2, // Request more than 40%
        verbose: false
      });
      
      expect(result.success).toBe(true);
      
      const memory = result.memory!;
      const actualTokens = memory.context.token_estimate;
      
      // Should be pruned to fit within target
      expect(actualTokens).toBeLessThanOrEqual(targetTokens);
      expect(actualTokens).toBeGreaterThan(0);
      
      // Should still contain essential structure
      expect(memory.context.formatted).toContain('# Project Context');
    });

    it('should track context usage statistics accurately at 40%', async () => {
      const glmConfig = GLM_MODELS['glm-4.6'];
      const targetTokens = Math.floor(glmConfig.contextWindow * 0.4);
      
      const result: WarmupResult = await contextGenerator.generate({
        depth: 3,
        maxTokens: targetTokens,
        verbose: false
      });
      
      expect(result.success).toBe(true);
      
      const memory = result.memory!;
      const contextTokens = memory.context.token_estimate;
      
      // Calculate usage percentage
      const usagePercentage = (contextTokens / glmConfig.contextWindow) * 100;
      
      // Should be close to 40%
      expect(usagePercentage).toBeGreaterThan(38);
      expect(usagePercentage).toBeLessThan(42);
      
      // Verify section token tracking
      const sections = memory.context.sections;
      const totalFromSections = Object.values(sections).reduce((sum, tokens) => sum + (tokens || 0), 0);
      
      // Sections should account for most of the tokens
      expect(totalFromSections).toBeGreaterThan(contextTokens * 0.8);
    });

    it('should maintain context quality at 40% usage', async () => {
      const glmConfig = GLM_MODELS['glm-4.6'];
      const targetTokens = Math.floor(glmConfig.contextWindow * 0.4);
      
      const result: WarmupResult = await contextGenerator.generate({
        depth: 3,
        maxTokens: targetTokens,
        verbose: false
      });
      
      expect(result.success).toBe(true);
      
      const memory = result.memory!;
      const context = memory.context.formatted;
      
      // Verify essential project information is preserved
      expect(context).toContain('# Project Context');
      expect(context).toContain('## Directory Structure');
      
      // Should have content from our test files
      expect(context).toContain('TestComponent'); // From our component
      expect(context).toContain('validation'); // From our utils
      expect(context).toContain('LLMAgent'); // From our agent
      
      // Verify token count is appropriate
      const contextTokens = memory.context.token_estimate;
      const usagePercentage = (contextTokens / glmConfig.contextWindow) * 100;
      
      expect(usagePercentage).toBeGreaterThan(38);
      expect(usagePercentage).toBeLessThan(42);
    });

    it('should handle memory caching at 40% usage', async () => {
      const glmConfig = GLM_MODELS['glm-4.6'];
      const targetTokens = Math.floor(glmConfig.contextWindow * 0.4);
      
      // First generation
      const result1: WarmupResult = await contextGenerator.generate({
        depth: 3,
        maxTokens: targetTokens,
        verbose: false
      });
      
      expect(result1.success).toBe(true);
      const memory1 = result1.memory!;
      
      // Store the memory
      const storeResult = await contextStore.storeMemory(memory1);
      expect(storeResult.success).toBe(true);
      
      // Retrieve the memory
      const retrieveResult = await contextStore.loadMemory();
      expect(retrieveResult.success).toBe(true);
      
      const retrievedMemory = retrieveResult.data!;
      expect(retrievedMemory.content_hash).toBe(memory1.content_hash);
      expect(retrievedMemory.context.token_estimate).toBe(memory1.context.token_estimate);
      
      // Second generation should use cache
      const result2: WarmupResult = await contextGenerator.generate({
        depth: 3,
        maxTokens: targetTokens,
        verbose: false
      });
      
      expect(result2.success).toBe(true);
      const memory2 = result2.memory!;
      
      // Should have same hash (no changes)
      expect(memory2.content_hash).toBe(memory1.content_hash);
      expect(memory2.context.token_estimate).toBe(memory1.context.token_estimate);
    });
  });

  describe('Context Efficiency at 40%', () => {
    it('should optimize file inclusion for 40% target', async () => {
      const glmConfig = GLM_MODELS['glm-4.6'];
      const targetTokens = Math.floor(glmConfig.contextWindow * 0.4);
      
      const result: WarmupResult = await contextGenerator.generate({
        depth: 4,
        maxTokens: targetTokens,
        verbose: false
      });
      
      expect(result.success).toBe(true);
      
      const memory = result.memory!;
      const source = memory.source;
      
      // Should have scanned reasonable number of files
      expect(source.files.length).toBeGreaterThan(5);
      expect(source.files.length).toBeLessThan(50);
      
      // Should include various file types
      const extensions = new Set(source.files.map(f => f.path.split('.').pop()));
      expect(extensions.has('ts')).toBe(true);
      expect(extensions.has('json')).toBe(true);
      
      // Token usage should be efficient
      const contextTokens = memory.context.token_estimate;
      const usagePercentage = (contextTokens / glmConfig.contextWindow) * 100;
      expect(usagePercentage).toBeGreaterThan(38);
      expect(usagePercentage).toBeLessThan(42);
    });

    it('should handle large files appropriately at 40%', async () => {
      const glmConfig = GLM_MODELS['glm-4.6'];
      const targetTokens = Math.floor(glmConfig.contextWindow * 0.4);
      
      // Add a large file to test handling
      await createLargeFile(testDir);
      
      const result: WarmupResult = await contextGenerator.generate({
        depth: 3,
        maxTokens: targetTokens,
        verbose: false
      });
      
      expect(result.success).toBe(true);
      
      const memory = result.memory!;
      const contextTokens = memory.context.token_estimate;
      
      // Should still be within 40% target despite large file
      const usagePercentage = (contextTokens / glmConfig.contextWindow) * 100;
      expect(usagePercentage).toBeLessThan(42);
      
      // Should have warnings about large file
      if (result.warnings) {
        expect(result.warnings.some(w => w.includes('large') || w.includes('truncated'))).toBe(true);
      }
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
  
  // Create substantial source files
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
import { createValidator, ContextManager } from '../src/utils/validation.js';
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
  `;
  
  await fs.writeFile(path.join(testDir, 'tests/unit/validation.test.ts'), testContent);
}

/**
 * Helper function to create a large file for testing
 */
async function createLargeFile(testDir: string): Promise<void> {
  const fs = await import('fs/promises');
  const path = await import('path');
  
  // Create a large file that would exceed normal limits
  const largeContent = `
// This is a large file to test context management
// It contains a lot of repetitive content to simulate a real large file

${Array.from({ length: 1000 }, (_, i) => `
export const constant${i} = {
  id: ${i},
  name: 'Item ${i}',
  description: 'This is a detailed description for item ${i}'.repeat(10),
  metadata: {
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
    version: '1.0.0',
    tags: ['tag1', 'tag2', 'tag3', 'tag4', 'tag5'],
    properties: {
      prop1: 'value1',
      prop2: 'value2',
      prop3: 'value3',
      prop4: 'value4',
      prop5: 'value5'
    }
  },
  methods: {
    method1: () => 'result1',
    method2: () => 'result2',
    method3: () => 'result3',
    method4: () => 'result4',
    method5: () => 'result5'
  }
};
`).join('\n')}
  `;
  
  await fs.writeFile(path.join(testDir, 'src/large-file.ts'), largeContent);
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