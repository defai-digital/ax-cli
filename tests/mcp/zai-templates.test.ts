/**
 * Tests for mcp/zai-templates module
 * Tests Z.AI MCP server configuration generation
 */
import { describe, it, expect } from 'vitest';
import {
  ZAI_SERVER_NAMES,
  ZAI_ENDPOINTS,
  ZAI_VISION_PACKAGE,
  ZAI_MCP_TEMPLATES,
  ZAI_QUOTA_LIMITS,
  generateZAIServerConfig,
  getAllZAIServerNames,
  isZAIServer,
  getZAITemplate,
} from '../../packages/core/src/mcp/zai-templates.js';

describe('ZAI_SERVER_NAMES', () => {
  it('should have all expected server names', () => {
    expect(ZAI_SERVER_NAMES.WEB_READER).toBe('zai-web-reader');
    expect(ZAI_SERVER_NAMES.WEB_SEARCH).toBe('zai-web-search');
    expect(ZAI_SERVER_NAMES.VISION).toBe('zai-vision');
  });
});

describe('ZAI_ENDPOINTS', () => {
  it('should have correct API endpoints', () => {
    expect(ZAI_ENDPOINTS.WEB_READER).toContain('api.z.ai');
    expect(ZAI_ENDPOINTS.WEB_SEARCH).toContain('api.z.ai');
  });
});

describe('ZAI_VISION_PACKAGE', () => {
  it('should have package info', () => {
    expect(ZAI_VISION_PACKAGE.name).toBe('@z_ai/mcp-server');
    expect(ZAI_VISION_PACKAGE.minNodeVersion).toBe('22.0.0');
  });
});

describe('ZAI_MCP_TEMPLATES', () => {
  it('should have template for web reader', () => {
    const template = ZAI_MCP_TEMPLATES[ZAI_SERVER_NAMES.WEB_READER];
    expect(template.name).toBe(ZAI_SERVER_NAMES.WEB_READER);
    expect(template.displayName).toBe('Z.AI Web Reader');
    expect(template.transport).toBe('http');
    expect(template.tools).toContain('webReader');
  });

  it('should have template for web search', () => {
    const template = ZAI_MCP_TEMPLATES[ZAI_SERVER_NAMES.WEB_SEARCH];
    expect(template.name).toBe(ZAI_SERVER_NAMES.WEB_SEARCH);
    expect(template.displayName).toBe('Z.AI Web Search');
    expect(template.transport).toBe('http');
    expect(template.tools).toContain('webSearchPrime');
  });

  it('should have template for vision with node requirements', () => {
    const template = ZAI_MCP_TEMPLATES[ZAI_SERVER_NAMES.VISION];
    expect(template.name).toBe(ZAI_SERVER_NAMES.VISION);
    expect(template.displayName).toBe('Z.AI Vision');
    expect(template.transport).toBe('stdio');
    expect(template.requirements?.nodeVersion).toBe(ZAI_VISION_PACKAGE.minNodeVersion);
  });
});

describe('ZAI_QUOTA_LIMITS', () => {
  it('should have quota limits for all plan tiers', () => {
    expect(ZAI_QUOTA_LIMITS.lite.webRequests).toBe(100);
    expect(ZAI_QUOTA_LIMITS.pro.webRequests).toBe(1000);
    expect(ZAI_QUOTA_LIMITS.max.webRequests).toBe(4000);
  });

  it('should have vision hours for all tiers', () => {
    expect(ZAI_QUOTA_LIMITS.lite.visionHours).toBe(5);
    expect(ZAI_QUOTA_LIMITS.pro.visionHours).toBe(5);
    expect(ZAI_QUOTA_LIMITS.max.visionHours).toBe(5);
  });
});

