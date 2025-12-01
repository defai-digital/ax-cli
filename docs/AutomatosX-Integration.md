# AutomatosX Integration Guide

**Version**: 8.4.15
**Last Updated**: 2025-11-18

This is the complete integration guide for AutomatosX - an AI agent orchestration platform with persistent memory, multi-agent collaboration, and policy-driven routing.

**For AI assistants**: This file contains all AutomatosX commands, agent capabilities, memory features, and workflows. Read this file completely to understand how to use AutomatosX effectively.

---

## What is AutomatosX?

AutomatosX is an AI Agent Orchestration Platform that:
- **Orchestrates 20+ specialized AI agents** for different domains (backend, frontend, security, quality, etc.)
- **Maintains persistent memory** using SQLite FTS5 for instant context retrieval
- **Routes requests intelligently** across multiple AI providers (Claude, Gemini, OpenAI, Grok)
- **Optimizes costs** by prioritizing free tiers and cheaper providers
- **Enables spec-driven workflows** with YAML-based task definitions
- **Supports multi-agent collaboration** with automatic delegation

**Repository**: https://github.com/defai-digital/automatosx

---

## Quick Start

### Installation Check

```bash
# Verify AutomatosX is installed
ax --version

# Check system status
ax status

# List available agents
ax list agents
```

### Basic Commands

```bash
# Run an agent with a task
# Note: You can use either the agent's ID (e.g., 'backend') or display name (e.g., 'Bob')
ax run <agent-name> "task description"

# Example: Backend implementation
ax run backend "create a REST API for user management"

# Example: Code review
ax run quality "review the authentication code"

# Example: Security audit
ax run security "audit the API endpoints for vulnerabilities"

# Search memory for past work
ax memory search "keyword"

# View configuration
ax config show

# Check free-tier usage and status
ax free-tier status
```

---

## Available Agents

AutomatosX includes 20+ specialized agents for different domains:

### Development Agents

- **backend** (Bob) - Backend development (Go/Rust/Node.js systems)
- **frontend** (Frank) - Frontend development (React/Next.js/Swift)
- **fullstack** (Felix) - Full-stack development (Node.js/TypeScript)
- **mobile** (Maya) - Mobile development (iOS/Android, Swift/Kotlin/Flutter)
- **devops** (Oliver) - DevOps and infrastructure automation

### Quality & Security

- **quality** (Queenie) - QA, testing, and code quality assurance
- **security** (Steve) - Security auditing and threat modeling

### Architecture & Design

- **architecture** (Avery) - System architecture and ADR management
- **design** (Debbee) - UX/UI design and interaction patterns

### Data & Science

- **data** (Daisy) - Data engineering and ETL pipelines
- **data-scientist** (Dana) - Machine learning and data science
- **researcher** (Rodman) - Research and analysis

### Leadership & Strategy

- **cto** (Tony) - Technical strategy and technology decisions
- **ceo** (Eric) - Business leadership and strategic direction
- **product** (Paris) - Product management and roadmap planning

### Specialized Domains

- **aerospace-scientist** (Astrid) - Aerospace engineering and mission design
- **quantum-engineer** (Quinn) - Quantum computing and algorithms
- **creative-marketer** (Candy) - Creative marketing and content strategy
- **writer** (Wendy) - Technical writing and documentation
- **standard** (Stan) - Standards and best practices expert

### View All Agents

```bash
# List all agents with descriptions
ax list agents

# JSON format with full capabilities
ax list agents --format json

# Show specific agent details
ax agent show backend
```

---

## Agent Capabilities

Each agent has specialized knowledge and can:

1. **Execute Tasks**: Implement features, write code, create designs
2. **Delegate Work**: Automatically delegate tasks to other agents
3. **Access Memory**: Retrieve past decisions and context
4. **Collaborate**: Work with multiple agents in sessions
5. **Use Tools**: File operations, code analysis, testing

### Example: Backend Agent (Bob)

**Specialization**:
- Go, Rust, Node.js backend systems
- API design and implementation
- Database schema design
- Microservices architecture

**Example Tasks**:
```bash
ax run backend "create a REST API for user authentication"
ax run backend "design a database schema for e-commerce"
ax run backend "implement JWT token validation"
```

### Example: Security Agent (Steve)

**Specialization**:
- Security auditing and vulnerability scanning
- Threat modeling and risk assessment
- OWASP Top 10 compliance
- Authentication and authorization review

**Example Tasks**:
```bash
ax run security "audit the authentication system"
ax run security "review API endpoints for SQL injection"
ax run security "create a threat model for the payment system"
```

---

## Memory System

AutomatosX maintains persistent memory of all agent interactions.

### How Memory Works

- **Automatic**: All agent conversations are saved automatically
- **Fast**: SQLite FTS5 full-text search (< 1ms queries)
- **Local**: 100% private, data never leaves your machine
- **Cost**: $0 (no API calls for memory operations)
- **Storage**: `.automatosx/memory/memories.db`

### Memory Commands

```bash
# Search for past conversations
ax memory search "authentication"
ax memory search "API design"

# List recent memories
ax memory list --limit 10

# Export memory for backup
ax memory export > backup.json

# Import memory
ax memory import < backup.json

# Clear old memories
ax memory clear --before "2024-01-01"

# View memory statistics
ax cache stats
```

### Memory in Action

```bash
# First task - design is saved to memory
ax run product "Design a calculator with add/subtract features"

# Later task - automatically retrieves the design from memory
ax run backend "Implement the calculator API based on the product design"

# Agent automatically finds the product design in memory
# and uses it as context for implementation
```

---

## Multi-Agent Collaboration

Agents can work together through delegation and sessions.

### Automatic Delegation

Agents can delegate tasks to other specialized agents:

```bash
ax run product "Build a complete user authentication feature"

# Flow:
# 1. Product agent designs the system
# 2. Automatically delegates implementation to backend agent
# 3. Automatically delegates security audit to security agent
# 4. Results are combined and saved to memory
```

