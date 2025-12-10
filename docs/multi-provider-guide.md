# Multi-Provider Guide: ax-glm and ax-grok
Last reviewed: 2025-02-21  
Applies to: ax-glm/ax-grok v4.4.x

Run GLM (Z.AI) and Grok (xAI) side-by-side without state conflicts. Each provider keeps its own config, cache, and project state.

## Default separation
```
~/.ax-glm/    # GLM user config (Z.AI)
~/.ax-grok/   # Grok user config (xAI)
./.ax-glm/    # Project overrides and state
./.ax-grok/
```

## Setup
```bash
ax-glm setup   # base URL https://api.z.ai/api/coding/paas/v4, models: glm-4.6 / glm-4.6v
ax-grok setup  # base URL https://api.x.ai/v1, models: grok-4.* family
```

## Running in parallel
```bash
# Terminal 1 (GLM)
ax-glm --think

# Terminal 2 (Grok)
ax-grok --think   # maps to reasoning_effort on Grok-4.* models
```

State is isolated by the folders above; caches and history do not overlap.

## Model selection
- GLM: `glm-4.6` (default), `glm-4.6v` (vision), `glm-4-flash` (fast).
- Grok: `grok-4` (default alias), `grok-4.1`, `grok-4.1-fast-reasoning`, `grok-4.1-fast-non-reasoning`, `grok-4.1-mini`, `grok-4-0709`, `grok-2-image-1212` (image).

## Base URLs and keys
- GLM: `https://api.z.ai/api/coding/paas/v4`, env `ZAI_API_KEY` (alias `GLM_API_KEY`).
- Grok: `https://api.x.ai/v1`, env `XAI_API_KEY` (alias `GROK_API_KEY`).

## SDK usage (conceptual)
Create isolated contexts when using the SDK to avoid mixing provider state:
```ts
import { createAgent } from '@defai.digital/ax-cli/sdk';

const glm = await createAgent({ provider: 'glm' });
const grok = await createAgent({ provider: 'grok' });

const [glmResult, grokResult] = await Promise.all([
  glm.processUserMessage('Analyze this code with GLM'),
  grok.processUserMessage('Analyze this code with Grok'),
]);

glm.dispose();
grok.dispose();
```

## Tips
- Keep per-provider project overrides minimal (`.ax-glm/settings.json`, `.ax-grok/settings.json`).
- If you change base URLs (staging vs prod), set them explicitly per command or in each provider’s settings file.
- Use `--think`/`--no-think` per provider; GLM uses `thinking_mode`, Grok uses `reasoning_effort` on supported models.***
