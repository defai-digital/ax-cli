/**
 * Agent-First Router - MVP Implementation
 *
 * Lightweight router that matches user input to AutomatosX agents.
 * Pure functions, session-cached availability, keyword-based matching.
 *
 * @module agent-router
 */

import { existsSync, readdirSync } from 'fs';
import { join } from 'path';
import type { AgentFirstSettings } from '../schemas/settings-schemas.js';

/**
 * Result of agent routing decision
 */
export interface AgentRoutingResult {
  /** Selected agent name, or null to use direct LLM */
  agent: string | null;
  /** System prefix to inject into conversation */
  systemPrefix: string;
  /** Transparency note shown in UI */
  transparencyNote: string;
  /** Confidence score (0-1) */
  confidence: number;
  /** Matched keywords that triggered the routing */
  matchedKeywords: string[];
}

/**
 * Configuration for agent routing
 */
export interface AgentRouterConfig {
  /** Enable/disable agent-first mode */
  enabled: boolean;
  /** Default agent when no keyword match */
  defaultAgent: string | null;
  /** Minimum confidence threshold for auto-routing */
  confidenceThreshold: number;
  /** Agents to exclude from auto-selection */
  excludedAgents: string[];
}

/**
 * Keyword rule for agent matching
 */
interface AgentKeywordRule {
  agent: string;
  keywords: RegExp;
  confidence: number;
  matchedTerms: string[];
}

// Session cache for availability (avoid repeated filesystem checks)
let availabilityCache: {
  checked: boolean;
  available: boolean;
  agents: string[];
  timestamp: number;
} | null = null;

const AVAILABILITY_CACHE_TTL = 60000; // 1 minute

/**
 * Default result when no agent match is found (use direct LLM)
 */
const NO_MATCH_RESULT: AgentRoutingResult = {
  agent: null,
  systemPrefix: '',
  transparencyNote: '',
  confidence: 0,
  matchedKeywords: [],
};

/**
 * Keyword to agent mapping (ordered by specificity)
 * High-confidence keywords that strongly indicate domain
 */