### Sessions

Create collaborative sessions with multiple agents:

```bash
# Create a session
ax session create auth-work backend security quality

# Add tasks to the session
ax session task auth-work "Implement and audit authentication"

# View session status
ax session show auth-work

# List all sessions
ax session list

# Close session
ax session close auth-work
```

---

## Provider Routing

AutomatosX supports multiple AI providers with intelligent routing.

### Supported Providers

- **Claude** (Anthropic) - Best for code implementation and reasoning
- **Gemini** (Google) - Best for creative work and UI/UX
- **OpenAI** (GPT) - Best for planning and architecture
- **Codex** (OpenAI) - Best for code generation and completion
- **Grok** (X.AI / Z.AI) - Best for debugging and fast analysis

### Provider Priority

Configured in `ax.config.json`:

```json
{
  "providers": {
    "claude-code": {
      "enabled": true,
      "priority": 1
    },
    "grok": {
      "enabled": true,
      "priority": 2
    },
    "codex": {
      "enabled": true,
      "priority": 3
    },
    "gemini-cli": {
      "enabled": true,
      "priority": 4
    }
  }
}
```

**Priority**: 1 = highest (tried first), 4 = lowest (last fallback)

### Free-Tier Optimization

AutomatosX automatically prioritizes free-tier providers when available. Specific free-tier details (like request limits) can vary and are best checked directly.

Check current free-tier status and usage:
```bash
ax free-tier status
ax free-tier history
```

### Manual Provider Selection

Override automatic routing:

```bash
# Use specific provider
ax run backend "task" --provider gemini-cli
ax run backend "task" --provider claude-code
ax run backend "task" --provider grok

# Provider diagnostics
ax doctor gemini-cli
ax doctor claude-code
```

---

## Spec-Driven Workflows

For complex projects, use YAML specs to define workflows.

### Creating Specs

```bash
# Create spec from natural language
ax spec create "Build authentication with database, API, JWT, and tests"

# Or manually create .specify/tasks.md
```

### Spec Structure

```yaml
# workflow.ax.yaml
name: Authentication System
version: 1.0.0

tasks:
  - id: design
    agent: product
    description: Design authentication system

  - id: implement
    agent: backend
    description: Implement authentication API
    depends_on: [design]

  - id: test
    agent: quality
    description: Write tests for authentication
    depends_on: [implement]

  - id: audit
    agent: security
    description: Security audit
    depends_on: [implement]
```

### Running Specs

```bash
# Generate execution plan
ax spec plan workflow.ax.yaml

# Generate DAG visualization
ax gen dag workflow.ax.yaml

# Execute workflow
ax spec run workflow.ax.yaml

# Parallel execution
ax spec run workflow.ax.yaml --parallel

# Check progress
ax spec status
```

### Spec Generators

```bash
# Generate plan from spec
ax gen plan workflow.ax.yaml

# Generate dependency DAG
ax gen dag workflow.ax.yaml
```

---

## Workspace Conventions

AutomatosX uses specific directories for organized file management.

### Directory Structure

- **`automatosx/PRD/`** - Product Requirements Documents, design specs, planning
  - Use for: Architecture designs, feature specs, technical requirements
  - Example: `automatosx/PRD/auth-system-design.md`
  - **In .gitignore**: Private planning documents

- **`automatosx/tmp/`** - Temporary files, scratch work, intermediate outputs
  - Use for: Draft code, test outputs, temporary analysis
  - Auto-cleaned periodically
  - Example: `automatosx/tmp/draft-api-endpoints.ts`
  - **In .gitignore**: Temporary working files

### Using Conventions

```bash
# Product agent saves design to PRD
ax run product "Design authentication system and save to automatosx/PRD/auth-design.md"

# Backend agent creates draft in tmp
ax run backend "Create draft implementation in automatosx/tmp/auth-draft.ts"

# After review, implement in actual location
ax run backend "Implement the spec from automatosx/PRD/auth-design.md in src/auth/"
```

---

## Configuration

### Main Configuration File

Edit `ax.config.json` to customize behavior:

```json
{
  "providers": {
    "claude-code": {
      "enabled": true,
      "priority": 1,
      "timeout": 120000
    },
    "gemini-cli": {
      "enabled": true,
      "priority": 2,
      "command": "gemini"
    }
  },
  "execution": {
    "defaultTimeout": 150000,
    "maxRetries": 3,
    "concurrency": {
      "maxConcurrentAgents": 4
    }
  },
  "memory": {
    "enabled": true,
    "maxEntries": 10000,
    "persistence": {
      "debounceMs": 1000
    }
  },
  "orchestration": {
    "delegation": {
      "enabled": true,
      "maxDepth": 2
    }
  },
  "router": {
    "healthCheck": {
      "intervalMs": 300000
    },
    "freeTier": {
      "prioritize": true
    }
  }
}
```

### View Configuration

```bash
# Show current configuration
ax config show

# Show specific section
ax config show providers

# Edit configuration (opens in $EDITOR)
ax config edit
```

### Custom Agents

Create custom agents:

```bash
# Interactive creation
ax agent create my-agent --template developer --interactive

# From file
# For details on the my-agent.yaml structure, refer to the agent configuration documentation.
ax agent create my-agent --from my-agent.yaml

# List custom agents
ax agent list --custom

# Show agent profile
ax agent show my-agent

# Remove agent
ax agent remove my-agent
```

---

## Common Workflows

### 1. Feature Implementation

```bash
# Design phase
ax run product "Design user authentication feature with JWT"

# Implementation phase
ax run backend "Implement the authentication API"

# Testing phase
ax run quality "Write comprehensive tests for authentication"

# Security phase
ax run security "Audit authentication for vulnerabilities"

# All context is automatically shared via memory!
```

### 2. Bug Fixing

