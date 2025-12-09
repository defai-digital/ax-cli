# AX CLI Usage Guide

A comprehensive guide to using AX CLI for interactive sessions, headless automation, workflows, and best practices.

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Interactive Mode](#interactive-mode)
3. [Headless Mode](#headless-mode)
4. [Tool Execution Control](#tool-execution-control)
5. [Common Workflows](#common-workflows)
6. [Working with Large Content](#working-with-large-content)
7. [Best Practices](#best-practices)
8. [Tips and Tricks](#tips-and-tricks)
9. [Real-World Scenarios](#real-world-scenarios)
10. [Troubleshooting](#troubleshooting)

---

## Getting Started

### Basic Setup

Before diving into usage, ensure you have AX CLI installed and configured:

```bash
# Verify installation
ax-cli --version

# Check your setup
ax-cli --help
```

### Quick Model Selection

AX CLI supports multiple models out of the box:

```bash
# Default: GLM 4.6 (recommended for complex tasks)
ax-cli

# Fast responses: Grok Code Fast
ax-cli --model grok-code-fast-1

# Local: Ollama
ax-cli --model llama3.1 --base-url http://localhost:11434/v1
```

---

## Interactive Mode

Interactive mode is ideal for exploratory work, debugging, learning, and multi-turn conversations where you need to refine requests based on responses.

### Starting Interactive Sessions

```bash
# Basic interactive mode (uses default model)
ax-cli

# With specific model
ax-cli --model grok-code-fast-1

# With working directory
ax-cli --directory /path/to/project

# With custom base URL (for cloud or local providers)
ax-cli --base-url https://api.z.ai/v1 --model glm-4.6

# With Ollama (offline)
ax-cli --model llama3.1 --base-url http://localhost:11434/v1
```

### Example Interactive Session

```
$ ax-cli

AX> Show me the package.json file

[AX reads and displays package.json with syntax highlighting]

AX> What's the project type and main dependencies?

[AX analyzes and summarizes the project]

AX> Create a new TypeScript file called utils.ts with helper functions

[AX creates the file with intelligent content based on project context]

AX> Run npm test and show me the results

[AX executes the test command and displays formatted output]

AX> Fix the failing test in test-utils.ts

[AX analyzes errors and applies fixes]

AX> exit
```

### Interactive Session Tips

1. **Ask follow-up questions** - Refine responses based on what you learn
2. **Reference files** - Ask to "show me" or "explain" specific files
3. **Execute and verify** - Run commands and see real-time results
4. **Build context** - Have AX CLI understand your project structure
5. **Iterate** - Gradually improve code through multiple refinements

### When to Use Interactive Mode

- **Debugging**: Step through issues with back-and-forth conversation
- **Learning**: Ask questions and explore your codebase
- **Exploration**: Discover project structure and conventions
- **Refinement**: Iteratively improve generated code
- **Complex Tasks**: Break down larger tasks into smaller steps

---

## Headless Mode

Headless mode processes a single prompt and exits immediately, making it perfect for automation, CI/CD pipelines, and scripting.

### Basic Headless Execution

```bash
# Basic headless execution
ax-cli --prompt "show me the package.json file"

# Short form
ax-cli -p "list all TypeScript files in src/"

# With working directory
ax-cli -p "run npm test" --directory /path/to/project

# With model selection
ax-cli -p "analyze code quality" --model grok-code-fast-1

# Control complexity with tool rounds
ax-cli -p "comprehensive code refactoring" --max-tool-rounds 50
```

### Headless with Shell Integration

```bash
# Capture output
RESULT=$(ax-cli -p "count lines of code in src/")
echo "$RESULT"

# Process result in script
if ax-cli -p "check if all tests pass" | grep -q "success"; then
  echo "All tests passed!"
fi

# Use in pipe chains
ax-cli -p "generate documentation" | tee docs/generated.md

# Loop through tasks
for task in "lint" "format" "type-check"; do
  ax-cli -p "run $task" -d /path/to/project
done

# Parallel execution
ax-cli -p "analyze module A" &
ax-cli -p "analyze module B" &
wait
```

### CI/CD Pipeline Examples

#### GitHub Actions

```yaml
name: Code Analysis with AX CLI

on: [push, pull_request]

jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '24'

      - run: npm install -g @defai.digital/ax-cli

      - name: Run code analysis
        env:
          YOUR_API_KEY: ${{ secrets.YOUR_API_KEY }}
        run: |
          ax-cli -p "analyze code quality and suggest improvements" \
            -d ${{ github.workspace }} \
            --max-tool-rounds 30

      - name: Check tests
        run: ax-cli -p "run all tests and report results"

      - name: Generate documentation
        run: |
          ax-cli -p "generate API documentation" > docs/api.md
          git add docs/api.md
```

#### GitLab CI

```yaml
code_analysis:
  image: node:24
  script:
    - npm install -g @defai.digital/ax-cli
    - ax-cli -p "analyze this project and suggest improvements"
    - ax-cli -p "run all tests" --max-tool-rounds 20
  artifacts:
    paths:
      - reports/
```

### Headless Use Cases

- **CI/CD Pipelines**: Automate code analysis, testing, linting
- **Shell Scripts**: Integrate AI into bash automation
- **Batch Processing**: Process multiple prompts programmatically
- **Terminal Benchmarks**: Non-interactive execution for performance tools
- **Cron Jobs**: Scheduled AI-driven tasks

---

## Tool Execution Control

AX CLI uses a "tool rounds" system to control how many times it can execute tools (file operations, commands, etc.). This affects both response speed and capability.

### Understanding Tool Rounds

- **1 round** = 1 tool call (read file, execute command, etc.)
- **Default**: 400 rounds (sufficient for most tasks)
- **Range**: 1-500 rounds recommended

### Tool Round Strategy

```bash
# Fast responses for simple queries (limit: 10 rounds)
ax-cli --max-tool-rounds 10 -p "show current directory"

# Medium tasks (limit: 30 rounds)
ax-cli --max-tool-rounds 30 -p "run tests and show results"

# Complex automation (limit: 100-200 rounds)
ax-cli --max-tool-rounds 150 -p "refactor code with multiple changes"

# Comprehensive tasks (limit: 300-500 rounds)
ax-cli --max-tool-rounds 500 -p "refactor entire codebase to TypeScript"
```

### Works With All Modes

```bash
# Interactive mode
ax-cli --max-tool-rounds 100

# Headless mode
ax-cli -p "task" --max-tool-rounds 50

# With specific model
ax-cli --model grok-code-fast-1 --max-tool-rounds 20
```

### Choosing the Right Limit

| Task Type | Recommended | Example |
|-----------|-------------|---------|
| Simple queries | 5-10 | "show me the README" |
| Single file operations | 15-20 | "create a new util file" |
| Multi-file changes | 30-50 | "refactor this component" |
| Complex refactoring | 100-200 | "add TypeScript to JavaScript files" |
| Full codebase changes | 300-500 | "migrate entire project" |

---

## Common Workflows

### Workflow 1: Code Review & Analysis

```bash
# Interactive review session
ax-cli -d /path/to/project

AX> Review the main application logic in src/index.ts

AX> What are potential issues with error handling?

AX> Suggest improvements for performance

AX> Show me examples of the fixes
```

### Workflow 2: Bug Investigation

```bash
# Start session
ax-cli -d /path/to/project

AX> Show me the error trace from the logs

AX> Which files are involved in this error?

AX> What's causing this bug?

AX> Create a fix with proper error handling

AX> Run the tests to verify the fix
```

### Workflow 3: Feature Implementation

```bash
# Multi-step feature development
ax-cli -d /path/to/project

AX> Create a new feature for user authentication

AX> What's the current project structure?

AX> Based on the structure, show me where to add the auth logic

AX> Create the necessary files with proper types

AX> Add tests for the authentication logic

AX> Run the tests and show any failures
```

### Workflow 4: Refactoring with Verification

```bash
# Refactor with multiple verification steps
ax-cli -d /path/to/project

AX> Refactor utils.ts to improve readability

AX> Add TypeScript types to all functions

AX> Run the test suite to ensure nothing broke

AX> Show me the coverage report

AX> What could be improved further?
```

### Workflow 5: Documentation Generation

```bash
# Generate project documentation
ax-cli -p "generate comprehensive API documentation for src/" \
  -d /path/to/project \
  --max-tool-rounds 100 > docs/api.md

# Generate README from code analysis
ax-cli -p "create a detailed README with setup, usage, and API reference" \
  -d /path/to/project > README.md
```

### Workflow 6: Migration Projects

```bash
# Migrate JavaScript to TypeScript
ax-cli -p "convert all JavaScript files in src/ to TypeScript with proper type annotations" \
  -d /path/to/project \
  --max-tool-rounds 200

# Test after migration
ax-cli -p "run all tests and report any failures" -d /path/to/project

# Fix any issues
ax-cli -p "fix any TypeScript compilation errors" -d /path/to/project
```

### Workflow 7: Performance Optimization

```bash
# Interactive optimization session
ax-cli -d /path/to/project

AX> Profile the application and identify bottlenecks

AX> Which functions are slowest?

AX> Optimize the top 3 slowest functions

AX> Run benchmarks to verify improvements

AX> Document the optimizations
```

---

## Working with Large Content

### Understanding Terminal Input Limitations

When working with large amounts of text (code files, logs, error outputs, documentation), be aware of terminal paste limitations:

**Terminal Paste Behavior:**
- Most terminals have buffer limits for pasted content
- **VS Code integrated terminal** is particularly prone to truncating long pastes (confirmed limitation)
- Truncation is often **silent** - content may be cut off without warning
- Modern terminals (iTerm2, Terminal.app) handle larger pastes better, but still have limits

**AX CLI Visual Feedback:**

The interactive terminal shows a character counter `[count/2000]` with color-coded warnings:

| Color | Character Range | Status | Action |
|-------|----------------|--------|--------|
| **Gray** | 0-999 | ✅ Optimal | Continue normally |
| **Cyan** | 1000-1599 | ⚠️ Getting long | Consider file-based approach |
| **Yellow** | 1600-1999 | ⚠️ Warning zone | Switch to file-based workflow |
| **Red** | 2000+ | ❌ Too large | Must use file-based workflow |

### File-Based Workflows (Recommended)

**❌ DON'T DO THIS:**
```bash
# Pasting 5000+ lines of code directly into terminal
ax-cli
> [paste massive code dump]  # May be silently truncated!
```

**✅ DO THIS INSTEAD:**

#### Option 1: Save to File First (Most Reliable)
```bash
# Save your content to a temporary file
cat > /tmp/large-context.txt
# (paste your content, then press Ctrl+D)

# Then reference in AX CLI
ax-cli
> /memory add /tmp/large-context.txt
> analyze the content I just added
> identify all the errors and suggest fixes
```

#### Option 2: Direct File Reference (Headless Mode)
```bash
# For existing files
ax-cli --file path/to/large-file.ts --prompt "review this code for bugs"

# For command output
ax-cli --prompt "analyze these errors: $(npm test 2>&1)"

# For multiple files
ax-cli --file src/index.ts --file src/utils.ts --prompt "refactor these modules"
```

#### Option 3: Use Memory System
```bash
# Add entire directories or specific files to context
ax-cli
> /memory add src/
> /memory add logs/error.log
> /memory add docs/api.md
> analyze all the code and documentation I just loaded
```

#### Option 4: Piping for Automation
```bash
# Process command output directly
npm test 2>&1 | tee test-output.txt
ax-cli --prompt "analyze the test failures in test-output.txt"

# Or save and reference
git diff > changes.patch
ax-cli --file changes.patch --prompt "review these changes"
```

### Real-World Examples

**Scenario 1: Analyzing Build Errors**
```bash
# ❌ Bad: Paste 200 lines of build output into terminal
# ✅ Good:
npm run build 2>&1 | tee build-errors.txt
ax-cli --file build-errors.txt --prompt "explain these TypeScript errors and how to fix them"
```

**Scenario 2: Code Review of Large Files**
```bash
# ❌ Bad: Copy/paste entire 1000-line file
# ✅ Good:
ax-cli --file src/complex-module.ts --prompt "review this code for performance issues"
```

**Scenario 3: Processing Log Files**
```bash
# ❌ Bad: Paste log file contents
# ✅ Good:
ax-cli
> /memory add logs/application.log
> find all ERROR entries and explain what's causing them
```

**Scenario 4: API Documentation Analysis**
```bash
# ❌ Bad: Paste entire API spec
# ✅ Good:
ax-cli --file openapi.yaml --prompt "generate TypeScript types from this API spec"
```

### When You Can Paste Safely

Short, focused inputs work well with direct pasting:

**✅ Safe to paste:**
- Error messages (<500 chars)
- Code snippets (<1000 chars)
- Configuration samples (<1500 chars)
- Questions with context (<1000 chars)

**Example:**
```
> I'm getting this error:
  TypeError: Cannot read property 'map' of undefined
    at processData (utils.ts:45)
  How do I fix this?
```

### Platform-Specific Considerations

| Terminal | Max Recommended Paste | Notes |
|----------|----------------------|-------|
| **VS Code** | 2000 chars | High truncation risk, use files |
| **iTerm2** | 10,000 chars | Good paste support |
| **Terminal.app** | 5000 chars | macOS default, moderate support |
| **Alacritty** | 10,000 chars | Modern, fast, good paste handling |
| **Windows Terminal** | 5000 chars | Improving with recent versions |

### Troubleshooting Paste Issues

**Problem:** "My pasted content seems cut off"
```bash
# Solution: Use file-based approach
echo "your content" > temp.txt
ax-cli --file temp.txt --prompt "your question"
```

**Problem:** "Terminal freezes when pasting"
```bash
# Solution: Save to file instead
cat > input.txt  # paste here, Ctrl+D
ax-cli --file input.txt --prompt "process this"
```

**Problem:** "Lost content, not sure what was sent"
```bash
# Solution: Always save first for large content
# Create a habit of: save → reference → query
cat > context.txt
ax-cli --file context.txt --prompt "analyze"
```

### Automatic Paste Protection (Phase 3)

**Default Protection**:
- Pastes >5000 characters are automatically truncated
- Clear notification shows original → truncated size
- Prevents silent data loss from terminal buffer limits

**Configuration**:
```json
// ~/.ax-cli/config.json
{
  "paste": {
    "allowLargePaste": false,     // Enable/disable truncation (default: false)
    "maxPasteLength": 5000,        // Truncation threshold (default: 5000)
    "warningThreshold": 1000       // Warning threshold (default: 1000)
  }
}
```

**When to Disable Truncation**:
- You use a modern terminal (iTerm2, Alacritty, Terminal.app)
- You frequently work with 5000-10000 char pastes
- You understand terminal buffer risks

**When to Keep Truncation Enabled** (Recommended):
- You use VS Code integrated terminal (high truncation risk)
- You're unsure about your terminal's paste capabilities
- You want guaranteed predictable behavior

**Configuration Examples**:

```json
// Conservative (default) - Best for most users
{
  "paste": {
    "allowLargePaste": false,
    "maxPasteLength": 5000
  }
}

// Permissive - For modern terminals only
{
  "paste": {
    "allowLargePaste": true,
    "maxPasteLength": 10000
  }
}

// Custom thresholds
{
  "paste": {
    "allowLargePaste": false,
    "maxPasteLength": 3000,
    "warningThreshold": 1500
  }
}
```

**Project-Level Overrides**:

You can override user settings per project in `.ax-cli/settings.json`:

```json
// .ax-cli/settings.json
{
  "model": "glm-4.6",
  "paste": {
    "allowLargePaste": true  // Override for this project only
  }
}
```

---

## Best Practices

### 1. Use Default Settings Wisely

```bash
# GLM 4.6's defaults are optimized for most use cases
ax-cli  # Just works

# Override only when needed
ax-cli --model grok-code-fast-1  # For speed
```

### 2. Enable Thinking Mode for Complex Tasks

```bash
# For deep reasoning (add to project settings)
# In .ax-cli/settings.json:
{
  "model": "glm-4.6"
  // Thinking mode is enabled by default for complex reasoning
}
```

### 3. Leverage Large Context

```bash
# Provide project context for better understanding
ax-cli

AX> Show me the project structure
AX> Explain the architecture
AX> Now, implement feature X
```

### 4. Monitor Token Usage

```bash
# Long sessions may use many tokens
# Break into smaller sessions if needed

# Or use headless mode for discrete tasks
ax-cli -p "task 1"
ax-cli -p "task 2"
ax-cli -p "task 3"
```

### 5. Validate Before Major Changes

```bash
# Verify understanding before execution
ax-cli

AX> Show me the structure of this class
AX> I want to refactor it like this (describe your idea)
AX> Does this approach make sense?
AX> OK, now make the changes
```

### 6. Use Project Initialization

```bash
# Initialize project for better performance
cd /path/to/project
ax-cli init

# AX CLI now understands your project structure
ax-cli  # 25-30% faster and more accurate
```

### 7. Set Working Directory Explicitly

```bash
# Avoid ambiguity
ax-cli --directory /exact/path/to/project

# Or from within the project directory
cd /path/to/project && ax-cli
```

### 8. Test Generated Code

```bash
# Always verify automated changes
ax-cli

AX> Generate function X
AX> Run tests to verify it works
AX> If tests fail, fix them
AX> Show me the final implementation
```

---

## Tips and Tricks

### Tip 1: Specific File Requests

```bash
# Be specific about what you want to see
AX> Show me the package.json file

# Instead of vague requests
AX> What dependencies do I have?

# More specific is usually better
AX> List all dependencies in package.json and explain their purpose
```

### Tip 2: Use Context Commands

```bash
AX> What's the project structure?
AX> What tech stack is being used?
AX> Show me the main entry point
AX> Explain the architecture in detail
```

### Tip 3: Break Complex Tasks

```bash
# Complex task broken into steps
AX> Create a TypeScript module for authentication

# Then verify and refine
AX> Add unit tests for the authentication module

# Then optimize
AX> Are there any security issues to address?

# Instead of one huge request
AX> Create a complete, production-ready authentication system
```

### Tip 4: Ask for Examples

```bash
AX> Show me an example of how to use this function

AX> What are some common patterns for this?

AX> Can you show me how other projects handle this?
```

### Tip 5: Request Format Preferences

```bash
AX> Generate the code with detailed comments

AX> Format the output as a table

AX> Show me the diff of what changed

AX> Create a summary at the top of the file
```

### Tip 6: Chain Commands in Headless

```bash
# Create a multi-step automation script
#!/bin/bash

echo "Step 1: Analyze code..."
ax-cli -p "analyze code quality" -d /path/to/project

echo "Step 2: Run tests..."
ax-cli -p "run all tests" -d /path/to/project

echo "Step 3: Generate docs..."
ax-cli -p "generate API documentation" -d /path/to/project

echo "Done!"
```

### Tip 7: Use Environment Variables

```bash
# Set defaults for your workflow
export AI_MODEL="grok-code-fast-1"
export AI_BASE_URL="http://localhost:11434/v1"

# Then use without specifying each time
ax-cli
ax-cli -p "list files"
```

### Tip 8: Combine with grep and Pipes

```bash
# Extract specific output
ax-cli -p "list all functions" -d /path/to/project | grep -i "async"

# Save to file
ax-cli -p "generate documentation" > docs/generated.md

# Process with other tools
ax-cli -p "analyze project" | jq '.recommendations'
```

### Tip 9: Profile Commands Before Automation

```bash
# Test in interactive mode first
ax-cli -d /path/to/project

AX> Try what you want to automate
AX> Verify it works as expected
AX> Then use in script/CI

# Once validated, use in automation
ax-cli -p "same request" -d /path/to/project --max-tool-rounds 30
```

### Tip 10: Use Shell Variables in Prompts

```bash
# Dynamic prompts
PROJECT_PATH="/path/to/my/project"
FILE_NAME="utils.ts"

ax-cli -p "analyze $FILE_NAME" -d "$PROJECT_PATH"

# With substitution
for model in glm-4.6 grok-code-fast-1 glm-4.6v; do
  echo "Testing with $model..."
  ax-cli -p "simple task" --model "$model"
done
```

---

## Real-World Scenarios

### Scenario 1: Code Review Before Commit

```bash
# Interactive code review session
ax-cli -d /my/project

AX> What files did I modify?

AX> Show me the changes in detail

AX> Review this code for potential issues

AX> Check for security vulnerabilities

AX> Suggest performance improvements

AX> Are there any type safety issues?
```

### Scenario 2: Onboarding to a New Codebase

```bash
# First time exploring a project
cd /new/project
ax-cli init

# Then explore
ax-cli

AX> What's this project about?

AX> What's the main architecture?

AX> Where would I start if I wanted to add a new feature?

AX> Can you explain the authentication flow?

AX> Show me how to run this project locally

AX> How do I add a new API endpoint?
```

### Scenario 3: Fixing a Production Bug

```bash
# Urgent bug fix workflow
ax-cli -d /production/project

AX> What's the error in the logs?

AX> Which files are involved in this error?

AX> Show me the relevant code sections

AX> What's causing this bug?

AX> Create a minimal fix

AX> Run tests to verify the fix doesn't break anything

AX> Show me the complete fix before I deploy
```

### Scenario 4: Automated Daily Analysis

```bash
#!/bin/bash
# daily-analysis.sh

PROJECT="/path/to/my/project"
DATE=$(date +%Y-%m-%d)

echo "=== Daily Code Analysis - $DATE ===" > report.txt

echo "Code Quality Check..." >> report.txt
ax-cli -p "analyze code quality and list issues" -d $PROJECT >> report.txt

echo "Test Coverage..." >> report.txt
ax-cli -p "check test coverage and suggest improvements" -d $PROJECT >> report.txt

echo "Security Scan..." >> report.txt
ax-cli -p "identify security vulnerabilities" -d $PROJECT >> report.txt

# Send report
mail -s "Daily Analysis - $DATE" team@example.com < report.txt
```

### Scenario 5: Multi-File Refactoring

```bash
# Complex refactoring with verification
ax-cli -d /code/project

AX> Show me the current file structure

AX> I want to refactor to use async/await throughout. Which files need changes?

AX> Start with the most critical files

AX> Refactor src/api.ts to use async/await

AX> Run tests after each change

AX> Now refactor src/utils.ts

AX> Fix any test failures

AX> Summary of changes made
```

### Scenario 6: Documentation Generation for New Release

```bash
# Generate documentation for release
ax-cli -d /code/project --max-tool-rounds 100

AX> Generate API documentation for all public functions

AX> Create a changelog comparing this to the last version

AX> Write setup instructions

AX> Document all configuration options

AX> Create troubleshooting guide for common issues
```

### Scenario 7: CI/CD Integration

```bash
#!/bin/bash
# ci-automation.sh

set -e

PROJECT="${GITHUB_WORKSPACE:-.}"

echo "Running code analysis..."
ax-cli -p "analyze code quality" -d "$PROJECT"

echo "Running linting..."
ax-cli -p "check code style and formatting" -d "$PROJECT"

echo "Running security scan..."
ax-cli -p "identify security issues" -d "$PROJECT"

echo "Generating documentation..."
ax-cli -p "update API documentation" -d "$PROJECT"

echo "All checks passed!"
```

### Scenario 8: Performance Optimization Project

```bash
# Multi-step performance improvement
ax-cli -d /code/project

AX> Analyze the performance bottlenecks in this project

AX> Which functions are slowest?

AX> Show me the code for the slowest functions

AX> Optimize these functions for performance

AX> Add caching where appropriate

AX> Run benchmarks to verify improvements

AX> Document the optimizations made
```

### Scenario 9: TypeScript Migration

```bash
# Convert JavaScript project to TypeScript
ax-cli -d /js-project --max-tool-rounds 200

AX> How should I structure this TypeScript migration?

AX> Start converting src/ files to TypeScript

# Check progress
ax-cli -p "report which files are TypeScript and which are still JavaScript" \
  -d /js-project

# Continue
AX> Continue converting remaining JavaScript files

AX> Fix any type errors

AX> Run the full test suite
```

### Scenario 10: Creating New Features with Tests

```bash
# TDD workflow with AX CLI
ax-cli -d /code/project

AX> I want to add user authentication. First, show me the current structure

AX> Create comprehensive tests for authentication

AX> Now implement the authentication feature

AX> Run the tests

AX> Fix any failing tests

AX> Review the implementation and tests
```

---

## Troubleshooting

### Issue: "Cannot find module" errors

```bash
# Ensure you're in the right directory
ax-cli --directory /correct/path/to/project

# Or verify the project is initialized
ax-cli init
ax-cli
```

### Issue: Commands timing out

```bash
# Reduce complexity
ax-cli -p "simpler task" --max-tool-rounds 20

# Or increase tool rounds if task is complex
ax-cli -p "complex task" --max-tool-rounds 200
```

### Issue: API key not recognized

```bash
# Verify environment variable
echo $YOUR_API_KEY

# Or pass directly
ax-cli --api-key "your-key" -p "test prompt"

# Check settings file
cat ~/.ax-cli/user-settings.json
```

### Issue: Model not found

```bash
# List available models
ax-cli -m invalid-model 2>&1

# Check your configuration
cat ~/.ax-cli/user-settings.json

# Verify model name is correct
ax-cli --model glm-4.6  # correct
ax-cli --model glm4.6   # might not work
```

### Issue: Offline mode not working

```bash
# Verify Ollama is running
curl http://localhost:11434/api/tags

# Check model is available
ollama list

# Try with correct format
ax-cli --base-url http://localhost:11434/v1 --model llama3.1
```

### Issue: File edits seem incomplete

```bash
# Increase tool rounds for complex tasks
ax-cli -p "complex multi-file refactoring" --max-tool-rounds 150

# Or use interactive mode for refinement
ax-cli
AX> Make these changes
AX> Continue with next part
```

### Issue: Getting generic responses

```bash
# Provide more context
AX> Show me the project structure first
AX> Analyze this specific file
AX> Now implement with that context

# Or use project initialization
ax-cli init
```

### Issue: Token usage seems high

```bash
# Use headless mode for single tasks (more efficient)
ax-cli -p "specific task"

# Break interactive sessions into focused conversations
ax-cli
AX> Do one thing at a time
# exit and start new session if needed

# Monitor usage with simpler models
ax-cli --model grok-code-fast-1 -p "quick task"
```

---

## Quick Reference

### Common Commands

```bash
# Interactive
ax-cli
ax-cli -d /path/to/project
ax-cli --model grok-code-fast-1

# Headless
ax-cli -p "prompt text"
ax-cli -p "prompt" -d /path/to/project
ax-cli -p "prompt" --model grok-code-fast-1

# Project initialization
ax-cli init
ax-cli init --force

# Configuration
ax-cli update
ax-cli update --check

# MCP servers
ax-cli mcp list
ax-cli mcp add github --transport stdio --args "@modelcontextprotocol/server-github"
```

### Model Selection

| Model | Speed | Reasoning | Best For |
|-------|-------|-----------|----------|
| glm-4.6 | Medium | Excellent | Complex tasks, deep reasoning |
| grok-code-fast-1 | Fast | Good | Quick code tasks, API requests |
| glm-4.6v | Medium | Excellent | Vision and multimodal tasks |
| llama3.1 | Depends | Good | Offline, local computation |

### File Structure

```
~/.ax-cli/
├── user-settings.json      # Global configuration
└── (project)/.ax-cli/
    ├── settings.json       # Project configuration
    └── CUSTOM.md          # Project instructions
```

### Environment Variables

```bash
YOUR_API_KEY=your-key
AI_BASE_URL=https://api.x.ai/v1
AI_MODEL=glm-4.6
AI_MAX_TOKENS=8192
AI_TEMPERATURE=0.7
```

---

## Additional Resources

- **Configuration Guide**: See `configuration.md` for detailed setup options
- **MCP Integration**: See `mcp-integration-guide.md` for extending capabilities
- **CLI Reference**: See `cli-reference.md` for complete command documentation
- **Architecture**: See `architecture.md` for internal design details
- **Features**: See `features.md` for comprehensive feature overview

---

*For more information, visit the [AX CLI GitHub repository](https://github.com/defai-digital/ax-cli) or check the main README.md.*
