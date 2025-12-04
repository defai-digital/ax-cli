import { Command } from 'commander';
import { addMCPServer, removeMCPServer, loadMCPConfig, PREDEFINED_SERVERS, getTemplate, generateConfigFromTemplate } from '../mcp/config.js';
import { getTemplateNames, getTemplatesByCategory } from '../mcp/templates.js';
import { getMCPManager } from '../llm/tools.js';
import { MCPServerConfig } from '../mcp/client.js';
import { MCPServerIdSchema } from '@ax-cli/schemas';
import chalk from 'chalk';
import { ConsoleMessenger } from '../utils/console-messenger.js';
import { extractErrorMessage } from '../utils/error-handler.js';
import { validateServerConfig, formatValidationResult } from '../mcp/validation.js';
import { listAllResources, listServerResources, searchResources } from '../mcp/resources.js';
import {
  searchRegistry,
  getRegistryServer,
  getPopularServers,
  generateConfigFromRegistry,
  formatRegistryServer,
  type RegistrySearchOptions
} from '../mcp/registry.js';
import type { ServerHealth } from '../mcp/health.js';
import { MCP_CONFIG } from '../constants.js';
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
} from '../mcp/index.js';

const VALID_TEMPLATE_CATEGORIES = ['design', 'deployment', 'testing', 'monitoring', 'backend', 'version-control'] as const;
type TemplateCategory = typeof VALID_TEMPLATE_CATEGORIES[number];

function isValidTemplateCategory(category: unknown): category is TemplateCategory {
  return typeof category === 'string' && (VALID_TEMPLATE_CATEGORIES as readonly string[]).includes(category);
}

function filterValidHealth(health: Array<ServerHealth | null>): ServerHealth[] {
  return health.filter((item): item is ServerHealth => Boolean(item));
}

