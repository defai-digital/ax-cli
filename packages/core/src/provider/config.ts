/**
 * Provider Configuration System
 *
 * Defines provider-specific configurations for GLM, Grok, and other providers.
 * Each provider has its own defaults, model configs, and feature flags.
 *
 * Model Configuration Priority:
 * 1. YAML files in config-defaults/ (e.g., grok-models.yaml) - Easy to edit
 * 2. Hardcoded TypeScript definitions below - Type-safe fallback
 *
 * To update models, edit the YAML files in packages/core/config-defaults/:
 * - grok-models.yaml - Grok (xAI) models
 * - glm-models.yaml - GLM (Z.AI) models
 * - ax-cli-models.yaml - Local/offline models
 */

import { homedir } from 'os';
import { join } from 'path';
import { loadProviderModelsFromYaml } from '../utils/config-loader.js';

/**
 * Model configuration for a specific model
 */
export interface ProviderModelConfig {
  name: string;
  contextWindow: number;
  maxOutputTokens: number;
  supportsThinking: boolean;
  supportsVision: boolean;
  supportsSearch: boolean;
  supportsSeed: boolean;
  defaultTemperature: number;
  description: string;
}

/**
 * Provider feature flags
 */
export interface ProviderFeatures {
  supportsThinking: boolean;
  supportsVision: boolean;
  supportsSearch: boolean;
  supportsSeed: boolean;
  supportsDoSample: boolean;
  /**
   * How thinking mode is activated:
   * - 'thinking_mode': GLM style - uses thinking_mode parameter
   * - 'reasoning_effort': Grok 3 style - uses reasoning_effort parameter (low/high)
   */
  thinkingModeStyle?: 'thinking_mode' | 'reasoning_effort';

  // ═══════════════════════════════════════════════════════════════════════════
  // Grok-specific capabilities (xAI Agent Tools API)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Server-side parallel function calling (xAI: parallel_function_calling)
   * When true, the API can execute multiple tool calls in parallel on the server.
   * Default is true for Grok models.
   */
  supportsParallelFunctionCalling?: boolean;

  /**
   * Server-side tools via xAI Agent Tools API
   * When true, tools like web_search, x_search, code_execution run on xAI infrastructure.
   */
  supportsServerTools?: boolean;

  /**
   * X (Twitter) posts search capability via x_search tool
   * Supports both keyword and semantic search modes.
   */
  supportsXSearch?: boolean;

  /**
   * Server-side code execution sandbox
   * Python code execution on xAI infrastructure with 30s timeout.
   */
  supportsCodeExecution?: boolean;
}

/**
 * Provider definition - full configuration for a provider
 * (Different from ProviderConfig which is API key config)
 */
export interface ProviderDefinition {
  /** Provider identifier (e.g., 'glm', 'grok') */
  name: string;
  /** Display name for UI (e.g., 'GLM (Z.AI)') */
  displayName: string;
  /** Environment variable for API key */
  apiKeyEnvVar: string;
  /** Alternative env vars for API key (fallbacks) */
  apiKeyEnvVarAliases?: string[];
  /** Default API base URL */
  defaultBaseURL: string;
  /** Default model (primary LLM for coding tasks) */
  defaultModel: string;
  /** Default vision model (for image analysis, if supported) */
  defaultVisionModel?: string;
  /** Fast model optimized for agentic/tool-calling tasks (used by --fast flag) */
  fastModel?: string;
  /** Supported models */
  models: Record<string, ProviderModelConfig>;
  /** Provider feature flags */
  features: ProviderFeatures;
  /** CLI branding */
  branding: {
    cliName: string;
    description: string;
    welcomeMessage: string;
    /** Primary color for UI elements (Ink color name) */
    primaryColor: string;
    /** Secondary/accent color */
    secondaryColor: string;
    /** ASCII art logo for welcome screen */
    asciiLogo: string;
    /** Short tagline */
    tagline: string;
  };
  /** Configuration directory name (e.g., '.ax-glm', '.ax-grok') */
  configDirName: string;
  /**
   * Provider-specific model aliases
   * Maps friendly names to actual model identifiers for this provider only
   * e.g., { 'grok-fast': 'grok-4.1-fast-reasoning' }
   */
  aliases?: Record<string, string>;
}

/**
 * GLM Provider Definition (Z.AI)
 */
