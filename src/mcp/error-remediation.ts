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
      'Check environment variable is set: echo $<VAR_NAME>',
      'Regenerate the API key if expired',
      'Verify the token has required permissions'
    ]
  },
  '403': {
    title: 'Access forbidden',
    hints: [
      'You don\'t have permission to access this resource',
      'Check if your API key has the required scopes',
      'Verify the account has access to this feature',
      'Contact the service provider for access'
    ]
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
      'Verify the server version is compatible',
      'Try running: ax-cli mcp test <server-name>'
    ]
  },
  'protocol error': {
    title: 'MCP protocol error',
    hints: [
      'Invalid message format or unsupported protocol version',
      'Ensure the server implements MCP protocol correctly',
      'Check for server updates',
      'Verify client and server versions are compatible'
    ]
  },
  'tool not found': {
    title: 'MCP tool not found',
    hints: [
      'The requested tool is not available on the server',
      'List available tools: ax-cli mcp tools <server-name>',
      'The server may need to be restarted',
      'Check if the tool requires additional configuration'
    ]
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