```bash
# Find bugs
ax run quality "Review src/auth.ts for bugs"

# Fix bugs
ax run backend "Fix the bugs found in authentication"

# Verify fix
ax run quality "Test the authentication fixes"
```

### 3. Code Review

```bash
# Review code
ax run quality "Review the pull request changes"

# Security review
ax run security "Security review of PR changes"

# Architecture review
ax run architecture "Review architecture decisions in PR"
```

### 4. Documentation

```bash
# API documentation
ax run writer "Document the authentication API"

# Technical specs
ax run writer "Create ADR for authentication approach"

# User guides
ax run writer "Write user guide for authentication"
```

---

## Debugging & Troubleshooting

### Debug Mode

```bash
# Enable debug logging
ax --debug run backend "task"

# Set log level
export AUTOMATOSX_LOG_LEVEL=debug
ax run backend "task"

# Quiet mode (errors only)
ax --quiet run backend "task"
```

### Diagnostics

```bash
# Check system status
ax status

# Provider diagnostics
ax doctor
ax doctor claude-code
ax doctor gemini-cli

# View trace logs
ax providers trace
ax providers trace --follow  # Real-time
ax providers trace --provider gemini-cli

# Memory diagnostics
ax cache stats
```

### Common Issues

**"Agent not found"**
```bash
# List available agents (case-sensitive!)
ax list agents

# Correct: ax run backend "task"
# Wrong: ax run Backend "task"
```

**"Provider not available"**
```bash
# Check which providers are working
ax status
ax doctor

# Try specific provider
ax run backend "task" --provider gemini-cli
```

**"Out of memory"**
```bash
# Clear old memories
ax memory clear --before "2024-01-01"

# View memory usage
ax cache stats

# Export and backup before clearing
ax memory export > backup-$(date +%Y%m%d).json
```

**"Timeout"**
```bash
# Increase timeout for specific run
ax run backend "complex task" --timeout 300000

# Or edit ax.config.json:
# "execution": { "defaultTimeout": 300000 }
```

---

## Advanced Features

### Parallel Execution (v5.6.0+)

```bash
# Run multiple agents in parallel
ax run product "Design feature" --parallel

# Spec-driven parallel execution
ax spec run workflow.ax.yaml --parallel
```

### Resumable Runs (v5.3.0+)

```bash
# Start long-running task with checkpoints
ax run backend "Refactor entire codebase" --resumable

# If interrupted, resume
ax resume <run-id>

# List all runs
ax runs list

# Show run details
ax runs show <run-id>
```

### Streaming Output (v5.6.5+)

```bash
# Real-time streaming from AI providers
ax run backend "Explain this codebase" --streaming

# Works with Grok CLI (JSONL output)
ax run backend "task" --provider grok --streaming
```

### Cost Estimation

Cost estimation is **disabled by default** (pricing changes frequently).

To enable, edit `ax.config.json`:
```json
{
  "costEstimation": {
    "enabled": true,
    "disclaimer": "Cost estimates are approximate and may be outdated."
  }
}
```

When enabled:
```bash
# View estimated costs in plan
ax spec plan workflow.ax.yaml

# Check provider costs
ax providers info gemini-cli
```

---

## Best Practices

### 1. Use the Right Agent

Match tasks to agent specializations:
- **Code implementation** → backend, frontend, fullstack
- **Code quality** → quality agent
- **Security** → security agent
- **Design** → design agent (UI/UX)
- **Planning** → product, architecture agents

### 2. Leverage Memory

Reference past work explicitly:
```bash
ax run backend "Implement based on the auth design we discussed yesterday"
```

Agents automatically search memory, but explicit references help.

### 3. Start Simple

Test with small tasks before complex workflows:
```bash
# Good: Start simple
ax run backend "create a hello world API endpoint"

# Then: Build complexity
ax run backend "add authentication to the API"
```

### 4. Review Configurations

Check timeouts and retries match your needs:
```bash
ax config show execution
ax config show providers
```

### 5. Use Sessions for Complex Work

For multi-agent workflows:
```bash
ax session create feature-work backend frontend quality security
ax session task feature-work "Build complete feature"
```

### 6. Monitor Provider Health

Regularly check provider status:
```bash
ax status
ax doctor
```

### 7. Clean Up Memory Periodically

Prevent memory bloat:
```bash
# Monthly cleanup
ax memory clear --before "30 days ago"

# After major project milestones
ax memory export > milestone-backup.json
ax memory clear --before "2024-06-01"
```

### 8. Non-Interactive Mode Behavior

When running AutomatosX in non-interactive or background mode, agents proceed automatically without asking for permission or confirmation.

- Execute tasks directly without prompting.
- If a task cannot be completed, the agent will explain why and provide workarounds.
- Agents will NOT output messages like "need to know if you want me to proceed".

---

## Integration with AI Assistants

AutomatosX is designed to work seamlessly with AI assistants:

### Supported AI Assistants

- **Claude Code** - Primary integration with MCP support
- **Gemini CLI** - Natural language support
- **OpenAI Codex** - Development assistant integration
- **Grok CLI** - Fast debugging and analysis

### Natural Language Usage

Talk naturally to your AI assistant to use AutomatosX:

**Claude Code Examples**:
```
"Please use the ax backend agent to implement user authentication"
"Ask the ax security agent to audit this code"
"Have the ax quality agent write tests for this feature"
```

**Gemini CLI Examples**:
```bash
gemini "Use ax agent backend to create a REST API"
gemini "Ask ax agent quality to review this code"
```

**Codex Examples**:
```bash
codex exec "Use ax backend agent to implement feature"
```

**Grok CLI Examples**:
```bash
grok -p "Use ax quality agent to find bugs in this code"
```

### Direct CLI Access

For terminal usage:
```bash
ax run backend "implement feature"
ax memory search "authentication"
ax session create work backend quality
```

---

## Documentation & Support

### Documentation Locations

