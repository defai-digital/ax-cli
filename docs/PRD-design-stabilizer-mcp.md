# PRD: Design Stabilizer MCP Tools

## Overview

### Problem Statement
Design Stabilizer is currently only accessible via ax-cli commands (`ax design check`). Users of other AI assistants (Claude Code, Cursor, VS Code with MCP) cannot leverage this functionality without installing and running ax-cli separately.

### Solution
Expose Design Stabilizer functionality through MCP (Model Context Protocol) tools in AutomatosX, enabling universal access while maintaining the core library in `@defai.digital/ax-core`.

### Goals
1. Make design system checking available to any MCP-compatible client
2. Enable AutomatosX agents to perform design system audits
3. Maintain single source of truth for detection rules
4. Support large codebases with streaming capabilities
5. Provide safe auto-fix workflow with preview and verification

### Non-Goals
- Replacing the CLI interface (CLI remains for terminal users)
- Moving core logic out of ax-core
- Real-time file watching (out of scope for v1)

---

## Architecture

### System Design

```
┌─────────────────────────────────────────────────────────────┐
│                 @defai.digital/ax-core                      │
│  ┌───────────────────────────────────────────────────────┐ │
│  │              design-check module                       │ │
│  │  Exports:                                              │ │
│  │  • runDesignCheck(paths, options) → CheckResult        │ │
│  │  • loadConfig(path?) → DesignCheckConfig               │ │
│  │  • applyFixes(file, violations, config) → FixResult    │ │
│  │  • getAvailableRules() → string[]                      │ │
│  │  • scanFiles(paths, include, ignore) → string[]        │ │
│  └───────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                    npm dependency
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    AutomatosX MCP Server                    │
│  ┌───────────────────────────────────────────────────────┐ │
│  │              design-stabilizer tools                   │ │
│  │                                                        │ │
│  │  • design_check         - Scan for violations          │ │
│  │  • design_check_stream  - Stream results (large repos) │ │
│  │  • design_suggest_fixes - Preview fix patches          │ │
│  │  • design_apply_fixes   - Apply verified patches       │ │
│  │  • design_rules         - List available rules         │ │
│  └───────────────────────────────────────────────────────┘ │
│                              │                              │
│  ┌───────────────────────────────────────────────────────┐ │
│  │              Integration Points                        │ │
│  │  • Memory: Store violation history for trends          │ │
│  │  • Agents: quality/frontend agents can invoke tools    │ │
│  │  • Sessions: Group checks under session IDs            │ │
│  └───────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                    MCP Protocol
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
        Claude Code        Cursor         VS Code
```

### Dependency Flow

```
ax-core (upstream) ──publishes──► npm registry
                                      │
              ┌───────────────────────┴───────────────────────┐
              ▼                                               ▼
    ax-cli/ax-glm/ax-grok                              AutomatosX
    (direct import)                                    (npm install)
```

---

## MCP Tool Specifications

### 1. design_check

**Purpose**: Scan files for design system violations

**Parameters**:
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| paths | string[] | Yes | - | File paths or glob patterns |
| format | "json" \| "stylish" | No | "json" | Output format |
| quiet | boolean | No | false | Only report errors |
| rule | string | No | - | Run specific rule only |
| ignorePatterns | string[] | No | [] | Additional ignore patterns |
| configPath | string | No | - | Custom config file path |
| includeCoverage | boolean | No | true | Include coverage stats |

**Response**:
```typescript
interface DesignCheckResponse {
  success: boolean;
  summary: {
    files: number;
    filesWithViolations: number;
    errors: number;
    warnings: number;
    skipped: number;
  };
  results: Array<{
    file: string;
    violations: Array<{
      rule: string;
      severity: "error" | "warning";
      message: string;
      line: number;
      column: number;
      found: string;
      suggestion?: string;
      fixable: boolean;
    }>;
    skipped?: boolean;
    skipReason?: string;
  }>;
  coverage?: {
    colorCoverage: number;
    spacingCoverage: number;
    totalColors: number;
    totalSpacing: number;
  };
  memoryKey?: string;
}
```

**Example**:
```json
{
  "name": "design_check",
  "arguments": {
    "paths": ["src/**/*.tsx"],
    "rule": "no-hardcoded-colors",
    "quiet": false
  }
}
```

---

### 2. design_check_stream

**Purpose**: Stream scan results for large codebases (>500 files)

**Parameters**: Same as `design_check` plus:
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| chunkSize | number | No | 50 | Files per chunk |

**Stream Events**:
```typescript
// Progress event
{ type: "progress", processed: number, total: number }

// File result event
{ type: "file_result", file: string, violations: Violation[] }

// Final summary event
{ type: "summary", ...DesignCheckResponse }
```

---

### 3. design_suggest_fixes

