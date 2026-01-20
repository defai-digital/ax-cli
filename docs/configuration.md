# AX CLI Configuration
Last reviewed: 2025-02-21
Applies to: ax-cli/ax-grok v4.4.x

Configuration is per provider with a clear precedence order and shared env var names. Use this guide to understand where settings live and how to override them safely.

> **Note:** The `ax-glm` package has been deprecated. GLM/Z.AI users should use [OpenCode](https://opencode.ai) - the official CLI from Z.AI.

## Precedence
1) CLI flags
2) Env vars (`AI_MODEL`, `AI_BASE_URL`, provider key)
3) Project settings: `./.ax-<provider>/settings.json`
4) User settings: `~/.ax-<provider>/config.json`
5) Provider defaults (see `config-defaults/*.yaml`)

## File locations
- User config (created by `ax-<provider> setup`)
  - Grok: `~/.ax-grok/config.json`
  - Local: `~/.ax-cli/config.json`
- Project overrides (optional)
  - `./.ax-grok/settings.json`, `./.ax-cli/settings.json`

## Core keys
- `apiKey` / `apiKeyEncrypted`: provider API key (setup writes encrypted form).
- `baseURL`: API endpoint.
  - Grok default: `https://api.x.ai/v1`
  - Local default: `http://localhost:11434/v1`
- `defaultModel`: see models below.
- `temperature`, `maxTokens`: sampling and output limits (model caps still apply).
- `thinking` / `thinkingMode`: enable/disable thinking/reasoning; provider-specific handling.
- `paste`, `ui`, `timeouts`, `mcp`: advanced tuning (see `config-defaults/settings.yaml` for defaults).

## Environment variables
- API keys:
  - Grok: `XAI_API_KEY` (alias `GROK_API_KEY`)
  - Local: `AX_API_KEY` (only if your local endpoint requires it)
- `AI_MODEL`: override default model.
- `AI_BASE_URL`: override base URL.

## Supported models (current defaults)
- Grok: `grok-4` (default alias), `grok-4.1`, `grok-4.1-fast-reasoning`, `grok-4.1-fast-non-reasoning`, `grok-4.1-mini`, `grok-4-0709`, `grok-3`, `grok-3-mini`, `grok-2-1212`, `grok-2-vision-1212`, `grok-2-image-1212`.
- Local/offline: `qwen3:14b` (default), `qwen3:32b`, `qwen3:8b`, `qwen3:72b`, `qwen2.5-coder:32b`, `codegeex4`.

## Thinking/Reasoning
- Grok: uses `reasoning_effort` on supported Grok-4.* models. `--think` maps to reasoning; `--no-think` disables it.
- Local: ignored unless the backend supports the option.

## Example configs
User config (Grok):
```json
{
  "apiKeyEncrypted": { "...": "..." },
  "baseURL": "https://api.x.ai/v1",
  "defaultModel": "grok-4.1-fast-reasoning",
  "thinkingMode": "high",
  "temperature": 0.7
}
```
Local/offline project override:
```json
{
  "defaultModel": "qwen3:32b",
  "baseURL": "http://localhost:11434/v1"
}
```

## Tips
- Prefer env vars for CI and secrets; run `ax-<provider> setup` locally to create encrypted storage.
- Keep per-repo overrides minimal; store only what differs from your global defaults.
- When using multiple CLIs in the same project, rely on the separate `.ax-grok` and `.ax-cli` folders to avoid state clashes.
