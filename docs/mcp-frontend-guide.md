# MCP for Front-End Developers

**The ultimate guide to supercharging your front-end workflow with Model Context Protocol**

---

## Table of Contents

1. [Quick Start (5 Minutes)](#quick-start-5-minutes)
2. [Frontend Commands](#frontend-commands)
3. [Popular Front-End Integrations](#popular-front-end-integrations)
4. [Design-to-Code Workflows](#design-to-code-workflows)
5. [Real-World Examples](#real-world-examples)
6. [Best Practices](#best-practices)
7. [Troubleshooting](#troubleshooting)

---

## Quick Start (5 Minutes)

### Prerequisites

- Node.js 24+ installed
- ax-cli installed (`npm install -g @defai.digital/ax-cli`)
- A Figma account (for design integration)

### 1. Set Up Figma Integration

**Step 1**: Generate a Figma access token

1. Visit [https://figma.com/settings](https://figma.com/settings)
2. Scroll to "Personal access tokens"
3. Click "Generate new token"
4. Name it "ax-cli" and copy the token

**Step 2**: Configure environment variable

```bash
export FIGMA_ACCESS_TOKEN="your_token_here"

# Add to your shell profile for persistence (.zshrc, .bashrc, etc.)
echo 'export FIGMA_ACCESS_TOKEN="your_token_here"' >> ~/.zshrc
```

**Step 3**: Add Figma MCP server

```bash
ax-cli mcp add figma --template
```

You should see:

```
📦 Setting up figma MCP server
Official Figma MCP server for design-to-code workflows

✅ Configuration saved
🔌 Connecting to server...
✅ Connected successfully

🔧 Available tools: 5
   • get_file_data: Retrieve Figma file structure and metadata
   • get_components: List all components from a file
   • get_variables: Extract design tokens (colors, spacing, etc.)
   ...

✨ figma MCP server is ready to use!
```

**Step 4**: Test the integration

```bash
ax-cli mcp test figma
```

**Congratulations!** 🎉 You're ready to use design-to-code workflows.

---

## Frontend Commands

ax-cli provides specialized `frontend` commands for streamlined design-to-code workflows.

### Available Commands

#### `ax-cli frontend design-to-code <figma-url>`

Convert Figma designs directly to production-ready code.

**Options**:
- `--framework <name>` - Target framework (react, vue, svelte, angular, solid) [default: react]
- `--typescript` - Generate TypeScript [default: true]
- `--no-typescript` - Generate JavaScript
- `--css <type>` - CSS solution (modules, styled, tailwind, emotion, scss) [default: modules]
- `--output <dir>` - Output directory [default: src/components]
- `--test` - Generate test files [default: false]
- `--storybook` - Generate Storybook stories [default: false]

**Example**:
```bash
ax-cli frontend design-to-code \
  https://figma.com/file/abc123xyz?node-id=1:234 \
  --framework react \
  --typescript \
  --css tailwind \
  --test \
  --storybook
```

**What it does**:
1. Validates Figma MCP server is connected
2. Parses the Figma URL to extract file ID and node ID
3. Generates an optimized prompt for the AI agent
4. Shows the configuration and expected output structure

---

#### `ax-cli frontend extract-tokens <file-id>`

Extract design tokens (colors, typography, spacing, etc.) from Figma.

**Options**:
- `--format <type>` - Output format (css, scss, json, js, ts) [default: css]
- `--output <file>` - Output file path [default: src/styles/design-tokens.css]
- `--categories <list>` - Token categories (colors, typography, spacing, effects, all) [default: all]

**Example**:
```bash
ax-cli frontend extract-tokens abc123xyz \
  --format css \
  --output src/styles/tokens.css \
  --categories colors,typography,spacing
```

**What it does**:
1. Connects to Figma MCP server
2. Retrieves all design variables from the specified file
3. Generates formatted token file (CSS variables, SCSS variables, JSON, etc.)
4. Organizes tokens by category with semantic naming

---

#### `ax-cli frontend gen-component <name>`

Generate a component from Figma, template, or from scratch.

**Options**:
- `--source <type>` - Component source (figma, template, scratch) [default: figma]
- `--file-id <id>` - Figma file ID (required if source is figma)
- `--node-id <id>` - Figma node ID (optional)
- `--framework <name>` - Target framework (react, vue, svelte, angular, solid) [default: react]
- `--typescript` - Generate TypeScript [default: true]
- `--css <type>` - CSS solution (modules, styled, tailwind, emotion) [default: modules]
- `--output <dir>` - Output directory [default: src/components]

**Example - From Figma**:
```bash
ax-cli frontend gen-component Button \
  --source figma \
  --file-id abc123xyz \
  --framework react \
  --typescript \
  --css tailwind
```

**Example - From Template**:
```bash
ax-cli frontend gen-component Modal \
  --source template \
  --framework react
```

**What it does**:
1. Searches for the component in Figma (if source is figma)
2. Generates component structure with proper TypeScript types
3. Creates associated files (styles, tests, stories if requested)
4. Follows framework best practices

---

#### `ax-cli frontend compare-design <figma-url>`

Compare implementation with Figma design using AI vision capabilities (GLM-4.5V).

**Options**:
- `--file <path>` - Implementation file(s) to compare (comma-separated) [default: src/components]
- `--model <name>` - Vision model to use [default: glm-4.5v]
- `--export-screenshot` - Export screenshot from Figma [default: true]
- `--format <type>` - Output format (markdown, html, json) [default: markdown]

**Example**:
```bash
ax-cli frontend compare-design \
  https://figma.com/file/abc123xyz?node-id=1:234 \
  --file src/components/Button.tsx,src/components/Button.module.css \
  --model glm-4.5v \
  --format markdown
```

**What it does**:
1. Exports screenshot from Figma design
2. Reads your implementation files
3. Uses GLM-4.5V vision model to compare visual appearance
4. Analyzes differences in:
   - Layout & positioning
   - Colors & styling
   - Typography
   - Spacing (padding, margin)
   - Component states
   - Accessibility
5. Generates detailed comparison report with specific recommendations

**Output Report Includes**:
- Overall similarity score (0-100%)
- Critical differences that significantly affect visual appearance
- Minor discrepancies that could be improved
- Specific code changes to match design exactly
- Accessibility gaps and recommendations

---

## Popular Front-End Integrations

### Browse Available Templates

```bash
# View all templates
ax-cli mcp templates

# Filter by category
ax-cli mcp templates --category design
ax-cli mcp templates --category deployment
ax-cli mcp templates --category testing
```

### Essential Front-End Stack

Set up a complete front-end development environment:

```bash
# Design
export FIGMA_ACCESS_TOKEN="your_token"
ax-cli mcp add figma --template

# Version Control
export GITHUB_TOKEN="ghp_your_token"
ax-cli mcp add github --template

# Deployment
export VERCEL_TOKEN="your_token"
ax-cli mcp add vercel --template

# Testing
ax-cli mcp add puppeteer --template
ax-cli mcp add storybook --template

# Monitoring
export SENTRY_AUTH_TOKEN="your_token"
ax-cli mcp add sentry --template
```

Verify all connections:

```bash
ax-cli mcp list
```

---

## Design-to-Code Workflows

### Extracting Design Tokens

**Scenario**: You need to extract all color variables from a Figma design system and generate a CSS file.

**Step 1**: Get your Figma file ID

From a URL like: `https://figma.com/file/abc123xyz/Design-System`
The file ID is: `abc123xyz`

**Step 2**: Use ax-cli interactive mode

```bash
ax-cli
```

**Step 3**: Ask the AI to extract tokens

```
> Extract all color variables from Figma file abc123xyz and create a CSS file at src/styles/colors.css with CSS custom properties
```

**What happens**:
1. ax-cli uses the Figma MCP server to call `get_variables()`
2. GLM-4.6 processes the color data
3. Generates a properly formatted CSS file:

```css
/* src/styles/colors.css - Auto-generated from Figma */

:root {
  /* Primary Colors */
  --color-primary-50: #f0f9ff;
  --color-primary-100: #e0f2fe;
  --color-primary-500: #0ea5e9;
  --color-primary-900: #0c4a6e;

  /* Neutral Colors */
  --color-neutral-50: #f9fafb;
  --color-neutral-100: #f3f4f6;
  --color-neutral-500: #6b7280;
  --color-neutral-900: #111827;

  /* Semantic Colors */
  --color-success: #10b981;
  --color-warning: #f59e0b;
  --color-error: #ef4444;
  --color-info: #3b82f6;
}
```

### Generating Components from Figma

**Scenario**: Convert a Figma button component to a React TypeScript component with Tailwind CSS.

**Step 1**: Get the Figma URL with node ID

Right-click a frame/component in Figma → "Copy link"
Example: `https://figma.com/file/abc123xyz?node-id=1:234`

**Step 2**: Use ax-cli

```bash
ax-cli
```

```
> Generate a React TypeScript component from the Figma component at https://figma.com/file/abc123xyz?node-id=1:234

Requirements:
- Use Tailwind CSS for styling
- Support all variants shown in Figma
- Include proper TypeScript types
- Add accessibility attributes
- Create a Storybook story
```

**What happens**:
1. Fetches component data from Figma (dimensions, colors, text styles, variants)
2. Analyzes the design structure
3. Generates React component with props matching Figma variants
4. Creates Tailwind classes matching design specs
5. Generates Storybook story showing all variants

**Output**:

```typescript
// src/components/Button/Button.tsx
import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-primary-500 text-white hover:bg-primary-600',
        secondary: 'bg-neutral-200 text-neutral-900 hover:bg-neutral-300',
        outline: 'border-2 border-primary-500 text-primary-500 hover:bg-primary-50',
      },
      size: {
        sm: 'h-9 px-3 text-sm',
        md: 'h-10 px-4 text-base',
        lg: 'h-11 px-8 text-lg',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  children: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={buttonVariants({ variant, size, className })}
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';
```

```typescript
// src/components/Button/Button.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './Button';

const meta: Meta<typeof Button> = {
  title: 'Components/Button',
  component: Button,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Primary: Story = {
  args: {
    variant: 'primary',
    children: 'Button',
  },
};

export const Secondary: Story = {
  args: {
    variant: 'secondary',
    children: 'Button',
  },
};

// ... more stories
```

### Building a Complete Page from Figma

**Scenario**: Convert an entire Figma page/screen to a working React application.

```
> Create a responsive landing page based on the Figma design at https://figma.com/file/abc123xyz?node-id=10:500

Requirements:
- Next.js App Router with TypeScript
- Tailwind CSS for styling
- Extract all images as optimized assets
- Ensure mobile responsiveness
- Match exact spacing and typography from Figma
- Create components for reusable sections
```

**What you get**:
- Page component (`app/page.tsx`)
- Reusable section components (`components/Hero.tsx`, `components/Features.tsx`, etc.)
- Exported and optimized images
- Tailwind config with custom design tokens
- Responsive breakpoints matching Figma frames

### Keeping Design and Code in Sync

**Scenario**: Design has been updated in Figma. Sync changes to code.

```
> Compare the current Button component implementation in src/components/Button.tsx with the Figma component at https://figma.com/file/abc123xyz?node-id=1:234

Show me what changed and update the component to match the latest design.
```

**What happens**:
1. Fetches latest Figma component data
2. Reads current implementation
3. Identifies differences (colors, spacing, variants)
4. Shows a diff report
5. Updates the component to match Figma

---

## Real-World Examples

### Example 1: Building a Design System

**Goal**: Create a complete design system from Figma variables and components.

**Commands**:

```bash
# Step 1: Extract design tokens
ax-cli
> Extract all design tokens from Figma file <file-id> and create:
> - src/styles/tokens.css (CSS custom properties)
> - src/styles/tokens.ts (TypeScript constants)
> - tailwind.config.js (extend with design tokens)

# Step 2: Generate component library
> Generate React TypeScript components for all components in the Figma file <file-id>:
> - Use Tailwind CSS referencing the design tokens
> - Create Storybook stories for each component
> - Add TypeScript types for all props
> - Include accessibility attributes (ARIA labels, roles)
> - Output to src/components/design-system/

# Step 3: Generate documentation
> Create a README.md in src/components/design-system/ documenting:
> - Component usage examples
> - Prop types and variants
> - Design principles
> - Installation and setup instructions
```

**Result**: A complete, production-ready design system synchronized with Figma.

---

### Example 2: Rapid Prototyping

**Goal**: Quickly build a prototype from wireframes.

```bash
ax-cli
> Build a prototype for a task management app based on Figma file <file-id>

Requirements:
- Next.js 14 with App Router and TypeScript
- Tailwind CSS
- Mock data for tasks
- Basic CRUD operations (Create, Read, Update, Delete tasks)
- Responsive design matching Figma mobile and desktop frames
- Deploy-ready code

Output structure:
- app/page.tsx (main dashboard)
- app/tasks/[id]/page.tsx (task detail page)
- components/ (reusable UI components)
- lib/mockData.ts (sample tasks)
- All styling from Figma design
```

**Deployment**:

```bash
# Use Vercel MCP to deploy
ax-cli
> Deploy the current project to Vercel production
```

---

### Example 3: Visual Regression Testing

**Goal**: Ensure UI changes don't break existing designs.

**Setup**: Figma MCP + Puppeteer MCP + Chromatic MCP

```bash
# Automated workflow
ax-cli
> For each component in src/components/:
> 1. Launch the Storybook story
> 2. Take a screenshot with Puppeteer
> 3. Compare with the Figma design
> 4. Report any visual differences
> 5. Upload to Chromatic for review
```

**Result**: Automated visual testing that catches design drift early.

---

### Example 4: Internationalization (i18n) from Figma

**Goal**: Extract text content from Figma for translation.

```bash
ax-cli
> Extract all text content from Figma file <file-id>
> Generate i18n JSON files for:
> - en-US (extracted text as keys and values)
> - es-ES, fr-FR, de-DE (keys with placeholder values)
>
> Output to locales/ directory in i18next format
```

**Result**:

```json
// locales/en-US.json
{
  "hero.title": "Welcome to our platform",
  "hero.subtitle": "Build amazing things together",
  "cta.primary": "Get Started",
  "cta.secondary": "Learn More"
}
```

---

### Example 5: Accessibility Audit

**Goal**: Ensure Figma designs meet accessibility standards before coding.

```bash
ax-cli
> Audit the Figma design at <file-url> for accessibility:
> - Check color contrast ratios (WCAG AA/AAA)
> - Identify missing alt text for images
> - Verify text size meets minimum requirements
> - Check touch target sizes (44x44px minimum)
> - Suggest ARIA labels for interactive elements
>
> Generate a report with issues and recommendations
```

---

## Best Practices

### 1. Environment Variable Management

**✅ DO**: Store tokens in environment variables

```bash
# .env.local (gitignored!)
FIGMA_ACCESS_TOKEN=your_token
GITHUB_TOKEN=ghp_token
VERCEL_TOKEN=vercel_token
```

Load in shell profile:

```bash
# ~/.zshrc or ~/.bashrc
export FIGMA_ACCESS_TOKEN="..."
export GITHUB_TOKEN="..."
```

**❌ DON'T**: Hardcode tokens in config files

```json
// ❌ BAD - Never do this
{
  "mcpServers": {
    "figma": {
      "env": {
        "FIGMA_ACCESS_TOKEN": "figd_actual_token_here"
      }
    }
  }
}
```

---

### 2. Design-Code Workflow

**Recommended Flow**:

1. **Design Phase**: Create/update designs in Figma
2. **Extract Tokens**: Use MCP to generate design system tokens
3. **Generate Components**: Create initial components from Figma
4. **Refine Code**: Add business logic, state management, data fetching
5. **Sync Changes**: Periodically compare and update from Figma
6. **Deploy**: Use Vercel/Netlify MCP for deployment

**Pro Tip**: Use Figma version history to track when designs changed, then sync code at those checkpoints.

---

### 3. Component Generation Strategy

**When to generate from Figma**:
- ✅ Static UI components (buttons, cards, badges)
- ✅ Layout components (headers, footers, sidebars)
- ✅ Design system primitives

**When to code manually**:
- ❌ Complex interactive components with state
- ❌ Components with heavy business logic
- ❌ Data-driven components (charts, tables)

**Best approach**: Generate the shell/structure from Figma, then enhance with logic.

---

### 4. Team Collaboration

**Shared Configuration**:

```bash
# Commit this to Git
.ax-cli/settings.json
```

```json
{
  "mcpServers": {
    "figma": {
      "name": "figma",
      "transport": {
        "type": "stdio",
        "command": "npx",
        "args": ["@figma/mcp-server"]
        // Note: No env vars (team members provide their own)
      }
    }
  }
}
```

**Team Setup Instructions** (`SETUP.md`):

```markdown
## MCP Setup for Team

1. Install ax-cli: `npm install -g @defai.digital/ax-cli`
2. Generate Figma token: https://figma.com/settings
3. Set environment variable: `export FIGMA_ACCESS_TOKEN="your_token"`
4. Project is pre-configured, just run: `ax-cli mcp test figma`
```

---

### 5. Performance Tips

**Optimize Token Extraction**:

```
> Extract only the color and typography variables from Figma file <id>
> (Skip spacing, effects, and other variables for now)
```

**Batch Component Generation**:

```
> Generate components for the following Figma components in a single batch:
> - Button (node-id: 1:100)
> - Input (node-id: 1:200)
> - Card (node-id: 1:300)
>
> Output all to src/components/ with consistent structure
```

**Cache Figma Data**: If working on large files, extract data once and save locally:

```bash
ax-cli
> Fetch all data from Figma file <id> and save to .cache/figma-data.json
> Use this cached data for subsequent component generation
```

---

## Troubleshooting

### Common Issues

#### "FIGMA_ACCESS_TOKEN not set"

**Solution**:

```bash
# Check if variable is set
echo $FIGMA_ACCESS_TOKEN

# If empty, set it
export FIGMA_ACCESS_TOKEN="your_token"

# Verify
echo $FIGMA_ACCESS_TOKEN
```

Make it permanent:

```bash
echo 'export FIGMA_ACCESS_TOKEN="your_token"' >> ~/.zshrc
source ~/.zshrc
```

---

#### "File not found" or "No access"

**Cause**: Your Figma token doesn't have access to the file.

**Solution**:
1. Ensure you have at least "can view" permission on the Figma file
2. If it's a private file, you must be added as a collaborator
3. Try with a file you own to test the connection

---

#### "npx command not found"

**Cause**: Node.js or npx not installed.

**Solution**:

```bash
# Install Node.js 24+
# macOS
brew install node@24

# Verify installation
node --version  # Should be 24+
npx --version
```

---

#### "Connection timeout" for Figma MCP

**Cause**: Network issues or Figma API is slow.

**Solution**:

```bash
# Test network
curl https://api.figma.com/v1/me -H "X-Figma-Token: $FIGMA_ACCESS_TOKEN"

# If that works, try reconnecting
ax-cli mcp remove figma
ax-cli mcp add figma --template
```

---

#### "Too many requests" (Rate limiting)

**Cause**: Figma API has rate limits (1000 requests/hour).

**Solution**:
- Wait an hour for the limit to reset
- Batch operations when possible
- Cache Figma data locally instead of fetching repeatedly

---

#### Generated component doesn't match Figma exactly

**Debugging steps**:

1. **Check the Figma design**:
   - Are all elements properly named?
   - Are auto-layout/constraints set up correctly?
   - Are variants properly configured?

2. **Provide more context**:
   ```
   > The generated button is missing the hover state.
   >
   > Looking at Figma component <url>, there's a "Hover" variant.
   > Please regenerate including the hover variant with darker background.
   ```

3. **Iterate**:
   ```
   > The spacing is slightly off. In Figma, the padding is 12px horizontal and 8px vertical.
   > Update the component to match exactly.
   ```

---

## Advanced Tips

### Custom Prompts for Better Results

**Specify Framework Details**:

```
> Generate a React component using:
> - React 18 with TypeScript
> - Radix UI primitives for accessibility
> - Tailwind CSS with custom design tokens
> - React Hook Form for form handling
> - Zod for validation
```

**Specify Output Structure**:

```
> Generate components with this structure:
> src/components/[ComponentName]/
>   ├── index.tsx (component)
>   ├── [ComponentName].test.tsx (Jest tests)
>   ├── [ComponentName].stories.tsx (Storybook)
>   └── README.md (usage docs)
```

**Include Edge Cases**:

```
> Generate a form component that handles:
> - Loading states (show spinner)
> - Error states (show error message)
> - Success states (show checkmark)
> - Disabled states (gray out and prevent interaction)
>
> Match states shown in Figma variants
```

---

### Integrating with CI/CD

**GitHub Actions Example**:

```yaml
# .github/workflows/design-sync.yml
name: Sync Figma Designs

on:
  schedule:
    - cron: '0 9 * * *' # Daily at 9 AM
  workflow_dispatch: # Manual trigger

jobs:
  sync-designs:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '24'

      - name: Install ax-cli
        run: npm install -g @defai.digital/ax-cli

      - name: Setup MCP
        env:
          FIGMA_ACCESS_TOKEN: ${{ secrets.FIGMA_ACCESS_TOKEN }}
        run: |
          ax-cli mcp add figma --template

      - name: Extract design tokens
        env:
          FIGMA_ACCESS_TOKEN: ${{ secrets.FIGMA_ACCESS_TOKEN }}
        run: |
          ax-cli -p "Extract all variables from Figma file $FIGMA_FILE_ID and update src/styles/tokens.css"

      - name: Create PR if changes
        uses: peter-evans/create-pull-request@v5
        with:
          title: 'chore: sync design tokens from Figma'
          body: 'Automated design token sync from Figma'
          branch: 'design-sync'
```

---

## Next Steps

### Learn More

- [MCP Integration Guide](./mcp.md) - Full MCP documentation
- [ax-cli Features](./features.md) - Complete feature list
- [Configuration Guide](./configuration.md) - Advanced configuration

### Community Templates

Have a great MCP workflow? Share it!

1. Create a template configuration
2. Document your workflow
3. Submit a PR to [ax-cli repository](https://github.com/defai-digital/ax-cli)

### Get Help

- [GitHub Issues](https://github.com/defai-digital/ax-cli/issues) - Bug reports and feature requests
- [Discussions](https://github.com/defai-digital/ax-cli/discussions) - Community Q&A

---

**Happy coding!** 🚀

_Last updated: 2025-11-21_
