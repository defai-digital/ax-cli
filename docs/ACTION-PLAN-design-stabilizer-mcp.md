# Action Plan: Design Stabilizer MCP Tools

## Summary

Implement MCP tools for Design Stabilizer in AutomatosX to enable universal access from any MCP client (Claude Code, Cursor, VS Code).

**Duration**: 2 weeks
**Complexity**: Medium
**Dependencies**: @defai.digital/ax-core v4.4.19+

---

## Week 1: Core MCP Tools

### Day 1-2: Project Setup & Dependencies

| Task | Owner | Deliverable |
|------|-------|-------------|
| Add @defai.digital/ax-core as dependency to AutomatosX | Dev | package.json updated |
| Create tools/design-check directory structure | Dev | Folder structure |
| Set up tool registration in MCP server | Dev | Tools discoverable |
| Add TypeScript interfaces for tool params/responses | Dev | types.ts |

**Folder Structure**:
```
automatosx/
└── src/
    └── tools/
        └── design-check/
            ├── index.ts           # Tool registration
            ├── types.ts           # Interfaces
            ├── check.ts           # design_check implementation
            ├── stream.ts          # design_check_stream implementation
            ├── fixes.ts           # suggest/apply fixes
            ├── rules.ts           # design_rules implementation
            └── utils.ts           # Shared utilities
```

### Day 3-4: Implement design_check Tool

| Task | Owner | Deliverable |
|------|-------|-------------|
| Implement path validation & normalization | Dev | utils.ts |
| Wrap runDesignCheck from ax-core | Dev | check.ts |
| Handle config loading with fallbacks | Dev | Config resolution |
| Format response per MCP spec | Dev | JSON response |
| Add memory integration (store results) | Dev | memoryKey in response |
| Write unit tests | Dev | 90%+ coverage |

**Implementation Sketch**:
```typescript
// check.ts
import { runDesignCheck, loadConfig } from '@defai.digital/ax-core';
import { validatePaths, normalizeResponse } from './utils';
import { addMemory } from '../memory';

export async function designCheck(params: DesignCheckParams): Promise<DesignCheckResponse> {
  // 1. Validate paths
  const validatedPaths = validatePaths(params.paths, params.workspaceRoot);

  // 2. Load config
  const config = await loadConfig(params.configPath);

  // 3. Run check
  const result = await runDesignCheck(validatedPaths, {
    format: 'json',
    quiet: params.quiet ?? false,
    rule: params.rule,
    ignorePatterns: params.ignorePatterns ?? [],
  });

  // 4. Store in memory
  const memoryKey = await addMemory({
    type: 'design_check',
    summary: result.summary,
    timestamp: new Date().toISOString(),
  });

  // 5. Return normalized response
  return normalizeResponse(result, memoryKey);
}
```

### Day 5: Implement design_rules Tool

| Task | Owner | Deliverable |
|------|-------|-------------|
| Wrap getAvailableRules from ax-core | Dev | rules.ts |
| Add rule metadata (description, fixable, examples) | Dev | Enhanced response |
| Include current config severity | Dev | Config-aware |
| Write unit tests | Dev | Full coverage |

---

## Week 2: Streaming, Fixes & Integration

### Day 6-7: Implement design_check_stream Tool

| Task | Owner | Deliverable |
|------|-------|-------------|
| Implement chunked file scanning | Dev | stream.ts |
| Emit progress events | Dev | SSE/streaming |
| Handle cancellation | Dev | Graceful abort |
| Write integration tests | Dev | Large file set tests |

**Streaming Implementation**:
```typescript
// stream.ts
export async function* designCheckStream(params: StreamParams): AsyncGenerator<StreamEvent> {
  const files = await scanFiles(params.paths, config.include, config.ignore);
  const total = files.length;
  const chunkSize = params.chunkSize ?? 50;

  for (let i = 0; i < files.length; i += chunkSize) {
    const chunk = files.slice(i, i + chunkSize);

    // Emit progress
    yield { type: 'progress', processed: i, total };

    // Process chunk
    for (const file of chunk) {
      const result = await checkFile(file, config);
      yield { type: 'file_result', file, violations: result.violations };
    }
  }

  // Emit final summary
  yield { type: 'summary', ...aggregateResults() };
}
```

