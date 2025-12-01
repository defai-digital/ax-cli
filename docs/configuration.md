# AX CLI Configuration Guide

**Version:** 3.8.7
**Last Updated:** 2025-11-24

---

## Table of Contents

1. [Overview](#overview)
2. [Configuration Files](#configuration-files)
3. [User Settings](#user-settings)
4. [Project Settings](#project-settings)
5. [Settings Reference](#settings-reference)
6. [Examples](#examples)
7. [Migration Guide](#migration-guide)

---

## Overview

AX CLI uses a **two-tier configuration system**:

- **User Settings** (`~/.ax-cli/config.json`) - Global defaults for all projects
- **Project Settings** (`.ax-cli/settings.json`) - Project-specific overrides

**Priority:** CLI flags > ENV vars > Project settings > User settings > Defaults

---

## Configuration Files

### User Settings (Global)

**Location:** `~/.ax-cli/config.json`

**Purpose:** Global defaults that apply to all projects

**Created:** Automatically on first run with `/setup`

**Example:**
```json
{
  "apiKey": "your-api-key",
  "baseURL": "https://open.bigmodel.cn/api/paas/v4",
  "defaultModel": "glm-4.6",
  "temperature": 0.7
}
```

### Project Settings (Local)

**Location:** `.ax-cli/settings.json` (in your project root)

**Purpose:** Project-specific settings that override user defaults

**Created:** Manually or with `/init`

**Example:**
```json
{
  "defaultModel": "glm-4.6",
  "temperature": 0.3,
  "paste": {
    "autoCollapse": true,
    "collapseThreshold": 30
  }
}
```

---

## User Settings

### Basic Settings

#### apiKey
- **Type:** `string`
- **Default:** None (required)
- **Description:** Your GLM API key
- **Security:** Plain text (deprecated), use `apiKeyEncrypted` for production

```json
{
  "apiKey": "your-api-key-here"
}
```

#### apiKeyEncrypted
- **Type:** `EncryptedValue` object
- **Default:** None
- **Description:** Encrypted API key (recommended)
- **Note:** Created automatically when you use `/setup`

```json
{
  "apiKeyEncrypted": {
    "encrypted": "...",
    "iv": "...",
    "salt": "...",
    "tag": "...",
    "version": 1
  }
}
```

#### baseURL
- **Type:** `string` (URL)
- **Default:** `https://open.bigmodel.cn/api/paas/v4`
- **Description:** API endpoint URL
- **Supports:** HTTP, HTTPS, localhost URLs

```json
{
  "baseURL": "http://localhost:11434/v1"
}
```

#### defaultModel
- **Type:** `string`
- **Default:** `glm-4.6`
- **Options:** `glm-4.6`, `grok-code-fast-1`, custom models
- **Description:** Model to use by default

```json
{
  "defaultModel": "glm-4.6"
}
```

#### temperature
- **Type:** `number`
- **Range:** 0.0 - 2.0
- **Default:** 0.7
- **Description:** Sampling temperature (creativity level)

```json
{
  "temperature": 0.7
}
```

#### maxTokens
- **Type:** `number` (positive integer)
- **Default:** Model-specific (e.g., 128000 for glm-4.6)
- **Description:** Maximum output tokens per response

```json
{
  "maxTokens": 8192
}
```

---

### Advanced Settings

#### Input Settings

Control multi-line input behavior:

```json
{
  "input": {
    "enterBehavior": "newline",
    "submitKeys": ["shift+enter"],
    "multilineIndicator": " ",
    "smartDetection": {
      "enabled": true,
      "checkBrackets": true,
      "checkOperators": true,
      "checkStatements": true
    }
  }
}
```

**Options:**
- `enterBehavior`: `"newline"` (default), `"submit"` (legacy), `"smart"` (auto-detect)
- `submitKeys`: Array of key combinations (default: `["shift+enter"]`)
- `multilineIndicator`: String shown for continuation lines
- `smartDetection`: Automatic newline detection settings

#### Paste Settings

Control large paste handling:

```json
{
  "paste": {
    "autoCollapse": true,
    "collapseThreshold": 20,
    "characterThreshold": 500,
    "maxCollapsedBlocks": 50,
    "showLineCount": true,
    "showPreview": true,
    "previewLines": 2,
    "enableHistory": true,
    "maxHistoryItems": 10
  }
}
```

**Options:**
- `autoCollapse`: Auto-collapse large paste blocks
- `collapseThreshold`: Minimum lines to trigger collapse
- `characterThreshold`: Minimum characters to trigger collapse
- `showPreview`: Show first N lines in collapsed state
- `previewLines`: Number of preview lines (0-10)
- `enableHistory`: Track paste history
- `maxHistoryItems`: Maximum paste history items

#### UI Settings

Control verbosity and tool grouping:

```json
{
  "ui": {
    "verbosityLevel": "quiet",
    "groupToolCalls": true,
    "maxGroupSize": 20,
    "groupTimeWindow": 500
  }
}
```

**Options:**
- `verbosityLevel`: `"quiet"` (default), `"concise"`, `"verbose"`
- `groupToolCalls`: Group multiple tool calls into one message
- `maxGroupSize`: Maximum operations per group (1-50)
- `groupTimeWindow`: Time window for grouping (ms)

#### Status Bar Settings

Customize the status bar:

```json
{
  "statusBar": {
    "enabled": true,
    "compact": true,
    "showCost": true,
    "showTokens": true,
    "showContext": true,
    "showSession": true,
    "showModes": true,
    "updateInterval": 1000,
    "position": "top"
  }
}
```

**Options:**
- `enabled`: Show/hide status bar
- `compact`: Single-line vs multi-line
- `showCost`: Display cost estimation
- `showTokens`: Display token usage
- `showContext`: Display context percentage
- `showSession`: Display session info
- `showModes`: Display mode indicators (auto-accept, thinking)
- `updateInterval`: Update frequency (500-5000ms)
- `position`: `"top"` or `"bottom"`

#### Auto-Accept Settings

Control auto-accept mode (Shift+Tab):

```json
{
  "autoAccept": {
    "enabled": false,
    "persistAcrossSessions": false,
    "alwaysConfirm": [
      "git_push_main",
      "mass_delete",
      "rm_rf",
      "npm_publish"
    ],
    "scope": "session",
    "auditLog": {
      "enabled": true,
      "maxEntries": 1000,
      "filepath": ".ax-cli/auto-accept.log"
    }
  }
}
```

**Options:**
- `enabled`: Start with auto-accept ON
- `persistAcrossSessions`: Remember state across restarts
- `alwaysConfirm`: Operations that always require confirmation
- `scope`: `"session"`, `"project"`, or `"global"`
- `auditLog`: Log all auto-accepted operations

#### External Editor Settings

Control Ctrl+G external editor:

```json
{
  "externalEditor": {
    "enabled": true,
    "editor": "vim",
    "shortcut": "ctrl+g",
    "tempDir": "/tmp",
    "confirmBeforeSubmit": true,
    "syntaxHighlighting": true
  }
}
```

**Options:**
- `enabled`: Enable/disable external editor feature
- `editor`: Override $EDITOR (e.g., `"code --wait"`, `"vim"`, `"nano"`)
- `shortcut`: Keyboard shortcut (default: `"ctrl+g"`)
- `tempDir`: Temporary file directory
- `confirmBeforeSubmit`: Ask before submitting edited content
- `syntaxHighlighting`: Use markdown extension for syntax highlighting

#### Thinking Mode Settings

Control GLM-4.6 thinking mode (Tab key):

```json
{
  "thinkingMode": {
    "enabled": false,
    "quickToggle": true,
    "showInStatusBar": true,
    "budgetTokens": 2000
  }
}
```

**Options:**
- `enabled`: Start with thinking mode ON
- `quickToggle`: Enable Tab key toggle
- `showInStatusBar`: Show status icon in status bar
- `budgetTokens`: Optional thinking budget (GLM-4.6 specific)

#### Keyboard Shortcuts Settings

Customize keyboard behavior:

```json
{
  "shortcuts": {
    "showOnStartup": false,
    "hintTimeout": 3000,
    "customBindings": {
      "clear": "ctrl+l",
      "help": "ctrl+h"
    }
  }
}
```

**Options:**
- `showOnStartup`: Show keyboard help on first run
- `hintTimeout`: Hint display duration (ms, 0 = no timeout)
- `customBindings`: Custom key bindings (advanced)

#### Sampling Settings

Deterministic/reproducible mode:

```json
{
  "sampling": {
    "doSample": false,
    "seed": 42,
    "topP": 0.95
  }
}
```

**Options:**
- `doSample`: Enable sampling (set `false` for deterministic)
- `seed`: Random seed for reproducibility
- `topP`: Nucleus sampling parameter (0.0-1.0)

#### Security Settings

Enterprise hardening:

```json
{
  "security": {
    "enableCommandWhitelist": true,
    "enableSSRFProtection": true,
    "enableErrorSanitization": true
  }
}
```

**Options:**
- `enableCommandWhitelist`: Strict command whitelist enforcement
- `enableSSRFProtection`: SSRF protection for HTTP/SSE transports
- `enableErrorSanitization`: Sanitize sensitive data from errors

---

## Project Settings

Project settings use the same schema as user settings but only override specific values.

**Location:** `.ax-cli/settings.json` (in project root)

**Common use cases:**
- Project-specific model selection
- Custom temperature for specific projects
- Project-specific paste thresholds
- Local MCP servers

**Example:**
```json
{
  "defaultModel": "glm-4.6",
  "temperature": 0.3,
  "paste": {
    "collapseThreshold": 30
  },
  "mcpServers": {
    "project-tools": {
      "transport": "stdio",
      "command": "node",
      "args": ["./tools/mcp-server.js"]
    }
  }
}
```

---

## Settings Reference

### Quick Reference Table

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `apiKey` | string | - | API key (plain text, deprecated) |
| `apiKeyEncrypted` | object | - | Encrypted API key (recommended) |
| `baseURL` | string | GLM endpoint | API endpoint URL |
| `defaultModel` | string | `"glm-4.6"` | Default model |
| `temperature` | number | 0.7 | Sampling temperature (0-2) |
| `maxTokens` | number | Model default | Max output tokens |
| `input.enterBehavior` | string | `"newline"` | Enter key behavior |
| `paste.autoCollapse` | boolean | `true` | Auto-collapse large pastes |
| `ui.verbosityLevel` | string | `"quiet"` | Verbosity level |
| `statusBar.enabled` | boolean | `true` | Show status bar |
| `autoAccept.enabled` | boolean | `false` | Auto-accept mode |
| `externalEditor.enabled` | boolean | `true` | External editor (Ctrl+G) |
| `thinkingMode.enabled` | boolean | `false` | Thinking mode (Tab) |

---

## Examples

### Example 1: Basic User Config

Minimal configuration for getting started:

```json
{
  "apiKey": "your-api-key-here",
  "defaultModel": "glm-4.6",
  "temperature": 0.7
}
```

### Example 2: Power User Config

Advanced configuration with all features:

```json
{
  "apiKeyEncrypted": {
    "encrypted": "...",
    "iv": "...",
    "salt": "...",
    "tag": "...",
    "version": 1
  },
  "baseURL": "https://open.bigmodel.cn/api/paas/v4",
  "defaultModel": "glm-4.6",
  "temperature": 0.7,
  "input": {
    "enterBehavior": "newline",
    "submitKeys": ["shift+enter"]
  },
  "paste": {
    "autoCollapse": true,
    "collapseThreshold": 20,
    "showPreview": true,
    "previewLines": 3
  },
  "ui": {
    "verbosityLevel": "quiet",
    "groupToolCalls": true
  },
  "statusBar": {
    "enabled": true,
    "compact": true,
    "position": "top"
  },
  "autoAccept": {
    "enabled": false,
    "persistAcrossSessions": false,
    "auditLog": {
      "enabled": true
    }
  },
  "externalEditor": {
    "enabled": true,
    "editor": "code --wait"
  },
  "thinkingMode": {
    "enabled": true,
    "quickToggle": true
  }
}
```

### Example 3: Project-Specific Config

Override defaults for a specific project:

```json
{
  "defaultModel": "glm-4.6",
  "temperature": 0.3,
  "paste": {
    "collapseThreshold": 50
  },
  "ui": {
    "verbosityLevel": "verbose"
  }
}
```

### Example 4: Local Development Config

Configuration for local Ollama or other providers:

```json
{
  "baseURL": "http://localhost:11434/v1",
  "defaultModel": "llama2",
  "temperature": 0.8,
  "maxTokens": 4096
}
```

### Example 5: Enterprise Security Config

Hardened configuration for enterprise use:

```json
{
  "apiKeyEncrypted": {
    "encrypted": "...",
    "iv": "...",
    "salt": "...",
    "tag": "...",
    "version": 1
  },
  "security": {
    "enableCommandWhitelist": true,
    "enableSSRFProtection": true,
    "enableErrorSanitization": true
  },
  "autoAccept": {
    "enabled": false,
    "alwaysConfirm": [
      "git_push_main",
      "mass_delete",
      "rm_rf",
      "npm_publish",
      "docker_prune"
    ],
    "auditLog": {
      "enabled": true,
      "maxEntries": 10000,
      "filepath": "/var/log/ax-cli/audit.log"
    }
  }
}
```

---

## Migration Guide

### From Plain Text API Keys to Encrypted

**Automatic Migration:**
1. Run `/setup`
2. Enter your API key
3. AX CLI will automatically encrypt and migrate

**Manual Migration:**
1. Delete `apiKey` field from `~/.ax-cli/config.json`
2. Run `/setup` to create encrypted key

### From Old Config Format

If you have an old configuration file, run:

```bash
ax-cli /setup
```

This will automatically migrate your settings to the new format.

---

## Environment Variables

You can override settings with environment variables:

| Variable | Setting | Example |
|----------|---------|---------|
| `GLM_API_KEY` | `apiKey` | `export GLM_API_KEY=your-key` |
| `GLM_BASE_URL` | `baseURL` | `export GLM_BASE_URL=http://localhost:11434/v1` |
| `GLM_MODEL` | `defaultModel` | `export GLM_MODEL=glm-4.6` |
| `GLM_TEMPERATURE` | `temperature` | `export GLM_TEMPERATURE=0.8` |
| `EDITOR` | `externalEditor.editor` | `export EDITOR=vim` |
| `VISUAL` | `externalEditor.editor` | `export VISUAL=code --wait` |

---

## Troubleshooting

### Configuration Not Loading

1. Check file exists: `ls -la ~/.ax-cli/config.json`
2. Verify JSON syntax: `cat ~/.ax-cli/config.json | jq`
3. Check permissions: `chmod 600 ~/.ax-cli/config.json`

### Settings Not Taking Effect

**Priority order:**
1. CLI flags (highest)
2. Environment variables
3. Project settings (`.ax-cli/settings.json`)
4. User settings (`~/.ax-cli/config.json`)
5. Defaults (lowest)

**Debug:**
Run with verbose mode to see which settings are loaded:
```bash
ax-cli --verbose
```

### API Key Issues

**Encrypted key not working:**
1. Re-run `/setup` to regenerate
2. Check encryption version matches
3. Verify permissions on config file

**Plain text key deprecated:**
- Migrate to encrypted using `/setup`
- Encrypted keys are more secure

---

## Best Practices

### 1. Use Encrypted API Keys
```json
{
  "apiKeyEncrypted": { ... }
}
```
**Reason:** More secure than plain text

### 2. Project-Specific Overrides
```json
// .ax-cli/settings.json
{
  "defaultModel": "glm-4.6",
  "temperature": 0.3
}
```
**Reason:** Different projects may need different settings

### 3. Version Control
- **DO:** Commit `.ax-cli/settings.json` (project settings)
- **DON'T:** Commit `~/.ax-cli/config.json` (contains API keys)
- **ADD:** `.ax-cli/` to `.gitignore` if it contains secrets

### 4. Environment-Specific Configs
```bash
# Development
export GLM_BASE_URL=http://localhost:11434/v1

# Production
export GLM_BASE_URL=https://open.bigmodel.cn/api/paas/v4
```
**Reason:** Easy switching between environments

### 5. Enable Audit Logs
```json
{
  "autoAccept": {
    "auditLog": {
      "enabled": true
    }
  }
}
```
**Reason:** Track all auto-accepted operations for security

---

## See Also

- [README](../README.md) - Main documentation
- [Keyboard Shortcuts](./SHORTCUTS.md) - All keyboard shortcuts
- [MCP Integration](./MCP.md) - MCP server configuration
- [Security](./SECURITY.md) - Security best practices

---

**Last Updated:** 2025-11-23
**Version:** 3.7.2
**Maintained by:** AutomatosX Team
