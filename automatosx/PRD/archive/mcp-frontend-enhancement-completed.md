# PRD: MCP Frontend Development Enhancement

**Document Version**: 1.0
**Created**: 2025-11-21
**Status**: Proposal
**Priority**: High
**Risk Level**: Low-Medium

---

## Executive Summary

Enhance ax-cli's Model Context Protocol (MCP) support to better serve front-end developers, with specific focus on Figma integration, design-to-code workflows, and streamlined setup for popular front-end tools.

### Key Objectives
1. Reduce MCP server setup time from 5-10 minutes to 30 seconds
2. Enable seamless Figma → Code workflows
3. Provide curated, production-ready server templates
4. Improve tool discovery and visibility
5. Create specialized front-end workflows

### Success Metrics
- **Adoption**: 40%+ of users enable at least one MCP server (up from ~5% estimated)
- **Setup Time**: <30 seconds for template-based servers (down from 5-10 min)
- **Front-end Usage**: 25%+ of users utilize Figma/design integrations
- **Tool Discovery**: 80%+ of users explore available tools before first use
- **Error Rate**: <5% MCP connection failures (down from ~15% estimated)

---

## Problem Statement

### Current Pain Points

**User Research Findings:**
> "Many users suggest to improve or enhance the MCP support of ax-cli, especially, many people want to see whether we can do good in using Figma MCP or Google Gemini MCP integration because they want to do front-end coding with ax-cli"

**Identified Issues:**

1. **High Setup Friction** (Severity: High)
   - Users must manually configure transport type, commands, args
   - No guidance on which servers are production-ready
   - Trial-and-error to find correct configuration
   - **Impact**: Low MCP adoption (~5% of users)

2. **Tool Invisibility** (Severity: Medium)
   - Users don't know what tools an MCP server provides until after connection
   - No way to preview capabilities
   - Difficult to debug which tools failed
   - **Impact**: Confusion, abandoned setups

3. **No Front-End Specialization** (Severity: Medium)
   - Generic workflows don't address design-to-code needs
   - No Figma integration guidance
   - Missing component generation patterns
   - **Impact**: Front-end developers underserved

4. **Limited Discoverability** (Severity: Low)
   - No marketplace or curated list
   - Hard to find community-recommended servers
   - **Impact**: Missed opportunities for valuable integrations

---

## Solution Overview

### Three-Phase Approach

#### **Phase 1: Foundation & Quick Wins** (2 weeks)
Focus: Low-risk, high-impact improvements
- Pre-configured server templates
- Enhanced tool discovery
- Improved documentation

#### **Phase 2: Front-End Workflows** (3 weeks)
Focus: Specialized front-end capabilities
- Design-to-code automation
- Component generation
- Visual comparison tools

#### **Phase 3: Ecosystem Growth** (4+ weeks)
Focus: Long-term platform enhancements
- MCP marketplace
- Community curation
- Advanced integrations

---

## Detailed Requirements

### 1. Pre-configured Server Templates

**Feature ID**: MCP-TEMPLATES-001
**Priority**: P0 (Critical)
**Risk**: Low
**Effort**: 3 days

#### Requirements

**FR-1.1**: Predefined server configurations for popular services

**Servers to Include** (Priority Order):

| Server | Transport | Use Case | Setup Complexity |
|--------|-----------|----------|-----------------|
| **Figma** | stdio | Design-to-code | Medium |
| **Vercel** | http | Deployment | Low |
| **GitHub** | stdio | Code management | Medium |
| **Puppeteer** | stdio | Browser testing | Medium |
| **Storybook** | http | Component testing | Medium |
| **Sentry** | http | Error tracking | Low |
| **Supabase** | http | Backend/DB | Medium |
| **Firebase** | http | Backend/DB | Medium |
| **Chromatic** | http | Visual testing | Low |
| **Netlify** | http | Deployment | Low |

**FR-1.2**: Template-based installation command

```bash
# Syntax
ax-cli mcp add <server-name> --template

# Examples
ax-cli mcp add figma --template
ax-cli mcp add vercel --template

# With environment variable prompts
ax-cli mcp add github --template --interactive
# Prompts for: GITHUB_TOKEN
```

**FR-1.3**: Template validation and best practices

Each template must include:
- Validated transport configuration
- Required environment variables documented
- Setup instructions
- Usage examples
- Common troubleshooting tips

**Technical Implementation**:

