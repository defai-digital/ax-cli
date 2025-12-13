# Grok 4.1 Advanced Features (ax-grok)
Applies to: ax-grok v4.4.x+

This guide explains the Grok 4.1 upgrade in ax-grok and how to use the new advanced capabilities powered by the xAI Agent Tools API.

## What changed
- **Server-side agent tools**: web search, X (Twitter) search, and code execution now run on xAI infrastructure with parallel tool calling enabled by default.
- **2M-context fast models**: `grok-4.1-fast-reasoning` and `grok-4.1-fast-non-reasoning` use 2M context for long traces and multi-tool workflows.
- **Dedicated X search command**: `ax-grok x-search` wraps the `x_search` tool for quick terminal lookups (keyword or semantic, with time ranges).
- **Model aliases updated**: `grok-latest` → `grok-4.1`, `grok-fast` → `grok-4.1-fast-reasoning`, `grok-fast-nr` → `grok-4.1-fast-non-reasoning`, `grok-mini` → `grok-4.1-mini`.
- **Code execution ready**: server-side Python execution is available when the agent selects the `code_execution` tool (no local sandbox needed).

## Quick start (upgrade path)
1. Update to the latest CLI: `npm install -g @defai.digital/ax-grok@latest`.
2. Verify the binary: `ax-grok --version` (should show 4.4.x or later).
3. Ensure your xAI key is set: `XAI_API_KEY=<your-key>` (alias: `GROK_API_KEY`), or run `ax-grok setup`.
4. Use `--fast` for the best agentic experience (switches to `grok-4.1-fast-reasoning` with parallel server tools).

## Using Grok agent tools (server-side)
- Server tools are enabled by default for Grok 4.1 models. The agent automatically chooses `web_search`, `x_search`, or `code_execution` when they help.
- Parallel function calling is on, so multiple tool calls can execute in the same round-trip.
- Example interactive run: `ax-grok -p "benchmark this repo and suggest fixes" --max-tool-rounds 12 --fast`.
- Local tools (file edits, ripgrep, bash) still work; the agent blends server tools with local actions based on the prompt.

## X/Twitter search from the CLI
Use the dedicated command when you only need social results:

```bash
ax-grok x-search "react suspense examples" --semantic --time-range 24h --limit 15
```

- `--semantic` toggles AI-powered semantic search instead of keyword-only matching.
- `--time-range` accepts `1h`, `24h`, `7d`, or `30d` to scope fresh posts.
- Add `--json` to pipe results into scripts or dashboards.

## Server-side code execution
- Grok 4.1 can run Python in xAI's sandbox via the `code_execution` tool. You do not need to start a local interpreter.
- Prompting tips: ask for quick calculations, data parsing, or short scripts (time-limited, no outbound network).
- Example: `ax-grok -p "Run a quick Python script to count lines of JS per folder in this repo" --fast`.

## Model guide

| Model | Context | Best for | Alias |
|-------|---------|----------|-------|
| `grok-4.1` | 131K | Default balanced choice with full agent tools | `grok-latest` |
| `grok-4.1-fast-reasoning` | 2M | Long, tool-heavy sessions with reasoning enabled | `grok-fast` |
| `grok-4.1-fast-non-reasoning` | 2M | Fastest agentic runs when you do not need extended reasoning | `grok-fast-nr` |
| `grok-4.1-mini` | 131K | Cost-sensitive tasks with full feature coverage | `grok-mini` |
| `grok-2-image-1212` | 32K | Text-to-image generation | `grok-image` |

## Troubleshooting
- If `x_search` or `code_execution` returns an authorization error, re-run `ax-grok setup` or export `XAI_API_KEY` to the shell environment.
- For slow responses, prefer `--fast` to stay on the 2M-context fast variants with parallel tool calling enabled.
- To override the API base (self-hosted proxy), set `AI_BASE_URL` or configure it in `.ax-grok/settings.json`.
