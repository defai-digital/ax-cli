/**
 * Tests for MCP Config Detector
 *
 * Tests the config format detection and validation system.
 * Verifies:
 * - Legacy format detection
 * - AutomatosX config detection
 * - Transport validation
 * - Batch processing
 */

import { describe, it, expect } from 'vitest';
import {
  isLegacyStdioFormat,
  isAutomatosXConfig,
  detectConfigFormat,
  validateTransportConfig,
  detectMultipleConfigs,
  getDetectionSummary
} from '../../src/mcp/config-detector.js';
import type { MCPServerConfig } from '../../src/schemas/settings-schemas.js';

describe('MCP Config Detector', () => {
  describe('isLegacyStdioFormat', () => {
    it('should detect legacy stdio format with command/args', () => {
      const config = {
        name: 'test',
        command: 'node',
        args: ['server.js']
      };

      expect(isLegacyStdioFormat(config)).toBe(true);
    });

    it('should not detect modern format as legacy', () => {
      const config: MCPServerConfig = {
        name: 'test',
        transport: {
          type: 'stdio',
          command: 'node',
          args: ['server.js']
        }
      };

      expect(isLegacyStdioFormat(config)).toBe(false);
    });

    it('should handle config with missing command', () => {
      const config = {
        name: 'test',
        args: ['server.js']
      };

      expect(isLegacyStdioFormat(config)).toBe(false);
    });

    it('should handle config with missing args', () => {
      const config = {
        name: 'test',
        command: 'node'
      };

      // Legacy format requires both command AND args
      expect(isLegacyStdioFormat(config)).toBe(false);
    });

    it('should handle empty config', () => {
      const config = {};

      expect(isLegacyStdioFormat(config)).toBe(false);
    });

    it('should handle config with both legacy and modern fields', () => {
      const config = {
        name: 'test',
        command: 'node',
        args: ['server.js'],
        transport: {
          type: 'stdio',
          command: 'node',
          args: ['server.js']
        }
      };

      // Has modern transport field, so not legacy
      expect(isLegacyStdioFormat(config)).toBe(false);
    });
  });

  describe('isAutomatosXConfig', () => {
    it('should detect AutomatosX config with env section', () => {
      const config = {
        name: 'test',
        transport: {
          type: 'stdio',
          command: 'node',
          args: ['server.js']
        },
        env: {
          API_KEY: 'test'
        }
      };

      expect(isAutomatosXConfig(config)).toBe(true);
    });

    it('should not detect regular config as AutomatosX', () => {
      const config: MCPServerConfig = {
        name: 'test',
        transport: {
          type: 'stdio',
          command: 'node',
          args: ['server.js']
        }
      };

      expect(isAutomatosXConfig(config)).toBe(false);
    });

    it('should handle config with empty env', () => {
      const config = {
        name: 'test',
        transport: {
          type: 'stdio',
          command: 'node',
          args: ['server.js']
        },
        env: {}
      };

      // Empty env object still counts as AutomatosX marker
      expect(isAutomatosXConfig(config)).toBe(true);
    });

    it('should handle null env', () => {
      const config = {
        name: 'test',
        transport: {
          type: 'stdio',
          command: 'node',
          args: ['server.js']
        },
        env: null
      };

      expect(isAutomatosXConfig(config)).toBe(false);
    });
  });

  describe('detectConfigFormat', () => {
    it('should detect modern stdio config', () => {
      const config: MCPServerConfig = {
        name: 'test',
        transport: {
          type: 'stdio',
          command: 'node',
          args: ['server.js']
        }
      };

      const result = detectConfigFormat(config);

      expect(result.isValid).toBe(true);
      expect(result.isLegacy).toBe(false);
      expect(result.isAutomatosX).toBe(false);
      expect(result.transportType).toBe('stdio');
      expect(result.issues).toEqual([]);
    });

    it('should detect legacy stdio config', () => {
      const config = {
        name: 'test',
        command: 'node',
        args: ['server.js']
      };

      const result = detectConfigFormat(config);

      expect(result.isValid).toBe(false);
      expect(result.isLegacy).toBe(true);
      expect(result.isAutomatosX).toBe(false);
      expect(result.transportType).toBe('stdio');
      expect(result.issues).toContain('Legacy stdio format (missing transport wrapper)');
    });

    it('should detect AutomatosX config', () => {
      const config = {
        name: 'test',
        transport: {
          type: 'stdio',
          command: 'node',
          args: ['server.js']
        },
        env: {
          API_KEY: 'test'
        }
      };

      const result = detectConfigFormat(config);

      expect(result.isValid).toBe(true);
      expect(result.isLegacy).toBe(false);
      expect(result.isAutomatosX).toBe(true);
      expect(result.transportType).toBe('stdio');
    });

    it('should detect modern sse config', () => {
      const config: MCPServerConfig = {
        name: 'test',
        transport: {
          type: 'sse',
          url: 'https://example.com/sse'
        }
      };

      const result = detectConfigFormat(config);

      expect(result.isValid).toBe(true);
      expect(result.isLegacy).toBe(false);
      expect(result.transportType).toBe('sse');
    });

    it('should detect invalid config with missing transport', () => {
      const config = {
        name: 'test'
      };

      const result = detectConfigFormat(config);

      expect(result.isValid).toBe(false);
      expect(result.issues).toContain('Missing transport configuration');
    });

    it('should detect multiple issues in config', () => {
      const config = {
        name: 'test',
        command: 'node',
        // Missing args (invalid legacy)
        env: {
          API_KEY: 'test'
        }
      };

      const result = detectConfigFormat(config);

      expect(result.isValid).toBe(false);
      expect(result.isAutomatosX).toBe(true);
      expect(result.issues.length).toBeGreaterThan(0);
    });
  });

  describe('validateTransportConfig', () => {
    it('should validate valid stdio transport', () => {
      const transport = {
        type: 'stdio' as const,
        command: 'node',
        args: ['server.js']
      };

      const result = validateTransportConfig(transport);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should validate stdio transport with empty args', () => {
      const transport = {
        type: 'stdio' as const,
        command: 'node',
        args: []
      };

      const result = validateTransportConfig(transport);

      expect(result.isValid).toBe(true);
    });

    it('should reject stdio transport with missing command', () => {
      const transport = {
        type: 'stdio' as const,
        args: ['server.js']
      } as any;

      const result = validateTransportConfig(transport);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('stdio transport requires command');
    });

    it('should validate valid sse transport', () => {
      const transport = {
        type: 'sse' as const,
        url: 'https://example.com/sse'
      };

      const result = validateTransportConfig(transport);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should reject sse transport with missing url', () => {
      const transport = {
        type: 'sse' as const
      } as any;

      const result = validateTransportConfig(transport);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('sse transport requires url');
    });

    it('should validate valid http transport', () => {
      const transport = {
        type: 'http' as const,
        url: 'https://example.com/api'
      };

      const result = validateTransportConfig(transport);

      expect(result.isValid).toBe(true);
    });

    it('should validate http transport with headers', () => {
      const transport = {
        type: 'http' as const,
        url: 'https://example.com/api',
        headers: {
          'Authorization': 'Bearer token'
        }
      };

      const result = validateTransportConfig(transport);

      expect(result.isValid).toBe(true);
    });

    it('should reject invalid transport type', () => {
      const transport = {
        type: 'invalid' as any,
        url: 'https://example.com'
      };

      const result = validateTransportConfig(transport);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle null transport', () => {
      const result = validateTransportConfig(null as any);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Transport configuration is required');
    });

    it('should handle undefined transport', () => {
      const result = validateTransportConfig(undefined as any);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Transport configuration is required');
    });
  });

  describe('detectMultipleConfigs', () => {
    it('should detect formats for multiple configs', () => {
      const configs = {
        'server1': {
          name: 'server1',
          transport: {
            type: 'stdio' as const,
            command: 'node',
            args: ['s1.js']
          }
        },
        'server2': {
          name: 'server2',
          command: 'node',
          args: ['s2.js']
        },
        'server3': {
          name: 'server3',
          transport: {
            type: 'sse' as const,
            url: 'https://example.com/sse'
          },
          env: {
            API_KEY: 'test'
          }
        }
      };

      const results = detectMultipleConfigs(configs);

      expect(results).toHaveLength(3);
      expect(results[0].serverName).toBe('server1');
      expect(results[0].detection.isValid).toBe(true);
      expect(results[0].detection.isLegacy).toBe(false);

      expect(results[1].serverName).toBe('server2');
      expect(results[1].detection.isValid).toBe(false);
      expect(results[1].detection.isLegacy).toBe(true);

      expect(results[2].serverName).toBe('server3');
      expect(results[2].detection.isValid).toBe(true);
      expect(results[2].detection.isAutomatosX).toBe(true);
    });

    it('should handle empty configs object', () => {
      const results = detectMultipleConfigs({});

      expect(results).toEqual([]);
    });

    it('should handle null configs', () => {
      const results = detectMultipleConfigs(null as any);

      expect(results).toEqual([]);
    });
  });

  describe('getDetectionSummary', () => {
    it('should generate summary statistics', () => {
      const results = [
        {
          serverName: 's1',
          detection: {
            isValid: true,
            isLegacy: false,
            isAutomatosX: false,
            transportType: 'stdio',
            issues: []
          }
        },
        {
          serverName: 's2',
          detection: {
            isValid: false,
            isLegacy: true,
            isAutomatosX: false,
            transportType: 'stdio',
            issues: ['Legacy format']
          }
        },
        {
          serverName: 's3',
          detection: {
            isValid: true,
            isLegacy: false,
            isAutomatosX: true,
            transportType: 'sse',
            issues: []
          }
        }
      ];

      const summary = getDetectionSummary(results);

      expect(summary.total).toBe(3);
      expect(summary.valid).toBe(2);
      expect(summary.legacy).toBe(1);
      expect(summary.automatosX).toBe(1);
      expect(summary.needsMigration).toBe(1);
    });

    it('should handle empty results', () => {
      const summary = getDetectionSummary([]);

      expect(summary.total).toBe(0);
      expect(summary.valid).toBe(0);
      expect(summary.legacy).toBe(0);
      expect(summary.automatosX).toBe(0);
      expect(summary.needsMigration).toBe(0);
    });

    it('should count all legacy configs as needing migration', () => {
      const results = [
        {
          serverName: 's1',
          detection: {
            isValid: false,
            isLegacy: true,
            isAutomatosX: false,
            transportType: 'stdio',
            issues: []
          }
        },
        {
          serverName: 's2',
          detection: {
            isValid: false,
            isLegacy: true,
            isAutomatosX: false,
            transportType: 'stdio',
            issues: []
          }
        }
      ];

      const summary = getDetectionSummary(results);

      expect(summary.legacy).toBe(2);
      expect(summary.needsMigration).toBe(2);
    });
  });
});