**External Documentation:**
- **GitHub Repository**: https://github.com/defai-digital/automatosx
- **NPM Package**: https://www.npmjs.com/package/@defai-digital/ax-cli

**Internal Configuration & Definitions:**
- **Agent Profiles**: `.automatosx/agents/` (definitions of specialized agents)
- **Project Configuration**: `ax.config.json` (main project settings)

### Getting Help

```bash
# Command help
ax --help
ax run --help
ax memory --help

# Agent information
ax agent show <agent-name>
ax list agents

# System diagnostics
ax status
ax doctor

# Search for similar past work
ax memory search "similar task"
```

### Support Channels

- **Issues**: https://github.com/defai-digital/automatosx/issues
- **Email**: support@defai.digital

---

## Version History

### v8.4.15 (Current)
- Streamlined for AI assistant integration
- Removed standalone chatbot (focus on Claude Code, Gemini CLI, Codex)
- Improved non-interactive mode behavior
- Added workspace conventions (automatosx/PRD/, automatosx/tmp/)

### v8.0.0+
- Grok CLI integration
- Enhanced provider routing
- Workspace directory conventions

### v7.0.0+
- Natural language integration
- Removed custom slash commands
- Multi-agent collaboration improvements

---

## AX CLI SDK Integration (Phase 1)

**New in v3.6.2**: AutomatosX can now share configuration, token tracking, and UI settings with ax-cli through the SDK.

### Benefits

✅ **Single Configuration** - One file (`~/.ax-cli/config.json`) for both systems
✅ **Unified Token Tracking** - See combined usage across AX + ax-cli
✅ **Consistent UX** - Same verbosity levels everywhere
✅ **Zero Duplication** - Reuse ax-cli's battle-tested code

### Quick Integration (30 minutes)

#### Step 1: Install ax-cli SDK

```bash
cd /Users/akiralam/code/AutomatosX
npm install @defai.digital/ax-cli@^3.6.2
```

#### Step 2: Share Settings

```typescript
// In AutomatosX agent initialization
import { getSettingsManager } from '@defai.digital/ax-cli/sdk';

const settings = getSettingsManager();

// Read from ~/.ax-cli/config.json
const apiKey = settings.getApiKey();
const model = settings.getCurrentModel();
const baseURL = settings.getBaseURL();

// Use in AX agents
this.agent = new LLMAgent(apiKey, baseURL, model);
```

#### Step 3: Share Token Tracking

```typescript
import { getUsageTracker } from '@defai.digital/ax-cli/sdk';

const tracker = getUsageTracker();

// Track AX agent usage
if (response.usage) {
  tracker.trackUsage(model, {
    prompt_tokens: response.usage.prompt_tokens,
    completion_tokens: response.usage.completion_tokens,
    total_tokens: response.usage.total_tokens,
  });
}

// Get combined stats (AX + ax-cli)
const stats = tracker.getStatistics();
console.log(`Total usage: ${stats.totalTokens} tokens ($${stats.estimatedCost})`);
```

#### Step 4: Share Verbosity Levels

```typescript
import { VerbosityLevel, UI_CONFIG } from '@defai.digital/ax-cli/sdk';

class AXAgent {
  private verbosity = UI_CONFIG.DEFAULT_VERBOSITY_LEVEL;

  logTool(tool: string, file: string) {
    switch (this.verbosity) {
      case VerbosityLevel.QUIET:
        // Group operations (85% less noise)
        this.groupAndLog(tool, file);
        break;
      case VerbosityLevel.CONCISE:
        // One line per tool
        console.log(`⏺ ${tool} (${file}) ✓`);
        break;
      case VerbosityLevel.VERBOSE:
        // Full details
        console.log(`⏺ ${tool} (${file}) - Full details`);
        break;
    }
  }
}
```

### Example: Base Agent Class

```typescript
// src/core/base-agent.ts
import {
  getSettingsManager,
  getUsageTracker,
  VerbosityLevel,
  UI_CONFIG,
} from '@defai.digital/ax-cli/sdk';

export abstract class BaseAXAgent {
  protected settings = getSettingsManager();
  protected usageTracker = getUsageTracker();
  protected verbosity: VerbosityLevel;

  constructor() {
    // Load from ax-cli settings
    this.loadConfiguration();
  }

  private loadConfiguration() {
    try {
      this.settings.loadUserSettings();
      this.apiKey = this.settings.getApiKey();
      this.model = this.settings.getCurrentModel();

      // Get verbosity preference
      const projectSettings = this.settings.loadProjectSettings();
      this.verbosity = this.parseVerbosity(
        projectSettings.ui?.verbosityLevel || 'quiet'
      );
    } catch (error) {
      // Fallback to AX's own config
      console.warn('Using AX fallback config');
    }
  }

  protected trackUsage(usage: any) {
    this.usageTracker.trackUsage(this.model, usage);
  }
}
```

### Usage Command Example

```bash
# Add to AX CLI commands
ax usage

# Output:
# 📊 Combined Usage Statistics (AX + ax-cli)
#
# Total Requests: 145
# Total Tokens: 425,000
# Estimated Cost: $8.50
#
# By Model:
#   glm-4.6: 380,000 tokens ($7.60)
#   grok-code-fast-1: 45,000 tokens ($0.90)
```

### Implementation Checklist

- [ ] Install `@defai.digital/ax-cli@^3.6.2`
- [ ] Update base agent class with SDK imports
- [ ] Replace config loading with `getSettingsManager()`
- [ ] Add token tracking with `getUsageTracker()`
- [ ] Add verbosity support with `VerbosityLevel`
- [ ] Add `ax usage` command
- [ ] Test unified configuration
- [ ] Update AX documentation

### Migration Path

**Phase 1 (Current)**: Read-only integration
- AX reads from ax-cli settings
- No breaking changes to existing AX workflows
- Gradual migration, test in parallel

**Phase 2 (Future)**: Full bi-directional
- AX can update ax-cli settings
- Shared MCP connections
- Shared context cache (50% token savings)

