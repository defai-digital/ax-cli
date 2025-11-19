# Changelog - v2.0.1

## 🎯 Feature Release: Setup Command

**Release Date**: 2025-11-19
**Type**: MINOR FEATURE

---

## Overview

Added `ax-cli setup` command for easy initial configuration. This provides a user-friendly way to create `~/.ax-cli/config.json` with z.ai and GLM 4.6 defaults.

---

## ✨ What's New

### Setup Command

New interactive command to initialize AX CLI configuration:

```bash
ax-cli setup
```

**Features:**
- Interactive API key prompt (hidden input for security)
- Creates `~/.ax-cli/config.json` with sensible defaults
- Checks for existing configuration and prompts for confirmation
- `--force` option to overwrite without prompting
- Beautiful CLI output with:
  - Configuration summary
  - Helpful next steps
  - Useful tips and documentation links

**Default Configuration:**
```json
{
  "apiKey": "your_api_key",
  "baseURL": "https://api.x.ai/v1",
  "model": "glm-4.6",
  "maxTokens": 8192,
  "temperature": 0.7,
  "mcpServers": {}
}
```

### Documentation Updates

- Added comprehensive setup command documentation to `docs/cli-reference.md`
- Updated `docs/installation.md` quick start to include setup command
- Updated table of contents in CLI reference

---

## 📝 Usage

### First Time Setup

```bash
# Install globally
npm install -g @defai.digital/ax-cli@2.0.1

# Run setup
ax-cli setup

# Start using
ax-cli
```

### Force Overwrite

```bash
# Overwrite existing config without prompting
ax-cli setup --force
```

---

## 🔧 Technical Details

### Files Added
- `src/commands/setup.ts` - Setup command implementation (121 lines)

### Files Modified
- `src/index.ts` - Registered setup command
- `docs/cli-reference.md` - Added setup command documentation
- `docs/installation.md` - Updated quick start guide
- `package.json` - Version bump to 2.0.1

### Dependencies Used
- `enquirer` - Interactive CLI prompts (existing dependency)
- `chalk` - Colored terminal output (existing dependency)
- `commander` - CLI framework (existing dependency)

---

## 🐛 Bug Fixes

None - this is a pure feature addition.

---

## ⚠️ Breaking Changes

None - fully backward compatible with v2.0.0.

---

## 📊 Quality Assurance

- ✅ **TypeScript compilation**: Clean (0 errors)
- ✅ **Build**: Successful
- ✅ **Command registration**: Verified
- ✅ **Help text**: Properly displayed
- ✅ **Documentation**: Complete and accurate

---

## 💡 Rationale

### Why Add a Setup Command?

1. **User Experience**: Simplifies first-time configuration
2. **Discoverability**: Clear command name (`setup`) for new users
3. **Best Practices**: Follows CLI conventions (like `npm init`, `git config`)
4. **Safety**: Prompts before overwriting existing configuration
5. **Guidance**: Provides helpful next steps after setup

### Design Decisions

- **Hidden password input**: API keys are sensitive and should not be displayed
- **Confirmation prompts**: Prevent accidental configuration overwrites
- **Helpful output**: Clear feedback about what was created and where
- **Next steps**: Guide users on what to do after setup
- **z.ai + GLM 4.6 defaults**: Aligns with project's primary focus

---

## 🔗 Related Changes

This release follows v2.0.0 (Grok → LLM rebranding). The setup command uses the new:
- `AI_*` environment variable naming
- LLM-centric terminology
- z.ai as the default provider
- GLM 4.6 as the default model

---

## 📚 Resources

- [CLI Reference](docs/cli-reference.md#setup-command)
- [Installation Guide](docs/installation.md#quick-start)
- [GitHub Repository](https://github.com/defai-digital/ax-cli)

---

**Full Changelog**: v2.0.0...v2.0.1

**Commit**: e4c840a - feat: add setup command for easy configuration
