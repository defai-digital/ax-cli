/**
 * MCP Error Remediation Module
 *
 * Centralized error code to remediation mapping for MCP connection errors.
 * Maps error codes/patterns to specific troubleshooting steps.
 *
 * Extracted from error-formatter.ts for better separation of concerns.
 */

/**
 * Remediation information for an error
 */
export interface Remediation {
  /** Short title describing the error */
  title: string;
  /** List of troubleshooting hints */
  hints: string[];
  /** Optional debug command to run */
  command?: string;
}

/**
 * Comprehensive error code to remediation mapping
 * Maps error codes/patterns to specific troubleshooting steps
 */
export const ERROR_REMEDIATION: Record<string, Remediation> = {
  // Process/Command errors
  'enoent': {
    title: 'Command not found',
    hints: [
      'The MCP server command is not installed or not in PATH',
      'Install the package: npm install -g <package-name>',
      'Or use npx: npx <package-name>',
      'Verify installation: which <command> or command -v <command>'
    ],
    command: 'npm list -g --depth=0'
  },
  'eacces': {
    title: 'Permission denied',
    hints: [
      'The command or file lacks execute permissions',
      'Fix permissions: chmod +x <file>',
      'Or install globally with proper permissions',
      'Avoid using sudo with npm - fix npm permissions instead'
    ],
    command: 'npm config set prefix ~/.npm-global'
  },
  'spawn': {
    title: 'Failed to spawn process',
    hints: [
      'The command could not be started',
      'Verify the command path is correct',
      'Check if the binary is compatible with your system',
      'Try running the command directly in terminal'
    ]
  },

  // Network errors
  'econnrefused': {
    title: 'Connection refused',
    hints: [
      'The MCP server is not running or not listening',
      'Start the server first, then retry',
      'Check if the port is correct',
      'Verify no firewall is blocking the connection'
    ],
    command: 'lsof -i :<port> # Check if port is in use'
  },
  'enotfound': {
    title: 'Host not found',
    hints: [
      'The hostname could not be resolved',
      'Check if the URL is spelled correctly',
      'Verify your internet connection',
      'Try using IP address instead of hostname'
    ],
    command: 'nslookup <hostname>'
  },
  'econnreset': {
    title: 'Connection reset',
    hints: [
      'The server closed the connection unexpectedly',
      'The server may have crashed or restarted',
      'Check server logs for errors',
      'Retry the connection'
    ]
  },
  'etimedout': {
    title: 'Connection timed out',
    hints: [
      'The server took too long to respond',
      'Check if the server is overloaded',
      'Verify network connectivity',
      'Increase timeout in configuration if needed'
    ]
  },
  'esockettimedout': {
    title: 'Socket timed out',
    hints: [
      'The connection was established but no response received',
      'The server may be hanging or processing slowly',
      'For stdio: ensure command has proper args (not a REPL)',
      'Check if the MCP server is compatible with this client'
    ]
  },

  // SSL/TLS errors
  'cert_': {
    title: 'SSL Certificate error',
    hints: [
      'The server\'s SSL certificate is invalid or expired',
      'For development: you can skip verification (not recommended)',
      'For production: ensure valid certificate is installed',
      'Check certificate chain: openssl s_client -connect <host>:443'
    ]
  },
  'unable_to_verify': {
    title: 'SSL verification failed',
    hints: [
      'Cannot verify the server\'s SSL certificate',
      'The certificate may be self-signed',
      'CA certificates may need to be updated',
      'Set NODE_TLS_REJECT_UNAUTHORIZED=0 for development only'
    ]
  },

  // Authentication errors
  '401': {
    title: 'Authentication failed',
    hints: [
      'The API key or token is invalid or expired',
      '→ For Figma: ax-cli mcp add figma --template --env FIGMA_ACCESS_TOKEN=YOUR_TOKEN',
      '→ For GitHub: ax-cli mcp add github --template --env GITHUB_TOKEN=YOUR_TOKEN',
      'Regenerate the API key if expired at the provider dashboard',
      'Check environment variable is set: echo $<VAR_NAME>'
    ],
    command: 'ax-cli mcp validate <server-name>'
  },
  '403': {
    title: 'Access forbidden',
    hints: [
      'You don\'t have permission to access this resource',
      'Check if your API key has the required scopes/permissions',
      '→ For Figma: ensure token has "file:read" permission',
      '→ For GitHub: ensure token has "repo" scope',
      'Regenerate token with correct permissions if needed'
    ],
    command: 'ax-cli mcp test <server-name>'
  },

  // Server errors
  '500': {
    title: 'Server error',
    hints: [
      'The MCP server encountered an internal error',
      'Check server logs for details',
      'Try again later',
      'Report the issue to the server maintainer'
    ]
  },
  '502': {
    title: 'Bad gateway',
    hints: [
      'The server received an invalid response from upstream',
      'The upstream server may be down',
      'Try again later',
      'Check if there are known outages'
    ]
  },
  '503': {
    title: 'Service unavailable',
    hints: [
      'The server is temporarily unavailable',
      'It may be overloaded or under maintenance',
      'Wait a few minutes and retry',
      'Check service status page'
    ]
  },

  // MCP-specific errors
  'initialization failed': {
    title: 'MCP initialization failed',
    hints: [
      'The MCP server failed to initialize properly',
      'Check if all required environment variables are set',
      '→ Run: ax-cli mcp validate <server-name>',
      '→ Run: ax-cli mcp test <server-name>'
    ],
    command: 'ax-cli mcp templates'
  },
  'protocol error': {
    title: 'MCP protocol error',
    hints: [
      'Invalid message format or unsupported protocol version',
      'This may be a compatibility issue with the MCP server',
      '→ Try removing and re-adding: ax-cli mcp remove <name> && ax-cli mcp add <name> --template',
      'Check for server updates or use a different server version'
    ]
  },
  'tool not found': {
    title: 'MCP tool not found',
    hints: [
      'The requested tool is not available on the server',
      '→ Run: ax-cli mcp tools <server-name> (to list available tools)',
      'The server may need to be reconnected',
      '→ Run: ax-cli mcp test <server-name>'
    ]
  },

  // Figma-specific errors
  'figma_access_token': {
    title: 'Figma access token missing or invalid',
    hints: [
      '→ Run: ax-cli mcp add figma --template --env FIGMA_ACCESS_TOKEN=YOUR_TOKEN',
      'Generate a new token at: https://www.figma.com/settings',
      'Or set environment variable: export FIGMA_ACCESS_TOKEN="your_token"',
      'Ensure the token has file read permissions'
    ],
    command: 'ax-cli mcp validate figma'
  },
  'figma': {
    title: 'Figma MCP server error',
    hints: [
      '→ Run: ax-cli mcp test figma (to test connection)',
      'Verify FIGMA_ACCESS_TOKEN is set: echo $FIGMA_ACCESS_TOKEN',
      '→ Reinstall: ax-cli mcp remove figma && ax-cli mcp add figma --template --env FIGMA_ACCESS_TOKEN=YOUR_TOKEN',
      'Check Figma API status: https://status.figma.com'
    ],
    command: 'ax-cli mcp health figma'
  },

  // GitHub-specific errors
  'github_token': {
    title: 'GitHub token missing or invalid',
    hints: [
      '→ Run: ax-cli mcp add github --template --env GITHUB_TOKEN=YOUR_TOKEN',
      'Generate a new token at: https://github.com/settings/tokens',
      'Ensure token has "repo" scope for repository access',
      'Or set: export GITHUB_TOKEN="ghp_your_token"'
    ],
    command: 'ax-cli mcp validate github'
  }
};