export const GLM_PROVIDER: ProviderDefinition = {
  name: 'glm',
  displayName: 'GLM (Z.AI)',
  apiKeyEnvVar: 'ZAI_API_KEY',
  apiKeyEnvVarAliases: ['GLM_API_KEY', 'YOUR_API_KEY'],
  defaultBaseURL: 'https://api.z.ai/api/coding/paas/v4',
  defaultModel: 'glm-4.7',
  defaultVisionModel: 'glm-4.6v',
  fastModel: 'glm-4.5-air', // Fast model for agentic tasks (used by --fast flag) - glm-4-flash deprecated
  configDirName: '.ax-glm',
  // GLM-specific aliases (only for ax-glm users)
  aliases: {
    'glm-latest': 'glm-4.7',
    'glm-fast': 'glm-4.5-air',
    'glm-air': 'glm-4.5-air',
    'glm-vision': 'glm-4.6v',
    'glm-image': 'cogview-4',
    // Legacy alias for users still expecting 4.6
    'glm-4.6-legacy': 'glm-4.6',
    // Legacy alias for deprecated glm-4-flash model
    'glm-4-flash': 'glm-4.5-air',
  },
  models: {
    // ═══════════════════════════════════════════════════════════════════════
    // GLM-4.7 Series - Latest generation (December 2025)
    // 73.8% SWE-bench (+5.8%), 66.7% SWE-bench Multilingual (+12.9%)
    // 42.8% HLE benchmark (+12.4%)
    // ═══════════════════════════════════════════════════════════════════════
    'glm-4.7': {
      name: 'GLM-4.7',
      contextWindow: 131072,
      maxOutputTokens: 128000,
      supportsThinking: true,
      supportsVision: false,
      supportsSearch: false,
      supportsSeed: false,
      defaultTemperature: 0.7,
      description: 'Latest GLM with enhanced thinking modes (Interleaved, Preserved, Turn-level)',
    },
    // ═══════════════════════════════════════════════════════════════════════
    // GLM-4.6 Series - Previous generation
    // ═══════════════════════════════════════════════════════════════════════
    'glm-4.6': {
      name: 'GLM-4.6',
      contextWindow: 200000,
      maxOutputTokens: 128000,
      supportsThinking: true,
      supportsVision: false,
      supportsSearch: false,
      supportsSeed: false,
      defaultTemperature: 0.7,
      description: 'Previous generation GLM with 200K context window',
    },
    // Vision models - selected separately in setup (Step 2)
    'glm-4.6v': {
      name: 'GLM-4.6V',
      contextWindow: 128000,
      maxOutputTokens: 128000,
      supportsThinking: true,
      supportsVision: true,
      supportsSearch: false,
      supportsSeed: false,
      defaultTemperature: 0.7,
      description: 'Latest vision model with 128K context and thinking mode',
    },
    'glm-4.5v': {
      name: 'GLM-4.5V',
      contextWindow: 64000,
      maxOutputTokens: 16000,
      supportsThinking: true,
      supportsVision: true,
      supportsSearch: false,
      supportsSeed: false,
      defaultTemperature: 0.7,
      description: 'Vision model with 64K context (legacy)',
    },
    'glm-4': {
      name: 'GLM-4',
      contextWindow: 128000,
      maxOutputTokens: 8000,
      supportsThinking: false,
      supportsVision: false,
      supportsSearch: false,
      supportsSeed: false,
      defaultTemperature: 0.7,
      description: 'Standard GLM-4 model',
    },
    'glm-4.5-air': {
      name: 'GLM-4.5 Air',
      contextWindow: 128000,
      maxOutputTokens: 8000,
      supportsThinking: true,
      supportsVision: false,
      supportsSearch: false,
      supportsSeed: false,
      defaultTemperature: 0.7,
      description: 'Lightweight 106B MoE model (12B active), fast responses for agentic tasks',
    },
    // Image generation model
    'cogview-4': {
      name: 'CogView-4',
      contextWindow: 4096,
      maxOutputTokens: 1024,
      supportsThinking: false,
      supportsVision: false,
      supportsSearch: false,
      supportsSeed: true,
      defaultTemperature: 0.7,
      description: 'Text-to-image generation model with variable resolutions',
    },
  },
  features: {
    supportsThinking: true,
    supportsVision: true, // Via separate visionModel config (glm-4.6v default)
    supportsSearch: false,
    supportsSeed: false,
    supportsDoSample: true,
    thinkingModeStyle: 'thinking_mode',
  },
  branding: {
    cliName: 'ax-glm',
    description: 'GLM-optimized AI coding assistant powered by Z.AI',
    welcomeMessage: '🔥 Starting AX-GLM AI Assistant (powered by Z.AI)...',
    primaryColor: '#FF6600',
    secondaryColor: '#FF3300',
    tagline: 'Powered by Z.AI',
    asciiLogo: `
   █████╗ ██╗  ██╗     ██████╗ ██╗     ███╗   ███╗
  ██╔══██╗╚██╗██╔╝    ██╔════╝ ██║     ████╗ ████║
  ███████║ ╚███╔╝     ██║  ███╗██║     ██╔████╔██║
  ██╔══██║ ██╔██╗     ██║   ██║██║     ██║╚██╔╝██║
  ██║  ██║██╔╝ ██╗    ╚██████╔╝███████╗██║ ╚═╝ ██║
  ╚═╝  ╚═╝╚═╝  ╚═╝     ╚═════╝ ╚══════╝╚═╝     ╚═╝`,
  },
};

