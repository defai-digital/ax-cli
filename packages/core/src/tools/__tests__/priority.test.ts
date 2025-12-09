/**
 * Unit tests for Tool Priority System
 *
 * Tests for priority.ts - the core priority types, constants, and utility functions
 */

import { describe, it, expect } from 'vitest';
import {
  ToolPriority,
  PROVIDER_AFFINITY_BOOST,
  SUPERSEDE_THRESHOLD,
  VARIANT_DELIMITERS,
  NATIVE_CAPABILITY_PREFIX,
  isVariantOf,
  providerMatches,
  PROVIDER_NATIVE_CAPABILITIES,
  MCP_CAPABILITY_REGISTRY,
  getServerCapabilityMapping,
  hasNativeCapability,
  getServerPriority,
  shouldPreferServer,
  getServersForCapability,
} from '../priority.js';

describe('priority.ts', () => {
  describe('ToolPriority enum', () => {
    it('should have correct priority ordering (higher = more preferred)', () => {
      expect(ToolPriority.NATIVE_API).toBeGreaterThan(ToolPriority.PROVIDER_MCP);
      expect(ToolPriority.PROVIDER_MCP).toBeGreaterThan(ToolPriority.DOMAIN_SPECIFIC);
      expect(ToolPriority.DOMAIN_SPECIFIC).toBeGreaterThan(ToolPriority.OFFICIAL_MCP);
      expect(ToolPriority.OFFICIAL_MCP).toBeGreaterThan(ToolPriority.COMMUNITY_MCP);
      expect(ToolPriority.COMMUNITY_MCP).toBeGreaterThan(ToolPriority.GENERAL_MCP);
      expect(ToolPriority.GENERAL_MCP).toBeGreaterThan(ToolPriority.BUILTIN_TOOL);
    });

    it('should have expected values', () => {
      expect(ToolPriority.NATIVE_API).toBe(100);
      expect(ToolPriority.PROVIDER_MCP).toBe(80);
      expect(ToolPriority.DOMAIN_SPECIFIC).toBe(60);
      expect(ToolPriority.OFFICIAL_MCP).toBe(40);
      expect(ToolPriority.COMMUNITY_MCP).toBe(20);
      expect(ToolPriority.GENERAL_MCP).toBe(10);
      expect(ToolPriority.BUILTIN_TOOL).toBe(5);
    });
  });

  describe('Constants', () => {
    it('should have PROVIDER_AFFINITY_BOOST defined', () => {
      expect(PROVIDER_AFFINITY_BOOST).toBe(10);
    });

    it('should have SUPERSEDE_THRESHOLD defined', () => {
      expect(SUPERSEDE_THRESHOLD).toBe(15);
    });

    it('should have VARIANT_DELIMITERS with hyphen and underscore', () => {
      expect(VARIANT_DELIMITERS).toContain('-');
      expect(VARIANT_DELIMITERS).toContain('_');
      expect(VARIANT_DELIMITERS).toHaveLength(2);
    });

    it('should have NATIVE_CAPABILITY_PREFIX defined', () => {
      expect(NATIVE_CAPABILITY_PREFIX).toBe('native_');
    });
  });

  describe('isVariantOf', () => {
    it('should return true for hyphen-separated variants', () => {
      expect(isVariantOf('grok-beta', 'grok')).toBe(true);
      expect(isVariantOf('glm-4', 'glm')).toBe(true);
      expect(isVariantOf('automatosx-glm', 'automatosx')).toBe(true);
    });

    it('should return true for underscore-separated variants', () => {
      expect(isVariantOf('grok_beta', 'grok')).toBe(true);
      expect(isVariantOf('glm_4', 'glm')).toBe(true);
      expect(isVariantOf('automatosx_custom', 'automatosx')).toBe(true);
    });

    it('should return false for exact matches (not variants)', () => {
      expect(isVariantOf('grok', 'grok')).toBe(false);
      expect(isVariantOf('glm', 'glm')).toBe(false);
    });

    it('should return false for unrelated names', () => {
      expect(isVariantOf('claude', 'grok')).toBe(false);
      expect(isVariantOf('openai', 'glm')).toBe(false);
    });

    it('should return false for names without delimiter', () => {
      expect(isVariantOf('grokbeta', 'grok')).toBe(false);
      expect(isVariantOf('automatosxtra', 'automatosx')).toBe(false);
    });
  });

  describe('providerMatches', () => {
    it('should return true for exact matches', () => {
      expect(providerMatches('grok', 'grok')).toBe(true);
      expect(providerMatches('glm', 'glm')).toBe(true);
      expect(providerMatches('claude', 'claude')).toBe(true);
    });

    it('should return true for hyphen-separated variants', () => {
      expect(providerMatches('grok-beta', 'grok')).toBe(true);
      expect(providerMatches('glm-4', 'glm')).toBe(true);
      expect(providerMatches('claude-3', 'claude')).toBe(true);
    });

    it('should return true for underscore-separated variants', () => {
      expect(providerMatches('grok_beta', 'grok')).toBe(true);
      expect(providerMatches('gemini_pro', 'gemini')).toBe(true);
    });

    it('should be case-insensitive', () => {
      expect(providerMatches('GROK', 'grok')).toBe(true);
      expect(providerMatches('Grok-Beta', 'grok')).toBe(true);
      expect(providerMatches('GLM', 'glm')).toBe(true);
    });

    it('should return false for non-matching providers', () => {
      expect(providerMatches('grok', 'glm')).toBe(false);
      expect(providerMatches('claude', 'openai')).toBe(false);
    });

    it('should return false for unknown providers', () => {
      expect(providerMatches('unknown', 'grok')).toBe(false);
      expect(providerMatches('custom-provider', 'claude')).toBe(false);
    });
  });

  describe('PROVIDER_NATIVE_CAPABILITIES', () => {
    it('should have Grok with native web-search', () => {
      expect(PROVIDER_NATIVE_CAPABILITIES.grok).toContain('web-search');
    });

    it('should have Gemini with native web-search', () => {
      expect(PROVIDER_NATIVE_CAPABILITIES.gemini).toContain('web-search');
    });

    it('should have GLM with no native capabilities (uses Z.AI MCP)', () => {
      expect(PROVIDER_NATIVE_CAPABILITIES.glm).toHaveLength(0);
    });

    it('should have Claude with no native capabilities', () => {
      expect(PROVIDER_NATIVE_CAPABILITIES.claude).toHaveLength(0);
    });

    it('should have OpenAI with no native capabilities', () => {
      expect(PROVIDER_NATIVE_CAPABILITIES.openai).toHaveLength(0);
    });
  });

  describe('MCP_CAPABILITY_REGISTRY', () => {
    it('should have AutomatosX as general-purpose MCP', () => {
      const automatosx = MCP_CAPABILITY_REGISTRY.find(m => m.serverName === 'automatosx');
      expect(automatosx).toBeDefined();
      expect(automatosx?.priority).toBe(ToolPriority.GENERAL_MCP);
      expect(automatosx?.capabilities).toContain('memory');
      expect(automatosx?.capabilities).toContain('agent-delegation');
    });

    it('should have Z.AI servers with GLM affinity', () => {
      const zaiSearch = MCP_CAPABILITY_REGISTRY.find(m => m.serverName === 'zai-web-search');
      expect(zaiSearch).toBeDefined();
      expect(zaiSearch?.providerAffinity).toContain('glm');
      expect(zaiSearch?.priority).toBe(ToolPriority.PROVIDER_MCP);
    });

    it('should have Figma as domain-specific MCP', () => {
      const figma = MCP_CAPABILITY_REGISTRY.find(m => m.serverName === 'figma');
      expect(figma).toBeDefined();
      expect(figma?.priority).toBe(ToolPriority.DOMAIN_SPECIFIC);
      expect(figma?.capabilities).toContain('design-figma');
    });

    it('should have GitHub as official MCP', () => {
      const github = MCP_CAPABILITY_REGISTRY.find(m => m.serverName === 'github');
      expect(github).toBeDefined();
      expect(github?.priority).toBe(ToolPriority.OFFICIAL_MCP);
      expect(github?.isOfficial).toBe(true);
    });

    it('should NOT have Puppeteer marked with web-fetch capability', () => {
      // This was a bug - Puppeteer is for browser automation, not lightweight HTTP fetch
      const puppeteer = MCP_CAPABILITY_REGISTRY.find(m => m.serverName === 'puppeteer');
      expect(puppeteer).toBeDefined();
      expect(puppeteer?.capabilities).not.toContain('web-fetch');
      expect(puppeteer?.capabilities).toContain('testing');
    });
  });

  describe('getServerCapabilityMapping', () => {
    it('should find exact match (case-insensitive)', () => {
      expect(getServerCapabilityMapping('automatosx')).toBeDefined();
      expect(getServerCapabilityMapping('AUTOMATOSX')).toBeDefined();
      expect(getServerCapabilityMapping('AutomatosX')).toBeDefined();
    });

    it('should find prefix match with hyphen delimiter', () => {
      const result = getServerCapabilityMapping('automatosx-glm');
      expect(result).toBeDefined();
      expect(result?.serverName).toBe('automatosx');
    });

    it('should find prefix match with underscore delimiter', () => {
      const result = getServerCapabilityMapping('automatosx_custom');
      expect(result).toBeDefined();
      expect(result?.serverName).toBe('automatosx');
    });

    it('should return undefined for unknown servers', () => {
      expect(getServerCapabilityMapping('unknown-server')).toBeUndefined();
    });

    it('should return undefined for empty string', () => {
      expect(getServerCapabilityMapping('')).toBeUndefined();
    });

    it('should prefer longer/more specific prefix matches', () => {
      // If we had 'zai' and 'zai-web' in registry, 'zai-web-search' should match 'zai-web'
      // Current registry has 'zai-web-search' as exact match
      const result = getServerCapabilityMapping('zai-web-search');
      expect(result?.serverName).toBe('zai-web-search');
    });

    it('should sort prefix matches by length (longer first) to prefer specific matches', () => {
      // Test the sorting logic in line 219: .sort((a, b) => b.serverName.length - a.serverName.length)
      // When multiple servers could match a prefix, the longer/more specific one should win
      // Example: if both 'github' and 'git' existed, 'github-enterprise' should match 'github'

      // Currently, 'github' is in registry. 'github-enterprise' should match it.
      const result = getServerCapabilityMapping('github-enterprise');
      expect(result).toBeDefined();
      expect(result?.serverName).toBe('github');
    });

    it('should handle prefix match with multiple potential matches', () => {
      // zai-web-search is an exact match, but let's test variants
      // zai-web-search-custom should match zai-web-search (longer prefix)
      const result = getServerCapabilityMapping('zai-web-search-custom');
      expect(result).toBeDefined();
      expect(result?.serverName).toBe('zai-web-search');
    });

    it('should handle case-insensitive prefix matching', () => {
      const result = getServerCapabilityMapping('GITHUB-Enterprise');
      expect(result).toBeDefined();
      expect(result?.serverName).toBe('github');
    });

    it('should not match partial server names without delimiter', () => {
      // 'auto' should NOT match 'automatosx' (no delimiter)
      // 'automatosxtra' should NOT match 'automatosx' (no delimiter after prefix)
      const result1 = getServerCapabilityMapping('auto');
      const result2 = getServerCapabilityMapping('automatosxtra');

      expect(result1).toBeUndefined();
      expect(result2).toBeUndefined();
    });
  });

  describe('hasNativeCapability', () => {
    it('should return true for Grok web-search', () => {
      expect(hasNativeCapability('grok', 'web-search')).toBe(true);
    });

    it('should return true for Gemini web-search', () => {
      expect(hasNativeCapability('gemini', 'web-search')).toBe(true);
    });

    it('should return false for GLM web-search (uses MCP)', () => {
      expect(hasNativeCapability('glm', 'web-search')).toBe(false);
    });

    it('should return false for Claude web-search', () => {
      expect(hasNativeCapability('claude', 'web-search')).toBe(false);
    });

    it('should support provider variants with hyphen', () => {
      expect(hasNativeCapability('grok-beta', 'web-search')).toBe(true);
      expect(hasNativeCapability('grok-3', 'web-search')).toBe(true);
      expect(hasNativeCapability('glm-4', 'web-search')).toBe(false);
    });

    it('should support provider variants with underscore', () => {
      expect(hasNativeCapability('grok_beta', 'web-search')).toBe(true);
      expect(hasNativeCapability('gemini_pro', 'web-search')).toBe(true);
    });

    it('should be case-insensitive', () => {
      expect(hasNativeCapability('GROK', 'web-search')).toBe(true);
      expect(hasNativeCapability('Grok', 'web-search')).toBe(true);
    });

    it('should return false for unknown providers', () => {
      expect(hasNativeCapability('unknown-provider', 'web-search')).toBe(false);
    });

    it('should return false for capabilities no provider has natively', () => {
      expect(hasNativeCapability('grok', 'memory')).toBe(false);
      expect(hasNativeCapability('grok', 'database')).toBe(false);
    });
  });

  describe('getServerPriority', () => {
    it('should return base priority for server without provider', () => {
      expect(getServerPriority('automatosx')).toBe(ToolPriority.GENERAL_MCP);
      expect(getServerPriority('github')).toBe(ToolPriority.OFFICIAL_MCP);
      expect(getServerPriority('figma')).toBe(ToolPriority.DOMAIN_SPECIFIC);
    });

    it('should return community priority for unknown servers', () => {
      expect(getServerPriority('unknown-server')).toBe(ToolPriority.COMMUNITY_MCP);
    });

    it('should boost priority for servers with provider affinity', () => {
      // Z.AI servers have GLM affinity
      const baseZaiPriority = ToolPriority.PROVIDER_MCP;
      const boostedPriority = getServerPriority('zai-web-search', 'glm');
      expect(boostedPriority).toBe(baseZaiPriority + PROVIDER_AFFINITY_BOOST);
    });

    it('should NOT boost priority for servers without matching affinity', () => {
      // Z.AI servers have GLM affinity, not Grok
      const priority = getServerPriority('zai-web-search', 'grok');
      expect(priority).toBe(ToolPriority.PROVIDER_MCP); // No boost
    });

    it('should support provider variant matching for affinity', () => {
      // glm-4 should still match glm affinity
      const boostedPriority = getServerPriority('zai-web-search', 'glm-4');
      expect(boostedPriority).toBe(ToolPriority.PROVIDER_MCP + PROVIDER_AFFINITY_BOOST);
    });
  });

  describe('shouldPreferServer', () => {
    it('should return false if server does not provide the capability', () => {
      // AutomatosX provides web-search, not database
      expect(shouldPreferServer('automatosx', 'database', 'glm')).toBe(false);
    });

    it('should return false if provider has native capability', () => {
      // Grok has native web-search, so no MCP should be preferred
      expect(shouldPreferServer('automatosx', 'web-search', 'grok')).toBe(false);
      expect(shouldPreferServer('zai-web-search', 'web-search', 'grok')).toBe(false);
    });

    it('should return true for server with provider affinity', () => {
      // Z.AI web-search has GLM affinity
      expect(shouldPreferServer('zai-web-search', 'web-search', 'glm')).toBe(true);
    });

    it('should return true for highest priority server without affinity', () => {
      // For database capability on Claude, postgres (OFFICIAL_MCP) should be preferred
      // over supabase (COMMUNITY_MCP)
      expect(shouldPreferServer('postgres', 'database', 'claude')).toBe(true);
      expect(shouldPreferServer('supabase', 'database', 'claude')).toBe(false);
    });

    it('should return false for unknown servers', () => {
      expect(shouldPreferServer('unknown-server', 'web-search', 'glm')).toBe(false);
    });

    it('should handle case-insensitive server name comparison', () => {
      // Test that mixed-case server names work correctly
      // postgres is in registry as 'postgres', but passing 'Postgres' or 'POSTGRES' should work
      expect(shouldPreferServer('Postgres', 'database', 'claude')).toBe(true);
      expect(shouldPreferServer('POSTGRES', 'database', 'claude')).toBe(true);
      expect(shouldPreferServer('PostgreS', 'database', 'claude')).toBe(true);
    });
  });

  describe('getServersForCapability', () => {
    it('should return servers sorted by priority (highest first)', () => {
      const servers = getServersForCapability('web-search');
      expect(servers.length).toBeGreaterThan(0);

      // Verify sorted by priority descending
      for (let i = 1; i < servers.length; i++) {
        const prevPriority = getServerPriority(servers[i - 1].serverName);
        const currPriority = getServerPriority(servers[i].serverName);
        expect(prevPriority).toBeGreaterThanOrEqual(currPriority);
      }
    });

    it('should boost affinity servers when provider is specified', () => {
      const serversForGlm = getServersForCapability('web-search', 'glm');

      // Z.AI should be first for GLM due to affinity boost
      expect(serversForGlm[0].serverName).toBe('zai-web-search');
    });

    it('should return empty array for capabilities no server provides', () => {
      // code-generation is defined but no server in registry provides it
      const servers = getServersForCapability('code-generation');
      expect(servers).toHaveLength(0);
    });

    it('should return multiple servers for common capabilities', () => {
      const dbServers = getServersForCapability('database');
      expect(dbServers.length).toBeGreaterThan(1);
      // Should include postgres, sqlite, supabase, firebase
    });
  });
});
