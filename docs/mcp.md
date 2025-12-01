# MCP (Model Context Protocol) Integration Guide

Complete guide to extending AX CLI with Model Context Protocol servers for advanced integrations.

---

## Table of Contents

1. [What is MCP](#what-is-mcp)
2. [Core Concepts](#core-concepts)
3. [Available Transports](#available-transports)
4. [Adding MCP Servers](#adding-mcp-servers)
5. [Managing MCP Servers](#managing-mcp-servers)
   - [Listing Servers](#listing-servers)
   - [Discovering Tools](#discovering-tools)
   - [Testing Server Connection](#testing-server-connection)
   - [Health Monitoring](#health-monitoring)
   - [Validating Configuration (Phase 4)](#validating-configuration-phase-4)
   - [Resource References (Phase 4)](#resource-references-phase-4)
   - [Token Output Limiting (Phase 4)](#token-output-limiting-phase-4)
   - [MCP Server Registry (Phase 5)](#mcp-server-registry-phase-5)
   - [Automatic Reconnection (Phase 5)](#automatic-reconnection-phase-5)
6. [Configuration](#configuration)
7. [Popular MCP Servers](#popular-mcp-servers)
8. [Integration Examples](#integration-examples)
9. [Troubleshooting](#troubleshooting)
10. [Best Practices](#best-practices)

---

## What is MCP?

**Model Context Protocol (MCP)** is an open-source standard that enables AI models to safely interact with external tools, services, and data sources.

### MCP as "Plugins for AI"

Think of MCP like plugins or extensions for AI models. It provides a standardized way to:

- **Extend Capabilities**: Add project management (Linear), version control (GitHub), databases, APIs, and more
- **Maintain Safety**: Structured protocols ensure secure interaction with external systems
- **Enable Integration**: Seamlessly connect AI models with third-party services
- **Standardize Communication**: Universal interface regardless of underlying service

### Key Benefits

| Benefit | Description |
|---------|-------------|
| **Extensibility** | Add new tools and integrations without modifying AX CLI core |
| **Safety** | Strict protocol ensures controlled access to external systems |
| **Flexibility** | Support for multiple transport types (stdio, HTTP, SSE) |
| **Discoverability** | AI models automatically discover available tools from MCP servers |
| **Reliability** | Built-in error handling and connection management |

---

## Core Concepts

### MCP Architecture

```
┌──────────────────────────────────────────┐
│           AX CLI Agent                    │
│  (Grok, Claude, or other LLM)             │
└──────────────────┬───────────────────────┘
                   │
          ┌────────┴────────┐
          │                 │
     ┌────▼────┐      ┌─────▼──────┐
     │  Tools  │      │MCP Manager  │
     └─────────┘      └─────┬──────┘
                            │
         ┌──────────────────┼──────────────────┐
         │                  │                  │
    ┌────▼──┐         ┌─────▼───┐        ┌────▼───┐
    │ Stdio │         │  HTTP   │        │  SSE   │
    │Client │         │ Client  │        │Client  │
    └────┬──┘         └─────┬───┘        └────┬───┘
         │                  │                 │
    ┌────▼──────────────────▼─────────────────▼───┐
    │           MCP Servers                        │
    │ ┌──────┐ ┌────────┐ ┌──────┐ ┌───────────┐ │
    │ │Linear│ │ GitHub │ │Custom│ │   APIs    │ │
    │ └──────┘ └────────┘ └──────┘ └───────────┘ │
    └────────────────────────────────────────────┘
```

### Server Configuration

Each MCP server configuration includes:

```typescript
interface MCPServerConfig {
  name: string;                    // Unique server identifier
  transport: TransportConfig;      // How to communicate
}

interface TransportConfig {
  type: 'stdio' | 'http' | 'sse';  // Transport method
  command?: string;                // Executable (stdio only)
  args?: string[];                 // Arguments (stdio only)
  env?: Record<string, string>;    // Environment variables
  url?: string;                    // Server URL (http/sse only)
  headers?: Record<string, string>;// Custom headers (http only)
}
```

---

## Available Transports

AX CLI supports three transport types for MCP servers:

### 1. **STDIO Transport**

**Best for**: Local processes, Node.js/Python servers, self-hosted solutions

**Characteristics**:
- Direct process execution
- Most common for local development
- Lower latency
- Full process control

**Requirements**:
- Executable/command available on system
- Node.js, Python, or other runtime installed

**Example**:
```bash
ax-cli mcp add my-server \
  --transport stdio \
  --command "bun" \
  --args "server.js"
```

**Use Cases**:
- Running custom MCP servers locally
- Integration with local build tools
- Development and testing
- Private/internal tools

### 2. **HTTP Transport**

**Best for**: RESTful APIs, remote services, cloud-hosted solutions

**Characteristics**:
- Network-based communication
- Works over HTTP/HTTPS
- Supports remote services
- Requires working network connection

**Requirements**:
- HTTP server listening on specified URL
- Network accessibility

**Example**:
```bash
ax-cli mcp add my-api \
  --transport http \
  --url "http://localhost:3000"
```

**Use Cases**:
- Custom REST API servers
- Internal company APIs
- On-premise solutions
- Services requiring authentication

### 3. **SSE Transport** (Server-Sent Events)

**Best for**: Real-time updates, cloud services, SaaS integrations

**Characteristics**:
- Server-Sent Events protocol
- Real-time bidirectional communication
- Cloud-native design
- Event streaming

**Requirements**:
- SSE server endpoint
- Network accessibility

**Example**:
```bash
ax-cli mcp add linear \
  --transport sse \
  --url "https://mcp.linear.app/sse"
```

**Use Cases**:
- SaaS platform integrations
- Real-time data updates
- Cloud services (Linear, etc.)
- Event-driven architectures

### Transport Comparison

| Aspect | Stdio | HTTP | SSE |
|--------|-------|------|-----|
| **Startup** | Fast | Medium | Medium |
| **Latency** | Low | Medium | Low |
| **Remote** | ❌ | ✅ | ✅ |
| **Real-time** | Limited | Limited | ✅ |
| **Complexity** | Low | Medium | Medium |
| **Local Only** | ✅ | ❌ | ❌ |
| **Setup Effort** | Low | Medium | Low |

---

## Adding MCP Servers

### Quick Start with Templates

The easiest way to add MCP servers is using pre-configured templates:

```bash
# Browse available templates
ax-cli mcp browse

# View all templates
ax-cli mcp templates

# Filter templates by category
ax-cli mcp templates --category design

# Add a server using template (recommended)
ax-cli mcp add figma --template
```

### Basic Command Structure

```bash
ax-cli mcp add <name> [options]
```

### Adding via Templates (Recommended)

Pre-configured templates make setup quick and error-free:

```bash
# Figma (Design)
export FIGMA_ACCESS_TOKEN="your_token"
ax-cli mcp add figma --template

# GitHub (Version Control)
export GITHUB_TOKEN="ghp_your_token"
ax-cli mcp add github --template

# Vercel (Deployment)
export VERCEL_TOKEN="your_token"
ax-cli mcp add vercel --template

# Puppeteer (Testing)
ax-cli mcp add puppeteer --template

# Sentry (Monitoring)
export SENTRY_AUTH_TOKEN="your_token"
ax-cli mcp add sentry --template
```

**Available Templates**:
- **Design**: Figma
- **Version Control**: GitHub
- **Deployment**: Vercel, Netlify, Firebase
- **Testing**: Puppeteer, Storybook, Chromatic
- **Monitoring**: Sentry
- **Backend**: Supabase, Postgres, SQLite

**Benefits of Templates**:
- ✅ Pre-validated configurations
- ✅ Clear environment variable requirements
- ✅ Setup instructions and troubleshooting tips
- ✅ Usage examples
- ✅ Best practices included

### Adding via CLI Flags

#### Stdio Transport

```bash
# Simple command
ax-cli mcp add my-server \
  --transport stdio \
  --command "bun" \
  --args "server.js"

# With environment variables
ax-cli mcp add my-server \
  --transport stdio \
  --command "python" \
  --args "-m" "my_mcp_server" \
  --env "API_KEY=secret" \
  --env "DEBUG=true"

# Node.js package
ax-cli mcp add github \
  --transport stdio \
  --command "npx" \
  --args "@modelcontextprotocol/server-github" \
  --env "GITHUB_TOKEN=your_token"
```

#### HTTP Transport

```bash
# Basic HTTP server
ax-cli mcp add my-api \
  --transport http \
  --url "http://localhost:3000"

# With authentication
ax-cli mcp add secure-api \
  --transport http \
  --url "https://api.example.com/mcp" \
  --env "API_KEY=your_key"
```

#### SSE Transport

```bash
# Public SaaS service
ax-cli mcp add linear \
  --transport sse \
  --url "https://mcp.linear.app/sse"

# Custom SSE endpoint
ax-cli mcp add custom-events \
  --transport sse \
  --url "https://events.example.com/mcp"
```

### Adding from JSON Configuration

For complex setups, use JSON configuration:

```bash
ax-cli mcp add-json my-server '{
  "command": "bun",
  "args": ["server.js"],
  "env": {
    "API_KEY": "your_key",
    "LOG_LEVEL": "debug",
    "TIMEOUT": "30000"
  }
}'
```

### Interactive Mode

```bash
# Start interactive setup
ax-cli mcp add
# Follow prompts to configure server
```

---

## Managing MCP Servers

### Listing Servers

```bash
# List all configured servers
ax-cli mcp list

# Output example:
# Linear (SSE)          ✓ Connected
# GitHub (Stdio)        ✓ Connected
# Custom API (HTTP)     ✗ Disconnected
```

### Discovering Tools

Preview available tools from MCP servers:

```bash
# List all tools from a specific server
ax-cli mcp tools figma

# Output:
# 🔧 figma Tools (5 available)
#
# ├─ get_file_data
#    Retrieve Figma file structure and metadata
#    Parameters: fileId*
#
# ├─ get_components
#    List all components from a file
#    Parameters: fileId*, componentName
# ...

# Show detailed schemas
ax-cli mcp tools figma --verbose

# Search for tools across all servers
ax-cli mcp search "deploy"

# Output JSON format
ax-cli mcp tools figma --json
```

**Tool Discovery Commands**:
- `ax-cli mcp tools <server>` - List all tools from a server
- `ax-cli mcp search <query>` - Search tools by keyword
- `--verbose` flag - Show full parameter schemas
- `--json` flag - Machine-readable output

### Testing Server Connection

```bash
# Test server connectivity and tools
ax-cli mcp test server-name

# Output includes:
# - Connection status
# - Available tools
# - Server capabilities
# - Response time
```

### Health Monitoring

Check the health and performance of your MCP servers:

```bash
# Check health of all servers
ax-cli mcp health

# Output:
# 📊 MCP Server Health Report
#
# ✓ figma (Connected)
#   Transport: MCP
#   Uptime: 2h 15m
#   Tools: 5 available
#   Latency: avg 45ms, p95 120ms
#   Success Rate: 98.5% (197/200 calls)
#
# ✓ github (Connected)
#   Transport: MCP
#   Uptime: 45m
#   Tools: 12 available
#   Success Rate: 100% (50/50 calls)

# Check health of specific server
ax-cli mcp health figma

# Continuous monitoring (updates every 60 seconds)
ax-cli mcp health --watch

# JSON output for automation
ax-cli mcp health --json
```

**Health Metrics**:
- **Connection Status**: Whether the server is currently connected
- **Uptime**: How long the server has been connected
- **Tool Count**: Number of available tools from the server
- **Latency**: Average and P95 response times
- **Success Rate**: Percentage of successful tool calls
- **Last Error**: Most recent error message (if any)

**Use Cases**:
- Monitor MCP server performance in production
- Debug connectivity issues
- Track reliability metrics
- Set up automated health checks in CI/CD

### Validating Configuration (Phase 4)

Validate MCP server configurations before connecting to catch errors early:

```bash
# Validate server configuration
ax-cli mcp validate server-name

# Output:
# 🔍 Validating "figma" MCP server configuration...
#
# ✅ Configuration is valid
# 🚀 Ready to connect! Use: ax-cli mcp add figma --template
```

**Pre-flight Checks**:
- **Command Availability**: Verifies executables exist in PATH (stdio)
- **URL Accessibility**: Tests HTTP/SSE endpoints are reachable
- **Environment Variables**: Checks required env vars are set
- **Server Name**: Validates naming conventions
- **Transport Config**: Ensures proper transport configuration

**Example - Failed Validation**:
```bash
$ ax-cli mcp validate github

🔍 Validating "github" MCP server configuration...

❌ Validation Failed

  • Command "npx" not found in PATH. Please install it or provide full path.
  • Missing required environment variable: GITHUB_TOKEN - GitHub API token

💡 Fix the errors above and try again
```

### Resource References (Phase 4)

MCP servers can expose resources (database tables, API endpoints, files) that you can reference in chat using `@mcp:` syntax:

```bash
# List all resources from connected servers
ax-cli mcp resources

# Output:
# 📦 MCP Resources
#
# postgres (3 resources)
#   @mcp:postgres/database://users
#     User accounts and profiles
#     Type: application/json
#
#   @mcp:postgres/database://orders
#     Customer orders
#     Type: application/json
#
# rest-api (5 resources)
#   @mcp:rest-api/api://get-user
#     Retrieve user information

# List resources from specific server
ax-cli mcp resources postgres

# Search resources
ax-cli mcp resources --search users

# JSON output
ax-cli mcp resources --json
```

**Using Resources in Chat**:
```bash
# Reference resources directly in prompts
$ ax-cli

> Query the @mcp:postgres/users table for active users

# The AI will automatically:
# 1. Fetch the resource content
# 2. Include it in the context
# 3. Process your request with that data
```

**Resource Reference Format**: `@mcp:<server-name>/<resource-uri>`

**Benefits**:
- **Direct Data Access**: Reference database tables, API endpoints, etc.
- **Automatic Resolution**: Resources are fetched and included in context
- **Type Safety**: MCP protocol ensures proper data formatting
- **Discovery**: Easily browse available resources

### Token Output Limiting (Phase 4)

MCP tool outputs are automatically limited to prevent context overflow:

**Limits** (configurable in `config/settings.yaml`):
- **Warning Threshold**: 10,000 tokens
- **Hard Limit**: 25,000 tokens
- **Truncation**: Enabled by default

**How it Works**:
```yaml
# config/settings.yaml
mcp:
  token_warning_threshold: 10000  # Warn at 10k tokens
  token_hard_limit: 25000         # Truncate at 25k tokens
  truncation_enabled: true        # Enable automatic truncation
```

**When Limit is Exceeded**:
```
⚠️  Output truncated: 30,250 tokens exceeded limit of 25,000 tokens

[First 25,000 tokens of output shown]
```

**Use Cases**:
- Prevents large API responses from overwhelming context
- Protects against database queries returning massive results
- Ensures consistent performance across MCP tools

### MCP Server Registry (Phase 5)

Discover and install MCP servers from the GitHub MCP Registry with one command:

```bash
# Browse popular servers
ax-cli mcp registry

# Search for specific servers
ax-cli mcp registry --search database

# Filter by category
ax-cli mcp registry --category design

# Filter by transport type
ax-cli mcp registry --transport stdio

# JSON output
ax-cli mcp registry --json
```

**One-Command Installation**:
```bash
# Install from registry
ax-cli mcp install github

# Install by package name
ax-cli mcp install @modelcontextprotocol/server-github

# Skip validation
ax-cli mcp install figma --no-validate

# Add config but don't connect
ax-cli mcp install linear --no-connect
```

**Registry Features**:
- **GitHub Integration**: Searches GitHub for MCP servers automatically
- **Verified Servers**: Official `@modelcontextprotocol` servers are badged
- **Star Sorting**: Popular servers appear first
- **Category Filtering**: design, database, api, deployment, testing, etc.
- **Transport Filtering**: stdio, http, sse
- **Auto-Validation**: Validates configuration before installation
- **Auto-Connection**: Connects immediately after installation

**Example Output**:
```
📦 MCP Server Registry

Found 15 server(s)

GitHub [✓ verified] ⭐ 245
  GitHub integration for MCP
  Category: version-control | Transport: stdio
  Install: ax-cli mcp install github

Figma [✓ verified] ⭐ 189
  Figma design integration
  Category: design | Transport: stdio
  Install: ax-cli mcp install figma
```

### Automatic Reconnection (Phase 5)

MCP servers automatically reconnect with exponential backoff when connections fail:

**How It Works**:
- Retry sequence: 1s → 2s → 4s → 8s → 16s → 30s (max)
- Maximum 5 retry attempts by default
- Jitter added to prevent thundering herd
- Integrated with health monitoring

**Configuration** (customizable via `ReconnectionStrategy`):
```typescript
{
  maxRetries: 5,          // Maximum retry attempts
  baseDelayMs: 1000,      // Initial delay (1 second)
  maxDelayMs: 30000,      // Maximum delay (30 seconds)
  backoffMultiplier: 2,   // Double each time
  jitter: true            // Add randomness
}
```

**Reconnection Events**:
- `reconnection-scheduled` - Attempt scheduled
- `reconnection-attempt` - Attempting to reconnect
- `reconnection-success` - Successfully reconnected
- `reconnection-failed` - Attempt failed
- `max-retries-reached` - All attempts exhausted

**Benefits**:
- **Production Reliability**: Automatic recovery from transient failures
- **Smart Backoff**: Prevents overwhelming failed servers
- **Zero Config**: Works automatically with health monitoring
- **Transparent**: Reconnects happen in the background

### Viewing Server Details

```bash
# View complete server information
ax-cli mcp info server-name

# Shows:
# - Transport type
# - Configuration details
# - Available tools
# - Connection status
```

### Removing Servers

```bash
# Remove a server from configuration
ax-cli mcp remove server-name

# Confirmation required:
# Are you sure? This action cannot be undone. (y/N)
```

### Complete Management Example

```bash
# Set up Linear integration
ax-cli mcp add linear \
  --transport sse \
  --url "https://mcp.linear.app/sse"

# Verify it works
ax-cli mcp test linear

# Check configuration
ax-cli mcp info linear

# List all servers
ax-cli mcp list

# Update: remove old server
ax-cli mcp remove linear

# Add updated version
ax-cli mcp add linear \
  --transport sse \
  --url "https://mcp.linear.app/sse"
```

---

## Configuration

### Storage Location

MCP server configurations are stored in your project's `.ax/settings.json`:

```json
{
  "model": "glm-4.6",
  "maxTokens": 8192,
  "temperature": 0.7,
  "mcpServers": {
    "server-name": {
      "name": "server-name",
      "transport": {
        "type": "stdio|http|sse",
        "command": "...",
        "args": [...],
        "url": "...",
        "env": {...}
      }
    }
  }
}
```

### Complete Configuration Example

```json
{
  "model": "glm-4.6",
  "maxTokens": 128000,
  "temperature": 0.8,
  "mcpServers": {
    "linear": {
      "name": "linear",
      "transport": {
        "type": "sse",
        "url": "https://mcp.linear.app/sse"
      }
    },
    "github": {
      "name": "github",
      "transport": {
        "type": "stdio",
        "command": "npx",
        "args": ["@modelcontextprotocol/server-github"],
        "env": {
          "GITHUB_TOKEN": "ghp_your_token"
        }
      }
    },
    "custom-api": {
      "name": "custom-api",
      "transport": {
        "type": "http",
        "url": "https://api.example.com/mcp",
        "headers": {
          "Authorization": "Bearer your_token"
        }
      }
    },
    "local-service": {
      "name": "local-service",
      "transport": {
        "type": "stdio",
        "command": "python",
        "args": ["-m", "my_mcp_module"],
        "env": {
          "API_KEY": "secret_key",
          "LOG_LEVEL": "info"
        }
      }
    }
  }
}
```

### Configuration Priority

When multiple configurations exist, AX CLI uses this priority:

1. **CLI Flags** (highest priority) - command-line arguments
2. **Environment Variables** - `GROK_*` prefixed variables
3. **Project Settings** - `.ax/settings.json`
4. **User Settings** - `~/.ax-cli/config.json`
5. **Defaults** (lowest priority) - built-in defaults

### Environment Variable Usage

Store sensitive data in environment variables:

```bash
# Set environment variables before running AX CLI
export GITHUB_TOKEN="ghp_xxxxxxxxxxxx"
export LINEAR_API_KEY="lin_xxxxxxxxxxxx"
export CUSTOM_API_KEY="your_secret_key"

# Reference in config
ax-cli mcp add github \
  --transport stdio \
  --command "npx" \
  --args "@modelcontextprotocol/server-github" \
  --env "GITHUB_TOKEN=$GITHUB_TOKEN"
```

---

## Popular MCP Servers

### Official & Community Servers

#### Linear (Project Management)

**What it does**: Create, manage, and search Linear issues

```bash
ax-cli mcp add linear \
  --transport sse \
  --url "https://mcp.linear.app/sse"
```

**Capabilities**:
- Create and edit issues
- Search and filter tasks
- Update status and assignees
- Access team/project information
- Add comments and attachments

**Requirements**: Linear account

**Documentation**: https://linear.app/

---

#### GitHub (Version Control)

**What it does**: Create pull requests, manage issues, review code

```bash
ax-cli mcp add github \
  --transport stdio \
  --command "npx" \
  --args "@modelcontextprotocol/server-github" \
  --env "GITHUB_TOKEN=your_github_token"
```

**Capabilities**:
- Create pull requests
- Manage issues
- Review code
- Access repository information
- Manage workflows

**Requirements**: GitHub account, personal access token (PAT)

**Token Setup**:
```bash
# Create a fine-grained PAT at: https://github.com/settings/tokens?type=beta
# Grant these permissions:
# - repo (all)
# - workflow (if needed)

export GITHUB_TOKEN="ghp_xxxxxxxxxxxxxxxxxxxx"
```

**Documentation**: https://docs.github.com/

---

#### Slack (Team Communication)

**What it does**: Send messages, manage channels, search conversations

```bash
ax-cli mcp add slack \
  --transport stdio \
  --command "npx" \
  --args "@modelcontextprotocol/server-slack" \
  --env "SLACK_BOT_TOKEN=your_token" \
  --env "SLACK_TEAM_ID=your_team_id"
```

**Capabilities**:
- Post messages
- Create channels
- Search messages
- Get conversation history
- Manage user presence

**Requirements**: Slack workspace, bot token

**Documentation**: https://api.slack.com/

---

#### Postgres (Database)

**What it does**: Query and manage PostgreSQL databases

```bash
ax-cli mcp add postgres \
  --transport stdio \
  --command "npx" \
  --args "@modelcontextprotocol/server-postgres" \
  --env "DATABASE_URL=postgresql://user:pass@localhost/dbname"
```

**Capabilities**:
- Execute SQL queries
- Manage tables and schemas
- Inspect database structure
- Run migrations

**Requirements**: PostgreSQL database, connection string

**Documentation**: https://www.postgresql.org/

---

#### SQLite (File-based Database)

**What it does**: Query and manage SQLite databases

```bash
ax-cli mcp add sqlite \
  --transport stdio \
  --command "npx" \
  --args "@modelcontextprotocol/server-sqlite" \
  --env "DATABASE_PATH=/path/to/database.db"
```

**Capabilities**:
- Execute SQL queries
- Inspect schema
- Manage data
- Lightweight local queries

**Requirements**: SQLite database file

**Documentation**: https://www.sqlite.org/

---

### Creating Custom MCP Servers

#### Stdio-based Custom Server (Node.js)

```javascript
// server.js
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema
} from '@modelcontextprotocol/sdk/types.js';

const server = new Server({
  name: 'my-custom-server',
  version: '1.0.0',
}, {
  capabilities: {
    tools: {},
  },
});

// Define available tools
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'greet',
      description: 'Greet someone with a custom message',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Name to greet' },
          formal: { type: 'boolean', description: 'Use formal greeting' }
        },
        required: ['name']
      }
    },
    {
      name: 'calculate',
      description: 'Perform basic calculations',
      inputSchema: {
        type: 'object',
        properties: {
          operation: { type: 'string', enum: ['add', 'subtract', 'multiply', 'divide'] },
          a: { type: 'number' },
          b: { type: 'number' }
        },
        required: ['operation', 'a', 'b']
      }
    }
  ]
}));

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === 'greet') {
    const { name, formal } = request.params.arguments;
    const greeting = formal
      ? `Good day, ${name}. I am pleased to make your acquaintance.`
      : `Hey ${name}!`;
    return { content: [{ type: 'text', text: greeting }] };
  }

  if (request.params.name === 'calculate') {
    const { operation, a, b } = request.params.arguments;
    let result;

    switch(operation) {
      case 'add': result = a + b; break;
      case 'subtract': result = a - b; break;
      case 'multiply': result = a * b; break;
      case 'divide': result = a / b; break;
    }

    return { content: [{ type: 'text', text: `Result: ${result}` }] };
  }

  return { content: [{ type: 'text', text: 'Unknown tool' }] };
});

// Start server
await server.connect(new StdioServerTransport());
```

Register it:
```bash
ax-cli mcp add my-custom-server \
  --transport stdio \
  --command "node" \
  --args "server.js"
```

---

## Integration Examples

### Real-world Scenario: Full Development Workflow

Setting up a complete development environment with multiple integrations:

```bash
# 1. Set up project management (Linear)
ax-cli mcp add linear \
  --transport sse \
  --url "https://mcp.linear.app/sse"

# 2. Set up version control (GitHub)
export GITHUB_TOKEN="ghp_your_token"
ax-cli mcp add github \
  --transport stdio \
  --command "npx" \
  --args "@modelcontextprotocol/server-github" \
  --env "GITHUB_TOKEN=$GITHUB_TOKEN"

# 3. Set up database access (Postgres)
export DATABASE_URL="postgresql://user:pass@localhost:5432/mydb"
ax-cli mcp add postgres \
  --transport stdio \
  --command "npx" \
  --args "@modelcontextprotocol/server-postgres" \
  --env "DATABASE_URL=$DATABASE_URL"

# 4. Verify all servers
ax-cli mcp list

# 5. Test each server
ax-cli mcp test linear
ax-cli mcp test github
ax-cli mcp test postgres

# 6. Use in AX CLI
ax-cli
# Now you can ask AX to:
# - "Create a Linear issue for this bug"
# - "Create a PR on GitHub with these changes"
# - "Query the database for user records"
```

### Scenario: Internal Tools Integration

Setting up a custom internal API:

```bash
# 1. Create custom MCP server (see above for implementation)
# 2. Start your custom server
npm run start-mcp-server &

# 3. Register it with AX CLI
ax-cli mcp add internal-api \
  --transport http \
  --url "http://localhost:3000/mcp"

# 4. Test the integration
ax-cli mcp test internal-api

# 5. Use in AX CLI
ax-cli -p "Deploy using the internal deployment API"
```

### Scenario: Secure Token Management

Managing sensitive credentials properly:

```bash
# 1. Store tokens in environment
export LINEAR_API_KEY="lin_xxxxxxxxxxxx"
export GITHUB_TOKEN="ghp_xxxxxxxxxxxx"
export SLACK_BOT_TOKEN="xoxb-xxxxxxxxxxxx"

# 2. Reference in MCP setup (not in config files!)
ax-cli mcp add linear \
  --transport sse \
  --url "https://mcp.linear.app/sse"

ax-cli mcp add github \
  --transport stdio \
  --command "npx" \
  --args "@modelcontextprotocol/server-github" \
  --env "GITHUB_TOKEN=$GITHUB_TOKEN"

# 3. Verify no secrets in config
cat .ax/settings.json | grep -i token  # Should be empty

# 4. Use securely in AX CLI
ax-cli  # Tokens loaded from environment
```

---

## Troubleshooting

### Common Issues and Solutions

#### 1. "Server Connection Failed"

**Symptoms**: `Error: Failed to connect to MCP server`

**Causes & Solutions**:

```bash
# For stdio servers:
# - Check command exists
which bun
which python
which npx

# - Check arguments are correct
ax-cli mcp info server-name  # View current config

# - Test the command directly
bun server.js
python -m my_mcp_server

# For HTTP/SSE servers:
# - Check URL is accessible
curl https://mcp.linear.app/sse

# - Check network/firewall
ping api.example.com

# - Try with timeout
ax-cli mcp test server-name --timeout 10000
```

---

#### 2. "Unknown Tool from Server"

**Symptoms**: MCP server connected but tools not available

**Causes & Solutions**:

```bash
# 1. Verify server lists tools
ax-cli mcp test server-name

# 2. Check server configuration
ax-cli mcp info server-name

# 3. Restart server connection
ax-cli mcp remove server-name
ax-cli mcp add server-name \
  --transport stdio \
  --command "bun" \
  --args "server.js"

# 4. Enable debug logging
DEBUG=1 ax-cli -p "test prompt"
```

---

#### 3. "Authentication Failed"

**Symptoms**: `Error: 401 Unauthorized` or `EAUTH` errors

**Causes & Solutions**:

```bash
# 1. Verify token format and validity
# GitHub token should start with 'ghp_'
echo $GITHUB_TOKEN | head -c 4  # Should show 'ghp_'

# 2. Check token permissions
# Linear, GitHub, Slack all require specific scopes

# 3. Verify token is passed correctly
ax-cli mcp info server-name | grep -i token

# 4. Re-add server with fresh token
ax-cli mcp remove server-name
export NEW_TOKEN="your_fresh_token"
ax-cli mcp add server-name \
  --transport stdio \
  --command "npx" \
  --args "@modelcontextprotocol/server-xxx" \
  --env "API_TOKEN=$NEW_TOKEN"
```

---

#### 4. "Timeout Error"

**Symptoms**: `Error: Request timeout` or hanging connections

**Causes & Solutions**:

```bash
# 1. Check server responsiveness
ax-cli mcp test server-name --timeout 5000

# 2. For stdio servers, check process
ps aux | grep server-name

# 3. Kill and restart
ax-cli mcp remove server-name
ax-cli mcp add server-name --transport stdio --command "bun" --args "server.js"

# 4. Check system resources
# Ensure adequate CPU/memory available
# Close other applications

# 5. Increase timeout in code if needed
# (Advanced: modify transport configuration)
```

---

#### 5. "Module Not Found"

**Symptoms**: `Cannot find module '@modelcontextprotocol/...'`

**Causes & Solutions**:

```bash
# 1. Install MCP SDK packages
npm install @modelcontextprotocol/sdk

# 2. For specific servers, install packages
npm install @modelcontextprotocol/server-github
npm install @modelcontextprotocol/server-linear

# 3. Update npx cache
npx --yes @modelcontextprotocol/server-github --version

# 4. Check Node.js version (24+ recommended)
node --version

# 5. Clear npm cache if needed
npm cache clean --force
npm install
```

---

### Debug Logging

Enable detailed logging for troubleshooting:

```bash
# Enable debug output
DEBUG=mcp:* ax-cli -p "test prompt"

# Or more verbose
DEBUG=* ax-cli -p "test prompt" 2>&1 | tee debug.log

# Check specific server
DEBUG=mcp:linear ax-cli mcp test linear
```

---

## Best Practices

### 1. **Security**

✅ **DO**:
- Store API keys in environment variables
- Use `.env` files (gitignored)
- Rotate tokens regularly
- Use minimal permission scopes
- Review MCP server code before adding

❌ **DON'T**:
- Store tokens in `.ax/settings.json`
- Commit `.env` files
- Share MCP configurations with tokens
- Use overly permissive scopes
- Run untrusted MCP servers

**Example**:
```bash
# ✅ Good: Token in environment
export GITHUB_TOKEN="ghp_xxxx"
ax-cli mcp add github \
  --transport stdio \
  --command "npx" \
  --args "@modelcontextprotocol/server-github" \
  --env "GITHUB_TOKEN=$GITHUB_TOKEN"

# ❌ Bad: Token in config
# Don't do this - token visible in .ax/settings.json
```

---

### 2. **Performance**

✅ **DO**:
- Test server connections regularly
- Monitor resource usage
- Use HTTP transport for remote services
- Cache tool definitions
- Batch operations when possible

❌ **DON'T**:
- Add unnecessary MCP servers
- Leave broken connections
- Make redundant tool calls
- Ignore timeout errors

**Example**:
```bash
# ✅ Efficient: Use specific tools
ax-cli -p "Search Linear for bug #123"

# ❌ Inefficient: Vague request requiring multiple queries
ax-cli -p "Look at all tasks in all projects and find related ones"
```

---

### 3. **Configuration Management**

✅ **DO**:
- Store MCP configs in `.ax/settings.json`
- Use version control for shared configs
- Document custom MCP servers
- Keep configs clean and organized
- Test before committing

❌ **DON'T**:
- Mix configs across projects
- Hardcode URLs/tokens
- Commit sensitive data
- Use outdated server versions
- Ignore validation errors

**Example**:
```json
{
  "model": "glm-4.6",
  "mcpServers": {
    "linear": {
      "name": "linear",
      "transport": {
        "type": "sse",
        "url": "https://mcp.linear.app/sse"
      }
    }
  }
}
```

---

### 4. **Maintenance**

✅ **DO**:
- Regularly test MCP connections
- Update MCP packages periodically
- Review and remove unused servers
- Monitor for deprecations
- Keep documentation updated

❌ **DON'T**:
- Ignore connection errors
- Run outdated packages
- Leave broken servers configured
- Forget to cleanup
- Miss security updates

**Example**:
```bash
# Regular maintenance
ax-cli mcp list              # See all servers
ax-cli mcp test linear       # Test each one
npm update                   # Update packages
ax-cli mcp remove old-api    # Clean up unused
```

---

### 5. **Error Handling**

✅ **DO**:
- Check server status before operations
- Provide fallback operations
- Log errors for debugging
- Handle timeouts gracefully
- Validate tool inputs

❌ **DON'T**:
- Ignore connection failures
- Assume tools always work
- Proceed without validation
- Leave processes hanging
- Forget error context

**Example**:
```bash
# ✅ Good: Handle gracefully
ax-cli mcp test linear && \
  ax-cli -p "Create Linear issue" || \
  echo "Linear server unavailable, using fallback"

# ❌ Bad: Assume it works
ax-cli -p "Create Linear issue"  # Fails silently if server down
```

---

## Advanced Topics

### Custom Transport Implementation

For advanced users needing custom transports:

1. Implement `MCPTransport` interface
2. Extend transport system
3. Register in transport factory
4. Test thoroughly

See `src/mcp/transports.ts` for implementation details.

---

### MCP Server Development

To create your own MCP server:

1. Install SDK: `npm install @modelcontextprotocol/sdk`
2. Implement server interface
3. Define tools with schemas
4. Handle tool calls
5. Test with `ax-cli mcp add`

See [MCP Protocol Documentation](https://modelcontextprotocol.io) for complete details.

---

## Resources

### AX CLI Documentation

- **[MCP for Front-End Developers](./mcp-frontend-guide.md)** - Complete guide for front-end workflows
- **[Features Guide](./features.md)** - All AX CLI features
- **[Configuration Reference](./configuration.md)** - Advanced configuration

### Official Links

- **MCP Protocol**: https://modelcontextprotocol.io
- **MCP GitHub**: https://github.com/modelcontextprotocol
- **MCP Docs**: https://modelcontextprotocol.io/docs

### Popular MCP Servers

- **Figma**: https://figma.com/mcp (Official design-to-code server)
- **Linear**: https://linear.app/
- **GitHub**: https://github.com/
- **Slack**: https://slack.com/
- **PostgreSQL**: https://www.postgresql.org/
- **SQLite**: https://www.sqlite.org/

### AX CLI Links

- **GitHub Repository**: https://github.com/defai-digital/ax-cli
- **NPM Package**: https://www.npmjs.com/package/@defai.digital/ax-cli
- **Issue Tracker**: https://github.com/defai-digital/ax-cli/issues

---

## Summary

MCP (Model Context Protocol) extends AX CLI with powerful integrations:

| Aspect | Key Point |
|--------|-----------|
| **What** | Standard protocol for AI-tool integration |
| **Why** | Extensible, safe, standardized |
| **How** | `ax-cli mcp add <name> [options]` |
| **Where** | Stored in `.ax/settings.json` |
| **Transports** | Stdio (local), HTTP (REST), SSE (real-time) |
| **Security** | Tokens in environment, not configs |
| **Best** | Regular testing, clean management, security first |

Start extending AX CLI with your favorite tools today!

---

**Last Updated**: 2025-11-19
**AX CLI Version**: 1.0.1+
**MCP Protocol**: Latest stable
