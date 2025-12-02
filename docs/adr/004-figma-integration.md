# ADR-004: Figma Design Integration

## Status
**Proposed** - Implementation started 2025-12-02

## Context

AX-CLI users need design-to-code workflow automation. Current pain points:

1. **Positioning/selection instability** - Natural language descriptions are imprecise for node selection
2. **Unstructured design info** - Raw Figma JSON is hard for humans and LLMs to parse
3. **No repeatable workflows** - Ad-hoc prompts instead of deterministic commands
4. **Missing observability** - No diff, no audit, no structured reports
5. **No structured checks** - Can't validate tokens, spacing, contrast programmatically

### Stakeholder Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Target Figma Plan | Professional (baseline) | 60 req/min, Design System support |
| MCP Requirement | REST-only MVP | No external server dependency |
| Token Format | JSON → Tailwind | 80% user coverage |
| LLM Audit | Not MVP | Rule-based only for determinism |
| Multi-file | Single + DS file | Avoid complex namespace issues |

## Decision

### 1. Module Structure

Create `src/design/` module following existing patterns (not `integrations/`):

```
src/design/
├── index.ts                 # Barrel exports
├── figma-client.ts          # REST API adapter
├── figma-map.ts             # File structure mapping
├── figma-alias.ts           # Node aliasing system
├── figma-select.ts          # Node query/selection
├── figma-tokens.ts          # Token extraction & formatting
├── figma-audit.ts           # Rule-based design audit
├── cache.ts                 # Response caching layer
└── types.ts                 # Internal types (re-export from schemas)

packages/schemas/src/public/design/
├── index.ts                 # Design schema exports
├── figma-types.ts           # Figma API response schemas
├── token-types.ts           # Design token schemas
├── alias-types.ts           # Alias configuration schemas
└── audit-types.ts           # Audit result schemas

src/commands/
└── design.ts                # CLI command entry point
```

### 2. REST-Only Architecture

```typescript
// FigmaClient interface - no MCP dependency for MVP
interface FigmaClient {
  getFile(fileKey: string, options?: GetFileOptions): Promise<FigmaFile>;
  getFileNodes(fileKey: string, nodeIds: string[]): Promise<FigmaNodes>;
  getLocalVariables(fileKey: string): Promise<FigmaVariables>;
  getImages(fileKey: string, nodeIds: string[], options?: ImageOptions): Promise<FigmaImages>;
}
```

MCP integration deferred to Phase 2 as optional enhancement.

### 3. Alias System

Aliases stored in `.ax-cli/design.json`:

```json
{
  "version": 1,
  "defaultFile": "file-key-123",
  "aliases": {
    "landing.hero": { "fileKey": "file-key-123", "nodeId": "123:456" },
    "ds.colors": { "fileKey": "ds-file-key", "nodeId": "789:012" }
  },
  "dsFile": "ds-file-key"
}
```

### 4. Token Output Formats

MVP supports two formats:

```typescript
// JSON (default)
{
  "colors": {
    "primary": { "value": "#0066FF", "type": "color" }
  },
  "spacing": {
    "sm": { "value": "8px", "type": "dimension" }
  }
}

// Tailwind
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: '#0066FF'
      },
      spacing: {
        sm: '8px'
      }
    }
  }
}
```

### 5. Audit Rules (MVP)

Rule-based checks without LLM:

| Rule | Check | Severity |
|------|-------|----------|
| `spacing-consistency` | Spacing values match DS tokens | warning |
| `color-contrast` | WCAG AA/AAA compliance | error |
| `naming-convention` | Component names follow pattern | info |
| `token-usage` | Colors/text match defined tokens | warning |
| `missing-autolayout` | Frames without auto-layout | info |

### 6. Command Structure

```
ax design auth [login|token|status]
ax design map <file-key> [--depth N] [--subtree alias] [--json]
ax design alias [add|list|remove] [alias] [node-id]
ax design select <query> [--json]
ax design tokens pull <file-key> [--format json|tailwind] [--output path]
ax design tokens compare <file-key> <local-path>
ax design audit <alias|node-id> [--rules all|specific] [--json]
```

## Implementation

### Phase 1: Foundation (Week 1-2)

1. Design schemas in `@ax-cli/schemas`
2. Figma REST client with caching
3. `design auth` and `design map` commands

### Phase 2: Core Features (Week 3-4)

1. Alias system
2. Token extraction (JSON + Tailwind)
3. Basic select queries

### Phase 3: Audit (Week 5)

1. Rule-based audit engine
2. CI/CD JSON output
3. Report formatting

### Phase 4: Polish (Week 6)

1. Documentation
2. Error messages
3. Integration tests

## Consequences

### Positive

- **No external dependencies** - REST-only means no MCP server setup
- **Deterministic output** - Rule-based audit is reproducible
- **CI/CD ready** - `--json` flag on all commands
- **Type-safe** - Zod schemas at all boundaries
- **Extensible** - Module structure allows future MCP integration

### Negative

- **No real-time updates** - Polling required (no webhooks in MVP)
- **Rate limiting** - 60 req/min may require caching strategy
- **Single file focus** - Multi-file workflows deferred

### Trade-offs

- Chose explicit flags over query DSL for `select` (simpler to implement, document)
- Chose caching over real-time (better UX for repeated operations)
- Chose JSON + Tailwind over W3C format (higher adoption in target market)

## Verification

- [ ] All design schemas pass Zod validation tests
- [ ] Figma client handles rate limiting gracefully
- [ ] Alias system persists correctly
- [ ] Token output matches expected format
- [ ] Audit rules produce consistent results
- [ ] `--json` output parseable by jq
