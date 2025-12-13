/**
 * Z.AI MCP command handlers
 *
 * Extracted from mcp.ts for better maintainability.
 */

import chalk from 'chalk';
import {
  ZAI_SERVER_NAMES,
  ZAI_MCP_TEMPLATES,
  generateZAIServerConfig,
  getAllZAIServerNames,
  isZAIServer,
  detectZAIServices,
  getZAIApiKey,
  getRecommendedServers,
  formatZAIStatus,
  type ZAIServerName,
} from '../../mcp/index.js';
import { addUserMCPServer, removeUserMCPServer } from '../../mcp/config.js';
import { getMCPManager } from '../../llm/tools.js';
import { extractErrorMessage } from '../../utils/error-handler.js';
import { getActiveProvider } from '../../provider/config.js';

/**
 * Get CLI name from active provider
 */
function getCliName(): string {
  return getActiveProvider().branding.cliName;
}

/**
 * Result of Z.AI status check
 */
export interface ZAIStatusResult {
  success: boolean;
  status?: Awaited<ReturnType<typeof detectZAIServices>>;
  error?: string;
}

/**
 * Handle 'mcp status-zai' command
 */
export async function handleStatusZai(options: { json?: boolean }): Promise<void> {
  const status = await detectZAIServices();

  if (options.json) {
    console.log(JSON.stringify(status, null, 2));
    return;
  }

  console.log(formatZAIStatus(status));
  console.log();

  // Show recommendations
  if (!status.hasApiKey) {
    console.log(chalk.yellow('To get started with Z.AI MCP:'));
    console.log(chalk.gray('  1. Get an API key from https://z.ai'));
    console.log(chalk.gray(`  2. Set it: ${getCliName()} config set apiKey YOUR_API_KEY`));
    console.log(chalk.gray(`  3. Enable servers: ${getCliName()} mcp add-zai`));
    console.log();
  } else if (status.enabledServers.length === 0) {
    console.log(chalk.blue('API key configured. Enable Z.AI MCP servers with:'));
    console.log(chalk.cyan(`  ${getCliName()} mcp add-zai`));
    console.log();
  }
}

/**
 * Result of add-zai operation
 */
export interface AddZaiResult {
  success: boolean;
  serversAdded: string[];
  serversFailed: string[];
  error?: string;
}

/**
 * Handle 'mcp add-zai' command
 */
export async function handleAddZai(options: {
  all?: boolean;
  server?: string[];
  apiKey?: string;
}): Promise<AddZaiResult> {
  console.log(chalk.blue.bold('\nSetting up Z.AI MCP Servers\n'));

  // Get API key
  const apiKey = options.apiKey || getZAIApiKey();

  if (!apiKey) {
    console.error(chalk.red('No Z.AI API key found\n'));
    console.log(chalk.gray('Provide an API key using one of these methods:'));
    console.log(chalk.gray('  --api-key <key> flag'));
    console.log(chalk.gray('  ax-cli config set apiKey YOUR_API_KEY'));
    console.log(chalk.gray('  Set YOUR_API_KEY or Z_AI_API_KEY environment variable'));
    console.log();
    console.log(chalk.blue('Get your API key at: https://z.ai'));
    console.log();
    return { success: false, serversAdded: [], serversFailed: [], error: 'No API key' };
  }

  // Detect current status
  const status = await detectZAIServices();

  // Determine which servers to add
  let serversToAdd: ZAIServerName[];

  if (options.server && options.server.length > 0) {
    serversToAdd = options.server.filter((s): s is ZAIServerName => isZAIServer(s));
    const invalidServers = options.server.filter(s => !isZAIServer(s));

    if (invalidServers.length > 0) {
      console.log(chalk.yellow(`Unknown server(s): ${invalidServers.join(', ')}`));
      console.log(chalk.gray(`Available: ${getAllZAIServerNames().join(', ')}`));
      console.log();
    }
  } else if (options.all) {
    serversToAdd = getAllZAIServerNames();
  } else {
    // Default: recommended servers based on system
    serversToAdd = getRecommendedServers(status);
  }

  // Filter out already enabled
  const newServers = serversToAdd.filter(s => !status.enabledServers.includes(s));

  if (newServers.length === 0) {
    console.log(chalk.yellow('All requested Z.AI servers are already configured\n'));
    console.log(chalk.gray('Enabled servers:'));
    status.enabledServers.forEach(s => console.log(chalk.green(`  ${s}`)));
    console.log();
    return { success: true, serversAdded: [], serversFailed: [] };
  }

  // Check Node.js version for vision
  const filteredServers = filterVisionIfNeeded(newServers, status);

  if (filteredServers.length === 0) {
    console.log(chalk.yellow('No servers to add after filtering.\n'));
    return { success: true, serversAdded: [], serversFailed: [] };
  }

  // Add each server
  const manager = getMCPManager();
  const serversAdded: string[] = [];
  const serversFailed: string[] = [];

  for (const serverName of filteredServers) {
    const template = ZAI_MCP_TEMPLATES[serverName];
    console.log(chalk.blue(`Adding ${template.displayName}...`));
    console.log(chalk.gray(`  ${template.description}`));

    try {
      const config = generateZAIServerConfig(serverName, apiKey);
      await manager.addServer(config);
      addUserMCPServer(config);

      const tools = manager.getTools().filter(t => t.serverName === serverName);
      console.log(chalk.green(`  Connected (${tools.length} tool${tools.length !== 1 ? 's' : ''})`));
      serversAdded.push(serverName);
    } catch (error) {
      console.log(chalk.red(`  Failed: ${extractErrorMessage(error)}`));
      serversFailed.push(serverName);
    }
    console.log();
  }

  // Summary
  if (serversAdded.length > 0) {
    console.log(chalk.green.bold(`${serversAdded.length} Z.AI MCP server${serversAdded.length !== 1 ? 's' : ''} enabled!\n`));
    console.log(chalk.gray('Available tools:'));
    const allTools = manager.getTools().filter(t =>
      serversAdded.some(s => t.serverName === s)
    );
    allTools.forEach(tool => {
      console.log(chalk.gray(`  ${tool.name.replace('mcp__', '').replace('__', '/')}`));
    });
    console.log();
  }

  return {
    success: serversFailed.length === 0,
    serversAdded,
    serversFailed
  };
}

