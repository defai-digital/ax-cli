# GLM-4.6 Usage Guide
Last reviewed: 2025-02-21  
Applies to: ax-glm v4.4.x

This guide focuses on using GLM-4.6 (and GLM-4.6V) with ax-glm. It reflects the current defaults and thinking/vision behavior.

## Quick start
```bash
ax-glm                          # interactive, defaults to glm-4.6 and https://api.z.ai/api/coding/paas/v4
ax-glm -p "summarize src"       # headless
ax-glm --model glm-4.6v         # use vision model
ax-glm --think                  # force thinking_mode on
ax-glm --no-think               # disable thinking_mode
```

## Models
- `glm-4.6` (default): 200K context, thinking_mode supported.
- `glm-4.6v`: 128K context, vision + thinking_mode.
- `glm-4-flash`: 128K context, faster responses, no thinking_mode.
- `glm-4`: standard non-vision model.
- `cogview-4`: image generation.

## Base URL and keys
- Default base URL: `https://api.z.ai/api/coding/paas/v4`
- API key env vars: `ZAI_API_KEY` (alias `GLM_API_KEY`)
- Override per command with `-u/--base-url` if needed.

## Thinking mode
- Enable: `--think` or set `thinking.enabled` in settings.
- Disable: `--no-think`.
- Auto: the agent may enable thinking for complex tasks when the model supports it.
- Output: reasoning content is streamed and shown separately from final answers.

## Vision
- Use `--model glm-4.6v` with a base URL that supports images.
- Provide images via the CLI attachment flow supported by your terminal/editor; the CLI passes images to the provider when supported.

## Recommended patterns
- Complex debugging/refactors: `ax-glm --think --max-tool-rounds 50`.
- Large context tasks: keep `glm-4.6`; adjust `--max-tool-rounds` rather than temperature first.
- Speed-sensitive tasks: `--model glm-4-flash` and `--no-think`.

## Configuration snippets
User config (`~/.ax-glm/config.json`):
```json
{
  "baseURL": "https://api.z.ai/api/coding/paas/v4",
  "defaultModel": "glm-4.6",
  "thinking": { "enabled": true }
}
```
Project override (`.ax-glm/settings.json`) to prefer vision:
```json
{
  "defaultModel": "glm-4.6v",
  "thinking": { "enabled": true }
}
```

## Troubleshooting
- 401/403 errors: confirm `ZAI_API_KEY` and base URL.
- Thinking ignored: ensure the model supports thinking (`glm-4.6` or `glm-4.6v`) and you used `--think` or enabled it in settings.
- Vision not working: verify the endpoint supports images and you are using `glm-4.6v`.***