const AGENT_KEYWORD_RULES: AgentKeywordRule[] = [
  // Security - highest priority (security concerns override domain)
  {
    agent: 'security',
    keywords: /\b(security|vulnerab|cve|xss|csrf|injection|auth(?:entication|orization)|encrypt|owasp|pentest|threat|exploit)\b/i,
    confidence: 0.9,
    matchedTerms: ['security', 'vulnerability', 'cve', 'xss', 'csrf', 'injection', 'authentication', 'authorization', 'encryption', 'owasp', 'pentest', 'threat', 'exploit'],
  },

  // Quality/Testing
  {
    agent: 'quality',
    keywords: /\b(test(?:ing)?|vitest|jest|cypress|playwright|coverage|qa|bug|regression|e2e|unit[\s-]?test|integration[\s-]?test|spec)\b/i,
    confidence: 0.85,
    matchedTerms: ['test', 'testing', 'vitest', 'jest', 'cypress', 'playwright', 'coverage', 'qa', 'bug', 'regression', 'e2e', 'unit test', 'integration test', 'spec'],
  },

  // DevOps
  {
    agent: 'devops',
    keywords: /\b(docker|kubernetes|k8s|helm|terraform|ansible|ci[\s\/]?cd|github[\s-]?action|jenkins|deploy|infrastructure|aws|gcp|azure|nginx|load[\s-]?balanc)\b/i,
    confidence: 0.85,
    matchedTerms: ['docker', 'kubernetes', 'k8s', 'helm', 'terraform', 'ansible', 'ci/cd', 'github actions', 'jenkins', 'deploy', 'infrastructure', 'aws', 'gcp', 'azure', 'nginx', 'load balancer'],
  },

  // Backend - specific technologies
  {
    agent: 'backend',
    keywords: /\b(api|rest(?:ful)?|graphql|grpc|database|postgresql|mysql|mongodb|redis|microservice|golang|rust|server[\s-]?side|endpoint|middleware|orm|prisma)\b/i,
    confidence: 0.8,
    matchedTerms: ['api', 'rest', 'restful', 'graphql', 'grpc', 'database', 'postgresql', 'mysql', 'mongodb', 'redis', 'microservice', 'golang', 'rust', 'server-side', 'endpoint', 'middleware', 'orm', 'prisma'],
  },

  // Frontend - specific technologies
  {
    agent: 'frontend',
    keywords: /\b(react|vue|angular|svelte|next\.?js|nuxt|css|tailwind|component|ui[\s-]?component|dom|html|responsive|scss|sass|styled[\s-]?component|animation)\b/i,
    confidence: 0.8,
    matchedTerms: ['react', 'vue', 'angular', 'svelte', 'next.js', 'nuxt', 'css', 'tailwind', 'component', 'ui component', 'dom', 'html', 'responsive', 'scss', 'sass', 'styled-component', 'animation'],
  },

  // Mobile
  {
    agent: 'mobile',
    keywords: /\b(ios|android|swift|kotlin|flutter|react[\s-]?native|mobile[\s-]?app|xcode|gradle|cocoapod|expo)\b/i,
    confidence: 0.8,
    matchedTerms: ['ios', 'android', 'swift', 'kotlin', 'flutter', 'react native', 'mobile app', 'xcode', 'gradle', 'cocoapod', 'expo'],
  },

  // Data
  {
    agent: 'data',
    keywords: /\b(etl|data[\s-]?pipeline|analytics|sql|data[\s-]?model|warehouse|bigquery|spark|kafka|airflow|dbt)\b/i,
    confidence: 0.75,
    matchedTerms: ['etl', 'data pipeline', 'analytics', 'sql', 'data model', 'warehouse', 'bigquery', 'spark', 'kafka', 'airflow', 'dbt'],
  },

  // Architecture
  {
    agent: 'architecture',
    keywords: /\b(architect|system[\s-]?design|adr|scalab|microservice[\s-]?architect|event[\s-]?driven|domain[\s-]?driven|ddd|cqrs)\b/i,
    confidence: 0.75,
    matchedTerms: ['architecture', 'system design', 'adr', 'scalability', 'microservice architecture', 'event-driven', 'domain-driven', 'ddd', 'cqrs'],
  },

  // Product
  {
    agent: 'product',
    keywords: /\b(prd|product[\s-]?requirement|user[\s-]?story|feature[\s-]?spec|roadmap|stakeholder|acceptance[\s-]?criteria)\b/i,
    confidence: 0.7,
    matchedTerms: ['prd', 'product requirement', 'user story', 'feature spec', 'roadmap', 'stakeholder', 'acceptance criteria'],
  },

  // Documentation/Writing
  {
    agent: 'writer',
    keywords: /\b(document(?:ation)?|readme|changelog|technical[\s-]?writ|api[\s-]?doc|jsdoc|typedoc|wiki)\b/i,
    confidence: 0.7,
    matchedTerms: ['documentation', 'readme', 'changelog', 'technical writing', 'api doc', 'jsdoc', 'typedoc', 'wiki'],
  },

  // Design
  {
    agent: 'design',
    keywords: /\b(figma|ui[\s\/]?ux|wireframe|mockup|prototype|design[\s-]?system|user[\s-]?experience|accessibility|a11y)\b/i,
    confidence: 0.7,
    matchedTerms: ['figma', 'ui/ux', 'wireframe', 'mockup', 'prototype', 'design system', 'user experience', 'accessibility', 'a11y'],
  },

  // Standards/Review (fallback for code-related queries)
  {
    agent: 'standard',
    keywords: /\b(solid|design[\s-]?pattern|clean[\s-]?code|refactor|code[\s-]?review|best[\s-]?practice|lint|eslint|prettier|code[\s-]?quality)\b/i,
    confidence: 0.65,
    matchedTerms: ['solid', 'design pattern', 'clean code', 'refactor', 'code review', 'best practice', 'lint', 'eslint', 'prettier', 'code quality'],
  },
];

/**
 * Check if AutomatosX agents are available (cached per session)
 */
