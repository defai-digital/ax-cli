# Changelog - v2.2.0

## Feature: Multi-Provider Setup with Interactive Selection

### New Functionality
The `ax-cli setup` command now supports **multiple AI providers** with an interactive selection menu! Users can choose from 5 different providers during setup.

### Supported Providers

1. **Z.AI (GLM Models)** ⭐ *Recommended*
   - Base URL: `https://api.z.ai/api/coding/paas/v4`
   - Default Model: `glm-4.6`
   - Features: Advanced reasoning, 200K context window
   - Requires API key: ✅

2. **xAI (Grok)**
   - Base URL: `https://api.x.ai/v1`
   - Default Model: `grok-code-fast-1`
   - Features: Fast coding assistance
   - Requires API key: ✅

3. **OpenAI**
   - Base URL: `https://api.openai.com/v1`
   - Default Model: `gpt-4-turbo`
   - Features: Industry-leading language models
   - Requires API key: ✅

4. **Anthropic (Claude)**
   - Base URL: `https://api.anthropic.com/v1`
   - Default Model: `claude-3-5-sonnet-20241022`
   - Features: Advanced AI assistant
   - Requires API key: ✅

5. **Ollama (Local)**
   - Base URL: `http://localhost:11434/v1`
   - Default Model: `llama3.1`
   - Features: Local models, privacy-focused
   - Requires API key: ❌ No API key needed!

### User Experience

**Before (v2.1.2)**:
```bash
$ ax-cli setup
Enter your z.ai API key: [hardcoded to z.ai only]
```

**After (v2.2.0)**:
```bash
$ ax-cli setup

🚀 AX CLI Setup

📝 Configuration Setup

? Select your AI provider: (Use arrow keys)
❯ Z.AI (GLM Models) - Advanced reasoning and 200K context window
  xAI (Grok) - Fast coding assistance
  OpenAI - Industry-leading language models
  Anthropic (Claude) - Advanced AI assistant
  Ollama (Local) - No API key required

Get your API key from: https://z.ai

? Enter your Z.AI (GLM Models) API key: [hidden]

✅ Configuration saved successfully!
```

### Configuration File Features

The generated config file now includes:

1. **Provider metadata** (as comments for reference)
   - `_comment`: File description
   - `_provider`: Selected provider name
   - `_website`: Provider website URL

2. **Active configuration**
   - `apiKey`: Your API key (or empty for Ollama)
   - `baseURL`: Provider API endpoint
   - `model`: Default model for provider
   - `maxTokens`: 8192
   - `temperature`: 0.7
   - `mcpServers`: {}

3. **Example configurations** for all providers
   - `_examples`: Contains baseURL and models for each provider
   - Helpful for manual switching between providers
   - Shows available models for each provider

**Example Config File**:
```json
{
  "_comment": "AX CLI Configuration",
  "_provider": "Z.AI (GLM Models)",
  "_website": "https://z.ai",
  "apiKey": "your-api-key-here",
  "baseURL": "https://api.z.ai/api/coding/paas/v4",
  "model": "glm-4.6",
  "maxTokens": 8192,
  "temperature": 0.7,
  "mcpServers": {},
  "_examples": {
    "_comment": "Example configurations for different providers",
    "z.ai": {
      "baseURL": "https://api.z.ai/api/coding/paas/v4",
      "models": ["glm-4.6", "glm-4-air", "glm-4-airx"]
    },
    "xai": {
      "baseURL": "https://api.x.ai/v1",
      "models": ["grok-code-fast-1"]
    },
    ...
  }
}
```

### Manual Configuration

Users can still manually edit `~/.ax-cli/config.json` to:
- Switch providers (change `baseURL` and `model`)
- Try different models (see `_examples` section)
- Adjust parameters (`maxTokens`, `temperature`)
- Add MCP servers

### Technical Implementation

**File Modified**: `src/commands/setup.ts`

1. **Provider Definitions**:
   ```typescript
   interface ProviderConfig {
     name: string;
     displayName: string;
     baseURL: string;
     defaultModel: string;
     requiresApiKey: boolean;
     website: string;
     description: string;
   }
   ```

2. **Interactive Provider Selection**:
   - Uses `enquirer` select prompt
   - Shows provider name and description
   - Arrow key navigation

3. **Conditional API Key Prompt**:
   - Only prompts for API key if `requiresApiKey: true`
   - Ollama doesn't require API key
   - Shows website link to get API key

4. **Enhanced Config Output**:
   - Includes metadata fields (`_comment`, `_provider`, `_website`)
   - Includes `_examples` section with all provider configs
   - Helps users manually switch providers

### Benefits

1. **Flexibility**: Support for 5 major AI providers
2. **Privacy**: Option for local models (Ollama)
3. **Discovery**: Users learn about available providers
4. **Documentation**: Config file includes examples
5. **Ease of Use**: Interactive menu vs manual config editing

### Breaking Changes
None. Existing config files continue to work. The setup command is optional.

### Upgrade Notes
No action required. New users will see the provider selection menu. Existing users can re-run `ax-cli setup --force` to use the new multi-provider setup.

---

**Version**: 2.2.0
**Release Date**: 2025-11-19
**Type**: Minor (New Feature)
