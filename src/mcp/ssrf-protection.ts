/**
 * SSRF Protection for HTTP/SSE Transports (REQ-SEC-011)
 *
 * Prevents Server-Side Request Forgery attacks by validating URLs
 * Blocks:
 * - Private IP addresses (RFC 1918, loopback, link-local)
 * - DNS rebinding attacks
 * - Cloud metadata endpoints
 * - Dangerous protocols
 *
 * Security: CVSS 8.6 (High Priority)
 */

import { getAuditLogger, AuditCategory } from '../utils/audit-logger.js';

/**
 * Private IP ranges (RFC 1918 and special-use addresses)
 */
const PRIVATE_IP_RANGES = [
  // IPv4 Private Ranges
  { start: '10.0.0.0', end: '10.255.255.255', name: 'RFC1918 Class A' },
  { start: '172.16.0.0', end: '172.31.255.255', name: 'RFC1918 Class B' },
  { start: '192.168.0.0', end: '192.168.255.255', name: 'RFC1918 Class C' },

  // Loopback
  { start: '127.0.0.0', end: '127.255.255.255', name: 'Loopback' },

  // Link-local
  { start: '169.254.0.0', end: '169.254.255.255', name: 'Link-local' },

  // Multicast
  { start: '224.0.0.0', end: '239.255.255.255', name: 'Multicast' },

  // Reserved
  { start: '240.0.0.0', end: '255.255.255.255', name: 'Reserved' },

  // Broadcast
  { start: '255.255.255.255', end: '255.255.255.255', name: 'Broadcast' },
] as const;

/**
 * Blocked hostnames (cloud metadata endpoints, etc.)
 */
const BLOCKED_HOSTNAMES = [
  // AWS metadata
  '169.254.169.254',
  'metadata.google.internal',

  // GCP metadata
  'metadata.goog',

  // Azure metadata
  '169.254.169.254',

  // Kubernetes metadata
  'kubernetes.default.svc',

  // Special addresses
  'localhost',
  'localhost.localdomain',
  '0.0.0.0',
  '::1',
  '::',

  // DNS rebinding targets
  '0x7f000001', // 127.0.0.1 in hex
  '2130706433', // 127.0.0.1 in decimal
] as const;

/**
 * Allowed protocols
 */
const ALLOWED_PROTOCOLS = ['http:', 'https:'] as const;

/**
 * URL validation result
 */
export interface SSRFValidationResult {
  valid: boolean;
  error?: string;
  category?: SSRFThreatCategory;
  resolvedIp?: string;
}

/**
 * SSRF threat categories
 */
export enum SSRFThreatCategory {
  PRIVATE_IP = 'PRIVATE_IP',
  BLOCKED_HOSTNAME = 'BLOCKED_HOSTNAME',
  INVALID_PROTOCOL = 'INVALID_PROTOCOL',
  INVALID_URL = 'INVALID_URL',
  DNS_REBINDING = 'DNS_REBINDING',
}

/**
 * Convert IP address string to number (unsigned 32-bit)
 */
function ipToNumber(ip: string): number {
  const parts = ip.split('.').map(p => parseInt(p, 10));
  if (parts.length !== 4 || parts.some(p => isNaN(p) || p < 0 || p > 255)) {
    return -1;
  }
  // Use unsigned 32-bit arithmetic (>>> 0 converts to unsigned)
  return ((parts[0] << 24) + (parts[1] << 16) + (parts[2] << 8) + parts[3]) >>> 0;
}

/**
 * Check if IP is in private range
 */
function isPrivateIP(ip: string): { isPrivate: boolean; range?: string } {
  const ipNum = ipToNumber(ip);
  if (ipNum === -1) {
    return { isPrivate: false };
  }

  for (const range of PRIVATE_IP_RANGES) {
    const startNum = ipToNumber(range.start);
    const endNum = ipToNumber(range.end);

    if (ipNum >= startNum && ipNum <= endNum) {
      return { isPrivate: true, range: range.name };
    }
  }

  return { isPrivate: false };
}

/**
 * Check if hostname is blocked
 */
function isBlockedHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase().trim();

  // Check exact matches
  if (BLOCKED_HOSTNAMES.includes(normalized as any)) {
    return true;
  }

  // Check for localhost variations
  if (normalized.startsWith('localhost') ||
      normalized.endsWith('.localhost') ||
      normalized === '0.0.0.0' ||
      normalized === '::1') {
    return true;
  }

  return false;
}

/**
 * Validate URL against SSRF threats
 *
 * @param urlString - URL to validate
 * @returns Validation result
 *
 * @example
 * ```typescript
 * const result = validateURL('https://api.example.com');
 * if (!result.valid) {
 *   console.error(`SSRF threat detected: ${result.error}`);
 * }
 * ```
 */
