/**
 * Frontend development workflow commands
 * Specialized commands for design-to-code workflows with Figma integration
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { getMCPManager } from '../llm/tools.js';
import { extractErrorMessage } from '../utils/error-handler.js';
import { getActiveProvider } from '../provider/config.js';

/**
 * Get the CLI name from the active provider
 */
function getCliName(): string {
  return getActiveProvider().branding.cliName;
}

/**
 * Parse Figma URL to extract file ID and node ID
 */
function parseFigmaUrl(url: string): { fileId: string; nodeId?: string } {
  // Examples:
  // https://figma.com/file/abc123xyz/Design-System
  // https://figma.com/file/abc123xyz?node-id=1:234
  // https://www.figma.com/design/abc123xyz/Design-System?node-id=1:234

  const patterns = [
    // New design URLs
    /figma\.com\/design\/([a-zA-Z0-9-_]+)/,
    // Classic file URLs
    /figma\.com\/file\/([a-zA-Z0-9-_]+)/,
  ];

  let fileId: string | undefined;

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      fileId = match[1];
      break;
    }
  }

  if (!fileId) {
    throw new Error('Invalid Figma URL. Expected format: https://figma.com/file/[file-id] or https://figma.com/design/[file-id]');
  }

  // Extract node ID if present
  const nodeIdMatch = url.match(/node-id=([^&]+)/);
  const nodeId = nodeIdMatch ? nodeIdMatch[1] : undefined;

  return { fileId, nodeId };
}

/**
 * Validate that Figma MCP server is connected
 */
async function ensureFigmaConnected(): Promise<void> {
  const manager = getMCPManager();
  const servers = manager.getServers();

  if (!servers.includes('figma')) {
    console.log(chalk.yellow('\n⚠️  Figma MCP server is not connected.'));
    console.log();
    console.log(chalk.blue('To use frontend commands, you need to set up Figma integration:'));
    console.log();
    console.log('1. Generate a Figma access token:');
    console.log(chalk.gray('   https://figma.com/settings → Personal access tokens'));
    console.log();
    console.log('2. Set the environment variable:');
    console.log(chalk.cyan('   export FIGMA_ACCESS_TOKEN="your_token"'));
    console.log();
    console.log('3. Add Figma MCP server:');
    console.log(chalk.cyan(`   ${getCliName()} mcp add figma --template`));
    console.log();

    throw new Error('Figma MCP server not connected. Please set up Figma integration first.');
  }

  // Verify Figma tools are available
  const tools = manager.getTools().filter(t => t.serverName === 'figma');
  if (tools.length === 0) {
    throw new Error(`Figma MCP server is connected but no tools are available. Try reconnecting: ${getCliName()} mcp remove figma && ${getCliName()} mcp add figma --template`);
  }
}

/**
 * Build a specialized prompt for design-to-code workflow
 */