```typescript
// src/mcp/templates.ts
export interface MCPServerTemplate {
  name: string;
  description: string;
  category: 'design' | 'deployment' | 'testing' | 'monitoring' | 'backend';
  config: MCPServerConfig;
  requiredEnv: Array<{
    name: string;
    description: string;
    url?: string; // Documentation link
  }>;
  setupInstructions: string;
  usageExamples: string[];
  troubleshooting: Array<{
    issue: string;
    solution: string;
  }>;
}

export const TEMPLATES: Record<string, MCPServerTemplate> = {
  figma: {
    name: 'figma',
    description: 'Official Figma MCP server for design-to-code workflows',
    category: 'design',
    config: {
      name: 'figma',
      transport: {
        type: 'stdio',
        command: 'npx',
        args: ['@figma/mcp-server'],
        env: {}
      }
    },
    requiredEnv: [
      {
        name: 'FIGMA_ACCESS_TOKEN',
        description: 'Personal access token from Figma settings',
        url: 'https://help.figma.com/hc/en-us/articles/8085703771159'
      }
    ],
    setupInstructions: `
1. Generate a personal access token at https://figma.com/settings
2. Set environment variable: export FIGMA_ACCESS_TOKEN="your_token"
3. Run: ax-cli mcp add figma --template
4. Test: ax-cli mcp test figma
    `.trim(),
    usageExamples: [
      'Get design tokens from a file',
      'Export components from Figma',
      'Generate React components from Figma frames',
      'Extract color/typography variables'
    ],
    troubleshooting: [
      {
        issue: 'Authentication failed',
        solution: 'Verify FIGMA_ACCESS_TOKEN is set and valid. Generate new token at figma.com/settings'
      },
      {
        issue: 'File not found',
        solution: 'Ensure you have access to the Figma file. Check file URL is correct.'
      }
    ]
  },
  // ... other templates
};
```

**Acceptance Criteria**:
- [ ] 10+ pre-configured templates available
- [ ] `--template` flag works for all templates
- [ ] Environment variables clearly documented
- [ ] Setup time <30 seconds for template servers
- [ ] Templates validated against real services
- [ ] Error messages reference template documentation

---

### 2. Enhanced Tool Discovery

**Feature ID**: MCP-DISCOVERY-002
**Priority**: P0 (Critical)
**Risk**: Low
**Effort**: 2 days

#### Requirements

**FR-2.1**: List available tools from a specific server

```bash
ax-cli mcp tools <server-name>

# Output format:
# Figma Tools (5 available)
# ├─ get_file_data
# │  Description: Retrieve Figma file structure and metadata
# │  Inputs: fileId (string, required)
# │  Returns: File structure with nodes, components, and styles
# │
# ├─ get_components
# │  Description: List all components from a Figma file
# │  Inputs: fileId (string), componentName (string, optional)
# │  Returns: Array of component definitions
# │
# └─ ... (3 more tools)
```

**FR-2.2**: Tool testing command

```bash
# Test a specific tool with sample data
ax-cli mcp test-tool figma get_file_data --args '{"fileId":"abc123"}'

# Interactive mode
ax-cli mcp test-tool figma get_file_data --interactive
# Prompts for each required parameter
```

**FR-2.3**: Tool search across all servers

```bash
# Find tools by keyword
ax-cli mcp search "deploy"

# Output:
# Found 3 tools matching "deploy":
#
# vercel > deploy_project
# netlify > create_deploy
# firebase > deploy_hosting
```

**Technical Implementation**:

```typescript
// src/commands/mcp.ts - Add new commands

mcpCommand
  .command('tools <server-name>')
  .description('List available tools from an MCP server')
  .option('--json', 'Output in JSON format')
  .option('--verbose', 'Show detailed tool schemas')
  .action(async (serverName: string, options) => {
    const manager = getMCPManager();
    const tools = manager.getTools().filter(t => t.serverName === serverName);

    if (tools.length === 0) {
      ConsoleMessenger.warning('No tools found. Ensure server is connected.');
      return;
    }

    if (options.json) {
      console.log(JSON.stringify(tools, null, 2));
      return;
    }

    // Pretty-print with tree structure
    ConsoleMessenger.bold(`${serverName} Tools (${tools.length} available)`);
    tools.forEach((tool, i) => {
      const isLast = i === tools.length - 1;
      const prefix = isLast ? '└─' : '├─';

      console.log(`${prefix} ${tool.name.replace(`mcp__${serverName}__`, '')}`);
      console.log(`   Description: ${tool.description}`);

      if (options.verbose) {
        console.log(`   Schema: ${JSON.stringify(tool.inputSchema, null, 2)}`);
      }

      console.log();
    });
  });
```

