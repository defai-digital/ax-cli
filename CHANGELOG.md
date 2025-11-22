# Changelog

All notable changes to AX CLI will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.6.2] - 2025-11-22

### Added
- **Multi-Level Verbosity System**: Three verbosity levels for optimal user experience
  - **Quiet Mode** (new default): Smart grouping of tool operations reduces visual noise by 85%
  - **Concise Mode**: One line per tool execution (previous default behavior)
  - **Verbose Mode**: Full details with arguments, outputs, and diffs
  - Press `Ctrl+O` to cycle between levels during session
- **Smart Tool Grouping**: Consecutive operations on the same file are grouped together
  - Shows operation counts (e.g., "3 edits, 5 reads")
  - Displays total execution duration
  - Auto-generated change summaries (e.g., "added functions, improved error handling")
- **Intelligent Change Summarizer**: Pattern detection in diffs
  - Detects function changes, imports, types, error handling, tests, and more
  - Provides human-readable summaries of what was modified
- **Auto-Error Expansion**: Errors automatically show full details in all modes
  - Ensures debugging capability is never compromised
  - Visual indicator prompts users to switch to verbose mode if needed
- **Enhanced Status Bar**: Shows current verbosity level
  - Color-coded display (Gray for Quiet, Yellow for Concise/Verbose)
  - Flash animation on mode toggle for visual feedback
- **Configuration Support**: Verbosity can be set in user/project settings
  - `verbosityLevel`: "quiet" | "concise" | "verbose"
  - `groupToolCalls`: Enable/disable grouping (default: true)
  - `maxGroupSize`: Max operations per group (default: 20)
  - `groupTimeWindow`: Grouping time window in ms (default: 500)

### Changed
- **Default Verbosity**: Changed from one-line-per-tool to grouped quiet mode
  - Users who prefer the old behavior can set `"verbosityLevel": "concise"` in settings
  - Backward compatible with existing `verboseMode` boolean flag
- **Ctrl+O Behavior**: Now cycles through three levels instead of toggling boolean
  - Quiet → Concise → Verbose → Quiet (cycles continuously)

### Fixed
- Information overload issue where simple operations generated 20+ lines of output
- Improved scannability of tool execution results
- Better focus on AI responses vs tool mechanics

### Technical Details
- Added 3 new utility modules: `tool-grouper.ts`, `change-summarizer.ts`, `tool-group-display.tsx`
- Updated 8 core files for verbosity level support
- Extended Zod schemas with `UISettingsSchema` for validation
- Full TypeScript type safety with zero compilation errors
- 100% backward compatible with existing configurations

## [3.6.1] - 2025-11-21

### Added
- Smart Paste Auto-Collapse feature
- Improved large paste handling

## [3.6.0] - 2025-11-20

### Added
- Enhanced MCP integration
- Multi-phase task planner
- Session continuity with `--continue` flag

---

For older versions, see GitHub releases: https://github.com/defai-digital/ax-cli/releases