describe('generateZAIServerConfig', () => {
  const testApiKey = 'test-api-key-123';

  it('should generate web reader config with HTTP transport', () => {
    const config = generateZAIServerConfig(ZAI_SERVER_NAMES.WEB_READER, testApiKey);

    expect(config.name).toBe(ZAI_SERVER_NAMES.WEB_READER);
    expect(config.transport.type).toBe('http');
    if (config.transport.type === 'http') {
      expect(config.transport.url).toBe(ZAI_ENDPOINTS.WEB_READER);
      expect(config.transport.headers?.['Authorization']).toBe(`Bearer ${testApiKey}`);
      expect(config.transport.headers?.['Accept']).toContain('application/json');
      expect(config.transport.headers?.['Accept']).toContain('text/event-stream');
    }
  });

  it('should generate web search config with HTTP transport', () => {
    const config = generateZAIServerConfig(ZAI_SERVER_NAMES.WEB_SEARCH, testApiKey);

    expect(config.name).toBe(ZAI_SERVER_NAMES.WEB_SEARCH);
    expect(config.transport.type).toBe('http');
    if (config.transport.type === 'http') {
      expect(config.transport.url).toBe(ZAI_ENDPOINTS.WEB_SEARCH);
      expect(config.transport.headers?.['Authorization']).toBe(`Bearer ${testApiKey}`);
    }
  });

  it('should generate vision config with stdio transport', () => {
    const config = generateZAIServerConfig(ZAI_SERVER_NAMES.VISION, testApiKey);

    expect(config.name).toBe(ZAI_SERVER_NAMES.VISION);
    expect(config.transport.type).toBe('stdio');
    if (config.transport.type === 'stdio') {
      expect(config.transport.command).toBe('npx');
      expect(config.transport.args).toContain('-y');
      expect(config.transport.args).toContain(ZAI_VISION_PACKAGE.name);
      expect(config.transport.env?.['Z_AI_API_KEY']).toBe(testApiKey);
      expect(config.transport.env?.['Z_AI_MODE']).toBe('ZAI');
      expect(config.transport.framing).toBe('ndjson');
    }
    expect(config.initTimeout).toBe(120000);
    expect(config.quiet).toBe(true);
  });

  it('should throw for unknown server name', () => {
    expect(() => {
      // @ts-expect-error Testing invalid input
      generateZAIServerConfig('unknown-server', testApiKey);
    }).toThrow('Unknown Z.AI server');
  });
});

describe('getAllZAIServerNames', () => {
  it('should return all server names', () => {
    const names = getAllZAIServerNames();

    expect(names).toContain(ZAI_SERVER_NAMES.WEB_READER);
    expect(names).toContain(ZAI_SERVER_NAMES.WEB_SEARCH);
    expect(names).toContain(ZAI_SERVER_NAMES.VISION);
    expect(names).toHaveLength(3);
  });
});

describe('isZAIServer', () => {
  it('should return true for valid Z.AI server names', () => {
    expect(isZAIServer('zai-web-reader')).toBe(true);
    expect(isZAIServer('zai-web-search')).toBe(true);
    expect(isZAIServer('zai-vision')).toBe(true);
  });

  it('should return false for invalid server names', () => {
    expect(isZAIServer('other-server')).toBe(false);
    expect(isZAIServer('zai')).toBe(false);
    expect(isZAIServer('')).toBe(false);
  });
});

describe('getZAITemplate', () => {
  it('should return template for web reader', () => {
    const template = getZAITemplate(ZAI_SERVER_NAMES.WEB_READER);
    expect(template.name).toBe(ZAI_SERVER_NAMES.WEB_READER);
    expect(template.transport).toBe('http');
  });

  it('should return template for web search', () => {
    const template = getZAITemplate(ZAI_SERVER_NAMES.WEB_SEARCH);
    expect(template.name).toBe(ZAI_SERVER_NAMES.WEB_SEARCH);
    expect(template.quotaType).toBe('web');
  });

  it('should return template for vision', () => {
    const template = getZAITemplate(ZAI_SERVER_NAMES.VISION);
    expect(template.name).toBe(ZAI_SERVER_NAMES.VISION);
    expect(template.quotaType).toBe('vision');
  });
});
