# Action Plan: ax-cli Design Stabilizer

**Version:** 1.0
**Created:** 2025-12-13
**Timeline:** 4 weeks to MVP
**Status:** Ready for execution

---

## Executive Summary

Ship `ax design check` command in 4 weeks with 5 detection rules, eslint-style output, and CI integration.

```
Week 1: Foundation (config, scanner, color detection)
Week 2: Rules (spacing, a11y, inline styles)
Week 3: Output & CLI (reporters, flags, ignores)
Week 4: Polish & Ship (tests, docs, release)
```

---

## Week 1: Foundation

### Goal
Working color detection with console output

### Day 1-2: Project Setup

| Task | Owner | Deliverable |
|------|-------|-------------|
| Create directory structure | Dev | `packages/core/src/design-check/` |
| Define TypeScript interfaces | Dev | `types.ts` with Violation, Config, Result |
| Add dependencies | Dev | `glob`, `colord` in package.json |
| Create command skeleton | Dev | `ax design check` registered |

**Directory Structure:**
```
packages/core/src/design-check/
├── index.ts           # Main entry, orchestrator
├── types.ts           # TypeScript interfaces
├── config.ts          # Config loader
├── scanner.ts         # File discovery
├── rules/
│   ├── index.ts       # Rule runner
│   └── colors.ts      # First rule
└── reporter/
    └── console.ts     # ESLint-style output
```

**Interfaces to Define:**
```typescript
// types.ts
interface Violation {
  rule: string;
  severity: 'error' | 'warning';
  message: string;
  file: string;
  line: number;
  column: number;
  found: string;
  suggestion?: string;
}

interface DesignCheckConfig {
  tokens: {
    colors: Record<string, string>;
    spacing: Record<string, string>;
  };
  rules: Record<string, 'error' | 'warn' | 'off'>;
  include: string[];
  ignore: string[];
}

interface CheckResult {
  file: string;
  violations: Violation[];
}
```

### Day 3-4: Config Loader

| Task | Owner | Deliverable |
|------|-------|-------------|
| Config file discovery | Dev | Find `.ax-cli/design.json` |
| Config parsing | Dev | Load and validate JSON |
| Default config | Dev | Built-in fallback tokens |
| Config merging | Dev | CLI flags > project > user > defaults |

**Implementation:**
```typescript
// config.ts
export async function loadConfig(configPath?: string): Promise<DesignCheckConfig> {
  // 1. Check CLI-provided path
  // 2. Check .ax-cli/design.json
  // 3. Check ~/.ax-cli/design.json
  // 4. Return defaults
}

const DEFAULT_CONFIG: DesignCheckConfig = {
  tokens: {
    colors: {},  // Empty = report all hardcoded
    spacing: {
      '0': '0', 'px': '1px', 'xs': '4px', 'sm': '8px',
      'md': '16px', 'lg': '24px', 'xl': '32px'
    }
  },
  rules: {
    'no-hardcoded-colors': 'error',
    'no-raw-spacing': 'warn',
    'no-inline-styles': 'warn',
    'missing-alt-text': 'error',
    'missing-form-labels': 'error'
  },
  include: ['src/**/*.tsx', 'src/**/*.jsx', 'src/**/*.css'],
  ignore: ['**/node_modules/**', '**/*.test.*', '**/*.spec.*']
};
```

### Day 5: File Scanner

| Task | Owner | Deliverable |
|------|-------|-------------|
| Glob-based file discovery | Dev | Find matching files |
| Ignore pattern support | Dev | Exclude files by pattern |
| File reading | Dev | Load file contents |

**Implementation:**
```typescript
// scanner.ts
import { glob } from 'glob';

export async function scanFiles(
  paths: string[],
  include: string[],
  ignore: string[]
): Promise<string[]> {
  // Use glob to find files matching include patterns
  // Filter out files matching ignore patterns
  // Return absolute paths
}

export async function readFile(path: string): Promise<{
  path: string;
  content: string;
  lines: string[];
}> {
  // Read file, split into lines for location tracking
}
```

