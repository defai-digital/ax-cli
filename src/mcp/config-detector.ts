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
  originalConfig: unknown;
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
export function isLegacyStdioFormat(config: unknown): boolean {
  if (!config || typeof config !== 'object') {
    return false;
  }
  const configObj = config as Record<string, unknown>;

  // BUG FIX: Legacy format only requires command and no transport
  // Previously required args array, but that contradicts the migration logic
  // which treats missing args as optional with empty array default
  const hasCommand = typeof configObj.command === 'string' && configObj.command.length > 0;
  const hasTransport = configObj.transport !== undefined;

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
export function isAutomatosXConfig(config: unknown): boolean {
  if (!config || typeof config !== 'object') {
    return false;
  }
  const configObj = config as Record<string, unknown>;

  // Check for AutomatosX-specific markers
  const hasAutomatosXMetadata = !!(
    configObj._automatosX ||
    configObj.automatosxVersion ||
    configObj.source === 'automatosx'
  );

  // AutomatosX configs often have env field at root level (even in modern format)
  const hasRootEnv = !!(configObj.env && typeof configObj.env === 'object');

  return hasAutomatosXMetadata || hasRootEnv;
}

/**
 * Comprehensive config detection
 */
export function detectConfigFormat(config: unknown): ConfigDetectionResult {
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
  const configObj = config as Record<string, any>;

  // Check for required name field
  if (!configObj.name || typeof configObj.name !== 'string') {
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
    if (!configObj.command) {
      issues.push('Legacy format requires "command" field');
    }

    // BUG FIX: Don't warn about missing args since we handle it correctly
    // Legacy configs legitimately omit args when running simple commands
    // The migration code will use an empty array as default
  } else if (!configObj.transport) {
    // No transport and not legacy - invalid
    issues.push('Missing transport configuration');
  } else {
    // Has transport - detect type
    transportType = configObj.transport.type;

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
export function validateTransportConfig(transport: unknown): {
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
  const transportObj = transport as Record<string, any>;

  // Check transport type
  const validTypes = ['stdio', 'http', 'sse', 'streamable_http'];
  if (!transportObj.type || !validTypes.includes(transportObj.type)) {
    errors.push(`Transport type must be one of: ${validTypes.join(', ')}`);
    return { isValid: false, errors, warnings };
  }

  // Type-specific validation
  switch (transportObj.type) {
    case 'stdio':
      if (!transportObj.command) {
        errors.push('stdio transport requires command');
      }
      if (!transportObj.args || !Array.isArray(transportObj.args)) {
        warnings.push('stdio transport should have "args" array');
      }
      break;

    case 'http':
    case 'sse':
      if (!transportObj.url) {
        errors.push(`${transportObj.type} transport requires url`);
      } else {
        try {
          new URL(transportObj.url);
        } catch {
          errors.push(`Invalid URL format: ${transportObj.url}`);
        }
      }
      break;

    case 'streamable_http':
      warnings.push('streamable_http transport is experimental and may not work with all MCP servers');
      if (!transportObj.url) {
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
  configs: Record<string, unknown> | null | undefined
): Array<{ serverName: string; detection: ConfigDetectionResult }> {
  if (!configs || typeof configs !== 'object') {
    return [];
  }

  const results: Array<{ serverName: string; detection: ConfigDetectionResult }> = [];

  for (const [name, config] of Object.entries(configs)) {
    // Ensure config has name field
    const configAsObject = config as Record<string, any>;
    const configWithName = { ...configAsObject, name: configAsObject.name || name };
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
