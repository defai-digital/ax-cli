# Product Requirements Document (PRD)

## ax-cli Design Stabilizer

**Version:** 2.0 (Lean Edition)
**Date:** 2025-12-13
**Status:** Final

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem & Opportunity](#2-problem--opportunity)
3. [Goals & Success Metrics](#3-goals--success-metrics)
4. [Target Users](#4-target-users)
5. [Core User Stories](#5-core-user-stories)
6. [Product Scope](#6-product-scope)
7. [Functional Requirements](#7-functional-requirements)
8. [Technical Architecture](#8-technical-architecture)
9. [CLI Interface](#9-cli-interface)
10. [Configuration](#10-configuration)
11. [Security & Safety](#11-security--safety)
12. [Implementation Plan](#12-implementation-plan)
13. [Risks & Mitigations](#13-risks--mitigations)
14. [Future Roadmap](#14-future-roadmap)
15. [Appendix](#15-appendix)

---

## 1. Executive Summary

### 1.1 One-Sentence Vision

> **ax-cli stabilizes AI-generated UI into production-ready code with fast, low-noise token enforcement and accessibility checks.**

### 1.2 Key Insight

AI design tools (Google AI Studio, Antigravity, v0, Figma AI) generate code that engineers **cannot merge directly**. The gap between "AI-generated" and "production-ready" is permanent—creative tools optimize for speed, not governance.

### 1.3 Our Position

| AI Tools | ax-cli |
|----------|--------|
| Creative, fast, messy | Deterministic, verifiable |
| No repo awareness | Design system aware |
| Speed over safety | Safety over speed |

**ax-cli is the "merge gate" for AI-generated UI.**

### 1.4 Scope Philosophy

**Ship fast. Stay lean. Add complexity only when noise emerges.**

- MVP in **4 weeks**, not 16
- **5 rules**, not 50
- **Report-only** by default
- **No Playwright** until proven need
- **No governance** until enterprise customers ask

---

## 2. Problem & Opportunity

### 2.1 The Pain

AI-generated UI contains:
- Hardcoded colors (`#1e90ff` instead of `tokens.primary`)
- Raw pixel values (`padding: 16px` instead of `spacing.md`)
- Missing accessibility attributes
- Inconsistent with existing patterns
- Unnecessary code bloat

**Engineers spend hours cleaning this up manually.**

### 2.2 Current Workflow (Broken)

```
AI Tool → Generated Code → Manual Review → Manual Cleanup → PR
                              ↑
                         (1-2 hours)
```

### 2.3 Target Workflow (Fixed)

```
AI Tool → Generated Code → ax design check → Clean PR
                              ↑
                         (<30 seconds)
```

### 2.4 Why This Opportunity Is Defensible

Google/Figma/Antigravity will NOT build:
- Design system enforcement (every org is different)
- Minimal diff generation (not their problem)
- CI-integrated governance (enterprise complexity)

**This gap is structural, not temporary.**

---

## 3. Goals & Success Metrics

### 3.1 MVP Goals (Phase 1)

| Goal | Description |
|------|-------------|
| G1 | Detect token violations in AI-generated code |
| G2 | Provide actionable fix suggestions |
| G3 | Integrate into CI/PR workflow |
| G4 | Ship in 4 weeks |

### 3.2 Success Metrics

| Metric | Target | How |
|--------|--------|-----|
| Time to first value | <5 minutes setup | User testing |
| Check latency | <3 seconds | CLI telemetry |
| False positive rate | <10% | User feedback |
| Weekly active users | 100+ in month 1 | Telemetry |

### 3.3 Explicit Non-Goals (MVP)

- ❌ Visual screenshot verification
- ❌ Enterprise governance/audit trails
- ❌ Full axe-core runtime scanning
- ❌ Multi-framework support (Vue, Svelte)
- ❌ Auto-fix by default

---

## 4. Target Users

### 4.1 Primary: Frontend Engineer

**Profile:** Uses AI tools for prototyping, maintains design system compliance

**Pain:** "AI generates code fast but I spend an hour fixing hardcoded values"

**Need:** Fast, low-noise feedback in PR workflow

**Quote:** *"Just tell me what's wrong and where. I'll fix it."*

### 4.2 Secondary: Design System Lead

**Profile:** Maintains org-wide design tokens, reviews PRs for DS compliance

**Pain:** "AI tools completely ignore our token system"

**Need:** Automated enforcement of token usage

**Quote:** *"I need a way to catch violations before they're merged."*

---

## 5. Core User Stories

### US-1: Check AI-Generated Code (P0)

**As a** frontend engineer
**I want to** check AI-generated code for token violations
**So that** I know what needs fixing before PR

**Acceptance Criteria:**
- [ ] Runs in <3 seconds on typical component
- [ ] Reports violations with file:line location
- [ ] Shows what value was found vs what token to use
- [ ] Returns exit code 1 if violations found

---

### US-2: CI Integration (P0)

**As a** frontend engineer
**I want to** run checks in CI
**So that** violations block PRs automatically

**Acceptance Criteria:**
- [ ] Works in GitHub Actions / GitLab CI
- [ ] Outputs machine-readable JSON
- [ ] Exit codes: 0 (pass), 1 (violations), 2 (error)

---

### US-3: Configure Design Tokens (P0)

**As a** design system lead
**I want to** configure my team's design tokens
**So that** checks match our design system

**Acceptance Criteria:**
- [ ] Define color tokens with hex values
- [ ] Define spacing scale
- [ ] Config file in repo (`.ax-cli/config.json`)

---

### US-4: Ignore Patterns (P1)

**As a** frontend engineer
**I want to** ignore certain files or patterns
**So that** I don't get noise from irrelevant code

**Acceptance Criteria:**
- [ ] Glob patterns in config
- [ ] Inline `// ax-ignore` comments
- [ ] Per-rule ignore capability

---

### US-5: Auto-Fix Simple Violations (P1)

**As a** frontend engineer
**I want to** auto-fix safe violations
**So that** I don't have to fix them manually

**Acceptance Criteria:**
- [ ] Opt-in with `--fix` flag
- [ ] Only fixes high-confidence replacements
- [ ] Creates backup before modifying
- [ ] Reports what was fixed

---

### US-6: Token Coverage Report (P1)

**As a** design system lead
**I want to** see what % of code uses tokens
**So that** I can track DS adoption

**Acceptance Criteria:**
- [ ] Shows tokenized vs hardcoded count
- [ ] Percentage coverage metric
- [ ] Trend over time (optional)

---

## 6. Product Scope

### 6.1 In Scope (MVP)

| Feature | Priority | Description |
|---------|----------|-------------|
| Token detection | P0 | Detect hardcoded colors, spacing |
| Violation reporting | P0 | File:line, found vs expected |
| CLI command | P0 | `ax design check` |
| CI exit codes | P0 | Pass/fail for automation |
| JSON output | P0 | Machine-readable results |
| Config file | P0 | Design token definitions |
| Ignore patterns | P1 | Skip files/rules |
| Auto-fix | P1 | Opt-in `--fix` flag |
| A11y basics | P1 | Missing alt, missing labels |
| Coverage report | P1 | Token usage percentage |

### 6.2 Out of Scope (MVP)

| Feature | Reason | When |
|---------|--------|------|
| Playwright screenshots | Infra complexity, uncertain value | Phase 2 if requested |
| Full axe-core runtime | Requires render harness | Phase 2 |
| Enterprise governance | Premature, no customers | Phase 3 |
| Audit trails | Over-scoped for MVP | Phase 3 |
| Vue/Svelte support | Focus on React first | Phase 2 |
| Policy enforcement | Enterprise feature | Phase 3 |
| Visual diff | High complexity | Phase 2+ |

### 6.3 Supported Input

**Phase 1:**
- React (JSX/TSX)
- CSS files
- Tailwind classes
- Inline styles

**Later:**
- Vue SFC
- Svelte
- CSS-in-JS (styled-components, Emotion)

---

## 7. Functional Requirements

### 7.1 Detection Rules (MVP: 5 rules)

| Rule ID | Description | Severity | Auto-fix |
|---------|-------------|----------|----------|
| `no-hardcoded-colors` | Detect hex/rgb/hsl not in token map | error | Yes |
| `no-raw-spacing` | Detect px values not in spacing scale | warning | Yes |
| `no-inline-styles` | Flag inline style props | warning | No |
| `missing-alt-text` | Images without alt attribute | error | No |
| `missing-form-labels` | Inputs without associated label | error | No |

### 7.2 Detection Logic

#### Color Detection
```
Patterns to detect:
- Hex: #fff, #ffffff, #ffffffff
- RGB: rgb(255, 255, 255), rgba(255, 255, 255, 0.5)
- HSL: hsl(0, 0%, 100%), hsla(0, 0%, 100%, 0.5)

Locations to check:
- JSX style props: style={{ color: '#fff' }}
- CSS declarations: color: #fff;
- Tailwind arbitrary: text-[#fff], bg-[#1e90ff]
```

#### Spacing Detection
```
Patterns to detect:
- Raw px: 16px, 24px (not in scale)
- Arbitrary Tailwind: p-[16px], m-[24px]

Allowed (configurable):
- 0, 1px (borders)
- Values in spacing scale
```

### 7.3 Output Requirements

#### Console Output (Human)
```
ax design check

src/components/Hero.tsx
  15:12  error  Hardcoded color '#1e90ff' → use 'primary'     no-hardcoded-colors
  23:8   warn   Raw spacing '16px' → use 'md' (16px)          no-raw-spacing
  31:5   error  Image missing alt attribute                   missing-alt-text

src/components/Button.tsx
  8:15   warn   Inline style detected                         no-inline-styles

✖ 4 problems (2 errors, 2 warnings)
```

#### JSON Output (Machine)
```json
{
  "summary": {
    "files": 2,
    "errors": 2,
    "warnings": 2
  },
  "results": [
    {
      "file": "src/components/Hero.tsx",
      "violations": [
        {
          "rule": "no-hardcoded-colors",
          "severity": "error",
          "line": 15,
          "column": 12,
          "message": "Hardcoded color '#1e90ff' → use 'primary'",
          "found": "#1e90ff",
          "suggestion": "tokens.color.primary"
        }
      ]
    }
  ]
}
```

### 7.4 Exit Codes

| Code | Meaning |
|------|---------|
| 0 | No violations (or warnings only with `--max-warnings`) |
| 1 | Violations found |
| 2 | Configuration/runtime error |

---

## 8. Technical Architecture

### 8.1 Design Principles

1. **Simple over clever** — Regex before AST, string before parse tree
2. **Fast over complete** — <3s latency, skip edge cases
3. **Safe over aggressive** — Report-only default, opt-in fixes
4. **Graceful degradation** — Per-file failures don't abort run

### 8.2 Architecture (Lean)

```
┌─────────────────────────────────────────────────────────┐
│                    ax design check                       │
├─────────────────────────────────────────────────────────┤
│  ┌──────────┐   ┌──────────┐   ┌──────────┐            │
│  │  Config  │ → │  Scan    │ → │  Report  │            │
│  │  Loader  │   │  Engine  │   │  Writer  │            │
│  └──────────┘   └──────────┘   └──────────┘            │
│                      │                                  │
│              ┌───────┴───────┐                         │
│              │    Rules      │                         │
│              │  (5 rules)    │                         │
│              └───────────────┘                         │
└─────────────────────────────────────────────────────────┘
```

**No intermediate representations. No complex pipelines.**

### 8.3 File Structure (Minimal)

```
packages/core/src/
├── design-check/
│   ├── index.ts           # Main orchestrator
│   ├── config.ts          # Config loader
│   ├── scanner.ts         # File scanner
│   ├── rules/
│   │   ├── index.ts       # Rule runner
│   │   ├── colors.ts      # no-hardcoded-colors
│   │   ├── spacing.ts     # no-raw-spacing
│   │   ├── inline-styles.ts
│   │   ├── alt-text.ts
│   │   └── form-labels.ts
│   ├── reporter/
│   │   ├── console.ts     # Human output
│   │   └── json.ts        # Machine output
│   └── fixer.ts           # Auto-fix (opt-in)
└── commands/
    └── design.ts          # CLI command
```

### 8.4 Detection Strategy

**For MVP, use regex/string matching. Add AST only if accuracy requires it.**

#### Color Detection (Regex)
```typescript
const HEX_COLOR = /#([0-9a-fA-F]{3,8})\b/g;
const RGB_COLOR = /rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+/g;
const HSL_COLOR = /hsla?\(\s*\d+\s*,\s*[\d.]+%\s*,\s*[\d.]+%/g;

function detectColors(content: string): Match[] {
  return [
    ...content.matchAll(HEX_COLOR),
    ...content.matchAll(RGB_COLOR),
    ...content.matchAll(HSL_COLOR),
  ].map(m => ({ value: m[0], index: m.index }));
}
```

#### Spacing Detection (Regex)
```typescript
const RAW_PX = /:\s*(\d+)px/g;  // In CSS
const TAILWIND_ARBITRARY = /[pmwh]-\[(\d+)px\]/g;  // In className

function detectSpacing(content: string, scale: string[]): Match[] {
  // Return only values NOT in the spacing scale
}
```

#### A11y Detection (Regex + Simple Parse)
```typescript
const IMG_WITHOUT_ALT = /<img(?![^>]*\balt\b)[^>]*>/gi;
const INPUT_WITHOUT_LABEL = /<input(?![^>]*\baria-label)[^>]*>/gi;
```

### 8.5 Dependencies (Minimal)

| Package | Purpose | Size |
|---------|---------|------|
| `glob` | File discovery | Tiny |
| `colord` | Color parsing/matching | 3KB |
| None | Regex for detection | 0 |

**No ts-morph, no postcss, no recast for MVP.**

Add complexity only when regex proves insufficient.

### 8.6 Performance Targets

| Metric | Target |
|--------|--------|
| Single file | <100ms |
| 100 files | <3s |
| Memory | <100MB |

---

## 9. CLI Interface

### 9.1 Command: `ax design check`

```
USAGE
  $ ax design check [paths...] [options]

ARGUMENTS
  paths    Files or directories to check (default: src/)

OPTIONS
  --fix              Auto-fix safe violations
  --format <type>    Output format: stylish (default), json
  --config <path>    Config file path
  --max-warnings <n> Exit 0 if warnings ≤ n (default: -1, no limit)
  --quiet            Only report errors, not warnings
  --ignore <glob>    Ignore pattern (can repeat)
  --rule <id>        Run only specific rule
  --no-color         Disable colored output

EXAMPLES
  $ ax design check
  $ ax design check src/components/
  $ ax design check --fix
  $ ax design check --format json > report.json
  $ ax design check --ignore "**/*.test.tsx"

EXIT CODES
  0    No errors (warnings may exist)
  1    Errors found
  2    Configuration or runtime error
```

### 9.2 Example Output

```
$ ax design check src/

src/components/Hero.tsx
  15:12  error  Hardcoded color '#1e90ff' → use 'primary'  no-hardcoded-colors
  23:8   warn   Raw spacing '16px' → use 'md'              no-raw-spacing

src/components/Card.tsx
  8:20   error  Image missing alt text                     missing-alt-text

✖ 3 problems (2 errors, 1 warning)

Run with --fix to auto-fix 2 problems.
```

### 9.3 CI Usage

```yaml
# GitHub Actions
- name: Design Check
  run: ax design check --format json > design-report.json

- name: Comment on PR
  if: failure()
  uses: actions/github-script@v6
  with:
    script: |
      const report = require('./design-report.json');
      // Format and post comment
```

---

## 10. Configuration

### 10.1 Config File: `.ax-cli/design.json`

```json
{
  "$schema": "https://ax-cli.dev/schemas/design-check.json",

  "tokens": {
    "colors": {
      "primary": "#1e90ff",
      "secondary": "#ff6b6b",
      "background": "#ffffff",
      "text": "#212121",
      "text-muted": "#757575"
    },
    "spacing": {
      "xs": "4px",
      "sm": "8px",
      "md": "16px",
      "lg": "24px",
      "xl": "32px"
    }
  },

  "rules": {
    "no-hardcoded-colors": "error",
    "no-raw-spacing": "warn",
    "no-inline-styles": "warn",
    "missing-alt-text": "error",
    "missing-form-labels": "error"
  },

  "ignore": [
    "**/node_modules/**",
    "**/*.test.tsx",
    "**/stories/**"
  ],

  "include": [
    "src/**/*.tsx",
    "src/**/*.css"
  ]
}
```

### 10.2 Inline Ignores

```tsx
// ax-ignore-next-line no-hardcoded-colors
const debugColor = '#ff0000';

// ax-ignore-file (ignores entire file)
```

### 10.3 Config Resolution

1. CLI flags (highest priority)
2. `.ax-cli/design.json` (project)
3. `~/.ax-cli/design.json` (user)
4. Built-in defaults

---

## 11. Security & Safety

### 11.1 Safety Defaults

| Feature | Default | Override |
|---------|---------|----------|
| Auto-fix | OFF | `--fix` |
| File writes | OFF | `--fix` |
| Backup before fix | ON | `--no-backup` |

### 11.2 Fix Safety

```typescript
// Before any file modification:
1. Create backup: file.tsx.ax-backup
2. Validate fix is safe (no side effects)
3. Write modified file
4. Report what changed

// On error:
1. Restore from backup
2. Report failure
3. Continue with next file
```

### 11.3 Input Validation

- Max file size: 1MB
- Max files per run: 10,000
- Timeout per file: 5s
- Graceful skip on parse errors

---

## 12. Implementation Plan

### 12.1 Phase 1: MVP (4 weeks)

**Goal:** Ship usable `ax design check` command

**Week 1-2: Core Detection**
- [ ] Config loader with token definitions
- [ ] File scanner (glob-based)
- [ ] Color detection (regex)
- [ ] Spacing detection (regex)
- [ ] Console reporter (eslint-style)

**Week 3: Rules & Output**
- [ ] no-inline-styles rule
- [ ] missing-alt-text rule
- [ ] missing-form-labels rule
- [ ] JSON reporter
- [ ] Exit codes

**Week 4: Polish**
- [ ] Ignore patterns
- [ ] Inline ignores
- [ ] CLI help/docs
- [ ] Basic tests
- [ ] README/examples

**Deliverable:** `ax design check` working in CI

---

### 12.2 Phase 2: Enhancement (4 weeks)

**Goal:** Auto-fix and coverage metrics

- [ ] Auto-fix for colors
- [ ] Auto-fix for spacing
- [ ] Token coverage report
- [ ] Config validation with schema
- [ ] More ignore granularity
- [ ] Performance optimization

---

### 12.3 Phase 3: Expansion (Future)

**Only if Phase 1-2 succeed and users request:**

- Visual verification (Playwright)
- Full axe-core integration
- Vue/Svelte support
- Enterprise governance
- Audit trails

---

## 13. Risks & Mitigations

### 13.1 Technical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Regex misses edge cases | High | Medium | Start conservative, expand patterns |
| False positives frustrate users | Medium | High | Report-only default, easy ignores |
| Auto-fix breaks code | Low | High | Backup + opt-in only |
| Performance on large repos | Low | Medium | Streaming, file limits |

### 13.2 Product Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Low adoption | Medium | High | Fast setup, immediate value |
| Users want features we cut | Medium | Medium | Feedback loop, Phase 2 |
| Competitors ship similar | Low | Medium | Move fast, own governance niche |

### 13.3 Mitigation Strategies

**For false positives:**
- Default to warnings, not errors
- Easy inline ignores
- Per-rule configuration
- Clear feedback channel

**For accuracy:**
- Start with high-confidence patterns
- Track false positive rate
- Iterate based on feedback

---

## 14. Future Roadmap

### 14.1 Near-Term (Phase 2-3)

| Feature | Trigger | Complexity |
|---------|---------|------------|
| Auto-fix | MVP success | Low |
| Token coverage metrics | User request | Low |
| More a11y rules | User request | Medium |
| Tailwind v4 support | Adoption | Low |
| Custom rules | Enterprise request | Medium |

### 14.2 Medium-Term

| Feature | Trigger | Complexity |
|---------|---------|------------|
| Visual verification | Multiple requests | High |
| Vue/Svelte support | Demand | Medium |
| PR comments bot | CI adoption | Medium |

### 14.3 Long-Term (Enterprise)

| Feature | Trigger | Complexity |
|---------|---------|------------|
| Governance policies | Enterprise sales | High |
| Audit trails | Compliance requests | High |
| Dashboard | Scale | High |

---

## 15. Appendix

### 15.1 Comparison: Original vs Lean PRD

| Aspect | Original | Lean |
|--------|----------|------|
| Timeline | 16 weeks, 5 phases | 4 weeks, 1 phase |
| Rules | 50+ via constraint engine | 5 hardcoded rules |
| Detection | Full AST (ts-morph) | Regex/string |
| Screenshots | Phase 3 | Cut entirely |
| Governance | Phase 4 | Cut entirely |
| Dependencies | 10+ packages | 2 packages |
| Data structures | Complex (UiStructure) | Simple (violations array) |
| Auto-fix | Default | Opt-in |

### 15.2 What We Cut (And Why)

| Cut Feature | Reason |
|-------------|--------|
| Playwright screenshots | High infra complexity, uncertain value |
| Full axe-core runtime | Requires render harness |
| UiStructure IR | Over-abstraction for MVP |
| Constraint registry | 5 rules don't need registry |
| ts-morph/recast | Regex sufficient for MVP |
| Unified diff patches | Simple file writes easier |
| Governance/audit | Premature, no customers |
| Multi-framework | Focus on React first |

### 15.3 Decision Log

| Decision | Options | Choice | Rationale |
|----------|---------|--------|-----------|
| Detection method | AST vs Regex | Regex | Simpler, faster, good enough for 80% |
| Default mode | Fix vs Report | Report | Safety, trust building |
| First framework | React vs All | React | Largest user base |
| Timeline | 16w vs 4w | 4w | Ship fast, learn fast |

### 15.4 Example Token Configuration

```json
{
  "tokens": {
    "colors": {
      "primary": "#1e90ff",
      "primary-dark": "#1a75d4",
      "secondary": "#ff6b6b",
      "success": "#4caf50",
      "warning": "#ff9800",
      "error": "#f44336",
      "background": "#ffffff",
      "surface": "#f5f5f5",
      "text": "#212121",
      "text-secondary": "#757575"
    },
    "spacing": {
      "0": "0",
      "px": "1px",
      "xs": "4px",
      "sm": "8px",
      "md": "16px",
      "lg": "24px",
      "xl": "32px",
      "2xl": "48px"
    }
  }
}
```

### 15.5 CI Integration Examples

**GitHub Actions:**
```yaml
name: Design Check
on: [pull_request]

jobs:
  design-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm install -g @defai.digital/ax-cli
      - run: ax design check --format json > report.json
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: design-report
          path: report.json
```

**GitLab CI:**
```yaml
design-check:
  script:
    - npm install -g @defai.digital/ax-cli
    - ax design check
  rules:
    - changes:
        - src/**/*.tsx
        - src/**/*.css
```

### 15.6 Glossary

| Term | Definition |
|------|------------|
| Token | Design system value (color, spacing) |
| Violation | Code that doesn't use tokens |
| Rule | Detection logic for a violation type |
| Fix | Automated correction of a violation |
| Coverage | % of code using tokens vs hardcoded |

---

## Document History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-12-13 | Initial draft (over-scoped) |
| 2.0 | 2025-12-13 | Lean edition after agent review |

---

## Review Feedback Incorporated

**From Architecture Agent:**
- Cut to 2-phase plan
- Limit to 2-3 core constraint types
- Dry-run mode with clear summaries
- CI integration as first-class
- Token coverage report

**From Frontend Agent:**
- Fast feedback (<3s)
- Low noise, easy ignores
- Report-only default
- Support multiple style paradigms
- Focus on token/spacing enforcement first

**From Backend Agent:**
- Drop AST stack for MVP
- Skip ts-morph/recast
- Simple regex detection
- No intermediate representations
- Whole-file replacement over unified diffs

**From Quality Agent:**
- Per-file soft-fail
- Backup before fix
- Report-only as default
- Clear "applied/failed/skipped" status
- Graceful degradation on parse errors

---

**End of Document**
