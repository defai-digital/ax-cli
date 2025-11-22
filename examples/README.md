# Code Analysis Examples

This directory contains practical examples demonstrating how to use AX CLI's code analysis tools.

## Examples

### 1. Comprehensive Project Analysis (`analyze-project.ts`)

Generates a complete code quality report covering all analysis tools.

**Usage:**
```bash
npx tsx examples/analyze-project.ts [directory]
```

**Features:**
- Dependency analysis with circular dependency detection
- Code smell detection across 10+ patterns
- Hotspot analysis using git history
- Code metrics (complexity, maintainability)
- Security vulnerability scanning
- Generates markdown report

**Output:**
- Console summary
- `code-quality-report.md` saved in project directory

---

### 2. CI/CD Integration (`ci-integration.ts`)

Integration script for CI/CD pipelines that fails builds on critical issues.

**Usage:**
```bash
npx tsx examples/ci-integration.ts [directory]
```

**Features:**
- Dependency health check (fails if score < 50)
- Critical code smell detection
- Security vulnerability scanning
- Proper exit codes for CI/CD

**Exit Codes:**
- `0` - Success (no critical issues)
- `1` - Critical issues found (build should fail)
- `2` - Analysis error