export function checkAgentAvailability(): { available: boolean; agents: string[] } {
  const now = Date.now();

  // Return cached result if still valid
  if (
    availabilityCache?.checked &&
    (now - availabilityCache.timestamp) < AVAILABILITY_CACHE_TTL
  ) {
    return { available: availabilityCache.available, agents: availabilityCache.agents };
  }

  try {
    const agentsDir = join(process.cwd(), '.automatosx', 'agents');
    if (!existsSync(agentsDir)) {
      availabilityCache = { checked: true, available: false, agents: [], timestamp: now };
      return { available: false, agents: [] };
    }

    const agents = readdirSync(agentsDir)
      .filter(f => f.endsWith('.yaml') || f.endsWith('.yml'))
      .map(f => f.replace(/\.ya?ml$/, ''));

    availabilityCache = {
      checked: true,
      available: agents.length > 0,
      agents,
      timestamp: now,
    };
    return { available: agents.length > 0, agents };
  } catch {
    availabilityCache = { checked: true, available: false, agents: [], timestamp: now };
    return { available: false, agents: [] };
  }
}

/**
 * Reset availability cache (for testing or session reset)
 */
export function resetAgentAvailabilityCache(): void {
  availabilityCache = null;
}

/**
 * Extract matched keywords from user input
 */
function extractMatchedKeywords(userInput: string, rule: AgentKeywordRule): string[] {
  const input = userInput.toLowerCase();
  return rule.matchedTerms.filter(term => input.includes(term.toLowerCase()));
}

/**
 * Match user input to agent based on keywords
 */
export function matchAgentByKeywords(
  userInput: string,
  availableAgents: string[],
  excludedAgents: string[] = []
): AgentRoutingResult | null {
  for (const rule of AGENT_KEYWORD_RULES) {
    // Skip excluded agents
    if (excludedAgents.includes(rule.agent)) {
      continue;
    }

    // Check if agent is available
    if (!availableAgents.includes(rule.agent)) {
      continue;
    }

    // Test for keyword match
    if (rule.keywords.test(userInput)) {
      const matchedKeywords = extractMatchedKeywords(userInput, rule);
      return {
        agent: rule.agent,
        confidence: rule.confidence,
        systemPrefix: `[Routed to ${rule.agent} agent for specialized assistance]`,
        transparencyNote: `Agent: ${rule.agent}`,
        matchedKeywords,
      };
    }
  }

  return null; // No confident match
}

/**
 * Get default router config from settings
 */
export function getDefaultRouterConfig(settings?: AgentFirstSettings): AgentRouterConfig {
  return {
    enabled: settings?.enabled ?? true,
    defaultAgent: settings?.defaultAgent ?? 'standard',
    confidenceThreshold: settings?.confidenceThreshold ?? 0.6,
    excludedAgents: settings?.excludedAgents ?? [],
  };
}

/**
 * Main routing function - determines which agent should handle the task
 */
export function routeToAgent(
  userInput: string,
  config: AgentRouterConfig
): AgentRoutingResult {
  // Check if routing is enabled
  if (!config.enabled) {
    return NO_MATCH_RESULT;
  }

  // Check agent availability
  const { available, agents } = checkAgentAvailability();
  if (!available || agents.length === 0) {
    return NO_MATCH_RESULT;
  }

  // Try to match agent by keywords
  const match = matchAgentByKeywords(userInput, agents, config.excludedAgents);

  if (match && match.confidence >= config.confidenceThreshold) {
    return match;
  }

  // Use default agent if configured and available
  if (config.defaultAgent && agents.includes(config.defaultAgent)) {
    return {
      agent: config.defaultAgent,
      confidence: 0.5,
      systemPrefix: `[Using ${config.defaultAgent} agent]`,
      transparencyNote: `Agent: ${config.defaultAgent}`,
      matchedKeywords: [],
    };
  }

  // No match, use direct LLM
  return NO_MATCH_RESULT;
}

/**
 * Get list of available agents for display
 */
export function getAvailableAgents(): string[] {
  const { agents } = checkAgentAvailability();
  return agents;
}

/**
 * Check if a specific agent is available
 */
export function isAgentAvailable(agentName: string): boolean {
  const { agents } = checkAgentAvailability();
  return agents.includes(agentName);
}