### Day 6-7: Color Detection Rule

| Task | Owner | Deliverable |
|------|-------|-------------|
| Hex color regex | Dev | Match #fff, #ffffff |
| RGB/RGBA regex | Dev | Match rgb(), rgba() |
| HSL/HSLA regex | Dev | Match hsl(), hsla() |
| Token matching | Dev | Map found colors to tokens |
| Location tracking | Dev | Line/column for each match |

**Implementation:**
```typescript
// rules/colors.ts
import { colord } from 'colord';

const HEX_REGEX = /#([0-9a-fA-F]{3,8})\b/g;
const RGB_REGEX = /rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+(?:\s*,\s*[\d.]+)?\s*\)/g;
const HSL_REGEX = /hsla?\(\s*\d+\s*,\s*[\d.]+%\s*,\s*[\d.]+%(?:\s*,\s*[\d.]+)?\s*\)/g;

export function checkColors(
  content: string,
  lines: string[],
  tokenColors: Record<string, string>
): Violation[] {
  const violations: Violation[] = [];

  // Find all color matches
  const matches = [
    ...findMatches(content, HEX_REGEX),
    ...findMatches(content, RGB_REGEX),
    ...findMatches(content, HSL_REGEX),
  ];

  for (const match of matches) {
    const token = findMatchingToken(match.value, tokenColors);
    if (!token) {
      violations.push({
        rule: 'no-hardcoded-colors',
        severity: 'error',
        message: `Hardcoded color '${match.value}'`,
        ...getLocation(content, match.index),
        found: match.value,
        suggestion: findNearestToken(match.value, tokenColors)
      });
    }
  }

  return violations;
}

function findNearestToken(color: string, tokens: Record<string, string>): string | undefined {
  // Use colord to find closest color in token map
}
```

### Week 1 Deliverable

```bash
$ ax design check src/

src/components/Hero.tsx
  15:12  error  Hardcoded color '#1e90ff'  no-hardcoded-colors

✖ 1 problem (1 error, 0 warnings)
```

---

## Week 2: Rules

### Goal
All 5 rules working

### Day 8-9: Spacing Detection

| Task | Owner | Deliverable |
|------|-------|-------------|
| CSS px value regex | Dev | Match `16px` in CSS |
| JSX style px regex | Dev | Match in style props |
| Tailwind arbitrary regex | Dev | Match `p-[16px]` |
| Scale validation | Dev | Check against spacing tokens |

**Implementation:**
```typescript
// rules/spacing.ts
const CSS_PX_REGEX = /:\s*(\d+)px/g;
const STYLE_PX_REGEX = /:\s*['"]?(\d+)px['"]?/g;
const TAILWIND_ARB_REGEX = /[pmwh](?:[trblxy])?-\[(\d+)px\]/g;

export function checkSpacing(
  content: string,
  lines: string[],
  spacingScale: Record<string, string>
): Violation[] {
  // Find px values not in spacing scale
  // Suggest nearest scale value
}
```

### Day 10-11: Accessibility Rules

| Task | Owner | Deliverable |
|------|-------|-------------|
| Missing alt text detection | Dev | `<img>` without alt |
| Missing form labels | Dev | `<input>` without label/aria-label |
| Self-closing tag handling | Dev | Handle JSX syntax |