/**
 * Grok Provider Definition (xAI)
 *
 * Default model: grok-code-fast-1 (best for agentic coding)
 * - 70.8% SWE-bench, 256K context, ~92 tok/s
 * - Optimized for tool use (grep, terminal, file editing)
 * - $0.20/1M input, $1.50/1M output tokens
 *
 * All Grok models available via xAI API:
 * - grok-code-fast-1: NEW - Agentic coding specialist (default)
 * - grok-4.1: Latest stable with improved accuracy
 * - grok-4.1-fast-reasoning: 2M context with reasoning
 * - grok-4.1-fast-non-reasoning: Fast tool use without reasoning
 * - grok-4.1-mini: Smaller, faster variant
 * - grok-4-0709: Original Grok-4 release (July 2025)
 *
 * Aliases: grok-code/grok-fast -> grok-code-fast-1, grok-latest -> grok-4.1
 */
export const GROK_PROVIDER: ProviderDefinition = {
  name: 'grok',
  displayName: 'Grok (xAI)',
  apiKeyEnvVar: 'XAI_API_KEY',
  apiKeyEnvVarAliases: ['GROK_API_KEY'],
  defaultBaseURL: 'https://api.x.ai/v1',
  defaultModel: 'grok-code-fast-1', // Best for agentic coding (256K context, 70.8% SWE-bench)
  fastModel: 'grok-code-fast-1', // Same as default - optimized for tool use
  // NOTE: Grok-4 has built-in vision, thinking, and search - no separate vision model needed
  configDirName: '.ax-grok',
  // Grok-specific aliases (only for ax-grok users)
  aliases: {
    'grok-latest': 'grok-4.1',
    'grok-code': 'grok-code-fast-1',
    'grok-fast': 'grok-code-fast-1', // Updated: grok-code-fast-1 is the new fast model
    'grok-fast-reasoning': 'grok-4.1-fast-reasoning',
    'grok-fast-nr': 'grok-4.1-fast-non-reasoning',
    'grok-mini': 'grok-4.1-mini',
    'grok-image': 'grok-2-image-1212',
  },
  models: {
    // ═══════════════════════════════════════════════════════════════════════
    // Grok Code Fast 1 - Agentic Coding Model (August 2025)
    // 70.8% SWE-bench, 256K context, optimized for tool use
    // $0.20/1M input, $1.50/1M output, $0.02/1M cached
    // ═══════════════════════════════════════════════════════════════════════
    'grok-code-fast-1': {
      name: 'Grok Code Fast 1',
      contextWindow: 256000, // 256K context
      maxOutputTokens: 16000, // 16K output per request
      supportsThinking: true, // Exposes reasoning traces
      supportsVision: false, // Text mode only
      supportsSearch: false, // No built-in search
      supportsSeed: true,
      defaultTemperature: 0.7,
      description: 'Best for agentic coding: 70.8% SWE-bench, 256K context, ~92 tok/s',
    },
    // ═══════════════════════════════════════════════════════════════════════
    // Grok 4.1 Series - Latest generation (November 2025)
    // ═══════════════════════════════════════════════════════════════════════
    'grok-4.1': {
      name: 'Grok-4.1',
      contextWindow: 131072,
      maxOutputTokens: 131072,
      supportsThinking: true,
      supportsVision: true,
      supportsSearch: false, // xAI deprecated live search (HTTP 410)
      supportsSeed: true,
      defaultTemperature: 0.7,
      description: 'Latest stable: improved accuracy, lower hallucination',
    },
    'grok-4.1-fast-reasoning': {
      name: 'Grok-4.1 Fast (Reasoning)',
      contextWindow: 2097152, // 2M context window
      maxOutputTokens: 131072,
      supportsThinking: true,
      supportsVision: true,
      supportsSearch: false, // xAI deprecated live search (HTTP 410)
      supportsSeed: true,
      defaultTemperature: 0.7,
      description: 'Best tool-calling with 2M context, includes reasoning',
    },
    'grok-4.1-fast-non-reasoning': {
      name: 'Grok-4.1 Fast (Non-Reasoning)',
      contextWindow: 2097152, // 2M context window
      maxOutputTokens: 131072,
      supportsThinking: false,
      supportsVision: true,
      supportsSearch: false, // xAI deprecated live search (HTTP 410)
      supportsSeed: true,
      defaultTemperature: 0.7,
      description: 'Fastest tool-calling with 2M context, no reasoning',
    },
    'grok-4.1-mini': {
      name: 'Grok-4.1 Mini',
      contextWindow: 131072,
      maxOutputTokens: 32768,
      supportsThinking: true,
      supportsVision: true,
      supportsSearch: false, // xAI deprecated live search (HTTP 410)
      supportsSeed: true,
      defaultTemperature: 0.7,
      description: 'Smaller, faster, cost-effective variant',
    },
    // ═══════════════════════════════════════════════════════════════════════
    // Grok 4.0 Series - Original release (July 2025)
    // ═══════════════════════════════════════════════════════════════════════
    'grok-4': {
      name: 'Grok-4 (Alias)',
      contextWindow: 131072,
      maxOutputTokens: 131072,
      supportsThinking: true,
      supportsVision: true,
      supportsSearch: false, // xAI deprecated live search (HTTP 410)
      supportsSeed: true,
      defaultTemperature: 0.7,
      description: 'Alias to latest stable Grok-4 version (recommended)',
    },
    'grok-4-0709': {
      name: 'Grok-4 (July 2025)',
      contextWindow: 131072,
      maxOutputTokens: 131072,
      supportsThinking: true,
      supportsVision: true,
      supportsSearch: false, // xAI deprecated live search (HTTP 410)
      supportsSeed: true,
      defaultTemperature: 0.7,
      description: 'Original Grok-4 release: reasoning, coding, vision, search',
    },
    // ═══════════════════════════════════════════════════════════════════════
    // Specialized Models
    // ═══════════════════════════════════════════════════════════════════════
    'grok-2-image-1212': {
      name: 'Grok-2 Image',
      contextWindow: 32768,
      maxOutputTokens: 8192,
      supportsThinking: false,
      supportsVision: false,
      supportsSearch: false,
      supportsSeed: true,
      defaultTemperature: 0.7,
      description: 'Text-to-image generation model',
    },
    // ═══════════════════════════════════════════════════════════════════════
    // Legacy Models (Grok 3.x and 2.x) - Backward Compatibility
    // These models are still available on xAI API for existing users
    // ═══════════════════════════════════════════════════════════════════════
    'grok-3': {
      name: 'Grok-3',
      contextWindow: 131072,
      maxOutputTokens: 32768,
      supportsThinking: true,
      supportsVision: false,
      supportsSearch: false, // xAI deprecated live search (HTTP 410)
      supportsSeed: true,
      defaultTemperature: 0.7,
      description: 'Legacy Grok-3 with extended thinking',
    },
    'grok-3-mini': {
      name: 'Grok-3 Mini',
      contextWindow: 131072,
      maxOutputTokens: 32768,
      supportsThinking: true,
      supportsVision: false,
      supportsSearch: false, // xAI deprecated live search (HTTP 410)
      supportsSeed: true,
      defaultTemperature: 0.7,
      description: 'Legacy Grok-3 smaller variant',
    },
    'grok-2-1212': {
      name: 'Grok-2 (Dec 2024)',
      contextWindow: 131072,
      maxOutputTokens: 32768,
      supportsThinking: false,
      supportsVision: false,
      supportsSearch: false, // xAI deprecated live search (HTTP 410)
      supportsSeed: true,
      defaultTemperature: 0.7,
      description: 'Legacy Grok-2 December 2024 release',
    },
    'grok-2-vision-1212': {
      name: 'Grok-2 Vision',
      contextWindow: 32768,
      maxOutputTokens: 8192,
      supportsThinking: false,
      supportsVision: true,
      supportsSearch: false,
      supportsSeed: true,
      defaultTemperature: 0.7,
      description: 'Legacy Grok-2 with vision capabilities',
    },
    'grok-beta': {
      name: 'Grok Beta',
      contextWindow: 131072,
      maxOutputTokens: 32768,
      supportsThinking: false,
      supportsVision: false,
      supportsSearch: false,
      supportsSeed: true,
      defaultTemperature: 0.7,
      description: 'Legacy Grok beta model',
    },
    'grok-vision-beta': {
      name: 'Grok Vision Beta',
      contextWindow: 32768,
      maxOutputTokens: 8192,
      supportsThinking: false,
      supportsVision: true,
      supportsSearch: false,
      supportsSeed: true,
      defaultTemperature: 0.7,
      description: 'Legacy Grok vision beta model',
    },
  },
  features: {
    supportsThinking: true, // Grok-4 reasoning_effort (low/high)
    supportsVision: true,   // Grok-4 has built-in vision
    supportsSearch: false,  // xAI deprecated live search (HTTP 410) — use x_search server tool instead
    supportsSeed: true,
    supportsDoSample: false,
    thinkingModeStyle: 'reasoning_effort',
    // Grok-specific capabilities (xAI Agent Tools API)
    supportsParallelFunctionCalling: true,  // parallel_function_calling=true (default)
    supportsServerTools: true,              // web_search, x_search, code_execution
    supportsXSearch: true,                  // X/Twitter posts search
    supportsCodeExecution: true,            // Server-side Python execution
  },
  branding: {
    cliName: 'ax-grok',
    description: 'Grok-optimized AI coding assistant powered by xAI',
    welcomeMessage: '⚡ Starting AX-Grok AI Assistant (powered by xAI)...',
    primaryColor: '#C0C0C0',
    secondaryColor: 'gray',
    tagline: 'Powered by xAI',
    asciiLogo: `
   █████╗ ██╗  ██╗     ██████╗ ██████╗  ██████╗ ██╗  ██╗
  ██╔══██╗╚██╗██╔╝    ██╔════╝ ██╔══██╗██╔═══██╗██║ ██╔╝
  ███████║ ╚███╔╝     ██║  ███╗██████╔╝██║   ██║█████╔╝
  ██╔══██║ ██╔██╗     ██║   ██║██╔══██╗██║   ██║██╔═██╗
  ██║  ██║██╔╝ ██╗    ╚██████╔╝██║  ██║╚██████╔╝██║  ██╗
  ╚═╝  ╚═╝╚═╝  ╚═╝     ╚═════╝ ╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═╝`,
  },
};

