/**
 * Pre-configured MCP server templates for popular services
 * Enables one-command setup: ax-cli mcp add <name> --template
 */

import { MCPServerConfig } from '../schemas/settings-schemas.js';

export interface MCPServerTemplate {
  name: string;
  description: string;
  category: 'design' | 'deployment' | 'testing' | 'monitoring' | 'backend' | 'version-control';
  officialServer: boolean;
  config: MCPServerConfig;
  requiredEnv: Array<{
    name: string;
    description: string;
    url?: string; // Documentation link for obtaining the token/key
  }>;
  setupInstructions: string;
  usageExamples: string[];
  troubleshooting: Array<{
    issue: string;
    solution: string;
  }>;
}

/**
 * Pre-configured templates for popular MCP servers
 * Focus on front-end development tools
 */
export const TEMPLATES: Record<string, MCPServerTemplate> = {
  // ============================================
  // DESIGN TOOLS
  // ============================================
  figma: {
    name: 'figma',
    description: 'Figma MCP server for accessing Figma API (community package)',
    category: 'design',
    officialServer: false,
    config: {
      name: 'figma',
      transport: {
        type: 'stdio',
        command: 'npx',
        args: ['-y', 'mcp-figma'],
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
      'Get design tokens from a Figma file',
      'Export components from Figma to React/Vue',
      'Generate design system tokens (colors, typography, spacing)',
      'Extract assets and images from Figma frames',
      'Sync design changes to code automatically'
    ],
    troubleshooting: [
      {
        issue: 'Authentication failed',
        solution: 'Verify FIGMA_ACCESS_TOKEN is set and valid. Generate a new token at figma.com/settings with file read permissions.'
      },
      {
        issue: 'File not found',
        solution: 'Ensure you have access to the Figma file. Check the file URL is correct and you have at least view permissions.'
      },
      {
        issue: 'npx command not found',
        solution: 'Install Node.js 24+ and ensure npx is available in your PATH.'
      }
    ]
  },

  // ============================================
  // VERSION CONTROL
  // ============================================
  github: {
    name: 'github',
    description: 'Official GitHub MCP server for repository management',
    category: 'version-control',
    officialServer: true,
    config: {
      name: 'github',
      transport: {
        type: 'stdio',
        command: 'npx',
        args: ['@modelcontextprotocol/server-github'],
        env: {}
      }
    },
    requiredEnv: [
      {
        name: 'GITHUB_TOKEN',
        description: 'GitHub personal access token (classic or fine-grained)',
        url: 'https://github.com/settings/tokens'
      }
    ],
    setupInstructions: `
1. Create a personal access token at https://github.com/settings/tokens
2. Grant permissions: repo (all), workflow (if needed)
3. Set environment variable: export GITHUB_TOKEN="ghp_your_token"
4. Run: ax-cli mcp add github --template
5. Test: ax-cli mcp test github
    `.trim(),
    usageExamples: [
      'Create and manage pull requests',
      'Search and manage issues',
      'Review code and comments',
      'Access repository information',
      'Manage GitHub workflows and actions'
    ],
    troubleshooting: [
      {
        issue: 'Authentication failed (401)',
        solution: 'Verify GITHUB_TOKEN is valid and starts with "ghp_" (classic) or "github_pat_" (fine-grained). Regenerate if expired.'
      },
      {
        issue: 'Permission denied',
        solution: 'Check token has required scopes. For most operations, you need "repo" scope. For workflows, add "workflow" scope.'
      }
    ]
  },

  // ============================================
  // DEPLOYMENT PLATFORMS
  // ============================================
  vercel: {
    name: 'vercel',
    description: 'Vercel MCP server for deployment automation',
    category: 'deployment',
    officialServer: false, // Community server
    config: {
      name: 'vercel',
      transport: {
        type: 'http',
        url: 'https://api.vercel.com/mcp', // Hypothetical - check if official exists
        headers: {}
      }
    },
    requiredEnv: [
      {
        name: 'VERCEL_TOKEN',
        description: 'Vercel API token from account settings',
        url: 'https://vercel.com/account/tokens'
      }
    ],
    setupInstructions: `
1. Create an API token at https://vercel.com/account/tokens
2. Set environment variable: export VERCEL_TOKEN="your_token"
3. Run: ax-cli mcp add vercel --template
4. Test: ax-cli mcp test vercel
    `.trim(),
    usageExamples: [
      'Deploy projects to Vercel',
      'Manage deployments and domains',
      'Configure environment variables',
      'Monitor deployment status',
      'Roll back deployments'
    ],
    troubleshooting: [
      {
        issue: 'Deployment failed',
        solution: 'Check build logs in Vercel dashboard. Ensure all environment variables are configured correctly.'
      },
      {
        issue: 'Domain configuration error',
        solution: 'Verify DNS settings are correct. It may take up to 24 hours for DNS changes to propagate.'
      }
    ]
  },

  netlify: {
    name: 'netlify',
    description: 'Netlify MCP server for JAMstack deployments',
    category: 'deployment',
    officialServer: false,
    config: {
      name: 'netlify',
      transport: {
        type: 'http',
        url: 'https://api.netlify.com/mcp',
        headers: {}
      }
    },
    requiredEnv: [
      {
        name: 'NETLIFY_TOKEN',
        description: 'Netlify personal access token',
        url: 'https://app.netlify.com/user/applications'
      }
    ],
    setupInstructions: `
1. Create a personal access token at https://app.netlify.com/user/applications
2. Set environment variable: export NETLIFY_TOKEN="your_token"
3. Run: ax-cli mcp add netlify --template
4. Test: ax-cli mcp test netlify
    `.trim(),
    usageExamples: [
      'Deploy static sites to Netlify',
      'Manage forms and serverless functions',
      'Configure build settings',
      'Monitor site analytics',
      'Manage custom domains and SSL'
    ],
    troubleshooting: [
      {
        issue: 'Build timeout',
        solution: 'Optimize build process or upgrade to a higher plan with longer build times.'
      }
    ]
  },

  // ============================================
  // TESTING & QA
  // ============================================
  puppeteer: {
    name: 'puppeteer',
    description: 'Puppeteer MCP server for browser automation and testing',
    category: 'testing',
    officialServer: false,
    config: {
      name: 'puppeteer',
      transport: {
        type: 'stdio',
        command: 'npx',
        args: ['@modelcontextprotocol/server-puppeteer']
      }
    },
    requiredEnv: [],
    setupInstructions: `
1. Ensure Node.js 24+ is installed
2. Run: ax-cli mcp add puppeteer --template
3. Test: ax-cli mcp test puppeteer

Note: First run may take longer as Chromium is downloaded.
    `.trim(),
    usageExamples: [
      'Automate browser interactions for testing',
      'Take screenshots of web pages',
      'Generate PDFs from web content',
      'Scrape dynamic web content',
      'Validate UI workflows and user journeys'
    ],
    troubleshooting: [
      {
        issue: 'Chromium download failed',
        solution: 'Check internet connection. Try running "npx puppeteer browsers install chrome" manually.'
      },
      {
        issue: 'Browser launch failed',
        solution: 'Install required system dependencies. On Linux: apt-get install -y libx11-xcb1 libxcomposite1 libxcursor1'
      }
    ]
  },

  storybook: {
    name: 'storybook',
    description: 'Storybook MCP server for component development and testing',
    category: 'testing',
    officialServer: false,
    config: {
      name: 'storybook',
      transport: {
        type: 'http',
        url: 'http://localhost:6006/mcp', // Local Storybook instance
        headers: {}
      }
    },
    requiredEnv: [],
    setupInstructions: `
1. Ensure Storybook is running: npm run storybook
2. Run: ax-cli mcp add storybook --template
3. Test: ax-cli mcp test storybook

Note: Storybook must be running on port 6006.
    `.trim(),
    usageExamples: [
      'Generate Storybook stories for components',
      'Test component variants and states',
      'Document component APIs',
      'Visual regression testing',
      'Accessibility testing with Storybook addons'
    ],
    troubleshooting: [
      {
        issue: 'Connection refused',
        solution: 'Ensure Storybook is running. Start with "npm run storybook" or "yarn storybook".'
      },
      {
        issue: 'Port conflict',
        solution: 'Check if port 6006 is in use. Configure Storybook to use a different port if needed.'
      }
    ]
  },

  chromatic: {
    name: 'chromatic',
    description: 'Chromatic MCP server for visual testing',
    category: 'testing',
    officialServer: false,
    config: {
      name: 'chromatic',
      transport: {
        type: 'http',
        url: 'https://api.chromatic.com/mcp',
        headers: {}
      }
    },
    requiredEnv: [
      {
        name: 'CHROMATIC_PROJECT_TOKEN',
        description: 'Chromatic project token from project settings',
        url: 'https://www.chromatic.com/docs/access-tokens'
      }
    ],
    setupInstructions: `
1. Get project token from Chromatic project settings
2. Set environment variable: export CHROMATIC_PROJECT_TOKEN="your_token"
3. Run: ax-cli mcp add chromatic --template
4. Test: ax-cli mcp test chromatic
    `.trim(),
    usageExamples: [
      'Run visual regression tests',
      'Capture UI snapshots',
      'Review visual changes in PRs',
      'Detect unintended UI changes',
      'Integrate with CI/CD pipelines'
    ],
    troubleshooting: [
      {
        issue: 'Build failed',
        solution: 'Check Storybook builds successfully. Ensure all stories are loading without errors.'
      }
    ]
  },

  // ============================================
  // MONITORING & ERROR TRACKING
  // ============================================
  sentry: {
    name: 'sentry',
    description: 'Sentry MCP server for error tracking and monitoring',
    category: 'monitoring',
    officialServer: false,
    config: {
      name: 'sentry',
      transport: {
        type: 'http',
        url: 'https://sentry.io/api/0/mcp',
        headers: {}
      }
    },
    requiredEnv: [
      {
        name: 'SENTRY_AUTH_TOKEN',
        description: 'Sentry authentication token',
        url: 'https://sentry.io/settings/account/api/auth-tokens/'
      }
    ],
    setupInstructions: `
1. Create an auth token at https://sentry.io/settings/account/api/auth-tokens/
2. Grant permissions: project:read, project:write, org:read
3. Set environment variable: export SENTRY_AUTH_TOKEN="your_token"
4. Run: ax-cli mcp add sentry --template
5. Test: ax-cli mcp test sentry
    `.trim(),
    usageExamples: [
      'Query error events and issues',
      'Analyze error trends and patterns',
      'Create and update issues',
      'Manage release tracking',
      'Monitor application health'
    ],
    troubleshooting: [
      {
        issue: 'Authentication failed',
        solution: 'Verify SENTRY_AUTH_TOKEN is valid and has required scopes (project:read, project:write, org:read).'
      },
      {
        issue: 'No data returned',
        solution: 'Check that your Sentry project has received events. Ensure DSN is configured correctly in your app.'
      }
    ]
  },

  // ============================================
  // BACKEND & DATABASE
  // ============================================
  supabase: {
    name: 'supabase',
    description: 'Supabase MCP server for backend and database operations',
    category: 'backend',
    officialServer: false,
    config: {
      name: 'supabase',
      transport: {
        type: 'http',
        url: 'https://api.supabase.com/mcp',
        headers: {}
      }
    },
    requiredEnv: [
      {
        name: 'SUPABASE_URL',
        description: 'Your Supabase project URL',
        url: 'https://app.supabase.com'
      },
      {
        name: 'SUPABASE_KEY',
        description: 'Supabase service role key or anon key',
        url: 'https://app.supabase.com'
      }
    ],
    setupInstructions: `
1. Get your project URL and API keys from https://app.supabase.com/project/_/settings/api
2. Set environment variables:
   export SUPABASE_URL="https://xxxxx.supabase.co"
   export SUPABASE_KEY="your_service_role_key"
3. Run: ax-cli mcp add supabase --template
4. Test: ax-cli mcp test supabase
    `.trim(),
    usageExamples: [
      'Query and manage database tables',
      'Execute SQL queries',
      'Manage authentication and users',
      'Work with storage buckets',
      'Invoke Edge Functions'
    ],
    troubleshooting: [
      {
        issue: 'Connection failed',
        solution: 'Verify SUPABASE_URL is correct and includes the https:// protocol. Check project is not paused.'
      },
      {
        issue: 'Permission denied',
        solution: 'Ensure you are using the service_role key for admin operations, not the anon key.'
      }
    ]
  },

  firebase: {
    name: 'firebase',
    description: 'Firebase MCP server for backend services',
    category: 'backend',
    officialServer: false,
    config: {
      name: 'firebase',
      transport: {
        type: 'http',
        url: 'https://firebase.googleapis.com/mcp',
        headers: {}
      }
    },
    requiredEnv: [
      {
        name: 'FIREBASE_TOKEN',
        description: 'Firebase service account token',
        url: 'https://console.firebase.google.com'
      }
    ],
    setupInstructions: `
1. Create a service account at https://console.firebase.google.com/project/_/settings/serviceaccounts
2. Download the service account JSON file
3. Set environment variable: export FIREBASE_TOKEN="path/to/serviceAccountKey.json"
4. Run: ax-cli mcp add firebase --template
5. Test: ax-cli mcp test firebase
    `.trim(),
    usageExamples: [
      'Deploy Firebase Functions',
      'Manage Firestore database',
      'Configure Firebase Hosting',
      'Work with Firebase Authentication',
      'Monitor Firebase project'
    ],
    troubleshooting: [
      {
        issue: 'Service account error',
        solution: 'Verify service account JSON is valid and has required permissions. Ensure file path is correct.'
      }
    ]
  },

  postgres: {
    name: 'postgres',
    description: 'PostgreSQL MCP server for database operations',
    category: 'backend',
    officialServer: true,
    config: {
      name: 'postgres',
      transport: {
        type: 'stdio',
        command: 'npx',
        args: ['@modelcontextprotocol/server-postgres'],
        env: {}
      }
    },
    requiredEnv: [
      {
        name: 'DATABASE_URL',
        description: 'PostgreSQL connection string',
        url: 'https://www.postgresql.org/docs/current/libpq-connect.html#LIBPQ-CONNSTRING'
      }
    ],
    setupInstructions: `
1. Get your PostgreSQL connection string (format: postgresql://user:password@host:port/database)
2. Set environment variable: export DATABASE_URL="postgresql://..."
3. Run: ax-cli mcp add postgres --template
4. Test: ax-cli mcp test postgres
    `.trim(),
    usageExamples: [
      'Execute SQL queries',
      'Inspect database schema',
      'Manage tables and indexes',
      'Run migrations',
      'Analyze query performance'
    ],
    troubleshooting: [
      {
        issue: 'Connection failed',
        solution: 'Verify DATABASE_URL is correct. Check PostgreSQL is running and accessible. Ensure firewall allows connection.'
      },
      {
        issue: 'SSL required',
        solution: 'Add "?sslmode=require" to connection string if database requires SSL.'
      }
    ]
  },

  sqlite: {
    name: 'sqlite',
    description: 'SQLite MCP server for file-based database',
    category: 'backend',
    officialServer: true,
    config: {
      name: 'sqlite',
      transport: {
        type: 'stdio',
        command: 'npx',
        args: ['@modelcontextprotocol/server-sqlite'],
        env: {}
      }
    },
    requiredEnv: [
      {
        name: 'DATABASE_PATH',
        description: 'Path to SQLite database file',
        url: 'https://www.sqlite.org/docs.html'
      }
    ],
    setupInstructions: `
1. Locate your SQLite database file or create a new one
2. Set environment variable: export DATABASE_PATH="/path/to/database.db"
3. Run: ax-cli mcp add sqlite --template
4. Test: ax-cli mcp test sqlite
    `.trim(),
    usageExamples: [
      'Query local SQLite databases',
      'Inspect database schema',
      'Manage data in local development',
      'Lightweight data storage',
      'Testing and prototyping'
    ],
    troubleshooting: [
      {
        issue: 'File not found',
        solution: 'Verify DATABASE_PATH points to existing file. SQLite will create the file if it does not exist.'
      },
      {
        issue: 'Permission denied',
        solution: 'Check file permissions. Ensure the process has read/write access to the database file.'
      }
    ]
  }
};

/**
 * Get all available template names
 */
export function getTemplateNames(): string[] {
  return Object.keys(TEMPLATES).sort();
}

/**
 * Get template by name
 */
export function getTemplate(name: string): MCPServerTemplate | undefined {
  return TEMPLATES[name.toLowerCase()];
}

/**
 * Get templates by category
 */
export function getTemplatesByCategory(category: MCPServerTemplate['category']): MCPServerTemplate[] {
  return Object.values(TEMPLATES).filter(t => t.category === category);
}

/**
 * Search templates by keyword
 */
export function searchTemplates(query: string): MCPServerTemplate[] {
  const lowerQuery = query.toLowerCase();
  return Object.values(TEMPLATES).filter(template =>
    template.name.toLowerCase().includes(lowerQuery) ||
    template.description.toLowerCase().includes(lowerQuery) ||
    template.usageExamples.some(ex => ex.toLowerCase().includes(lowerQuery))
  );
}

/**
 * Check if a template exists
 */
export function hasTemplate(name: string): boolean {
  return name.toLowerCase() in TEMPLATES;
}

/**
 * Generate MCP config from template with environment variables
 */
export function generateConfigFromTemplate(
  templateName: string,
  envVars: Record<string, string>
): MCPServerConfig {
  const template = getTemplate(templateName);
  if (!template) {
    throw new Error(`Template "${templateName}" not found`);
  }

  // Clone the config to avoid mutating the template
  const config: MCPServerConfig = JSON.parse(JSON.stringify(template.config));

  // Inject environment variables
  if (config.transport.env) {
    config.transport.env = { ...config.transport.env, ...envVars };
  } else {
    config.transport.env = envVars;
  }

  // For HTTP/SSE transports, inject auth headers if needed
  if ((config.transport.type === 'http' || config.transport.type === 'sse') && config.transport.headers) {
    // Inject authorization tokens into headers if specified
    const headers = { ...config.transport.headers };

    // Common patterns
    if (envVars.GITHUB_TOKEN) {
      headers['Authorization'] = `Bearer ${envVars.GITHUB_TOKEN}`;
    }
    if (envVars.VERCEL_TOKEN) {
      headers['Authorization'] = `Bearer ${envVars.VERCEL_TOKEN}`;
    }
    if (envVars.NETLIFY_TOKEN) {
      headers['Authorization'] = `Bearer ${envVars.NETLIFY_TOKEN}`;
    }
    if (envVars.SENTRY_AUTH_TOKEN) {
      headers['Authorization'] = `Bearer ${envVars.SENTRY_AUTH_TOKEN}`;
    }

    config.transport.headers = headers;
  }

  return config;
}