### Day 8-9: Implement Fix Tools

| Task | Owner | Deliverable |
|------|-------|-------------|
| Implement design_suggest_fixes | Dev | fixes.ts |
| Generate unified diff output | Dev | Patch format |
| Implement design_apply_fixes | Dev | File modification |
| Add backup creation | Dev | .ax-backup files |
| Add post-fix verification | Dev | Re-check after fix |
| Write tests with file fixtures | Dev | Fix verification tests |

**Fix Workflow**:
```
User Request
     │
     ▼
design_check ──► Find violations
     │
     ▼
design_suggest_fixes ──► Preview patches (read-only)
     │
     ▼
User Reviews Patches
     │
     ▼
design_apply_fixes ──► Apply + Verify
     │
     ▼
Return verification results
```

### Day 10: Error Handling & Edge Cases

| Task | Owner | Deliverable |
|------|-------|-------------|
| Implement structured error codes | Dev | Error types |
| Add timeout handling for large scans | Dev | TIMEOUT error |
| Handle invalid/binary files gracefully | Dev | PARSE_ERROR |
| Add partial results on failure | Dev | partialResults field |
| Write error case tests | Dev | Edge case coverage |

**Error Handling**:
```typescript
// utils.ts
export function handleError(error: unknown, partialResults?: CheckResult): ErrorResponse {
  if (error instanceof PathValidationError) {
    return { success: false, error: { code: 'INVALID_PATH', message: error.message } };
  }
  if (error instanceof ConfigError) {
    return { success: false, error: { code: 'CONFIG_ERROR', message: error.message } };
  }
  if (error instanceof TimeoutError) {
    return {
      success: false,
      error: { code: 'TIMEOUT', message: 'Scan exceeded time limit' },
      partialResults
    };
  }
  // Generic error
  return { success: false, error: { code: 'UNKNOWN', message: String(error) } };
}
```

---

## Week 2 (continued): Integration & Testing

### Day 11-12: Agent Integration

| Task | Owner | Deliverable |
|------|-------|-------------|
| Add design check to quality agent capabilities | Dev | Agent config |
| Create agent workflow examples | Dev | Documentation |
| Test agent → tool invocation | Dev | Integration test |
| Add memory queries for trends | Dev | Memory search |

**Quality Agent Integration**:
```typescript
// In quality agent system prompt or capabilities
{
  "capabilities": [
    "design_check",
    "design_suggest_fixes",
    "design_apply_fixes"
  ],
  "workflows": {
    "code_review": [
      "Run design_check on changed files",
      "If violations found, suggest fixes",
      "Present fixes for approval"
    ]
  }
}
```

### Day 13: Documentation & Examples

| Task | Owner | Deliverable |
|------|-------|-------------|
| Write tool documentation | Dev | README section |
| Create usage examples | Dev | Examples folder |
| Document error codes | Dev | Error reference |
| Add troubleshooting guide | Dev | FAQ section |

### Day 14: Final Testing & Release

| Task | Owner | Deliverable |
|------|-------|-------------|
| End-to-end testing with Claude Code | QA | Test report |
| Performance testing (1000 files) | QA | Benchmark results |
| Security review (path validation) | Security | Sign-off |
| Release to MCP server | Dev | Deployed tools |

---

## Test Plan

### Unit Tests

| Component | Test Cases | Coverage Target |
|-----------|------------|-----------------|
| Path validation | Valid paths, invalid paths, glob expansion | 100% |
| Config loading | Default, custom, missing, invalid | 100% |
| Response formatting | All fields, edge cases | 95% |
| Error handling | All error codes | 100% |
| Fix generation | Spacing, colors, no-fix cases | 95% |