### Testing Integration

```bash
# 1. Configure ax-cli
ax-cli setup

# 2. Verify AX reads settings
ax run backend "test task"
# Should use ax-cli's API key automatically

# 3. Check combined usage
ax usage
# Should show both AX and ax-cli token usage

# 4. Test verbosity
# Edit ~/.ax-cli/config.json:
# "ui": { "verbosityLevel": "quiet" }
ax run backend "test task"
# Should use grouped output
```

### Troubleshooting

**Settings not found:**
```typescript
// Create default settings first
const settings = getSettingsManager();
settings.updateUserSetting('apiKey', process.env.YOUR_API_KEY);
settings.saveUserSettings();
```

**Token tracking not working:**
```typescript
// Ensure usage object is passed
if (response.usage) {
  tracker.trackUsage(model, response.usage);
}
```

### Support

For integration help:
- ax-cli SDK Docs: `docs/SDK_IMPLEMENTATION_SUMMARY.md`
- Issues: https://github.com/defai-digital/ax-cli/issues
- AX Issues: https://github.com/defai-digital/automatosx/issues

---

## Phase 2: Shared Resources & Progress Reporting

**Status**: ✅ Implemented (v3.6.2)
**Effort**: Medium (2-4 hours)
**Risk**: Low-Medium

Phase 2 enables resource sharing and real-time progress visibility between AutomatosX and ax-cli.

### Features Implemented

1. **Shared MCP Connections** - Reuse ax-cli's MCP server connections
2. **Shared Context Cache** - Access ax-cli's project memory system
3. **Progress Reporting** - Real-time progress events from AX to ax-cli

### 1. Shared MCP Connections

AutomatosX can reuse ax-cli's MCP server connections to avoid duplicate processes.

```typescript
import { getMCPManager, getMcpConnectionCount, type MCPManager, type MCPTool } from '@defai.digital/ax-cli/sdk';

// Get the shared MCP manager
const mcpManager: MCPManager = getMCPManager();

// Check connection status
const connectionCount = getMcpConnectionCount();
console.log(`Connected to ${connectionCount} MCP servers`);

// Get available tools from MCP servers
const mcpTools: MCPTool[] = mcpManager.getTools();
console.log(`Available MCP tools: ${mcpTools.length}`);

// Get list of connected servers
const servers: string[] = mcpManager.getServers();

// Call an MCP tool
const result = await mcpManager.callTool('mcp__server__tool_name', {
  param1: 'value1'
});

// Listen to MCP events
mcpManager.on('serverAdded', (name, toolCount) => {
  console.log(`MCP server ${name} connected with ${toolCount} tools`);
});

mcpManager.on('serverError', (name, error) => {
  console.error(`MCP server ${name} error:`, error);
});
```

**Benefits:**
- No duplicate stdio processes
- Single source of truth for MCP configuration
- Shared tool availability across both systems

### 2. Shared Context Cache

Access ax-cli's project memory system for 50% token savings through caching.

```typescript
import {
  getContextStore,
  type ContextStore,
  type ProjectMemory,
  type StoreResult
} from '@defai.digital/ax-cli/sdk';

// Get the context store (singleton for current project)
const store: ContextStore = getContextStore();

// Check if project memory exists
if (store.exists()) {
  // Load project memory
  const result: StoreResult<ProjectMemory> = store.load();

  if (result.success) {
    const memory = result.data;
    console.log(`Loaded context: ${memory.context.token_estimate} tokens`);
    console.log(`Cache stats: ${memory.stats.usage_count} uses, ${memory.stats.total_tokens_saved} tokens saved`);

    // Use the cached context in your prompts
    const contextContent = memory.context.content;
    // contextContent is already formatted for system messages
  }
}

// Record usage after API call
store.recordUsage(promptTokens, cachedTokens);

// Get quick metadata without loading full context
const metadata = store.getMetadata();
if (metadata.exists) {
  console.log(`Context: ${metadata.tokenEstimate} tokens, updated ${metadata.updatedAt}`);
}

// Use custom project root (creates new instance)
const customStore = getContextStore('/path/to/project');
```

**Benefits:**
- 50% token savings via z.ai implicit caching
- Shared project knowledge between AX and ax-cli
- Automatic usage statistics

### 3. Progress Reporting

Real-time progress events from AutomatosX agents to ax-cli UI.

```typescript
import {
  getProgressReporter,
  ProgressEventType,
  type ProgressEvent,
  type ProgressReporter
} from '@defai.digital/ax-cli/sdk';

// Get the global progress reporter
const reporter: ProgressReporter = getProgressReporter();

// Report progress from AX agents
class MyAXAgent {
  private agentId = 'ax-orchestrator-1';

  async executeTask(taskName: string) {
    // Report task start
    reporter.taskStart(this.agentId, taskName, 'Starting task...');

    try {
      // Report progress
      reporter.taskProgress(this.agentId, taskName, 25, 'Analyzing codebase...');
      await this.analyzeCode();

      reporter.taskProgress(this.agentId, taskName, 50, 'Generating plan...');
      await this.generatePlan();

      reporter.taskProgress(this.agentId, taskName, 75, 'Executing changes...');
      await this.executeChanges();

      // Report completion
      reporter.taskComplete(this.agentId, taskName, 'Task completed successfully');
    } catch (error) {
      // Report error
      reporter.taskError(this.agentId, taskName, error.message);
      throw error;
    }
  }

  async executeTool(toolName: string, args: any) {
    reporter.toolStart(this.agentId, toolName, `Calling ${toolName}...`);
    const result = await this.callTool(toolName, args);
    reporter.toolComplete(this.agentId, toolName, 'Tool completed');
    return result;
  }

  reportStatus(message: string) {
    reporter.statusUpdate(this.agentId, message, {
      timestamp: Date.now(),
      phase: 'execution'
    });
  }
}

// Subscribe to progress events (in ax-cli UI)
const unsubscribe = reporter.onProgress((event: ProgressEvent) => {
  console.log(`[${event.agentId}] ${event.type}: ${event.name} - ${event.message}`);
  if (event.progress !== undefined) {
    console.log(`Progress: ${event.progress}%`);
  }
});

// Subscribe to specific event types
const unsubscribeTaskComplete = reporter.onEvent(
  ProgressEventType.TASK_COMPLETE,
  (event) => {
    console.log(`✓ Task completed: ${event.name}`);
  }
);

// Clean up subscriptions
unsubscribe();
unsubscribeTaskComplete();

// Get statistics
const stats = reporter.getStats();
console.log(`Active listeners: ${stats.listenerCount}`);
```

