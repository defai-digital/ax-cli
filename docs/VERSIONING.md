# AX CLI Versioning Strategy
Last reviewed: 2025-02-21  
CLI Version: 4.4.3  
SDK Version: 1.4.0

---

## Overview

AX CLI uses **dual versioning** to clearly separate the CLI tool version from the SDK API version:

- **CLI Version** (e.g., `3.8.0`): Changes frequently with CLI features, bug fixes, UI updates
- **SDK Version** (e.g., `1.2.0`): Only changes when SDK API changes (stable, semantic versioning)

This prevents confusion where frequent CLI releases might imply SDK breaking changes.

---

## Why Dual Versioning?

### The Problem

Without dual versioning:
```bash
@defai.digital/ax-cli@3.8.0
```
**Question:** Is this a breaking change for SDK users? 🤔

### The Solution

With dual versioning:
```bash
@defai.digital/ax-cli@3.8.0 (SDK v1.2.0)
```
**Answer:** No! SDK is still v1.2.0 (minor update, backward compatible) ✅

---

## Version Display

### CLI Version Command

```bash
$ ax-cli --version
v3.8.0 (SDK v1.2.0)
```

### Programmatic Access

```typescript
import {
  CLI_VERSION,
  SDK_VERSION,
  SDK_API_VERSION,
  getCLIVersion,
  getSDKVersion,
  getVersionString,
  getSDKInfo,
  isSDKVersionCompatible
} from '@defai.digital/ax-cli/sdk';

// Constants
console.log(CLI_VERSION);        // "3.8.0"
console.log(SDK_VERSION);        // "1.2.0"
console.log(SDK_API_VERSION);    // 1

// Functions
console.log(getCLIVersion());    // "v3.8.0"
console.log(getSDKVersion());    // "v1.2.0"
console.log(getVersionString()); // "AX CLI v3.8.0 (SDK v1.2.0)"

// Full info
const info = getSDKInfo();
// {
//   cliVersion: "3.8.0",
//   sdkVersion: "1.2.0",
//   apiVersion: 1,
//   cliVersionString: "v3.8.0",
//   sdkVersionString: "v1.2.0"
// }

// Compatibility check
if (!isSDKVersionCompatible('1.1.0')) {
  throw new Error('SDK v1.1.0+ required');
}
```

---

## Semantic Versioning

### CLI Version (e.g., `3.8.0`)

Follows **relaxed semantic versioning** (changes frequently):

| Type | Example | When | Description |
|------|---------|------|-------------|
| **Major** | 3.0.0 → 4.0.0 | Major CLI redesign | Significant CLI changes |
| **Minor** | 3.7.0 → 3.8.0 | New CLI features | New commands, features |
| **Patch** | 3.8.0 → 3.8.1 | Bug fixes | CLI bug fixes, UI tweaks |

**Release Frequency:** Weekly or even daily

### SDK Version (e.g., `1.2.0`)

Follows **strict semantic versioning** (stable):

| Type | Example | When | Description |
|------|---------|------|-------------|
| **Major** | 1.x.x → 2.0.0 | Breaking API changes | Remove deprecated APIs |
| **Minor** | 1.1.x → 1.2.0 | New features | Add new SDK functions |
| **Patch** | 1.2.0 → 1.2.1 | Bug fixes | Fix SDK bugs only |

**Release Frequency:** Monthly or quarterly (only when SDK changes)

---

## Version History

### SDK Version History

| Version | Date | Changes |
|---------|------|---------|
| **1.2.0** | 2025-11-23 | MCP v2 API, lifecycle hooks, tool registry, dual versioning |
| **1.1.0** | 2025-11-15 | Progress reporting, unified logging, memory system |
| **1.0.0** | 2025-11-01 | Initial SDK release (SDK best practices) |

### CLI Version History (Recent)

