# Changelog - v2.1.1

## Critical Bug Fix: ESM Import Issues

### Problem
Version 2.1.0 introduced a critical bug that prevented the CLI from starting:
```
Failed to load user settings: fs.readFileSync is not a function
Failed to load project settings: fs.readFileSync is not a function
❌ Error: API key required. Set YOUR_API_KEY environment variable...
```

Even with a valid configuration file at `~/.ax-cli/config.json`, the CLI would fail to read it due to ESM namespace import issues.

### Root Cause
The code was using namespace imports for Node.js built-in modules with ESM:
```typescript
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
```

In Node.js ESM, these namespace imports create an object that may not have the expected functions directly accessible, especially when using `fs-extra` re-exports.

### Solution
Changed all Node.js built-in module imports to use named imports:

**Files Modified:**

1. **src/utils/json-utils.ts**
```typescript
// Before
import * as fs from 'fs-extra';
fs.readFileSync(...)
fs.writeFileSync(...)

// After
import { readFileSync, writeFileSync } from 'fs-extra';
readFileSync(...)
writeFileSync(...)
```

2. **src/utils/settings-manager.ts**
```typescript
// Before
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
fs.existsSync(...)
path.join(...)
os.homedir()

// After
import { existsSync, mkdirSync, copyFileSync, chmodSync } from "fs";
import { dirname, join } from "path";
import { homedir } from "os";
existsSync(...)
join(...)
homedir()
```

All references to `fs.*`, `path.*`, and `os.*` were replaced with direct function calls throughout both files.

### Impact
- **Severity**: Critical (CLI completely non-functional in v2.1.0)
- **Users Affected**: All users who installed v2.1.0
- **Fixed In**: v2.1.1

### Verification
After this fix:
```bash
$ ax-cli
🤖 Starting AX CLI AI Assistant...
# Works correctly!
```

The CLI now properly reads configuration files and starts successfully.

### Technical Details
This is a common pitfall when migrating to ES modules in Node.js. Namespace imports (`import * as`) work differently in ESM compared to CommonJS, and when combined with re-exports from libraries like `fs-extra`, can cause runtime errors where functions are not accessible.

The fix ensures all imports are explicit and use the named export syntax, which is the recommended approach for ES modules.

---

**Version**: 2.1.1
**Release Date**: 2025-11-19
**Type**: Patch (Critical Bug Fix)
