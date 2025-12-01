# Auto-Install Feature for AX CLI VSCode Extension

## Overview

The AX CLI now includes a built-in `vscode` command that automatically detects VSCode and helps install the AX CLI extension without manual VSIX installation.

## Features

### 1. Automatic Detection
- Detects if VSCode is installed on your system
- Supports multiple VSCode variants (Code, Code - Insiders, VSCodium)
- Finds the VSIX package automatically

### 2. Status Checking
Check the current installation status:
```bash
ax-cli vscode status
```

Output shows:
- ✓ VSCode installation status
- ✓ Extension installation status and version
- ✓ VSIX file availability
- 💡 Helpful next steps

### 3. Easy Installation
Install or update the extension with one command:
```bash
ax-cli vscode install
```

Features:
- Automatically finds the VSIX file
- Checks if already installed (use `--force` to reinstall)
- Shows progress and success messages
- Provides next steps after installation

### 4. Force Reinstall
Reinstall even if already installed:
```bash
ax-cli vscode install --force
```

Useful for:
- Updating to a new version
- Fixing a broken installation
- Testing changes during development

### 5. Uninstall
Remove the extension:
```bash
ax-cli vscode uninstall
```

### 6. Silent Auto-Install (Future Enhancement)
For automatic installation on CLI startup (not yet implemented):
```bash
ax-cli vscode auto-install
```

## Usage Examples

### Check Status
```bash
$ ax-cli vscode status

📊 VSCode Extension Status
────────────────────────────────────────────────────────────

✓ VSCode installed (code)
✓ AX CLI extension installed (v0.1.0)

📦 VSIX file available: /path/to/ax-cli-vscode-0.1.0.vsix

💡 Commands:
   ax-cli vscode install    - Install/update extension
   ax-cli vscode uninstall  - Remove extension
```

### First-Time Installation
```bash
$ ax-cli vscode install

📦 Installing AX CLI VSCode Extension
────────────────────────────────────────────────────────────

✓ VSCode found (code)
✓ VSIX file found: ax-cli-vscode-0.1.0.vsix

○ Installing extension...
✓ Extension installed successfully!

🎉 AX CLI VSCode Extension Ready!

Next steps:
  1. Reload VSCode if it's already open
  2. Press Cmd+Shift+A (Mac) or Ctrl+Shift+A (Windows/Linux)
  3. Start chatting with AX CLI!
```

### Update Existing Installation
```bash
$ ax-cli vscode install

📦 Installing AX CLI VSCode Extension
────────────────────────────────────────────────────────────

✓ VSCode found (code)
○ Extension already installed (v0.1.0)

💡 Use --force to reinstall
```

```bash
$ ax-cli vscode install --force

📦 Installing AX CLI VSCode Extension
────────────────────────────────────────────────────────────

✓ VSCode found (code)
✓ VSIX file found: ax-cli-vscode-0.1.0.vsix

○ Uninstalling previous version...
✓ Previous version uninstalled
○ Installing extension...
✓ Extension installed successfully!

🎉 AX CLI VSCode Extension Ready!
```

### Uninstall
```bash
$ ax-cli vscode uninstall

🗑️  Uninstalling AX CLI VSCode Extension
────────────────────────────────────────────────────────────

○ Uninstalling extension...
✓ Extension uninstalled successfully
```

## How It Works

### 1. VSCode Detection
The command checks for VSCode in multiple ways:
1. Tries `code --version` command
2. Tries `/usr/local/bin/code` (common macOS path)
3. Tries `codium --version` (VSCodium variant)

### 2. VSIX File Location
The command searches for the VSIX file in:
1. `./vscode-extension/ax-cli-vscode-0.1.0.vsix` (development)
2. `../vscode-extension/ax-cli-vscode-0.1.0.vsix` (installed package)
3. `../../../vscode-extension/ax-cli-vscode-0.1.0.vsix` (node_modules)

### 3. Extension Installation
Uses the native VSCode CLI:
```bash
code --install-extension /path/to/extension.vsix
```

### 4. Status Checking
Queries installed extensions:
```bash
code --list-extensions
code --list-extensions --show-versions
```

## Error Handling

### VSCode Not Found
```bash
📊 VSCode Extension Status
────────────────────────────────────────────────────────────

✗ VSCode not found

💡 Install VSCode from:
   https://code.visualstudio.com/
```

