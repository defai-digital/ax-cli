#!/usr/bin/env node
/**
 * ax-grok - Grok-optimized AI coding assistant CLI
 *
 * This is a thin wrapper around @defai.digital/ax-core that configures
 * the CLI with Grok (xAI) specific defaults and branding.
 *
 * Features:
 * - Full ax-cli functionality (17 tools, MCP, memory, checkpoints, etc.)
 * - Grok 4.1 with ALL capabilities built-in:
 *   - Extended thinking mode (reasoning_effort: low/high)
 *   - Vision support (built-in, no separate model needed)
 *   - Live web search capability
 *   - Seed for reproducible outputs
 *   - 131K context window (2M for fast models!)
 *
 * Grok-Specific Enhancements (xAI Agent Tools API):
 * - Server-side parallel function calling (parallel_function_calling=true)
 * - X (Twitter) posts search via x_search tool
 * - Server-side code execution sandbox
 * - Real-time web search via web_search tool
 *
 * Model Selection:
 * - grok-4.1: Latest stable (131K context)
 * - grok-4.1-fast-reasoning: Best for agentic tasks (2M context!) - use --fast flag
 * - grok-4.1-fast-non-reasoning: Fastest (2M context, no reasoning)
 * - grok-4.1-mini: Cost-effective variant
 *
 * Usage:
 *   ax-grok                     # Interactive mode with default model
 *   ax-grok --fast              # Use grok-4.1-fast-reasoning (best for tools)
 *   ax-grok -m grok-mini        # Use model alias
 *   ax-grok -p "your prompt"    # Headless mode
 *   ax-grok x-search "query"    # Search X (Twitter) posts
 */

import { createCLI, GROK_PROVIDER, getSettingsManager, getApiKeyFromEnv } from '@defai.digital/ax-core';
import { createRequire } from 'module';
import { createXSearchCommand } from './commands/x-search.js';

// Get version from package.json
const require = createRequire(import.meta.url);
const pkg = require('../package.json') as { version: string };

// Create the CLI with Grok configuration
const cli = createCLI({
  provider: GROK_PROVIDER,
  version: pkg.version,
});

// Add Grok-specific commands
// x-search: Search X (Twitter) posts using xAI Agent Tools API
cli.addCommand(createXSearchCommand(
  () => {
    const manager = getSettingsManager();
    return getApiKeyFromEnv(GROK_PROVIDER) || manager.getApiKey();
  },
  () => {
    const manager = getSettingsManager();
    return manager.getBaseURL() || GROK_PROVIDER.defaultBaseURL;
  }
));

// Parse and run
cli.parse();