**Implementation:**
```typescript
// rules/alt-text.ts
const IMG_REGEX = /<img\s+([^>]*)>/gi;
const ALT_ATTR_REGEX = /\balt\s*=/i;

export function checkAltText(content: string, lines: string[]): Violation[] {
  const violations: Violation[] = [];

  let match;
  while ((match = IMG_REGEX.exec(content)) !== null) {
    const attrs = match[1];
    if (!ALT_ATTR_REGEX.test(attrs)) {
      violations.push({
        rule: 'missing-alt-text',
        severity: 'error',
        message: 'Image missing alt attribute',
        ...getLocation(content, match.index),
        found: match[0].substring(0, 50) + '...'
      });
    }
  }

  return violations;
}

// rules/form-labels.ts
const INPUT_REGEX = /<input\s+([^>]*)>/gi;
const LABEL_ATTR_REGEX = /\b(aria-label|aria-labelledby|id)\s*=/i;

export function checkFormLabels(content: string, lines: string[]): Violation[] {
  // Check for inputs without associated labels
}
```

### Day 12: Inline Styles Rule

| Task | Owner | Deliverable |
|------|-------|-------------|
| Style prop detection | Dev | Find `style={{` in JSX |
| Severity as warning | Dev | Not blocking |

**Implementation:**
```typescript
// rules/inline-styles.ts
const STYLE_PROP_REGEX = /style\s*=\s*\{\{/g;

export function checkInlineStyles(content: string, lines: string[]): Violation[] {
  // Flag all style={{ occurrences
}
```

### Day 13-14: Rule Runner

| Task | Owner | Deliverable |
|------|-------|-------------|
| Rule orchestration | Dev | Run all rules per file |
| Severity filtering | Dev | Respect config settings |
| Result aggregation | Dev | Combine all violations |

**Implementation:**
```typescript
// rules/index.ts
import { checkColors } from './colors';
import { checkSpacing } from './spacing';
import { checkAltText } from './alt-text';
import { checkFormLabels } from './form-labels';
import { checkInlineStyles } from './inline-styles';

export function runRules(
  file: { path: string; content: string; lines: string[] },
  config: DesignCheckConfig
): Violation[] {
  const violations: Violation[] = [];

  if (config.rules['no-hardcoded-colors'] !== 'off') {
    violations.push(...checkColors(file.content, file.lines, config.tokens.colors));
  }

  if (config.rules['no-raw-spacing'] !== 'off') {
    violations.push(...checkSpacing(file.content, file.lines, config.tokens.spacing));
  }

  // ... other rules

  return violations.map(v => ({
    ...v,
    file: file.path,
    severity: config.rules[v.rule] === 'warn' ? 'warning' : v.severity
  }));
}
```

### Week 2 Deliverable

```bash
$ ax design check src/

src/components/Hero.tsx
  15:12  error  Hardcoded color '#1e90ff'           no-hardcoded-colors
  23:8   warn   Raw spacing '16px' → use 'md'       no-raw-spacing
  31:5   error  Image missing alt attribute         missing-alt-text

src/components/Form.tsx
  12:10  error  Input missing label                 missing-form-labels
  18:4   warn   Inline style detected               no-inline-styles

✖ 5 problems (3 errors, 2 warnings)
```

---

## Week 3: Output & CLI

### Goal
Full CLI with JSON output and ignore support

### Day 15-16: Console Reporter

| Task | Owner | Deliverable |
|------|-------|-------------|
| ESLint-style formatting | Dev | Familiar output format |
| Color coding | Dev | Red errors, yellow warnings |
| Summary line | Dev | Total count |
| Grouping by file | Dev | Violations under file headers |

**Implementation:**
```typescript
// reporter/console.ts
import chalk from 'chalk';

export function formatConsole(results: CheckResult[]): string {
  let output = '';
  let errorCount = 0;
  let warningCount = 0;

  for (const result of results) {
    if (result.violations.length === 0) continue;

    output += `\n${result.file}\n`;

    for (const v of result.violations) {
      const severity = v.severity === 'error'
        ? chalk.red('error')
        : chalk.yellow('warn');

      output += `  ${v.line}:${v.column}  ${severity}  ${v.message}  ${chalk.gray(v.rule)}\n`;

      if (v.severity === 'error') errorCount++;
      else warningCount++;
    }
  }

  output += `\n✖ ${errorCount + warningCount} problems (${errorCount} errors, ${warningCount} warnings)\n`;

  return output;
}
```