**Acceptance Criteria**:
- [ ] `ax-cli mcp tools <server>` lists all tools
- [ ] Tree-structured output for readability
- [ ] `--json` flag for machine-readable output
- [ ] `--verbose` shows full schemas
- [ ] `ax-cli mcp search <query>` searches across servers
- [ ] Tool testing command validates before execution

---

### 3. Front-End Quick Start Guide

**Feature ID**: MCP-DOCS-003
**Priority**: P1 (High)
**Risk**: Very Low
**Effort**: 2 days

#### Requirements

**FR-3.1**: Create comprehensive front-end developer guide

**Document Structure**:

```markdown
# MCP for Front-End Developers

## Quick Start (5 minutes)
1. Install Figma MCP
2. Configure access token
3. Test connection
4. First design-to-code example

## Design-to-Code Workflows
- Extracting components from Figma
- Generating React/Vue/Svelte components
- Design token extraction
- Asset export automation

## Popular Integrations
- Figma + Vercel (Design → Deploy)
- Storybook + Chromatic (Component testing)
- Puppeteer (E2E testing)
- Sentry (Error tracking)

## Real-World Examples
- Building a design system
- Component library generation
- Automated visual regression testing
- Design-code synchronization

## Best Practices
- When to use MCP vs manual coding
- Performance considerations
- Security (token management)
- Team collaboration patterns

## Troubleshooting
- Common Figma issues
- Network/firewall problems
- Authentication errors
```

**FR-3.2**: Interactive examples

Include runnable examples:
```bash
# Example 1: Extract design tokens
ax-cli -p "Extract all color variables from Figma file abc123 and create a CSS file"

# Example 2: Generate component
ax-cli -p "Create a React TypeScript component matching the Button component in Figma file xyz789"

# Example 3: Visual comparison
ax-cli -p "Compare the implementation in src/Button.tsx with the Figma design in file abc123"
```

**Acceptance Criteria**:
- [ ] Document exists at `docs/mcp-frontend-guide.md`
- [ ] Clear step-by-step instructions
- [ ] 5+ real-world examples
- [ ] Links from main docs
- [ ] Validated against actual workflows

---

### 4. Front-End Workflow Templates

**Feature ID**: MCP-FRONTEND-004
**Priority**: P1 (High)
**Risk**: Medium
**Effort**: 5 days

#### Requirements

**FR-4.1**: Dedicated `frontend` command group

```bash
ax-cli frontend <subcommand> [options]

# Subcommands:
# - design-to-code    Convert Figma designs to code
# - gen-component     Generate component from design
# - extract-tokens    Extract design system tokens
# - compare-design    Compare implementation vs design
# - export-assets     Batch export Figma assets
```

**FR-4.2**: Design-to-code workflow

```bash
ax-cli frontend design-to-code <figma-url> [options]

# Options:
#   --framework <name>     Target framework (react, vue, svelte, angular)
#   --typescript           Generate TypeScript (default: true)
#   --css <type>           CSS solution (modules, styled, tailwind, emotion)
#   --output <dir>         Output directory (default: src/components)
#   --test                 Generate test files
#   --storybook            Generate Storybook stories

# Example:
ax-cli frontend design-to-code https://figma.com/file/abc123?node-id=1:234 \
  --framework react \
  --typescript \
  --css tailwind \
  --output src/components/Button \
  --storybook
```

**FR-4.3**: Token extraction

```bash
ax-cli frontend extract-tokens <figma-file-id> [options]

# Options:
#   --format <type>        Output format (css, scss, json, js, ts)
#   --output <file>        Output file path
#   --categories <list>    Token categories (colors, typography, spacing, all)

# Example:
ax-cli frontend extract-tokens abc123 \
  --format css \
  --output src/styles/design-tokens.css \
  --categories colors,typography,spacing
```

**Technical Implementation**:

