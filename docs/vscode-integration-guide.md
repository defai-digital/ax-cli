# VSCode Integration Guide
Last reviewed: 2025-02-21  
Applies to: ax-cli/ax-glm/ax-grok v4.4.x (Phase 1 terminal integration)

This guide shows how to use the CLI from VSCode. Use the provider-specific binaries (`ax-glm`, `ax-grok`) or the local/offline `ax-cli` as needed.

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Installation](#installation)
3. [VSCode Tasks Setup](#vscode-tasks-setup)
4. [Keyboard Shortcuts](#keyboard-shortcuts)
5. [Usage Examples](#usage-examples)
6. [CLI Flags Reference](#cli-flags-reference)
7. [Troubleshooting](#troubleshooting)

---

## Quick Start

### 1. Install the CLI

Pick the right binary for your provider or local use:

```bash
npm install -g @defai.digital/ax-glm    # GLM (Z.AI)
npm install -g @defai.digital/ax-grok   # Grok (xAI)
npm install -g @defai.digital/ax-cli    # Local/offline
```

### 2. Setup Configuration

Run setup once per provider to create encrypted config:

```bash
ax-glm setup
ax-grok setup
# ax-cli setup (optional for local)
```

### 3. Copy VSCode Templates

```bash
# Navigate to your project directory
cd your-project

# Create .vscode directory if it doesn't exist
mkdir -p .vscode

# Copy AX CLI templates
cp node_modules/@defai.digital/ax-cli/templates/vscode/*.json .vscode/
```

### 4. Start Using AX CLI in VSCode

Press `Cmd+Shift+P` (Mac) or `Ctrl+Shift+P` (Windows/Linux) and type "Tasks: Run Task", then select an AX task!

---

## Installation

### Prerequisites

- Node.js 24+ installed
- VSCode 1.80+ installed
- AX CLI configured with API key

### Manual Setup

If you prefer manual setup, follow these steps:

#### 1. Create `.vscode` directory

```bash
mkdir -p .vscode
```

#### 2. Create `tasks.json`

Create `.vscode/tasks.json` with pre-configured AX CLI tasks:

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "AX: Analyze Current File",
      "type": "shell",
      "command": "ax-cli --prompt 'Analyze this file' --file ${file} --json --vscode",
      "problemMatcher": []
    }
    // ... more tasks
  ]
}
```

**Full template:** `templates/vscode/tasks.json`

#### 3. Create `keybindings.json`

Create `.vscode/keybindings.json` for keyboard shortcuts:

```json
[
  {
    "key": "cmd+shift+a",
    "command": "workbench.action.tasks.runTask",
    "args": "AX: Interactive Chat"
  }
  // ... more shortcuts
]
```

**Full template:** `templates/vscode/keybindings.json`

#### 4. (Optional) Create `settings.json`

Create `.vscode/settings.json` for workspace settings:

```json
{
  "terminal.integrated.scrollback": 10000,
  "files.associations": {
    ".ax-cli/config.json": "jsonc"
  }
}
```

**Full template:** `templates/vscode/settings.json`

---

## VSCode Tasks Setup

### Available Tasks

AX CLI provides 10 pre-configured tasks:

| Task | Description | Context |
|------|-------------|---------|
| **AX: Interactive Chat** | Opens interactive AX CLI session | None |
| **AX: Analyze Current File** | Analyzes current file for improvements | Current file |
| **AX: Explain Selection** | Explains selected code in detail | Selection |
| **AX: Review Git Changes** | Reviews uncommitted changes | Git diff |
| **AX: Generate Tests for File** | Creates unit tests for current file | Current file |
| **AX: Document Selection** | Generates documentation for code | Selection |
| **AX: Refactor Selection** | Suggests refactoring improvements | Selection |
| **AX: Find Bugs in File** | Finds potential bugs/security issues | Current file |
| **AX: Optimize Performance** | Suggests performance optimizations | Current file |
| **AX: Custom Prompt** | Runs custom prompt with file context | Current file + custom prompt |

### Running Tasks

**Method 1: Command Palette**
1. Press `Cmd+Shift+P` (Mac) or `Ctrl+Shift+P` (Windows/Linux)
2. Type "Tasks: Run Task"
3. Select an AX task from the list

**Method 2: Keyboard Shortcuts** (see next section)

**Method 3: Terminal Menu**
1. Go to Terminal → Run Task
2. Select an AX task

### Task Configuration

Tasks use VSCode variables:
- `${file}` - Current file path
- `${selectedText}` - Currently selected text
- `${workspaceFolder}` - Workspace root directory

Example custom task:

```json
{
  "label": "AX: Custom Analysis",
  "type": "shell",
  "command": "ax-cli --prompt 'Find code smells' --file ${file} --json --vscode",
  "problemMatcher": []
}
```

---

## Keyboard Shortcuts

### Default Shortcuts

| Shortcut (Mac) | Shortcut (Win/Linux) | Action |
|----------------|----------------------|--------|
| `Cmd+Shift+A` | `Ctrl+Shift+A` | AX: Interactive Chat |
| `Cmd+Shift+E` | `Ctrl+Shift+E` | AX: Explain Selection |
| `Cmd+Shift+D` | `Ctrl+Shift+D` | AX: Document Selection |
| `Cmd+Shift+R` | `Ctrl+Shift+R` | AX: Refactor Selection |
| `Cmd+Shift+T` | `Ctrl+Shift+T` | AX: Generate Tests |
| `Cmd+Shift+G` | `Ctrl+Shift+G` | AX: Review Git Changes |
| `Cmd+Shift+B` | `Ctrl+Shift+B` | AX: Find Bugs |
| `Cmd+Shift+P` | `Ctrl+Shift+P` | AX: Optimize Performance |

### Customizing Shortcuts

Edit `.vscode/keybindings.json`:

```json
[
  {
    "key": "cmd+k cmd+a",  // Your custom shortcut
    "command": "workbench.action.tasks.runTask",
    "args": "AX: Analyze Current File",
    "when": "editorTextFocus"
  }
]
```

### Context-Aware Shortcuts

Use `when` clauses to make shortcuts context-aware:

```json
{
  "key": "cmd+shift+e",
  "command": "workbench.action.tasks.runTask",
  "args": "AX: Explain Selection",
  "when": "editorHasSelection"  // Only when text is selected
}
```

---

## Usage Examples

### Example 1: Analyze Current File

1. Open any code file
2. Press `Cmd+Shift+P` → "Tasks: Run Task" → "AX: Analyze Current File"
3. View AI analysis in terminal

**Command:**
```bash
ax-cli --prompt 'Analyze this file and suggest improvements' \
  --file src/index.ts \
  --json \
  --vscode
```

**Output:**
```json
{
  "messages": [...],
  "model": "grok-code-fast-1",
  "timestamp": "2025-01-19T20:00:00Z"
}
```

### Example 2: Explain Selected Code

1. Select code in editor
2. Press `Cmd+Shift+E` (Mac) or `Ctrl+Shift+E` (Windows/Linux)
3. View explanation in terminal

**Command:**
```bash
ax-cli --prompt 'Explain this code in detail' \
  --selection 'function foo() { ... }' \
  --json \
  --vscode
```

### Example 3: Review Git Changes

1. Make some code changes (don't commit)
2. Press `Cmd+Shift+G` (Mac) or `Ctrl+Shift+G` (Windows/Linux)
3. View AI code review in terminal

**Command:**
```bash
ax-cli --prompt 'Review these changes and suggest improvements' \
  --git-diff \
  --json \
  --vscode
```

### Example 4: Generate Tests

1. Open file that needs tests
2. Press `Cmd+Shift+T` (Mac) or `Ctrl+Shift+T` (Windows/Linux)
3. View generated tests in terminal

**Command:**
```bash
ax-cli --prompt 'Generate comprehensive unit tests for this file' \
  --file src/utils/helper.ts \
  --json \
  --vscode
```

### Example 5: Custom Prompt with Context

1. Open any file
2. Run task "AX: Custom Prompt"
3. Enter your prompt in the input box
4. View response in terminal

**Command:**
```bash
ax-cli --prompt 'Your custom question' \
  --file src/app.ts \
  --json \
  --vscode
```

---

## CLI Flags Reference

### Context Flags

#### `--file <path>`

Include file content as context.

**Usage:**
```bash
ax-cli --prompt "Explain this code" --file src/index.ts
```

**Example:**
```bash
ax-cli --prompt "What does this module do?" --file ./utils/auth.ts --json
```

#### `--selection <text>`

Include selected text as context.

**Usage:**
```bash
ax-cli --prompt "Optimize this function" --selection "function slow() { ... }"
```

**VSCode Integration:**
```json
{
  "command": "ax-cli --prompt 'Explain' --selection '${selectedText}'"
}
```

#### `--line-range <start>-<end>`

Include specific line range from file (requires `--file`).

**Usage:**
```bash
ax-cli --prompt "Review these lines" --file src/app.ts --line-range 10-50
```

**Example:**
```bash
# Analyze lines 100-200 of large file
ax-cli --prompt "Find issues" --file big-file.ts --line-range 100-200 --json
```

#### `--git-diff`

Include uncommitted git changes as context.

**Usage:**
```bash
ax-cli --prompt "Review my changes" --git-diff
```

**Example:**
```bash
# Get code review of current changes
ax-cli --prompt "Suggest improvements before commit" --git-diff --json --vscode
```

### Output Flags

#### `--json`

Output response in structured JSON format.

**Usage:**
```bash
ax-cli --prompt "Analyze code" --file app.ts --json
```

**Output Format:**
```json
{
  "messages": [
    {
      "role": "user",
      "content": "Analyze code..."
    },
    {
      "role": "assistant",
      "content": "This code does..."
    }
  ],
  "model": "grok-code-fast-1",
  "timestamp": "2025-01-19T20:00:00Z"
}
```

**Error Format:**
```json
{
  "error": {
    "message": "File not found: app.ts",
    "type": "Error"
  },
  "timestamp": "2025-01-19T20:00:00Z"
}
```

#### `--vscode`

Optimize output for VSCode (pretty-print JSON).

**Usage:**
```bash
ax-cli --prompt "Help" --file app.ts --json --vscode
```

**Difference:**
- Without `--vscode`: Compact JSON (one line)
- With `--vscode`: Pretty-printed JSON (indented, readable)

### Combined Flags

You can combine multiple flags:

```bash
# Analyze specific lines with JSON output
ax-cli --prompt "Find bugs" \
  --file src/app.ts \
  --line-range 50-100 \
  --json \
  --vscode

# Review changes with custom model
ax-cli --prompt "Code review" \
  --git-diff \
  --model grok-4-latest \
  --json

# Explain selection with specific context
ax-cli --prompt "Refactor this" \
  --selection "function old() { ... }" \
  --file src/legacy.ts \
  --json \
  --vscode
```

---

## Troubleshooting

### Task Not Found

**Error:** "Task 'AX: ...' not found"

**Solution:**
1. Ensure `.vscode/tasks.json` exists
2. Reload VSCode window (Cmd+Shift+P → "Reload Window")
3. Verify task label matches exactly

### Command Not Found

**Error:** "ax-cli: command not found"

**Solution:**
1. Verify AX CLI is installed: `npm list -g @defai.digital/ax-cli`
2. Reinstall if needed: `npm install -g @defai.digital/ax-cli`
3. Restart VSCode after installation

### No Output in Terminal

**Issue:** Task runs but no output appears

**Solution:**
1. Check if API key is configured: `ax-cli --version`
2. Run command manually in terminal to see errors
3. Check `.ax-cli/config.json` for valid configuration

### JSON Parse Error

**Error:** "Unexpected token in JSON"

**Solution:**
1. Always use `--json --vscode` flags together for readable output
2. Ensure no extra output before JSON (no console.log in code)
3. Check for syntax errors in tasks.json

### Selection Not Working

**Issue:** `${selectedText}` is empty

**Solution:**
1. Ensure text is actually selected before running task
2. Use `"when": "editorHasSelection"` in keybinding
3. Try manual command with hardcoded text first

### Git Diff Not Found

**Error:** "git: command not found"

**Solution:**
1. Install Git: https://git-scm.com/downloads
2. Ensure Git is in PATH
3. Restart VSCode after installing Git

### File Path Issues

**Issue:** File not found errors

**Solution:**
1. Use absolute paths when possible
2. Verify `${file}` variable expands correctly
3. Check file permissions
4. Use forward slashes (`/`) even on Windows

---

## Advanced Tips

### Tip 1: Create Project-Specific Tasks

Add custom tasks for your project:

```json
{
  "label": "AX: Run Project Checks",
  "type": "shell",
  "command": "ax-cli --prompt 'Run linting, type checking, and suggest fixes' --file ${file} --json --vscode",
  "problemMatcher": []
}
```

### Tip 2: Chain Commands

Use shell operators to chain multiple operations:

```json
{
  "label": "AX: Analyze and Test",
  "type": "shell",
  "command": "ax-cli --prompt 'Analyze' --file ${file} && ax-cli --prompt 'Generate tests' --file ${file}",
  "problemMatcher": []
}
```

### Tip 3: Use Input Variables

Create interactive prompts:

```json
{
  "inputs": [
    {
      "id": "targetModel",
      "type": "pickString",
      "description": "Choose AI model",
      "options": ["grok-code-fast-1", "grok-4-latest", "glm-4.6"],
      "default": "grok-code-fast-1"
    }
  ],
  "tasks": [
    {
      "label": "AX: Custom with Model",
      "command": "ax-cli --prompt 'Analyze' --file ${file} --model ${input:targetModel} --json"
    }
  ]
}
```

### Tip 4: Save Output to File

Redirect output to file for later review:

```json
{
  "label": "AX: Analyze to File",
  "command": "ax-cli --prompt 'Analyze' --file ${file} --json --vscode > analysis.json",
  "problemMatcher": []
}
```

### Tip 5: Multi-File Analysis

Analyze multiple files:

```bash
# In custom task
for file in src/*.ts; do
  ax-cli --prompt "Check for issues" --file "$file" --json
done
```

---

## Next Steps

- **Phase 2 Preview:** Native VSCode extension with WebView UI (coming soon!)
- **Feedback:** Share your experience at https://github.com/defai-digital/ax-cli/issues
- **Community:** Join discussions about VSCode integration

---

## Resources

- [AX CLI Documentation](../README.md)
- [VSCode Tasks Documentation](https://code.visualstudio.com/docs/editor/tasks)
- [VSCode Variables Reference](https://code.visualstudio.com/docs/editor/variables-reference)
- [AX CLI GitHub Issues](https://github.com/defai-digital/ax-cli/issues)

---

**Happy coding with AX CLI + VSCode! 🚀**
