/**
 * MCP command handlers - extracted from mcp.ts for testability and maintainability
 *
 * Each handler is a pure-ish function that can be tested independently.
 */

import chalk from 'chalk';
import * as prompts from '@clack/prompts';
import { MCPServerIdSchema } from '@defai.digital/ax-schemas';
import {
  addMCPServer,
  getTemplate,
  generateConfigFromTemplate,
  PREDEFINED_SERVERS,
} from '../../mcp/config.js';
import { getMCPManager } from '../../llm/tools.js';
import { ConsoleMessenger } from '../../utils/console-messenger.js';
import { getTemplateNames } from '../../mcp/templates.js';
import { getActiveProvider } from '../../provider/config.js';
import type { MCPServerConfig } from '../../mcp/client.js';

/**
 * Get CLI name from active provider
 */
export function getCliName(): string {
  return getActiveProvider().branding.cliName;
}

/**
 * Parse environment variables from CLI options
 * Handles values that contain '=' correctly
 */
export function parseEnvVars(envOptions: string[]): Record<string, string> {
  const env: Record<string, string> = {};
  for (const envVar of envOptions) {
    const eqIndex = envVar.indexOf('=');
    if (eqIndex > 0) {
      const key = envVar.slice(0, eqIndex);
      const value = envVar.slice(eqIndex + 1);
      env[key] = value;
    }
  }
  return env;
}

/**
 * Parse headers from CLI options
 */
export function parseHeaders(headerOptions: string[]): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const header of headerOptions) {
    const eqIndex = header.indexOf('=');
    if (eqIndex > 0) {
      const key = header.slice(0, eqIndex);
      const value = header.slice(eqIndex + 1);
      headers[key] = value;
    } else {
      ConsoleMessenger.warning('mcp_commands.warning_invalid_header', { header });
    }
  }
  return headers;
}

/**
 * Result of template setup
 */
export interface TemplateSetupResult {
  success: boolean;
  config?: MCPServerConfig;
  error?: string;
}

/**
 * Set up a server from template
 */
export async function setupFromTemplate(
  name: string,
  cliEnvVars: Record<string, string>,
  interactive: boolean
): Promise<TemplateSetupResult> {
  const template = getTemplate(name);
  if (!template) {
    console.error(chalk.red(`Template "${name}" not found`));
    console.log();
    console.log(chalk.blue('Available templates:'));
    const templateNames = getTemplateNames();
    templateNames.forEach(t => {
      const tmpl = getTemplate(t);
      console.log(`  ${chalk.bold(t)} - ${tmpl?.description}`);
    });
    return { success: false, error: 'Template not found' };
  }

  // Display template information
  console.log(chalk.blue(`\nSetting up ${chalk.bold(template.name)} MCP server`));
  console.log(chalk.gray(template.description));
  console.log();

  // Check required environment variables
  const envVars: Record<string, string> = {};
  const missingEnvVarsList: Array<{ name: string; description: string; url?: string }> = [];

  for (const envVar of template.requiredEnv) {
    const value = cliEnvVars[envVar.name] || process.env[envVar.name];
    if (!value) {
      missingEnvVarsList.push(envVar);
    } else {
      envVars[envVar.name] = value;
    }
  }

  if (missingEnvVarsList.length > 0) {
    if (interactive) {
      console.log(chalk.yellow('Missing required environment variables. Prompting for values...\n'));

      for (const envVar of missingEnvVarsList) {
        console.log(chalk.gray(`   ${envVar.description}`));
        if (envVar.url) {
          console.log(chalk.gray(`   Documentation: ${envVar.url}`));
        }

        const response = await prompts.text({
          message: `Enter ${envVar.name}:`,
          placeholder: 'Paste your token here',
          validate: (value) => {
            if (!value || value.trim().length === 0) {
              return `${envVar.name} is required`;
            }
            return undefined;
          }
        });

        if (prompts.isCancel(response)) {
          console.log(chalk.yellow('\nSetup cancelled by user.\n'));
          return { success: false, error: 'Cancelled by user' };
        }

        envVars[envVar.name] = response as string;
        console.log();
      }
    } else {
      // Non-interactive mode - show error with options
      printMissingEnvVarsError(name, missingEnvVarsList, template.setupInstructions);
      return { success: false, error: 'Missing required environment variables' };
    }
  }

  // Generate config from template
  const config = generateConfigFromTemplate(name, envVars);
  return { success: true, config };
}

/**
 * Print error message for missing environment variables
 */
function printMissingEnvVarsError(
  name: string,
  missingVars: Array<{ name: string; description: string; url?: string }>,
  setupInstructions: string
): void {
  console.log(chalk.yellow('Missing required environment variables:\n'));
  for (const envVar of missingVars) {
    console.log(chalk.yellow(`   ${chalk.bold(envVar.name)}`));
    console.log(chalk.gray(`     ${envVar.description}`));
    if (envVar.url) {
      console.log(chalk.gray(`     Documentation: ${envVar.url}`));
    }
    console.log();
  }

  console.log(chalk.red('Setup cannot continue without required environment variables.\n'));
  console.log(chalk.blue('Options to provide the missing variables:\n'));

  const cliName = getCliName();

  // Option 1: Interactive mode
  console.log(chalk.white('  Option 1: Use interactive mode (easiest):'));
  console.log(chalk.cyan(`    ${cliName} mcp add ${name} --template --interactive\n`));

  // Option 2: Pass directly via --env flag
  const envFlags = missingVars.map(e => `--env ${e.name}=YOUR_VALUE`).join(' ');
  console.log(chalk.white('  Option 2: Pass directly with --env flag:'));
  console.log(chalk.cyan(`    ${cliName} mcp add ${name} --template ${envFlags}\n`));

  // Option 3: Export in current shell
  console.log(chalk.white('  Option 3: Export in current shell:'));
  for (const envVar of missingVars) {
    console.log(chalk.cyan(`    export ${envVar.name}="your_value"`));
  }
  console.log(chalk.cyan(`    ${cliName} mcp add ${name} --template\n`));

  // Option 4: Add to shell profile
  console.log(chalk.white('  Option 4: Add to shell profile (~/.bashrc or ~/.zshrc):'));
  for (const envVar of missingVars) {
    console.log(chalk.cyan(`    export ${envVar.name}="your_value"`));
  }
  console.log(chalk.gray('    Then restart your terminal or run: source ~/.zshrc\n'));

  console.log(chalk.blue('Full setup instructions:'));
  console.log(setupInstructions);
}

