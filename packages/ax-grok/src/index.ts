#!/usr/bin/env node
/**
 * ax-grok - Grok-optimized AI coding assistant CLI
 *
 * This is a thin wrapper around @defai.digital/ax-core that configures
 * the CLI with Grok (xAI) specific defaults and branding.
 *
 * Features:
 * - Full ax-cli functionality (17 tools, MCP, memory, checkpoints, etc.)
 * - Grok 4 with ALL capabilities built-in:
 *   - Extended thinking mode (reasoning_effort: low/high)
 *   - Vision support (built-in, no separate model needed)
 *   - Live web search capability
 *   - Seed for reproducible outputs
 *   - 128K context window
 */

import { runCLI, GROK_PROVIDER } from '@defai.digital/ax-core';
import { createRequire } from 'module';

// Get version from package.json
const require = createRequire(import.meta.url);
const pkg = require('../package.json');

// Run the CLI with Grok configuration
runCLI({
  provider: GROK_PROVIDER,
  version: pkg.version,
});