/**
 * AX CLI Provider Definition
 *
 * AX-CLI focuses on LOCAL/OFFLINE inference via:
 * - Ollama (primary)
 * - LMStudio
 * - vLLM
 *
 * Model families supported (user specifies exact tag in local server):
 * - Qwen - Best overall for coding
 * - GLM - Great for refactoring and docs
 * - DeepSeek - Fast iterations
 * - Codestral/Mistral - Strong for C/C++/Rust
 * - Llama - Best compatibility
 *
 * For Grok cloud features, use ax-grok.
 * For GLM cloud, use OpenCode (https://opencode.ai).
 */
export const AX_CLI_PROVIDER: ProviderDefinition = {
  name: 'ax-cli',
  displayName: 'AX CLI',
  apiKeyEnvVar: 'AX_API_KEY',
  apiKeyEnvVarAliases: ['AXCLI_API_KEY'],
  defaultBaseURL: 'http://localhost:11434/v1', // Default to Ollama (local)
  defaultModel: 'qwen3',  // User specifies exact tag (e.g., qwen3:14b) in their local server
  fastModel: 'deepseek-coder', // Fast model for agentic tasks
  configDirName: '.ax-cli',
  // ═══════════════════════════════════════════════════════════════════════
  // Local/Offline Model Families
  //
  // These are generic model family definitions with reasonable defaults.
  // Users specify the exact model tag (e.g., "qwen3:14b", "glm4:9b") when
  // configuring their local server (Ollama, LMStudio, vLLM).
  //
  // The metadata here provides context window estimates for token counting.
  // Any model available on your local server will work - not limited to this list.
  // ═══════════════════════════════════════════════════════════════════════
  models: {
    // Qwen - Best overall for coding (T1)
    'qwen': {
      name: 'Qwen',
      contextWindow: 128000,
      maxOutputTokens: 8192,
      supportsThinking: false,
      supportsVision: false,
      supportsSearch: false,
      supportsSeed: false,
      defaultTemperature: 0.7,
      description: 'Best overall coding model, 128K context',
    },
    // GLM - Best for refactoring and docs (T2)
    'glm': {
      name: 'GLM',
      contextWindow: 128000,
      maxOutputTokens: 8192,
      supportsThinking: false,
      supportsVision: false,
      supportsSearch: false,
      supportsSeed: false,
      defaultTemperature: 0.7,
      description: 'Great for refactoring and documentation',
    },
    // DeepSeek - Best speed/value (T3)
    'deepseek': {
      name: 'DeepSeek',
      contextWindow: 64000,
      maxOutputTokens: 8192,
      supportsThinking: false,
      supportsVision: false,
      supportsSearch: false,
      supportsSeed: false,
      defaultTemperature: 0.7,
      description: 'Fast iterations, good speed/quality ratio',
    },
    // Codestral/Mistral - Strong for systems languages (T4)
    'codestral': {
      name: 'Codestral',
      contextWindow: 32000,
      maxOutputTokens: 8192,
      supportsThinking: false,
      supportsVision: false,
      supportsSearch: false,
      supportsSeed: false,
      defaultTemperature: 0.7,
      description: 'Strong in C/C++/Rust',
    },
    // Llama - Best compatibility/fallback (T5)
    'llama': {
      name: 'Llama',
      contextWindow: 128000,
      maxOutputTokens: 8192,
      supportsThinking: false,
      supportsVision: false,
      supportsSearch: false,
      supportsSeed: false,
      defaultTemperature: 0.7,
      description: 'Best compatibility, works with all frameworks',
    },
  },
  features: {
    supportsThinking: false,  // No extended thinking in base CLI
    supportsVision: false,    // No vision - use ax-glm or ax-grok
    supportsSearch: false,    // No web search - use ax-glm or ax-grok
    supportsSeed: false,      // No seed support
    supportsDoSample: false,  // No doSample
    thinkingModeStyle: undefined,
  },
  branding: {
    cliName: 'ax-cli',
    description: 'Local-First AI Command Line Interface',
    welcomeMessage: '💎 Starting AX-CLI AI Assistant (Local/Offline)...',
    primaryColor: 'green',
    secondaryColor: 'blue',
    tagline: 'Local AI Coding Assistant',
    asciiLogo: `
   █████╗ ██╗  ██╗      ██████╗██╗     ██╗
  ██╔══██╗╚██╗██╔╝     ██╔════╝██║     ██║
  ███████║ ╚███╔╝█████╗██║     ██║     ██║
  ██╔══██║ ██╔██╗╚════╝██║     ██║     ██║
  ██║  ██║██╔╝ ██╗     ╚██████╗███████╗██║
  ╚═╝  ╚═╝╚═╝  ╚═╝      ╚═════╝╚══════╝╚═╝`,
  },
};