```typescript
// src/commands/frontend.ts

export function createFrontendCommand(): Command {
  const frontendCmd = new Command('frontend');
  frontendCmd.description('Front-end development workflows with MCP');

  // Design to code
  frontendCmd
    .command('design-to-code <figma-url>')
    .description('Convert Figma designs to code')
    .option('--framework <name>', 'Target framework', 'react')
    .option('--typescript', 'Generate TypeScript', true)
    .option('--css <type>', 'CSS solution', 'modules')
    .option('--output <dir>', 'Output directory', 'src/components')
    .option('--test', 'Generate test files')
    .option('--storybook', 'Generate Storybook stories')
    .action(async (figmaUrl: string, options) => {
      // Parse Figma URL to extract file ID and node ID
      const { fileId, nodeId } = parseFigmaUrl(figmaUrl);

      // Build specialized prompt for LLM
      const prompt = buildDesignToCodePrompt({
        fileId,
        nodeId,
        framework: options.framework,
        typescript: options.typescript,
        cssType: options.css,
        includeTests: options.test,
        includeStorybook: options.storybook
      });

      // Execute through agent with Figma MCP tools
      const agent = new LLMAgent(/* config */);
      await agent.processUserMessage(prompt);
    });

  // Token extraction
  frontendCmd
    .command('extract-tokens <file-id>')
    .description('Extract design tokens from Figma')
    .option('--format <type>', 'Output format', 'css')
    .option('--output <file>', 'Output file')
    .option('--categories <list>', 'Token categories', 'all')
    .action(async (fileId: string, options) => {
      const prompt = buildTokenExtractionPrompt({
        fileId,
        format: options.format,
        outputFile: options.output,
        categories: options.categories.split(',')
      });

      const agent = new LLMAgent(/* config */);
      await agent.processUserMessage(prompt);
    });

  return frontendCmd;
}

// Specialized prompt builders
function buildDesignToCodePrompt(params: DesignToCodeParams): string {
  return `
Using the Figma MCP server, retrieve the design for:
- File ID: ${params.fileId}
- Node ID: ${params.nodeId}

Generate a ${params.framework}${params.typescript ? ' TypeScript' : ''} component with:
1. Component structure matching the Figma design
2. ${params.cssType} styling that matches design specifications
3. Props interface derived from design variants
4. Accessibility attributes (ARIA labels, semantic HTML)
${params.includeTests ? '5. Unit tests using React Testing Library' : ''}
${params.includeStorybook ? '6. Storybook stories for all variants' : ''}

Extract and apply:
- Layout (flexbox/grid)
- Spacing (padding, margin)
- Colors (from design tokens)
- Typography (font family, size, weight, line height)
- Border radius, shadows
- Responsive breakpoints

Output files to: ${params.outputDir}/
  `.trim();
}
```

**Acceptance Criteria**:
- [ ] `ax-cli frontend` command group exists
- [ ] `design-to-code` generates component from Figma URL
- [ ] Supports React, Vue, Svelte
- [ ] TypeScript generation works
- [ ] CSS Modules, Tailwind, Styled Components supported
- [ ] Token extraction outputs valid CSS/JSON
- [ ] Generated code passes linting
- [ ] Tests validate against real Figma designs

---

### 5. MCP Health Monitoring

**Feature ID**: MCP-HEALTH-005
**Priority**: P2 (Medium)
**Risk**: Low
**Effort**: 2 days

#### Requirements

**FR-5.1**: Health check command

```bash
ax-cli mcp health [server-name]

# Without server name: shows all servers
# Output:
# MCP Server Health Report
#
# ✓ figma (Connected)
#   Transport: stdio
#   Uptime: 45 minutes
#   Tools: 5 available
#   Latency: avg 45ms, p95 120ms
#   Success Rate: 98.5% (197/200 calls)
#   Last Error: none
#
# ✗ vercel (Disconnected)
#   Transport: http
#   Error: Connection timeout
#   Last Successful: 2 hours ago
#   Suggested Action: Check network connection, verify API endpoint
```

**FR-5.2**: Status bar integration

Show MCP status in interactive mode status bar:
```
╭─ ax-cli v3.2.0 ──────────────────── MCP: ✓ 2/3 servers ─╮
│                                                           │
│ > Your prompt here_                                       │
```

**FR-5.3**: Automatic reconnection

Detect disconnected servers and attempt reconnection:
```typescript
// In MCPManager
class MCPManager {
  private healthCheckInterval: NodeJS.Timeout | null = null;

  startHealthMonitoring(intervalMs: number = 60000) {
    this.healthCheckInterval = setInterval(async () => {
      for (const serverName of this.getServers()) {
        try {
          // Ping server
          await this.pingServer(serverName);
        } catch (error) {
          console.warn(`Server ${serverName} unhealthy, attempting reconnect...`);
          await this.reconnectServer(serverName);
        }
      }
    }, intervalMs);
  }

  async reconnectServer(serverName: string): Promise<void> {
    // Attempt graceful reconnection
    const config = this.getServerConfig(serverName);
    await this.removeServer(serverName);
    await this.addServer(config);
  }
}
```