### Day 17: JSON Reporter

| Task | Owner | Deliverable |
|------|-------|-------------|
| Machine-readable output | Dev | Structured JSON |
| Summary stats | Dev | Counts in output |
| File list | Dev | All results |

**Implementation:**
```typescript
// reporter/json.ts
export function formatJson(results: CheckResult[]): string {
  const errors = results.flatMap(r => r.violations.filter(v => v.severity === 'error'));
  const warnings = results.flatMap(r => r.violations.filter(v => v.severity === 'warning'));

  return JSON.stringify({
    summary: {
      files: results.length,
      errors: errors.length,
      warnings: warnings.length
    },
    results: results.filter(r => r.violations.length > 0)
  }, null, 2);
}
```

### Day 18-19: CLI Flags

| Task | Owner | Deliverable |
|------|-------|-------------|
| `--format` flag | Dev | stylish, json |
| `--config` flag | Dev | Custom config path |
| `--quiet` flag | Dev | Errors only |
| `--max-warnings` flag | Dev | Warning threshold |
| `--ignore` flag | Dev | Additional ignores |
| `--rule` flag | Dev | Run specific rule |
| `--no-color` flag | Dev | Disable colors |

**Implementation:**
```typescript
// commands/design.ts
import { Command } from 'commander';

export function createDesignCommand(): Command {
  const cmd = new Command('design')
    .description('Design system tools');

  cmd.command('check [paths...]')
    .description('Check code for design system violations')
    .option('--format <type>', 'Output format: stylish, json', 'stylish')
    .option('--config <path>', 'Config file path')
    .option('--quiet', 'Only report errors')
    .option('--max-warnings <n>', 'Warning threshold', '-1')
    .option('--ignore <pattern>', 'Ignore pattern', collect, [])
    .option('--rule <id>', 'Run specific rule')
    .option('--no-color', 'Disable colors')
    .action(async (paths, options) => {
      // Main check logic
    });

  return cmd;
}
```

### Day 20-21: Ignore Support

| Task | Owner | Deliverable |
|------|-------|-------------|
| Config ignore patterns | Dev | From config file |
| CLI ignore patterns | Dev | From `--ignore` flag |
| Inline ignores | Dev | `// ax-ignore` comments |
| File-level ignores | Dev | `// ax-ignore-file` |

**Implementation:**
```typescript
// scanner.ts - Add ignore comment detection
const IGNORE_NEXT_LINE = /\/\/\s*ax-ignore-next-line(?:\s+(\S+))?/;
const IGNORE_FILE = /\/\/\s*ax-ignore-file/;

export function filterIgnoredViolations(
  violations: Violation[],
  lines: string[]
): Violation[] {
  // Check for ax-ignore-file at top of file
  if (lines.slice(0, 5).some(l => IGNORE_FILE.test(l))) {
    return [];
  }

  // Check for ax-ignore-next-line before each violation
  return violations.filter(v => {
    if (v.line <= 1) return true;
    const prevLine = lines[v.line - 2];
    const match = prevLine.match(IGNORE_NEXT_LINE);
    if (!match) return true;
    // If specific rule mentioned, only ignore that rule
    if (match[1] && match[1] !== v.rule) return true;
    return false;
  });
}
```

### Week 3 Deliverable

```bash
$ ax design check src/ --format json
{
  "summary": { "files": 2, "errors": 3, "warnings": 2 },
  "results": [...]
}

$ ax design check src/ --quiet
src/components/Hero.tsx
  15:12  error  Hardcoded color '#1e90ff'  no-hardcoded-colors

$ ax design check src/ --ignore "**/*.stories.tsx"
# Stories files excluded
```

---

## Week 4: Polish & Ship

### Goal
Production-ready release

### Day 22-23: Testing