function buildDesignToCodePrompt(params: {
  fileId: string;
  nodeId?: string;
  framework: string;
  typescript: boolean;
  cssType: string;
  outputDir: string;
  includeTests: boolean;
  includeStorybook: boolean;
}): string {
  const { fileId, nodeId, framework, typescript, cssType, outputDir, includeTests, includeStorybook } = params;

  const nodeInfo = nodeId ? `node ID ${nodeId}` : 'the entire file';

  return `
Using the Figma MCP server, retrieve the design for:
- File ID: ${fileId}
${nodeId ? `- Node ID: ${nodeId}` : ''}

Generate a ${framework}${typescript ? ' TypeScript' : ' JavaScript'} component from ${nodeInfo} with:

**Component Requirements:**
1. Match the exact structure and layout from the Figma design
2. Use ${cssType} for styling that precisely matches the design specifications
3. Create a props interface derived from design variants (if any)
4. Include proper accessibility attributes (ARIA labels, semantic HTML, keyboard navigation)
5. Implement responsive behavior based on Figma constraints/auto-layout
${includeTests ? `6. Generate unit tests using ${framework === 'react' || framework === 'solid' ? 'Testing Library' : framework === 'vue' ? 'Vue Test Utils' : framework === 'angular' ? 'Jasmine/Karma' : 'Vitest'}` : ''}
${includeStorybook ? '7. Create Storybook stories showcasing all variants and states' : ''}

**Extract and Apply from Figma:**
- Layout system (Flexbox, Grid, Auto-layout)
- Spacing (padding, margin, gap) - use exact pixel values
- Colors - reference design tokens or use exact hex/rgb values
- Typography (font family, size, weight, line height, letter spacing)
- Border radius, shadows, effects
- Interactive states (hover, active, focus, disabled)
- Responsive breakpoints (if multiple frames exist)

**Component Structure:**
- Create clean, maintainable component code
- Use composition for complex components
- Separate concerns (logic, presentation, styles)
- Follow ${framework} best practices and conventions
${framework === 'angular' ? `
**Angular-Specific:**
- Use Angular component decorators (@Component)
- Implement proper change detection strategy
- Use Angular directives and pipes where appropriate
- Follow Angular style guide conventions
` : framework === 'solid' ? `
**Solid.js-Specific:**
- Use createSignal for reactive state
- Leverage fine-grained reactivity
- Use Show, For, and other Solid control flow components
- Follow Solid.js reactivity patterns
` : framework === 'vue' ? `
**Vue-Specific:**
- Use Composition API (setup script)
- Leverage Vue 3 reactivity (ref, reactive, computed)
- Use template syntax for clean markup
- Follow Vue 3 best practices
` : `
**React-Specific:**
- Use functional components with hooks
- Leverage useState, useEffect, useMemo where appropriate
- Follow React composition patterns
- Implement proper key props for lists
`}

**Output Location:**
Save all generated files to: ${outputDir}/

**File Structure:**
${framework === 'angular' ? `
${typescript ? `
- component-name.component.ts (component class)
- component-name.component.html (template)
- component-name.component.${cssType === 'scss' || cssType === 'tailwind' ? 'scss' : 'css'} (styles)
${includeTests ? '- component-name.component.spec.ts (unit tests)' : ''}
- index.ts (barrel export)
` : `
- component-name.component.js (component class)
- component-name.component.html (template)
- component-name.component.css (styles)
${includeTests ? '- component-name.component.spec.js (unit tests)' : ''}
- index.js (barrel export)
`}
` : framework === 'vue' ? `
- Component.vue (single-file component)
${includeTests ? `- Component.spec.${typescript ? 'ts' : 'js'} (unit tests)` : ''}
${includeStorybook ? `- Component.stories.${typescript ? 'ts' : 'js'} (Storybook stories)` : ''}
- index.${typescript ? 'ts' : 'js'} (barrel export)
` : typescript ? `
- Component.${framework === 'solid' ? 'tsx' : 'tsx'} (main component)
- Component.module.${cssType === 'modules' ? 'css' : cssType} (styles)
${includeTests ? '- Component.test.tsx (unit tests)' : ''}
${includeStorybook ? '- Component.stories.tsx (Storybook stories)' : ''}
- index.ts (barrel export)
` : `
- Component.${framework === 'solid' ? 'jsx' : 'jsx'} (main component)
- Component.module.${cssType === 'modules' ? 'css' : cssType} (styles)
${includeTests ? '- Component.test.jsx (unit tests)' : ''}
${includeStorybook ? '- Component.stories.jsx (Storybook stories)' : ''}
- index.js (barrel export)
`}

After generating the component, show me:
1. A summary of what was created
2. The component props interface
3. Any design decisions or assumptions made
4. Suggestions for improvements or next steps
  `.trim();
}

/**
 * Build a prompt for token extraction
 */
