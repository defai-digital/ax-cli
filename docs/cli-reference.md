# AX CLI Command Reference
Last reviewed: 2025-02-21  
Applies to: ax-cli/ax-glm/ax-grok v4.4.x

## Main syntax
```
ax-<provider> [message...] [options]
# providers: ax-glm, ax-grok, ax-cli (local/offline)
```

## Core options
- `-p, --prompt <text>`: headless, single prompt then exit.
- `-d, --directory <dir>`: working directory (default: current).
- `-k, --api-key <key>`: API key override (env vars preferred).
- `-u, --base-url <url>`: API endpoint override.
- `-m, --model <name>`: model override.
- `--max-tool-rounds <n>`: cap tool executions (default from settings).
- `-c, --continue`: resume the most recent conversation in the current directory.
- `-v, --version`: show version; `-h, --help`: show help.

## Thinking / Reasoning
- `--think`: enable thinking/reasoning mode (GLM: `thinking_mode`; Grok: `reasoning_effort` when supported).
- `--no-think`: disable thinking/reasoning.

## Sampling / reproducibility
- `--deterministic`: sets `do_sample=false`.
- `--seed <number>`: seed + deterministic.
- `--top-p <number>`: nucleus sampling (0–1). Use instead of or alongside temperature.

## Context helpers
- `--file <path>`: include file content.
- `--selection <text>`: include ad-hoc text.
- `--line-range <start-end>`: include a specific range (with `--file`).
- `--git-diff`: include current repo diff.

## Output / integration
- `--json`: JSON output (useful for editors/automation).
- `--vscode`: format output for VSCode integration.
- `--no-agent`: bypass agent-first mode.
- `--agent <name>`: force a specific AutomatosX agent (e.g., `backend`, `frontend`, `security`).

## Models by provider (current)
- GLM (default base: `https://api.z.ai/api/coding/paas/v4`): `glm-4.6` (default), `glm-4.6v`, `glm-4-flash`, `glm-4`, `cogview-4`, `glm-4.5v` (legacy).
- Grok (default base: `https://api.x.ai/v1`): `grok-4` (default alias), `grok-4.1`, `grok-4.1-fast-reasoning`, `grok-4.1-fast-non-reasoning`, `grok-4.1-mini`, `grok-4-0709`, `grok-3`, `grok-3-mini`, `grok-2-1212`, `grok-2-vision-1212`, `grok-2-image-1212`.
- Local/offline (default base: `http://localhost:11434/v1`): `qwen3:14b` (default), `qwen3:32b`, `qwen3:8b`, `qwen3:72b`, `qwen2.5-coder:32b`, `glm-4.6:9b`, `glm-4.6:32b`, `codegeex4`, `glm4:9b`.

## Env vars
- API keys: `ZAI_API_KEY` / `GLM_API_KEY`, `XAI_API_KEY` / `GROK_API_KEY`, `AX_API_KEY` (local).
- `AI_MODEL`: default model override.
- `AI_BASE_URL`: base URL override.

## Typical commands
```bash
# Interactive (GLM)
ax-glm --think

# Headless (Grok) with reasoning and capped tool rounds
ax-grok -p "summarize tests" --think --max-tool-rounds 20

# Local edit via Ollama
ax-cli -p "rename foo to bar in src/index.ts" --model qwen3:14b --base-url http://localhost:11434/v1

# Continue previous conversation
ax-glm --continue
```

## Exit codes
- `0` success, `1` error or validation failure.

## Tips
- Use CLI flags for one-offs; use project settings (`.ax-<provider>/settings.json`) for repo defaults; use env vars for CI/secrets.
- If a model does not support thinking, `--think` is ignored.***
