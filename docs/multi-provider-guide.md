# Multi-Provider Support: Running ax-glm and ax-grok in Parallel

This guide explains how to run ax-glm (GLM/Z.AI) and ax-grok (Grok/xAI) simultaneously on the same machine without conflicts.

## Architecture Overview

Each provider has **isolated** configuration and state:

```
~/.ax-glm/                 # GLM (Z.AI) configuration
├── config.json           # API key, model, settings
├── history.json          # Command history
├── cache/                # Analysis cache
├── sessions/             # Session state
└── plans/                # Saved plans

~/.ax-grok/                # Grok (xAI) configuration
├── config.json           # API key, model, settings
├── history.json          # Command history
├── cache/                # Analysis cache
├── sessions/             # Session state
└── plans/                # Saved plans

Project directory:
├── .ax-glm/              # GLM project-specific state
│   ├── memory.json       # GLM context cache
│   └── checkpoints/      # GLM checkpoints
└── .ax-grok/             # Grok project-specific state
    ├── memory.json       # Grok context cache
    └── checkpoints/      # Grok checkpoints
```

## Setup

### 1. Configure Each Provider

```bash
# Setup GLM (Z.AI)
ax-glm setup
# Enter your Z.AI API key from https://z.ai

# Setup Grok (xAI)
ax-grok setup
# Enter your xAI API key from https://console.x.ai
```

### 2. Run in Parallel

```bash
# Terminal 1: Run ax-glm
ax-glm

# Terminal 2: Run ax-grok
ax-grok
```

Both CLIs can run simultaneously without conflicts because:
- Each uses its own config directory
- File locking prevents race conditions
- Caches are namespaced per provider

## SDK Usage

### Basic Parallel Usage

```typescript
import { createAgent, ProviderType } from '@defai.digital/ax-cli/sdk';

// Create agents for both providers
const glmAgent = await createAgent({ provider: 'glm' });
const grokAgent = await createAgent({ provider: 'grok' });

// Use both simultaneously
const [glmResult, grokResult] = await Promise.all([
  glmAgent.processUserMessage('Analyze this code with GLM'),
  grokAgent.processUserMessage('Analyze this code with Grok'),
]);

// Clean up
glmAgent.dispose();
grokAgent.dispose();
```

### Provider Detection

```typescript
import {
  detectProvider,
  isProviderConfigured,
  getConfiguredProviders,
  getBestAvailableProvider,
} from '@defai.digital/ax-cli/sdk';

// Auto-detect based on environment
const provider = detectProvider(); // 'glm' | 'grok' | 'generic'

// Check what's configured
const providers = getConfiguredProviders(); // ['glm', 'grok']

// Get best available
const best = getBestAvailableProvider(); // 'glm' (if configured)
```

### Provider Context

```typescript
import {
  ProviderContext,
  activateProvider,
  withProvider,
} from '@defai.digital/ax-cli/sdk';

// Create isolated context
const ctx = ProviderContext.create('glm');

// Access provider-specific paths
console.log(ctx.userConfigPath);     // ~/.ax-glm/config.json
console.log(ctx.projectMemoryPath);  // ./.ax-glm/memory.json

// Activate for current context
ctx.activate();

// Or use scoped execution
withProvider('grok', (ctx) => {
  // All operations here use Grok context
  console.log(ctx.provider); // 'grok'
});
```

### Provider-Specific Settings

```typescript
import { getProviderSettings } from '@defai.digital/ax-cli/sdk';

// Get settings for specific provider
const glmSettings = getProviderSettings('glm');
const grokSettings = getProviderSettings('grok');

// Each has isolated configuration
console.log(glmSettings.getApiKey());     // Z.AI API key
console.log(glmSettings.getBaseURL());    // https://api.z.ai/...

console.log(grokSettings.getApiKey());    // xAI API key
console.log(grokSettings.getBaseURL());   // https://api.x.ai/...
```

## File Locking for Concurrent Access

When multiple processes access the same files, use file locking:

```typescript
import { withFileLock, SafeJsonFile } from '@defai.digital/ax-cli/sdk';

// Safe JSON file operations with automatic locking
const data = await SafeJsonFile.read<Config>('/path/to/config.json');

await SafeJsonFile.update<Config>(
  '/path/to/config.json',
  (current) => ({ ...current, count: (current?.count ?? 0) + 1 })
);

// Manual locking for complex operations
await withFileLock('/path/to/file', async () => {
  // Exclusive access guaranteed
  const data = readFileSync('/path/to/file');
  // ... modify data ...
  writeFileSync('/path/to/file', data);
});
```

## Environment Variables

Override provider settings with environment variables:

```bash
# Provider selection
export AX_PROVIDER=glm              # Force provider: glm, grok, generic

# GLM (Z.AI)
export ZAI_API_KEY=your-key         # Z.AI API key
export AI_BASE_URL=https://...      # Override base URL

# Grok (xAI)
export XAI_API_KEY=xai-xxx          # xAI API key
export GROK_API_KEY=xai-xxx         # Alternative name

# Generic
export AI_API_KEY=your-key          # Generic API key
export AI_MODEL=model-name          # Override model
```

## Comparison Mode

Run the same prompt through both providers:

```typescript
import { createAgent } from '@defai.digital/ax-cli/sdk';

async function compareProviders(prompt: string) {
  const glm = await createAgent({ provider: 'glm' });
  const grok = await createAgent({ provider: 'grok' });

  try {
    const [glmResult, grokResult] = await Promise.all([
      glm.processUserMessage(prompt),
      grok.processUserMessage(prompt),
    ]);

    return {
      glm: glmResult,
      grok: grokResult,
    };
  } finally {
    glm.dispose();
    grok.dispose();
  }
}

// Usage
const results = await compareProviders('Explain quantum computing');
console.log('GLM says:', results.glm);
console.log('Grok says:', results.grok);
```

## Provider-Specific Features

### GLM (Z.AI)

```typescript
const glmSettings = getProviderSettings('glm');
const glmConfig = glmSettings.getGLMSettings();

// GLM-specific: thinking mode
console.log(glmConfig?.thinkingEnabled); // boolean
```

### Grok (xAI)

```typescript
const grokSettings = getProviderSettings('grok');
const grokConfig = grokSettings.getGrokSettings();

// Grok-specific features
console.log(grokConfig?.thinkingMode);  // 'off' | 'low' | 'high'
console.log(grokConfig?.liveSearch);    // boolean
console.log(grokConfig?.seed);          // number (for reproducibility)
```

## Best Practices

### 1. Always Specify Provider in SDK

```typescript
// Good: Explicit provider
const agent = await createAgent({ provider: 'glm' });

// Avoid: Relying on auto-detection in multi-provider setups
const agent = await createAgent(); // May pick wrong provider
```

### 2. Use Provider-Specific Directories

```typescript
// Good: Use provider context for paths
const ctx = ProviderContext.create('glm');
const cachePath = ctx.userCacheDir;

// Avoid: Hardcoded paths
const cachePath = path.join(homedir(), '.ax-cli', 'cache'); // Wrong!
```

### 3. Handle File Conflicts

```typescript
// Good: Use file locking for shared resources
await SafeJsonFile.update('/shared/config.json', (data) => ({
  ...data,
  lastAccess: Date.now(),
}));

// Avoid: Raw file operations without locking
const data = JSON.parse(readFileSync('/shared/config.json'));
data.lastAccess = Date.now();
writeFileSync('/shared/config.json', JSON.stringify(data)); // Race condition!
```

### 4. Dispose Agents Properly

```typescript
// Good: Use try/finally
const agent = await createAgent({ provider: 'glm' });
try {
  await agent.processUserMessage('...');
} finally {
  agent.dispose();
}

// Good: Use autoCleanup (default)
const agent = await createAgent({ provider: 'glm' });
// Automatically disposed on process exit
```

### 5. Check Provider Configuration

```typescript
import { isProviderConfigured, getConfiguredProviders } from '@defai.digital/ax-cli/sdk';

// Check before using
if (!isProviderConfigured('glm')) {
  console.error('Please run: ax-glm setup');
  process.exit(1);
}

// Or show available providers
const providers = getConfiguredProviders();
console.log('Available providers:', providers.join(', '));
```