/**
 * Default provider (AX CLI)
 */
export const DEFAULT_PROVIDER = AX_CLI_PROVIDER;

// Cache for providers with YAML models merged in
let _providersWithYaml: Record<string, ProviderDefinition> | null = null;

/**
 * Load provider definition with YAML models merged in
 * YAML takes priority over hardcoded models for easy updates
 *
 * @param baseProvider - The base hardcoded provider definition
 * @returns Provider with YAML models merged in (or original if YAML not found)
 */
function loadProviderWithYamlModels(baseProvider: ProviderDefinition): ProviderDefinition {
  try {
    const yamlModels = loadProviderModelsFromYaml(baseProvider.name);
    if (!yamlModels) {
      return baseProvider; // No YAML file, use hardcoded
    }

    // Merge YAML models into provider definition (YAML takes priority)
    return {
      ...baseProvider,
      defaultModel: yamlModels.defaultModel,
      fastModel: yamlModels.fastModel,
      defaultVisionModel: yamlModels.defaultVisionModel ?? baseProvider.defaultVisionModel,
      models: yamlModels.models,
      aliases: yamlModels.aliases ?? baseProvider.aliases,
    };
  } catch {
    // On any error, fall back to hardcoded
    return baseProvider;
  }
}

/**
 * Get all providers with YAML models merged in
 * Cached for performance
 */
