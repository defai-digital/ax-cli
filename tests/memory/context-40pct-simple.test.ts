/**
 * Simple Context 40% Usage Test
 * 
 * Tests that the context system can handle 40% usage target
 * by creating realistic test scenarios.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ContextGenerator } from '../../packages/core/src/memory/context-generator.js';
import { createTokenCounter } from '../../packages/core/src/utils/token-counter.js';
import { GLM_MODELS } from '../../packages/core/src/constants.js';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('Simple Context 40% Usage Test', () => {
  let testDir: string;
  let tokenCounter: any;

  beforeEach(async () => {
    testDir = '/tmp/ax-cli-40pct-test';
    tokenCounter = createTokenCounter('glm-4.6');
    await setupTestProject(testDir);
  });

  afterEach(async () => {
    await cleanupTestProject(testDir);
  });

  it('should generate context close to 40% of GLM-4.6 capacity', async () => {
    const glmConfig = GLM_MODELS['glm-4.6'];
    const maxContext = glmConfig.contextWindow; // 200K tokens
    const targetTokens = Math.floor(maxContext * 0.4); // 80K tokens
    
    // Create context generator
    const generator = new ContextGenerator(testDir);
    
    // Generate context with 40% target
    const result = await generator.generate({
      depth: 4,
      maxTokens: targetTokens,
      verbose: false
    });
    
    expect(result.success).toBe(true);
    expect(result.memory).toBeDefined();
    
    const memory = result.memory!;
    const actualTokens = memory.context.token_estimate;
    
    // Should be reasonably close to target (within 20% tolerance)
    const tolerance = targetTokens * 0.2;
    expect(actualTokens).toBeGreaterThan(targetTokens - tolerance);
    expect(actualTokens).toBeLessThanOrEqual(targetTokens + tolerance);
    
    // Verify context has content
    expect(memory.context.formatted.length).toBeGreaterThan(100);
    expect(memory.context.formatted).toContain('# Project Context');
  });

  it('should respect maxTokens parameter correctly', async () => {
    const generator = new ContextGenerator(testDir);
    
    // Test with different token limits
    const testCases = [
      { maxTokens: 1000, expectedMax: 1200 }, // 20% tolerance
      { maxTokens: 5000, expectedMax: 6000 },
      { maxTokens: 10000, expectedMax: 12000 }
    ];
    
    for (const testCase of testCases) {
      const result = await generator.generate({
        depth: 3,
        maxTokens: testCase.maxTokens,
        verbose: false
      });
      
      expect(result.success).toBe(true);
      expect(result.memory).toBeDefined();
      
      const actualTokens = result.memory!.context.token_estimate;
      expect(actualTokens).toBeLessThanOrEqual(testCase.expectedMax);
      expect(actualTokens).toBeGreaterThan(0);
    }
  });

  it('should handle different scan depths appropriately', async () => {
    const generator = new ContextGenerator(testDir);
    const targetTokens = 10000; // Fixed target for comparison
    
    // Test different depths
    const depths = [1, 2, 3, 4];
    const results: number[] = [];
    
    for (const depth of depths) {
      const result = await generator.generate({
        depth,
        maxTokens: targetTokens,
        verbose: false
      });
      
      expect(result.success).toBe(true);
      results.push(result.memory!.context.token_estimate);
    }
    
    // Deeper scans should generally produce more context (but not always)
    // The important thing is that all results are within reasonable bounds
    for (const tokens of results) {
      expect(tokens).toBeGreaterThan(100);
      expect(tokens).toBeLessThanOrEqual(targetTokens * 1.2);
    }
  });

  it('should produce consistent results for same input', async () => {
    const generator = new ContextGenerator(testDir);
    const targetTokens = 8000;
    
    // Generate context twice with same parameters
    const result1 = await generator.generate({
      depth: 3,
      maxTokens: targetTokens,
      verbose: false
    });
    
    const result2 = await generator.generate({
      depth: 3,
      maxTokens: targetTokens,
      verbose: false
    });
    
    expect(result1.success).toBe(true);
    expect(result2.success).toBe(true);
    
    const memory1 = result1.memory!;
    const memory2 = result2.memory!;
    
    // Should have same token count (within small tolerance)
    expect(Math.abs(memory1.context.token_estimate - memory2.context.token_estimate)).toBeLessThan(100);
    
    // Should have same content hash (no changes)
    expect(memory1.content_hash).toBe(memory2.content_hash);
  });

  it('should calculate 40% of GLM-4.6 context correctly', () => {
    const glmConfig = GLM_MODELS['glm-4.6'];
    const maxContext = glmConfig.contextWindow; // 200K tokens
    const fortyPercent = Math.floor(maxContext * 0.4);
    
    // Verify our calculation
    expect(fortyPercent).toBe(80000);
    expect(maxContext).toBe(200000);
    
    // Verify percentage
    const percentage = (fortyPercent / maxContext) * 100;
    expect(percentage).toBe(40);
  });

  it('should handle realistic project sizes at 40%', async () => {
    // Create a larger test project
    await createLargerTestProject(testDir);
    
    const generator = new ContextGenerator(testDir);
    const glmConfig = GLM_MODELS['glm-4.6'];
    const targetTokens = Math.floor(glmConfig.contextWindow * 0.4); // 80K
    
    const result = await generator.generate({
      depth: 4,
      maxTokens: targetTokens,
      verbose: false
    });
    
    expect(result.success).toBe(true);
    
    const memory = result.memory!;
    const actualTokens = memory.context.token_estimate;
    
    // Should be close to 40% target
    const tolerance = targetTokens * 0.15; // 15% tolerance
    expect(actualTokens).toBeGreaterThan(targetTokens - tolerance);
    expect(actualTokens).toBeLessThanOrEqual(targetTokens + tolerance);
    
    // Should have scanned multiple files
    expect(memory.source.files.length).toBeGreaterThan(5);
    
    // Should contain various sections
    expect(memory.context.sections).toBeDefined();
    expect(Object.keys(memory.context.sections).length).toBeGreaterThan(0);
  });
});

async function setupTestProject(testDir: string): Promise<void> {
  // Create basic directory structure
  await fs.mkdir(path.join(testDir, 'src'), { recursive: true });
  await fs.mkdir(path.join(testDir, 'src', 'components'), { recursive: true });
  await fs.mkdir(path.join(testDir, 'src', 'utils'), { recursive: true });
  
  // Create package.json
  await fs.writeFile(
    path.join(testDir, 'package.json'),
    JSON.stringify({
      name: 'test-project',
      version: '1.0.0',
      type: 'module',
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
        moduleResolution: 'Bundler',
        jsx: 'react',
        esModuleInterop: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true,
        declaration: true,
        sourceMap: true,
        resolveJsonModule: true,
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
  
  // Create a component file
  await fs.writeFile(
    path.join(testDir, 'src/components/Button.tsx'),
    `import React from 'react';

interface ButtonProps {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
}

export const Button: React.FC<ButtonProps> = ({ 
  label, 
  onClick, 
  variant = 'primary' 
}) => {
  const className = \`btn btn-\${variant}\`;
  
  return (
    <button className={className} onClick={onClick}>
      {label}
    </button>
  );
};

export default Button;
`
  );
  
  // Create a utility file
  await fs.writeFile(
    path.join(testDir, 'src/utils/helpers.ts'),
    `export const formatDate = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  let timeoutId: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
};

export const clamp = (value: number, min: number, max: number): number => {
  return Math.min(Math.max(value, min), max);
};
`
  );
}

async function createLargerTestProject(testDir: string): Promise<void> {
  // Create more extensive structure
  await fs.mkdir(path.join(testDir, 'src', 'hooks'), { recursive: true });
  await fs.mkdir(path.join(testDir, 'src', 'types'), { recursive: true });
  await fs.mkdir(path.join(testDir, 'src', 'services'), { recursive: true });
  await fs.mkdir(path.join(testDir, 'tests'), { recursive: true });
  
  // Create additional files
  const files = [
    {
      path: 'src/hooks/useApi.ts',
      content: `
import { useState, useEffect } from 'react';

export const useApi = <T>(url: string) => {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('API request failed');
        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [url]);

  return { data, loading, error };
};
`
    },
    {
      path: 'src/types/index.ts',
      content: `
export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
`
    },
    {
      path: 'src/services/api.ts',
      content: `
import type { User, ApiResponse, PaginatedResponse, PaginationParams } from '../types/index.js';

const API_BASE = process.env.API_BASE_URL || 'http://localhost:3000/api';

class ApiService {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE) {
    this.baseUrl = baseUrl;
  }

  async getUsers(params: PaginationParams): Promise<PaginatedResponse<User>> {
    const searchParams = new URLSearchParams({
      page: params.page.toString(),
      limit: params.limit.toString(),
      ...(params.sortBy && { sortBy: params.sortBy }),
      ...(params.sortOrder && { sortOrder: params.sortOrder }),
    });

    const response = await fetch(\`\${this.baseUrl}/users?\${searchParams}\`);
    return response.json();
  }

  async getUser(id: string): Promise<ApiResponse<User>> {
    const response = await fetch(\`\${this.baseUrl}/users/\${id}\`);
    return response.json();
  }

  async createUser(user: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<ApiResponse<User>> {
    const response = await fetch(\`\${this.baseUrl}/users\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user),
    });
    return response.json();
  }
}

export const apiService = new ApiService();
`
    },
    {
      path: 'tests/api.test.ts',
      content: `
import { describe, it, expect, vi } from 'vitest';
import { apiService } from '../packages/core/src/services/api.js';

describe('ApiService', () => {
  it('should fetch users successfully', async () => {
    const mockUsers = [
      { id: '1', name: 'John', email: 'john@example.com', createdAt: new Date(), updatedAt: new Date() }
    ];
    
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: mockUsers,
        pagination: { page: 1, limit: 10, total: 1, totalPages: 1 }
      })
    });

    const result = await apiService.getUsers({ page: 1, limit: 10 });
    
    expect(result.success).toBe(true);
    expect(result.data).toEqual(mockUsers);
    expect(result.pagination.total).toBe(1);
  });
});
`
    }
  ];

  for (const file of files) {
    await fs.writeFile(path.join(testDir, file.path), file.content.trim());
  }
}

async function cleanupTestProject(testDir: string): Promise<void> {
  try {
    await fs.rm(testDir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
}