import { Command } from 'commander';
import { addMCPServer, removeMCPServer, loadMCPConfig, PREDEFINED_SERVERS } from '../mcp/config.js';
import { getMCPManager } from '../grok/tools.js';
import { MCPServerConfig } from '../mcp/client.js';
import { MCPServerIdSchema } from '@ax-cli/schemas';
import chalk from 'chalk';
import { ConsoleMessenger } from '../utils/console-messenger.js';

export function createMCPCommand(): Command {
  const mcpCommand = new Command('mcp');
  mcpCommand.description('Manage MCP (Model Context Protocol) servers');

  // Add server command
  mcpCommand
    .command('add <name>')
    .description('Add an MCP server')
    .option('-t, --transport <type>', 'Transport type (stdio, http, sse, streamable_http)', 'stdio')
    .option('-c, --command <command>', 'Command to run the server (for stdio transport)')
    .option('-a, --args [args...]', 'Arguments for the server command (for stdio transport)', [])
    .option('-u, --url <url>', 'URL for HTTP/SSE transport')
    .option('-h, --headers [headers...]', 'HTTP headers (key=value format)', [])
    .option('-e, --env [env...]', 'Environment variables (key=value format)', [])
    .action(async (name: string, options) => {
      try {
        // Check if it's a predefined server
        if (PREDEFINED_SERVERS[name]) {
          const config = PREDEFINED_SERVERS[name];
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

        // Parse environment variables
        const env: Record<string, string> = {};
        for (const envVar of options.env || []) {
          const [key, value] = envVar.split('=', 2);
          if (key && value) {
            env[key] = value;
          }
        }

        // Parse headers
        const headers: Record<string, string> = {};
        for (const header of options.headers || []) {
          const [key, value] = header.split('=', 2);
          if (key && value) {
            headers[key] = value;
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

      } catch (error: any) {
        ConsoleMessenger.error('mcp_commands.error_adding_server', { error: error.message });
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

      } catch (error: any) {
        ConsoleMessenger.error('mcp_commands.error_adding_server', { error: error.message });
        process.exit(1);
      }
    });

  // Remove server command
  mcpCommand
    .command('remove <name>')
    .description('Remove an MCP server')
    .action(async (name: string) => {
      try {
        const manager = getMCPManager();
        await manager.removeServer(name);
        removeMCPServer(name);
        ConsoleMessenger.plain('mcp_commands.server_removed', { name });
      } catch (error: any) {
        ConsoleMessenger.error('mcp_commands.error_removing_server', { error: error.message });
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

      } catch (error: any) {
        console.error(chalk.red(`✗ Failed to connect to ${name}: ${error.message}`));
        process.exit(1);
      }
    });

  return mcpCommand;
}