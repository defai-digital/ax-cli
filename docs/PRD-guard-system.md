# PRD: Guard System for ax-cli

**Version:** 1.0
**Date:** 2024-12-24
**Status:** Draft
**Author:** Architecture Review

---

## Executive Summary

This PRD defines the implementation of a Guard System for ax-cli, adopted from patterns in ax-cli.v2. The Guard System provides a security governance layer that validates operations before execution, preventing dangerous actions like path traversal attacks, credential exposure, and injection attempts.

**Scope:** Selective adoption of the guard system only (not full v2 refactoring)
**Risk Level:** Low (additive, non-breaking)
**Estimated Effort:** 1 week

---

## Problem Statement

### Current State
- ax-cli has basic Zod validation for inputs
- MCP-specific invariants exist but are not generalized
- No centralized security governance for tool execution
- No protection against path traversal, credential exposure, or injection attacks

### Risks Without Guard System
1. **Path Traversal:** Tools could access `/etc/passwd`, `~/.ssh/id_rsa`
2. **Credential Exposure:** API keys could be logged or returned to user
3. **Injection Attacks:** Command injection via tool arguments
4. **Unbounded Operations:** No limits on file sizes, token usage

---

## Goals

### Primary Goals
1. Prevent dangerous file system access (path violation)
2. Detect and block credential exposure in outputs
3. Detect injection attempts in inputs
4. Validate tool arguments against schemas

### Non-Goals (Out of Scope)
1. Full domain refactoring of agent module
2. Workflow engine adoption
3. Contract versioning system
4. Ability/capability system

---

## Solution Design

### Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                      Tool Execution                      │
└─────────────────────────┬───────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                     Guard System                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │
│  │ PathViolation│  │ Credential │  │  Injection  │      │
│  │    Gate     │  │   Gate     │  │    Gate     │      │
│  └─────────────┘  └─────────────┘  └─────────────┘      │
│  ┌─────────────┐                                        │
│  │   Schema    │   Policy Engine → GuardResult          │
│  │    Gate     │                                        │
│  └─────────────┘                                        │
└─────────────────────────┬───────────────────────────────┘
                          │
                          ▼
              PASS → Execute    FAIL → Block
              WARN → Execute + Log
```

### Core Components

#### 1. Gate Interface
```typescript
interface GateImplementation {
  check(context: Readonly<GateContext>, config?: GateConfig): GuardCheckResult;
}
```

#### 2. Guard Result
```typescript
type GateResult = 'PASS' | 'WARN' | 'FAIL';

interface GuardCheckResult {
  gate: GateType;
  result: GateResult;
  message: string;
  details?: Record<string, unknown>;
  duration?: number;
}

