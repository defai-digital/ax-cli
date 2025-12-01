/**
 * Context 40% Usage Demonstration Test
 * 
 * This test demonstrates that the context management system
 * can handle consuming 40% of the available context window.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ContextGenerator } from '../../src/memory/context-generator.js';
import { createTokenCounter } from '../../src/utils/token-counter.js';
import { GLM_MODELS } from '../../src/constants.js';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('Context 40% Usage Demonstration', () => {
  let testDir: string;
  let tokenCounter: any;

  beforeEach(async () => {
    testDir = '/tmp/ax-cli-40pct-demo';
    tokenCounter = createTokenCounter('glm-4.6');
    await createDemoProject(testDir);
  });

  afterEach(async () => {
    await cleanupProject(testDir);
  });

  it('should demonstrate 40% context usage capability', async () => {
    // Get GLM-4.6 configuration
    const glmConfig = GLM_MODELS['glm-4.6'];
    const maxContext = glmConfig.contextWindow; // 200K tokens
    const targetTokens = Math.floor(maxContext * 0.4); // 80K tokens
    
    console.log(`GLM-4.6 Context Window: ${maxContext.toLocaleString()} tokens`);
    console.log(`40% Target: ${targetTokens.toLocaleString()} tokens`);
    
    // Create context generator
    const generator = new ContextGenerator(testDir);
    
    // Test 1: Generate with exactly 40% target
    console.log('\n=== Test 1: Generating context at 40% target ===');
    const result1 = await generator.generate({
      depth: 4,
      maxTokens: targetTokens,
      verbose: true
    });
    
    expect(result1.success).toBe(true);
    const memory1 = result1.memory!;
    const actualTokens1 = memory1.context.token_estimate;
    const usagePercentage1 = (actualTokens1 / maxContext) * 100;
    
    console.log(`Generated: ${actualTokens1.toLocaleString()} tokens (${usagePercentage1.toFixed(1)}%)`);
    console.log(`Target was: ${targetTokens.toLocaleString()} tokens`);
    console.log(`Difference: ${Math.abs(actualTokens1 - targetTokens).toLocaleString()} tokens`);
    
    // Should be within reasonable bounds
    expect(actualTokens1).toBeGreaterThan(targetTokens * 0.5); // At least 50% of target
    expect(actualTokens1).toBeLessThanOrEqual(targetTokens * 1.1); // Max 10% over
    
    // Test 2: Test with different token limits to show flexibility
    console.log('\n=== Test 2: Testing different token limits ===');
    const testLimits = [1000, 5000, 10000, targetTokens];
    
    for (const limit of testLimits) {
      const result = await generator.generate({
        depth: 3,
        maxTokens: limit,
        verbose: false
      });
      
      expect(result.success).toBe(true);
      const actual = result.memory!.context.token_estimate;
      const percentage = (actual / maxContext) * 100;
      
      console.log(`Limit: ${limit.toLocaleString()} → Actual: ${actual.toLocaleString()} (${percentage.toFixed(2)}%)`);
      expect(actual).toBeLessThanOrEqual(limit * 1.1); // Within 10% tolerance
    }
    
    // Test 3: Verify context quality at 40%
    console.log('\n=== Test 3: Verifying context quality at 40% ===');
    const context = memory1.context.formatted;
    
    console.log(`Context length: ${context.length.toLocaleString()} characters`);
    console.log(`Context sections: ${Object.keys(memory1.context.sections).length}`);
    
    // Should contain essential project information
    expect(context).toContain('# Project Context');
    expect(context).toContain('## Directory Structure');
    
    // Should include content from our demo files
    expect(context).toContain('DemoProject');
    expect(context).toContain('Button');
    expect(context).toContain('useApi');
    
    // Should have reasonable structure
    const lines = context.split('\n');
    console.log(`Total lines: ${lines.length}`);
    expect(lines.length).toBeGreaterThan(50);
    
    // Test 4: Show token counting accuracy
    console.log('\n=== Test 4: Token counting verification ===');
    const manualCount = tokenCounter.count(context);
    const reportedCount = memory1.context.token_estimate;
    
    console.log(`Manual token count: ${manualCount.toLocaleString()}`);
    console.log(`Reported token count: ${reportedCount.toLocaleString()}`);
    console.log(`Difference: ${Math.abs(manualCount - reportedCount)} tokens`);
    
    // Should be very close (within 1%)
    const differencePercent = Math.abs(manualCount - reportedCount) / reportedCount;
    expect(differencePercent).toBeLessThan(0.01);
    
    // Test 5: Demonstrate memory caching at 40%
    console.log('\n=== Test 5: Memory caching demonstration ===');
    
    // Generate again with same parameters
    const result2 = await generator.generate({
      depth: 4,
      maxTokens: targetTokens,
      verbose: false
    });
    
    expect(result2.success).toBe(true);
    const memory2 = result2.memory!;
    
    console.log(`First generation hash: ${memory1.content_hash.substring(0, 16)}...`);
    console.log(`Second generation hash: ${memory2.content_hash.substring(0, 16)}...`);
    console.log(`Hashes match: ${memory1.content_hash === memory2.content_hash}`);
    console.log(`Token counts match: ${memory1.context.token_estimate === memory2.context.token_estimate}`);
    
    // Should be identical (no changes to project)
    expect(memory1.content_hash).toBe(memory2.content_hash);
    expect(memory1.context.token_estimate).toBe(memory2.context.token_estimate);
    
    // Final summary
    console.log('\n=== Summary ===');
    console.log(`✓ Successfully generated context at 40% of GLM-4.6 capacity`);
    console.log(`✓ Context quality maintained with proper structure`);
    console.log(`✓ Token counting is accurate and reliable`);
    console.log(`✓ Memory caching works correctly`);
    console.log(`✓ System handles various token limits appropriately`);
  });

  it('should handle edge cases around 40% target', async () => {
    const glmConfig = GLM_MODELS['glm-4.6'];
    const maxContext = glmConfig.contextWindow;
    const target40Percent = Math.floor(maxContext * 0.4);
    
    const generator = new ContextGenerator(testDir);
    
    // Test edge cases around 40%
    const edgeCases = [
      { tokens: target40Percent * 0.8, name: '32% (below 40%)' },
      { tokens: target40Percent, name: '40% (exact target)' },
      { tokens: target40Percent * 1.2, name: '48% (above 40%)' }
    ];
    
    for (const testCase of edgeCases) {
      const result = await generator.generate({
        depth: 3,
        maxTokens: testCase.tokens,
        verbose: false
      });
      
      expect(result.success).toBe(true);
      const actual = result.memory!.context.token_estimate;
      const percentage = (actual / maxContext) * 100;
      
      console.log(`${testCase.name}: Requested ${testCase.tokens.toLocaleString()}, got ${actual.toLocaleString()} (${percentage.toFixed(1)}%)`);
      
      // Should respect the limit reasonably well
      expect(actual).toBeLessThanOrEqual(testCase.tokens * 1.1);
      expect(actual).toBeGreaterThan(testCase.tokens * 0.5);
    }
  });
});

async function createDemoProject(testDir: string): Promise<void> {
  // Create comprehensive demo project structure
  await fs.mkdir(path.join(testDir, 'src'), { recursive: true });
  await fs.mkdir(path.join(testDir, 'src', 'components'), { recursive: true });
  await fs.mkdir(path.join(testDir, 'src', 'hooks'), { recursive: true });
  await fs.mkdir(path.join(testDir, 'src', 'utils'), { recursive: true });
  await fs.mkdir(path.join(testDir, 'src', 'services'), { recursive: true });
  await fs.mkdir(path.join(testDir, 'src', 'types'), { recursive: true });
  await fs.mkdir(path.join(testDir, 'tests'), { recursive: true });
  await fs.mkdir(path.join(testDir, 'docs'), { recursive: true });
  
  // Create comprehensive package.json
  await fs.writeFile(
    path.join(testDir, 'package.json'),
    JSON.stringify({
      name: 'demo-project-40pct',
      version: '1.0.0',
      description: 'Demo project for testing 40% context usage',
      type: 'module',
      main: 'dist/index.js',
      scripts: {
        build: 'tsc',
        dev: 'tsx watch src/index.ts',
        test: 'vitest',
        lint: 'eslint src --ext .ts,.tsx',
        typecheck: 'tsc --noEmit'
      },
      dependencies: {
        react: '^18.2.0',
        'react-dom': '^18.2.0',
        zod: '^3.22.0',
        axios: '^1.6.0',
        'clsx': '^2.0.0',
        'date-fns': '^2.30.0'
      },
      devDependencies: {
        '@types/react': '^18.2.0',
        '@types/react-dom': '^18.2.0',
        typescript: '^5.2.0',
        vitest: '^1.0.0',
        eslint: '^8.55.0',
        tsx: '^4.6.0'
      }
    }, null, 2)
  );
  
  // Create comprehensive tsconfig.json
  await fs.writeFile(
    path.join(testDir, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: {
        target: 'ES2022',
        module: 'ESNext',
        lib: ['ES2022', 'DOM', 'DOM.Iterable'],
        moduleResolution: 'Bundler',
        allowImportingTsExtensions: true,
        resolveJsonModule: true,
        isolatedModules: true,
        noEmit: true,
        jsx: 'react-jsx',
        strict: true,
        noUnusedLocals: true,
        noUnusedParameters: true,
        noFallthroughCasesInSwitch: true,
        esModuleInterop: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true,
        declaration: true,
        sourceMap: true,
        allowSyntheticDefaultImports: true,
        noImplicitAny: true,
        strictNullChecks: true,
        noImplicitThis: true,
        alwaysStrict: true,
        noImplicitReturns: true
      },
      include: ['src/**/*', 'tests/**/*'],
      exclude: ['node_modules', 'dist']
    }, null, 2)
  );
  
  // Create multiple component files
  const components = [
    {
      name: 'Button.tsx',
      content: `
import React from 'react';
import { clsx } from 'clsx';

interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  className?: string;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  disabled = false,
  className
}) => {
  const baseClasses = 'inline-flex items-center justify-center font-medium rounded-md transition-colors';
  const variantClasses = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700',
    secondary: 'bg-gray-200 text-gray-900 hover:bg-gray-300',
    danger: 'bg-red-600 text-white hover:bg-red-700'
  };
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg'
  };

  const classes = clsx(
    baseClasses,
    variantClasses[variant],
    sizeClasses[size],
    disabled && 'opacity-50 cursor-not-allowed',
    className
  );

  return (
    <button
      className={classes}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
};

export default Button;
`
    },
    {
      name: 'Card.tsx',
      content: `
import React from 'react';
import { clsx } from 'clsx';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  shadow?: 'none' | 'sm' | 'md' | 'lg';
}

export const Card: React.FC<CardProps> = ({
  children,
  className,
  padding = 'md',
  shadow = 'md'
}) => {
  const baseClasses = 'bg-white rounded-lg border border-gray-200';
  const paddingClasses = {
    none: '',
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6'
  };
  const shadowClasses = {
    none: '',
    sm: 'shadow-sm',
    md: 'shadow-md',
    lg: 'shadow-lg'
  };

  const classes = clsx(
    baseClasses,
    paddingClasses[padding],
    shadowClasses[shadow],
    className
  );

  return (
    <div className={classes}>
      {children}
    </div>
  );
};

export default Card;
`
    }
  ];

  for (const component of components) {
    await fs.writeFile(path.join(testDir, 'src/components', component.name), component.content.trim());
  }
  
  // Create hook files
  const hooks = [
    {
      name: 'useApi.ts',
      content: `
import { useState, useEffect, useCallback } from 'react';
import type { ApiResponse, PaginationParams } from '../types/index.js';

interface UseApiOptions<T> {
  immediate?: boolean;
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
}

export function useApi<T>(
  fetcher: (params?: any) => Promise<ApiResponse<T>>,
  options: UseApiOptions<T> = {}
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const execute = useCallback(async (params?: any) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetcher(params);
      if (!response.success || !response.data) {
        throw new Error(response.error || 'API request failed');
      }
      
      setData(response.data);
      options.onSuccess?.(response.data);
      return response.data;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      options.onError?.(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [fetcher, options]);

  useEffect(() => {
    if (options.immediate) {
      execute();
    }
  }, [execute, options.immediate]);

  return { data, loading, error, execute };
}

export function usePaginatedApi<T>(
  fetcher: (params: PaginationParams) => Promise<ApiResponse<T[]>>,
  initialParams: PaginationParams = { page: 1, limit: 10 }
) {
  const [params, setParams] = useState(initialParams);
  const { data, loading, error, execute } = useApi(
    () => fetcher(params),
    { immediate: true }
  );

  const nextPage = useCallback(() => {
    setParams(p => ({ ...p, page: p.page + 1 }));
  }, []);

  const prevPage = useCallback(() => {
    setParams(p => ({ ...p, page: Math.max(1, p.page - 1) }));
  }, []);

  const goToPage = useCallback((page: number) => {
    setParams(p => ({ ...p, page: Math.max(1, page) }));
  }, []);

  return {
    data,
    loading,
    error,
    params,
    nextPage,
    prevPage,
    goToPage,
    refresh: execute
  };
}
`
    }
  ];

  for (const hook of hooks) {
    await fs.writeFile(path.join(testDir, 'src/hooks', hook.name), hook.content.trim());
  }
  
  // Create type definitions
  await fs.writeFile(
    path.join(testDir, 'src/types/index.ts'),
    `
export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: 'admin' | 'user' | 'moderator';
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
}

export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface CreateUserData {
  name: string;
  email: string;
  role: User['role'];
  password: string;
}

export interface UpdateUserData {
  name?: string;
  email?: string;
  avatar?: string;
  role?: User['role'];
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthToken {
  token: string;
  refreshToken: string;
  expiresAt: Date;
  user: User;
}
`
  );
  
  // Create README
  await fs.writeFile(
    path.join(testDir, 'README.md'),
    `# DemoProject - 40% Context Usage Test

This is a comprehensive demo project designed to test the AX CLI's ability to handle 40% context usage of the GLM-4.6 model.

## Project Structure

- \`src/components/\` - React UI components
- \`src/hooks/\` - Custom React hooks
- \`src/types/\` - TypeScript type definitions
- \`src/utils/\` - Utility functions
- \`src/services/\` - API service layer
- \`tests/\` - Test files

## Features

- TypeScript with strict mode
- React 18 with hooks
- Comprehensive type safety
- API integration
- Responsive components
- Pagination support
- Authentication system

## Development

\`\`\`bash
npm install
npm run dev
npm test
npm run build
\`\`\`

## Context Usage

This project is specifically designed to generate approximately 40% (80K tokens) of the GLM-4.6 context window when scanned by the AX CLI context generator.
`
  );
}

async function cleanupProject(testDir: string): Promise<void> {
  try {
    await fs.rm(testDir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
}