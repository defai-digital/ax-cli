# Changelog - v2.1.0

## Feature: Automatic Setup Detection and Configuration Validation

### New Functionality
When running `ax-cli` without parameters (interactive mode), the CLI now automatically detects if the configuration file is missing or incomplete and runs the setup wizard.

### Problem Solved
Previously, users would see a cryptic error message if their configuration file was missing or incomplete:
```
❌ Error: API key required. Set YOUR_API_KEY environment variable, use --api-key flag, or save to ~/.ax-cli/config.json
```

This required users to manually run `ax-cli setup` before they could use the interactive mode.

### Implementation Details

**New Function**: `isConfigValid()` in `src/index.ts`
- Checks if configuration file exists and has all required fields
- Validates that `apiKey`, `baseURL`, and `model` are present and non-empty
- Returns `false` if any required field is missing or if an error occurs

**Automatic Setup Trigger**:
- Runs only in interactive mode (when no `--prompt`, `--api-key`, or `--base-url` flags are provided)
- Displays user-friendly message before running setup
- Validates configuration after setup completes
- Exits with error if setup was cancelled or incomplete

### User Experience Improvements

**Before (v2.0.3)**:
```bash
$ ax-cli
❌ Error: API key required. Set YOUR_API_KEY environment variable...
$ ax-cli setup
# Manual step required
$ ax-cli
# Now works
```

**After (v2.1.0)**:
```bash
$ ax-cli
⚠️  Configuration file not found or incomplete.

Let's set up AX CLI first...

🚀 AX CLI Setup
# Automatically runs setup wizard
# Then continues to interactive mode
```

### Technical Changes

**File Modified**: `src/index.ts`

1. Added `isConfigValid()` function (lines 67-80):
```typescript
function isConfigValid(): boolean {
  try {
    const manager = getSettingsManager();
    const apiKey = manager.getApiKey();
    const baseURL = manager.getBaseURL();
    const model = manager.getCurrentModel();
    return !!(apiKey && apiKey.trim() && baseURL && baseURL.trim() && model && model.trim());
  } catch {
    return false;
  }
}
```

2. Updated main action handler (lines 389-411):
   - Detect interactive mode
   - Check config validity
   - Automatically run setup if needed
   - Validate setup completion

### Behavior in Different Modes

- **Interactive Mode** (`ax-cli`): Automatically runs setup if config is invalid
- **Headless Mode** (`ax-cli -p "..."`): Does NOT auto-run setup (requires explicit config)
- **With API Key Flag** (`ax-cli --api-key xyz`): Does NOT auto-run setup (uses provided key)
- **Setup Command** (`ax-cli setup`): Direct setup, no automatic detection

### Breaking Changes
None. This is a backward-compatible enhancement.

### Upgrade Notes
No action required. Existing users with valid configurations will see no change in behavior.

---

**Version**: 2.1.0
**Release Date**: 2025-11-19
**Type**: Minor (New Feature)