/**
 * Connect to server and show available tools
 */
export async function connectAndShowTools(
  config: MCPServerConfig,
  serverName: string
): Promise<void> {
  addMCPServer(config);
  console.log(chalk.green('Configuration saved'));

  console.log(chalk.blue('Connecting to server...'));
  const manager = getMCPManager();
  await manager.addServer(config);
  console.log(chalk.green('Connected successfully'));

  const tools = manager.getTools().filter(t => t.serverName === serverName);
  console.log(chalk.blue(`\nAvailable tools: ${chalk.bold(tools.length.toString())}`));
  if (tools.length > 0 && tools.length <= 10) {
    tools.forEach(tool => {
      const displayName = tool.name.replace(`mcp__${serverName}__`, '');
      console.log(`   ${displayName}: ${tool.description}`);
    });
  }
}

/**
 * Build custom server config from CLI options
 */
export function buildCustomServerConfig(
  name: string,
  options: {
    transport: string;
    command?: string;
    args?: string[];
    url?: string;
    env?: string[];
    headers?: string[];
  }
): MCPServerConfig | null {
  const transportType = options.transport.toLowerCase();

  // Validate transport requirements
  if (transportType === 'stdio') {
    if (!options.command) {
      ConsoleMessenger.error('mcp_commands.error_command_required');
      return null;
    }
  } else if (transportType === 'http' || transportType === 'sse' || transportType === 'streamable_http') {
    if (!options.url) {
      ConsoleMessenger.error('mcp_commands.error_url_required', { transport: transportType });
      return null;
    }
  } else {
    ConsoleMessenger.error('mcp_commands.error_invalid_transport');
    return null;
  }

  const env = parseEnvVars(options.env || []);
  const headers = parseHeaders(options.headers || []);

  return {
    name: MCPServerIdSchema.parse(name),
    transport: {
      type: transportType as 'stdio' | 'http' | 'sse' | 'streamable_http',
      command: options.command,
      args: options.args || [],
      url: options.url,
      env,
      headers: Object.keys(headers).length > 0 ? headers : undefined
    }
  };
}

/**
 * Display server list with connection status
 */
export function displayServerList(
  servers: MCPServerConfig[],
  manager: ReturnType<typeof getMCPManager>,
  shouldConnect: boolean
): void {
  ConsoleMessenger.bold('mcp_commands.list_header');
  console.log();

  for (const server of servers) {
    const isConnected = manager.getServers().includes(server.name);
    const statusMsg = isConnected
      ? chalk.green('Connected')
      : shouldConnect
        ? chalk.red('Failed to connect')
        : chalk.yellow('Not connected (run without --no-connect to test)');

    console.log(`${chalk.bold(server.name)}: ${statusMsg}`);

    // Display transport information
    if (server.transport) {
      console.log(`  Transport: ${server.transport.type}`);
      if (server.transport.type === 'stdio') {
        console.log(`  Command: ${server.transport.command} ${(server.transport.args || []).join(' ')}`);
      } else if (server.transport.type === 'http' || server.transport.type === 'sse') {
        console.log(`  URL: ${server.transport.url}`);
      }
    } else if (server.command) {
      // Legacy format
      console.log(`  Command: ${server.command} ${(server.args || []).join(' ')}`);
    }

    if (isConnected) {
      const transportType = manager.getTransportType(server.name);
      if (transportType) {
        console.log(`  Active Transport: ${transportType}`);
      }

      const tools = manager.getTools().filter(t => t.serverName === server.name);
      console.log(`  Tools: ${tools.length}`);
      if (tools.length > 0) {
        tools.forEach(tool => {
          const displayName = tool.name.replace(`mcp__${server.name}__`, '');
          console.log(`    - ${displayName}: ${tool.description}`);
        });
      }
    }

    console.log();
  }
}

/**
 * Try to add a server from legacy PREDEFINED_SERVERS (for backwards compatibility)
 */
export async function tryLegacyPredefinedServer(name: string): Promise<boolean> {
  if (!PREDEFINED_SERVERS[name]) {
    return false;
  }

  const template = PREDEFINED_SERVERS[name];
  console.log(chalk.yellow(`Tip: Use ${chalk.bold('--template')} flag for guided setup`));

  const config = template.config;
  addMCPServer(config);
  ConsoleMessenger.plain('mcp_commands.server_predefined', { name });

  const manager = getMCPManager();
  await manager.addServer(config);
  ConsoleMessenger.plain('mcp_commands.server_connected', { name });

  const tools = manager.getTools().filter(t => t.serverName === name);
  ConsoleMessenger.plain('mcp_commands.tools_available', { count: tools.length });

  return true;
}