export function createMCPCommand(): Command {
  const mcpCommand = new Command('mcp');
  mcpCommand.description('Manage MCP (Model Context Protocol) servers');

  // Add server command
  mcpCommand
    .command('add <name>')
    .description('Add an MCP server')
    .option('--template', 'Use pre-configured template for this server')
    .option('--interactive', 'Prompt for required environment variables')
    .option('-t, --transport <type>', 'Transport type (stdio, http, sse, streamable_http)', 'stdio')
    .option('-c, --command <command>', 'Command to run the server (for stdio transport)')
    .option('-a, --args [args...]', 'Arguments for the server command (for stdio transport)', [])
    .option('-u, --url <url>', 'URL for HTTP/SSE transport')
    .option('-h, --headers [headers...]', 'HTTP headers (key=value format)', [])
    .option('-e, --env [env...]', 'Environment variables (key=value format)', [])
    .action(async (name: string, options) => {
      try {
        // Check if using template
        if (options.template) {
          const template = getTemplate(name);
          if (!template) {
            console.error(chalk.red(`❌ Template "${name}" not found`));
            console.log();
            console.log(chalk.blue('Available templates:'));
            const templateNames = getTemplateNames();
            templateNames.forEach(t => {
              const tmpl = getTemplate(t);
              console.log(`  ${chalk.bold(t)} - ${tmpl?.description}`);
            });
            process.exit(1);
          }

          // Display template information
          console.log(chalk.blue(`\n📦 Setting up ${chalk.bold(template.name)} MCP server`));
          console.log(chalk.gray(template.description));
          console.log();

          // Check required environment variables
          const envVars: Record<string, string> = {};
          let missingEnvVars = false;

          for (const envVar of template.requiredEnv) {
            const value = process.env[envVar.name];
            if (!value) {
              console.log(chalk.yellow(`⚠️  Missing environment variable: ${chalk.bold(envVar.name)}`));
              console.log(chalk.gray(`   ${envVar.description}`));
              if (envVar.url) {
                console.log(chalk.gray(`   More info: ${envVar.url}`));
              }
              console.log();
              missingEnvVars = true;
            } else {
              envVars[envVar.name] = value;
            }
          }

          if (missingEnvVars) {
            console.log(chalk.red('❌ Setup cannot continue without required environment variables.'));
            console.log();
            console.log(chalk.blue('Setup instructions:'));
            console.log(template.setupInstructions);
            process.exit(1);
          }

          // Generate config from template
          const config = generateConfigFromTemplate(name, envVars);

          // Add to configuration
          addMCPServer(config);
          console.log(chalk.green(`✅ Configuration saved`));

          // Try to connect immediately
          console.log(chalk.blue('🔌 Connecting to server...'));
          const manager = getMCPManager();
          await manager.addServer(config);
          console.log(chalk.green('✅ Connected successfully'));

          // Show available tools
          const tools = manager.getTools().filter(t => t.serverName === name);
          console.log(chalk.blue(`\n🔧 Available tools: ${chalk.bold(tools.length.toString())}`));
          if (tools.length > 0 && tools.length <= 10) {
            tools.forEach(tool => {
              const displayName = tool.name.replace(`mcp__${name}__`, '');
              console.log(`   • ${chalk.bold(displayName)}: ${tool.description}`);
            });
          }

          // Show usage examples
          if (template.usageExamples.length > 0) {
            console.log(chalk.blue('\n💡 Usage examples:'));
            template.usageExamples.slice(0, 3).forEach(example => {
              console.log(chalk.gray(`   • ${example}`));
            });
          }

          console.log(chalk.green(`\n✨ ${name} MCP server is ready to use!`));
          return;
        }

        // Check if it's a predefined server (legacy support)
        if (PREDEFINED_SERVERS[name]) {
          const template = PREDEFINED_SERVERS[name];
          console.log(chalk.yellow(`💡 Tip: Use ${chalk.bold('--template')} flag for guided setup`));

          const config = template.config;
          addMCPServer(config);
          ConsoleMessenger.plain('mcp_commands.server_predefined', { name });

          // Try to connect immediately
          const manager = getMCPManager();
          await manager.addServer(config);
          ConsoleMessenger.plain('mcp_commands.server_connected', { name });

          const tools = manager.getTools().filter(t => t.serverName === name);
          ConsoleMessenger.plain('mcp_commands.tools_available', { count: tools.length });

          return;
        }

        // Custom server
        const transportType = options.transport.toLowerCase();
        
        if (transportType === 'stdio') {
          if (!options.command) {
            ConsoleMessenger.error('mcp_commands.error_command_required');
            process.exit(1);
          }
        } else if (transportType === 'http' || transportType === 'sse' || transportType === 'streamable_http') {
          if (!options.url) {
            ConsoleMessenger.error('mcp_commands.error_url_required', { transport: transportType });
            process.exit(1);
          }
        } else {
          ConsoleMessenger.error('mcp_commands.error_invalid_transport');
          process.exit(1);
        }

        // Parse environment variables (handle values with = in them)
        const env: Record<string, string> = {};
        for (const envVar of options.env || []) {
          const eqIndex = envVar.indexOf('=');
          if (eqIndex > 0) {
            const key = envVar.slice(0, eqIndex);
            const value = envVar.slice(eqIndex + 1);
            env[key] = value;
          } else {
            ConsoleMessenger.warning('mcp_commands.warning_invalid_env', { envVar });
          }
        }

        // Parse headers (handle values with = in them)
        const headers: Record<string, string> = {};
        for (const header of options.headers || []) {
          const eqIndex = header.indexOf('=');
          if (eqIndex > 0) {
            const key = header.slice(0, eqIndex);
            const value = header.slice(eqIndex + 1);
            headers[key] = value;
          } else {
            ConsoleMessenger.warning('mcp_commands.warning_invalid_header', { header });
          }
        }

        const config = {
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

        addMCPServer(config);
        ConsoleMessenger.plain('mcp_commands.server_added', { name });

        // Try to connect immediately
        const manager = getMCPManager();
        await manager.addServer(config);
        ConsoleMessenger.plain('mcp_commands.server_connected', { name });

        const tools = manager.getTools().filter(t => t.serverName === name);
        ConsoleMessenger.plain('mcp_commands.tools_available', { count: tools.length });

      } catch (error: unknown) {
        ConsoleMessenger.error('mcp_commands.error_adding_server', { error: extractErrorMessage(error) });
        process.exit(1);
      }
    });

  // Add server from JSON command
  mcpCommand
    .command('add-json <name> <json>')
    .description('Add an MCP server from JSON configuration')
    .action(async (name: string, jsonConfig: string) => {
      try {
        let config;
        try {
          config = JSON.parse(jsonConfig);
        } catch {
          ConsoleMessenger.error('mcp_commands.error_invalid_json');
          process.exit(1);
        }

        const serverConfig: MCPServerConfig = {
          name: MCPServerIdSchema.parse(name),
          transport: {
            type: 'stdio', // default
            command: config.command,
            args: config.args || [],
            env: config.env || {},
            url: config.url,
            headers: config.headers
          }
        };

        // Override transport type if specified
        if (config.transport) {
          if (typeof config.transport === 'string') {
            serverConfig.transport.type = config.transport as 'stdio' | 'http' | 'sse';
          } else if (typeof config.transport === 'object') {
            serverConfig.transport = { ...serverConfig.transport, ...config.transport };
          }
        }

        addMCPServer(serverConfig);
        ConsoleMessenger.plain('mcp_commands.server_added', { name });

        // Try to connect immediately
        const manager = getMCPManager();
        await manager.addServer(serverConfig);
        ConsoleMessenger.plain('mcp_commands.server_connected', { name });

        const tools = manager.getTools().filter(t => t.serverName === name);
        ConsoleMessenger.plain('mcp_commands.tools_available', { count: tools.length });

      } catch (error: unknown) {
        ConsoleMessenger.error('mcp_commands.error_adding_server', { error: extractErrorMessage(error) });
        process.exit(1);
      }
    });

  // Remove server command
  mcpCommand
    .command('remove <name>')
    .description('Remove an MCP server')
    .action(async (name: string) => {
        const validatedName = MCPServerIdSchema.parse(name);
      try {
        const manager = getMCPManager();
        await manager.removeServer(validatedName);
        removeMCPServer(validatedName);
        ConsoleMessenger.plain('mcp_commands.server_removed', { name: validatedName });
      } catch (error: unknown) {
        ConsoleMessenger.error('mcp_commands.error_removing_server', { error: extractErrorMessage(error) });
        process.exit(1);
      }
    });

  // List servers command
  mcpCommand
    .command('list')
    .description('List configured MCP servers')
    .action(() => {
      const config = loadMCPConfig();
      const manager = getMCPManager();

      if (config.servers.length === 0) {
        ConsoleMessenger.warning('mcp_commands.no_servers');
        return;
      }

      ConsoleMessenger.bold('mcp_commands.list_header');
      console.log();

      for (const server of config.servers) {
        const isConnected = manager.getServers().includes(server.name);
        const statusMsg = isConnected
          ? chalk.green('✓ Connected')
          : chalk.red('✗ Disconnected');

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
    });

  // Test server command
  mcpCommand
    .command('test <name>')
    .description('Test connection to an MCP server')
    .action(async (name: string) => {
      try {
        const config = loadMCPConfig();
        const serverConfig = config.servers.find(s => s.name === name);
        
        if (!serverConfig) {
          console.error(chalk.red(`Server ${name} not found`));
          process.exit(1);
        }

        console.log(chalk.blue(`Testing connection to ${name}...`));
        
        const manager = getMCPManager();
        await manager.addServer(serverConfig);
        
        const tools = manager.getTools().filter(t => t.serverName === name);
        console.log(chalk.green(`✓ Successfully connected to ${name}`));
        console.log(chalk.blue(`  Available tools: ${tools.length}`));
        
        if (tools.length > 0) {
          console.log('  Tools:');
          tools.forEach(tool => {
            const displayName = tool.name.replace(`mcp__${name}__`, '');
            console.log(`    - ${displayName}: ${tool.description}`);
          });
        }

      } catch (error: unknown) {
        console.error(chalk.red(`✗ Failed to connect to ${name}: ${extractErrorMessage(error)}`));
        process.exit(1);
      }
    });

  // Templates command - List available templates
  mcpCommand
    .command('templates')
    .description('List available MCP server templates')
    .option('--category <category>', 'Filter by category (design, deployment, testing, monitoring, backend, version-control)')
    .action((options) => {
      console.log(chalk.blue.bold('\n📦 Available MCP Server Templates\n'));

      let templates = Object.values(PREDEFINED_SERVERS);

      if (options.category) {
        if (!isValidTemplateCategory(options.category)) {
          console.log(chalk.red(`Invalid category "${options.category}".`));
          console.log(chalk.gray(`Available categories: ${VALID_TEMPLATE_CATEGORIES.join(', ')}`));
          return;
        }

        templates = getTemplatesByCategory(options.category);
        if (templates.length === 0) {
          console.log(chalk.yellow(`No templates found for category "${options.category}"`));
          console.log();
          console.log(chalk.blue('Available categories:'));
          console.log('  • design, deployment, testing, monitoring, backend, version-control');
          return;
        }
        console.log(chalk.gray(`Showing ${options.category} templates:\n`));
      }

      // Group by category
      const categories = templates.reduce((acc, template) => {
        if (!acc[template.category]) {
          acc[template.category] = [];
        }
        acc[template.category].push(template);
        return acc;
      }, {} as Record<string, typeof templates>);

      const categoryIcons: Record<string, string> = {
        design: '🎨',
        'version-control': '📦',
        deployment: '🚀',
        testing: '🧪',
        monitoring: '📊',
        backend: '🗄️'
      };

      for (const [category, categoryTemplates] of Object.entries(categories)) {
        const icon = categoryIcons[category] || '📌';
        console.log(chalk.bold(`${icon} ${category.toUpperCase()}`));
        console.log();

        categoryTemplates.forEach(template => {
          const officialBadge = template.officialServer ? chalk.green('official') : chalk.gray('community');
          console.log(`  ${chalk.bold(template.name)} [${officialBadge}]`);
          console.log(chalk.gray(`  ${template.description}`));

          if (template.requiredEnv.length > 0) {
            const envVarNames = template.requiredEnv.map(e => e.name).join(', ');
            console.log(chalk.gray(`  Requires: ${envVarNames}`));
          }

          console.log(chalk.blue(`  Usage: ax-cli mcp add ${template.name} --template`));
          console.log();
        });
      }

      console.log(chalk.gray('💡 Tip: Use --category to filter templates by type'));
      console.log(chalk.gray(`Example: ax-cli mcp templates --category design`));
      console.log();
    });

  // Tools command - List tools from a specific server
  mcpCommand
    .command('tools <server-name>')
    .description('List available tools from an MCP server')
    .option('--json', 'Output in JSON format')
    .option('--verbose', 'Show detailed tool schemas')
    .action(async (serverName: string, options) => {
      try {
        const manager = getMCPManager();

        // Ensure server is connected
        const isConnected = manager.getServers().includes(serverName);
        if (!isConnected) {
          // Try to connect
          const config = loadMCPConfig();
          const serverConfig = config.servers.find(s => s.name === serverName);

          if (!serverConfig) {
            console.error(chalk.red(`❌ Server "${serverName}" not found.`));
            console.log(chalk.gray('\nAdd it first with:'));
            console.log(chalk.blue(`  ax-cli mcp add ${serverName} --template`));
            process.exit(1);
          }

          console.log(chalk.blue(`Connecting to ${serverName}...`));
          await manager.addServer(serverConfig);
          console.log(chalk.green('✓ Connected\n'));
        }

        const tools = manager.getTools().filter(t => t.serverName === serverName);

        if (tools.length === 0) {
          console.log(chalk.yellow('⚠️  No tools found for this server.'));
          console.log(chalk.gray('The server may be disconnected or have no tools available.'));
          return;
        }

        if (options.json) {
          console.log(JSON.stringify(tools, null, 2));
          return;
        }

        // Pretty-print with tree structure
        console.log(chalk.blue.bold(`\n🔧 ${serverName} Tools (${tools.length} available)\n`));

        tools.forEach((tool, i) => {
          const isLast = i === tools.length - 1;
          const prefix = isLast ? '└─' : '├─';
          const displayName = tool.name.replace(`mcp__${serverName}__`, '');

          console.log(chalk.bold(`${prefix} ${displayName}`));
          console.log(`   ${chalk.gray(tool.description || 'No description available')}`);

          if (options.verbose && tool.inputSchema) {
            console.log(chalk.gray(`   Schema:`));
            const schemaStr = JSON.stringify(tool.inputSchema, null, 2)
              .split('\n')
              .map(line => `   ${line}`)
              .join('\n');
            console.log(chalk.gray(schemaStr));
          } else if (tool.inputSchema?.properties) {
            const params = Object.keys(tool.inputSchema.properties);
            if (params.length > 0) {
              const required = tool.inputSchema.required || [];
              const paramList = params.map(p => required.includes(p) ? `${p}*` : p).join(', ');
              console.log(chalk.gray(`   Parameters: ${paramList}`));
            }
          }

          if (!isLast) console.log('   │');
        });

        console.log();
        console.log(chalk.gray('💡 Tip: Use --verbose to see full parameter schemas'));
        console.log(chalk.gray('   Parameters marked with * are required'));
        console.log();

      } catch (error: unknown) {
        console.error(chalk.red(`❌ Error: ${extractErrorMessage(error)}`));
        process.exit(1);
      }
    });

  // Search command - Search tools across all servers
  mcpCommand
    .command('search <query>')
    .description('Search for tools across all MCP servers')
    .option('--json', 'Output in JSON format')
    .action((query: string, options) => {
      const manager = getMCPManager();
      const allTools = manager.getTools();

      const lowerQuery = query.toLowerCase();
      const matchingTools = allTools.filter(tool =>
        tool.name.toLowerCase().includes(lowerQuery) ||
        tool.description?.toLowerCase().includes(lowerQuery)
      );

      if (matchingTools.length === 0) {
        console.log(chalk.yellow(`\n⚠️  No tools found matching "${query}"\n`));
        console.log(chalk.gray('💡 Try searching for:'));
        console.log(chalk.gray('   • deploy, git, database, test, file'));
        console.log();
        return;
      }

      if (options.json) {
        console.log(JSON.stringify(matchingTools, null, 2));
        return;
      }

      console.log(chalk.blue.bold(`\n🔍 Found ${matchingTools.length} tools matching "${query}"\n`));

      // Group by server
      const byServer = matchingTools.reduce((acc, tool) => {
        if (!acc[tool.serverName]) {
          acc[tool.serverName] = [];
        }
        acc[tool.serverName].push(tool);
        return acc;
      }, {} as Record<string, typeof matchingTools>);

      for (const [serverName, serverTools] of Object.entries(byServer)) {
        console.log(chalk.bold(`${serverName} (${serverTools.length} tools)`));
        serverTools.forEach(tool => {
          const displayName = tool.name.replace(`mcp__${serverName}__`, '');
          console.log(`  • ${chalk.bold(displayName)}`);
          if (tool.description) {
            console.log(chalk.gray(`    ${tool.description}`));
          }
        });
        console.log();
      }

      console.log(chalk.gray('💡 Tip: Use "ax-cli mcp tools <server-name>" to see all tools from a server'));
      console.log();
    });

  // Browse command - Interactive template browser (alias for templates)
  mcpCommand
    .command('browse')
    .description('Browse available MCP server templates')
    .action(() => {
      console.log(chalk.blue.bold('\n🌟 MCP Server Template Browser\n'));
      console.log(chalk.gray('Popular templates for front-end development:\n'));

      const popular = ['figma', 'github', 'vercel', 'puppeteer', 'storybook', 'sentry'];

      popular.forEach(name => {
        const template = getTemplate(name);
        if (template) {
          const icon = template.category === 'design' ? '🎨' :
                        template.category === 'version-control' ? '📦' :
                        template.category === 'deployment' ? '🚀' :
                        template.category === 'testing' ? '🧪' :
                        template.category === 'monitoring' ? '📊' : '🗄️';

          console.log(`${icon} ${chalk.bold(template.name)}`);
          console.log(chalk.gray(`   ${template.description}`));
          console.log(chalk.blue(`   Quick start: ax-cli mcp add ${name} --template`));
          console.log();
        }
      });

      console.log(chalk.gray('📚 View all templates:'));
      console.log(chalk.blue('   ax-cli mcp templates'));
      console.log();
      console.log(chalk.gray('🔍 Search templates:'));
      console.log(chalk.blue('   ax-cli mcp templates --category design'));
      console.log();
    });

  // Health command - Check MCP server health
  mcpCommand
    .command('health [server-name]')
    .description('Check health status of MCP servers')
    .option('--json', 'Output in JSON format')
    .option('--watch', 'Continuously monitor health (updates every 60s)')
    .action(async (serverName: string | undefined, options) => {
      try {
        const { MCPHealthMonitor } = await import('../mcp/health.js');
        const manager = getMCPManager();
        const healthMonitor = new MCPHealthMonitor(manager);

        if (options.watch) {
          // Continuous monitoring mode
          console.log(chalk.blue.bold('\n📊 MCP Server Health Monitoring\n'));
          console.log(chalk.gray('Press Ctrl+C to stop\n'));

          // Start monitoring (uses configured health check interval)
          healthMonitor.start(MCP_CONFIG.HEALTH_CHECK_INTERVAL);

          // Display initial report
          const displayHealth = async () => {
            console.clear();
            console.log(chalk.blue.bold('📊 MCP Server Health Report\n'));
            console.log(chalk.gray(`Last updated: ${new Date().toLocaleTimeString()}\n`));

            const health = serverName
              ? filterValidHealth([await healthMonitor.getServerStatus(serverName)])
              : await healthMonitor.getHealthReport();

            if (health.length === 0) {
              console.log(chalk.yellow('No servers connected'));
              return;
            }

            for (const server of health) {
              const statusIcon = server.connected ? '✓' : '✗';
              const statusColor = server.connected ? chalk.green : chalk.red;
              const statusText = server.connected ? 'Connected' : 'Disconnected';

              console.log(statusColor(`${statusIcon} ${chalk.bold(server.serverName)} (${statusText})`));
              console.log(chalk.gray(`  Transport: MCP`));
              if (server.uptime) {
                console.log(chalk.gray(`  Uptime: ${MCPHealthMonitor.formatUptime(server.uptime)}`));
              }
              console.log(chalk.gray(`  Tools: ${server.toolCount} available`));

              if (server.avgLatency) {
                console.log(chalk.gray(`  Latency: avg ${MCPHealthMonitor.formatLatency(server.avgLatency)}, p95 ${MCPHealthMonitor.formatLatency(server.p95Latency || 0)}`));
              }

              const successRateColor = server.successRate >= 95 ? chalk.green :
                                       server.successRate >= 80 ? chalk.yellow : chalk.red;
              console.log(chalk.gray(`  Success Rate: ${successRateColor(`${server.successRate.toFixed(1)}%`)} (${server.successCount}/${server.successCount + server.failureCount} calls)`));

              if (server.lastError) {
                console.log(chalk.red(`  Last Error: ${server.lastError}`));
                if (server.lastErrorAt) {
                  const timeSinceError = Date.now() - server.lastErrorAt;
                  console.log(chalk.gray(`    ${MCPHealthMonitor.formatUptime(timeSinceError)} ago`));
                }
              }
              console.log();
            }

            console.log(chalk.gray('Next update in 60 seconds...'));
          };

          // Display immediately
          await displayHealth();

          // Set up interval (uses configured health check interval)
          const watchInterval = setInterval(displayHealth, MCP_CONFIG.HEALTH_CHECK_INTERVAL);

          // Handle Ctrl+C - use 'once' to prevent multiple handlers accumulating
          process.once('SIGINT', () => {
            clearInterval(watchInterval);
            healthMonitor.stop();
            console.log(chalk.yellow('\n\n👋 Stopped health monitoring\n'));
            process.exit(0);
          });

        } else {
          // One-time health check
          const health = serverName
            ? filterValidHealth([await healthMonitor.getServerStatus(serverName)])
            : await healthMonitor.getHealthReport();

          if (options.json) {
            console.log(JSON.stringify(health, null, 2));
            return;
          }

          if (health.length === 0) {
            if (serverName) {
              console.log(chalk.yellow(`\n⚠️  Server "${serverName}" not found\n`));
            } else {
              console.log(chalk.yellow('\n⚠️  No MCP servers connected\n'));
              console.log(chalk.blue('To add a server:'));
              console.log(chalk.cyan('  ax-cli mcp add figma --template'));
              console.log();
            }
            return;
          }

          console.log(chalk.blue.bold('\n📊 MCP Server Health Report\n'));

          for (const server of health) {
            const statusIcon = server.connected ? '✓' : '✗';
            const statusColor = server.connected ? chalk.green : chalk.red;
            const statusText = server.connected ? 'Connected' : 'Disconnected';

            console.log(statusColor(`${statusIcon} ${chalk.bold(server.serverName)} (${statusText})`));
            console.log(chalk.gray(`  Transport: MCP`));
            if (server.uptime) {
              console.log(chalk.gray(`  Uptime: ${MCPHealthMonitor.formatUptime(server.uptime)}`));
            }
            console.log(chalk.gray(`  Tools: ${server.toolCount} available`));

            if (server.avgLatency) {
              console.log(chalk.gray(`  Latency: avg ${MCPHealthMonitor.formatLatency(server.avgLatency)}, p95 ${MCPHealthMonitor.formatLatency(server.p95Latency || 0)}`));
            }

            const successRateColor = server.successRate >= 95 ? chalk.green :
                                     server.successRate >= 80 ? chalk.yellow : chalk.red;
            console.log(chalk.gray(`  Success Rate: ${successRateColor(`${server.successRate.toFixed(1)}%`)} (${server.successCount}/${server.successCount + server.failureCount} calls)`));

            if (server.lastError) {
              console.log(chalk.red(`  Last Error: ${server.lastError}`));
              if (server.lastErrorAt) {
                const timeSinceError = Date.now() - server.lastErrorAt;
                console.log(chalk.gray(`    ${MCPHealthMonitor.formatUptime(timeSinceError)} ago`));
              }
            }

            if (server.lastSuccess) {
              const timeSinceSuccess = Date.now() - server.lastSuccess;
              console.log(chalk.gray(`  Last Successful Call: ${MCPHealthMonitor.formatUptime(timeSinceSuccess)} ago`));
            }

            console.log();
          }

          console.log(chalk.gray('💡 Tip: Use --watch to continuously monitor server health'));
          console.log();
        }

      } catch (error: unknown) {
        console.error(chalk.red(`\n❌ Error: ${extractErrorMessage(error)}\n`));
        process.exit(1);
      }
    });

  // Validate server configuration (Phase 4)
  mcpCommand
    .command('validate <name>')
    .description('Validate MCP server configuration with pre-flight checks')
    .action(async (name: string) => {
      try {
        // Load configuration
        const config = loadMCPConfig();
        const serverConfig = config.servers.find(s => s.name === name);

        if (!serverConfig) {
          console.error(chalk.red(`\n❌ Server "${name}" not found in configuration\n`));
          console.log(chalk.gray('Available servers:'));
          const availableServers = config.servers.map(s => s.name);
          if (availableServers.length === 0) {
            console.log(chalk.gray('  (none configured)'));
          } else {
            availableServers.forEach(s => console.log(chalk.gray(`  • ${s}`)));
          }
          console.log();
          process.exit(1);
        }

        console.log(chalk.blue.bold(`\n🔍 Validating "${name}" MCP server configuration...\n`));

        // Run validation
        const result = await validateServerConfig(serverConfig);

        // Display results
        console.log(formatValidationResult(result));
        console.log();

        if (!result.valid) {
          console.log(chalk.yellow('💡 Fix the errors above and try again'));
          console.log();
          process.exit(1);
        } else if (result.warnings.length > 0) {
          console.log(chalk.blue('💡 Configuration is valid but has warnings. Review them before connecting.'));
          console.log();
        } else {
          console.log(chalk.green('🚀 Ready to connect! Use: ax-cli mcp add ' + name + ' --template'));
          console.log();
        }

      } catch (error: unknown) {
        console.error(chalk.red(`\n❌ Error: ${extractErrorMessage(error)}\n`));
        process.exit(1);
      }
    });

  // List MCP resources (Phase 4)
  mcpCommand
    .command('resources [server-name]')
    .description('List resources exposed by MCP servers')
    .option('--search <query>', 'Search resources by name or URI')
    .option('--json', 'Output in JSON format')
    .action(async (serverName: string | undefined, options) => {
      try {
        const manager = getMCPManager();

        // Get resources
        const resources = serverName
          ? await listServerResources(manager, serverName)
          : await listAllResources(manager);

        // Filter by search query if provided
        const filteredResources = options.search
          ? searchResources(resources, options.search)
          : resources;

        if (options.json) {
          console.log(JSON.stringify(filteredResources, null, 2));
          return;
        }

        // Display resources
        if (filteredResources.length === 0) {
          if (serverName) {
            console.log(chalk.yellow(`\n⚠️  No resources found for server "${serverName}"\n`));
          } else {
            console.log(chalk.yellow('\n⚠️  No resources found from any connected server\n'));
          }
          console.log(chalk.gray('Note: Not all MCP servers expose resources.'));
          console.log();
          return;
        }

        console.log(chalk.blue.bold('\n📦 MCP Resources\n'));

        // Group by server
        const byServer = new Map<string, typeof filteredResources>();
        for (const resource of filteredResources) {
          let serverResources = byServer.get(resource.serverName);
          if (!serverResources) {
            serverResources = [];
            byServer.set(resource.serverName, serverResources);
          }
          serverResources.push(resource);
        }

        for (const [server, serverResources] of byServer.entries()) {
          console.log(chalk.bold(`${server} (${serverResources.length} resources)`));

          for (const resource of serverResources) {
            console.log(chalk.green(`  ${resource.reference}`));
            if (resource.description) {
              console.log(chalk.gray(`    ${resource.description}`));
            }
            if (resource.mimeType) {
              console.log(chalk.gray(`    Type: ${resource.mimeType}`));
            }
          }
          console.log();
        }

        console.log(chalk.gray('💡 Use resources in chat with: "Query the @mcp:server/uri"'));
        console.log();

      } catch (error: unknown) {
        console.error(chalk.red(`\n❌ Error: ${extractErrorMessage(error)}\n`));
        process.exit(1);
      }
    });

  // Browse MCP Server Registry (Phase 5)
  mcpCommand
    .command('registry')
    .description('Browse MCP server registry')
    .option('--search <query>', 'Search for servers')
    .option('--category <category>', 'Filter by category')
    .option('--transport <type>', 'Filter by transport type (stdio, http, sse)')
    .option('--json', 'Output in JSON format')
    .action(async (options) => {
      try {
        console.log(chalk.blue.bold('\n📦 MCP Server Registry\n'));

        const searchOptions: RegistrySearchOptions = {
          query: options.search,
          category: options.category,
          transport: options.transport,
          sortBy: 'stars',
          limit: 20
        };

        const servers = options.search || options.category || options.transport
          ? await searchRegistry(searchOptions)
          : await getPopularServers();

        if (options.json) {
          console.log(JSON.stringify(servers, null, 2));
          return;
        }

        if (servers.length === 0) {
          console.log(chalk.yellow('⚠️  No servers found matching your criteria\n'));
          console.log(chalk.gray('Try different search terms or browse all servers'));
          console.log();
          return;
        }

        console.log(chalk.gray(`Found ${servers.length} server(s)\n`));

        for (const server of servers) {
          const badge = server.verified ? chalk.green('✓ verified') : chalk.gray('community');
          console.log(`${chalk.bold(server.displayName)} [${badge}] ⭐ ${server.stars}`);
          console.log(chalk.gray(`  ${server.description}`));
          console.log(chalk.gray(`  Category: ${server.category} | Transport: ${server.transport}`));
          if (server.packageName) {
            console.log(chalk.blue(`  Install: ax-cli mcp install ${server.name}`));
          } else {
            console.log(chalk.gray(`  Repository: ${server.repository}`));
          }
          console.log();
        }

        console.log(chalk.gray('💡 Use --search to find specific servers'));
        console.log(chalk.gray('💡 Use --category to filter by type (design, database, api, etc.)'));
        console.log();

      } catch (error: unknown) {
        console.error(chalk.red(`\n❌ Error: ${extractErrorMessage(error)}\n`));
        process.exit(1);
      }
    });

  // Install MCP server from registry (Phase 5)
  mcpCommand
    .command('install <name>')
    .description('Install MCP server from registry')
    .option('--no-validate', 'Skip validation before installation')
    .option('--no-connect', 'Add configuration but don\'t connect immediately')
    .action(async (name: string, options) => {
      try {
        console.log(chalk.blue(`\n📦 Installing "${name}" from registry...\n`));

        // Search registry
        const server = await getRegistryServer(name);

        if (!server) {
          console.error(chalk.red(`❌ Server "${name}" not found in registry\n`));
          console.log(chalk.gray('Available options:'));
          console.log(chalk.gray('  • Search registry: ax-cli mcp registry --search <query>'));
          console.log(chalk.gray('  • Browse all: ax-cli mcp registry'));
          console.log();
          process.exit(1);
        }

        // Display server info
        console.log(formatRegistryServer(server, false));
        console.log();

        // Generate configuration
        const config = generateConfigFromRegistry(server);

        // Validate if requested
        if (options.validate !== false) {
          console.log(chalk.blue('🔍 Validating configuration...\n'));
          const validation = await validateServerConfig(config);

          if (!validation.valid) {
            console.log(formatValidationResult(validation));
            console.log();
            console.error(chalk.red('❌ Validation failed. Fix errors and try again.\n'));
            process.exit(1);
          }

          if (validation.warnings.length > 0) {
            console.log(chalk.yellow('⚠️  Warnings:\n'));
            validation.warnings.forEach(w => console.log(chalk.yellow(`  • ${w}`)));
            console.log();
          }
        }

        // Add server to configuration
        await addMCPServer(config);
        console.log(chalk.green(`✅ Server "${server.name}" added to configuration\n`));

        // Connect if requested
        if (options.connect !== false) {
          console.log(chalk.blue('🔌 Connecting to server...\n'));

          try {
            const manager = getMCPManager();
            await manager.addServer(config);

            const tools = manager.getTools().filter(t => t.serverName === server.name);
            console.log(chalk.green(`✅ Connected successfully! ${tools.length} tool(s) available\n`));

            // Show available tools
            if (tools.length > 0) {
              console.log(chalk.gray('Available tools:'));
              tools.slice(0, 5).forEach(tool => {
                console.log(chalk.gray(`  • ${tool.name.replace(`mcp__${server.name}__`, '')}`));
              });
              if (tools.length > 5) {
                console.log(chalk.gray(`  ... and ${tools.length - 5} more`));
              }
              console.log();
            }
          } catch (error) {
            console.error(chalk.yellow(`⚠️  Server added but connection failed: ${extractErrorMessage(error)}\n`));
            console.log(chalk.gray('You can try connecting manually with: ax-cli mcp add ' + server.name + ' --template'));
            console.log();
          }
        }

        console.log(chalk.green('🎉 Installation complete!\n'));

      } catch (error: unknown) {
        console.error(chalk.red(`\n❌ Error: ${extractErrorMessage(error)}\n`));
        process.exit(1);
      }
    });

  // Z.AI MCP Status command
  mcpCommand
    .command('status-zai')
    .description('Show Z.AI MCP integration status')
    .option('--json', 'Output in JSON format')
    .action(async (options) => {
      try {
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
          console.log(chalk.gray('  2. Set it: ax-cli config set apiKey YOUR_API_KEY'));
          console.log(chalk.gray('  3. Enable servers: ax-cli mcp add-zai'));
          console.log();
        } else if (status.enabledServers.length === 0) {
          console.log(chalk.blue('API key configured. Enable Z.AI MCP servers with:'));
          console.log(chalk.cyan('  ax-cli mcp add-zai'));
          console.log();
        }

      } catch (error: unknown) {
        console.error(chalk.red(`\n❌ Error: ${extractErrorMessage(error)}\n`));
        process.exit(1);
      }
    });

  // Z.AI MCP Add command
  mcpCommand
    .command('add-zai')
    .description('Enable Z.AI MCP servers (web-reader, web-search, vision)')
    .option('--all', 'Enable all available Z.AI servers')
    .option('--server <servers...>', 'Specific servers to enable (zai-web-reader, zai-web-search, zai-vision)')
    .option('--api-key <key>', 'Z.AI API key (or use config/environment)')
    .action(async (options) => {
      try {
        console.log(chalk.blue.bold('\n🚀 Setting up Z.AI MCP Servers\n'));

        // Get API key
        let apiKey = options.apiKey || getZAIApiKey();

        if (!apiKey) {
          console.error(chalk.red('❌ No Z.AI API key found\n'));
          console.log(chalk.gray('Provide an API key using one of these methods:'));
          console.log(chalk.gray('  • --api-key <key> flag'));
          console.log(chalk.gray('  • ax-cli config set apiKey YOUR_API_KEY'));
          console.log(chalk.gray('  • Set YOUR_API_KEY or Z_AI_API_KEY environment variable'));
          console.log();
          console.log(chalk.blue('Get your API key at: https://z.ai'));
          console.log();
          process.exit(1);
        }

        // Detect current status
        const status = await detectZAIServices();

        // Determine which servers to add
        let serversToAdd: ZAIServerName[];

        if (options.server && options.server.length > 0) {
          // Specific servers requested
          serversToAdd = options.server.filter((s: string): s is ZAIServerName => isZAIServer(s));
          const invalidServers = options.server.filter((s: string) => !isZAIServer(s));

          if (invalidServers.length > 0) {
            console.log(chalk.yellow(`⚠️  Unknown server(s): ${invalidServers.join(', ')}`));
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
          console.log(chalk.yellow('⚠️  All requested Z.AI servers are already configured\n'));
          console.log(chalk.gray('Enabled servers:'));
          status.enabledServers.forEach(s => console.log(chalk.green(`  ✓ ${s}`)));
          console.log();
          return;
        }

        // Check Node.js version for vision
        if (newServers.includes(ZAI_SERVER_NAMES.VISION) && !status.nodeVersionOk) {
          console.log(chalk.yellow(`⚠️  Vision server requires Node.js 22+, you have v${status.nodeVersion}`));
          console.log(chalk.gray('  Skipping vision server. Update Node.js to enable it.'));
          const visionIndex = newServers.indexOf(ZAI_SERVER_NAMES.VISION);
          if (visionIndex > -1) {
            newServers.splice(visionIndex, 1);
          }
          console.log();
        }

        if (newServers.length === 0) {
          console.log(chalk.yellow('No servers to add after filtering.\n'));
          return;
        }

        // Add each server
        const manager = getMCPManager();
        let successCount = 0;

        for (const serverName of newServers) {
          const template = ZAI_MCP_TEMPLATES[serverName];
          console.log(chalk.blue(`Adding ${template.displayName}...`));
          console.log(chalk.gray(`  ${template.description}`));

          try {
            const config = generateZAIServerConfig(serverName, apiKey);

            // Connect first, then save config only on success
            await manager.addServer(config);
            addMCPServer(config);

            const tools = manager.getTools().filter(t => t.serverName === serverName);
            console.log(chalk.green(`  ✓ Connected (${tools.length} tool${tools.length !== 1 ? 's' : ''})`));
            successCount++;
          } catch (error) {
            console.log(chalk.red(`  ✗ Failed: ${extractErrorMessage(error)}`));
          }
          console.log();
        }

        // Summary
        if (successCount > 0) {
          console.log(chalk.green.bold(`✨ ${successCount} Z.AI MCP server${successCount !== 1 ? 's' : ''} enabled!\n`));
          console.log(chalk.gray('Available tools:'));
          const allTools = manager.getTools().filter(t =>
            newServers.some(s => t.serverName === s)
          );
          allTools.forEach(tool => {
            console.log(chalk.gray(`  • ${tool.name.replace('mcp__', '').replace('__', '/')}`));
          });
          console.log();
        } else {
          console.log(chalk.red('❌ No servers were successfully added.\n'));
          process.exit(1);
        }

      } catch (error: unknown) {
        console.error(chalk.red(`\n❌ Error: ${extractErrorMessage(error)}\n`));
        process.exit(1);
      }
    });

  // Z.AI MCP Remove command
  mcpCommand
    .command('remove-zai')
    .description('Disable Z.AI MCP servers')
    .option('--all', 'Remove all Z.AI servers')
    .option('--server <servers...>', 'Specific servers to remove')
    .action(async (options) => {
      try {
        console.log(chalk.blue.bold('\n🗑️  Removing Z.AI MCP Servers\n'));

        const status = await detectZAIServices();

        if (status.enabledServers.length === 0) {
          console.log(chalk.yellow('⚠️  No Z.AI MCP servers are currently configured.\n'));
          return;
        }

        // Determine which servers to remove
        let serversToRemove: ZAIServerName[];

        if (options.server && options.server.length > 0) {
          serversToRemove = options.server.filter((s: string): s is ZAIServerName =>
            isZAIServer(s) && status.enabledServers.includes(s as ZAIServerName)
          );

          const notEnabled = options.server.filter((s: string) =>
            isZAIServer(s) && !status.enabledServers.includes(s as ZAIServerName)
          );

          if (notEnabled.length > 0) {
            console.log(chalk.yellow(`⚠️  Server(s) not enabled: ${notEnabled.join(', ')}`));
          }
        } else if (options.all) {
          serversToRemove = [...status.enabledServers];
        } else {
          // Default: remove all
          serversToRemove = [...status.enabledServers];
        }

        if (serversToRemove.length === 0) {
          console.log(chalk.yellow('⚠️  No matching servers to remove.\n'));
          return;
        }

        // Remove each server
        const manager = getMCPManager();
        let successCount = 0;

        for (const serverName of serversToRemove) {
          const template = ZAI_MCP_TEMPLATES[serverName];
          console.log(chalk.blue(`Removing ${template.displayName}...`));

          try {
            await manager.removeServer(serverName);
            removeMCPServer(serverName);
            console.log(chalk.green(`  ✓ Removed`));
            successCount++;
          } catch (error) {
            console.log(chalk.red(`  ✗ Failed: ${extractErrorMessage(error)}`));
          }
        }

        console.log();

        if (successCount > 0) {
          console.log(chalk.green(`✓ ${successCount} Z.AI MCP server${successCount !== 1 ? 's' : ''} removed.\n`));
        } else {
          console.log(chalk.red('❌ No servers were successfully removed.\n'));
          process.exit(1);
        }

      } catch (error: unknown) {
        console.error(chalk.red(`\n❌ Error: ${extractErrorMessage(error)}\n`));
        process.exit(1);
      }
    });

  return mcpCommand;
}
