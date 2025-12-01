# AX CLI - VSCode Extension

> AI-powered coding assistant with true multi-provider flexibility

[![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)](https://github.com/defai-digital/ax-cli)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](https://github.com/defai-digital/ax-cli/blob/main/LICENSE)

## 🚀 Features

### Multi-Provider AI Support
Switch between multiple AI providers without being locked in:
- **Grok** (xAI) - Fast coding assistance
- **GLM 4.6** (ZhipuAI) - Advanced reasoning
- **Claude 3.5** (Anthropic) - Code understanding
- **GPT-4o** (OpenAI) - General purpose
- **DeepSeek** - Cost-effective alternative
- **Local Models** (Ollama) - Privacy-first option

### Sidebar Chat Interface
- Modern, responsive chat UI
- Markdown and code highlighting
- Copy and apply code blocks
- Conversation history
- Context-aware responses

### Context Awareness
Automatically includes relevant context:
- Current file
- Code selection
- Line ranges
- Git changes
- Error diagnostics

### Quick Commands
- **Analyze File**: Deep analysis of current file
- **Explain Selection**: Understand selected code
- **Generate Tests**: Create unit tests
- **Refactor Code**: Suggest improvements
- **Find Bugs**: Detect potential issues
- **Review Changes**: Git diff analysis

---

## 📦 Installation

### Prerequisites
1. **Install AX CLI**:
   ```bash
   npm install -g @defai.digital/ax-cli
   ```

2. **Configure API Key**:
   ```bash
   # For Grok (default)
   export GROK_API_KEY=your_api_key

   # Or for other providers
   export ANTHROPIC_API_KEY=your_key
   export OPENAI_API_KEY=your_key
   ```

### Install Extension

**Option 1: Auto-Install (Recommended) ⚡**
```bash
ax-cli vscode install
```
The CLI automatically detects VSCode and installs the extension!

**Option 2: From Marketplace** (Coming Soon)
- Search "AX CLI" in VSCode Extensions
- Click Install

**Option 3: Manual VSIX Install**
```bash
code --install-extension ax-cli-vscode-0.1.0.vsix
```

**Option 4: Development**
```bash
cd vscode-extension
npm install
npm run compile
# Press F5 to launch Extension Development Host
```

---

## 🎯 Usage

### Open Chat
- Click AX icon in Activity Bar (sidebar)
- Or: `Cmd+Shift+A` (Mac) / `Ctrl+Shift+A` (Windows/Linux)
- Or: Command Palette → "AX: Open Chat"

### Ask Questions
1. Type your question in the input box
2. Press `Enter` or click Send
3. AI responds with formatted answer
4. Click "Apply" to insert code blocks

### Use Commands
- Right-click in editor → "AX: ..." commands
- Or use keyboard shortcuts:
  - `Cmd+Shift+E`: Explain Selection
  - Access others via Command Palette

### Change Model
- Click model name in status bar (bottom right)
- Select from dropdown
- Settings persist across sessions

---

## ⚙️ Configuration

### Extension Settings
Open Settings (`Cmd+,`) and search "AX CLI":

| Setting | Description | Default |
|---------|-------------|---------|
| `ax-cli.apiKey` | API key for AI provider | "" |
| `ax-cli.baseURL` | Base URL for API | `https://api.x.ai/v1` |
| `ax-cli.model` | AI model to use | `grok-code-fast-1` |
| `ax-cli.maxToolRounds` | Max tool execution rounds | 400 |
| `ax-cli.autoIncludeFile` | Auto-include current file | true |
| `ax-cli.autoIncludeDiagnostics` | Auto-include errors | true |

### Workspace Settings
Create `.vscode/settings.json` in your project:
```json
{
  "ax-cli.model": "glm-4.6",
  "ax-cli.autoIncludeFile": true
}
```

---

## 🔥 Examples

### Analyze Current File
1. Open a file
2. Run: "AX: Analyze Current File"
3. Get suggestions for improvements

### Explain Code
1. Select code snippet
2. Press `Cmd+Shift+E`
3. Read detailed explanation

### Generate Tests
1. Open file with functions
2. Run: "AX: Generate Tests"
3. Review generated test cases
4. Click "Apply" to create test file

### Review Git Changes
1. Make code changes (don't commit)
2. Run: "AX: Review Git Changes"
3. Get feedback on your changes

---

## 🎨 Keyboard Shortcuts

| Shortcut | Command |
|----------|---------|
| `Cmd+Shift+A` | Open Chat |
| `Cmd+Shift+E` | Explain Selection |

Customize shortcuts in: `Code → Preferences → Keyboard Shortcuts`

---

## 🛠️ Development

### Build Extension
```bash
npm run compile         # Build once
npm run watch           # Build + watch
npm run package         # Production build
```

### Run Tests
```bash
npm test               # Run all tests
npm run test:watch     # Watch mode
```

### Debug Extension
1. Open extension folder in VSCode
2. Press `F5` to launch Extension Development Host
3. Set breakpoints in TypeScript files
4. Test extension in new window

### Package VSIX
```bash
npm install -g vsce
vsce package
# Creates: ax-cli-vscode-0.1.0.vsix
```

---

## 📚 Documentation

- [Main Documentation](https://github.com/defai-digital/ax-cli)
- [VSCode Integration Guide](../docs/vscode-integration-guide.md)
- [Phase 2 Summary](../docs/vscode-phase2-summary.md)
- [API Reference](https://github.com/defai-digital/ax-cli#api)

---

## 🤝 Contributing

Contributions welcome! See [CONTRIBUTING.md](https://github.com/defai-digital/ax-cli/blob/main/CONTRIBUTING.md)

### Reporting Issues
- [GitHub Issues](https://github.com/defai-digital/ax-cli/issues)
- Include: VSCode version, extension version, error logs

### Feature Requests
- [GitHub Discussions](https://github.com/defai-digital/ax-cli/discussions)
- Describe use case and expected behavior

---

## 🔒 Privacy & Security

- **API Keys**: Stored securely in VSCode settings
- **Code Content**: Only sent to configured AI provider
- **Local Models**: Use Ollama for complete privacy
- **No Telemetry**: Extension doesn't collect usage data

---

## 📄 License

MIT License - see [LICENSE](https://github.com/defai-digital/ax-cli/blob/main/LICENSE)

---

## 🙏 Acknowledgments

- Built on top of [AX CLI](https://github.com/defai-digital/ax-cli)
- Uses VSCode Extension API
- Icons from VSCode Codicons

---

## 🗺️ Roadmap

### Phase 2 (Current) ✅
- [x] Sidebar chat interface
- [x] Context-aware commands
- [x] Code application
- [x] Model switching

### Phase 3 (Planned)
- [ ] Inline code suggestions
- [ ] Code actions provider
- [ ] Multi-file refactoring
- [ ] Diff viewer

### Phase 4 (Future)
- [ ] Performance optimizations
- [ ] Advanced context analysis
- [ ] Custom prompts library
- [ ] Team collaboration features

---

## 💬 Support

- **Documentation**: [docs.ax-cli.dev](https://github.com/defai-digital/ax-cli)
- **Issues**: [GitHub Issues](https://github.com/defai-digital/ax-cli/issues)
- **Discussions**: [GitHub Discussions](https://github.com/defai-digital/ax-cli/discussions)

---

**Made with ❤️ by the AX CLI team**