/**
 * Match an error against known patterns and return remediation info
 *
 * @param error - The error to match
 * @returns Remediation info if a pattern matches, null otherwise
 */
export function matchErrorPattern(error: Error): Remediation | null {
  const message = error.message.toLowerCase();
  const errorCode = (error as any).code?.toLowerCase() || '';

  for (const [pattern, remediation] of Object.entries(ERROR_REMEDIATION)) {
    if (message.includes(pattern) || errorCode.includes(pattern)) {
      return remediation;
    }
  }

  return null;
}

/**
 * Get transport-specific troubleshooting hints when no specific error pattern matches
 *
 * @param transportType - The transport type (stdio, http, sse)
 * @returns Array of troubleshooting hints
 */
export function getTransportHints(transportType?: string): string[] {
  if (transportType === 'stdio') {
    return [
      'For stdio transport:',
      '• Verify command is installed: which <command>',
      '• Ensure args include a script path (not just the runtime)',
      '• Example: ["@modelcontextprotocol/server-github"]',
      '• Commands like "node" without args start a REPL and hang'
    ];
  }

  if (transportType === 'http' || transportType === 'sse') {
    return [
      'For HTTP/SSE transport:',
      '• Verify server is running: curl <url>/health',
      '• Check URL is accessible from your network',
      '• Verify SSL certificate if using HTTPS',
      '• Check authentication headers are correct'
    ];
  }

  return [
    'General troubleshooting:',
    '• Check the server logs for more details',
    '• Verify all required environment variables are set',
    '• Try running ax-cli mcp test <server-name>'
  ];
}

/**
 * Get environment variable hints if the error relates to credentials
 *
 * @param errorMessage - The error message to check
 * @returns Array of environment variable hints, or empty array if not applicable
 */
export function getEnvVarHints(errorMessage: string): string[] {
  const message = errorMessage.toLowerCase();

  if (message.includes('api_key') || message.includes('token') || message.includes('secret')) {
    return [
      '',
      'Environment variable tips:',
      '• Set in shell: export VAR_NAME=value',
      '• Or in .env file in project root',
      '• Verify: echo $VAR_NAME'
    ];
  }

  return [];
}