function buildTokenExtractionPrompt(params: {
  fileId: string;
  format: string;
  outputFile: string;
  categories: string[];
}): string {
  const { fileId, format, outputFile, categories } = params;

  const categoryList = categories.includes('all')
    ? 'all design tokens (colors, typography, spacing, effects, etc.)'
    : categories.join(', ');

  return `
Using the Figma MCP server, extract ${categoryList} from file ID: ${fileId}

**Requirements:**
1. Use the Figma MCP tools to retrieve all design variables/styles
2. Organize tokens by category (colors, typography, spacing, etc.)
3. Generate a ${format} file with proper formatting

**Output Format: ${format}**
${format === 'css' ? `
- CSS custom properties (CSS variables)
- Group by category with comments
- Use semantic naming (--color-primary-500, --spacing-md)
- Include fallback values where appropriate
` : ''}
${format === 'scss' ? `
- SCSS variables
- Group by category with comments
- Use semantic naming ($color-primary-500, $spacing-md)
- Include mixins for common patterns
` : ''}
${format === 'json' ? `
- Structured JSON object
- Nested by category
- Include metadata (name, value, description)
- Use camelCase for keys
` : ''}
${format === 'js' || format === 'ts' ? `
- ES module exports
- Typed objects (if TypeScript)
- Group by category
- Include JSDoc comments
` : ''}

**Token Categories:**
${categories.includes('all') || categories.includes('colors') ? `
**Colors:**
- Palette colors (primary, secondary, neutral, etc.)
- Semantic colors (success, warning, error, info)
- Text colors
- Background colors
- Border colors
` : ''}
${categories.includes('all') || categories.includes('typography') ? `
**Typography:**
- Font families
- Font sizes
- Font weights
- Line heights
- Letter spacing
` : ''}
${categories.includes('all') || categories.includes('spacing') ? `
**Spacing:**
- Padding values
- Margin values
- Gap values
- Use consistent scale (e.g., 4px, 8px, 16px, 24px...)
` : ''}
${categories.includes('all') || categories.includes('effects') ? `
**Effects:**
- Box shadows
- Text shadows
- Border radius values
- Opacity values
` : ''}

**Output:**
Save the generated tokens to: ${outputFile}

After extraction, show me:
1. Summary of extracted tokens (how many of each category)
2. Any naming conventions applied
3. Suggestions for usage in the codebase
  `.trim();
}

/**
 * Build a prompt for component generation
 */
function buildComponentGenerationPrompt(params: {
  componentName: string;
  source: string;
  fileId?: string;
  nodeId?: string;
  framework: string;
  typescript: boolean;
  cssType: string;
  outputDir: string;
}): string {
  const { componentName, source, fileId, nodeId, framework, typescript, cssType, outputDir } = params;

  if (source === 'figma') {
    if (!fileId) {
      throw new Error('Figma file ID is required when source is "figma"');
    }

    return `
Using the Figma MCP server, find and generate a component named "${componentName}":

**Search Process:**
1. Search for components in Figma file ${fileId} that match the name "${componentName}"
${nodeId ? `2. Use node ID ${nodeId} if searching by name fails` : '2. If multiple matches, show options and ask which one to use'}

**Generation:**
Generate a ${framework}${typescript ? ' TypeScript' : ''} component using ${cssType} for styling.

Follow the same requirements as design-to-code:
- Match exact Figma design
- Include all variants and states
- Proper accessibility
- Responsive behavior
- Clean, maintainable code

Save to: ${outputDir}/${componentName}/
    `.trim();
  }

  // For other sources (template, scratch)
  return `
Generate a ${framework}${typescript ? ' TypeScript' : ''} component named "${componentName}":

**Component Type:** ${source === 'template' ? 'Based on common component patterns' : 'From scratch'}

**Requirements:**
1. Create a well-structured, production-ready component
2. Use ${cssType} for styling
3. Include proper TypeScript types (if applicable)
4. Add accessibility attributes
5. Follow ${framework} best practices

**Variants to include:**
- Default state
- Hover state
- Active state
- Disabled state
- Loading state (if applicable)

Save to: ${outputDir}/${componentName}/
  `.trim();
}

/**
 * Build a prompt for visual design comparison
 */
