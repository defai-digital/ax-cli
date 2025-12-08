#!/usr/bin/env node
/**
 * ax-glm - GLM-optimized AI coding assistant CLI
 *
 * This is a thin wrapper around @defai.digital/ax-core that configures
 * the CLI with GLM (Z.AI) specific defaults and branding.
 *
 * Features:
 * - Full ax-cli functionality (17 tools, MCP, memory, checkpoints, etc.)
 * - GLM-4.6 thinking mode support
 * - Optimized for Z.AI API
 * - 200K context window
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
