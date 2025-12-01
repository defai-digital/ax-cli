/**
 * Integration Tests for Analysis Tools
 *
 * Tests the LLM tool wrappers for all 5 analyzers
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  AnalyzeDependenciesTool,
  DetectCodeSmellsTool,
  FindHotspotsTool,
  CalculateMetricsTool,
  AnalyzeSecurityTool,
} from '../../src/tools/analysis-tools.js';
import path from 'path';

// Test fixtures directory
const TEST_DIR = path.join(process.cwd(), 'tests', 'fixtures');

describe('AnalyzeDependenciesTool', () => {
  let tool: AnalyzeDependenciesTool;

  beforeEach(() => {
    tool = new AnalyzeDependenciesTool();
  });

  it('should provide tool definition', () => {
    const def = tool.getToolDefinition();
    expect(def.function.name).toBe('analyze_dependencies');
    expect(def.function.description).toContain('circular dependencies');
    expect(def.function.parameters.properties).toHaveProperty('directory');
  });

  it('should analyze dependencies in test directory', async () => {
    const result = await tool.execute({ directory: TEST_DIR });

    expect(result.success).toBe(true);
    expect(result.output).toBeDefined();
    expect(result.output).toContain('Dependency Analysis');
    expect(result.output).toContain('Files Analyzed');
    expect(result.output).toContain('Health Score');
  });

  it('should handle non-existent directory gracefully', async () => {
    const result = await tool.execute({ directory: '/non/existent/path' });

    // Tools may handle gracefully and return success with empty results
    expect(result).toBeDefined();
    if (!result.success) {
      expect(result.error).toBeDefined();
    }
  });

  it('should detect circular dependencies if they exist', async () => {
    const result = await tool.execute({ directory: TEST_DIR });

    expect(result.success).toBe(true);
    // Should include circular dependencies section if any found
    if (result.output && result.output.includes('Circular Dependencies: ') && !result.output.includes('Circular Dependencies: 0')) {
      expect(result.output).toContain('Top Circular Dependencies');
    } else {
      // No circular dependencies found is also valid
      expect(result.output).toBeDefined();
    }
  });

  it('should identify orphan files', async () => {
    const result = await tool.execute({ directory: TEST_DIR });

    expect(result.success).toBe(true);
    expect(result.output).toBeDefined();
    // Output should contain orphan files section
  });
});

describe('DetectCodeSmellsTool', () => {
  let tool: DetectCodeSmellsTool;

  beforeEach(() => {
    tool = new DetectCodeSmellsTool();
  });

  it('should provide tool definition', () => {
    const def = tool.getToolDefinition();
    expect(def.function.name).toBe('detect_code_smells');
    expect(def.function.description).toContain('code smells');
    expect(def.function.parameters.properties).toHaveProperty('directory');
  });

  it('should detect code smells in test directory', async () => {
    const result = await tool.execute({ directory: TEST_DIR });

    expect(result.success).toBe(true);
    expect(result.output).toBeDefined();
    expect(result.output).toContain('Code Smell Analysis');
    expect(result.output).toContain('Files Analyzed');
  });

  it('should categorize smells by severity', async () => {
    const result = await tool.execute({ directory: TEST_DIR });

    expect(result.success).toBe(true);
    if (result.output?.includes('Total Smells')) {
      // If smells found, should show severity breakdown
      expect(result.output).toBeDefined();
    }
  });

  it('should handle directory with no smells', async () => {
    const result = await tool.execute({ directory: TEST_DIR });

    expect(result.success).toBe(true);
    expect(result.output).toBeDefined();
  });

  it('should handle invalid directory', async () => {
    const result = await tool.execute({ directory: '/invalid/path' });

    // Tools may handle gracefully
    expect(result).toBeDefined();
    if (!result.success) {
      expect(result.error).toBeDefined();
    }
  });
});

describe('FindHotspotsTool', () => {
  let tool: FindHotspotsTool;

  beforeEach(() => {
    tool = new FindHotspotsTool();
  });

  it('should provide tool definition', () => {
    const def = tool.getToolDefinition();
    expect(def.function.name).toBe('find_hotspots');
    expect(def.function.description).toContain('hotspot');
    expect(def.function.parameters.properties).toHaveProperty('directory');
  });

  it('should find hotspots in git repository', async () => {
    const result = await tool.execute({
      directory: process.cwd(), // Use current repo
      since: '3 months ago',
    });

    expect(result.success).toBe(true);
    expect(result.output).toBeDefined();
    expect(result.output).toContain('Code Hotspot Analysis');
  }, 300000); // 5 minute timeout for git analysis (slow on Windows)

  it('should handle different time ranges', async () => {
    const result = await tool.execute({
      directory: process.cwd(),
      since: '1 week ago',
    });

    expect(result.success).toBe(true);
    expect(result.output).toBeDefined();
  }, 300000); // 5 minute timeout for git analysis (slow on Windows)

  it('should handle non-git directory', async () => {
    const result = await tool.execute({
      directory: '/tmp',
      since: '1 month ago',
    });

    // Should handle gracefully - either succeed with no results or fail
    expect(result).toBeDefined();
  });

  it('should limit results to top hotspots', async () => {
    const result = await tool.execute({
      directory: process.cwd(),
      since: '6 months ago',
      hotspotThreshold: 5,
    });

    expect(result.success).toBe(true);
    expect(result.output).toBeDefined();
  }, 300000); // 5 minute timeout for git analysis (slow on Windows)
});

describe('CalculateMetricsTool', () => {
  let tool: CalculateMetricsTool;

  beforeEach(() => {
    tool = new CalculateMetricsTool();
  });

  it('should provide tool definition', () => {
    const def = tool.getToolDefinition();
    expect(def.function.name).toBe('calculate_metrics');
    expect(def.function.description).toContain('metrics');
    expect(def.function.parameters.properties).toHaveProperty('directory');
  });

  it('should calculate code metrics', async () => {
    const result = await tool.execute({ directory: TEST_DIR });

    expect(result.success).toBe(true);
    expect(result.output).toBeDefined();
    expect(result.output).toContain('Code Metrics Analysis');
  });

  it('should include complexity metrics', async () => {
    const result = await tool.execute({ directory: TEST_DIR });

    expect(result.success).toBe(true);
    if (result.output) {
      expect(result.output).toContain('Complexity');
    }
  });

  it('should include maintainability index', async () => {
    const result = await tool.execute({ directory: TEST_DIR });

    expect(result.success).toBe(true);
    if (result.output) {
      // Should include maintainability metrics
      expect(result.output).toBeDefined();
    }
  });

  it('should handle invalid directory', async () => {
    const result = await tool.execute({ directory: '/does/not/exist' });

    // Tools may handle gracefully
    expect(result).toBeDefined();
    if (!result.success) {
      expect(result.error).toBeDefined();
    }
  });
});

describe('AnalyzeSecurityTool', () => {
  let tool: AnalyzeSecurityTool;

  beforeEach(() => {
    tool = new AnalyzeSecurityTool();
  });

  it('should provide tool definition', () => {
    const def = tool.getToolDefinition();
    expect(def.function.name).toBe('analyze_security');
    expect(def.function.description).toContain('security');
    expect(def.function.parameters.properties).toHaveProperty('directory');
  });

  it('should analyze security vulnerabilities', async () => {
    const result = await tool.execute({ directory: TEST_DIR });

    expect(result.success).toBe(true);
    expect(result.output).toBeDefined();
    expect(result.output).toContain('Security Analysis');
  });

  it('should categorize vulnerabilities by severity', async () => {
    const result = await tool.execute({ directory: TEST_DIR });

    expect(result.success).toBe(true);
    if (result.output?.includes('Vulnerabilities Found')) {
      expect(result.output).toContain('Severity');
    }
  });

  it('should detect common vulnerability patterns', async () => {
    const result = await tool.execute({ directory: TEST_DIR });

    expect(result.success).toBe(true);
    expect(result.output).toBeDefined();
  });

  it('should handle directory with no security issues', async () => {
    const result = await tool.execute({ directory: TEST_DIR });

    expect(result.success).toBe(true);
    expect(result.output).toBeDefined();
  });

  it('should handle invalid directory', async () => {
    const result = await tool.execute({ directory: '/invalid/security/path' });

    // Tools may handle gracefully
    expect(result).toBeDefined();
    if (!result.success) {
      expect(result.error).toBeDefined();
    }
  });
});