function buildVisualComparisonPrompt(params: {
  fileId: string;
  nodeId?: string;
  filePaths: string[];
  model: string;
  exportScreenshot: boolean;
  outputFormat: string;
}): string {
  const { fileId, nodeId, filePaths, model, exportScreenshot, outputFormat } = params;

  const nodeInfo = nodeId ? ` (node ID: ${nodeId})` : '';

  return `
**Visual Design Comparison Task**

Using the Figma MCP server and ${model} vision capabilities, perform a comprehensive visual comparison between the Figma design and the current implementation.

**Step 1: Export Design from Figma**
${exportScreenshot ? `
- Use Figma MCP to export a screenshot of the design from file ${fileId}${nodeInfo}
- Export at 2x resolution for detailed comparison
- Save temporarily for vision analysis
` : `
- I will provide the Figma design screenshot separately
- File ID: ${fileId}${nodeInfo}
`}

**Step 2: Read Implementation Files**
Read and analyze the following implementation files:
${filePaths.map(path => `- ${path}`).join('\n')}

**Step 3: Visual Comparison Analysis**
Using ${model} vision model, compare the Figma design screenshot with the implementation and analyze:

**Layout & Structure:**
- Component positioning and alignment
- Grid/flexbox layout accuracy
- Spacing between elements (padding, margins)
- Element dimensions and aspect ratios
- Responsive behavior considerations

**Visual Styling:**
- Color accuracy (backgrounds, borders, text, shadows)
- Typography (font family, size, weight, line-height)
- Border radius and shape consistency
- Box shadows and elevation
- Image and icon rendering

**Component States:**
- Default state matching
- Hover state implementation
- Active state styling
- Disabled state (if applicable)
- Focus states and accessibility

**Accessibility:**
- Color contrast ratios
- ARIA attributes presence
- Semantic HTML usage
- Keyboard navigation support

**Step 4: Generate Diff Report**
Create a detailed comparison report in ${outputFormat} format with:

1. **Overall Similarity Score**: 0-100% match
2. **Critical Differences**: Issues that significantly affect visual appearance
3. **Minor Differences**: Small discrepancies that could be improved
4. **Recommendations**: Specific code changes to match design exactly
5. **Accessibility Gaps**: Missing or incorrect accessibility features

**Output Format: ${outputFormat}**
${outputFormat === 'markdown' ? `
Use clear markdown formatting with:
- Headings for sections
- Code blocks for suggested changes
- Screenshots or visual descriptions where helpful
- Bullet points for lists
` : outputFormat === 'html' ? `
Generate HTML with:
- Styled sections with headings
- Code blocks with syntax highlighting
- Side-by-side comparison tables
- Color swatches for color differences
` : `
Generate JSON with structure:
{
  "similarityScore": 0-100,
  "criticalDifferences": [...],
  "minorDifferences": [...],
  "recommendations": [...],
  "accessibilityGaps": [...]
}
`}

**Important Notes:**
- Be specific with measurements (e.g., "8px too much padding" not "padding is off")
- Reference exact color codes (#hex or rgb values)
- Suggest exact CSS changes to fix discrepancies
- Prioritize user-visible differences over minor implementation details
  `.trim();
}

/**
 * Create the frontend command group
 */