function getProvidersWithYaml(): Record<string, ProviderDefinition> {
  if (_providersWithYaml) return _providersWithYaml;

  _providersWithYaml = {
    'ax-cli': loadProviderWithYamlModels(AX_CLI_PROVIDER),
    glm: loadProviderWithYamlModels(GLM_PROVIDER),
    grok: loadProviderWithYamlModels(GROK_PROVIDER),
  };

  return _providersWithYaml;
}

/**
 * Get provider definition by name (case-insensitive)
 * Loads models from YAML files when available for easy updates
 */
export function getProviderDefinition(name: string): ProviderDefinition | undefined {
  const providers = getProvidersWithYaml();
  return providers[name.toLowerCase()];
}

/**
 * Get all available providers
 * Loads models from YAML files when available for easy updates
 */
export function getAvailableProviders(): ProviderDefinition[] {
  return Object.values(getProvidersWithYaml());
}

/**
 * Clear the providers cache (useful for testing or reloading)
 */
export function clearProvidersCache(): void {
  _providersWithYaml = null;
}

/**
 * Get model config from provider
 */
export function getProviderModelConfig(
  provider: ProviderDefinition,
  modelName: string
): ProviderModelConfig | undefined {
  return provider.models[modelName];
}

/**
 * Get API key from environment for a provider
 */
export function getApiKeyFromEnv(provider: ProviderDefinition): string | undefined {
  // Check primary env var
  let apiKey = process.env[provider.apiKeyEnvVar];

  // Check aliases
  if (!apiKey && provider.apiKeyEnvVarAliases) {
    for (const alias of provider.apiKeyEnvVarAliases) {
      apiKey = process.env[alias];
      if (apiKey) break;
    }
  }

  return apiKey;
}

/**
 * File names for config files
 */