| Task | Owner | Deliverable |
|------|-------|-------------|
| Unit tests for each rule | Dev | 80%+ coverage |
| Integration tests | Dev | End-to-end CLI tests |
| Fixture files | Dev | Test input samples |
| Edge case tests | Dev | Malformed input handling |

**Test Structure:**
```
tests/design-check/
├── rules/
│   ├── colors.test.ts
│   ├── spacing.test.ts
│   ├── alt-text.test.ts
│   ├── form-labels.test.ts
│   └── inline-styles.test.ts
├── config.test.ts
├── scanner.test.ts
├── reporter.test.ts
└── fixtures/
    ├── valid-component.tsx
    ├── violations-component.tsx
    └── config-samples/
```

**Example Test:**
```typescript
// tests/design-check/rules/colors.test.ts
import { describe, it, expect } from 'vitest';
import { checkColors } from '../../../src/design-check/rules/colors';

describe('checkColors', () => {
  it('detects hex colors', () => {
    const content = `const color = '#1e90ff';`;
    const violations = checkColors(content, [content], {});
    expect(violations).toHaveLength(1);
    expect(violations[0].found).toBe('#1e90ff');
  });

  it('allows configured tokens', () => {
    const content = `const color = '#1e90ff';`;
    const violations = checkColors(content, [content], { primary: '#1e90ff' });
    expect(violations).toHaveLength(0);
  });

  it('suggests nearest token', () => {
    const content = `const color = '#1e90fe';`; // Close to #1e90ff
    const violations = checkColors(content, [content], { primary: '#1e90ff' });
    expect(violations[0].suggestion).toBe('primary');
  });
});
```

### Day 24-25: Documentation

| Task | Owner | Deliverable |
|------|-------|-------------|
| README section | Dev | Usage documentation |
| Config schema | Dev | JSON schema for IDE support |
| CI examples | Dev | GitHub Actions, GitLab CI |
| Rule documentation | Dev | Each rule explained |

**README Section:**
```markdown
## Design Check

Check your code for design system violations.

### Quick Start

```bash
# Check all files in src/
ax design check

# Check specific files
ax design check src/components/

# Auto-fix safe violations
ax design check --fix

# Output JSON for CI
ax design check --format json
```

### Configuration

Create `.ax-cli/design.json`:

```json
{
  "tokens": {
    "colors": {
      "primary": "#1e90ff",
      "secondary": "#ff6b6b"
    },
    "spacing": {
      "sm": "8px",
      "md": "16px",
      "lg": "24px"
    }
  },
  "rules": {
    "no-hardcoded-colors": "error",
    "no-raw-spacing": "warn"
  }
}
```

### Rules

| Rule | Description | Auto-fix |
|------|-------------|----------|
| `no-hardcoded-colors` | Detects hardcoded color values | Yes |
| `no-raw-spacing` | Detects raw pixel values | Yes |
| `no-inline-styles` | Flags inline style props | No |
| `missing-alt-text` | Images without alt | No |
| `missing-form-labels` | Inputs without labels | No |

### Ignoring Violations

```tsx
// Ignore next line
// ax-ignore-next-line no-hardcoded-colors
const debugColor = '#ff0000';

// Ignore entire file
// ax-ignore-file
```
```

### Day 26: Error Handling & Edge Cases

| Task | Owner | Deliverable |
|------|-------|-------------|
| Graceful file read errors | Dev | Skip and continue |
| Large file handling | Dev | Size limit, warning |
| Binary file detection | Dev | Skip non-text files |
| Empty file handling | Dev | No errors |

**Implementation:**
```typescript
// scanner.ts
const MAX_FILE_SIZE = 1024 * 1024; // 1MB

export async function readFileSafe(path: string): Promise<FileContent | null> {
  try {
    const stats = await fs.stat(path);
    if (stats.size > MAX_FILE_SIZE) {
      console.warn(`Skipping ${path}: file too large (${stats.size} bytes)`);
      return null;
    }

    const content = await fs.readFile(path, 'utf-8');

    // Check for binary content
    if (content.includes('\0')) {
      return null;
    }

    return {
      path,
      content,
      lines: content.split('\n')
    };
  } catch (error) {
    console.warn(`Skipping ${path}: ${error.message}`);
    return null;
  }
}
```