**Benefits:**
- Unified progress visibility across AX and ax-cli
- Real-time updates in ax-cli UI
- Detailed task and tool execution tracking

### Complete Integration Example

Here's a complete example showing all Phase 2 features:

```typescript
import {
  // Phase 1
  getSettingsManager,
  getUsageTracker,
  VerbosityLevel,

  // Phase 2
  getMCPManager,
  getContextStore,
  getProgressReporter,
  ProgressEventType,
} from '@defai.digital/ax-cli/sdk';

class IntegratedAXAgent {
  private agentId = 'ax-integrated-agent';
  private settings = getSettingsManager();
  private usage = getUsageTracker();
  private mcp = getMCPManager();
  private store = getContextStore();
  private reporter = getProgressReporter();

  async initialize() {
    // Load shared settings
    this.settings.loadUserSettings();
    const model = this.settings.getCurrentModel();

    // Load project memory if available
    if (this.store.exists()) {
      const result = this.store.load();
      if (result.success) {
        console.log(`Loaded context: ${result.data.context.token_estimate} tokens`);
      }
    }

    // Check MCP connections
    const mcpTools = this.mcp.getTools();
    console.log(`Available MCP tools: ${mcpTools.length}`);
  }

  async processTask(task: string) {
    this.reporter.taskStart(this.agentId, 'process-task', task);

    try {
      // Use MCP tool if available
      const mcpTools = this.mcp.getTools();
      if (mcpTools.length > 0) {
        this.reporter.toolStart(this.agentId, mcpTools[0].name);
        const result = await this.mcp.callTool(mcpTools[0].name, {});
        this.reporter.toolComplete(this.agentId, mcpTools[0].name);
      }

      // Report progress
      this.reporter.taskProgress(this.agentId, 'process-task', 50, 'Halfway done');

      // Track usage
      this.usage.recordTokens('input', 1000, this.settings.getCurrentModel());

      // Record context usage
      this.store.recordUsage(1000, 500); // 500 tokens cached

      this.reporter.taskComplete(this.agentId, 'process-task', 'Success');
    } catch (error) {
      this.reporter.taskError(this.agentId, 'process-task', error.message);
      throw error;
    }
  }
}
```

### Testing Phase 2 Integration

1. **Test MCP Connection Sharing:**
```bash
# In ax-cli project
npm run build

# In AutomatosX project
node -e "
const sdk = require('@defai.digital/ax-cli/sdk');
const mcpManager = sdk.getMCPManager();
const count = sdk.getMcpConnectionCount();
console.log('MCP servers:', count);
const tools = mcpManager.getTools();
console.log('MCP tools:', tools.map(t => t.name));
"
```

2. **Test Context Cache Sharing:**
```bash
# Create project memory in ax-cli
cd /path/to/project
ax memory warmup

# Access from AutomatosX
node -e "
const sdk = require('@defai.digital/ax-cli/sdk');
const store = sdk.getContextStore('/path/to/project');
const result = store.load();
if (result.success) {
  console.log('Context tokens:', result.data.context.token_estimate);
  console.log('Usage count:', result.data.stats.usage_count);
}
"
```

3. **Test Progress Reporting:**
```typescript
// In AutomatosX
import { getProgressReporter } from '@defai.digital/ax-cli/sdk';

const reporter = getProgressReporter();

// Simulate agent progress
reporter.taskStart('test-agent', 'test-task', 'Starting...');
setTimeout(() => reporter.taskProgress('test-agent', 'test-task', 50, 'Halfway'), 1000);
setTimeout(() => reporter.taskComplete('test-agent', 'test-task', 'Done'), 2000);

// Subscribe to events
reporter.onProgress((event) => {
  console.log('[Event]', event.type, event.message, event.progress);
});
```

### Troubleshooting Phase 2

**Issue: "MCP manager not initialized"**
- Ensure ax-cli has MCP servers configured in `.ax-cli/settings.json`
- Call `initializeMCPServers()` if needed

**Issue: "Context store not found"**
- Run `ax memory warmup` in the project directory first
- Verify `.ax-cli/memory.json` exists

**Issue: "Progress events not received"**
- Check that both AX and ax-cli are using the same SDK instance
- Verify event subscriptions are set up before emitting events
- Check `getStats()` to confirm listeners are registered

### Migration Notes

**From Phase 1 to Phase 2:**
- No breaking changes
- All Phase 1 features remain unchanged
- New Phase 2 exports are additive

**Backward Compatibility:**
- Phase 2 features are optional
- Applications can use Phase 1 features without Phase 2
- All singleton instances are lazy-initialized

---

## Phase 3: Advanced Integration Features

**Status**: ✅ Implemented (v3.6.2)
**Effort**: Medium-High (4-6 hours)
**Risk**: Low-Medium

Phase 3 adds advanced integration capabilities for complete bi-directional cooperation.

### Features Implemented

1. **Bi-directional Settings** - AX can read AND write ax-cli settings
2. **Unified Logging** - Centralized log aggregation across systems
3. **Shared Tool Registry** - Custom tools available across both systems
4. **Checkpoint Sharing** - Full access to checkpoint system

### 1. Bi-directional Settings (Already Available!)

The `SettingsManager` already supports both read and write operations.