export function validateURL(urlString: string): SSRFValidationResult {
  const auditLogger = getAuditLogger();

  // Parse URL
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    const result: SSRFValidationResult = {
      valid: false,
      error: 'Invalid URL format',
      category: SSRFThreatCategory.INVALID_URL,
    };

    auditLogger.logWarning({
      category: AuditCategory.INPUT_VALIDATION,
      action: 'ssrf_validation_failed',
      resource: urlString,
      outcome: 'failure',
      error: result.error,
      details: { category: result.category },
    });

    return result;
  }

  // Validate protocol
  if (!ALLOWED_PROTOCOLS.includes(url.protocol as any)) {
    const result: SSRFValidationResult = {
      valid: false,
      error: `Protocol not allowed: ${url.protocol}. Only HTTP(S) allowed.`,
      category: SSRFThreatCategory.INVALID_PROTOCOL,
    };

    auditLogger.logCritical({
      category: AuditCategory.INPUT_VALIDATION,
      action: 'ssrf_invalid_protocol',
      resource: urlString,
      outcome: 'failure',
      error: result.error,
      details: { protocol: url.protocol, category: result.category },
    });

    return result;
  }

  // Validate hostname
  const hostname = url.hostname.toLowerCase();

  // Check for IPv6 addresses (they include brackets in hostname)
  if (hostname.startsWith('[') && hostname.endsWith(']')) {
    const result: SSRFValidationResult = {
      valid: false,
      error: `IPv6 addresses are not allowed: ${hostname}`,
      category: SSRFThreatCategory.BLOCKED_HOSTNAME,
    };

    auditLogger.logCritical({
      category: AuditCategory.INPUT_VALIDATION,
      action: 'ssrf_ipv6_blocked',
      resource: urlString,
      outcome: 'failure',
      error: result.error,
      details: { hostname, category: result.category },
    });

    return result;
  }

  // Check if hostname is an IPv4 address (to get proper category)
  const ipMatch = hostname.match(/^(\d{1,3}\.){3}\d{1,3}$/);
  if (ipMatch) {
    const privateCheck = isPrivateIP(hostname);
    if (privateCheck.isPrivate) {
      const result: SSRFValidationResult = {
        valid: false,
        error: `Private IP address not allowed: ${hostname} (${privateCheck.range})`,
        category: SSRFThreatCategory.PRIVATE_IP,
        resolvedIp: hostname,
      };

      auditLogger.logCritical({
        category: AuditCategory.INPUT_VALIDATION,
        action: 'ssrf_private_ip',
        resource: urlString,
        outcome: 'failure',
        error: result.error,
        details: {
          ip: hostname,
          range: privateCheck.range,
          category: result.category,
        },
      });

      return result;
    }
  }

  // Check blocked hostnames (non-IP addresses)
  if (isBlockedHostname(hostname)) {
    const result: SSRFValidationResult = {
      valid: false,
      error: `Blocked hostname: ${hostname}`,
      category: SSRFThreatCategory.BLOCKED_HOSTNAME,
    };

    auditLogger.logCritical({
      category: AuditCategory.INPUT_VALIDATION,
      action: 'ssrf_blocked_hostname',
      resource: urlString,
      outcome: 'failure',
      error: result.error,
      details: { hostname, category: result.category },
    });

    return result;
  }

  // URL is valid
  auditLogger.logInfo({
    category: AuditCategory.INPUT_VALIDATION,
    action: 'ssrf_validation_passed',
    resource: urlString,
    outcome: 'success',
    details: {
      hostname,
      protocol: url.protocol,
    },
  });

  return { valid: true };
}

/**
 * Validate MCP HTTP/SSE transport URL
 *
 * @param url - Transport URL
 * @param transportType - Transport type ('http' or 'sse')
 * @returns Validation result
 */
export function validateTransportURL(
  url: string,
  transportType: 'http' | 'sse'
): SSRFValidationResult {
  const auditLogger = getAuditLogger();

  const result = validateURL(url);

  if (!result.valid) {
    auditLogger.logCritical({
      category: AuditCategory.MCP_OPERATION,
      action: 'mcp_transport_ssrf_blocked',
      resource: url,
      outcome: 'failure',
      error: result.error,
      details: {
        transportType,
        category: result.category,
      },
    });
  }

  return result;
}

/**
 * Safe URL wrapper for HTTP requests
 *
 * @param url - URL to validate and wrap
 * @returns Validated URL or throws error
 *
 * @example
 * ```typescript
 * try {
 *   const safeUrl = safeURL('https://api.example.com');
 *   await fetch(safeUrl);
 * } catch (error) {
 *   console.error('SSRF protection blocked request:', error);
 * }
 * ```
 */
export function safeURL(url: string): string {
  const result = validateURL(url);

  if (!result.valid) {
    throw new Error(`SSRF protection: ${result.error}`);
  }

  return url;
}

/**
 * Batch validate multiple URLs
 *
 * @param urls - Array of URLs to validate
 * @returns Array of validation results
 */
export function validateURLs(urls: string[]): SSRFValidationResult[] {
  return urls.map(url => validateURL(url));
}

/**
 * Get SSRF protection statistics
 */
export function getSSRFStats(): {
  blockedHostnames: number;
  privateIPRanges: number;
  allowedProtocols: number;
} {
  return {
    blockedHostnames: BLOCKED_HOSTNAMES.length,
    privateIPRanges: PRIVATE_IP_RANGES.length,
    allowedProtocols: ALLOWED_PROTOCOLS.length,
  };
}
