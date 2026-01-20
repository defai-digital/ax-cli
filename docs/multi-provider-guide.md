# Multi-Provider Guide: ax-grok and ax-cli
Last reviewed: 2025-02-21
Applies to: ax-grok/ax-cli v4.4.x

Run Grok (xAI) and local/offline CLIs side-by-side without state conflicts. Each provider keeps its own config, cache, and project state.

> **Note:** The `ax-glm` package has been deprecated. GLM/Z.AI users should use [OpenCode](https://opencode.ai) - the official CLI from Z.AI.

## Default separation
```
~/.ax-grok/   # Grok user config (xAI)
~/.ax-cli/    # Local/offline user config
./.ax-grok/   # Project overrides and state
./.ax-cli/
```

## Setup
```bash
ax-grok setup  # base URL https://api.x.ai/v1, models: grok-4.* family
ax-cli setup   # base URL http://localhost:11434/v1, models: qwen3, etc.
```

## Running in parallel
```bash
# Terminal 1 (Grok)
ax-grok --think   # maps to reasoning_effort on Grok-4.* models

# Terminal 2 (Local)
ax-cli -p "hello" --model qwen3:14b
```

State is isolated by the folders above; caches and history do not overlap.

## Model selection
- Grok: `grok-4` (default alias), `grok-4.1`, `grok-4.1-fast-reasoning`, `grok-4.1-fast-non-reasoning`, `grok-4.1-mini`, `grok-4-0709`, `grok-2-image-1212` (image).
- Local: `qwen3:14b` (default), `qwen3:32b`, `qwen3:8b`, `qwen2.5-coder:32b`, `codegeex4`.

## Base URLs and keys
- Grok: `https://api.x.ai/v1`, env `XAI_API_KEY` (alias `GROK_API_KEY`).
- Local: `http://localhost:11434/v1`, env `AX_API_KEY` (if needed).

## SDK usage (conceptual)
Create isolated contexts when using the SDK to avoid mixing provider state:
```ts
import { createAgent } from '@defai.digital/ax-cli/sdk';

const grok = await createAgent({ provider: 'grok' });
const local = await createAgent({ provider: 'local' });

const [grokResult, localResult] = await Promise.all([
  grok.processUserMessage('Analyze this code with Grok'),
  local.processUserMessage('Analyze this code locally'),
]);

grok.dispose();
local.dispose();
```

## Tips
- Keep per-provider project overrides minimal (`.ax-grok/settings.json`, `.ax-cli/settings.json`).
- If you change base URLs (staging vs prod), set them explicitly per command or in each provider's settings file.
- Use `--think`/`--no-think` for Grok; it uses `reasoning_effort` on supported models.
