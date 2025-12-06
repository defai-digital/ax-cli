/**
 * Plan Executor
 *
 * Handles execution of multi-phase task plans.
 * Extracted from llm-agent.ts for better separation of concerns.
 *
 * @packageDocumentation
 */

import type { LLMClient, LLMMessage, LLMTool } from "../../llm/client.js";
import type { ChatOptions } from "../../llm/types.js";
import type { TokenCounter } from "../../utils/token-counter.js";
import type { ToolExecutor } from "../execution/index.js";
import type { ChatEntry } from "../core/types.js";
import type {
  TaskPlan,
  TaskPhase,
  PhaseResult,
  PlanResult,
} from "../../planner/index.js";
import { extractErrorMessage } from "../../utils/error-handler.js";
import { getStatusReporter } from "../status-reporter.js";
import { PLANNER_CONFIG } from "../../constants.js";
import { EventEmitter } from "events";

/**
 * Plan executor configuration
 */
export interface PlanExecutorConfig {
  /** LLM client for API calls */
  llmClient: LLMClient;
  /** Token counter for usage tracking */
  tokenCounter: TokenCounter;
  /** Tool executor for running tools */
  toolExecutor: ToolExecutor;
  /** Get all available tools */
  getTools: () => Promise<LLMTool[]>;
  /** Execute a tool call */
  executeTool: (toolCall: unknown) => Promise<{ success: boolean; output?: string; error?: string }>;
  /** Parse tool arguments with caching */
  parseToolArgumentsCached: (toolCall: unknown) => Record<string, unknown>;
  /** Build chat options with agent config */
  buildChatOptions: (options?: Partial<ChatOptions>) => ChatOptions;
  /** Apply context pruning */
  applyContextPruning: () => void;
  /** Event emitter for plan events */
  emitter: EventEmitter;
  /** Max tool rounds per phase (default: 50) */
  maxToolRounds?: number;
  /** Callback to temporarily disable planning during phase execution */
  setPlanningEnabled?: (enabled: boolean) => void;
}

/**
 * Plan Executor
 *
 * Executes multi-phase task plans with progress tracking.
 */
// REFACTOR: Constant for file-modifying tools (avoid recreating in loop)
const FILE_MODIFYING_TOOLS = new Set(['create_file', 'str_replace_editor', 'multi_edit']);

export class PlanExecutor {
  private config: PlanExecutorConfig;

  constructor(config: PlanExecutorConfig) {
    this.config = config;
  }