**Purpose**: Generate fix patches without modifying files

**Parameters**:
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| file | string | Yes | - | File path to fix |
| violations | Violation[] | No | - | Specific violations (or detect all) |
| configPath | string | No | - | Custom config file path |

**Response**:
```typescript
interface SuggestFixesResponse {
  success: boolean;
  file: string;
  patches: Array<{
    line: number;
    original: string;
    replacement: string;
    rule: string;
    confidence: "high" | "medium" | "low";
  }>;
  unifiedDiff: string;
  wouldFix: number;
  cannotFix: number;
  cannotFixReasons?: string[];
}
```

---

### 4. design_apply_fixes

**Purpose**: Apply reviewed patches and optionally verify results

**Parameters**:
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| file | string | Yes | - | File to fix |
| patches | Patch[] | No | - | Specific patches (or apply all fixable) |
| createBackup | boolean | No | true | Create .ax-backup file |
| verify | boolean | No | true | Re-run check after fixing |

**Response**:
```typescript
interface ApplyFixesResponse {
  success: boolean;
  file: string;
  backupPath?: string;
  applied: number;
  failed: number;
  failedReasons?: string[];
  verification?: {
    beforeErrors: number;
    afterErrors: number;
    beforeWarnings: number;
    afterWarnings: number;
    fixed: number;
  };
}
```

---

### 5. design_rules

**Purpose**: List available detection rules and their configuration

**Parameters**:
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| configPath | string | No | - | Config to check rule settings |

**Response**:
```typescript
interface RulesResponse {
  rules: Array<{
    id: string;
    description: string;
    defaultSeverity: "error" | "warning";
    currentSeverity: "error" | "warn" | "off";
    fixable: boolean;
    examples: {
      bad: string;
      good: string;
    };
  }>;
}
```

---

## Error Handling

### Error Codes

| Code | Description | Recovery |
|------|-------------|----------|
| INVALID_PATH | Path outside workspace or doesn't exist | Check path and retry |
| CONFIG_ERROR | Invalid or missing config file | Use default config or fix file |
| PARSE_ERROR | Cannot parse source file | Skip file, report in results |
| TIMEOUT | Scan exceeded time limit | Use streaming or reduce scope |
| APPLY_FAILED | Could not apply fix | Check file permissions |
| NO_VIOLATIONS | No violations found (not an error) | Success case |

### Error Response Format

```typescript
interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  partialResults?: DesignCheckResponse;
}
```

---

## Integration Points

### Memory Integration

After each scan, store summary in AutomatosX memory:
```typescript
{
  type: "design_check_result",
  timestamp: "2024-01-15T10:30:00Z",
  summary: { files: 50, errors: 5, warnings: 12 },
  topViolations: ["no-hardcoded-colors", "no-raw-spacing"],
  coverage: { color: 85, spacing: 92 }
}
```

Enable queries like:
- "Show design check trends for last week"
- "Which rules have most violations?"
- "Has color coverage improved?"

### Agent Integration

Quality agent workflow:
```typescript
// Agent can invoke design check as part of code review
const result = await design_check({ paths: ["src/**/*.tsx"] });
if (result.summary.errors > 0) {
  // Suggest fixes
  const fixes = await design_suggest_fixes({ file: result.results[0].file });
  // Present to user for approval
}
```

### Session Integration

Group multiple checks under a session:
```typescript
// Create session for PR review
const session = await session_create({ name: "PR #123 Design Review" });

// Run checks, associate with session
await design_check({ paths: [...], sessionId: session.id });
```

---

## Performance Requirements

| Metric | Target | Notes |
|--------|--------|-------|
| Small scan (<50 files) | <2s | Direct response |
| Medium scan (50-500 files) | <10s | Direct or streaming |
| Large scan (500+ files) | Streaming | Chunk size 50-100 |
| Memory usage | <200MB | For 1000 file scan |
| Fix application | <500ms/file | Including backup |

---

## Security Considerations

1. **Path Validation**: All paths must be within workspace root
2. **No Arbitrary Code**: Rules are predefined, no user-defined regex
3. **Backup Before Fix**: Always create backup unless explicitly disabled
4. **Read-Only Default**: `design_check` never modifies files
5. **Explicit Apply**: Fixes require separate `design_apply_fixes` call

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Tool adoption | 100+ daily invocations | MCP server logs |
| Response time p95 | <5s for 100 files | Latency tracking |
| Fix success rate | >95% | Applied vs failed |
| Memory integration | 80% of checks stored | Memory entries |
| Agent usage | 50+ agent invocations/week | Agent logs |

---

## Out of Scope (v1)

- Real-time file watching
- Custom user-defined rules
- IDE-specific integrations (handled by MCP clients)
- Automatic PR comments (future integration)
- Visual diff preview