```typescript
import { getSettingsManager, type SettingsManager } from '@defai.digital/ax-cli/sdk';

const settings: SettingsManager = getSettingsManager();

// PHASE 1: Read operations
settings.loadUserSettings();
const apiKey = settings.getApiKey();
const model = settings.getCurrentModel();

// PHASE 3: Write operations
settings.updateUserSetting('defaultModel', 'glm-4.6');
settings.updateUserSetting('baseURL', 'https://api.custom.ai/v1');
settings.saveUserSettings({ maxTokens: 8192 });

// Project settings (write)
settings.updateProjectSetting('defaultModel', 'glm-4.6');
settings.saveProjectSettings({ contextWindow: 32000 });
```

**Benefits:**
- AX can configure ax-cli programmatically
- Dynamic model/provider switching
- Project-specific overrides

### 2. Unified Logging

Centralized logging system for cross-system debugging.

```typescript
import {
  getUnifiedLogger,
  LogLevel,
  parseLogLevel,
  type LogEntry,
  type UnifiedLogger
} from '@defai.digital/ax-cli/sdk';

const logger: UnifiedLogger = getUnifiedLogger();

// Configure logging
logger.setMinLevel(LogLevel.INFO); // Only log INFO and above
logger.setMaxLogSize(5000); // Keep last 5000 entries

// Log from AX agents
logger.debug('ax-agent-1', 'Analyzing codebase structure');
logger.info('ax-orchestrator', 'Task started', { taskId: '123', phase: 'planning' });
logger.warn('ax-agent-2', 'API rate limit approaching', { remaining: 10 });
logger.error('ax-agent-3', 'Failed to execute tool', new Error('Connection timeout'));

// Subscribe to logs in real-time
const unsubscribe = logger.onLog((entry: LogEntry) => {
  console.log(`[${entry.source}] ${entry.message}`);
});

// Subscribe to specific level
const unsubscribeErrors = logger.onLevel(LogLevel.ERROR, (entry) => {
  console.error(`ERROR from ${entry.source}:`, entry.message);
  if (entry.error) {
    console.error(entry.error.stack);
  }
});

// Query logs
const recentErrors = logger.getLogs({
  minLevel: LogLevel.ERROR,
  since: Date.now() - 3600000, // Last hour
  source: /^ax-/, // Only AX sources
});

console.log(`Found ${recentErrors.length} errors in last hour`);

// Get statistics
const stats = logger.getStats();
console.log('Total logs:', stats.total);
console.log('By level:', stats.byLevel);
console.log('By source:', stats.bySources);

// Export logs
const jsonExport = logger.exportJSON({ minLevel: LogLevel.WARN });
const textExport = logger.exportText({ since: Date.now() - 3600000 });

// Cleanup
unsubscribe();
unsubscribeErrors();
```

**Benefits:**
- Single source of truth for all logs
- Real-time log monitoring
- Easy debugging across AX and ax-cli
- Export logs for analysis

### 3. Shared Tool Registry

Register custom tools that work across both systems.

```typescript
import {
  getToolRegistry,
  registerTools,
  createToolExecutor,
  type ToolRegistry,
  type ToolExecutor,
  type LLMTool
} from '@defai.digital/ax-cli/sdk';

const registry: ToolRegistry = getToolRegistry();

// Register a custom AX tool
const customToolDef: LLMTool = {
  type: 'function',
  function: {
    name: 'ax_analyze_dependencies',
    description: 'Analyze project dependencies for vulnerabilities',
    parameters: {
      type: 'object',
      properties: {
        projectPath: { type: 'string', description: 'Path to project' },
        deep: { type: 'boolean', description: 'Deep analysis mode' }
      },
      required: ['projectPath']
    }
  }
};

const customToolExecutor: ToolExecutor = async (args, context) => {
  try {
    // Your tool logic here
    const result = await analyzeDependencies(args.projectPath as string, args.deep as boolean);

    return {
      success: true,
      output: `Found ${result.vulnerabilities} vulnerabilities`,
      data: result
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
};

// Register the tool
registry.registerTool('automatosx', customToolDef, customToolExecutor, {
  tags: ['security', 'analysis'],
  allowOverwrite: false
});

// Or use helper for multiple tools
registerTools('automatosx', [
  {
    definition: customToolDef,
    executor: customToolExecutor,
    options: { tags: ['security'] }
  },
  // ... more tools
]);

// Get all available tools
const allTools = registry.getAllToolDefinitions();
console.log(`Total tools available: ${allTools.length}`);

// Get tools by source
const axTools = registry.getToolDefinitionsBySource('automatosx');
const cliTools = registry.getToolDefinitionsBySource('ax-cli');

// Get tools by tag
const securityTools = registry.getToolDefinitionsByTag('security');

// Execute a registered tool
const result = await registry.executeTool(
  'ax_analyze_dependencies',
  { projectPath: '/path/to/project', deep: true },
  { source: 'ax-cli', agentId: 'main-agent' }
);

if (result.success) {
  console.log(result.output);
  console.log(result.data);
}

// Get registry statistics
const stats = registry.getStats();
console.log('Total tools:', stats.total);
console.log('By source:', stats.bySource);
console.log('By tag:', stats.byTag);

// Export tool definitions
const exported = registry.exportDefinitions();
console.log(JSON.stringify(exported, null, 2));
```

**Benefits:**
- Custom AX tools available in ax-cli
- Standard ax-cli tools available to AX
- Type-safe tool execution
- Centralized tool discovery

### 4. Checkpoint Sharing

Full access to checkpoint system (already exported in Phase 2).

