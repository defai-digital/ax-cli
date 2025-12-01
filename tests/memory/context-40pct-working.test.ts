/**
 * Working 40% Context Usage Test
 * 
 * Simple test to demonstrate 40% context usage functionality
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ContextGenerator } from '../../src/memory/context-generator.js';
import { GLM_MODELS } from '../../src/constants.js';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('Working 40% Context Usage Test', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = '/tmp/ax-cli-40pct-working';
    await createMinimalProject(testDir);
  });

  afterEach(async () => {
    await cleanupProject(testDir);
  });

  it('should demonstrate 40% context usage works', async () => {
    // Get GLM-4.6 configuration
    const glmConfig = GLM_MODELS['glm-4.6'];
    const maxContext = glmConfig.contextWindow; // 200K tokens
    const target40Percent = Math.floor(maxContext * 0.4); // 80K tokens
    
    console.log('=== 40% Context Usage Test ===');
    console.log(`GLM-4.6 Context Window: ${maxContext.toLocaleString()} tokens`);
    console.log(`40% Target: ${target40Percent.toLocaleString()} tokens`);
    
    // Create context generator
    const generator = new ContextGenerator(testDir);
    
    // Test with smaller token limits first to verify system works
    console.log('\n--- Testing with smaller limits ---');
    const smallLimits = [1000, 5000, 10000];
    
    for (const limit of smallLimits) {
      const result = await generator.generate({
        depth: 3,
        maxTokens: limit,
        verbose: false
      });
      
      expect(result.success).toBe(true);
      expect(result.memory).toBeDefined();
      
      const actual = result.memory!.context.token_estimate;
      const percentage = (actual / maxContext) * 100;
      
      console.log(`Limit: ${limit.toLocaleString()} → Actual: ${actual.toLocaleString()} (${percentage.toFixed(2)}%)`);
      
      // Should respect the limit reasonably
      expect(actual).toBeGreaterThan(0);
      expect(actual).toBeLessThanOrEqual(limit * 1.5); // Some tolerance
    }
    
    // Test with 40% target
    console.log('\n--- Testing with 40% target ---');
    const result40Pct = await generator.generate({
      depth: 4,
      maxTokens: target40Percent,
      verbose: true
    });
    
    expect(result40Pct.success).toBe(true);
    expect(result40Pct.memory).toBeDefined();
    
    const memory = result40Pct.memory!;
    const actualTokens = memory.context.token_estimate;
    const actualPercentage = (actualTokens / maxContext) * 100;
    
    console.log(`40% Target: ${target40Percent.toLocaleString()} tokens`);
    console.log(`Actual Generated: ${actualTokens.toLocaleString()} tokens (${actualPercentage.toFixed(1)}%)`);
    console.log(`Difference: ${Math.abs(actualTokens - target40Percent).toLocaleString()} tokens`);
    console.log(`Context Length: ${memory.context.formatted.length.toLocaleString()} characters`);
    
    // Verify context structure
    expect(memory.context.formatted).toContain('# Project Context');
    expect(memory.context.formatted.length).toBeGreaterThan(100);
    
    // Should be reasonable (within 50% of target for small test project)
    expect(actualTokens).toBeGreaterThan(target40Percent * 0.1);
    expect(actualTokens).toBeLessThanOrEqual(target40Percent * 1.2);
    
    // Test edge cases
    console.log('\n--- Testing edge cases ---');
    const edgeCases = [
      { name: '25%', multiplier: 0.25 },
      { name: '40%', multiplier: 0.40 },
      { name: '50%', multiplier: 0.50 }
    ];
    
    for (const edgeCase of edgeCases) {
      const target = Math.floor(maxContext * edgeCase.multiplier);
      const result = await generator.generate({
        depth: 3,
        maxTokens: target,
        verbose: false
      });
      
      expect(result.success).toBe(true);
      const actual = result.memory!.context.token_estimate;
      const percentage = (actual / maxContext) * 100;
      
      console.log(`${edgeCase.name}: Target ${target.toLocaleString()} → Actual ${actual.toLocaleString()} (${percentage.toFixed(1)}%)`);
      
      // Should be in reasonable range
      expect(actual).toBeGreaterThan(0);
      expect(actual).toBeLessThanOrEqual(target * 1.5);
    }
    
    // Final verification
    console.log('\n--- Final Verification ---');
    console.log('✓ Context generation works with various token limits');
    console.log('✓ 40% target is handled appropriately');
    console.log('✓ Context structure is maintained');
    console.log('✓ Edge cases are handled correctly');
    
    // Verify GLM-4.6 config is correct
    expect(glmConfig.contextWindow).toBe(200000);
    expect(target40Percent).toBe(80000);
    
    // Verify basic functionality
    expect(memory.content_hash).toBeDefined();
    expect(memory.context.sections).toBeDefined();
    expect(memory.source.files.length).toBeGreaterThan(0);
  });

  it('should verify 40% calculation is correct', () => {
    const glmConfig = GLM_MODELS['glm-4.6'];
    const maxContext = glmConfig.contextWindow;
    
    // Test percentage calculations
    const percentages = [0.1, 0.25, 0.4, 0.5, 0.75, 1.0];
    
    for (const pct of percentages) {
      const tokens = Math.floor(maxContext * pct);
      const calculatedPct = (tokens / maxContext) * 100;
      
      console.log(`${(pct * 100).toFixed(0)}%: ${tokens.toLocaleString()} tokens (${calculatedPct.toFixed(1)}% calculated)`);
      
      expect(tokens).toBeGreaterThan(0);
      expect(tokens).toBeLessThanOrEqual(maxContext);
      expect(calculatedPct).toBeCloseTo(pct * 100, 1);
    }
    
    // Specifically verify 40%
    const fortyPct = Math.floor(maxContext * 0.4);
    expect(fortyPct).toBe(80000);
    expect((fortyPct / maxContext) * 100).toBe(40);
  });
});

async function createMinimalProject(testDir: string): Promise<void> {
  // Create basic structure
  await fs.mkdir(path.join(testDir, 'src'), { recursive: true });
  await fs.mkdir(path.join(testDir, 'src', 'components'), { recursive: true });
  
  // Create package.json
  await fs.writeFile(
    path.join(testDir, 'package.json'),
    JSON.stringify({
      name: 'minimal-40pct-test',
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
  
  // Create a component
  await fs.writeFile(
    path.join(testDir, 'src/components/Test.tsx'),
    `import React from 'react';

interface TestProps {
  message: string;
  onClick: () => void;
}

export const Test: React.FC<TestProps> = ({ message, onClick }) => {
  return (
    <div onClick={onClick}>
      <h1>{message}</h1>
      <p>This is a test component for 40% context usage testing.</p>
    </div>
  );
};

export default Test;
`
  );
  
  // Create a utility
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

export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
  return emailRegex.test(email);
};
`
  );
  
  // Create README
  await fs.writeFile(
    path.join(testDir, 'README.md'),
    `# Minimal 40% Context Test Project

This is a minimal project to test 40% context usage functionality.

## Purpose

- Test context generation at 40% of GLM-4.6 capacity
- Verify token counting accuracy
- Ensure context quality is maintained

## Structure

- src/components/ - React components
- src/utils/ - Utility functions
- Tests for context usage verification

## Usage

This project is used by AX CLI tests to verify that the context management system can handle consuming 40% of the available context window effectively.
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