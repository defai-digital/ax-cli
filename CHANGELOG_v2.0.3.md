# Changelog - v2.0.3

## Bug Fix: Correct z.ai Base URL in Setup Command

### Problem
The `ax-cli setup` command was configuring the wrong base URL for z.ai:
- **Incorrect**: `https://api.x.ai/v1`
- **Correct**: `https://api.z.ai/api/coding/paas/v4`

This caused API requests to fail when using the setup command's default configuration.

### Root Cause
The `DEFAULT_CONFIG` in `src/commands/setup.ts` had the wrong base URL hardcoded (line 13).

### Solution
Updated the default configuration to use the correct z.ai API endpoint:

**File Modified**: `src/commands/setup.ts`
- Line 13: Changed `baseURL` from `https://api.x.ai/v1` to `https://api.z.ai/api/coding/paas/v4`
- Line 64: Updated display text from `https://x.ai` to `https://z.ai`
- Line 90: Updated provider display from `z.ai (https://x.ai)` to `z.ai (https://z.ai)`

### Verification
After this fix, running `ax-cli setup` will create a configuration file with the correct z.ai base URL.

**Test Steps**:
1. Remove existing config: `rm ~/.ax-cli/config.json`
2. Run setup: `ax-cli setup`
3. Enter your z.ai API key
4. Verify output shows: `Base URL: https://api.z.ai/api/coding/paas/v4`

### Impact
- **Users Affected**: Anyone who ran `ax-cli setup` in v2.0.2 or earlier
- **Severity**: High (API calls would fail with wrong endpoint)
- **Fix Required**: Users should either:
  - Run `ax-cli setup --force` to regenerate config with correct URL
  - Manually edit `~/.ax-cli/config.json` and update the `baseURL` field

---

**Version**: 2.0.3
**Release Date**: 2025-11-19
**Type**: Patch (Bug Fix)
