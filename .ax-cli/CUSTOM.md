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

**Before:**
- Read files to understand implementation
- Search for related patterns
- Review tests for expected behavior

**Changes:**
- Edit existing files (never recreate)
- Keep changes focused and atomic
- Preserve code style
- Update tests when changing functionality

**After:**
1. Lint: `eslint . --ext .js,.jsx,.ts,.tsx`
2. Test: `vitest run`
3. Build: `npm run build:schemas && tsc`

**Quick Commands:**
```bash
npm run dev     # Development
npm test    # Run tests
npm run build   # Production build
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