| Version | Date | Changes |
|---------|------|---------|
| **3.8.0** | 2025-11-23 | MCP migration system, AutomatosX integration, dual versioning |
| **3.7.2** | 2025-11-22 | Bug fixes, test improvements |
| **3.7.1** | 2025-11-21 | Bug fixes, error handling |
| **3.7.0** | 2025-11-20 | SDK best practices, comprehensive testing |

---

## When to Bump Versions

### CLI Version Bumps

**Patch (3.8.0 → 3.8.1):**
- Bug fixes in CLI commands
- UI text changes
- Documentation updates
- Performance improvements (CLI only)

**Minor (3.8.x → 3.9.0):**
- New CLI commands (`ax-cli new-command`)
- New CLI options (--new-flag)
- New CLI workflows
- UI improvements

**Major (3.x.x → 4.0.0):**
- Major CLI redesign
- Remove deprecated CLI commands
- Significant breaking changes to CLI usage

### SDK Version Bumps

**Patch (1.2.0 → 1.2.1):**
- Bug fixes in SDK functions
- Internal improvements
- Documentation fixes
- No API changes

**Minor (1.2.x → 1.3.0):**
- New SDK functions (backward compatible)
- New SDK options (optional parameters)
- New exports
- Deprecate old APIs (with warnings)

**Major (1.x.x → 2.0.0):**
- Remove deprecated APIs
- Change function signatures (breaking)
- Remove exports
- Incompatible with v1.x.x

---

## Package.json Structure

```json
{
  "name": "@defai.digital/ax-cli",
  "version": "3.8.0",
  "sdkVersion": "1.2.0",
  "description": "Enterprise-Class AI CLI...",
  ...
}
```

**Key Fields:**
- `version`: CLI version (npm package version)
- `sdkVersion`: SDK API version (custom field for clarity)

---

## Dependency Management

### For SDK Users

Lock to SDK version (stable):

```json
{
  "dependencies": {
    "@defai.digital/ax-cli": "^1.2.0"
  }
}
```

**Explanation:**
- `^1.2.0` → Allows 1.2.x and 1.3.x (minor updates)
- **Blocks:** 2.0.0 (major version bump)
- **Safe:** SDK API remains compatible

### For CLI Users

Install latest (always):

```bash
npm install -g @defai.digital/ax-cli@latest
```

**Explanation:**
- CLI updates are safe (backward compatible)
- Get latest features and bug fixes
- SDK version bundled inside

---

## Compatibility Checking

### Runtime Compatibility Check

```typescript
import { isSDKVersionCompatible, SDK_VERSION } from '@defai.digital/ax-cli/sdk';

// Check if SDK is v1.1.0 or higher
if (!isSDKVersionCompatible('1.1.0')) {
  throw new Error(
    `SDK v1.1.0+ required, but found v${SDK_VERSION}. ` +
    'Please upgrade: npm install @defai.digital/ax-cli@latest'
  );
}

// Safe to use v1.1.0+ features
const logger = getUnifiedLogger();
```

### TypeScript Type Checking

```typescript
// Import from specific SDK version (future)
import type { AgentOptions } from '@defai.digital/ax-cli/sdk@1.2';

// TypeScript ensures compatibility at compile time
```

---

## Migration Guide

### From Older Versions (Pre-3.8.0)

**Before (no dual versioning):**
```typescript
import { SDK_VERSION } from '@defai.digital/ax-cli/sdk';
console.log(SDK_VERSION); // "3.7.0" (confusing - is this SDK or CLI?)
```

**After (with dual versioning):**
```typescript
import { CLI_VERSION, SDK_VERSION } from '@defai.digital/ax-cli/sdk';
console.log(CLI_VERSION); // "3.8.0" (CLI tool version)
console.log(SDK_VERSION); // "1.2.0" (SDK API version)
```

**Migration:**
- ✅ **No breaking changes** - old code still works
- ✅ `SDK_VERSION` now returns SDK version (not CLI version)
- ✅ Use `CLI_VERSION` for CLI version
- ✅ Use `getVersionString()` for both

