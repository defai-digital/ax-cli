/**
 * Tests for Agent-First Router
 *
 * @module tests/agent/agent-router.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  routeToAgent,
  matchAgentByKeywords,
  checkAgentAvailability,
  resetAgentAvailabilityCache,
  getAvailableAgents,
  isAgentAvailable,
  type AgentRouterConfig,
} from '../../src/agent/agent-router.js';
import * as fs from 'fs';
import * as path from 'path';

// Mock fs module
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readdirSync: vi.fn(),
}));

describe('AgentRouter', () => {
  const mockFs = vi.mocked(fs);

  beforeEach(() => {
    // Reset cache before each test
    resetAgentAvailabilityCache();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('checkAgentAvailability', () => {
    it('returns available agents when .automatosx/agents directory exists', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockReturnValue([
        'backend.yaml',
        'frontend.yaml',
        'security.yml',
        'README.md', // Should be filtered out
      ] as unknown as fs.Dirent[]);

      const result = checkAgentAvailability();

      expect(result.available).toBe(true);
      expect(result.agents).toEqual(['backend', 'frontend', 'security']);
    });

    it('returns unavailable when directory does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);

      const result = checkAgentAvailability();

      expect(result.available).toBe(false);
      expect(result.agents).toEqual([]);
    });

    it('returns unavailable when directory read fails', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const result = checkAgentAvailability();

      expect(result.available).toBe(false);
      expect(result.agents).toEqual([]);
    });

    it('caches availability results', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockReturnValue(['backend.yaml'] as unknown as fs.Dirent[]);

      // First call
      checkAgentAvailability();
      // Second call should use cache
      checkAgentAvailability();

      // Should only call existsSync once due to caching
      expect(mockFs.existsSync).toHaveBeenCalledTimes(1);
    });

    it('respects cache TTL', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockReturnValue(['backend.yaml'] as unknown as fs.Dirent[]);

      checkAgentAvailability();

      // Reset cache to simulate TTL expiration
      resetAgentAvailabilityCache();

      checkAgentAvailability();

      // Should call existsSync twice after cache reset
      expect(mockFs.existsSync).toHaveBeenCalledTimes(2);
    });
  });

  describe('matchAgentByKeywords', () => {
    const allAgents = ['backend', 'frontend', 'security', 'quality', 'devops', 'standard'];

    it('routes "create REST API" to backend agent', () => {
      const result = matchAgentByKeywords('create REST API endpoint', allAgents);

      expect(result?.agent).toBe('backend');
      expect(result?.confidence).toBeGreaterThan(0.7);
    });

    it('routes "write vitest tests" to quality agent', () => {
      const result = matchAgentByKeywords('write vitest tests for this module', allAgents);

      expect(result?.agent).toBe('quality');
      expect(result?.confidence).toBeGreaterThan(0.8);
    });

    it('routes "security vulnerability" to security agent', () => {
      const result = matchAgentByKeywords('check for security vulnerabilities', allAgents);

      expect(result?.agent).toBe('security');
      expect(result?.confidence).toBeGreaterThan(0.85);
    });

    it('routes "docker kubernetes deployment" to devops agent', () => {
      const result = matchAgentByKeywords('set up docker kubernetes deployment', allAgents);

      expect(result?.agent).toBe('devops');
      expect(result?.confidence).toBeGreaterThan(0.8);
    });

    it('routes "react component styling" to frontend agent', () => {
      const result = matchAgentByKeywords('create react component with tailwind styling', allAgents);

      expect(result?.agent).toBe('frontend');
      expect(result?.confidence).toBeGreaterThan(0.7);
    });

    it('routes "code review best practices" to standard agent', () => {
      const result = matchAgentByKeywords('code review for best practices', allAgents);

      expect(result?.agent).toBe('standard');
      expect(result?.confidence).toBeGreaterThan(0.6);
    });

    it('returns null for generic queries with no clear domain', () => {
      const result = matchAgentByKeywords('help me with this problem', allAgents);

      expect(result).toBeNull();
    });

    it('only routes to available agents', () => {
      // backend not in available list
      const result = matchAgentByKeywords('create REST API', ['frontend', 'security']);

      // Should not match backend since it's not available
      expect(result?.agent).not.toBe('backend');
    });

    it('respects excluded agents', () => {
      const result = matchAgentByKeywords('create REST API endpoint', allAgents, ['backend']);

      // Backend should be excluded, no match
      expect(result?.agent).not.toBe('backend');
    });

    it('extracts matched keywords', () => {
      const result = matchAgentByKeywords('create REST API with database', allAgents);

      expect(result?.matchedKeywords).toContain('api');
    });

    it('prioritizes security over other domains', () => {
      // Security keywords should have higher priority
      const result = matchAgentByKeywords('API authentication security', allAgents);

      expect(result?.agent).toBe('security');
    });
  });

  describe('routeToAgent', () => {
    const defaultConfig: AgentRouterConfig = {
      enabled: true,
      defaultAgent: 'standard',
      confidenceThreshold: 0.6,
      excludedAgents: [],
    };

    beforeEach(() => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockReturnValue([
        'backend.yaml',
        'frontend.yaml',
        'security.yaml',
        'quality.yaml',
        'devops.yaml',
        'standard.yaml',
      ] as unknown as fs.Dirent[]);
    });

    it('routes to matched agent when confidence meets threshold', () => {
      const result = routeToAgent('create REST API endpoint', defaultConfig);

      expect(result.agent).toBe('backend');
      expect(result.confidence).toBeGreaterThanOrEqual(0.6);
      expect(result.transparencyNote).toContain('backend');
    });

    it('returns default agent when no match found', () => {
      const result = routeToAgent('hello world', defaultConfig);

      expect(result.agent).toBe('standard');
      expect(result.confidence).toBe(0.5);
    });

    it('returns null agent when disabled', () => {
      const result = routeToAgent('create REST API', { ...defaultConfig, enabled: false });

      expect(result.agent).toBeNull();
      expect(result.confidence).toBe(0);
    });

    it('returns null agent when no agents available', () => {
      mockFs.existsSync.mockReturnValue(false);
      resetAgentAvailabilityCache();

      const result = routeToAgent('create REST API', defaultConfig);

      expect(result.agent).toBeNull();
    });

    it('respects confidence threshold', () => {
      const highThresholdConfig = { ...defaultConfig, confidenceThreshold: 0.95 };
      const result = routeToAgent('refactor code', highThresholdConfig);

      // Standard agent has 0.65 confidence which is below 0.95
      // Should fall back to default agent
      expect(result.agent).toBe('standard');
      expect(result.confidence).toBe(0.5); // Default agent confidence
    });

    it('excludes specified agents', () => {
      const result = routeToAgent('create REST API endpoint', {
        ...defaultConfig,
        excludedAgents: ['backend'],
      });

      expect(result.agent).not.toBe('backend');
    });

    it('returns null when default agent is null and no match', () => {
      const result = routeToAgent('hello', { ...defaultConfig, defaultAgent: null });

      expect(result.agent).toBeNull();
    });
  });

  describe('getAvailableAgents', () => {
    it('returns list of available agents', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockReturnValue([
        'backend.yaml',
        'frontend.yaml',
      ] as unknown as fs.Dirent[]);

      const agents = getAvailableAgents();

      expect(agents).toEqual(['backend', 'frontend']);
    });
  });

  describe('isAgentAvailable', () => {
    beforeEach(() => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockReturnValue([
        'backend.yaml',
        'frontend.yaml',
      ] as unknown as fs.Dirent[]);
    });

    it('returns true for available agent', () => {
      expect(isAgentAvailable('backend')).toBe(true);
    });

    it('returns false for unavailable agent', () => {
      expect(isAgentAvailable('security')).toBe(false);
    });
  });

  describe('keyword matching edge cases', () => {
    const allAgents = ['backend', 'frontend', 'security', 'quality', 'devops', 'mobile', 'data', 'architecture', 'product', 'writer', 'design', 'standard'];

    it('handles case-insensitive matching', () => {
      const result = matchAgentByKeywords('CREATE REST API', allAgents);
      expect(result?.agent).toBe('backend');
    });

    it('handles multiple keyword matches', () => {
      // Should pick the highest confidence match
      const result = matchAgentByKeywords('API security vulnerability test', allAgents);
      // Security has higher priority
      expect(result?.agent).toBe('security');
    });

    it('handles mobile app keywords', () => {
      const result = matchAgentByKeywords('create iOS mobile app with Swift', allAgents);
      expect(result?.agent).toBe('mobile');
    });

    it('handles data pipeline keywords', () => {
      const result = matchAgentByKeywords('build ETL data pipeline', allAgents);
      expect(result?.agent).toBe('data');
    });

    it('handles architecture keywords', () => {
      // Use a phrase that clearly matches architecture (architect, ADR, system design)
      const result = matchAgentByKeywords('write ADR for system architect decision', allAgents);
      expect(result?.agent).toBe('architecture');
    });

    it('handles product keywords', () => {
      const result = matchAgentByKeywords('write PRD product requirement document', allAgents);
      expect(result?.agent).toBe('product');
    });

    it('handles documentation keywords', () => {
      const result = matchAgentByKeywords('update README documentation', allAgents);
      expect(result?.agent).toBe('writer');
    });

    it('handles design keywords', () => {
      const result = matchAgentByKeywords('create Figma UI/UX wireframe', allAgents);
      expect(result?.agent).toBe('design');
    });

    it('handles empty input', () => {
      const result = matchAgentByKeywords('', allAgents);
      expect(result).toBeNull();
    });

    it('handles special characters in input', () => {
      // "bug" keyword matches quality agent first; use API-focused phrase
      const result = matchAgentByKeywords('create @api/v2 endpoint (REST) for users', allAgents);
      expect(result?.agent).toBe('backend');
    });
  });
});
