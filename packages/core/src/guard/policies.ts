/**
 * Default Guard Policies
 *
 * Pre-configured security policies for common use cases.
 *
 * @packageDocumentation
 */

import type { GuardPolicy } from '@defai.digital/ax-schemas';

/**
 * Tool Execution Policy
 *
 * Default policy for general tool execution.
 * Checks for injection attempts and validates schema.
 */
export const TOOL_EXECUTION_POLICY: GuardPolicy = {
  id: 'tool-execution',
  name: 'Tool Execution',
  description: 'Default security checks for tool execution',
  gates: ['injection_attempt', 'schema_violation'],
  config: {},
  enabled: true,
};

/**
 * File Write Policy
 *
 * Policy for file write operations.
 * Checks path violations and credential exposure.
 */
export const FILE_WRITE_POLICY: GuardPolicy = {
  id: 'file-write',
  name: 'File Write',
  description: 'Security checks for file write operations',
  gates: ['path_violation', 'credential_exposure'],
  config: {
    path_violation: {
      blockedPaths: ['/etc', '/root', '/var', '/usr'],
      blockedPatterns: ['\\.env$', 'id_rsa', '\\.pem$', 'credentials\\.json$'],
      warnOutsideCwd: true,
    },
  },
  enabled: true,
};

/**
 * File Read Policy
 *
 * Policy for file read operations.
 * Less restrictive than write, but still checks path violations.
 */
export const FILE_READ_POLICY: GuardPolicy = {
  id: 'file-read',
  name: 'File Read',
  description: 'Security checks for file read operations',
  gates: ['path_violation'],
  config: {
    path_violation: {
      blockedPaths: ['/etc/shadow', '/etc/passwd'],
      warnOutsideCwd: true,
    },
  },
  enabled: true,
};

/**
 * Command Execution Policy
 *
 * Policy for command/shell execution.
 * Checks for injection attempts and path violations.
 */
export const COMMAND_EXECUTION_POLICY: GuardPolicy = {
  id: 'command-execution',
  name: 'Command Execution',
  description: 'Security checks for command execution',
  gates: ['injection_attempt', 'path_violation'],
  config: {},
  enabled: true,
};

/**
 * Output Screening Policy
 *
 * Policy for screening output before returning to user.
 * Checks for credential exposure.
 */
export const OUTPUT_SCREENING_POLICY: GuardPolicy = {
  id: 'output-screening',
  name: 'Output Screening',
  description: 'Screen output for sensitive information',
  gates: ['credential_exposure'],
  config: {},
  enabled: true,
};

/**
 * Input Validation Policy
 *
 * Policy for validating user input.
 * Checks for injection attempts and schema violations.
 */
export const INPUT_VALIDATION_POLICY: GuardPolicy = {
  id: 'input-validation',
  name: 'Input Validation',
  description: 'Validate user input for security',
  gates: ['injection_attempt', 'schema_violation'],
  config: {
    schema_violation: {
      strictMode: false,
      allowUnknownTools: true,
    },
  },
  enabled: true,
};

/**
 * Comprehensive Policy
 *
 * Full security check with all gates.
 * Use for high-security operations.
 */
export const COMPREHENSIVE_POLICY: GuardPolicy = {
  id: 'comprehensive',
  name: 'Comprehensive',
  description: 'All security gates enabled',
  gates: ['path_violation', 'credential_exposure', 'injection_attempt', 'schema_violation'],
  config: {
    path_violation: {
      warnOutsideCwd: true,
    },
    schema_violation: {
      strictMode: true,
      allowUnknownTools: false,
    },
  },
  enabled: true,
};

/**
 * Minimal Policy
 *
 * Minimal security checks.
 * Use only when performance is critical and security is handled elsewhere.
 */
export const MINIMAL_POLICY: GuardPolicy = {
  id: 'minimal',
  name: 'Minimal',
  description: 'Minimal security checks',
  gates: ['injection_attempt'],
  config: {},
  enabled: true,
};

/**
 * All default policies
 */
export const DEFAULT_POLICIES: GuardPolicy[] = [
  TOOL_EXECUTION_POLICY,
  FILE_WRITE_POLICY,
  FILE_READ_POLICY,
  COMMAND_EXECUTION_POLICY,
  OUTPUT_SCREENING_POLICY,
  INPUT_VALIDATION_POLICY,
  COMPREHENSIVE_POLICY,
  MINIMAL_POLICY,
];

/**
 * Policy registry
 */
const policyRegistry = new Map<string, GuardPolicy>(
  DEFAULT_POLICIES.map((p) => [p.id, p])
);

/**
 * Get a policy by ID
 */
export function getPolicy(policyId: string): GuardPolicy | undefined {
  return policyRegistry.get(policyId);
}

/**
 * Register a custom policy
 */
export function registerPolicy(policy: GuardPolicy): void {
  policyRegistry.set(policy.id, policy);
}

/**
 * Get all registered policies
 */
export function getAllPolicies(): GuardPolicy[] {
  return Array.from(policyRegistry.values());
}