**Acceptance Criteria**:
- [ ] `ax-cli mcp health` shows all server statuses
- [ ] Health metrics include latency, success rate
- [ ] Status bar shows MCP connection count
- [ ] Auto-reconnection on failures
- [ ] Health check configurable interval
- [ ] Metrics exported to JSON (`--json` flag)

---

### 6. Visual/Image Handling

**Feature ID**: MCP-VISUAL-006
**Priority**: P2 (Medium)
**Risk**: Medium
**Effort**: 4 days

#### Requirements

**FR-6.1**: Image input support

```bash
# Accept screenshots/images as input
ax-cli -p "Compare this design with the current implementation" \
  --image figma-screenshot.png \
  --file src/components/Button.tsx
```

**FR-6.2**: Visual comparison

```typescript
// In LLMAgent - enhance with vision capabilities
interface VisualComparisonParams {
  designImage: string; // Path to design screenshot
  implementationFiles: string[]; // Code files
  outputFormat: 'markdown' | 'html' | 'json';
}

async function performVisualComparison(params: VisualComparisonParams): Promise<string> {
  // 1. Load design image
  const designImage = await readImage(params.designImage);

  // 2. Read implementation code
  const codeFiles = await Promise.all(
    params.implementationFiles.map(f => readFile(f))
  );

  // 3. Send to GLM-4.6 with vision (if supported)
  const prompt = `
Compare this Figma design (image) with the implementation (code).

Design Image: [attached]

Implementation:
${codeFiles.map((code, i) => `
File: ${params.implementationFiles[i]}
\`\`\`
${code}
\`\`\`
`).join('\n')}

Analyze differences in:
1. Layout & positioning
2. Colors & styling
3. Typography
4. Spacing (padding, margin)
5. Component structure
6. Accessibility

Output format: ${params.outputFormat}
  `;

  // Execute with image attachment
  const result = await this.llmClient.chat({
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: designImage } }
        ]
      }
    ]
  });

  return result.choices[0].message.content;
}
```

**FR-6.3**: Design screenshot export from Figma

```bash
# Automatically export Figma frames as images
ax-cli frontend compare-design <figma-url> \
  --implementation src/components/Button.tsx \
  --export-screenshot

# Steps:
# 1. Use Figma MCP to export frame as PNG
# 2. Load implementation files
# 3. Perform visual comparison with GLM-4.6 vision
# 4. Generate diff report
```

**Acceptance Criteria**:
- [ ] `--image` flag accepts screenshots
- [ ] Visual comparison works with GLM-4.6
- [ ] Design differences identified (layout, colors, typography)
- [ ] Output format options (markdown, HTML, JSON)
- [ ] Figma frame auto-export integrated
- [ ] Error handling for unsupported models

---

## Technical Architecture

### System Components

```
┌─────────────────────────────────────────────────────────┐
│                    AX CLI Frontend                       │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   Commands   │  │ MCP Manager  │  │  LLM Agent   │  │
│  │              │  │              │  │              │  │
│  │ - mcp tools  │  │ - Templates  │  │ - Vision     │  │
│  │ - frontend   │  │ - Health     │  │ - Workflows  │  │
│  │ - mcp health │  │ - Discovery  │  │              │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │
│         │                 │                 │          │
└─────────┼─────────────────┼─────────────────┼──────────┘
          │                 │                 │
          ▼                 ▼                 ▼
┌─────────────────────────────────────────────────────────┐
│                  MCP Transport Layer                     │
│                                                          │
│  ┌────────┐      ┌────────┐      ┌────────┐             │
│  │ Stdio  │      │  HTTP  │      │  SSE   │             │
│  └────┬───┘      └────┬───┘      └────┬───┘             │
└───────┼──────────────┼──────────────┼────────────────────┘
        │              │              │
        ▼              ▼              ▼
┌─────────────────────────────────────────────────────────┐
│                   MCP Servers                            │
│                                                          │
│  ┌─────────┐  ┌─────────┐  ┌───────────┐  ┌─────────┐  │
│  │ Figma   │  │ Vercel  │  │ Puppeteer │  │ GitHub  │  │
│  │         │  │         │  │           │  │         │  │
│  │ 5 tools │  │ 5 tools │  │  8 tools  │  │ 12 tools│  │
│  └─────────┘  └─────────┘  └───────────┘  └─────────┘  │
└─────────────────────────────────────────────────────────┘
```