### Day 27-28: Release

| Task | Owner | Deliverable |
|------|-------|-------------|
| Version bump | Dev | Update package.json |
| Changelog entry | Dev | Document new feature |
| Build verification | Dev | Clean build passes |
| Publish | Dev | npm publish |
| Announcement | Marketing | Blog post / tweet |

---

## Milestone Checklist

### Week 1 Complete ✓
- [ ] Directory structure created
- [ ] TypeScript interfaces defined
- [ ] Config loader working
- [ ] File scanner working
- [ ] Color detection working
- [ ] Console output working

### Week 2 Complete ✓
- [ ] Spacing detection working
- [ ] Alt text detection working
- [ ] Form labels detection working
- [ ] Inline styles detection working
- [ ] Rule runner orchestrating all rules

### Week 3 Complete ✓
- [ ] JSON output working
- [ ] All CLI flags working
- [ ] Ignore patterns working
- [ ] Inline ignores working
- [ ] Exit codes correct

### Week 4 Complete ✓
- [ ] Unit tests passing (80%+ coverage)
- [ ] Integration tests passing
- [ ] Documentation complete
- [ ] Error handling robust
- [ ] Published to npm

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation | Owner |
|------|------------|--------|------------|-------|
| Regex misses edge cases | High | Medium | Start conservative, iterate | Dev |
| False positives | Medium | High | Report-only default | Dev |
| Performance on large repos | Low | Medium | File size limits | Dev |
| Scope creep | Medium | High | Strict MVP scope | PM |

---

## Dependencies

### Internal
- `packages/core/src/commands/` — CLI framework
- `packages/core/src/utils/` — Settings manager

### External (New)
- `glob` — File discovery
- `colord` — Color parsing

### Development
- `vitest` — Testing (existing)

---

## Success Criteria

### MVP Launch (Week 4)
- [ ] `ax design check` command available
- [ ] 5 rules detecting violations
- [ ] CI integration documented
- [ ] <3s performance on 100 files
- [ ] <10% false positive rate

### Post-Launch (Week 5-8)
- [ ] 100+ weekly active users
- [ ] <5 critical bugs reported
- [ ] Auto-fix feature shipped (Phase 2)

---

## Team & Ownership

| Role | Responsibility |
|------|----------------|
| Dev Lead | Architecture decisions, code review |
| Developer | Implementation, testing |
| PM | Scope management, user feedback |
| DevRel | Documentation, examples |

---

## Communication

| Event | Frequency | Channel |
|-------|-----------|---------|
| Daily standup | Daily | Slack |
| Week review | Weekly | Meeting |
| Blocker escalation | As needed | Direct |

---

## Appendix: File Templates

### Config Template
```json
{
  "$schema": "https://ax-cli.dev/schemas/design-check.json",
  "tokens": {
    "colors": {},
    "spacing": {}
  },
  "rules": {
    "no-hardcoded-colors": "error",
    "no-raw-spacing": "warn",
    "no-inline-styles": "warn",
    "missing-alt-text": "error",
    "missing-form-labels": "error"
  },
  "include": ["src/**/*.tsx", "src/**/*.css"],
  "ignore": ["**/node_modules/**"]
}
```

### GitHub Actions Template
```yaml
name: Design Check
on: [pull_request]

jobs:
  design-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm install -g @defai.digital/ax-cli
      - run: ax design check --format json > report.json
        continue-on-error: true
      - name: Upload Report
        uses: actions/upload-artifact@v4
        with:
          name: design-check-report
          path: report.json
```

---

**End of Action Plan**
