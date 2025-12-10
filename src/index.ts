#!/usr/bin/env node
import { createRequire } from 'module';
import { runCLI } from '@defai.digital/ax-core/cli'; // Use the /cli export from ax-core
import { AX_CLI_PROVIDER } from '@defai.digital/ax-core/provider';

// Get version from package.json
const require = createRequire(import.meta.url);
const pkg = require('../package.json');

// Run the CLI with AX_CLI_PROVIDER configuration
runCLI({
  provider: AX_CLI_PROVIDER,
  version: pkg.version,
});