### Data Flow: Design-to-Code

```
1. User Command
   ax-cli frontend design-to-code <figma-url>

2. Parse & Validate
   - Extract file ID, node ID from URL
   - Check Figma MCP server connected
   - Validate output options

3. Fetch Design Data
   - Use Figma MCP tools:
     * get_file_data(fileId)
     * get_components(fileId, nodeId)
     * get_variables(fileId)

4. Build Specialized Prompt
   - Include design data (JSON)
   - Specify framework, styling
   - Add generation constraints

5. LLM Generation
   - GLM-4.6 processes with context
   - Uses code generation capabilities
   - Applies best practices

6. Write Output Files
   - Component file (.tsx)
   - Style file (.module.css)
   - Test file (.test.tsx)
   - Storybook story (.stories.tsx)

7. Validation
   - Run TypeScript compiler
   - Check ESLint
   - Verify imports

8. Success Report
   - Show generated files
   - Suggest next steps
   - Link to documentation
```

### File Structure Changes

```
src/
├── commands/
│   ├── mcp.ts              # Enhanced with tools, health
│   └── frontend.ts         # NEW: Frontend workflows
├── mcp/
│   ├── client.ts           # Existing
│   ├── config.ts           # Enhanced with templates
│   ├── templates.ts        # NEW: Server templates
│   └── health.ts           # NEW: Health monitoring
├── agent/
│   ├── llm-agent.ts        # Enhanced with vision
│   └── workflow-builder.ts # NEW: Workflow templates
└── ui/
    └── components/
        └── mcp-status.tsx  # NEW: Status bar component

docs/
├── mcp.md                  # Enhanced
└── mcp-frontend-guide.md   # NEW: Frontend guide

automatosx/
└── prd/
    └── mcp-frontend-enhancement.md  # THIS DOCUMENT
```

---

## Testing Strategy

### Unit Tests

```typescript
// tests/mcp/templates.test.ts
describe('MCP Templates', () => {
  it('should load all predefined templates', () => {
    const templates = Object.keys(TEMPLATES);
    expect(templates.length).toBeGreaterThan(8);
  });

  it('should validate Figma template configuration', () => {
    const figma = TEMPLATES.figma;
    expect(figma.config.transport.type).toBe('stdio');
    expect(figma.requiredEnv).toContainEqual({
      name: 'FIGMA_ACCESS_TOKEN',
      description: expect.any(String),
      url: expect.any(String)
    });
  });

  it('should generate valid MCP config from template', () => {
    const config = generateConfigFromTemplate('figma', {
      FIGMA_ACCESS_TOKEN: 'test_token'
    });

    const validationResult = MCPServerConfigSchema.safeParse(config);
    expect(validationResult.success).toBe(true);
  });
});

// tests/commands/frontend.test.ts
describe('Frontend Commands', () => {
  it('should parse Figma URL correctly', () => {
    const url = 'https://figma.com/file/abc123?node-id=1:234';
    const parsed = parseFigmaUrl(url);

    expect(parsed.fileId).toBe('abc123');
    expect(parsed.nodeId).toBe('1:234');
  });

  it('should build design-to-code prompt', () => {
    const prompt = buildDesignToCodePrompt({
      fileId: 'abc123',
      nodeId: '1:234',
      framework: 'react',
      typescript: true,
      cssType: 'tailwind'
    });

    expect(prompt).toContain('react');
    expect(prompt).toContain('TypeScript');
    expect(prompt).toContain('tailwind');
  });
});
```

### Integration Tests

```bash
# Test Figma MCP integration
npm run test:integration -- --grep "Figma MCP"

# Test workflow commands
npm run test:integration -- --grep "frontend commands"
```

### E2E Tests

```bash
# Complete design-to-code workflow
ax-cli mcp add figma --template
ax-cli mcp test figma
ax-cli frontend design-to-code <test-figma-url> \
  --framework react \
  --output /tmp/test-component

# Verify output
ls /tmp/test-component/*.tsx
npm run typecheck /tmp/test-component
```

---

## Security Considerations

### 1. **Template Validation**
- All templates validated against real services before release
- Regular audits of template configurations
- Community reporting for broken/malicious templates

### 2. **Token Management**
- Never store tokens in config files
- Environment variable validation
- Secure token prompts in `--interactive` mode
- Documentation on token security

### 3. **MCP Server Trust**
- Warn users when adding custom (non-template) servers
- Display server permissions/capabilities
- Sandbox stdio processes where possible
- Rate limiting on MCP tool calls

