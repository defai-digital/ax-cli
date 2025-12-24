#!/usr/bin/env node
/**
 * ax-glm - GLM-optimized AI coding assistant CLI
 *
 * This is a thin wrapper around @defai.digital/ax-core that configures
 * the CLI with GLM (Z.AI) specific defaults and branding.
 *
 * Features:
 * - Full ax-cli functionality (17 tools, MCP, memory, checkpoints, etc.)
 * - GLM-4.7 with enhanced thinking modes (Interleaved, Preserved, Turn-level)
 * - 73.8% SWE-bench (+5.8%), 66.7% SWE-bench Multilingual (+12.9%)
 * - Optimized for Z.AI API
 * - 131K context window (GLM-4.7) / 200K context window (GLM-4.6)
 */

import { runCLI, GLM_PROVIDER } from '@defai.digital/ax-core';
import { createRequire } from 'module';

// Get version from package.json
const require = createRequire(import.meta.url);
const pkg = require('../package.json');

// Run the CLI with GLM configuration
runCLI({
  provider: GLM_PROVIDER,
  version: pkg.version,
});