---

## FAQ

### Q: Why not separate npm packages?

**A:** We considered `@defai.digital/ax-cli-sdk` but:
- Adds maintenance overhead (2 packages)
- Requires migration for existing users
- Dual versioning solves the problem without breaking changes
- Can revisit if SDK grows significantly

### Q: What if I only use the SDK?

**A:** Install the same package:
```bash
npm install @defai.digital/ax-cli
```

Then import only SDK:
```typescript
import { createAgent } from '@defai.digital/ax-cli/sdk';
```

The CLI binary won't be used, only SDK API.

### Q: How do I know if an update is safe?

**A:** Check SDK version:
```bash
$ npm view @defai.digital/ax-cli sdkVersion
1.2.0
```

- Same major version (1.x.x) → **Safe to upgrade**
- Different major version (2.x.x) → **Check migration guide**

### Q: Will CLI version ever match SDK version?

**A:** Only by coincidence. They follow independent versioning:
- CLI: 3.8.0, 3.9.0, 4.0.0...
- SDK: 1.2.0, 1.3.0, 2.0.0...

### Q: What about breaking changes to CLI?

**A:** CLI breaking changes (e.g., removing commands) bump CLI major version:
- CLI 3.x.x → 4.0.0 (CLI breaking change)
- SDK 1.2.0 → 1.2.0 (SDK unchanged)

Result: `v4.0.0 (SDK v1.2.0)` - clear that only CLI changed

---

## Best Practices

### For SDK Developers

1. **Lock to SDK version:**
   ```json
   "dependencies": {
     "@defai.digital/ax-cli": "^1.2.0"
   }
   ```

2. **Check compatibility at runtime:**
   ```typescript
   if (!isSDKVersionCompatible('1.2.0')) {
     throw new Error('SDK v1.2.0+ required');
   }
   ```

3. **Test against multiple versions:**
   ```bash
   npm test -- --sdk-version 1.1.0
   npm test -- --sdk-version 1.2.0
   ```

### For CLI Users

1. **Always use latest:**
   ```bash
   npm install -g @defai.digital/ax-cli@latest
   ```

2. **Update regularly:**
   ```bash
   ax-cli update
   ```

3. **Check version:**
   ```bash
   ax-cli --version
   ```

### For Maintainers

1. **Bump CLI version for CLI changes**
2. **Bump SDK version for API changes**
3. **Update `sdkVersion` in package.json**
4. **Update version history in this doc**
5. **Test both CLI and SDK**

---

## Future Plans

### Short-Term (Next 3 Months)

- Continue dual versioning
- Monitor user feedback
- Add version to error messages
- Deprecation warnings for old SDK usage

### Long-Term (Next 6-12 Months)

If SDK adoption grows significantly:

1. **Separate Package (Optional)**
   - `@defai.digital/ax-cli` (CLI tool)
   - `@defai.digital/ax-cli-sdk` (SDK library)

2. **Independent Repos (Optional)**
   - Separate repositories
   - Independent CI/CD
   - Dedicated teams

**Decision Point:** Wait until SDK has 100+ production users

---

## Summary

**Key Takeaways:**

✅ **CLI Version (3.8.0)**: Command-line tool version, changes frequently
✅ **SDK Version (1.2.0)**: Programmatic API version, stable
✅ **No Confusion**: Clear separation prevents misunderstanding
✅ **Backward Compatible**: No breaking changes for existing users
✅ **Semantic Versioning**: Proper semver for SDK stability

**Version Display:**
```bash
$ ax-cli --version
v3.8.0 (SDK v1.2.0)
```

**Remember:**
- CLI updates can be daily (features, UI, bugs)
- SDK updates are rare (only when API changes)
- Both follow semantic versioning independently

---

**Questions?** File an issue at https://github.com/defai-digital/ax-cli/issues
