/**
 * MCP Configuration Format Detector
 *
 * Detects and validates MCP server configurations, including legacy formats
 * from AutomatosX and older ax-cli versions.
 */

import { MCPServerConfigSchema } from '../schemas/settings-schemas.js';

export interface ConfigDetectionResult {
  /** Whether config is in valid format */
  isValid: boolean;
  /** Whether config is in legacy format */
  isLegacy: boolean;
  /** Whether config is from AutomatosX */
  isAutomatosX: boolean;
  /** Format version detected */
  formatVersion: 'legacy-stdio' | 'v3.6+' | 'unknown';
  /** Transport type detected (stdio, http, sse, etc.) */
  transportType?: string;
  /** Specific issues found */
  issues: string[];
  /** Warnings (non-breaking) */
  warnings: string[];
  /** Original config (for migration) */
  originalConfig: any;
}

/**
 * Detect if a config is in legacy stdio-only format
 *
 * Legacy format:
 * {
 *   "name": "server",
 *   "command": "npx",
 *   "args": ["..."],  // Optional - will default to empty array
 *   "env": { ... }    // Optional
 * }
 *
 * Modern format:
 * {
 *   "name": "server",
 *   "transport": {
 *     "type": "stdio",
 *     "command": "npx",
 *     "args": ["..."],
 *     "env": { ... }
 *   }
 * }
 */
export function isLegacyStdioFormat(config: any): boolean {
  if (!config || typeof config !== 'object') {
    return false;
  }

  // BUG FIX: Legacy format only requires command and no transport
  // Previously required args array, but that contradicts the migration logic
  // which treats missing args as optional with empty array default
  const hasCommand = typeof config.command === 'string' && config.command.length > 0;
  const hasTransport = config.transport !== undefined;

  // Legacy format: has command at root level and no transport wrapper
  return hasCommand && !hasTransport;
}

/**
 * Detect if config is from AutomatosX
 *
 * AutomatosX configs typically:
 * - Have env field (even if modern format)
 * - Use legacy format (pre-v8.0)
 * - Have specific naming patterns
 * - May include AutomatosX-specific metadata
 */
export function isAutomatosXConfig(config: any): boolean {
  if (!config || typeof config !== 'object') {
    return false;
  }

  // Check for AutomatosX-specific markers
  const hasAutomatosXMetadata = !!(
    config._automatosX ||
    config.automatosxVersion ||
    config.source === 'automatosx'
  );

  // AutomatosX configs often have env field at root level (even in modern format)
  const hasRootEnv = !!(config.env && typeof config.env === 'object');

  return hasAutomatosXMetadata || hasRootEnv;
}

/**
 * Comprehensive config detection
 */
export function detectConfigFormat(config: any): ConfigDetectionResult {
  const issues: string[] = [];
  const warnings: string[] = [];
  let formatVersion: ConfigDetectionResult['formatVersion'] = 'unknown';
  let transportType: string | undefined;

  // Validate basic structure
  if (!config || typeof config !== 'object') {
    issues.push('Config must be an object');
    return {
      isValid: false,
      isLegacy: false,
      isAutomatosX: false,
      formatVersion: 'unknown',
      transportType: undefined,
      issues,
      warnings,
      originalConfig: config
    };
  }

  // Check for required name field
  if (!config.name || typeof config.name !== 'string') {
    issues.push('Server name is required');
  }

  // Detect format version
  const isLegacy = isLegacyStdioFormat(config);
  const isAutomatosX = isAutomatosXConfig(config);

  if (isLegacy) {
    formatVersion = 'legacy-stdio';
    transportType = 'stdio';  // Legacy format is always stdio
    issues.push('Legacy stdio format (missing transport wrapper)');

    // Validate legacy format requirements
    if (!config.command) {
      issues.push('Legacy format requires "command" field');
    }

    // Legacy configs don't require args - but we do need command for valid legacy
    if (!config.args || !Array.isArray(config.args)) {
      warnings.push('Missing "args" array. Will use empty array.');
    }
  } else if (!config.transport) {
    // No transport and not legacy - invalid
    issues.push('Missing transport configuration');
  } else {
    // Has transport - detect type
    transportType = config.transport.type;

    // Try to validate as modern format
    const validationResult = MCPServerConfigSchema.safeParse(config);

    if (validationResult.success) {
      formatVersion = 'v3.6+';
    } else {
      // Not legacy, not valid modern format
      issues.push('Invalid modern format. Malformed "transport" configuration.');

      // Extract specific validation errors
      if (validationResult.error) {
        validationResult.error.issues.forEach(issue => {
          const field = issue.path.join('.');
          issues.push(`Field "${field}": ${issue.message}`);
        });
      }
    }
  }

  // Check for AutomatosX-specific issues
  if (isAutomatosX && !isLegacy) {
    warnings.push('AutomatosX config detected but using modern format. This is correct.');
  }

  return {
    isValid: issues.length === 0,
    isLegacy,
    isAutomatosX,
    formatVersion,
    transportType,
    issues,
    warnings,
    originalConfig: config
  };
}

