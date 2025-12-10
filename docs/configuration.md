# AX CLI Configuration
Last reviewed: 2025-02-21  
Applies to: ax-cli/ax-glm/ax-grok v4.4.x

Configuration is per provider with a clear precedence order and shared env var names. Use this guide to understand where settings live and how to override them safely.

## Precedence
1) CLI flags  
2) Env vars (`AI_MODEL`, `AI_BASE_URL`, provider key)  
3) Project settings: `./.ax-<provider>/settings.json`  
4) User settings: `~/.ax-<provider>/config.json`  
5) Provider defaults (see `config-defaults/*.yaml`)

## File locations
- User config (created by `ax-<provider> setup`)
  - GLM: `~/.ax-glm/config.json`
  - Grok: `~/.ax-grok/config.json`
  - Local: `~/.ax-cli/config.json`
- Project overrides (optional)
  - `./.ax-glm/settings.json`, `./.ax-grok/settings.json`, `./.ax-cli/settings.json`

## Core keys
- `apiKey` / `apiKeyEncrypted`: provider API key (setup writes encrypted form).
- `baseURL`: API endpoint.
  - GLM default: `https://api.z.ai/api/coding/paas/v4`
  - Grok default: `https://api.x.ai/v1`
  - Local default: `http://localhost:11434/v1`
- `defaultModel`: see models below.
- `temperature`, `maxTokens`: sampling and output limits (model caps still apply).
- `thinking` / `thinkingMode`: enable/disable thinking/reasoning; provider-specific handling.
- `paste`, `ui`, `timeouts`, `mcp`: advanced tuning (see `config-defaults/settings.yaml` for defaults).

## Environment variables
- API keys:
  - GLM: `ZAI_API_KEY` (alias `GLM_API_KEY`)
  - Grok: `XAI_API_KEY` (alias `GROK_API_KEY`)
  - Local: `AX_API_KEY` (only if your local endpoint requires it)
- `AI_MODEL`: override default model.
- `AI_BASE_URL`: override base URL.

## Supported models (current defaults)
- GLM: `glm-4.6` (default), `glm-4.6v`, `glm-4-flash`, `glm-4`, `cogview-4` (images), `glm-4.5v` (legacy).
- Grok: `grok-4` (default alias), `grok-4.1`, `grok-4.1-fast-reasoning`, `grok-4.1-fast-non-reasoning`, `grok-4.1-mini`, `grok-4-0709`, `grok-3`, `grok-3-mini`, `grok-2-1212`, `grok-2-vision-1212`, `grok-2-image-1212`.
- Local/offline: `qwen3:14b` (default), `qwen3:32b`, `qwen3:8b`, `qwen3:72b`, `qwen2.5-coder:32b`, `glm-4.6:9b`, `glm-4.6:32b`, `codegeex4`, `glm4:9b`.

## Thinking/Reasoning
- GLM: uses `thinking` (GLM “thinking_mode”). Enable with `--think` or via settings; disable with `--no-think`.
- Grok: uses `reasoning_effort` on supported Grok-4.* models. `--think` maps to reasoning; `--no-think` disables it.
- Local: ignored unless the backend supports the option.

## Example configs
User config (GLM):
```json
{
  "apiKeyEncrypted": { "...": "..." },
  "baseURL": "https://api.z.ai/api/coding/paas/v4",
  "defaultModel": "glm-4.6",
  "thinking": { "enabled": true },
  "temperature": 0.7
}
```
Project override (Grok):
```json
{
  "defaultModel": "grok-4.1-fast-reasoning",
  "baseURL": "https://api.x.ai/v1",
  "thinkingMode": "high",
  "maxTokens": 8192
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
- When switching providers in the same project, rely on the separate `.ax-glm` and `.ax-grok` folders to avoid state clashes.***
