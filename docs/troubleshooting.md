# AX CLI Troubleshooting
Last reviewed: 2025-02-21  
Applies to: ax-cli/ax-glm/ax-grok v4.4.x

Quick fixes for the most common issues. Values below reflect current defaults.

## Basics to verify
- Node.js 24.0.0+ (`node --version`).
- Correct CLI per provider: `ax-glm` (Z.AI), `ax-grok` (xAI), `ax-cli` (local/offline).
- Base URLs:
  - GLM: `https://api.z.ai/api/coding/paas/v4`
  - Grok: `https://api.x.ai/v1`
  - Local: `http://localhost:11434/v1`
- API key env vars:
  - GLM: `ZAI_API_KEY` (alias `GLM_API_KEY`)
  - Grok: `XAI_API_KEY` (alias `GROK_API_KEY`)
  - Local: `AX_API_KEY` (only if your local endpoint needs one)

## Installation issues
- Command not found: reinstall globally (`npm install -g @defai.digital/ax-glm` etc.) and ensure npm’s bin dir is on `PATH`.
- Permission errors: avoid `sudo`; set a user prefix (`npm config set prefix ~/.npm-global && export PATH=~/.npm-global/bin:$PATH`).
- Wrong Node version: upgrade to Node 24+ and reinstall the CLI.

## API key / auth errors
- 401/403: verify the right env var for the provider; rerun `ax-<provider> setup` to recreate encrypted config.
- Using the wrong provider: make sure you’re running `ax-glm` vs `ax-grok`; keys are not interchangeable.

## Base URL / connectivity
- Override per command with `-u/--base-url` to match the provider endpoint above.
- Check connectivity:
  ```bash
  curl -I https://api.z.ai/api/coding/paas/v4
  curl -I https://api.x.ai/v1
  ```
- Proxies/firewalls can block these domains; test from a clean network path.

## Model errors
- “Model not found”: ensure the model exists for the provider:
  - GLM: `glm-4.6`, `glm-4.6v`, `glm-4-flash`, `glm-4`, `cogview-4`, `glm-4.5v` (legacy)
  - Grok: `grok-4`, `grok-4.1`, `grok-4.1-fast-reasoning`, `grok-4.1-fast-non-reasoning`, `grok-4.1-mini`, `grok-4-0709`, `grok-3`, `grok-3-mini`, `grok-2-1212`, `grok-2-vision-1212`, `grok-2-image-1212`
  - Local: `qwen3:14b` (default), `qwen3:32b`, `qwen3:8b`, `qwen3:72b`, `qwen2.5-coder:32b`, `glm-4.6:9b`, `glm-4.6:32b`, `codegeex4`, `glm4:9b`
- Thinking/reasoning ignored: only GLM (`glm-4.6`, `glm-4.6v`) and Grok 4.* support it; use `--think` to force, `--no-think` to disable.

## Local/offline (ax-cli)
- Ensure the backend is running (e.g., Ollama):
  ```bash
  ollama serve
  ax-cli -p "hello" --model qwen3:14b --base-url http://localhost:11434/v1
  ```
- Some backends ignore thinking/vision; that’s expected.

## MCP issues
- Verify MCP config files live under the provider state directory (`~/.ax-<provider>/` and `./.ax-<provider>/`).
- Token overflow or runaway output: tighten limits in settings (`mcp.token` in `config-defaults/settings.yaml`) or reduce tool rounds.

## Logs and diagnostics
- Use `--json` for structured errors.
- If tool loops stop early, increase `--max-tool-rounds` or adjust loop detection thresholds in settings.
- For reproducibility, add `--deterministic` and `--seed`.

## When to reset
- If configs are corrupted, remove the provider’s config directory and rerun setup:
  ```bash
  rm -rf ~/.ax-glm   # or ~/.ax-grok, ~/.ax-cli
  ax-<provider> setup
  ```

## Need more?
- Start from `docs/index.md` for the latest links.
- If a doc contradicts this troubleshooting guide, prefer the provider defaults and URLs listed above.***
