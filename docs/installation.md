# AX CLI Installation
Last reviewed: 2025-02-21  
Applies to: ax-cli/ax-glm/ax-grok v4.4.x

This guide covers installing the provider-specific CLIs (GLM, Grok) and the local/offline ax-cli, plus verification steps.

## Requirements
- Node.js **24.0.0+** (ESM only)
- OS: macOS 14+, Windows 11+, Ubuntu 24.04 LTS+ (other modern Linux distros usually work but are not fully tested)
- Network access to your chosen provider (except for local/offline ax-cli with Ollama/LM Studio/vLLM)

## Which CLI should you install?
- **GLM (Z.AI)**: `ax-glm` — optimized defaults for GLM-4.6/4.6V, base URL `https://api.z.ai/api/coding/paas/v4`, key env `ZAI_API_KEY` (alias `GLM_API_KEY`).
- **Grok (xAI)**: `ax-grok` — defaults to Grok-4 with reasoning/search/vision, base URL `https://api.x.ai/v1`, key env `XAI_API_KEY` (alias `GROK_API_KEY`).
- **Local/Offline**: `ax-cli` — defaults to Ollama at `http://localhost:11434/v1` with `qwen3:14b` as the starter model.

## Install (npm, global)
```bash
# Pick the CLI you need
npm install -g @defai.digital/ax-glm    # GLM (Z.AI)
npm install -g @defai.digital/ax-grok   # Grok (xAI)
npm install -g @defai.digital/ax-cli    # Local/offline
```

## Initial setup
Run the setup wizard once per provider to create `~/.ax-<provider>/config.json` with encrypted API keys and defaults.
```bash
ax-glm setup   # prompts for Z.AI key and preferred model (glm-4.6 or glm-4.6v)
ax-grok setup  # prompts for xAI key and default Grok-4 variant
ax-cli setup   # optional for local/offline; sets local defaults and workspace dir
```

## Verify
```bash
ax-glm --version
ax-grok --version
ax-cli --version
```
Run a quick call:
```bash
ax-glm -p "hello" --model glm-4.6 --base-url https://api.z.ai/api/coding/paas/v4
ax-grok -p "hello" --model grok-4 --base-url https://api.x.ai/v1
ax-cli -p "hello" --model qwen3:14b --base-url http://localhost:11434/v1
```

## Platform notes
- macOS/Linux: if you switch Node versions, reinstall global CLIs to keep native deps aligned.
- Windows: use an elevated shell for global npm installs if needed.
- Local/offline: install and start Ollama/LM Studio/vLLM before running `ax-cli` with local models.

## Uninstall
```bash
npm uninstall -g @defai.digital/ax-glm @defai.digital/ax-grok @defai.digital/ax-cli
```

## Troubleshooting
- “Missing API key”: ensure `ZAI_API_KEY` or `XAI_API_KEY` is set, or rerun `ax-<provider> setup`.
- “Cannot reach base URL”: confirm the base URL above; proxies/firewalls can block `api.z.ai` or `api.x.ai`.
- Node <24 detected: upgrade Node and reinstall the CLI.***
