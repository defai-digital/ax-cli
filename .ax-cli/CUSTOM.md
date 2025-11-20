# @defai.digital/ax-cli - Quick Reference

**Type:** cli | **Lang:** TypeScript | **Ver:**  v2.3.1
**Stack:** React, Vitest, Zod, Commander, Ink, ESM, TypeScript

---

## 🎯 Critical Rules

1. **ESM Imports:** Always use `.js` extension: `import { x } from './y.js'`
2. **Validation:** Use zod for all external inputs
3. **Types:** Explicit return types required on all functions
4. **Testing:** 80%+ coverage, test error paths
5. **Modules:** Use `import/export` (not `require/module.exports`)
6. **File Organization:** Follow standardized output paths (see below)

---

## 📁 Project File Organization

### Standard Output Paths

All AI-generated and project artifacts must follow this structure:

```
automatosx/
├── PRD/              # Product Requirement Documents
│   ├── features/     # Feature specifications
│   ├── api/          # API documentation
│   └── archive/      # Old/deprecated PRDs
├── REPORT/           # Project reports and analysis
│   ├── status/       # Status reports
│   ├── plans/        # Implementation plans
│   ├── analysis/     # Code analysis reports
│   └── metrics/      # Performance and quality metrics
└── tmp/              # Temporary files and drafts
    ├── logs/         # Debug and execution logs
    ├── cache/        # Cached data
    └── scratch/      # Temporary work files
```

### Path Usage Guidelines

**PRD (Product Requirement Documents):**
- **Path:** `./automatosx/PRD/`
- **Purpose:** Feature specs, requirements, architecture decisions
- **Naming:** `YYYY-MM-DD-feature-name.md` or `feature-name-v1.md`
- **Example:**
  ```bash
  automatosx/PRD/features/2025-11-20-mcp-integration.md
  automatosx/PRD/api/rest-api-spec.md
  ```

**REPORT (Plans & Status):**
- **Path:** `./automatosx/REPORT/`
- **Purpose:** Implementation plans, status reports, analysis
- **Naming:** `YYYY-MM-DD-report-type.md`
- **Example:**
  ```bash
  automatosx/REPORT/status/2025-11-20-weekly-status.md
  automatosx/REPORT/plans/authentication-implementation-plan.md
  automatosx/REPORT/analysis/code-quality-report.md
  ```

**tmp (Temporary Files):**
- **Path:** `./automatosx/tmp/`
- **Purpose:** Logs, cache, scratch work, debug output
- **Auto-cleanup:** Files older than 7 days can be deleted
- **Example:**
  ```bash
  automatosx/tmp/logs/ai-session-2025-11-20.log
  automatosx/tmp/cache/api-response-cache.json
  automatosx/tmp/scratch/debugging-notes.md
  ```

### File Naming Conventions

1. **Use kebab-case:** `feature-name.md` (not `Feature_Name.md`)
2. **Include dates:** `YYYY-MM-DD-` prefix for time-sensitive docs
3. **Be descriptive:** `user-auth-flow.md` (not `flow.md`)
4. **Version when needed:** `api-spec-v2.md`

### .gitignore Rules

```gitignore
# Temporary files (not tracked)
automatosx/tmp/

# Keep structure but ignore content
automatosx/PRD/.gitkeep
automatosx/REPORT/.gitkeep

# Track important PRDs and reports
!automatosx/PRD/**/*.md
!automatosx/REPORT/**/*.md
```

---

## 📋 Project Overview

**Entry:** `dist/index.js` | **PM:** npm | **Module:** ESM


**Directories:**
- `src/` - Source code
- `tests/` - Tests
- `src/tools/` - Tools
- `src/commands/` - Commands
- `src/utils/` - Utilities

---

## 🔧 Code Patterns

### TypeScript

✅ **DO:**
```typescript
// Explicit types
function process(x: string): Promise<Result> { }

// ESM imports with .js extension
import { foo } from './bar.js';
```

❌ **DON'T:**
```typescript
// No any types
function process(x: any) { }  // ❌

// Missing .js extension
import { foo } from './bar';  // ❌
```

### Validation (zod)

✅ **DO:**
```typescript
const result = schema.safeParse(data);
if (!result.success) {
  return { success: false, error: result.error };
}
```

### CLI Commands
Commands should:
- Accept options via flags (`-f, --flag <value>`)
- Validate input before execution
- Provide clear error messages
- Return exit codes (0 = success, 1+ = error)

---

## 🔄 Workflow

### Before Making Changes

1. **Understand Context:**
   - Read relevant files to understand current implementation
   - Search for related patterns and conventions
   - Review tests for expected behavior

2. **Plan Documentation:**
   - Create PRD if planning new features → `automatosx/PRD/features/`
   - Create implementation plan → `automatosx/REPORT/plans/`
   - Use `tmp/` for temporary notes

### Making Changes

- **Code Changes:**
  - Edit existing files (never recreate)
  - Keep changes focused and atomic
  - Preserve code style and patterns
  - Update tests when changing functionality

- **Documentation:**
  - Update PRDs when requirements change
  - Create status reports for major milestones
  - Log important decisions in REPORT/analysis/

### After Changes

1. **Quality Checks:**
   ```bash
   npm run lint        # Code linting
   npm test           # Run all tests
   npm run build      # Production build
   ```

2. **Documentation Updates:**
   - Update relevant PRDs if specs changed
   - Create status report if milestone completed
   - Clean up `tmp/` directory

3. **File Organization:**
   - Move finalized plans from `tmp/` to `REPORT/`
   - Archive old PRDs to `PRD/archive/`
   - Delete temporary files older than 7 days

### Quick Commands

```bash
# Development
npm run dev              # Start development mode
npm run dev:node         # Development with Node.js

# Testing
npm test                 # Run all tests
npm run test:watch       # Watch mode
npm run test:coverage    # Coverage report

# Building
npm run build            # Production build
npm run typecheck        # Type checking only

# Documentation
ls automatosx/PRD/       # View all PRDs
ls automatosx/REPORT/    # View all reports
```

### File Output Examples

**Creating a new feature:**
```bash
# 1. Write PRD
→ automatosx/PRD/features/2025-11-20-new-feature.md

# 2. Create implementation plan
→ automatosx/REPORT/plans/new-feature-implementation.md

# 3. After implementation, write status report
→ automatosx/REPORT/status/2025-11-20-feature-complete.md
```

**Analysis and debugging:**
```bash
# 1. Debug notes (temporary)
→ automatosx/tmp/scratch/debug-notes.md

# 2. Final analysis report
→ automatosx/REPORT/analysis/performance-optimization.md

# 3. Metrics tracking
→ automatosx/REPORT/metrics/test-coverage-nov-2025.md
```

---

## 🐛 Troubleshooting

### "Module not found" errors
**Solution:** Add `.js` extension to imports (ESM requirement)
```typescript
// ✅ Correct
import { x } from './y.js';

// ❌ Wrong
import { x } from './y';  // Missing .js
```

### zod validation errors
**Solution:** Use `.safeParse()` for detailed error messages. Check schema matches data structure.

### Tests fail locally but pass in CI
**Solution:** Check Node version, clear node_modules, check environment-specific code

### TypeScript compilation errors
**Solution:** Check `tsconfig.json` settings, ensure all types are imported, verify `moduleResolution`