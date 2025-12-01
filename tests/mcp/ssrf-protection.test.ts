/**
 * Tests for SSRF Protection (REQ-SEC-011)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  validateURL,
  validateTransportURL,
  safeURL,
  validateURLs,
  getSSRFStats,
  SSRFThreatCategory,
} from '../../src/mcp/ssrf-protection.js';
import { AuditLogger } from '../../src/utils/audit-logger.js';

describe('SSRF Protection (REQ-SEC-011)', () => {
  beforeEach(() => {
    AuditLogger.resetInstance();
  });

  afterEach(() => {
    AuditLogger.resetInstance();
  });

  describe('validateURL', () => {
    describe('Valid URLs', () => {
      it('should allow valid HTTPS URLs', () => {
        const result = validateURL('https://api.example.com/endpoint');
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      });

      it('should allow valid HTTP URLs', () => {
        const result = validateURL('http://api.example.com/endpoint');
        expect(result.valid).toBe(true);
      });

      it('should allow public IP addresses', () => {
        const result = validateURL('http://8.8.8.8/api');
        expect(result.valid).toBe(true);
      });

      it('should allow URLs with ports', () => {
        const result = validateURL('https://api.example.com:8080/endpoint');
        expect(result.valid).toBe(true);
      });

      it('should allow URLs with query parameters', () => {
        const result = validateURL('https://api.example.com/endpoint?param=value');
        expect(result.valid).toBe(true);
      });
    });

    describe('Invalid URLs', () => {
      it('should reject invalid URL format', () => {
        const result = validateURL('not-a-url');

        expect(result.valid).toBe(false);
        expect(result.error).toContain('Invalid URL format');
        expect(result.category).toBe(SSRFThreatCategory.INVALID_URL);
      });

      it('should reject empty URL', () => {
        const result = validateURL('');

        expect(result.valid).toBe(false);
        expect(result.category).toBe(SSRFThreatCategory.INVALID_URL);
      });
    });

    describe('Protocol Validation', () => {
      it('should reject file:// protocol', () => {
        const result = validateURL('file:///etc/passwd');

        expect(result.valid).toBe(false);
        expect(result.error).toContain('Protocol not allowed');
        expect(result.category).toBe(SSRFThreatCategory.INVALID_PROTOCOL);
      });

      it('should reject ftp:// protocol', () => {
        const result = validateURL('ftp://example.com/file');

        expect(result.valid).toBe(false);
        expect(result.category).toBe(SSRFThreatCategory.INVALID_PROTOCOL);
      });

      it('should reject gopher:// protocol', () => {
        const result = validateURL('gopher://example.com');

        expect(result.valid).toBe(false);
        expect(result.category).toBe(SSRFThreatCategory.INVALID_PROTOCOL);
      });

      it('should reject data:// protocol', () => {
        const result = validateURL('data:text/html,<script>alert(1)</script>');

        expect(result.valid).toBe(false);
        expect(result.category).toBe(SSRFThreatCategory.INVALID_PROTOCOL);
      });
    });

    describe('Private IP Protection (RFC 1918)', () => {
      it('should reject 10.x.x.x (Class A)', () => {
        const result = validateURL('http://10.0.0.1/api');

        expect(result.valid).toBe(false);
        expect(result.error).toContain('Private IP address');
        expect(result.error).toContain('RFC1918 Class A');
        expect(result.category).toBe(SSRFThreatCategory.PRIVATE_IP);
        expect(result.resolvedIp).toBe('10.0.0.1');
      });

      it('should reject 172.16-31.x.x (Class B)', () => {
        const result = validateURL('http://172.16.0.1/api');

        expect(result.valid).toBe(false);
        expect(result.error).toContain('RFC1918 Class B');
      });

      it('should reject 192.168.x.x (Class C)', () => {
        const result = validateURL('http://192.168.1.1/api');

        expect(result.valid).toBe(false);
        expect(result.error).toContain('RFC1918 Class C');
      });

      it('should reject edge of 10.x range', () => {
        const result = validateURL('http://10.255.255.255/api');
        expect(result.valid).toBe(false);
      });

      it('should reject edge of 172.16-31 range', () => {
        const result = validateURL('http://172.31.255.255/api');
        expect(result.valid).toBe(false);
      });

      it('should reject edge of 192.168 range', () => {
        const result = validateURL('http://192.168.255.255/api');
        expect(result.valid).toBe(false);
      });
    });

    describe('Loopback Protection', () => {
      it('should reject 127.0.0.1', () => {
        const result = validateURL('http://127.0.0.1/api');

        expect(result.valid).toBe(false);
        expect(result.error).toContain('Loopback');
      });

      it('should reject 127.x.x.x range', () => {
        const result = validateURL('http://127.255.255.255/api');

        expect(result.valid).toBe(false);
        expect(result.error).toContain('Loopback');
      });
    });

    describe('Link-Local Protection', () => {
      it('should reject 169.254.x.x (link-local)', () => {
        const result = validateURL('http://169.254.1.1/api');

        expect(result.valid).toBe(false);
        expect(result.error).toContain('Link-local');
      });

      it('should reject AWS metadata endpoint', () => {
        const result = validateURL('http://169.254.169.254/latest/meta-data');

        expect(result.valid).toBe(false);
        expect(result.error).toContain('Private IP');
      });
    });

    describe('Multicast and Reserved Protection', () => {
      it('should reject multicast addresses (224-239)', () => {
        const result = validateURL('http://224.0.0.1/api');

        expect(result.valid).toBe(false);
        expect(result.error).toContain('Multicast');
      });

      it('should reject reserved addresses (240-255)', () => {
        const result = validateURL('http://240.0.0.1/api');

        expect(result.valid).toBe(false);
        expect(result.error).toContain('Reserved');
      });

      it('should reject broadcast address', () => {
        const result = validateURL('http://255.255.255.255/api');

        expect(result.valid).toBe(false);
        // Broadcast address is in the "Broadcast" range which is part of "Reserved"
        expect(result.error).toMatch(/Broadcast|Reserved/);
      });
    });

    describe('Blocked Hostnames', () => {
      it('should reject localhost', () => {
        const result = validateURL('http://localhost/api');

        expect(result.valid).toBe(false);
        expect(result.error).toContain('Blocked hostname');
        expect(result.category).toBe(SSRFThreatCategory.BLOCKED_HOSTNAME);
      });

      it('should reject localhost variations', () => {
        const variations = [
          'http://localhost.localdomain/api',
          'http://LOCALHOST/api',
          'http://LocalHost/api',
        ];

        for (const url of variations) {
          const result = validateURL(url);
          expect(result.valid).toBe(false);
          expect(result.category).toBe(SSRFThreatCategory.BLOCKED_HOSTNAME);
        }
      });

      it('should reject 0.0.0.0', () => {
        const result = validateURL('http://0.0.0.0/api');

        expect(result.valid).toBe(false);
        expect(result.category).toBe(SSRFThreatCategory.BLOCKED_HOSTNAME);
      });

      it('should reject cloud metadata endpoints', () => {
        const endpoints = [
          'http://metadata.google.internal/computeMetadata/v1/',
          'http://metadata.goog/computeMetadata/v1/',
        ];

        for (const url of endpoints) {
          const result = validateURL(url);
          expect(result.valid).toBe(false);
          expect(result.category).toBe(SSRFThreatCategory.BLOCKED_HOSTNAME);
        }
      });

      it('should reject Kubernetes metadata', () => {
        const result = validateURL('http://kubernetes.default.svc/api');

        expect(result.valid).toBe(false);
        expect(result.category).toBe(SSRFThreatCategory.BLOCKED_HOSTNAME);
      });
    });

    describe('DNS Rebinding Protection', () => {
      it('should reject hex-encoded 127.0.0.1', () => {
        const result = validateURL('http://0x7f000001/api');

        expect(result.valid).toBe(false);
        // URL parser normalizes to 127.0.0.1, caught as PRIVATE_IP
        expect(result.category).toBe(SSRFThreatCategory.PRIVATE_IP);
      });

      it('should reject decimal-encoded 127.0.0.1', () => {
        const result = validateURL('http://2130706433/api');

        expect(result.valid).toBe(false);
        // URL parser normalizes to 127.0.0.1, caught as PRIVATE_IP
        expect(result.category).toBe(SSRFThreatCategory.PRIVATE_IP);
      });
    });

    describe('IPv6 Protection', () => {
      it('should reject ::1 (IPv6 loopback)', () => {
        const result = validateURL('http://[::1]/api');

        expect(result.valid).toBe(false);
        expect(result.category).toBe(SSRFThreatCategory.BLOCKED_HOSTNAME);
      });

      it('should reject ::', () => {
        const result = validateURL('http://[::]/api');

        expect(result.valid).toBe(false);
        expect(result.category).toBe(SSRFThreatCategory.BLOCKED_HOSTNAME);
      });
    });
  });

  describe('validateTransportURL', () => {
    it('should validate HTTP transport URLs', () => {
      const result = validateTransportURL('https://api.example.com', 'http');
      expect(result.valid).toBe(true);
    });

    it('should validate SSE transport URLs', () => {
      const result = validateTransportURL('https://sse.example.com/events', 'sse');
      expect(result.valid).toBe(true);
    });

    it('should reject private IPs for HTTP transport', () => {
      const result = validateTransportURL('http://192.168.1.1', 'http');

      expect(result.valid).toBe(false);
      expect(result.category).toBe(SSRFThreatCategory.PRIVATE_IP);
    });

    it('should reject private IPs for SSE transport', () => {
      const result = validateTransportURL('http://10.0.0.1', 'sse');

      expect(result.valid).toBe(false);
      expect(result.category).toBe(SSRFThreatCategory.PRIVATE_IP);
    });
  });

  describe('safeURL', () => {
    it('should return valid URL unchanged', () => {
      const url = 'https://api.example.com/endpoint';
      const result = safeURL(url);

      expect(result).toBe(url);
    });

    it('should throw error for invalid URL', () => {
      expect(() => {
        safeURL('http://127.0.0.1/api');
      }).toThrow('SSRF protection');
    });

    it('should throw error with category info', () => {
      expect(() => {
        safeURL('http://localhost/api');
      }).toThrow('Blocked hostname');
    });
  });

  describe('validateURLs', () => {
    it('should validate multiple URLs', () => {
      const urls = [
        'https://api.example.com',
        'http://127.0.0.1/api',
        'https://another.example.com',
        'http://192.168.1.1',
      ];

      const results = validateURLs(urls);

      expect(results).toHaveLength(4);
      expect(results[0].valid).toBe(true);
      expect(results[1].valid).toBe(false);
      expect(results[2].valid).toBe(true);
      expect(results[3].valid).toBe(false);
    });

    it('should handle empty array', () => {
      const results = validateURLs([]);
      expect(results).toHaveLength(0);
    });
  });

  describe('getSSRFStats', () => {
    it('should return protection statistics', () => {
      const stats = getSSRFStats();

      expect(stats).toHaveProperty('blockedHostnames');
      expect(stats).toHaveProperty('privateIPRanges');
      expect(stats).toHaveProperty('allowedProtocols');

      expect(stats.blockedHostnames).toBeGreaterThan(0);
      expect(stats.privateIPRanges).toBeGreaterThan(0);
      expect(stats.allowedProtocols).toBe(2); // http and https
    });
  });

  describe('Audit Logging Integration', () => {
    it('should log critical event for SSRF attempt', async () => {
      const logger = AuditLogger.getInstance({
        logDirectory: '/tmp/ax-cli-test-ssrf',
      });

      const logSpy = vi.spyOn(logger, 'logCritical');

      validateURL('http://127.0.0.1/api');

      expect(logSpy).toHaveBeenCalledWith({
        category: expect.any(String),
        action: expect.stringMatching(/ssrf/),
        resource: 'http://127.0.0.1/api',
        outcome: 'failure',
        error: expect.any(String),
        details: expect.any(Object),
      });

      logSpy.mockRestore();
    });

    it('should log info event for valid URLs', async () => {
      const logger = AuditLogger.getInstance({
        logDirectory: '/tmp/ax-cli-test-ssrf',
      });

      const logSpy = vi.spyOn(logger, 'logInfo');

      validateURL('https://api.example.com');

      expect(logSpy).toHaveBeenCalledWith({
        category: expect.any(String),
        action: 'ssrf_validation_passed',
        resource: 'https://api.example.com',
        outcome: 'success',
        details: expect.any(Object),
      });

      logSpy.mockRestore();
    });

    it('should log transport-specific SSRF attempts', async () => {
      const logger = AuditLogger.getInstance({
        logDirectory: '/tmp/ax-cli-test-ssrf',
      });

      const logSpy = vi.spyOn(logger, 'logCritical');

      validateTransportURL('http://localhost/api', 'http');

      expect(logSpy).toHaveBeenCalledWith({
        category: expect.any(String),
        action: 'mcp_transport_ssrf_blocked',
        resource: 'http://localhost/api',
        outcome: 'failure',
        error: expect.any(String),
        details: expect.objectContaining({
          transportType: 'http',
        }),
      });

      logSpy.mockRestore();
    });
  });

  describe('Edge Cases', () => {
    it('should handle URLs with non-standard ports', () => {
      const result = validateURL('http://127.0.0.1:8080/api');
      expect(result.valid).toBe(false);
    });

    it('should handle URLs with authentication', () => {
      const result = validateURL('http://user:pass@127.0.0.1/api');
      expect(result.valid).toBe(false);
    });

    it('should handle URLs with fragments', () => {
      const result = validateURL('http://127.0.0.1/api#section');
      expect(result.valid).toBe(false);
    });

    it('should be case-insensitive for hostnames', () => {
      const result = validateURL('http://LOCALHOST/api');
      expect(result.valid).toBe(false);
    });

    it('should handle trailing slashes', () => {
      const result1 = validateURL('https://api.example.com/');
      const result2 = validateURL('https://api.example.com');

      expect(result1.valid).toBe(true);
      expect(result2.valid).toBe(true);
    });
  });
});