```typescript
import {
  getCheckpointManager,
  type CheckpointManager,
  type Checkpoint
} from '@defai.digital/ax-cli/sdk';

const checkpoints: CheckpointManager = getCheckpointManager();

// Create checkpoint from AX
await checkpoints.create('before-refactor', {
  description: 'Before major refactoring by AX agent',
  tags: ['refactor', 'ax-created'],
  includePatterns: ['src/**/*.ts'],
});

// List checkpoints
const allCheckpoints = await checkpoints.list();
const recentCheckpoints = await checkpoints.list({
  limit: 10,
  tags: ['ax-created']
});

// Restore a checkpoint
const restored = await checkpoints.restore('before-refactor');
if (restored.success) {
  console.log(`Restored ${restored.filesRestored} files`);
}

// Get checkpoint info
const info = await checkpoints.getInfo('before-refactor');
console.log(`Checkpoint: ${info.id}, created ${info.createdAt}`);
console.log(`Files: ${info.fileCount}, size: ${info.totalSize} bytes`);

// Delete old checkpoints
await checkpoints.delete('old-checkpoint-id');
```

**Benefits:**
- AX can create safety checkpoints
- Shared restore points across systems
- Consistent backup strategy

### Complete Phase 3 Integration Example

```typescript
import {
  // Phase 1
  getSettingsManager,
  getUsageTracker,

  // Phase 2
  getMCPManager,
  getContextStore,
  getProgressReporter,

  // Phase 3
  getUnifiedLogger,
  getToolRegistry,
  getCheckpointManager,
  LogLevel,
  createToolExecutor,
} from '@defai.digital/ax-cli/sdk';

class AdvancedAXAgent {
  private agentId = 'ax-advanced-agent';
  private settings = getSettingsManager();
  private logger = getUnifiedLogger();
  private registry = getToolRegistry();
  private checkpoints = getCheckpointManager();
  private reporter = getProgressReporter();

  async initialize() {
    // Set up logging
    this.logger.setMinLevel(LogLevel.INFO);
    this.logger.info(this.agentId, 'Agent initializing...');

    // Load settings (read)
    this.settings.loadUserSettings();
    const model = this.settings.getCurrentModel();
    this.logger.debug(this.agentId, `Using model: ${model}`);

    // Register custom tools
    this.registerCustomTools();
    this.logger.info(this.agentId, 'Custom tools registered');
  }

  private registerCustomTools() {
    const tool = {
      type: 'function' as const,
      function: {
        name: 'ax_custom_analysis',
        description: 'Custom analysis tool from AX',
        parameters: {
          type: 'object',
          properties: {
            target: { type: 'string' }
          },
          required: ['target']
        }
      }
    };

    this.registry.registerTool(
      'automatosx',
      tool,
      createToolExecutor(async (args) => {
        this.logger.debug(this.agentId, `Executing custom analysis on ${args.target}`);
        // Tool logic...
        return { success: true, output: 'Analysis complete' };
      }),
      { tags: ['analysis', 'custom'] }
    );
  }

  async executeComplexTask(task: string) {
    this.logger.info(this.agentId, `Starting task: ${task}`);
    this.reporter.taskStart(this.agentId, 'complex-task', task);

    try {
      // Create safety checkpoint
      await this.checkpoints.create(`before-${task}`, {
        description: `Safety checkpoint before ${task}`,
        tags: ['auto-created', 'ax']
      });
      this.logger.debug(this.agentId, 'Checkpoint created');

      // Update settings if needed
      this.settings.updateUserSetting('maxTokens', 16000);
      this.logger.info(this.agentId, 'Settings updated');

      // Execute with all tools available
      const allTools = this.registry.getAllToolDefinitions();
      this.logger.debug(this.agentId, `${allTools.length} tools available`);

      // ... task logic ...

      this.reporter.taskComplete(this.agentId, 'complex-task', 'Success');
      this.logger.info(this.agentId, 'Task completed successfully');
    } catch (error) {
      this.logger.error(this.agentId, 'Task failed', error as Error);
      this.reporter.taskError(this.agentId, 'complex-task', (error as Error).message);
      throw error;
    }
  }
}
```

### Testing Phase 3

```bash
# Build project
npm run build

# Test unified logging
node -e "
const sdk = require('./dist/sdk/index.js');
const logger = sdk.getUnifiedLogger();

logger.onLog((entry) => console.log('LOG:', entry.message));
logger.info('test', 'Hello from unified logger');
logger.error('test', 'Test error', new Error('Test'));

const stats = logger.getStats();
console.log('Stats:', stats);
"

# Test tool registry
node -e "
const sdk = require('./dist/sdk/index.js');
const registry = sdk.getToolRegistry();

const tool = {
  type: 'function',
  function: {
    name: 'test_tool',
    description: 'Test tool',
    parameters: { type: 'object', properties: {} }
  }
};

const executor = async (args) => ({ success: true, output: 'Works!' });

registry.registerTool('automatosx', tool, executor);
console.log('Tools:', registry.getToolNames());
console.log('Stats:', registry.getStats());
"

# Test bi-directional settings
node -e "
const sdk = require('./dist/sdk/index.js');
const settings = sdk.getSettingsManager();

settings.loadUserSettings();
console.log('Current model:', settings.getCurrentModel());

settings.updateUserSetting('maxTokens', 32000);
console.log('Updated maxTokens to 32000');
"
```

### Troubleshooting Phase 3

**Issue: "Tool already registered"**
```typescript
// Use allowOverwrite option
registry.registerTool('automatosx', tool, executor, {
  allowOverwrite: true
});
```

**Issue: "Logs filling up memory"**
```typescript
// Set lower max log size
logger.setMaxLogSize(500); // Keep only 500 entries

// Or increase minimum level
logger.setMinLevel(LogLevel.WARN); // Only WARN and ERROR
```

**Issue: "Settings not persisting"**
```typescript
// Ensure you call save
settings.updateUserSetting('key', 'value');
// Changes are auto-saved, but you can force:
settings.saveUserSettings();
```

---

**This is the complete AutomatosX Integration Guide. For AI-specific tips and setup instructions, see the respective integration files (CLAUDE.md, GEMINI.md, CODEX.md, GROK.md).**
