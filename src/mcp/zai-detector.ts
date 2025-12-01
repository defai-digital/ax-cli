/**
 * Z.AI Service Detector
 *
 * Detects Z.AI configuration, validates API keys, and manages
 * Z.AI MCP server enablement status.
 */

import { getSettingsManager } from '../utils/settings-manager.js';
import { loadMCPConfig } from './config.js';
import {
  ZAI_SERVER_NAMES,
  ZAI_VISION_PACKAGE,
  type ZAIServerName,
  type ZAIPlanTier,
} from './zai-templates.js';

/**
 * Z.AI service status
 */
export interface ZAIServiceStatus {
  /** Whether a Z.AI API key is configured */
  hasApiKey: boolean;
  /** Whether the current model is a GLM model */
  isGLMModel: boolean;
  /** Detected plan tier (if determinable) */
  planTier?: ZAIPlanTier;
  /** List of enabled Z.AI MCP servers */
  enabledServers: ZAIServerName[];
  /** Node.js version check for vision server */
  nodeVersionOk: boolean;
  /** Current Node.js version */
  nodeVersion: string;
}

/**
 * Z.AI base URLs that indicate GLM usage
 */
const ZAI_BASE_URLS = [
  'api.z.ai',
  'open.z.ai',
  'open.bigmodel.cn',
  'chatglm.cn',
] as const;

/**
 * GLM model name patterns
 */
const GLM_MODEL_PATTERNS = [
  /^glm/i,
  /^chatglm/i,
  /^codegeex/i,
  /^cogview/i,
  /^cogvideo/i,
] as const;

/**
 * Check if a model name is a GLM model
 */
export function isGLMModel(model: string): boolean {
  if (!model) return false;
  return GLM_MODEL_PATTERNS.some(pattern => pattern.test(model));
}

/**
 * Check if a base URL is a Z.AI endpoint
 */
export function isZAIBaseURL(baseURL: string): boolean {
  if (!baseURL) return false;
  const lowerURL = baseURL.toLowerCase();
  return ZAI_BASE_URLS.some(domain => lowerURL.includes(domain));
}

/**
 * Get current Node.js version
 */
function getNodeVersion(): string {
  return process.version.replace(/^v/, '');
}

/**
 * Check if Node.js version meets minimum requirement
 */
function checkNodeVersion(minVersion: string): boolean {
  const current = getNodeVersion().split('.').map(Number);
  const required = minVersion.split('.').map(Number);

  for (let i = 0; i < Math.max(current.length, required.length); i++) {
    const curr = current[i] || 0;
    const req = required[i] || 0;
    if (curr > req) return true;
    if (curr < req) return false;
  }
  return true;
}

/**
 * Detect Z.AI services status
 */
export async function detectZAIServices(): Promise<ZAIServiceStatus> {
  const settings = getSettingsManager();

  // Check for API key
  const apiKey = settings.getApiKey() || '';
  const hasApiKey = apiKey.length > 0;

  // Check if using GLM model
  const model = settings.getCurrentModel() || process.env.AI_MODEL || '';
  const baseURL = settings.getBaseURL() || '';
  const isGLM = isGLMModel(model) || isZAIBaseURL(baseURL);

  // Check Node.js version for vision server
  const nodeVersion = getNodeVersion();
  const nodeVersionOk = checkNodeVersion(ZAI_VISION_PACKAGE.minNodeVersion);

  // Check which Z.AI servers are already configured
  const enabledServers = await getEnabledZAIServers();

  return {
    hasApiKey,
    isGLMModel: isGLM,
    enabledServers,
    nodeVersionOk,
    nodeVersion,
  };
}

/**
 * Get list of enabled Z.AI MCP servers from config
 */
export async function getEnabledZAIServers(): Promise<ZAIServerName[]> {
  try {
    const mcpConfig = loadMCPConfig();
    if (!mcpConfig?.servers) return [];

    const serverNames = mcpConfig.servers.map(s => s.name);
    const zaiServers = Object.values(ZAI_SERVER_NAMES);

    return serverNames.filter((name): name is ZAIServerName =>
      zaiServers.includes(name as ZAIServerName)
    );
  } catch {
    return [];
  }
}

/**
 * Validate Z.AI API key by making a test request
 *
 * @param apiKey - The API key to validate
 * @returns true if valid, false otherwise
 */
export async function validateZAIApiKey(apiKey: string): Promise<boolean> {
  if (!apiKey || apiKey.trim().length === 0) {
    return false;
  }

  try {
    // Make a lightweight request to validate the key
    // Using the models endpoint as it's fast and doesn't consume quota
    const response = await fetch('https://open.z.ai/api/v1/models', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(5000),
    });

    return response.ok;
  } catch {
    // Network error or timeout - assume key might be valid
    // Better to allow setup to continue than block on network issues
    return true;
  }
}

/**
 * Get Z.AI API key from config or environment
 */
export function getZAIApiKey(): string | null {
  const settings = getSettingsManager();
  const apiKey = settings.getApiKey() || process.env.Z_AI_API_KEY;

  if (apiKey && apiKey.trim().length > 0) {
    return apiKey.trim();
  }

  return null;
}

/**
 * Check if Z.AI MCP is fully configured
 */
export async function isZAIMCPConfigured(): Promise<boolean> {
  const status = await detectZAIServices();
  return status.hasApiKey && status.enabledServers.length > 0;
}

/**
 * Get recommended servers based on system capabilities
 */
export function getRecommendedServers(status: ZAIServiceStatus): ZAIServerName[] {
  const recommended: ZAIServerName[] = [
    ZAI_SERVER_NAMES.WEB_SEARCH,
    ZAI_SERVER_NAMES.WEB_READER,
  ];

  // Only recommend vision if Node.js version is sufficient
  if (status.nodeVersionOk) {
    recommended.push(ZAI_SERVER_NAMES.VISION);
  }

  return recommended;
}

/**
 * Format status for display
 */
export function formatZAIStatus(status: ZAIServiceStatus): string {
  const lines: string[] = [];

  lines.push('Z.AI MCP Status');
  lines.push('===============');
  lines.push('');
  lines.push(`API Key: ${status.hasApiKey ? '✓ Configured' : '✗ Not configured'}`);
  lines.push(`GLM Model: ${status.isGLMModel ? '✓ Detected' : '○ Not detected'}`);
  lines.push(`Node.js: v${status.nodeVersion} ${status.nodeVersionOk ? '✓' : `(v${ZAI_VISION_PACKAGE.minNodeVersion}+ required for vision)`}`);
  lines.push('');
  lines.push('Enabled Servers:');

  if (status.enabledServers.length === 0) {
    lines.push('  (none)');
  } else {
    for (const server of status.enabledServers) {
      lines.push(`  ✓ ${server}`);
    }
  }

  return lines.join('\n');
}