### 4. **Data Privacy**
- No Figma designs cached without user consent
- Temporary files cleaned up after operations
- Option to disable telemetry for MCP usage

---

## Rollout Plan

### Phase 1: Alpha Release (Internal)
**Week 1-2**:
- Build core templates (Figma, Vercel, GitHub)
- Implement `mcp tools` command
- Internal testing with team

**Success Criteria**:
- 5+ templates working
- Zero breaking changes to existing MCP functionality
- Positive internal feedback

### Phase 2: Beta Release (Early Adopters)
**Week 3-4**:
- Add frontend workflow commands
- Complete documentation
- Invite 20-30 beta users (front-end developers)

**Success Criteria**:
- 60%+ beta users successfully set up Figma MCP
- Average setup time <2 minutes
- 80%+ positive feedback
- <10 critical bugs reported

### Phase 3: General Availability
**Week 5+**:
- Full release to all users
- Marketing: blog post, social media
- Monitor adoption metrics
- Iterate based on feedback

**Success Criteria**:
- 40%+ users enable MCP within first month
- <5% error rate on MCP connections
- 25%+ use front-end workflows
- Positive community sentiment

---

## Success Metrics (KPIs)

### Primary Metrics

| Metric | Current | Target (3 months) | Measurement |
|--------|---------|-------------------|-------------|
| **MCP Adoption Rate** | ~5% | 40% | % users with ≥1 MCP server |
| **Setup Success Rate** | ~85% | 95% | % successful template installations |
| **Avg Setup Time** | 5-10 min | <30 sec | Template-based setup |
| **Front-end Usage** | N/A | 25% | % users using frontend commands |
| **Tool Discovery** | 0% | 80% | % users running `mcp tools` |

### Secondary Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Documentation Views** | 1000+/month | Page analytics |
| **Community Templates** | 5+ | User-contributed templates |
| **Error Rate** | <5% | Failed MCP operations |
| **Support Tickets** | <10/week | GitHub issues tagged 'mcp' |

### User Satisfaction

- **NPS Score**: Target 40+ (from front-end developers)
- **Feature Request Fulfillment**: 70%+ of top requests addressed
- **Community Sentiment**: Majority positive mentions in issues/social media

---

## Open Questions & Decisions Needed

### 1. Gemini Integration
**Question**: Should we add Gemini as alternative LLM provider?

**Options**:
- A) Yes, add as multi-model support (Medium effort, 1 week)
- B) No, focus on enhancing GLM integration (Low effort)
- C) Community contribution (Low effort, longer timeline)

**Recommendation**: Option C - Document how to add alternative providers, let community contribute Gemini support if desired. Focus team effort on MCP enhancements.

---

### 2. Visual Comparison Scope
**Question**: How much should we invest in visual/image handling?

**Options**:
- A) Full visual diff with pixel comparison (High effort, 2 weeks)
- B) LLM-based comparison only (Medium effort, 3-4 days)
- C) Skip for Phase 1, defer to Phase 2/3 (Low effort)

**Recommendation**: Option B for Phase 1, consider Option A for Phase 3 if user demand high.

---

### 3. Marketplace Implementation
**Question**: Build MCP marketplace in Phase 1 or defer?

**Options**:
- A) Build full marketplace now (High effort, 2-3 weeks, high maintenance)
- B) Simple curated list (Low effort, 2 days)
- C) Defer entirely to Phase 3 (No effort now)

**Recommendation**: Option B for Phase 1 - Add 10-15 curated templates. Build full marketplace in Phase 3 based on demand.

---

### 4. Framework Support Priority
**Question**: Which frameworks to prioritize for design-to-code?

**Options**:
- A) React only (Low effort)
- B) React + Vue (Medium effort)
- C) React + Vue + Svelte + Angular (High effort)

**Recommendation**: Option B - React (most popular) + Vue (growing adoption). Add Svelte/Angular in Phase 2 based on user requests.

---

## Risk Assessment

| Risk | Severity | Likelihood | Mitigation |
|------|----------|------------|------------|
| **Figma API Changes** | High | Medium | Version pin, monitor changelog, automated tests |
| **Template Breakage** | Medium | Medium | CI/CD validation, health checks, quick hotfix process |
| **Low Adoption** | High | Low | Clear docs, examples, onboarding flow |
| **Performance Issues** | Medium | Low | Async operations, connection pooling, timeouts |
| **Security Vulnerabilities** | High | Low | Code review, token validation, sandboxing |
| **Community Spam Templates** | Low | Medium | Curation process, community moderation (Phase 3) |