/**
 * Filter out vision server if Node.js version is too low
 */
function filterVisionIfNeeded(
  servers: ZAIServerName[],
  status: Awaited<ReturnType<typeof detectZAIServices>>
): ZAIServerName[] {
  const result = [...servers];

  if (result.includes(ZAI_SERVER_NAMES.VISION) && !status.nodeVersionOk) {
    console.log(chalk.yellow(`Vision server requires Node.js 22+, you have v${status.nodeVersion}`));
    console.log(chalk.gray('  Skipping vision server. Update Node.js to enable it.'));
    const visionIndex = result.indexOf(ZAI_SERVER_NAMES.VISION);
    if (visionIndex > -1) {
      result.splice(visionIndex, 1);
    }
    console.log();
  }

  return result;
}

/**
 * Result of remove-zai operation
 */
export interface RemoveZaiResult {
  success: boolean;
  serversRemoved: string[];
  serversFailed: string[];
}

/**
 * Handle 'mcp remove-zai' command
 */
export async function handleRemoveZai(options: {
  all?: boolean;
  server?: string[];
}): Promise<RemoveZaiResult> {
  console.log(chalk.blue.bold('\nRemoving Z.AI MCP Servers\n'));

  const status = await detectZAIServices();

  if (status.enabledServers.length === 0) {
    console.log(chalk.yellow('No Z.AI MCP servers are currently configured.\n'));
    return { success: true, serversRemoved: [], serversFailed: [] };
  }

  // Determine which servers to remove
  let serversToRemove: ZAIServerName[];

  if (options.server && options.server.length > 0) {
    serversToRemove = options.server.filter((s): s is ZAIServerName =>
      isZAIServer(s) && status.enabledServers.includes(s as ZAIServerName)
    );

    const notEnabled = options.server.filter(s =>
      isZAIServer(s) && !status.enabledServers.includes(s as ZAIServerName)
    );

    if (notEnabled.length > 0) {
      console.log(chalk.yellow(`Server(s) not enabled: ${notEnabled.join(', ')}`));
    }
  } else {
    // Default: remove all
    serversToRemove = [...status.enabledServers];
  }

  if (serversToRemove.length === 0) {
    console.log(chalk.yellow('No matching servers to remove.\n'));
    return { success: true, serversRemoved: [], serversFailed: [] };
  }

  // Remove each server
  const manager = getMCPManager();
  const serversRemoved: string[] = [];
  const serversFailed: string[] = [];

  for (const serverName of serversToRemove) {
    const template = ZAI_MCP_TEMPLATES[serverName];
    console.log(chalk.blue(`Removing ${template.displayName}...`));

    try {
      await manager.removeServer(serverName);
      removeUserMCPServer(serverName);
      console.log(chalk.green('  Removed'));
      serversRemoved.push(serverName);
    } catch (error) {
      console.log(chalk.red(`  Failed: ${extractErrorMessage(error)}`));
      serversFailed.push(serverName);
    }
  }

  console.log();

  if (serversRemoved.length > 0) {
    console.log(chalk.green(`${serversRemoved.length} Z.AI MCP server${serversRemoved.length !== 1 ? 's' : ''} removed.\n`));
  }

  return {
    success: serversFailed.length === 0,
    serversRemoved,
    serversFailed
  };
}