### Integration Tests

| Scenario | Description | Expected Result |
|----------|-------------|-----------------|
| Small repo scan | 50 files, mixed violations | Complete in <2s |
| Large repo stream | 1000 files | Stream completes, progress events |
| Fix workflow | Check → Suggest → Apply → Verify | Errors reduced |
| Config override | Custom config path | Uses custom rules |
| Agent invocation | Quality agent calls design_check | Successful response |

### Performance Tests

| Test | Input | Target |
|------|-------|--------|
| Cold start | First invocation | <3s |
| Warm scan | 100 files | <2s |
| Large scan | 1000 files (stream) | <30s total |
| Memory usage | 1000 files | <200MB peak |

---

## Rollout Plan

### Phase 1: Internal Testing
- Deploy to staging MCP server
- Test with internal Claude Code users
- Gather feedback on UX

### Phase 2: Beta Release
- Enable for select external users
- Monitor error rates and latency
- Iterate on feedback

### Phase 3: General Availability
- Announce in release notes
- Update documentation
- Enable for all MCP clients

---

## Risk Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| ax-core API changes | Low | High | Pin version, add contract tests |
| Performance issues | Medium | Medium | Streaming, chunking, caching |
| Path traversal security | Low | High | Strict validation, workspace sandboxing |
| MCP server instability | Low | Medium | Graceful degradation, CLI fallback |

---

## Success Criteria

| Metric | Target | Measurement |
|--------|--------|-------------|
| All tools functional | 5/5 tools working | Manual testing |
| Test coverage | >90% | Coverage report |
| Response time p95 | <5s (100 files) | Latency metrics |
| Zero security issues | 0 critical/high | Security scan |
| Documentation complete | All tools documented | Review |

---

## Dependencies

### Required Before Start
- [x] Design Stabilizer in ax-core (v4.4.19)
- [x] Unit tests for core logic (113 tests passing)
- [ ] AutomatosX MCP server access
- [ ] ax-core published to npm (or local link)

### External Dependencies
- @defai.digital/ax-core: ^4.4.19
- MCP SDK (for tool registration)
- Memory system (for result storage)

---

## Timeline Summary

```
Week 1                          Week 2
┌─────────────────────────┐    ┌─────────────────────────┐
│ D1-2: Setup             │    │ D6-7: Streaming         │
│ D3-4: design_check      │    │ D8-9: Fix tools         │
│ D5: design_rules        │    │ D10: Error handling     │
│                         │    │ D11-12: Agent integrate │
│                         │    │ D13: Documentation      │
│                         │    │ D14: Release            │
└─────────────────────────┘    └─────────────────────────┘
         │                              │
         ▼                              ▼
   Core tools ready              Full release
```

---

## Appendix: File Templates

### Tool Registration (index.ts)
```typescript
import { ToolDefinition } from '../types';
import { designCheck } from './check';
import { designCheckStream } from './stream';
import { designSuggestFixes, designApplyFixes } from './fixes';
import { designRules } from './rules';

export const designCheckTools: ToolDefinition[] = [
  {
    name: 'design_check',
    description: 'Scan code for design system violations',
    parameters: { /* ... */ },
    handler: designCheck,
  },
  {
    name: 'design_check_stream',
    description: 'Stream design check results for large codebases',
    parameters: { /* ... */ },
    handler: designCheckStream,
    streaming: true,
  },
  {
    name: 'design_suggest_fixes',
    description: 'Preview fix patches without modifying files',
    parameters: { /* ... */ },
    handler: designSuggestFixes,
  },
  {
    name: 'design_apply_fixes',
    description: 'Apply reviewed patches and verify results',
    parameters: { /* ... */ },
    handler: designApplyFixes,
  },
  {
    name: 'design_rules',
    description: 'List available design check rules',
    parameters: { /* ... */ },
    handler: designRules,
  },
];
```