  /**
   * Execute a single phase using the LLM
   */
  async executePhase(
    phase: TaskPhase,
    context: {
      planId: string;
      originalRequest: string;
      completedPhases: string[];
    },
    messages: LLMMessage[],
    _chatHistory: ChatEntry[]
  ): Promise<{ result: PhaseResult; messages: LLMMessage[] }> {
    const startTime = Date.now();
    const startTokens = this.config.tokenCounter.countMessageTokens(messages);
    const filesModified: string[] = [];
    let lastAssistantContent = "";

    // Emit phase started event
    this.config.emitter.emit("phase:started", { phase, planId: context.planId });

    // Temporarily disable planning during phase execution to prevent recursive planning
    if (this.config.setPlanningEnabled) {
      this.config.setPlanningEnabled(false);
    }

    try {
      // Build phase-specific prompt
      const phasePrompt = this.buildPhasePrompt(phase, context);

      // Add phase context to messages
      messages.push({
        role: "user",
        content: phasePrompt,
      });

      // Execute using the standard tool loop
      const tools = await this.config.getTools();
      let toolRounds = 0;
      const maxPhaseRounds = this.config.maxToolRounds ?? 50; // Limit per phase

      while (toolRounds < maxPhaseRounds) {
        const response = await this.config.llmClient.chat(messages, tools, this.config.buildChatOptions());
        const assistantMessage = response.choices[0]?.message;

        if (!assistantMessage) break;

        // Capture the assistant's content for phase output
        if (assistantMessage.content) {
          lastAssistantContent = assistantMessage.content;
        }

        // Add to messages
        messages.push({
          role: "assistant",
          content: assistantMessage.content || "",
          tool_calls: assistantMessage.tool_calls,
        } as LLMMessage);

        // Check for tool calls
        if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
          break; // No more tool calls, phase complete
        }

        // BUG FIX: Increment toolRounds after checking for tool calls
        // but count it here so we can check limit before executing
        toolRounds++;
        if (toolRounds >= maxPhaseRounds) {
          // Add a warning message about hitting the limit
          this.config.emitter.emit("phase:warning", {
            phase,
            planId: context.planId,
            message: `Phase hit tool round limit (${maxPhaseRounds})`,
          });
        }

        // Execute tools and track file modifications
        for (const toolCall of assistantMessage.tool_calls) {
          const result = await this.config.executeTool(toolCall);

          // REFACTOR: Use Set.has() for O(1) lookup instead of Array.includes()
          if (FILE_MODIFYING_TOOLS.has(toolCall.function.name)) {
            const args = this.config.parseToolArgumentsCached(toolCall);
            if (args.path && result.success) {
              if (!filesModified.includes(args.path as string)) {
                filesModified.push(args.path as string);
              }
            }
          }

          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: result.output || result.error || "No output",
          } as LLMMessage);
        }
      }

      // Prune context if configured
      if (PLANNER_CONFIG.PRUNE_AFTER_PHASE) {
        this.config.applyContextPruning();
      }

      const endTokens = this.config.tokenCounter.countMessageTokens(messages);
      const duration = Date.now() - startTime;

      // Build meaningful output
      const output = lastAssistantContent ||
        `Phase "${phase.name}" completed (${toolRounds} tool rounds, ${filesModified.length} files modified)`;

      // Emit phase completed event
      this.config.emitter.emit("phase:completed", {
        phase,
        planId: context.planId,
        result: { success: true, output, filesModified }
      });

      return {
        result: {
          phaseId: phase.id,
          success: true,
          output,
          duration,
          tokensUsed: endTokens - startTokens,
          filesModified,
          wasRetry: false,
          retryAttempt: 0,
        },
        messages,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = extractErrorMessage(error);

      // Emit phase failed event
      this.config.emitter.emit("phase:failed", {
        phase,
        planId: context.planId,
        error: errorMessage
      });

      return {
        result: {
          phaseId: phase.id,
          success: false,
          error: errorMessage,
          duration,
          tokensUsed: 0,
          filesModified,
          wasRetry: false,
          retryAttempt: 0,
        },
        messages,
      };
    } finally {
      // Restore planning state
      if (this.config.setPlanningEnabled) {
        this.config.setPlanningEnabled(true);
      }
    }
  }

  /**
   * Build a prompt for phase execution
   */
  private buildPhasePrompt(
    phase: TaskPhase,
    context: {
      planId: string;
      originalRequest: string;
      completedPhases: string[];
    }
  ): string {
    let prompt = `## Phase ${phase.index + 1}: ${phase.name}\n\n`;
    prompt += `**Objective:** ${phase.description}\n\n`;

    if (phase.objectives.length > 0) {
      prompt += "**Tasks to complete:**\n";
      for (const obj of phase.objectives) {
        prompt += `- ${obj}\n`;
      }
      prompt += "\n";
    }

    if (context.completedPhases.length > 0) {
      prompt += `**Previously completed phases:** ${context.completedPhases.join(", ")}\n\n`;
    }

    prompt += `**Original request:** ${context.originalRequest}\n\n`;
    prompt += "Please complete this phase. Focus only on the objectives listed above.";

    return prompt;
  }

  /**
   * Format plan summary for display
   */
  formatPlanSummary(plan: TaskPlan): string {
    let output = `**📋 Execution Plan Created**\n\n`;
    output += `**Request:** ${plan.originalPrompt.slice(0, 100)}${plan.originalPrompt.length > 100 ? "..." : ""}\n\n`;
    output += `**Phases (${plan.phases.length}):**\n`;

    for (const phase of plan.phases) {
      // BUG FIX: Consistent risk icons for all levels (low was empty)
      const riskIcon = phase.riskLevel === "high" ? "⚠️" : phase.riskLevel === "medium" ? "△" : "○";
      output += `  ${phase.index + 1}. ${phase.name} ${riskIcon}\n`;
    }

    output += `\n**Estimated Duration:** ~${Math.ceil(plan.estimatedDuration / 60000)} min\n\n`;
    output += "---\n\n";

    return output;
  }

  /**
   * Format plan result for display
   */
  formatPlanResult(result: PlanResult): string {
    let output = "\n---\n\n**📋 Plan Execution Complete**\n\n";

    // REFACTOR: Single pass through results instead of two filter operations
    let successful = 0;
    for (const r of result.phaseResults) {
      if (r.success) successful++;
    }
    const failed = result.phaseResults.length - successful;

    output += `**Results:** ${successful}/${result.phaseResults.length} phases successful`;
    if (failed > 0) {
      output += ` (${failed} failed)`;
    }
    output += "\n";

    if (result.totalDuration) {
      output += `**Duration:** ${Math.ceil(result.totalDuration / 1000)}s\n`;
    }

    if (result.totalTokensUsed) {
      output += `**Tokens Used:** ${result.totalTokensUsed.toLocaleString()}\n`;
    }

    return output;
  }

  /**
   * Generate status report on plan completion
   */
  async generateStatusReport(
    messages: LLMMessage[],
    chatHistory: ChatEntry[],
    tokenCount: number,
    plan: TaskPlan
  ): Promise<{ path: string | undefined }> {
    try {
      const reporter = getStatusReporter();
      const report = await reporter.generateStatusReport({
        messages,
        chatHistory,
        tokenCount,
        plan,
      });
      return { path: report.path };
    } catch (error) {
      const errorMsg = extractErrorMessage(error);
      console.warn("Failed to generate status report:", errorMsg);
      return { path: undefined };
    }
  }
}