export const CONFIG_FILE_NAMES = {
  USER_CONFIG: 'config.json',
  PROJECT_SETTINGS: 'settings.json',
  CUSTOM_MD: 'CUSTOM.md',
  AX_MD: 'AX.md',
  INDEX_JSON: 'index.json',
  MEMORY_JSON: 'memory.json',
  HISTORY_JSON: 'history.json',
  SESSIONS_DIR: 'sessions',
  TEMPLATES_DIR: 'templates',
  PLANS_DIR: 'plans',
  BACKUPS_DIR: 'backups',
  CACHE_DIR: 'cache',
} as const;

/**
 * Config paths structure for a provider
 */
export interface ProviderConfigPaths {
  /** Configuration directory name */
  DIR_NAME: string;
  /** User-level settings directory */
  USER_DIR: string;
  /** User-level configuration file */
  USER_CONFIG: string;
  /** Project-level settings directory */
  PROJECT_DIR: string;
  /** Project-level settings file */
  PROJECT_SETTINGS: string;
  /** Custom instructions file path (project-level) */
  CUSTOM_MD: string;
  /** Root project context file path (like CLAUDE.md) */
  AX_MD: string;
  /** Project index file path (project-level) */
  INDEX_JSON: string;
  /** Project memory file path (project-level) */
  MEMORY_JSON: string;
  /** User templates directory */
  USER_TEMPLATES_DIR: string;
  /** User plans directory */
  USER_PLANS_DIR: string;
  /** User history file */
  USER_HISTORY: string;
  /** User sessions directory */
  USER_SESSIONS_DIR: string;
}

/**
 * Get config paths for a specific provider
 */
export function getProviderConfigPaths(provider: ProviderDefinition): ProviderConfigPaths {
  const configDirName = provider.configDirName;

  return {
    DIR_NAME: configDirName,
    USER_DIR: join(homedir(), configDirName),
    USER_CONFIG: join(homedir(), configDirName, CONFIG_FILE_NAMES.USER_CONFIG),
    PROJECT_DIR: join(process.cwd(), configDirName),
    PROJECT_SETTINGS: join(process.cwd(), configDirName, CONFIG_FILE_NAMES.PROJECT_SETTINGS),
    CUSTOM_MD: join(process.cwd(), configDirName, CONFIG_FILE_NAMES.CUSTOM_MD),
    AX_MD: join(process.cwd(), CONFIG_FILE_NAMES.AX_MD),
    INDEX_JSON: join(process.cwd(), configDirName, CONFIG_FILE_NAMES.INDEX_JSON),
    MEMORY_JSON: join(process.cwd(), configDirName, CONFIG_FILE_NAMES.MEMORY_JSON),
    USER_TEMPLATES_DIR: join(homedir(), configDirName, CONFIG_FILE_NAMES.TEMPLATES_DIR),
    USER_PLANS_DIR: join(homedir(), configDirName, CONFIG_FILE_NAMES.PLANS_DIR),
    USER_HISTORY: join(homedir(), configDirName, CONFIG_FILE_NAMES.HISTORY_JSON),
    USER_SESSIONS_DIR: join(homedir(), configDirName, CONFIG_FILE_NAMES.SESSIONS_DIR),
  };
}

/**
 * Get config paths for a provider by name
 */
export function getConfigPathsByProviderName(providerName: string): ProviderConfigPaths | undefined {
  const provider = getProviderDefinition(providerName);
  if (!provider) return undefined;
  return getProviderConfigPaths(provider);
}

// Current active provider (set by cli-factory)
let activeProvider: ProviderDefinition | null = null;

// Cache the priority registry update function to avoid repeated dynamic imports
let _updatePriorityRegistryProvider: ((provider: ProviderDefinition) => void) | null = null;

// Flag to track if priority registry initialization is pending
let _priorityRegistryInitPending = false;

/**
 * Set the active provider (called by cli-factory on startup)
 *
 * NOTE: This function is synchronous and does not update the priority registry.
 * Call initializePriorityRegistry() after this to update the priority registry.
 * This avoids race conditions from async imports in a sync function.
 */
export function setActiveProviderConfigPaths(provider: ProviderDefinition): void {
  activeProvider = provider;

  // If priority registry is already loaded, update it synchronously
  if (_updatePriorityRegistryProvider) {
    _updatePriorityRegistryProvider(provider);
  } else {
    // Mark that we need to update when initialized
    _priorityRegistryInitPending = true;
  }
}

/**
 * Initialize the priority registry
 * Call this early in the startup sequence to ensure the registry is ready.
 * Safe to call multiple times - only loads the module once.
 */
