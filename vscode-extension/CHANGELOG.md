# Changelog

All notable changes to the AX CLI VSCode extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2025-01-19

### Added
- Initial release of AX CLI VSCode extension
- WebView-based chat interface in sidebar
- 10 integrated commands:
  - Open Chat (`ax-cli.openChat`)
  - Analyze File (`ax-cli.analyzeFile`)
  - Explain Selection (`ax-cli.explainSelection`)
  - Generate Tests (`ax-cli.generateTests`)
  - Refactor Selection (`ax-cli.refactorSelection`)
  - Document Code (`ax-cli.documentCode`)
  - Find Bugs (`ax-cli.findBugs`)
  - Review Git Changes (`ax-cli.reviewChanges`)
  - Select Model (`ax-cli.selectModel`)
  - Configure Settings (`ax-cli.configure`)
- Keyboard shortcuts:
  - `Cmd+Shift+A` (Mac) / `Ctrl+Shift+A` (Windows/Linux): Open Chat
  - `Cmd+Shift+E` (Mac) / `Ctrl+Shift+E` (Windows/Linux): Explain Selection
- Context awareness:
  - Auto-include current file
  - Auto-include code selection
  - Auto-include git changes
  - Auto-include error diagnostics
- Multi-provider AI support:
  - Grok (xAI)
  - GLM 4.6 (ZhipuAI)
  - Claude 3.5 (Anthropic)
  - GPT-4o (OpenAI)
  - DeepSeek
  - Local models (Ollama)
- CLI Bridge for spawning and communicating with ax-cli
- Status bar integration with model display
- Code diff viewer component
- Settings panel UI
- Markdown and code block rendering
- Copy and apply code actions
- VSCode theme integration
- Official AX logo branding

### Technical
- TypeScript strict mode
- esbuild bundling
- Vitest test framework
- Comprehensive documentation
- Extension size: ~21KB (minified)

## [Unreleased]

### Planned for 0.2.0 (Phase 3)
- Inline code suggestions
- Code actions provider
- Multi-file refactoring
- Advanced context analysis
- Performance optimizations
- Streaming response support

### Planned for 0.3.0 (Phase 4)
- Custom prompts library
- Workspace memory
- Team collaboration features
- Analytics and usage insights