## Troubleshooting

### "Setup has not been run"

```bash
# Run setup for the specific provider
ax-glm setup   # For GLM
ax-grok setup  # For Grok
```

### "No API key configured"

Check environment variables:
```bash
echo $ZAI_API_KEY    # For GLM
echo $XAI_API_KEY    # For Grok
```

Or verify config files:
```bash
cat ~/.ax-glm/config.json
cat ~/.ax-grok/config.json
```

### Lock Timeout

If you see "Failed to acquire lock" errors:

```bash
# Clean up stale locks
rm ~/.ax-glm/*.lock
rm ~/.ax-grok/*.lock
rm .ax-glm/*.lock
rm .ax-grok/*.lock
```

### Config Not Loading

Verify file permissions:
```bash
ls -la ~/.ax-glm/config.json  # Should be 600
ls -la ~/.ax-grok/config.json # Should be 600
```

## Provider-Aware Caching

Each provider has isolated caches:

```typescript
import {
  getProviderFileCache,
  clearProviderCache,
  getProviderCacheStats,
} from '@defai.digital/ax-cli/sdk';

// Get cache for specific provider
const glmCache = await getProviderFileCache<AnalysisResult>('analysis', 'glm');
const grokCache = await getProviderFileCache<AnalysisResult>('analysis', 'grok');

// Check if file is cached
const result = await glmCache.get('/path/to/file.ts');
if (result) {
  console.log('Cache hit:', result);
} else {
  // Analyze and cache
  const analysis = await analyzeFile('/path/to/file.ts');
  await glmCache.set('/path/to/file.ts', analysis);
}

// Get cache statistics
const stats = getProviderCacheStats('glm');
console.log(`GLM cache: ${stats.totalEntries} entries, ${(stats.hitRate * 100).toFixed(1)}% hit rate`);

// Clear provider cache
await clearProviderCache('glm');
```

## Provider-Aware Memory Store

Each provider has isolated project memory:

```typescript
import {
  getProviderContextStore,
  getAllProviderMemoryMetadata,
} from '@defai.digital/ax-cli/sdk';

// Get memory store for specific provider
const glmStore = getProviderContextStore('glm');
const grokStore = getProviderContextStore('grok');

// Load provider-specific memory
const glmMemory = glmStore.load();
if (glmMemory.success) {
  console.log('GLM memory loaded:', glmMemory.data.context.token_estimate, 'tokens');
}

// Record usage (with proper file locking)
glmStore.recordUsage(1000, 500);

// Get metadata for all providers
const allMetadata = getAllProviderMemoryMetadata();
for (const meta of allMetadata) {
  if (meta.exists) {
    console.log(`${meta.provider}: ${meta.tokenEstimate} tokens, used ${meta.usageCount} times`);
  }
}
```

## Directory Structure Summary

```
~/.ax-glm/                    # GLM user configuration
├── config.json               # API key (encrypted), model, settings
├── history.json              # Command history
├── cache/                    # Analysis cache
│   ├── glm_analysis.json     # Namespaced cache files
│   ├── glm_dependency.json
│   └── glm_security.json
├── sessions/                 # Session state
├── plans/                    # Saved execution plans
└── templates/                # Project templates

~/.ax-grok/                   # Grok user configuration
├── config.json               # API key (encrypted), model, settings
├── history.json              # Command history
├── cache/                    # Analysis cache
│   ├── grok_analysis.json
│   ├── grok_dependency.json
│   └── grok_security.json
├── sessions/
├── plans/
└── templates/

Project directory:
├── .ax-glm/                  # GLM project state
│   ├── memory.json           # Project context cache
│   ├── checkpoints/          # Conversation checkpoints
│   └── plans/                # Project-specific plans
└── .ax-grok/                 # Grok project state
    ├── memory.json
    ├── checkpoints/
    └── plans/
```

## Migration from ax-cli

If you were using the generic `ax-cli`:

1. Your config is at `~/.ax-cli/config.json`
2. Run `ax-glm setup` or `ax-grok setup` to configure provider-specific settings
3. Both will create their own isolated configurations
4. You can keep using `ax-cli` (it auto-detects the best provider)