export async function initializePriorityRegistry(): Promise<void> {
  if (_updatePriorityRegistryProvider) {
    // Already loaded - just update if pending
    if (_priorityRegistryInitPending && activeProvider) {
      _updatePriorityRegistryProvider(activeProvider);
      _priorityRegistryInitPending = false;
    }
    return;
  }

  try {
    const { updatePriorityRegistryProvider } = await import('../tools/priority-registry.js');
    _updatePriorityRegistryProvider = updatePriorityRegistryProvider;

    // Apply pending update
    if (activeProvider) {
      updatePriorityRegistryProvider(activeProvider);
    }
    _priorityRegistryInitPending = false;
  } catch {
    // Silent fail - priority registry is not critical for basic operation
  }
}

/**
 * Get the active provider definition
 * Falls back to GLM provider if not set
 */
export function getActiveProvider(): ProviderDefinition {
  return activeProvider || GLM_PROVIDER;
}

/**
 * Get the active provider config paths
 * Falls back to GLM provider if not set
 *
 * IMPORTANT: Always computes paths dynamically to handle cwd changes.
 * PROJECT_* paths depend on process.cwd(), so caching would cause stale paths
 * if the working directory changes during the session.
 */
export function getActiveConfigPaths(): ProviderConfigPaths {
  // Always compute dynamically - PROJECT_* paths use process.cwd()
  // which can change during the session (e.g., if a tool changes directory)
  const provider = activeProvider || GLM_PROVIDER;
  return getProviderConfigPaths(provider);
}

/**
 * @deprecated Use provider.aliases instead. This global constant will be removed in a future version.
 * Model aliases for convenient model selection - LEGACY, kept for backward compatibility
 */
export const MODEL_ALIASES: Record<string, string> = {
  // Combined for backward compatibility only - prefer provider.aliases
  ...GLM_PROVIDER.aliases,
  ...GROK_PROVIDER.aliases,
};

/**
 * Resolve a model name, handling aliases
 * Prefers provider-specific aliases if provider is specified
 *
 * @param modelName - Model name or alias
 * @param provider - Optional provider to use provider-specific aliases
 * @returns Resolved model name
 *
 * @example
 * resolveModelAlias('grok-fast', GROK_PROVIDER)  // Returns 'grok-4.1-fast-reasoning'
 * resolveModelAlias('glm-4.6')                   // Returns 'glm-4.6' (unchanged)
 */
export function resolveModelAlias(modelName: string, provider?: ProviderDefinition): string {
  const lowerName = modelName.toLowerCase();

  // First, try provider-specific aliases
  if (provider?.aliases) {
    const providerAlias = provider.aliases[lowerName];
    if (providerAlias) {
      return providerAlias;
    }
  }

  // Fall back to global aliases for backward compatibility
  return MODEL_ALIASES[lowerName] || modelName;
}

/**
 * Get all model aliases for a provider
 * Uses provider-specific aliases (provider.aliases)
 *
 * @param provider - Provider definition
 * @returns Array of alias entries { alias, model, description }
 */
export function getProviderModelAliases(
  provider: ProviderDefinition
): Array<{ alias: string; model: string; description: string }> {
  const aliases: Array<{ alias: string; model: string; description: string }> = [];

  // Use provider-specific aliases
  if (provider.aliases) {
    for (const [alias, model] of Object.entries(provider.aliases)) {
      const modelConfig = provider.models[model];
      if (modelConfig) {
        aliases.push({
          alias,
          model,
          description: modelConfig.description,
        });
      }
    }
  }

  return aliases;
}

/**
 * Check if a model name is an alias for a given provider
 *
 * @param modelName - Model name to check
 * @param provider - Optional provider for provider-specific check
 */
export function isModelAlias(modelName: string, provider?: ProviderDefinition): boolean {
  const lowerName = modelName.toLowerCase();

  // Check provider-specific aliases first
  if (provider?.aliases && lowerName in provider.aliases) {
    return true;
  }

  // Fall back to global check
  return lowerName in MODEL_ALIASES;
}

/**
 * Get list of all available models for a provider (including aliases)
 * Useful for CLI model selection and validation
 *
 * @param provider - Provider definition
 * @returns Array of model entries with name, alias (if any), and description
 */
export function getAvailableModelsWithAliases(
  provider: ProviderDefinition
): Array<{ model: string; alias?: string; description: string; isDefault: boolean }> {
  const result: Array<{ model: string; alias?: string; description: string; isDefault: boolean }> = [];

  // Build reverse lookup for aliases from provider-specific aliases
  const aliasLookup: Record<string, string> = {};
  if (provider.aliases) {
    for (const [alias, model] of Object.entries(provider.aliases)) {
      aliasLookup[model] = alias;
    }
  }

  // Add all models
  for (const [modelId, config] of Object.entries(provider.models)) {
    result.push({
      model: modelId,
      alias: aliasLookup[modelId],
      description: config.description,
      isDefault: modelId === provider.defaultModel,
    });
  }

  return result;
}
