# AX CLI Features (Current)
Last reviewed: 2025-02-21  
Applies to: ax-cli/ax-glm/ax-grok v4.4.x

This document lists the capabilities that are actually supported today. It replaces older marketing-style writeups.

## Providers and defaults
- **ax-glm (Z.AI)**: default model `glm-4.6`, base URL `https://api.z.ai/api/coding/paas/v4`. Vision: `glm-4.6v`. Fast: `glm-4-flash`.
- **ax-grok (xAI)**: default model `grok-4` (alias to latest 4.x). Reasoning/search/vision built in. Variants include `grok-4.1-fast-reasoning`, `grok-4.1-fast-non-reasoning`, `grok-4.1-mini`, `grok-4-0709`, plus `grok-2-image-1212` for images.
- **ax-cli (local/offline)**: defaults to Ollama `http://localhost:11434/v1` with `qwen3:14b` starter model. Supports other local models (qwen3 family, qwen2.5-coder:32b, glm-4.6:9b/32b, codegeex4, glm4:9b).

## Core experience
- Interactive and headless modes with tool execution (file edits, search, bash).
- Thinking/reasoning: GLM uses `thinking_mode`; Grok uses `reasoning_effort` where supported; toggled via `--think/--no-think` or settings.
- Session resume (`--continue`) per working directory with isolated state per provider (`.ax-glm`, `.ax-grok`, `.ax-cli`).
- Structured output for editor/automation via `--json` and VSCode-friendly formatting via `--vscode`.
- Deterministic mode (`--deterministic`/`--seed`) and sampling control (`--top-p`, `temperature`).

## Configuration and security
- Encrypted API key storage created by `ax-<provider> setup`; env var overrides for CI.
- Precedence: flags > env (`AI_MODEL`, `AI_BASE_URL`, provider key) > project settings (`.ax-<provider>/settings.json`) > user settings (`~/.ax-<provider>/config.json`) > defaults.
- Loop detection for tool calls and configurable tool round limits (see `config-defaults/settings.yaml`).

## Integrations
- Model Context Protocol (MCP) client support (see `docs/mcp.md` and templates).
- VSCode extension integration (status bar, thinking indicator, JSON output).
- Multi-provider isolation to run ax-glm and ax-grok in parallel without state conflicts (`docs/multi-provider-guide.md`).

## What is not supported
- Deprecated models like `glm-4.5v` and Grok Code Fast are not recommended; use the defaults above.
- No guarantee of offline operation unless you use local backends (Ollama/LM Studio/vLLM) with `ax-cli`.***
