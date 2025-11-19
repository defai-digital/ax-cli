# AX CLI Configuration Guide

A comprehensive guide to configuring AX CLI for your specific environment and workflow needs.

---

## Table of Contents

1. [Configuration Architecture](#configuration-architecture)
2. [Configuration Locations](#configuration-locations)
3. [Environment Variables](#environment-variables)
4. [Configuration Priority](#configuration-priority)
5. [User Settings](#user-settings)
6. [Project Settings](#project-settings)
7. [Custom Instructions](#custom-instructions)
8. [Model Configuration](#model-configuration)
9. [MCP Server Configuration](#mcp-server-configuration)
10. [Quick Setup Examples](#quick-setup-examples)

---

## Configuration Architecture

AX CLI uses a **two-tier configuration system** designed for maximum flexibility and team collaboration:

```
┌─────────────────────────────────────────┐
│     User Settings (~/.ax/user-settings.json)   │
│  Global defaults across all projects     │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│    Project Settings (.ax/settings.json)  │
│  Project-specific overrides              │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│   Environment Variables & CLI Flags     │
│  Runtime overrides (highest priority)    │
└─────────────────────────────────────────┘
```

### Philosophy

- **User Settings**: Set once, apply globally - your preferred defaults
- **Project Settings**: Shared with team - project-specific rules
- **Environment Variables**: Temporary overrides - automation-friendly
- **CLI Flags**: One-off usage - perfect for testing

---

## Configuration Locations

### User-Level Settings

**File**: `~/.ax/user-settings.json`

**Scope**: Global - applies to all projects on your machine

**Use Cases**:
- Default API key and base URL
- Preferred default model
- Available models list
- Morph API key (optional)

**Directory Structure**:
```bash
~/.ax/
├── user-settings.json      # Global configuration
└── ...other-files
```

### Project-Level Settings

**File**: `.ax/settings.json` (in your project root)

**Scope**: Project-specific - overrides user settings

**Use Cases**:
- Project-specific model selection
- MCP server configurations
- Project-specific API keys (if needed)

**Directory Structure**:
```bash
your-project/
├── .ax/
│   ├── settings.json       # Project configuration
│   ├── CUSTOM.md           # Project instructions
│   └── index.json          # Generated project index
├── src/
├── package.json
└── ...
```

### Custom Instructions

**File**: `.ax/AX.md` or `.ax-cli/CUSTOM.md` (in your project root)

**Scope**: Project-specific behavioral guidance

**Use Cases**:
- Code style guidelines
- Project conventions
- Testing standards
- Documentation requirements

---

## Environment Variables

AX CLI respects standard environment variables for configuration. These take precedence over file-based settings but not command-line flags.

### API Configuration

| Variable | Purpose | Example | Required |
|----------|---------|---------|----------|
| `GROK_API_KEY` | API key for cloud providers | `xai-your_key_here` | Conditional* |
| `GROK_BASE_URL` | API endpoint URL | `https://api.x.ai/v1` | No |
| `GROK_MODEL` | Default model to use | `grok-code-fast-1` | No |
| `GROK_MAX_TOKENS` | Maximum output tokens | `8192` | No |
| `GROK_TEMPERATURE` | Model temperature (0.0-2.0) | `0.7` | No |

*Only required when using cloud providers. Not needed for local Ollama setup.

### Optional Features

| Variable | Purpose | Example |
|----------|---------|---------|
| `MORPH_API_KEY` | Morph Fast Apply key | `morph_your_key_here` |
| `DEBUG` | Enable debug logging | `1` |

### Setting Environment Variables

**Bash/Zsh**:
```bash
# One-time export (current session only)
export GROK_API_KEY="your_key_here"

# Permanent (add to ~/.bashrc or ~/.zshrc)
echo 'export GROK_API_KEY="your_key_here"' >> ~/.bashrc
source ~/.bashrc
```

**Using .env File**:
```bash
# Create .env in your project (add to .gitignore)
cp .env.example .env
# Edit .env with your keys
# Load with: npm run dev (if configured in package.json)
```

**Temporary Override**:
```bash
# Use only for this command
GROK_API_KEY="test_key" ax-cli -p "test prompt"
```

---

## Configuration Priority

AX CLI applies settings in this order (highest to lowest priority):

```
1. Command Line Flags        (highest priority)
2. Environment Variables
3. Project Settings          (.ax/settings.json)
4. User Settings             (~/.ax/user-settings.json)
5. System Defaults           (lowest priority)
```

### Example: Model Selection

Different ways to specify the model, in order of priority:

```bash
# 1. HIGHEST: Command line flag (always wins)
ax-cli --model grok-4-latest

# 2. Environment variable
export GROK_MODEL="grok-code-fast-1"
ax-cli  # Uses grok-code-fast-1

# 3. Project settings (.ax/settings.json)
# { "model": "glm4:9b" }
ax-cli  # Uses glm4:9b

# 4. User settings (~/.ax/user-settings.json)
# { "defaultModel": "grok-3-latest" }
ax-cli  # Uses grok-3-latest

# 5. LOWEST: System default
# Built-in default: grok-code-fast-1
ax-cli  # Uses system default
```

---

## User Settings

User settings apply globally across all projects. Store your API keys and global preferences here.

### File Location

`~/.ax/user-settings.json`

### Creating User Settings

```bash
# Create the directory
mkdir -p ~/.ax

# Create empty settings file
touch ~/.ax/user-settings.json
```

### Setting Options

| Option | Type | Purpose | Example |
|--------|------|---------|---------|
| `apiKey` | string | API key for cloud providers | `"xai-your_key"` |
| `baseURL` | string | API endpoint URL | `"https://api.x.ai/v1"` |
| `defaultModel` | string | Default model name | `"grok-code-fast-1"` |
| `models` | string[] | Available models list | `["grok-4-latest", ...]` |
| `temperature` | number | Default temperature (0.0-2.0) | `0.7` |
| `maxTokens` | number | Default max output tokens | `4096` |

### Example: Offline Setup with Ollama

**Perfect for**: Complete privacy, no API keys, local models

```json
{
  "baseURL": "http://localhost:11434/v1",
  "defaultModel": "glm4:9b",
  "models": [
    "glm4:9b",
    "glm4v:9b",
    "llama3.1:8b",
    "qwen2.5:7b",
    "mistral:7b"
  ]
}
```

### Example: Cloud Provider Setup (X.AI)

**Perfect for**: Fast models, latest updates, enterprise features

```json
{
  "apiKey": "xai-your_api_key_here",
  "baseURL": "https://api.x.ai/v1",
  "defaultModel": "grok-code-fast-1",
  "models": [
    "grok-code-fast-1",
    "grok-4-latest",
    "grok-3-latest",
    "grok-2-latest"
  ]
}
```

### Example: Cloud Provider Setup (Z.AI - GLM Models)

**Perfect for**: GLM-4.6 with 200K context, reasoning mode

```json
{
  "apiKey": "your_zai_api_key_here",
  "baseURL": "https://api.z.ai/v1",
  "defaultModel": "glm-4.6",
  "models": [
    "glm-4.6",
    "glm-4-air",
    "glm-4-airx"
  ]
}
```

### Example: Cloud Provider Setup (OpenRouter)

**Perfect for**: Multiple models from different providers

```json
{
  "apiKey": "sk-or-your_openrouter_key_here",
  "baseURL": "https://openrouter.ai/api/v1",
  "defaultModel": "anthropic/claude-3.5-sonnet",
  "models": [
    "anthropic/claude-3.5-sonnet",
    "openai/gpt-4o",
    "meta-llama/llama-3.1-70b-instruct",
    "google/gemini-pro-1.5"
  ]
}
```

### Example: Multi-Provider Setup

**Perfect for**: Flexibility to switch between providers

```json
{
  "apiKey": "your_primary_key",
  "baseURL": "https://api.x.ai/v1",
  "defaultModel": "grok-code-fast-1",
  "models": [
    "grok-code-fast-1",
    "grok-4-latest"
  ],
  "temperature": 0.7,
  "maxTokens": 8192
}
```

---

## Project Settings

Project settings are shared with your team and override user settings for project-specific configurations.

### File Location

`.ax/settings.json` (in your project root)

### Creating Project Settings

```bash
# Create the directory
mkdir -p .ax

# Create empty settings file
touch .ax/settings.json
```

### Setting Options

| Option | Type | Purpose | Example |
|--------|------|---------|---------|
| `model` | string | Project's default model | `"grok-code-fast-1"` |
| `temperature` | number | Project's temperature (0.0-2.0) | `0.8` |
| `maxTokens` | number | Project's max output tokens | `4096` |
| `mcpServers` | object | MCP server configurations | `{...}` |

### Basic Project Settings

**Without MCP servers**:
```json
{
  "model": "grok-code-fast-1",
  "temperature": 0.7,
  "maxTokens": 4096
}
```

### Example: With MCP Integration

**Complete project setup with external integrations**:
```json
{
  "model": "grok-code-fast-1",
  "temperature": 0.8,
  "maxTokens": 8192,
  "mcpServers": {
    "linear": {
      "name": "linear",
      "transport": "sse",
      "url": "https://mcp.linear.app/sse"
    },
    "github": {
      "name": "github",
      "transport": "stdio",
      "command": "npx",
      "args": ["@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_TOKEN": "ghp_your_token_here"
      }
    }
  }
}
```

### Example: TypeScript Project Settings

```json
{
  "model": "grok-code-fast-1",
  "temperature": 0.6,
  "maxTokens": 8192,
  "mcpServers": {
    "github": {
      "name": "github",
      "transport": "stdio",
      "command": "npx",
      "args": ["@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_TOKEN": "ghp_your_token"
      }
    }
  }
}
```

### Team Configuration Tips

**Add to Git**:
```bash
# Share project configuration with team
git add .ax/settings.json
git commit -m "Add AX CLI project configuration"
```

**Keep Secrets Separate**:
```bash
# Don't commit API keys
# Use environment variables instead
echo ".ax/*-keys.json" >> .gitignore
echo ".ax/.env" >> .gitignore

# Or use .env and let each team member configure
```

**Document for Team**:
```bash
# Create .ax/README.md for team guidance
touch .ax/README.md
```

---

## Custom Instructions

Tailor AX CLI's behavior to your project's specific needs with custom instructions.

### File Location

`.ax/AX.md` or `.ax-cli/CUSTOM.md` (in your project root)

### Creating Custom Instructions

```bash
# Create the file
touch .ax/AX.md
```

### How It Works

1. **Auto-Loading**: AX automatically loads `.ax/AX.md` when working in your project
2. **Priority**: Custom instructions override default AI behavior
3. **Scope**: Instructions apply only to the current project
4. **Format**: Use markdown for clear, structured instructions

### Example: TypeScript Project

```markdown
# Custom Instructions for AX CLI

## Code Style
- Always use TypeScript for new code files
- Prefer const assertions and explicit typing
- Use functional components with React hooks
- Follow the project's existing ESLint configuration

## Imports & Modules
- **CRITICAL**: Always use `.js` extension in ESM imports
- Example: `import { fn } from './utils.js'` ✓
- Never: `import { fn } from './utils'` ✗

## Documentation
- Add JSDoc comments for all public functions
- Include type annotations in JSDoc
- Document complex algorithms with inline comments
- Example:
  ```typescript
  /**
   * Process user data
   * @param users Array of user objects
   * @returns Processed users with timestamps
   */
  function processUsers(users: User[]): ProcessedUser[] { }
  ```

## Testing
- Write tests using Vitest
- Aim for 80%+ code coverage
- Include edge cases and error scenarios
- Test file location: `tests/` directory
- Example: `tests/utils/process.test.ts` for `src/utils/process.ts`

## File Structure
- **Components**: `src/components/`
- **Utilities**: `src/utils/`
- **Types**: `src/types/`
- **Schemas**: `src/schemas/`
- **Tests**: `tests/`

## Validation
- Use **Zod** for runtime validation
- Validate all external inputs
- Example: Config file validation, API response validation

## Build & Development
- Build command: `npm run build`
- Dev mode: `npm run dev`
- Test command: `npm test`
- Linting: `npm run lint`
```

### Example: Python Data Science Project

```markdown
# Custom Instructions for AX CLI

## Code Standards
- Follow PEP 8 style guide
- Use type hints for function signatures
- Prefer pandas for data manipulation
- Use numpy for numerical operations
- Use matplotlib for visualization

## Documentation
- Add docstrings in Google format
- Include usage examples in docstrings
- Document data schemas and transformations
- Example:
  ```python
  def load_data(path: str) -> pd.DataFrame:
      """Load data from CSV file.

      Args:
          path: Path to CSV file

      Returns:
          Loaded DataFrame with validation

      Raises:
          FileNotFoundError: If file doesn't exist
      """
  ```

## Best Practices
- Always validate input data types
- Handle missing values explicitly
- Add error handling for file operations
- Use logging instead of print statements
- Create separate files for utility functions

## Testing
- Use pytest for testing
- Aim for 70%+ code coverage
- Include both unit and integration tests
- Test file: `tests/test_module.py` for `module.py`

## File Structure
- **Source code**: `src/` or top-level `.py` files
- **Tests**: `tests/`
- **Data**: `data/` (add to .gitignore for large files)
- **Notebooks**: `notebooks/` for exploration only
- **Config**: `config/` for configuration files

## Dependencies
- Document all dependencies in `requirements.txt`
- Use virtual environments for isolation
- Pin versions for reproducibility
```

### Example: API/Backend Project

```markdown
# Custom Instructions for AX CLI

## API Design
- Use RESTful principles
- Return appropriate HTTP status codes
- Document all endpoints with examples
- Use versioning in URLs if needed

## Error Handling
- Provide meaningful error messages
- Include error codes in responses
- Log all errors with context
- Return consistent error format

## Validation
- Validate all input data
- Return validation errors with field details
- Use schema validation (Zod, Pydantic, etc.)

## Testing
- Write unit tests for all endpoints
- Include integration tests
- Test error cases and edge cases
- Aim for 80%+ coverage

## Documentation
- Document API endpoints in README
- Include example requests and responses
- Document environment variables required
- Provide setup instructions
```

### Tips for Effective Custom Instructions

1. **Be Specific**: Reference actual project structure and tools
2. **Show Examples**: Include code examples for clarity
3. **Highlight Critical Rules**: Use caps for non-negotiable rules
4. **Keep Updated**: Update when project standards change
5. **Team Focused**: Include conventions your team follows

---

## Model Configuration

AX CLI supports any OpenAI-compatible API endpoint with built-in support for popular models.

### Built-in Models

These models are pre-configured and optimized:

| Model | Provider | Context | Max Output | Thinking Mode | Best For |
|-------|----------|---------|-----------|---------------|----------|
| **glm-4.6** ⭐ | Z.AI | 200K | 128K | ✅ Yes | Default - Long context, reasoning |
| **grok-code-fast-1** | X.AI | 128K | 4K | ❌ No | Fast code generation |
| **glm-4-air** | Z.AI | 128K | 8K | ❌ No | Balanced performance |
| **glm-4-airx** | Z.AI | 8K | 8K | ❌ No | Lightweight interactions |

### Supported Providers

AX CLI supports ANY OpenAI-compatible API endpoint:

| Provider | Base URL | Best For |
|----------|----------|----------|
| **Z.AI** | `https://api.z.ai/v1` | GLM models, 200K context |
| **X.AI (Grok)** | `https://api.x.ai/v1` | Fast code generation |
| **OpenAI** | `https://api.openai.com/v1` | GPT-4, general purpose |
| **Anthropic** | `https://api.anthropic.com/v1` | Claude models |
| **OpenRouter** | `https://openrouter.ai/api/v1` | 100+ models, multi-provider |
| **Groq** | `https://api.groq.com/openai/v1` | Ultra-fast inference |
| **Ollama** | `http://localhost:11434/v1` | Local, offline, private |

### Configuring a New Model

**Option 1: User Settings**
```json
{
  "apiKey": "your_key",
  "baseURL": "https://api.provider.com/v1",
  "defaultModel": "provider-model-name",
  "models": ["provider-model-name"]
}
```

**Option 2: Environment Variables**
```bash
export GROK_API_KEY="your_key"
export GROK_BASE_URL="https://api.provider.com/v1"
export GROK_MODEL="provider-model-name"
```

**Option 3: Command Line**
```bash
ax-cli --api-key your_key \
       --base-url https://api.provider.com/v1 \
       --model provider-model-name
```

### Model Parameters

Configure model behavior with these parameters:

| Parameter | Type | Range | Purpose |
|-----------|------|-------|---------|
| `temperature` | number | 0.0 - 2.0 | Randomness: 0=deterministic, 2=creative |
| `maxTokens` | number | 1-128000 | Maximum output length |
| `topP` | number | 0.0 - 1.0 | Nucleus sampling diversity |

**Example Configuration**:
```json
{
  "temperature": 0.7,
  "maxTokens": 8192
}
```

**Default Values**:
- `temperature`: 0.7 (balanced)
- `maxTokens`: 4096
- `topP`: 1.0 (use full distribution)

---

## MCP Server Configuration

Model Context Protocol (MCP) servers extend AX CLI with external integrations.

### What is MCP?

MCP enables AI models to interact with external tools and services:
- **Linear**: Project management and issue tracking
- **GitHub**: Version control and PR management
- **Databases**: Query and manage data
- **APIs**: Connect to external services

### Configuration Location

MCP servers are configured in `.ax/settings.json`:

```json
{
  "mcpServers": {
    "server-name": {
      "name": "server-name",
      "transport": "stdio|http|sse",
      ...transport-specific-options
    }
  }
}
```

### Transport Types

#### Stdio Transport

**For**: Local processes, Node.js/Python servers

```json
{
  "name": "github",
  "transport": "stdio",
  "command": "npx",
  "args": ["@modelcontextprotocol/server-github"],
  "env": {
    "GITHUB_TOKEN": "your_token"
  }
}
```

#### HTTP Transport

**For**: REST APIs, remote services

```json
{
  "name": "my-api",
  "transport": "http",
  "url": "http://localhost:3000"
}
```

#### SSE Transport

**For**: Server-Sent Events, real-time updates

```json
{
  "name": "linear",
  "transport": "sse",
  "url": "https://mcp.linear.app/sse"
}
```

### Complete MCP Configuration Example

```json
{
  "model": "grok-code-fast-1",
  "mcpServers": {
    "linear": {
      "name": "linear",
      "transport": "sse",
      "url": "https://mcp.linear.app/sse"
    },
    "github": {
      "name": "github",
      "transport": "stdio",
      "command": "npx",
      "args": ["@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_TOKEN": "ghp_your_token"
      }
    },
    "custom-api": {
      "name": "custom-api",
      "transport": "http",
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

### Adding MCP Servers via CLI

**Add with command line**:
```bash
# SSE server
ax-cli mcp add linear --transport sse --url "https://mcp.linear.app/sse"

# Stdio server
ax-cli mcp add github \
  --transport stdio \
  --command "npx" \
  --args "@modelcontextprotocol/server-github" \
  --env "GITHUB_TOKEN=your_token"

# HTTP server
ax-cli mcp add my-api --transport http --url "http://localhost:3000"
```

**Add from JSON**:
```bash
ax-cli mcp add-json my-server '{
  "command": "bun",
  "args": ["server.js"],
  "env": {
    "API_KEY": "your_key"
  }
}'
```

### Managing MCP Servers

```bash
# List all configured servers
ax-cli mcp list

# Test server connection and tools
ax-cli mcp test server-name

# View server details
ax-cli mcp info server-name

# Remove a server
ax-cli mcp remove server-name
```

---

## Quick Setup Examples

### Setup 1: Offline Development (Complete Privacy)

**Perfect for**: Developers who prioritize privacy, work with sensitive data, offline capability

```bash
# Step 1: Install Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# Step 2: Pull GLM model
ollama pull glm4:9b

# Step 3: Start Ollama (runs as background service)
ollama serve

# Step 4: Create user settings
mkdir -p ~/.ax
cat > ~/.ax/user-settings.json <<'EOF'
{
  "baseURL": "http://localhost:11434/v1",
  "defaultModel": "glm4:9b",
  "models": [
    "glm4:9b",
    "llama3.1:8b",
    "qwen2.5:7b"
  ]
}
EOF

# Step 5: Start using AX CLI
ax-cli
```

### Setup 2: Cloud Provider (X.AI)

**Perfect for**: Teams needing latest models, fast inference, enterprise features

```bash
# Step 1: Get API key from X.AI
# https://x.ai - sign up and generate API key

# Step 2: Create user settings
mkdir -p ~/.ax
cat > ~/.ax/user-settings.json <<'EOF'
{
  "apiKey": "xai-your_api_key_here",
  "baseURL": "https://api.x.ai/v1",
  "defaultModel": "grok-code-fast-1",
  "models": [
    "grok-code-fast-1",
    "grok-4-latest"
  ]
}
EOF

# Step 3: Start using AX CLI
ax-cli
```

### Setup 3: Multi-Model Access (OpenRouter)

**Perfect for**: Testing different models, hybrid workflows

```bash
# Step 1: Get API key from OpenRouter
# https://openrouter.ai - sign up

# Step 2: Create user settings
mkdir -p ~/.ax
cat > ~/.ax/user-settings.json <<'EOF'
{
  "apiKey": "sk-or-your_openrouter_key",
  "baseURL": "https://openrouter.ai/api/v1",
  "defaultModel": "anthropic/claude-3.5-sonnet",
  "models": [
    "anthropic/claude-3.5-sonnet",
    "openai/gpt-4o",
    "meta-llama/llama-3.1-70b"
  ]
}
EOF

# Step 3: Try different models
ax-cli --model gpt-4o
ax-cli --model llama-3.1-70b
```

### Setup 4: Team Project with MCP

**Perfect for**: Teams needing integrated workflows (GitHub, Linear, etc.)

```bash
# Step 1: Navigate to project
cd /path/to/your/project

# Step 2: Create project configuration
mkdir -p .ax
cat > .ax/settings.json <<'EOF'
{
  "model": "grok-code-fast-1",
  "mcpServers": {
    "github": {
      "name": "github",
      "transport": "stdio",
      "command": "npx",
      "args": ["@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_TOKEN": "ghp_your_token"
      }
    }
  }
}
EOF

# Step 3: Create custom instructions
cat > .ax/AX.md <<'EOF'
# Custom Instructions

## Code Standards
- Use TypeScript with strict type checking
- Follow existing project conventions
- Write tests for new features

## Testing
- Use Vitest for unit tests
- Aim for 80%+ coverage

## File Structure
- Source: src/
- Tests: tests/
- Types: src/types/
EOF

# Step 4: Commit to git
git add .ax/
git commit -m "Add AX CLI configuration"

# Step 5: Initialize project analysis
ax-cli init

# Step 6: Start using with team
ax-cli
```

### Setup 5: Development with Environment Variables

**Perfect for**: CI/CD pipelines, automated workflows, testing

```bash
# Create .env file
cat > .env <<'EOF'
GROK_API_KEY=your_api_key
GROK_BASE_URL=https://api.x.ai/v1
GROK_MODEL=grok-code-fast-1
EOF

# Add to .gitignore
echo ".env" >> .gitignore

# Use in scripts
source .env
ax-cli --prompt "list all TypeScript files"

# Or with npm
# In package.json:
# "scripts": {
#   "ax": "ax-cli -p"
# }
npm run ax "describe the project structure"
```

---

## Migration from Grok to AX CLI

If you were using legacy `.grok` configuration:

```bash
# The system automatically detects and migrates:
# ~/.grok/user-settings.json → ~/.ax/user-settings.json
# .grok/settings.json → .ax/settings.json
# .grok/AX.md → .ax/AX.md

# Or manually migrate:
mkdir -p ~/.ax
cp ~/.grok/user-settings.json ~/.ax/user-settings.json
cp .grok/settings.json .ax/settings.json
cp .grok/AX.md .ax/AX.md
```

---

## Troubleshooting

### Configuration Not Loading

**Check in this order**:
1. Verify file locations: `~/.ax/user-settings.json`, `.ax/settings.json`
2. Validate JSON syntax: use [jsonlint.com](https://jsonlint.com)
3. Check file permissions: `ls -la ~/.ax/`
4. Verify environment variables: `echo $GROK_API_KEY`

**Debug**:
```bash
# Test configuration loading
ax-cli --help  # Shows loaded configuration
```

### API Key Not Found

```bash
# Check in this order:
1. CLI flag: ax-cli --api-key your_key
2. Environment: echo $GROK_API_KEY
3. Project settings: cat .ax/settings.json
4. User settings: cat ~/.ax/user-settings.json
```

### Wrong Model Being Used

```bash
# Check priority:
ax-cli --model grok-code-fast-1  # 1. CLI flag wins
GROK_MODEL=other ax-cli          # 2. Then environment
# .ax/settings.json { "model": "..." }  # 3. Then project
# ~/.ax/user-settings.json { "defaultModel": "..." }  # 4. Then user
# Default: grok-code-fast-1  # 5. Finally default
```

### MCP Server Not Connecting

```bash
# Test connection
ax-cli mcp test server-name

# Check configuration
ax-cli mcp info server-name

# Verify in settings
cat .ax/settings.json | grep -A5 mcpServers
```

---

## Best Practices

### Security

1. **Never commit API keys**: Use `.gitignore` and environment variables
2. **Use separate files**: Keep secrets in `~/.ax/user-settings.json` (not shared)
3. **Rotate keys regularly**: Change API keys periodically
4. **Use .env for testing**: Don't commit test API keys

```bash
# .gitignore
.env
.env.local
.ax/*-keys.json
```

### Team Workflow

1. **Commit project settings**: Share `.ax/settings.json` for consistency
2. **Keep instructions updated**: Update `.ax/AX.md` as standards evolve
3. **Document models**: Mention which models the team uses
4. **Agree on rules**: Team discussion before adding custom instructions

### Performance

1. **Set appropriate model**: Use fast models for quick tasks
2. **Limit tool rounds**: Use `--max-tool-rounds` for faster responses
3. **Cache models locally**: Use Ollama for frequently used models

### Maintenance

1. **Review settings quarterly**: Remove unused models/servers
2. **Keep instructions current**: Update when project changes
3. **Test MCP servers**: Verify connections periodically

---

## Additional Resources

- **Main README**: [Full usage documentation](../README.md)
- **Custom Instructions Guide**: Learn how to enhance project-specific AI behavior
- **MCP Integration Guide**: Setting up external integrations
- **Model Documentation**: [GLM-4.6 Usage Guide](./glm-4.6-usage-guide.md)
- **Providers & Models**: [Model Configuration Reference](./models-providers.md)

---

<p align="center">
  <strong>Configuration Options</strong><br>
  <em>Designed for flexibility and team collaboration</em>
</p>
