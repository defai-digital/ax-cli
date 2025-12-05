# AX CLI - VS Code Extension

> AI-powered coding assistant with multi-provider flexibility and VS Code integration

[![Version](https://img.shields.io/badge/version-0.3.4-blue.svg)](https://github.com/defai-digital/ax-cli)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](https://github.com/defai-digital/ax-cli/blob/main/LICENSE)

## Features

### Multi-Provider AI Support
Switch between AI providers from the status bar:
- **Grok** (xAI) - `grok-code-fast-1`, `grok-4-latest`
- **GLM 4.6** (ZhipuAI) - Advanced reasoning
- **Claude 3.5** (Anthropic) - Code understanding
- **GPT-4o** (OpenAI) - General purpose
- **DeepSeek** - Cost-effective alternative

### Terminal Integration with Diff Preview
When running `ax` in the integrated terminal:
- File changes appear as **diff previews** in VS Code
- **Accept/Reject** changes before they're applied
- **Inline diff decorations** with per-hunk accept/reject
- Task completion summaries with file change statistics
- Real-time status updates in the status bar

### Checkpoint & Rewind System
- **Automatic checkpoints** before file changes
- **Rewind** to previous states with `/rewind` command
- 7-day checkpoint retention with configurable limits

### Multiple Chat Sessions
- Create and manage **multiple chat sessions**
- Switch between sessions with `/session` command
- Session history persisted across restarts

### File & Image Context
- **Native file picker** (`Cmd+Alt+K`) to add files as context
- **Image attachment** (`Cmd+Alt+I`) for visual context
- **@-mention** files directly in chat
- Slash commands for quick actions

### Hooks System
- **Pre/post hooks** for file operations, commits, and tasks
- Configurable shell commands with placeholder support
- Enable/disable hooks on the fly

### Auto Error Recovery
- Monitor workspace for errors
- Send errors to AI for analysis with `/errors` command

### Secure API Key Storage
- API keys stored in OS-level credential storage (macOS Keychain, Windows Credential Manager, Linux Secret Service)
- Automatic migration from plaintext settings
- Not visible in `settings.json`

### Context-Aware Commands
Right-click commands that include relevant context:
- **Analyze File**: Deep analysis of current file
- **Explain Selection**: Understand selected code
- **Generate Tests**: Create unit tests
- **Refactor Selection**: Suggest improvements
- **Document Code**: Generate documentation
- **Find Bugs**: Detect potential issues
- **Review Changes**: Git diff analysis

---

## Installation

### Prerequisites
Install AX CLI globally:
```bash
npm install -g @defai.digital/ax-cli
```

### Install Extension

**Option 1: VSIX Install**
```bash
code --install-extension ax-cli-vscode-0.3.4.vsix
```

**Option 2: Development Mode**
```bash
cd vscode-extension
npm install
npm run compile
# Press F5 to launch Extension Development Host
```

### Configure API Key
After installation, set your API key securely:
1. Run command: `AX: Set API Key` (`Cmd+Shift+K` / `Ctrl+Shift+K`)
2. Enter your API key (stored in OS secure storage)

---

## Usage

### Terminal Integration (Recommended)
For the best experience, run `ax` in VS Code's integrated terminal:
1. Open terminal (`Ctrl+`` ` or `Cmd+`` `)
2. Run `ax`
3. When the CLI makes file changes, they appear as diffs in VS Code
4. Click **Accept** or **Reject** to approve/deny changes

### Sidebar Chat
- Click AX icon in Activity Bar (sidebar)
- Or: `Cmd+Shift+A` (Mac) / `Ctrl+Shift+A` (Windows/Linux)
- Or: Command Palette → "AX: Open Chat"

### Slash Commands
Type `/` in the chat to see available commands:
- `/clear` - Clear chat history
- `/model` - Change AI model
- `/files` - Add files to context
- `/image` - Attach image
- `/rewind` - Rewind to checkpoint
- `/session` - Manage sessions
- `/errors` - Auto-fix errors
- `/hooks` - Manage hooks
- `/thinking` - Toggle extended thinking
- `/compact` - Compact conversation
- `/diff` - Show git diff
- `/help` - Show help

### Context Commands
Right-click in editor for context-aware commands:
- **AX: Explain Selection** - Explain selected code
- **AX: Refactor Selection** - Suggest improvements
- **AX: Generate Tests** - Create unit tests
- **AX: Find Bugs** - Detect potential issues
- **AX: Document Code** - Generate documentation

### Change Model
- Click "AX: [Model]" in status bar (bottom right)
- Select from available models
- Settings persist across sessions

---

## Configuration

### Extension Settings
Open Settings (`Cmd+,`) and search "AX CLI":

| Setting | Description | Default |
|---------|-------------|---------|
| `ax-cli.baseURL` | Base URL for API | `https://api.x.ai/v1` |
| `ax-cli.model` | AI model to use | `grok-code-fast-1` |
| `ax-cli.maxToolRounds` | Max tool execution rounds | 400 |
| `ax-cli.autoIncludeFile` | Auto-include current file | true |
| `ax-cli.autoIncludeDiagnostics` | Auto-include errors | true |

**Note**: API keys are stored securely via `AX: Set API Key` command, not in settings.

### Workspace Settings
Create `.vscode/settings.json` in your project:
```json
{
  "ax-cli.model": "glm-4.6",
  "ax-cli.autoIncludeFile": true
}
```

---

## Keyboard Shortcuts

| Shortcut (Mac) | Shortcut (Win/Linux) | Command |
|----------------|---------------------|---------|
| `Cmd+Shift+A` | `Ctrl+Shift+A` | Open Chat |
| `Cmd+Shift+E` | `Ctrl+Shift+E` | Explain Selection |
| `Cmd+Shift+R` | `Ctrl+Shift+R` | Refactor Selection |
| `Cmd+Shift+T` | `Ctrl+Shift+T` | Generate Tests |
| `Cmd+Shift+B` | `Ctrl+Shift+B` | Find Bugs |
| `Cmd+Shift+K` | `Ctrl+Shift+K` | Set API Key |
| `Cmd+Alt+K` | `Ctrl+Alt+K` | Add Files to Context |
| `Cmd+Alt+I` | `Ctrl+Alt+I` | Attach Image |

Customize shortcuts in: `Code → Preferences → Keyboard Shortcuts`

---

## Development

### Build Extension
```bash
npm run compile         # Build once
npm run watch           # Build + watch for changes
npm run package         # Production build
npm run check-types     # TypeScript type check
```

### Run Tests
```bash
npm test               # Run all tests (Vitest)
npm run test:watch     # Watch mode
```

### Debug Extension
1. Open `vscode-extension/` folder in VS Code
2. Press `F5` to launch Extension Development Host
3. Set breakpoints in TypeScript files
4. Test extension in new window

### Package VSIX
```bash
npm run package:vsix
# Creates: ax-cli-vscode-0.3.4.vsix
```

---

## Architecture

The extension communicates with AX CLI via WebSocket IPC:

```
┌─────────────────┐     WebSocket     ┌─────────────────┐
│   VS Code       │◄────────────────►│   AX CLI        │
│   Extension     │                   │   (Terminal)    │
├─────────────────┤                   ├─────────────────┤
│ • Diff preview  │                   │ • AI agent      │
│ • Accept/Reject │                   │ • Tool execution│
│ • Status bar    │                   │ • File ops      │
│ • Chat panel    │                   │ • Streaming     │
│ • Checkpoints   │                   │ • Hooks         │
│ • Sessions      │                   │                 │
└─────────────────┘                   └─────────────────┘
```

### Key Components
- **IPC Server** (`ipc-server.ts`) - WebSocket server for CLI communication
- **Status Bar** (`status-bar.ts`) - Model display and status updates
- **Secret Storage** (`secret-storage.ts`) - Secure API key management
- **Context Provider** (`context-provider.ts`) - Editor context extraction
- **Chat View** (`chat-view-provider.ts`) - Sidebar webview panel
- **Checkpoint Manager** (`checkpoint-manager.ts`) - File state snapshots and rewind
- **Session Manager** (`session-manager.ts`) - Multiple chat session management
- **Hooks Manager** (`hooks-manager.ts`) - Pre/post operation hooks
- **Auto Error Recovery** (`auto-error-recovery.ts`) - Error monitoring and auto-fix

---

## What's New in v0.3.4

### Bug Fixes
- Fixed command injection vulnerability in hooks system
- Fixed file search exclude pattern format
- Fixed session rename not updating UI
- Fixed partial hunk acceptance behavior (now warns user)
- Fixed list rendering in chat markdown
- Fixed restore state not saving properly
- Improved sort logic for file search
- Removed unused variables and dead code

### Improvements
- Added validation for session and checkpoint data on load
- Better error handling throughout the extension

---

## Privacy & Security

- **API Keys**: Encrypted in OS credential storage (not in settings.json)
- **Code Content**: Only sent to configured AI provider
- **No Telemetry**: Extension doesn't collect usage data
- **IPC**: Local WebSocket connection only
- **Hooks**: Shell arguments are properly escaped to prevent injection

---

## License

MIT License - see [LICENSE](https://github.com/defai-digital/ax-cli/blob/main/LICENSE)

---

## Links

- [AX CLI Repository](https://github.com/defai-digital/ax-cli)
- [Report Issues](https://github.com/defai-digital/ax-cli/issues)
