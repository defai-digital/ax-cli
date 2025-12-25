/**
 * Agent Configuration Manager
 *
 * Manages sampling and thinking mode configuration for LLM agents.
 * Handles auto-thinking detection based on message complexity.
 *
 * @packageDocumentation
 */

import { EventEmitter } from "events";
import type { SamplingConfig, ThinkingConfig } from "../../llm/types.js";
import {
  shouldUseThinkingMode,
  getComplexityScore,
} from "../../planner/index.js";

/**
 * Configuration options for AgentConfigManager
 */
export interface AgentConfigManagerOptions {
  /** Minimum complexity score to auto-enable thinking (default: 25) */
  autoThinkingThreshold?: number;
}

/**
 * Event emitted when auto-thinking is enabled
 */
export interface AutoThinkingEnabledEvent {
  complexity: number;
  message: string;
}

/**
 * Manages agent configuration including sampling and thinking modes.
 *
 * Features:
 * - Sampling configuration for deterministic/reproducible outputs
 * - Thinking mode configuration with explicit user preference tracking
 * - Auto-thinking detection based on message complexity
 *
 * @example
 * ```typescript
 * const configManager = new AgentConfigManager(emitter);
 *
 * // Set explicit thinking preference
 * configManager.setThinkingConfig({ type: 'enabled' }, true);
 *
 * // Check if auto-thinking should activate
 * const activated = configManager.applyAutoThinking("Explain quantum computing", "glm-4.6");
 *
 * // Build chat options with current config
 * const options = configManager.buildChatOptions({ temperature: 0.7 });
 * ```
 */
export class AgentConfigManager {
  /** Sampling configuration for deterministic/reproducible mode */
  private samplingConfig: SamplingConfig | undefined;

  /** Thinking/reasoning mode configuration */
  private thinkingConfig: ThinkingConfig | undefined;

  /** Track if auto-thinking was enabled for current message (for UI indicator) */
  private autoThinkingEnabled: boolean = false;

  /** User's explicit thinking preference (undefined = auto, true/false = explicit) */
  private userThinkingPreference: boolean | undefined = undefined;

  /** Minimum complexity score to auto-enable thinking */
  private autoThinkingThreshold: number;

  /** Event emitter for auto_thinking_enabled events */
  private emitter: EventEmitter;

  constructor(emitter: EventEmitter, options?: AgentConfigManagerOptions) {
    this.emitter = emitter;
    this.autoThinkingThreshold = options?.autoThinkingThreshold ?? 25;
  }

  /**
   * Set sampling configuration for this agent session
   * @param config Sampling configuration to apply
   */
  setSamplingConfig(config: SamplingConfig | undefined): void {
    this.samplingConfig = config;
  }

  /**
   * Get current sampling configuration
   */
  getSamplingConfig(): SamplingConfig | undefined {
    return this.samplingConfig;
  }

  /**
   * Set thinking/reasoning mode configuration for this agent session
   * @param config Thinking configuration to apply (enabled/disabled)
   * @param isUserExplicit Whether this is an explicit user preference (vs auto-detection)
   */
  setThinkingConfig(config: ThinkingConfig | undefined, isUserExplicit: boolean = true): void {
    this.thinkingConfig = config;
    // Track user's explicit preference to respect their choice over auto-detection
    if (isUserExplicit) {
      this.userThinkingPreference = config?.type === 'enabled' ? true :
                                    config?.type === 'disabled' ? false : undefined;
    }
  }

  /**
   * Get current thinking configuration
   */
  getThinkingConfig(): ThinkingConfig | undefined {
    return this.thinkingConfig;
  }

  /**
   * Check if auto-thinking was enabled for the current message
   * Used by UI to show indicator when thinking was auto-activated
   */
  isAutoThinkingEnabled(): boolean {
    return this.autoThinkingEnabled;
  }

  /**
   * Get user's explicit thinking preference
   * @returns undefined = no preference (auto), true = enabled, false = disabled
   */
  getUserThinkingPreference(): boolean | undefined {
    return this.userThinkingPreference;
  }

  /**
   * Reset user's explicit thinking preference to allow auto-detection
   */
  clearUserThinkingPreference(): void {
    this.userThinkingPreference = undefined;
  }

  /**
   * Check if a model supports thinking mode
   * @param model Model name/ID
   */
  modelSupportsThinking(model: string): boolean {
    const modelLower = model.toLowerCase();
    // GLM models (4.6, 4.7, etc.) and Grok 4 models support thinking
    return modelLower.includes('glm') || modelLower.includes('grok-4');
  }

  /**
   * Apply auto-thinking mode detection for a user message.
   * Only activates if user hasn't explicitly set a preference and model supports it.
   *
   * @param message User's message text
   * @param model Current model name
   * @returns true if thinking mode was auto-enabled, false otherwise
   */
  applyAutoThinking(message: string, model: string): boolean {
    // Reset auto-thinking state
    this.autoThinkingEnabled = false;

    // If user has explicit preference, respect it
    if (this.userThinkingPreference !== undefined) {
      return false;
    }

    // Check if model supports thinking mode
    if (!this.modelSupportsThinking(model)) {
      return false;
    }

    // Check if message would benefit from thinking mode
    if (shouldUseThinkingMode(message)) {
      const complexity = getComplexityScore(message);

      // Only auto-enable for moderately complex or higher tasks
      if (complexity >= this.autoThinkingThreshold) {
        this.thinkingConfig = { type: 'enabled' };
        this.autoThinkingEnabled = true;

        // Emit event for UI to show indicator
        this.emitter.emit('auto_thinking_enabled', {
          complexity,
          message: message.substring(0, 100)
        } as AutoThinkingEnabledEvent);

        return true;
      }
    }

    return false;
  }

  /**
   * Reset auto-thinking state for a new message.
   * Call this at the start of each message processing.
   */
  resetAutoThinking(): void {
    this.autoThinkingEnabled = false;
  }

  /**
   * Build chat options by merging current config with provided options.
   * Applies sampling config and thinking config if set.
   *
   * @param baseOptions Optional base options to merge with
   * @returns Merged chat options
   */
  buildChatOptions(baseOptions?: Partial<ChatOptions>): ChatOptions {
    const options: ChatOptions = { ...baseOptions };

    // Apply sampling config
    if (this.samplingConfig) {
      options.samplingConfig = this.samplingConfig;
    }

    // Apply thinking config
    if (this.thinkingConfig) {
      options.thinkingConfig = this.thinkingConfig;
    }

    return options;
  }

  /**
   * Reset all configuration to defaults
   */
  reset(): void {
    this.samplingConfig = undefined;
    this.thinkingConfig = undefined;
    this.autoThinkingEnabled = false;
    this.userThinkingPreference = undefined;
  }
}

/**
 * Chat options type for building requests
 */
export interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
  samplingConfig?: SamplingConfig;
  thinkingConfig?: ThinkingConfig;
  [key: string]: unknown;
}

/**
 * Create a new AgentConfigManager
 */
export function createAgentConfigManager(
  emitter: EventEmitter,
  options?: AgentConfigManagerOptions
): AgentConfigManager {
  return new AgentConfigManager(emitter, options);
}
