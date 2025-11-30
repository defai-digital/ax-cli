# AX CLI Command Reference Guide

Complete reference for all AX CLI commands, options, and interactive mode features.

---

## Table of Contents

1. [Main Commands](#main-commands)
2. [Setup Command](#setup-command)
3. [Init Command](#init-command)
4. [Update Command](#update-command)
5. [MCP Commands](#mcp-commands)
6. [Interactive Mode Slash Commands](#interactive-mode-slash-commands)
7. [Enhanced Input Features](#enhanced-input-features)
8. [Direct Bash Commands](#direct-bash-commands)
9. [Usage Examples](#usage-examples)
10. [Configuration Precedence](#configuration-precedence)

---

## Main Commands

### Basic Usage

```bash
ax-cli [options]
```

### Options

| Flag | Long Form | Description | Example |
|------|-----------|-------------|---------|
| `-V` | `--version` | Output version number | `ax-cli -V` |
| `-d` | `--directory <dir>` | Set working directory | `ax-cli -d /path/to/project` |
| `-k` | `--api-key <key>` | API key (or YOUR_API_KEY env var) | `ax-cli -k your_api_key` |
| `-u` | `--base-url <url>` | API base URL (or AI_BASE_URL env var) | `ax-cli -u https://api.example.com/v1` |
| `-m` | `--model <model>` | AI model to use (or AI_MODEL env var) | `ax-cli -m glm-4.6` |
| `-p` | `--prompt <prompt>` | Single prompt (headless mode) | `ax-cli -p "list TypeScript files"` |
| | `--max-tool-rounds <rounds>` | Max tool execution rounds (default: 400) | `ax-cli --max-tool-rounds 50` |
| `-h` | `--help` | Display help | `ax-cli -h` |

### Mode Types

#### Interactive Mode (Default)
Starts a conversational AI session where you can have multi-turn conversations:

```bash
# Basic usage (uses glm-4.6 by default)
ax-cli

# Specify working directory
ax-cli --directory /path/to/project

# Use specific model
ax-cli --model grok-code-fast-1
ax-cli --model gpt-4o

# Connect to Z.AI
ax-cli --base-url https://api.z.ai/v1 --model glm-4.6

# Offline mode with Ollama
ax-cli --model llama3.1 --base-url http://localhost:11434/v1
```

#### Headless Mode (Scriptable)
Processes a single prompt and exits - perfect for CI/CD and automation:

```bash
# Basic headless execution
ax-cli --prompt "show me the package.json file"

# Short form
ax-cli -p "list all TypeScript files in src/"

# With working directory
ax-cli -p "run npm test" -d /path/to/project

# Control tool execution rounds
ax-cli -p "comprehensive code refactoring" --max-tool-rounds 50

# Combine with shell scripting
RESULT=$(ax-cli -p "count lines of code in src/") && echo $RESULT
```

### Tool Execution Control

Fine-tune AI behavior with configurable tool execution limits:

```bash
# Fast responses for simple queries (limit: 10 rounds)
ax-cli --max-tool-rounds 10 -p "show current directory"

# Complex automation (limit: 500 rounds)
ax-cli --max-tool-rounds 500 -p "refactor entire codebase"

# Works with all modes
ax-cli --max-tool-rounds 20                    # Interactive mode
ax-cli -p "task" --max-tool-rounds 30          # Headless mode
ax-cli git commit-and-push --max-tool-rounds 30 # Git commands
```

**Default**: 400 rounds (sufficient for most tasks)

---

## Setup Command

### Description
Initialize AX CLI configuration with z.ai and GLM 4.6. Creates `~/.ax-cli/config.json` with your API key and default settings.

### Syntax

```bash
ax-cli setup [options]
```

### Options

| Flag | Long Form | Description | Default |
|------|-----------|-------------|---------|
| | `--force` | Overwrite existing configuration | false |
| `-h` | `--help` | Display help for command | |

### Configuration Created

The setup command creates `~/.ax-cli/config.json` with the following defaults:

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

### Examples

```bash
# Initial setup (prompts for API key)
ax-cli setup

# Force overwrite existing configuration
ax-cli setup --force
```

### What It Does

1. Checks if `~/.ax-cli/config.json` exists
2. If exists, prompts for confirmation (unless `--force`)
3. Prompts for your z.ai API key (hidden input)
4. Creates configuration directory if needed
5. Writes configuration with GLM 4.6 defaults
6. Shows helpful next steps

### Next Steps After Setup

After running setup, you can:

```bash
# Start interactive mode
ax-cli

# Run a quick test
ax-cli -p "Hello, introduce yourself"

# Initialize a project
ax-cli init
```

---

## Init Command

### Description
Initialize AX CLI for your project with intelligent analysis. Analyzes project structure, dependencies, build configuration, and generates custom instructions for improved context awareness.

### Syntax

```bash
ax-cli init [options]
```

### Options

| Flag | Long Form | Description | Default |
|------|-----------|-------------|---------|
| `-f` | `--force` | Force regeneration even if files exist | false |
| `-v` | `--verbose` | Verbose output showing analysis details | false |
| `-d` | `--directory <dir>` | Project directory to analyze | Current directory |

### Generated Files

- **`.ax-cli/CUSTOM.md`** - Project-specific custom instructions with tech stack details, build scripts, and architectural patterns
- **`.ax-cli/index.json`** - Fast project reference index with file structure and key metadata

### Analysis Capabilities

The init command intelligently analyzes your project for:

- **Project Metadata**: Name, type (web app, library, monorepo, etc.), primary language
- **Dependencies**: Package manager, major frameworks, libraries
- **Build Configuration**: Test, build, lint, and dev commands
- **Tech Stack**: Identified technologies and frameworks
- **Project Structure**: Directory organization and key files

### Examples

```bash
# Initialize current project
ax-cli init

# Force regeneration and show verbose output
ax-cli init --force --verbose

# Analyze specific project directory
ax-cli init -d /path/to/project

# Combine options
ax-cli init --directory /path/to/project --force --verbose
```

### Use Cases

- **New Project Setup**: Get started with automatic context
- **Existing Projects**: Update instructions as project evolves
- **Team Onboarding**: Share `.ax-cli/` with team members
- **Custom Instructions**: Enhance AI behavior for specific projects

---

## Update Command

### Description
Check for updates and upgrade AX CLI to the latest version. Supports both checking for available updates and automatic installation.

### Syntax

```bash
ax-cli update [options]
```

### Options

| Flag | Long Form | Description | Default |
|------|-----------|-------------|---------|
| `-c` | `--check` | Only check for updates without installing | false |
| `-y` | `--yes` | Skip confirmation prompt and install | false |

### Examples

```bash
# Check for updates
ax-cli update --check

# Update to latest version with confirmation
ax-cli update

# Update to latest version without confirmation
ax-cli update --yes

# Check without installing
ax-cli update -c
```

### Use Cases

- **Maintenance**: Keep AX CLI up to date
- **CI/CD Integration**: Automated updates with `--yes` flag
- **Version Checking**: Verify available versions before updating

---

## MCP Commands

### Description
Model Context Protocol (MCP) server management. Add, list, test, remove, and manage MCP servers that extend AX CLI capabilities.

### Syntax

```bash
ax-cli mcp <command> [options]
```

### Commands

| Command | Description | Example |
|---------|-------------|---------|
| `add <name>` | Add MCP server | `ax-cli mcp add linear` |
| `add-json <name>` | Add from JSON config | `ax-cli mcp add-json custom` |
| `list` | List all configured servers | `ax-cli mcp list` |
| `test <name>` | Test server connection | `ax-cli mcp test linear` |
| `remove <name>` | Remove server | `ax-cli mcp remove linear` |
| `info <name>` | View server details | `ax-cli mcp info linear` |

### Add Options

| Flag | Description | Applies To |
|------|-------------|-----------|
| `--transport <type>` | Transport type: `stdio`, `http`, or `sse` | All |
| `--command <cmd>` | Command to run | stdio only |
| `--args <args...>` | Command arguments (space-separated) | stdio only |
| `--url <url>` | Server URL | http, sse only |
| `--env <key=val...>` | Environment variables (space-separated) | All |

### Transport Types

#### Stdio
Standard input/output based communication:
```bash
ax-cli mcp add my-server \
  --transport stdio \
  --command "bun" \
  --args "server.js" \
  --env "API_KEY=xyz"
```

#### HTTP
HTTP-based REST API communication:
```bash
ax-cli mcp add my-api \
  --transport http \
  --url "https://api.example.com/mcp" \
  --env "API_KEY=xyz"
```

#### SSE
Server-Sent Events for streaming communication:
```bash
ax-cli mcp add linear \
  --transport sse \
  --url "https://mcp.linear.app/sse"
```

### Examples

```bash
# Add Linear MCP server (SSE)
ax-cli mcp add linear --transport sse --url https://mcp.linear.app/sse

# Add GitHub MCP server (Stdio)
ax-cli mcp add github \
  --transport stdio \
  --command "npx" \
  --args "@modelcontextprotocol/server-github"

# Add custom server with environment variables
ax-cli mcp add custom \
  --transport http \
  --url http://localhost:3000 \
  --env "API_KEY=key123" "USER=admin"

# List all configured servers
ax-cli mcp list

# Test server connection
ax-cli mcp test linear

# View server details
ax-cli mcp info github

# Remove server
ax-cli mcp remove linear
```

### Configuration

MCP servers are configured in `.ax-cli/settings.json`:

```json
{
  "mcpServers": {
    "linear": {
      "transport": "sse",
      "url": "https://mcp.linear.app/sse"
    },
    "github": {
      "transport": "stdio",
      "command": "npx",
      "args": ["@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_TOKEN": "your_token_here"
      }
    }
  }
}
```

---

## Interactive Mode Slash Commands

When running AX CLI in interactive mode, use slash commands for special operations. Press `/` to see autocomplete suggestions.

### Built-in Commands

| Command | Description | Example |
|---------|-------------|---------|
| `/help` | Show help information about all commands and features | `/help` |
| `/clear` | Clear chat history and reset session state | `/clear` |
| `/init` | Initialize project with smart analysis | `/init` |
| `/models` | Switch between available AI models | `/models` |
| `/commit-and-push` | AI-generated commit message and push to remote | `/commit-and-push` |
| `/exit` | Exit the application | `/exit` |

### Command Details

#### `/help`
Displays comprehensive help information including:
- All built-in commands
- Git commands
- Enhanced input features (keyboard shortcuts)
- Direct command list
- Model configuration options

**Trigger**: Type `/help` and press Enter

#### `/clear`
Clears the chat history and resets all session state. Useful for starting fresh or removing context:
- Clears conversation history
- Resets processing states
- Resets confirmation service flags
- Clears input buffer

**Trigger**: Type `/clear` and press Enter

#### `/init`
Initializes the current project with intelligent analysis (same as `ax-cli init` command):
- Analyzes project structure
- Identifies tech stack
- Generates custom instructions
- Creates project index

**Use When**: Starting work on a new project or after significant project changes

**Trigger**: Type `/init` and press Enter

#### `/models`
Opens interactive model selection menu:
- Shows all available models
- Allows selection with arrow keys
- Switches context to selected model
- Remembers selection for session

**Use When**: You want to switch AI models during conversation

**Trigger**: Type `/models` and press Enter, then use arrow keys to select

**Alternative**: Use `/models <model-name>` to switch directly

```bash
/models glm-4.6          # Switch directly to glm-4.6
/models grok-code-fast-1 # Switch directly to grok-code-fast-1
```

#### `/commit-and-push`
Automated AI-powered git workflow:
1. Checks for uncommitted changes
2. Stages all changes (`git add .`)
3. Generates intelligent commit message using AI
4. Creates commit with generated message
5. Pushes to remote (sets upstream if needed)

**Prerequisites**:
- Git repository initialized
- Uncommitted changes available
- Appropriate git permissions

**Trigger**: Type `/commit-and-push` and press Enter

**Workflow Example**:
```
AX> /commit-and-push

[Analyzes changes and generates commit message]
Generated commit message: "feat: Add new authentication endpoint"

Changes staged successfully
Commit successful
Push successful
```

#### `/exit`
Gracefully exits AX CLI. Same as pressing Ctrl+C twice.

**Trigger**: Type `/exit` and press Enter

---

## Enhanced Input Features

Interactive mode provides advanced input handling features similar to shell environments.

### Keyboard Shortcuts

| Shortcut | Description | Use Case |
|----------|-------------|----------|
| **↑/↓ Arrow** | Navigate command history | Repeat previous commands |
| **Ctrl+C** | Clear input (press twice to exit) | Cancel current input |
| **Ctrl+←/→** | Move by word | Navigate faster in long inputs |
| **Ctrl+A** | Move to line start | Jump to beginning |
| **Ctrl+E** | Move to line end | Jump to end |
| **Ctrl+W** | Delete word before cursor | Remove last word |
| **Ctrl+K** | Delete to end of line | Clear from cursor forward |
| **Ctrl+U** | Delete to start of line | Clear from cursor backward |
| **Shift+Tab** | Toggle auto-edit mode | Bypass confirmation prompts |
| **Escape** | Close suggestions/menus | Cancel autocomplete |

### Command Suggestions

Autocomplete suggestions appear when typing:
- **`/` prefix** - Suggests all available slash commands
- **Arrow keys** - Navigate suggestions
- **Tab or Enter** - Select highlighted suggestion
- **Escape** - Close suggestion menu

### History Navigation

- **Up Arrow** - Previous command in history
- **Down Arrow** - Next command in history
- **Ctrl+R** - Search command history (standard readline)

### Auto-Edit Mode

Toggle with **Shift+Tab** to:
- Skip confirmation dialogs
- Auto-approve file edits
- Fast-track tool execution
- Useful for scripted or automated workflows

---

## Direct Bash Commands

Execute standard shell commands directly in interactive mode (without prompting the AI):

| Command | Description | Example |
|---------|-------------|---------|
| `ls` | List directory contents | `ls src/` |
| `pwd` | Show current directory | `pwd` |
| `cd` | Change directory | `cd src/` |
| `cat` | View file contents | `cat package.json` |
| `mkdir` | Create directory | `mkdir new-folder` |
| `touch` | Create empty file | `touch test.txt` |
| `echo` | Print text | `echo "Hello"` |
| `grep` | Search text | `grep "TODO" src/*.ts` |
| `find` | Find files | `find src -name "*.ts"` |
| `cp` | Copy file/directory | `cp file.txt backup.txt` |
| `mv` | Move/rename | `mv old.js new.js` |
| `rm` | Remove file | `rm test.txt` |

### Examples

```bash
# View project structure
ls -la

# Check current directory
pwd

# Navigate to src directory
cd src

# View package.json
cat package.json

# Create new directory
mkdir components

# Create new file
touch README.md

# Search for TODOs
grep -r "TODO" .

# Find all TypeScript files
find . -name "*.ts" -type f

# Copy configuration
cp .env.example .env

# Rename file
mv oldname.js newname.js

# Remove temporary file
rm temp.txt
```

---

## Usage Examples

### Interactive Session Examples

```bash
# Start basic interactive session
ax-cli

# Work in specific project
ax-cli -d /path/to/project

# Use faster model for quick iterations
ax-cli -m grok-code-fast-1

# Use local LLM with Ollama
ax-cli -m llama3.1 --base-url http://localhost:11434/v1

# Example interactive session flow:
# AX> Show me the package.json file
# [Displays package.json contents]
#
# AX> Create a new TypeScript file called utils.ts with helper functions
# [Creates the file with intelligent content]
#
# AX> Run npm test and show me the results
# [Executes tests and displays output]
```

### Headless Mode Examples

```bash
# List TypeScript files
ax-cli -p "list all TypeScript files in src/"

# Run tests
ax-cli -p "run npm test" -d /path/to/project

# Code refactoring
ax-cli -p "refactor UserService to use dependency injection" --max-tool-rounds 50

# Documentation generation
ax-cli -p "Generate API documentation for all exported functions in src/"

# Code analysis
ax-cli -p "Review all TypeScript files in src/ and suggest architectural improvements"

# CI/CD integration
ANALYSIS=$(ax-cli -p "analyze code quality" -d /project)
echo "Quality Report: $ANALYSIS"
```

### Model Selection Examples

```bash
# Default GLM model with reasoning
ax-cli

# Fast iterations with code-focused model
ax-cli -m grok-code-fast-1

# Local model with Ollama
ax-cli -m glm4:9b -u http://localhost:11434/v1

# Remote provider (OpenRouter)
ax-cli -m anthropic/claude-3.5-sonnet -u https://openrouter.ai/api/v1

# Custom provider
ax-cli -m custom-model -u http://localhost:8000/v1 -k $API_KEY
```

### Project Initialization Examples

```bash
# Analyze current project
ax-cli init

# Force regenerate project analysis
ax-cli init --force

# Verbose output with analysis details
ax-cli init --verbose

# Analyze different project
ax-cli init -d /path/to/project

# Comprehensive analysis with all options
ax-cli init --directory /path/to/project --force --verbose
```

### MCP Server Examples

```bash
# Set up Linear integration
ax-cli mcp add linear --transport sse --url https://mcp.linear.app/sse

# Add GitHub integration
ax-cli mcp add github \
  --transport stdio \
  --command "npx" \
  --args "@modelcontextprotocol/server-github"

# Add custom local server
ax-cli mcp add my-custom \
  --transport stdio \
  --command "node" \
  --args "server.js" \
  --env "API_KEY=secret123"

# Test connection
ax-cli mcp test linear

# View configuration
ax-cli mcp info github

# List all servers
ax-cli mcp list

# Remove server
ax-cli mcp remove linear
```

### Tool Execution Control Examples

```bash
# Fast, simple queries
ax-cli --max-tool-rounds 10 -p "show current directory"

# Standard usage
ax-cli --max-tool-rounds 400  # default

# Complex operations
ax-cli --max-tool-rounds 500 -p "refactor entire codebase"

# Headless with custom limit
ax-cli -p "create comprehensive test suite" --max-tool-rounds 75
```

### Git Integration Examples

```bash
# In interactive mode, use the command:
/commit-and-push

# Or run from command line:
ax-cli git commit-and-push

# With custom tool limit for complex operations
ax-cli git commit-and-push --max-tool-rounds 30
```

---

## Configuration Precedence

Configuration follows a strict precedence order (highest to lowest):

```
CLI Flags
    ↓
Environment Variables
    ↓
Project Settings (.ax-cli/settings.json)
    ↓
User Settings (~/.ax-cli/config.json)
    ↓
System Defaults
```

### Example Precedence

```bash
# 1. CLI flag (highest priority)
ax-cli -m glm-4.6 -k your_key

# 2. Environment variable
AI_MODEL=grok-code-fast-1 ax-cli

# 3. Project settings (.ax-cli/settings.json)
# { "model": "grok-code-fast-1" }

# 4. User settings (~/.ax-cli/config.json)
# { "apiKey": "user_key", "model": "glm-4.6" }

# 5. System defaults
# Model: glm-4.6, Base URL: https://api.x.ai/v1
```

### Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `YOUR_API_KEY` | API key for authentication | `export YOUR_API_KEY=your_key` |
| `AI_BASE_URL` | API endpoint URL | `export AI_BASE_URL=https://api.x.ai/v1` |
| `AI_MODEL` | Default AI model | `export AI_MODEL=glm-4.6` |
| `AI_MAX_TOKENS` | Maximum response tokens | `export AI_MAX_TOKENS=8192` |
| `AI_TEMPERATURE` | Response creativity (0-2) | `export AI_TEMPERATURE=0.7` |

---

## Tips and Tricks

### Working Efficiently

1. **Use Headless Mode for CI/CD**
   ```bash
   ax-cli -p "analyze this codebase" -d /project
   ```

2. **Leverage Model Selection**
   - Use `glm-4.6` for complex reasoning
   - Use `grok-code-fast-1` for quick iterations

3. **Control Tool Execution**
   ```bash
   # Start with low rounds for testing
   ax-cli -p "task" --max-tool-rounds 10

   # Increase for complex operations
   ax-cli -p "task" --max-tool-rounds 100
   ```

4. **Initialize Projects for Better Context**
   ```bash
   ax-cli init  # Generates custom instructions
   ax-cli       # Use improved context
   ```

5. **Auto-Edit Mode for Automation**
   - Press `Shift+Tab` to toggle
   - Skips confirmation dialogs
   - Useful for scripted workflows

### Debugging

1. **Enable Verbose Output**
   ```bash
   ax-cli init --verbose  # See analysis details
   ```

2. **Test MCP Connections**
   ```bash
   ax-cli mcp test server-name  # Verify setup
   ```

3. **Check Configurations**
   ```bash
   ls ~/.ax-cli/          # View user settings
   ls .ax-cli/            # View project settings
   ```

---

## Common Use Cases

### Code Review
```bash
ax-cli -p "Review src/components/User.tsx and suggest improvements"
```

### Test Generation
```bash
ax-cli -p "Generate comprehensive tests for the auth module"
```

### Documentation
```bash
ax-cli -p "Generate API documentation from JSDoc comments in src/"
```

### Refactoring
```bash
ax-cli -p "Refactor this codebase to use TypeScript strict mode" --max-tool-rounds 50
```

### Debugging
```bash
ax-cli  # Start interactive session
/help   # View available commands
# Describe your issue in natural language
```

### Automation
```bash
#!/bin/bash
ax-cli -p "Run full test suite" -d /project && \
ax-cli -p "Build production bundle" -d /project && \
echo "Build complete"
```

---

## Troubleshooting

### Command Not Found
Ensure AX CLI is properly installed and in your PATH:
```bash
npm install -g @defai.digital/ax-cli
# Or use: npx ax-cli
```

### Model Not Available
Check available models:
```bash
ax-cli /models  # In interactive mode
ax-cli -m glm-4.6  # Verify model name
```

### API Key Issues
```bash
# Check environment variable
echo $YOUR_API_KEY

# Or provide via flag
ax-cli -k your_api_key
```

### MCP Server Connection Failed
```bash
# Test server connection
ax-cli mcp test server-name

# Check server configuration
ax-cli mcp info server-name

# Verify settings
cat .ax-cli/settings.json
```

---

## Related Documentation

- **[GLM 4.6 Usage Guide](./glm-4.6-usage-guide.md)** - Detailed GLM model features
- **[GLM 4.6 Migration Guide](./glm-4.6-migration-guide.md)** - Upgrading to GLM 4.6
- **Main README** - Project overview and features
- **[MCP Protocol](https://modelcontextprotocol.io)** - Official MCP documentation

---

**Last Updated**: November 2024
**Version**: Compatible with AX CLI 1.0.1+