export function createFrontendCommand(): Command {
  const frontendCmd = new Command('frontend');
  frontendCmd.description('Front-end development workflows with MCP integration');

  // Design to code command
  frontendCmd
    .command('design-to-code <figma-url>')
    .description('Convert Figma designs to code')
    .option('--framework <name>', 'Target framework (react, vue, svelte, angular, solid)', 'react')
    .option('--typescript', 'Generate TypeScript', true)
    .option('--no-typescript', 'Generate JavaScript')
    .option('--css <type>', 'CSS solution (modules, styled, tailwind, emotion, scss)', 'modules')
    .option('--output <dir>', 'Output directory', 'src/components')
    .option('--test', 'Generate test files', false)
    .option('--storybook', 'Generate Storybook stories', false)
    .action(async (figmaUrl: string, options) => {
      try {
        console.log(chalk.blue.bold('\n🎨 Design-to-Code Workflow\n'));

        // Ensure Figma is connected
        await ensureFigmaConnected();

        // Parse Figma URL
        console.log(chalk.gray('Parsing Figma URL...'));
        const { fileId, nodeId } = parseFigmaUrl(figmaUrl);

        console.log(chalk.green(`✓ File ID: ${fileId}`));
        if (nodeId) {
          console.log(chalk.green(`✓ Node ID: ${nodeId}`));
        }
        console.log();

        // Build the prompt
        const prompt = buildDesignToCodePrompt({
          fileId,
          nodeId,
          framework: options.framework,
          typescript: options.typescript,
          cssType: options.css,
          outputDir: options.output,
          includeTests: options.test,
          includeStorybook: options.storybook
        });

        // Display configuration
        console.log(chalk.blue('Configuration:'));
        console.log(chalk.gray(`  Framework: ${options.framework}`));
        console.log(chalk.gray(`  Language: ${options.typescript ? 'TypeScript' : 'JavaScript'}`));
        console.log(chalk.gray(`  Styling: ${options.css}`));
        console.log(chalk.gray(`  Output: ${options.output}/`));
        console.log(chalk.gray(`  Tests: ${options.test ? 'Yes' : 'No'}`));
        console.log(chalk.gray(`  Storybook: ${options.storybook ? 'Yes' : 'No'}`));
        console.log();

        // Show the prompt that will be sent to the AI
        console.log(chalk.blue('🤖 Sending request to AI agent...\n'));

        // In a real implementation, this would call the LLMAgent
        // For now, show the prompt
        console.log(chalk.yellow('Prompt to be executed:'));
        console.log(chalk.gray('─'.repeat(80)));
        console.log(prompt);
        console.log(chalk.gray('─'.repeat(80)));
        console.log();

        console.log(chalk.green('✅ To execute this workflow, run:'));
        console.log(chalk.cyan(`   ${getCliName()} -p "${prompt.substring(0, 100)}..."`));
        console.log();

      } catch (error: unknown) {
        console.error(chalk.red(`\n❌ Error: ${extractErrorMessage(error)}\n`));
        process.exit(1);
      }
    });

  // Extract tokens command
  frontendCmd
    .command('extract-tokens <file-id>')
    .description('Extract design tokens from Figma')
    .option('--format <type>', 'Output format (css, scss, json, js, ts)', 'css')
    .option('--output <file>', 'Output file path', 'src/styles/design-tokens.css')
    .option('--categories <list>', 'Token categories (colors, typography, spacing, effects, all)', 'all')
    .action(async (fileId: string, options) => {
      try {
        console.log(chalk.blue.bold('\n🎨 Design Token Extraction\n'));

        // Ensure Figma is connected
        await ensureFigmaConnected();

        // Parse categories
        const categories = options.categories.split(',').map((c: string) => c.trim());

        // Build the prompt
        const prompt = buildTokenExtractionPrompt({
          fileId,
          format: options.format,
          outputFile: options.output,
          categories
        });

        // Display configuration
        console.log(chalk.blue('Configuration:'));
        console.log(chalk.gray(`  File ID: ${fileId}`));
        console.log(chalk.gray(`  Format: ${options.format}`));
        console.log(chalk.gray(`  Output: ${options.output}`));
        console.log(chalk.gray(`  Categories: ${categories.join(', ')}`));
        console.log();

        console.log(chalk.blue('🤖 Sending request to AI agent...\n'));

        // Show the prompt
        console.log(chalk.yellow('Prompt to be executed:'));
        console.log(chalk.gray('─'.repeat(80)));
        console.log(prompt);
        console.log(chalk.gray('─'.repeat(80)));
        console.log();

        console.log(chalk.green('✅ To execute this workflow, run:'));
        console.log(chalk.cyan(`   ${getCliName()} -p "${prompt.substring(0, 100)}..."`));
        console.log();

      } catch (error: unknown) {
        console.error(chalk.red(`\n❌ Error: ${extractErrorMessage(error)}\n`));
        process.exit(1);
      }
    });

  // Generate component command
  frontendCmd
    .command('gen-component <name>')
    .description('Generate a component from Figma or template')
    .option('--source <type>', 'Component source (figma, template, scratch)', 'figma')
    .option('--file-id <id>', 'Figma file ID (required if source is figma)')
    .option('--node-id <id>', 'Figma node ID (optional)')
    .option('--framework <name>', 'Target framework (react, vue, svelte, angular, solid)', 'react')
    .option('--typescript', 'Generate TypeScript', true)
    .option('--no-typescript', 'Generate JavaScript')
    .option('--css <type>', 'CSS solution (modules, styled, tailwind, emotion)', 'modules')
    .option('--output <dir>', 'Output directory', 'src/components')
    .action(async (name: string, options) => {
      try {
        console.log(chalk.blue.bold(`\n🔧 Component Generation: ${name}\n`));

        // If source is figma, ensure it's connected
        if (options.source === 'figma') {
          await ensureFigmaConnected();

          if (!options.fileId) {
            console.error(chalk.red('❌ --file-id is required when source is "figma"'));
            console.log();
            console.log(chalk.blue('Usage:'));
            console.log(chalk.cyan(`  ${getCliName()} frontend gen-component ${name} --source figma --file-id abc123xyz`));
            console.log();
            process.exit(1);
          }
        }

        // Build the prompt
        const prompt = buildComponentGenerationPrompt({
          componentName: name,
          source: options.source,
          fileId: options.fileId,
          nodeId: options.nodeId,
          framework: options.framework,
          typescript: options.typescript,
          cssType: options.css,
          outputDir: options.output
        });

        // Display configuration
        console.log(chalk.blue('Configuration:'));
        console.log(chalk.gray(`  Component: ${name}`));
        console.log(chalk.gray(`  Source: ${options.source}`));
        if (options.fileId) {
          console.log(chalk.gray(`  Figma File: ${options.fileId}`));
        }
        if (options.nodeId) {
          console.log(chalk.gray(`  Figma Node: ${options.nodeId}`));
        }
        console.log(chalk.gray(`  Framework: ${options.framework}`));
        console.log(chalk.gray(`  Language: ${options.typescript ? 'TypeScript' : 'JavaScript'}`));
        console.log(chalk.gray(`  Styling: ${options.css}`));
        console.log(chalk.gray(`  Output: ${options.output}/${name}/`));
        console.log();

        console.log(chalk.blue('🤖 Sending request to AI agent...\n'));

        // Show the prompt
        console.log(chalk.yellow('Prompt to be executed:'));
        console.log(chalk.gray('─'.repeat(80)));
        console.log(prompt);
        console.log(chalk.gray('─'.repeat(80)));
        console.log();

        console.log(chalk.green('✅ To execute this workflow, run:'));
        console.log(chalk.cyan(`   ${getCliName()} -p "${prompt.substring(0, 100)}..."`));
        console.log();

      } catch (error: unknown) {
        console.error(chalk.red(`\n❌ Error: ${extractErrorMessage(error)}\n`));
        process.exit(1);
      }
    });

  // Compare design command with visual comparison
  frontendCmd
    .command('compare-design <figma-url>')
    .description('Compare implementation with Figma design using visual AI')
    .option('--file <path>', 'Implementation file(s) to compare (comma-separated)', 'src/components')
    .option('--model <name>', 'Vision model to use', getActiveProvider().defaultVisionModel || 'glm-4.6v')
    .option('--export-screenshot', 'Export screenshot from Figma', true)
    .option('--format <type>', 'Output format (markdown, html, json)', 'markdown')
    .action(async (figmaUrl: string, options) => {
      try {
        console.log(chalk.blue.bold('\n🔍 Visual Design Comparison\n'));

        // Validate Figma connection
        await ensureFigmaConnected();

        // Parse Figma URL
        const { fileId, nodeId } = parseFigmaUrl(figmaUrl);

        // Split file paths if multiple
        const filePaths = options.file.split(',').map((f: string) => f.trim());

        // Build the visual comparison prompt
        const prompt = buildVisualComparisonPrompt({
          fileId,
          nodeId,
          filePaths,
          model: options.model,
          exportScreenshot: options.exportScreenshot,
          outputFormat: options.format
        });

        // Display configuration
        console.log(chalk.blue('Configuration:'));
        console.log(chalk.gray(`  Figma File ID: ${fileId}`));
        if (nodeId) {
          console.log(chalk.gray(`  Figma Node ID: ${nodeId}`));
        }
        console.log(chalk.gray(`  Implementation Files: ${filePaths.join(', ')}`));
        console.log(chalk.gray(`  Vision Model: ${options.model}`));
        console.log(chalk.gray(`  Export Screenshot: ${options.exportScreenshot ? 'Yes' : 'No'}`));
        console.log(chalk.gray(`  Output Format: ${options.format}`));
        console.log();

        console.log(chalk.blue('🤖 Sending request to AI agent with vision capabilities...\n'));

        // Show the prompt
        console.log(chalk.yellow('Visual Comparison Prompt:'));
        console.log(chalk.gray('─'.repeat(80)));
        console.log(prompt);
        console.log(chalk.gray('─'.repeat(80)));
        console.log();

        console.log(chalk.green('✅ To execute this visual comparison, run:'));
        console.log(chalk.cyan(`   ${getCliName()} -p "${prompt.substring(0, 100)}..." --model ${options.model}`));
        console.log();

        console.log(chalk.blue('📋 What this will do:'));
        console.log(chalk.gray('  1. Export screenshot from Figma design'));
        console.log(chalk.gray('  2. Read your implementation files'));
        console.log(chalk.gray('  3. Use GLM-4.6V vision model to compare visual appearance'));
        console.log(chalk.gray('  4. Generate detailed difference report'));
        console.log();

      } catch (error: unknown) {
        console.error(chalk.red(`\n❌ Error: ${extractErrorMessage(error)}\n`));
        process.exit(1);
      }
    });

  return frontendCmd;
}
