# AX CLI Usage
Last reviewed: 2025-02-21
Applies to: ax-cli/ax-grok v4.4.x

This guide shows how to run interactive and headless sessions for each provider and how to control thinking/reasoning and tool rounds.

> **Note:** The `ax-glm` package has been deprecated. GLM/Z.AI users should use [OpenCode](https://opencode.ai) - the official CLI from Z.AI.

## Quick examples
- Grok (xAI):
  ```bash
  ax-grok                        # interactive, defaults to grok-4 and https://api.x.ai/v1
  ax-grok -p "summarize this repo" --think   # enable reasoning_effort
  ```
- Local/offline:
  ```bash
  ax-cli -p "count ts files" --model qwen3:14b --base-url http://localhost:11434/v1
  ```

## Modes
- **Interactive (default)**: start the CLI with no `-p/--prompt`. Multi-turn conversation, tool use allowed.
- **Headless**: `-p "..."` processes a single prompt then exits. Good for scripts/CI.
- **Continue session**: `-c/--continue` resumes the most recent conversation in the current directory.

## Core flags
- `-m, --model <name>`: set the model (overrides config/env).
  - Grok: `grok-4` (default alias), `grok-4.1`, `grok-4.1-fast-reasoning`, `grok-4.1-fast-non-reasoning`, `grok-4.1-mini`, `grok-4-0709`, `grok-2-image-1212` (image).
  - Local: `qwen3:14b` (default), `qwen3:32b`, `qwen3:8b`, `qwen2.5-coder:32b`, `codegeex4`.
- `-u, --base-url <url>`: override the API endpoint. Defaults: Grok `https://api.x.ai/v1`, local `http://localhost:11434/v1`.
- `-k, --api-key <key>`: API key override (env vars are preferred).
- `--max-tool-rounds <n>`: cap tool executions (default from settings; see `config-defaults/settings.yaml`).
- Thinking/Reasoning: `--think` to enable, `--no-think` to disable. Grok uses `reasoning_effort` when supported.
- Sampling: `--deterministic`, `--seed <n>`, `--top-p <num>`.
- Context helpers: `--file <path>`, `--selection <text>`, `--line-range <range>`, `--git-diff`.
- Format/integration: `--json` (structured output), `--vscode` (VSCode-friendly).

## Environment overrides
Precedence: CLI flags > env vars > project settings (`.ax-<provider>/settings.json`) > user settings (`~/.ax-<provider>/config.json`) > defaults.
- API keys: `XAI_API_KEY`, `GROK_API_KEY`, `AX_API_KEY` (local/offline).
- Model: `AI_MODEL`
- Base URL: `AI_BASE_URL`

## Working with thinking/reasoning
- Grok: `--think` maps to `reasoning_effort` on supported Grok-4.* models. Disable with `--no-think` for speed.
- Local models: thinking is ignored unless the backend supports it.

## Typical workflows
- **Code review / debugging**: `ax-grok` interactive; add `--think` for complex issues; share a git diff via `--git-diff`.
- **CI headless check**: `ax-grok -p "run tests and summarize failures" --max-tool-rounds 20 --json`.
- **Local quick edits**: `ax-cli -p "rename variable foo to bar in src/index.ts" --model qwen3:14b`.

## Troubleshooting quick checks
- Wrong base URL: confirm the default for the provider; override with `-u`.
- Missing key: ensure the correct env var is set; rerun `ax-<provider> setup`.
- Tool loop protection: if stopped early, increase `--max-tool-rounds` or adjust in settings.