interface GuardResult {
  policy: string;
  overallResult: GateResult;
  checks: GuardCheckResult[];
  timestamp: string;
  duration: number;
}
```

#### 3. Gate Context
```typescript
interface GateContext {
  sessionId?: string;
  cwd: string;
  filePath?: string;
  content?: string;
  command?: string;
  toolName?: string;
  toolArguments?: Record<string, unknown>;
}
```

---

## Detailed Requirements

### Gate 1: PathViolationGate

**Purpose:** Prevent access to dangerous file system paths

**Invariants:**
- INV-PATH-001: Always normalize paths before comparison
- INV-PATH-002: Block absolute paths outside workspace by default
- INV-PATH-003: Block known dangerous paths (/etc, /root, ~/.ssh)

**Default Blocked Paths:**
```typescript
const BLOCKED_PATHS = [
  '/etc',
  '/root',
  '/var',
  '/usr/bin',
  '/usr/sbin',
  '/bin',
  '/sbin',
  '~/.ssh',
  '~/.gnupg',
  '~/.aws',
  '~/.config',
];
```

**Default Blocked Patterns:**
```typescript
const BLOCKED_PATTERNS = [
  /\.env$/,
  /\.env\..+$/,
  /id_rsa/,
  /id_ed25519/,
  /\.pem$/,
  /credentials\.json$/,
  /secrets?\./i,
];
```

**Behavior:**
| Condition | Result |
|-----------|--------|
| Path in blocked list | FAIL |
| Path matches blocked pattern | FAIL |
| Path outside cwd (not in allowed) | WARN |
| Path inside cwd | PASS |

---

### Gate 2: CredentialExposureGate

**Purpose:** Detect credentials in content before exposure

**Invariants:**
- INV-CRED-001: Scan all output content before returning to user
- INV-CRED-002: Use pattern matching, not exact matching
- INV-CRED-003: Support custom patterns via configuration

**Default Patterns:**
```typescript
const CREDENTIAL_PATTERNS = [
  // API Keys
  /(?:api[_-]?key|apikey)\s*[=:]\s*['"]?[a-zA-Z0-9_-]{20,}/i,
  /(?:secret|token)\s*[=:]\s*['"]?[a-zA-Z0-9_-]{20,}/i,

  // AWS
  /AKIA[0-9A-Z]{16}/,
  /aws[_-]?secret[_-]?access[_-]?key/i,

  // Private Keys
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,

  // Passwords
  /(?:password|passwd|pwd)\s*[=:]\s*['"][^'"]{8,}/i,

  // Common tokens
  /Bearer\s+[a-zA-Z0-9_-]{20,}/i,
  /ghp_[a-zA-Z0-9]{36}/,  // GitHub
  /sk-[a-zA-Z0-9]{48}/,   // OpenAI
  /xox[baprs]-[a-zA-Z0-9-]+/,  // Slack
];
```

**Behavior:**
| Condition | Result |
|-----------|--------|
| Credential pattern detected | FAIL |
| No patterns matched | PASS |

---

### Gate 3: InjectionAttemptGate

**Purpose:** Detect injection attacks in inputs

**Invariants:**
- INV-INJ-001: Check all string inputs
- INV-INJ-002: Detect SQL, command, path, and template injection
- INV-INJ-003: Log detected attempts for security audit

**Detection Patterns:**
```typescript
const INJECTION_PATTERNS = [
  // SQL Injection
  /(?:union\s+select|;\s*drop\s|;\s*delete\s|;\s*insert\s|;\s*update\s)/i,
  /(?:'\s*or\s+'1'\s*=\s*'1|"\s*or\s+"1"\s*=\s*"1)/i,

  // Command Injection
  /(?:\||;|`|\$\(|\$\{).*(?:cat|ls|rm|mv|cp|chmod|chown)/i,
  /(?:&&|\|\|)\s*(?:curl|wget|nc|bash|sh|python|node|ruby)/i,

  // Path Traversal
  /\.\.\/.*\.\.\/.*\.\.\//,
  /(?:%2e%2e|%252e%252e)/i,

  // Template Injection
  /\{\{.*(?:constructor|prototype|__proto__).*\}\}/,
  /\$\{.*(?:process|require|import|eval).*\}/,

  // Script Injection
  /<script\b[^>]*>[\s\S]*?<\/script>/i,
  /javascript:\s*[a-z]/i,
];
```

**Behavior:**
| Condition | Result |
|-----------|--------|
| Injection pattern detected | FAIL |
| No patterns matched | PASS |

---

### Gate 4: SchemaViolationGate

**Purpose:** Validate tool arguments against expected schema

**Invariants:**
- INV-SCHEMA-001: Each tool must have a defined schema
- INV-SCHEMA-002: Validation runs before tool execution
- INV-SCHEMA-003: Report specific validation errors

**Behavior:**
| Condition | Result |
|-----------|--------|
| Arguments match schema | PASS |
| Arguments violate schema | FAIL with details |
| No schema defined for tool | WARN |

---

## Policy System

### Policy Definition
```typescript
interface GuardPolicy {
  id: string;
  name: string;
  description?: string;
  gates: GateType[];
  config?: Record<GateType, GateConfig>;
  enabled: boolean;
}
```

### Default Policies

#### 1. tool-execution (Default)
```typescript
{
  id: 'tool-execution',
  gates: ['injection_attempt', 'schema_violation'],
  enabled: true
}
```

#### 2. file-write
```typescript
{
  id: 'file-write',
  gates: ['path_violation', 'credential_exposure'],
  config: {
    path_violation: {
      blockedPaths: ['/etc', '/root', '~/.ssh'],
      blockedPatterns: [/\.env$/, /id_rsa/]
    }
  },
  enabled: true
}
```

#### 3. file-read
```typescript
{
  id: 'file-read',
  gates: ['path_violation'],
  config: {
    path_violation: {
      blockedPaths: ['/etc/shadow', '/etc/passwd'],
      warnOutsideCwd: true
    }
  },
  enabled: true
}
```

#### 4. command-execution
```typescript
{
  id: 'command-execution',
  gates: ['injection_attempt', 'path_violation'],
  enabled: true
}
```

#### 5. output-screening
```typescript
{
  id: 'output-screening',
  gates: ['credential_exposure'],
  enabled: true
}
```

---

## Invariants (5 Core)

### INV-GUARD-001: Read-Only
Guard MUST NOT modify any state, only read and validate.

**Enforcement:**
- Context passed as `Readonly<GateContext>`
- Object.freeze() on context before gate execution
- No write operations in any gate

### INV-GUARD-002: All Gates Run
All gates in policy MUST be evaluated, even after FAIL.

**Enforcement:**
- No early return in gate loop
- All results collected before computing overall result

**Rationale:** Complete violation report for security audit

### INV-GUARD-003: FAIL Precedence
Any FAIL gate makes overall result FAIL.

**Enforcement:**
```typescript
function computeOverallResult(checks: GuardCheckResult[]): GateResult {
  if (checks.some(c => c.result === 'FAIL')) return 'FAIL';
  if (checks.some(c => c.result === 'WARN')) return 'WARN';
  return 'PASS';
}
```

### INV-GUARD-004: Deterministic
Same input MUST produce same guard result.

**Enforcement:**
- Pure functions only (no random, no external state)
- No time-dependent logic in gates

### INV-GUARD-005: Path Normalization
Path checks MUST normalize paths before comparison.

**Enforcement:**
```typescript
function normalizePath(path: string): string {
  return path
    .replace(/\\/g, '/')           // Windows -> Unix
    .replace(/\/+/g, '/')          // Remove doubles
    .replace(/\/\.$/, '')          // Remove /. suffix
    .replace(/\/+$/, '')           // Remove trailing /
    .replace(/^\.\//, '');         // Remove ./ prefix
}
```

---

## File Structure

```
packages/core/src/guard/
├── index.ts                 # Public exports
├── types.ts                 # Type definitions
├── guard.ts                 # Main Guard class
├── policies.ts              # Default policy definitions
├── utils.ts                 # Utility functions (normalizePath, etc.)
├── gates/
│   ├── index.ts             # Gate exports
│   ├── base.ts              # Base gate interface
│   ├── path-violation.ts    # PathViolationGate
│   ├── credential-exposure.ts # CredentialExposureGate
│   ├── injection-attempt.ts # InjectionAttemptGate
│   └── schema-violation.ts  # SchemaViolationGate
└── __tests__/
    ├── guard.test.ts
    ├── path-violation.test.ts
    ├── credential-exposure.test.ts
    ├── injection-attempt.test.ts
    └── schema-violation.test.ts

packages/schemas/src/guard/
├── index.ts                 # Schema exports
└── guard-schemas.ts         # Zod schemas for guard types
```

---

## Integration Points

### 1. Tool Execution
```typescript
// In tool executor
async function executeTool(tool: Tool, args: unknown, context: ExecutionContext) {
  const guardResult = guard.check('tool-execution', {
    toolName: tool.name,
    toolArguments: args,
    cwd: context.cwd,
    sessionId: context.sessionId
  });

  if (guardResult.overallResult === 'FAIL') {
    throw new GuardBlockedError(guardResult);
  }

  if (guardResult.overallResult === 'WARN') {
    logger.warn('Guard warning', { checks: guardResult.checks });
  }

  return tool.execute(args, context);
}
```

### 2. File Operations
```typescript
// In file write tool
async function writeFile(path: string, content: string, context: ExecutionContext) {
  const guardResult = guard.check('file-write', {
    filePath: path,
    content: content,
    cwd: context.cwd
  });

  if (guardResult.overallResult === 'FAIL') {
    return { success: false, error: 'Blocked by security policy', details: guardResult.checks };
  }

  // Proceed with write
}
```

### 3. Output Screening
```typescript
// Before returning output to user
function screenOutput(content: string, context: ExecutionContext): string {
  const guardResult = guard.check('output-screening', {
    content: content,
    cwd: context.cwd
  });

  if (guardResult.overallResult === 'FAIL') {
    return '[Content redacted: potential credential exposure detected]';
  }

  return content;
}
```

---

## Metrics & Observability

### Metrics to Track
```typescript
interface GuardMetrics {
  totalChecks: number;
  passCount: number;
  warnCount: number;
  failCount: number;
  averageDuration: number;
  byGate: Record<GateType, {
    total: number;
    pass: number;
    warn: number;
    fail: number;
  }>;
  byPolicy: Record<string, {
    total: number;
    pass: number;
    warn: number;
    fail: number;
  }>;
}
```

### Logging
- INFO: Guard check started/completed
- WARN: Guard returned WARN result
- ERROR: Guard returned FAIL result (with details for security audit)

---

## Testing Strategy

### Unit Tests
1. Each gate tested in isolation
2. Edge cases for pattern matching
3. Path normalization edge cases
4. Policy composition

### Integration Tests
1. Guard integration with tool execution
2. Guard integration with file operations
3. End-to-end flow with real tools

### Security Tests
1. Known attack patterns (OWASP top 10)
2. Path traversal attempts
3. Credential exposure scenarios
4. Injection attack vectors

---

## Rollout Plan

### Phase 1: Implementation (Days 1-3)
- Implement core Guard class
- Implement 4 gates
- Add unit tests

### Phase 2: Integration (Days 4-5)
- Integrate with tool execution
- Integrate with file operations
- Add integration tests

### Phase 3: Monitoring (Days 6-7)
- Add metrics collection
- Add logging
- Monitor for false positives

### Rollback Plan
- Guard system is additive and non-breaking
- Can disable via configuration: `guard.enabled = false`
- Existing code paths remain unchanged

---

## Success Criteria

1. **Security:** Block 100% of known attack patterns in tests
2. **Performance:** < 5ms average guard check duration
3. **False Positives:** < 1% false positive rate in production
4. **Coverage:** All tool executions pass through guard

---

## Appendix: Configuration Schema

```typescript
interface GuardConfig {
  enabled: boolean;
  defaultPolicy: string;
  policies: GuardPolicy[];
  gates: {
    path_violation?: {
      blockedPaths?: string[];
      blockedPatterns?: (string | RegExp)[];
      allowedPaths?: string[];
      warnOutsideCwd?: boolean;
    };
    credential_exposure?: {
      patterns?: (string | RegExp)[];
      customPatterns?: (string | RegExp)[];
    };
    injection_attempt?: {
      patterns?: (string | RegExp)[];
      customPatterns?: (string | RegExp)[];
    };
    schema_violation?: {
      strictMode?: boolean;
      allowUnknownTools?: boolean;
    };
  };
}
```

---

## References

- ax-cli.v2 Guard Implementation: `~/code/ax-cli.v2/packages/core/src/guard/`
- ax-cli.v2 Guard Contracts: `~/code/ax-cli.v2/packages/contracts/src/guard/v1/`
- OWASP Top 10: https://owasp.org/Top10/
