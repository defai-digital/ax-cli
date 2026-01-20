# AX CLI Features (Current)
Last reviewed: 2025-02-21
Applies to: ax-cli/ax-grok v4.4.x

This document lists the capabilities that are actually supported today. It replaces older marketing-style writeups.

> **Note:** The `ax-glm` package has been deprecated. GLM/Z.AI users should use [OpenCode](https://opencode.ai) - the official CLI from Z.AI.

## Providers and defaults
- **ax-grok (xAI)**: default model `grok-4` (alias to latest 4.x). Reasoning/search/vision built in. Variants include `grok-4.1-fast-reasoning`, `grok-4.1-fast-non-reasoning`, `grok-4.1-mini`, `grok-4-0709`, plus `grok-2-image-1212` for images.
- **ax-cli (local/offline)**: defaults to Ollama `http://localhost:11434/v1` with `qwen3:14b` starter model. Supports other local models (qwen3 family, qwen2.5-coder:32b, codegeex4).

## Core experience
- Interactive and headless modes with tool execution (file edits, search, bash).
- Thinking/reasoning: Grok uses `reasoning_effort` where supported; toggled via `--think/--no-think` or settings.
- Session resume (`--continue`) per working directory with isolated state per provider (`.ax-grok`, `.ax-cli`).
- Structured output for editor/automation via `--json` and VSCode-friendly formatting via `--vscode`.
- Deterministic mode (`--deterministic`/`--seed`) and sampling control (`--top-p`, `temperature`).

## Project initialization (`/init`)
- Generates `AX.md` at project root - a single-file AI context document.
- Four depth levels: `basic` (quick scan), `standard` (default), `full` (architecture), `security` (audit).
- Adaptive output: verbosity scales with project complexity (file count, LOC, dependencies).
- Parses existing rules from `.cursorrules`, `.editorconfig`, and similar files.
- Complexity scoring categorizes projects as small/medium/large/enterprise.
- Deep analysis mode (full/security) generates `.ax/analysis.json` with dependency graphs and hotspots.
- Migration support: replaces legacy 3-file format (CUSTOM.md, ax.index.json, ax.summary.json).

## Automatic context injection
- When starting a conversation, `AX.md` is automatically read and injected into the AI's system prompt.
- Content is wrapped in `<project-context source="AX.md">` tags for clear delineation.
- HTML metadata comments (generation date, etc.) are stripped to save tokens.
- Priority: `AX.md` (primary) → `ax.summary.json` (legacy) → `ax.index.json` (legacy).
- Benefits: AI understands your project's build commands, tech stack, and conventions from the start.

## Configuration and security
- Encrypted API key storage created by `ax-<provider> setup`; env var overrides for CI.
- Precedence: flags > env (`AI_MODEL`, `AI_BASE_URL`, provider key) > project settings (`.ax-<provider>/settings.json`) > user settings (`~/.ax-<provider>/config.json`) > defaults.
- Loop detection for tool calls and configurable tool round limits (see `config-defaults/settings.yaml`).

## Integrations
- Model Context Protocol (MCP) client support (see `docs/mcp.md` and templates).
- VSCode extension integration (status bar, thinking indicator, JSON output).
- Multi-provider isolation to run multiple CLIs in parallel without state conflicts (`docs/multi-provider-guide.md`).

## What is not supported
- No guarantee of offline operation unless you use local backends (Ollama/LM Studio/vLLM) with `ax-cli`.
