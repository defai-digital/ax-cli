# Changelog - v2.0.2

## 🐛 Bug Fix Release: Setup Command Path

**Release Date**: 2025-11-19
**Type**: PATCH (Bug Fix)

---

## Overview

Fixed critical bug in `ax-cli setup` command where it was creating configuration files at the old `~/.grok/user-settings.json` path instead of the new `~/.ax-cli/config.json` path.

---

## 🐛 Bug Fixes

### Setup Command Path Issue

**Problem:**
The setup command was using `SettingsManager.getUserSettingsPath()`, which has backward-compatibility logic that prefers the old `~/.grok` path if it exists. This meant:
- Fresh installs: ✅ Would create `~/.ax-cli/config.json` (correct)
- Existing users with `~/.grok/user-settings.json`: ❌ Would create config at old path (incorrect)

**Solution:**
The setup command now explicitly constructs the path `~/.ax-cli/config.json` and ignores the backward-compatibility logic from SettingsManager.

**Code Changes:**
```typescript
// OLD (v2.0.1)
const manager = getSettingsManager();
const configPath = manager.getUserSettingsPath(); // Could return old path

// NEW (v2.0.2)
const configPath = join(homedir(), '.ax-cli', 'config.json'); // Always new path
```

**Impact:**
- ✅ All users running `ax-cli setup` will now get config at `~/.ax-cli/config.json`
- ✅ Consistent path for all fresh setups
- ✅ Backward-compatibility logic still works for reading existing configs

---

## 📝 What Changed

### Files Modified
- `src/commands/setup.ts` - Fixed path construction logic

### Changes
- Removed dependency on `SettingsManager.getUserSettingsPath()`
- Directly construct path using `join(homedir(), '.ax-cli', 'config.json')`
- Removed unused import of `getSettingsManager`

---

## ⚠️ Breaking Changes

None - fully backward compatible with v2.0.1.

---

## 🔧 Technical Details

**Commit:** efff13f - fix: setup command now creates config at ~/.ax-cli/config.json

**Files Changed:** 1 file
**Lines Changed:** +5 -4

---

## 📦 Installation

```bash
# Install/upgrade to v2.0.2
npm install -g @defai.digital/ax-cli@2.0.2

# Run setup (now creates correct path)
ax-cli setup
```

---

## 🔍 Verification

After running `ax-cli setup`, verify the config path:

```bash
# Config should be at the NEW path
ls -l ~/.ax-cli/config.json

# Not at the old path
ls -l ~/.grok/user-settings.json  # Should not be created by setup
```

---

## 💡 Notes

- Existing `~/.grok/user-settings.json` files will still be read for backward compatibility
- To fully migrate, users can:
  1. Run `ax-cli setup` to create `~/.ax-cli/config.json`
  2. Optionally delete `~/.grok/user-settings.json`
- Future releases may include an automatic migration tool

---

## 🔗 Resources

- [Setup Command Documentation](docs/cli-reference.md#setup-command)
- [Installation Guide](docs/installation.md)
- [GitHub Repository](https://github.com/defai-digital/ax-cli)

---

**Full Changelog**: v2.0.1...v2.0.2

**Commit**: efff13f - fix: setup command now creates config at ~/.ax-cli/config.json
