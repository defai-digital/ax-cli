# Design Check

The `design check` command helps maintain design system consistency by detecting violations in your codebase.

## Features

- **Color Token Enforcement**: Detects hardcoded hex, RGB, and HSL color values
- **Spacing Token Enforcement**: Detects raw pixel values for spacing properties
- **Accessibility Checks**: Detects missing alt text and form labels
- **Inline Style Detection**: Warns about inline style usage
- **Auto-fix Support**: Automatically fix spacing and color violations
- **Ignore Support**: File-level and inline ignore comments
- **CI Integration**: JSON output and exit codes for automation

## Quick Start

```bash
# Initialize config (creates .ax-cli/design.json)
ax design init

# Run check on src directory
ax design check

# Run with auto-fix
ax design check --fix

# JSON output for CI
ax design check --format json
```

## Configuration

Create `.ax-cli/design.json` in your project root:

```json
{
  "$schema": "https://ax-cli.dev/schemas/design-check.json",
  "tokens": {
    "colors": {
      "primary": "#1e90ff",
      "secondary": "#ff6b6b",
      "success": "#4caf50",
      "warning": "#ff9800",
      "error": "#f44336",
      "background": "#ffffff",
      "text": "#212121"
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
  "include": ["src/**/*.tsx", "src/**/*.jsx", "src/**/*.css"],
  "ignore": [
    "**/node_modules/**",
    "**/*.test.*",
    "**/*.spec.*",
    "**/stories/**"
  ]
}
```

## Rules

| Rule | Description | Fixable |
|------|-------------|---------|
| `no-hardcoded-colors` | Detects hardcoded hex, RGB, HSL colors | Yes (exact token match) |
| `no-raw-spacing` | Detects raw pixel values in spacing properties | Yes (within 4px tolerance) |
| `no-inline-styles` | Detects inline style props in JSX/HTML | No |
| `missing-alt-text` | Detects images without alt attributes | No |
| `missing-form-labels` | Detects form inputs without labels | No |

### Rule Severities

- `error` - Fails the check (exit code 1)
- `warn` - Reports warning but doesn't fail
- `off` - Disables the rule

## CLI Options

```bash
ax design check [paths...] [options]

Options:
  --format <type>      Output format: stylish, json (default: "stylish")
  --config <path>      Path to config file
  -q, --quiet          Only report errors, not warnings
  --max-warnings <n>   Exit with error if warnings exceed threshold
  --ignore <pattern>   Ignore pattern (can be repeated)
  --rule <id>          Run only specific rule
  --no-color           Disable colored output
  --fix                Auto-fix violations
  --list-rules         List available rules
```

### Examples

```bash
# Check specific files
ax design check src/components/Button.tsx src/pages/Home.tsx

# Ignore additional patterns
ax design check --ignore "**/legacy/**" --ignore "**/vendor/**"

# Run only color rule
ax design check --rule no-hardcoded-colors

# Fail if more than 10 warnings
ax design check --max-warnings 10

# Get JSON output
ax design check --format json > results.json
```

## Ignore Comments

### Ignore Next Line

```tsx
// ax-ignore-next-line
const color = '#ff0000'; // This line is ignored

// ax-ignore-next-line no-hardcoded-colors
const primary = '#1e90ff'; // Only color rule ignored
```

### Ignore Entire File

Add at the top of the file:

```tsx
// ax-ignore-file
```

Or ignore specific rules:

```tsx
// ax-ignore-file no-hardcoded-colors
```

## Auto-fix

The `--fix` flag automatically fixes violations:

```bash
ax design check --fix
```

### How Auto-fix Works

1. **Spacing**: Values within 4px of a token are replaced
   - `padding: '15px'` → `padding: '16px'` (matches `md` token)
   - `margin: '17px'` → `margin: '16px'` (matches `md` token)

2. **Colors**: Only exact token matches are replaced
   - `#1e90ff` → remains (requires manual token variable usage)

3. **Backup**: Original files are backed up to `.ax-backup` extension

### Restore from Backup

```bash
# Restore a single file
mv src/Button.tsx.ax-backup src/Button.tsx

# Restore all files
find src -name "*.ax-backup" -exec sh -c 'mv "$0" "${0%.ax-backup}"' {} \;
```

## CI Integration

### Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success - no errors |
| 1 | Errors found or warnings exceed threshold |
| 2 | Exception - config error, file error, etc. |

### GitHub Actions Example

```yaml
name: Design Check
on: [push, pull_request]

jobs:
  design-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v2
        with:
          version: 8

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - run: pnpm install

      - name: Run design check
        run: pnpm ax design check --format json > design-check.json
        continue-on-error: true

      - name: Upload results
        uses: actions/upload-artifact@v4
        with:
          name: design-check-results
          path: design-check.json

      - name: Check for errors
        run: |
          if [ $(jq '.summary.errors' design-check.json) -gt 0 ]; then
            echo "Design check found errors"
            exit 1
          fi
```

### JSON Output Format

```json
{
  "summary": {
    "files": 10,
    "filesWithViolations": 3,
    "errors": 5,
    "warnings": 12,
    "skipped": 0
  },
  "results": [
    {
      "file": "/path/to/file.tsx",
      "violations": [
        {
          "rule": "no-hardcoded-colors",
          "severity": "error",
          "message": "Hardcoded color value",
          "line": 15,
          "column": 23,
          "found": "#ff0000",
          "suggestion": "Use color token",
          "fixable": true
        }
      ]
    }
  ],
  "coverage": {
    "colorCoverage": 85,
    "spacingCoverage": 92,
    "totalColors": 20,
    "totalSpacing": 45
  }
}
```

## Token Coverage

The design check reports token coverage statistics:

```
Token Coverage:
  Colors:  [████████████████░░░░] 80%
  Spacing: [██████████████████░░] 90%
```

Coverage is calculated as:
- **Color Coverage**: % of color values that use tokens
- **Spacing Coverage**: % of spacing values that use tokens

## Best Practices

1. **Start with warnings**: Set strict rules to `warn` initially, fix violations, then upgrade to `error`

2. **Ignore legacy code**: Use ignore patterns for code being gradually migrated

3. **Review before fix**: Run `--fix` in a separate commit to review changes

4. **CI enforcement**: Block PRs with new design violations

5. **Sync tokens**: Keep config tokens synchronized with your design system

## Troubleshooting

### "Config file not found"

Create a config file:
```bash
ax design init
```

### "No files found"

Check your `include` patterns and current directory:
```bash
# List what would be scanned
ax design check --format json | jq '.summary.files'
```

### "Too many violations"

Start by focusing on one rule:
```bash
ax design check --rule no-hardcoded-colors
```
