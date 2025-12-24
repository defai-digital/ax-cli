# Guard System Invariants

This document defines the invariants (behavioral contracts) for the Guard System.
All invariants are enforced through code and tested.

## Core Guard Invariants

### INV-GUARD-001: Read-Only Operations

**Statement:** Guard MUST NOT modify any state, only read and validate.

**Rationale:** Guard checks should be side-effect free to allow safe retries and caching.

**Enforcement:**
- Context is passed as `Readonly<GateContext>`
- `Object.freeze()` is called on context before gate execution
- No gate implementations contain write operations

**Test:** Verify that calling `guard.check()` multiple times with the same input produces identical results without side effects.

---

### INV-GUARD-002: All Gates Run

**Statement:** All gates in a policy MUST be evaluated, even after a FAIL is encountered.

**Rationale:** Complete violation reports are necessary for security auditing and debugging. Users need to see ALL issues, not just the first one.

**Enforcement:**
```typescript
// No early return in gate loop
for (const gateType of policy.gates) {
  const result = gate.check(frozenContext, gateConfig);
  checks.push(result); // Always push, never break
}
```

**Test:** Verify that `checks` array length equals `policy.gates.length` even when some gates FAIL.

---

### INV-GUARD-003: FAIL Precedence

**Statement:** Any FAIL gate makes the overall result FAIL.

**Rationale:** Conservative security posture - one violation blocks the operation.

**Enforcement:**
```typescript
function computeOverallResult(checks: GuardCheckResult[]): GateResult {
  if (checks.some(c => c.result === 'FAIL')) return 'FAIL';
  if (checks.some(c => c.result === 'WARN')) return 'WARN';
  return 'PASS';
}
```

**Test:** Verify that overall result is FAIL when any check result is FAIL, regardless of other results.

---

### INV-GUARD-004: Deterministic Results

**Statement:** Same input MUST produce same guard result.

**Rationale:** Predictable behavior enables caching, testing, and debugging.

**Enforcement:**
- Pure functions only (no random, no external state)
- No time-dependent logic in gates
- No network calls in gates

**Test:** Call `guard.check()` twice with identical inputs and verify identical outputs.

---

### INV-GUARD-005: Path Normalization

**Statement:** Path checks MUST normalize paths before comparison.

**Rationale:** Prevents path traversal attacks like `../../../etc/passwd` and handles platform differences.

**Enforcement:**
```typescript
function normalizePath(path: string): string {
  return path
    .replace(/^~/, process.env.HOME || '~')  // Expand ~
    .replace(/\\/g, '/')                      // Windows -> Unix
    .replace(/\/+/g, '/')                     // Remove duplicate /
    .replace(/\/\.$/, '')                     // Remove /. suffix
    .replace(/\/+$/, '')                      // Remove trailing /
    .replace(/^\.\//, '');                    // Remove ./ prefix
}
```

**Test:** Verify that `/tmp/../etc/passwd` normalizes to `/etc/passwd` and is blocked.

---

## Gate-Specific Invariants

### Path Violation Gate

| ID | Statement |
|----|-----------|
| INV-PATH-001 | Always normalize paths before comparison |
| INV-PATH-002 | Block absolute paths outside workspace by default |
| INV-PATH-003 | Block known dangerous paths (/etc, /root, ~/.ssh) |

### Credential Exposure Gate

| ID | Statement |
|----|-----------|
| INV-CRED-001 | Scan all output content before returning to user |
| INV-CRED-002 | Use pattern matching, not exact matching |
| INV-CRED-003 | Support custom patterns via configuration |

### Injection Attempt Gate

| ID | Statement |
|----|-----------|
| INV-INJ-001 | Check all string inputs (content, command, filePath, toolArguments) |
| INV-INJ-002 | Detect SQL, command, path, and template injection |
| INV-INJ-003 | Log detected attempts for security audit |

### Schema Violation Gate

| ID | Statement |
|----|-----------|
| INV-SCHEMA-001 | Each tool should have a defined schema |
| INV-SCHEMA-002 | Validation runs before tool execution |
| INV-SCHEMA-003 | Report specific validation errors |

---

## Invariant Verification

All invariants are verified through:

1. **Unit Tests:** Each invariant has corresponding test cases in `__tests__/guard.test.ts`
2. **Type System:** TypeScript types enforce compile-time invariants
3. **Runtime Assertions:** Critical invariants are checked at runtime
4. **Code Review:** Changes to guard code require invariant compliance review

---

## Adding New Invariants

When adding new invariants:

1. Document the invariant in this file with ID, statement, rationale, and enforcement
2. Add test cases to verify the invariant
3. Update code to enforce the invariant
4. Add JSDoc `@invariant` tags to relevant code

Format:
```
INV-{DOMAIN}-{NUMBER}: {Statement}
```

Examples:
- `INV-GUARD-001`: Core guard invariant
- `INV-PATH-001`: Path violation gate invariant
- `INV-CRED-001`: Credential exposure gate invariant