/**
 * Validate a transport configuration
 */
export function validateTransportConfig(transport: any): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!transport || typeof transport !== 'object') {
    errors.push('Transport configuration is required');
    return { isValid: false, errors, warnings };
  }

  // Check transport type
  const validTypes = ['stdio', 'http', 'sse', 'streamable_http'];
  if (!transport.type || !validTypes.includes(transport.type)) {
    errors.push(`Transport type must be one of: ${validTypes.join(', ')}`);
    return { isValid: false, errors, warnings };
  }

  // Type-specific validation
  switch (transport.type) {
    case 'stdio':
      if (!transport.command) {
        errors.push('stdio transport requires command');
      }
      if (!transport.args || !Array.isArray(transport.args)) {
        warnings.push('stdio transport should have "args" array');
      }
      break;

    case 'http':
    case 'sse':
      if (!transport.url) {
        errors.push(`${transport.type} transport requires url`);
      } else {
        try {
          new URL(transport.url);
        } catch {
          errors.push(`Invalid URL format: ${transport.url}`);
        }
      }
      break;

    case 'streamable_http':
      warnings.push('streamable_http transport is experimental and may not work with all MCP servers');
      if (!transport.url) {
        errors.push('streamable_http transport requires url');
      }
      break;
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Batch detect multiple configs
 */
export function detectMultipleConfigs(
  configs: Record<string, any> | null | undefined
): Array<{ serverName: string; detection: ConfigDetectionResult }> {
  if (!configs || typeof configs !== 'object') {
    return [];
  }

  const results: Array<{ serverName: string; detection: ConfigDetectionResult }> = [];

  for (const [name, config] of Object.entries(configs)) {
    // Ensure config has name field
    const configWithName = { ...config, name: config.name || name };
    const result = detectConfigFormat(configWithName);
    results.push({ serverName: name, detection: result });
  }

  return results;
}

/**
 * Get summary statistics for batch detection
 */
export function getDetectionSummary(
  results: Array<{ serverName: string; detection: ConfigDetectionResult }>
): {
  total: number;
  valid: number;
  legacy: number;
  automatosX: number;
  needsMigration: number;
  hasIssues: number;
} {
  let valid = 0;
  let legacy = 0;
  let automatosX = 0;
  let needsMigration = 0;
  let hasIssues = 0;

  for (const { detection } of results) {
    if (detection.isValid) valid++;
    if (detection.isLegacy) {
      legacy++;
      // Legacy configs always need migration, even if they have issues
      needsMigration++;
    }
    if (detection.isAutomatosX) automatosX++;
    if (detection.issues && detection.issues.length > 0) hasIssues++;
  }

  return {
    total: results.length,
    valid,
    legacy,
    automatosX,
    needsMigration,
    hasIssues
  };
}
