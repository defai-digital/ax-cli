# Changelog - v2.1.2

## Critical Bug Fix: fs-extra CommonJS/ESM Compatibility

### Problem
Version 2.1.1 still had ESM import issues when using `fs-extra`:
```
SyntaxError: Named export 'readFileSync' not found. The requested module 'fs-extra' is a CommonJS module, which may not support all module.exports as named exports.
```

The CLI would fail to start with this error when trying to import named exports from the `fs-extra` CommonJS package.

### Root Cause
While v2.1.1 fixed namespace imports (`import * as fs`), it attempted to use named imports from `fs-extra`:
```typescript
import { readFileSync, writeFileSync } from 'fs-extra';  // ❌ Doesn't work
```

`fs-extra` is a CommonJS package and does not support named exports in ESM. When using ESM modules, CommonJS packages must be imported as default imports.

### Solution
Applied the correct ESM/CommonJS compatibility pattern across all files:

**For sync operations** (use Node.js native `fs`):
```typescript
// Before (v2.1.1)
import { readFileSync, writeFileSync } from 'fs-extra';

// After (v2.1.2)
import { readFileSync, writeFileSync } from 'fs';
```

**For async operations** (use default import from `fs-extra`):
```typescript
// Before (v2.1.1)
import * as fs from 'fs-extra';

// After (v2.1.2)
import fs from 'fs-extra';
import path from 'path';
```

### Files Modified

1. **src/utils/json-utils.ts**
   - Changed from `fs-extra` to native `fs` module
   - Uses `readFileSync` and `writeFileSync` (sync operations)

2. **src/utils/config-loader.ts**
   - Changed from `fs-extra` to native `fs` module
   - Uses `readFileSync` (sync operation)
   - Changed `path` imports to named imports

3. **src/tools/text-editor.ts**
   - Changed from namespace import to default import
   - `import fs from "fs-extra"` (async operations needed)
   - `import path from "path"`

4. **src/tools/search.ts**
   - Changed from namespace import to default import
   - `import fs from "fs-extra"` (async operations needed)
   - `import path from "path"`

### Technical Background

Node.js ESM requires different import patterns for CommonJS vs ESM modules:

**CommonJS Modules** (`fs-extra`, `path`, etc.):
- ✅ Default import: `import pkg from 'pkg'`
- ❌ Named imports: `import { func } from 'pkg'` (doesn't work for CommonJS)
- ❌ Namespace imports: `import * as pkg from 'pkg'` (unreliable in ESM)

**Native Node.js Modules** (`fs`, `path`, `os`):
- ✅ Named imports: `import { readFileSync } from 'fs'`
- Preferred for sync operations

**Best Practice**:
- Use native `fs` for sync operations (readFileSync, writeFileSync, etc.)
- Use `fs-extra` default import for async operations (pathExists, ensureDir, etc.)

### Impact
- **Severity**: Critical (CLI completely non-functional in v2.1.1)
- **Users Affected**: All users who installed v2.1.1
- **Fixed In**: v2.1.2

### Verification
After this fix:
```bash
$ ax-cli setup
🚀 AX CLI Setup
# Works correctly!

$ ax-cli
🤖 Starting AX CLI AI Assistant...
# Works correctly!
```

---

**Version**: 2.1.2
**Release Date**: 2025-11-19
**Type**: Patch (Critical Bug Fix)