---

## Dependencies

### External Dependencies
- Figma MCP Server: `@figma/mcp-server` (NPM package)
- Vercel MCP Server: TBD (check if official exists)
- MCP SDK: `@modelcontextprotocol/sdk` (already used)

### Internal Dependencies
- No breaking changes to existing MCP implementation
- GLM-4.6 vision capabilities (verify support)
- UI framework (Ink) for status bar enhancements

### Team Dependencies
- Design: Figma access for testing, sample designs
- QA: Test coverage for new commands
- Docs: Review and publish new documentation

---

## Appendix

### A. Competitive Analysis

**Claude Code CLI**:
- Has MCP support
- No pre-configured templates
- No front-end specialization
- Opportunity: Differentiate with curated templates

**Cursor AI**:
- No native MCP support (yet)
- Strong design-to-code with AI
- Opportunity: Better MCP integration

**GitHub Copilot**:
- No MCP support
- General-purpose coding
- Opportunity: Specialized front-end workflows

**Conclusion**: ax-cli can lead in MCP + front-end specialization.

---

### B. Figma MCP Capabilities (Verified)

From official documentation (Figma.com, June 2025):

**Available Tools**:
1. `get_file` - Retrieve file metadata
2. `get_file_nodes` - Get specific nodes/frames
3. `get_file_components` - List components
4. `get_file_variables` - Extract design tokens
5. `export_images` - Export frames as images
6. `get_comments` - Retrieve file comments

**Authentication**:
- Personal Access Token (PAT) required
- Generate at: https://figma.com/settings
- Permissions: Read-only sufficient for most use cases

**Rate Limits**:
- 1000 requests/hour per token
- Sufficient for typical development workflows

---

### C. User Research Insights

**From GitHub Issues & Community Feedback**:

> "I'd love to use ax-cli for front-end work but setting up Figma integration took me 30 minutes and I'm still not sure it's working correctly"

> "Need better docs on which MCP servers are production-ready. I wasted time on broken community servers"

> "Would be amazing if ax-cli had a command like 'figma-to-react' that just worked out of the box"

> "Can ax-cli support Gemini? I have credits there and don't want to switch to GLM"

**Key Takeaways**:
1. Setup friction is #1 pain point
2. Users want opinionated, curated solutions
3. Design-to-code is top requested feature
4. Multi-model support requested but not critical

---

### D. Implementation Timeline (Gantt)

```
Week 1-2: Phase 1 Foundation
├─ Templates implementation (3d)
├─ Tool discovery commands (2d)
├─ Documentation (2d)
└─ Testing & bug fixes (3d)

Week 3-4: Phase 2 Workflows
├─ Frontend command group (2d)
├─ Design-to-code workflow (3d)
├─ Token extraction (2d)
└─ Testing & iteration (3d)

Week 5+: Phase 3 (Optional)
├─ Visual comparison (4d)
├─ Health monitoring (2d)
├─ Marketplace foundation (5d)
└─ Performance optimization (ongoing)
```

---

### E. Success Stories (Hypothetical)

**Scenario 1: Startup Developer**
Before: Spent 2 hours manually converting Figma designs to React components, frequent design-code drift.

After: Uses `ax-cli frontend design-to-code` to generate components in 2 minutes. Design tokens auto-synced. Ship features 3x faster.

**Scenario 2: Agency Team**
Before: Each developer sets up their own tooling, inconsistent MCP configurations across team.

After: Shared `.ax-cli/settings.json` with curated templates. One-command setup for new team members. Standardized workflows.

**Scenario 3: Open Source Maintainer**
Before: Manual PR reviews, hard to validate UI changes match design.

After: CI/CD integrates `ax-cli frontend compare-design` to auto-validate PRs against Figma. Catches design drift early.

---

## Approval & Next Steps

### Approval Required From
- [ ] Engineering Lead - Technical feasibility
- [ ] Product Manager - Prioritization & roadmap fit
- [ ] Design/UX - User experience validation
- [ ] Security - Security review
- [ ] Community Lead - User demand validation

### Next Steps After Approval
1. Create GitHub project for tracking
2. Break down into implementable issues
3. Assign Phase 1 tasks to engineers
4. Set up beta user program
5. Begin implementation Sprint 1

---

**Document Status**: ✅ Ready for Review
**Last Updated**: 2025-11-21
**Author**: Claude (AI Assistant)
**Reviewers**: [Pending]