**Solution**: Install VSCode or add the `code` command to your PATH.

On macOS:
1. Open VSCode
2. Press Cmd+Shift+P
3. Type "Shell Command: Install 'code' command in PATH"
4. Press Enter

### VSIX File Not Found
```bash
✗ VSIX file not found

Expected locations:
   ./vscode-extension/ax-cli-vscode-0.1.0.vsix
   ../vscode-extension/ax-cli-vscode-0.1.0.vsix

💡 Build the extension first:
   cd vscode-extension
   npm run package:vsix
```

**Solution**: Build the VSIX package:
```bash
cd vscode-extension
npm install
npm run package:vsix
```

## Integration with AX CLI Workflow

### Recommended Setup Flow

1. **Initial Setup**
   ```bash
   # Install AX CLI
   npm install -g @defai.digital/ax-cli

   # Configure API key
   ax-cli setup

   # Install VSCode extension
   ax-cli vscode install
   ```

2. **Start Using**
   ```bash
   # Open VSCode
   code .

   # Press Cmd+Shift+A (or Ctrl+Shift+A)
   # Start chatting with AX CLI!
   ```

### For Developers

```bash
# Clone repo
git clone https://github.com/defai-digital/ax-cli
cd ax-cli

# Build CLI
npm install
npm run build

# Build VSCode extension
cd vscode-extension
npm install
npm run package:vsix

# Install extension
cd ..
ax-cli vscode install

# Test in VSCode
code .
```

## Future Enhancements

### 1. Auto-Install on Startup (Planned)
Automatically check and install extension when running `ax-cli` for the first time:
```bash
ax-cli  # First run
# → Detects VSCode
# → Asks: "Install VSCode extension? (y/n)"
# → Installs if user confirms
```

### 2. Update Notifications (Planned)
Notify when a new extension version is available:
```bash
ax-cli vscode status
# → "New version available: v0.2.0"
# → "Run: ax-cli vscode install --force"
```

### 3. Configuration Options (Planned)
Settings for auto-install behavior:
```json
// ~/.ax-cli/config.json
{
  "vscode": {
    "autoInstall": true,
    "autoUpdate": true,
    "checkOnStartup": true
  }
}
```

### 4. Multiple Extension Versions (Planned)
Manage different versions:
```bash
ax-cli vscode list-versions
ax-cli vscode install --version 0.1.0
```

## Troubleshooting

### Command Not Found: ax-cli
```bash
npm install -g @defai.digital/ax-cli
# or
npm link  # For development
```

### Permission Denied
```bash
sudo ax-cli vscode install
# or
npm install -g @defai.digital/ax-cli  # With sudo if needed
```

### Extension Not Showing in VSCode
1. Reload VSCode (Cmd+Shift+P → "Developer: Reload Window")
2. Check if installed: `ax-cli vscode status`
3. Reinstall: `ax-cli vscode install --force`

### VSIX File Missing After Git Clone
```bash
cd vscode-extension
npm install
npm run package:vsix
```

## Architecture

### Command Structure
```
ax-cli vscode
├── status          # Check installation status
├── install         # Install or update extension
│   └── --force     # Force reinstall
├── uninstall       # Remove extension
└── auto-install    # Silent auto-install (future)
    └── --check-only
```

### File Organization
```
ax-cli/
├── src/commands/vscode.ts        # VSCode command implementation
├── vscode-extension/
│   ├── ax-cli-vscode-0.1.0.vsix  # Extension package
│   ├── dist/extension.js         # Bundled extension
│   └── package.json              # Extension manifest
└── dist/
    └── commands/vscode.js        # Compiled command
```

## See Also

- [VSCode Extension README](README.md) - Extension features and usage
- [Implementation Complete](IMPLEMENTATION_COMPLETE.md) - Technical details
- [Architecture](ARCHITECTURE.md) - System design

## Changelog

### v0.1.0 (Current)
- ✅ Initial release
- ✅ VSCode detection (code, codium)
- ✅ Status checking
- ✅ Installation/uninstallation
- ✅ Force reinstall option
- ✅ VSIX file auto-detection
- ✅ Error handling and helpful messages

### Future (Planned)
- ⏳ Auto-install on CLI first run
- ⏳ Update notifications
- ⏳ Configuration options
- ⏳ Version management
