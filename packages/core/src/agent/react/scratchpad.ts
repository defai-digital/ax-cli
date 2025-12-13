/**
 * ReAct Scratchpad
 *
 * Accumulates and manages the reasoning trace across
 * multiple Thought → Action → Observation cycles.
 *
 * @module agent/react/scratchpad
 */

import type {
  ReActStep,
  ReActScratchpadState,
  ScratchpadFormatOptions,
  ReActStopReason,
} from './types.js';

// ============================================================================
// Constants
// ============================================================================

/**
 * Default format options
 */
const DEFAULT_FORMAT_OPTIONS: ScratchpadFormatOptions = {
  maxTokens: 8000,
  summarizeObservations: true,
  recentStepsToKeep: 3,
  includeTiming: false,
};

/**
 * Approximate tokens per character (conservative estimate)
 */
const CHARS_PER_TOKEN = 4;

// ============================================================================
// ReActScratchpad Class
// ============================================================================

/**
 * ReActScratchpad - Manages accumulated reasoning state
 */
export class ReActScratchpad {
  private state: ReActScratchpadState;
  private maxTokens: number;

  constructor(goal: string, maxTokens: number = 8000) {
    this.maxTokens = maxTokens;
    this.state = {
      steps: [],
      currentStep: 0,
      totalTokens: 0,
      goal,
      isComplete: false,
    };
  }

  /**
   * Get the current goal
   */
  get goal(): string {
    return this.state.goal;
  }

  /**
   * Get all steps
   */
  get steps(): ReActStep[] {
    return [...this.state.steps];
  }

  /**
   * Get current step number
   */
  get currentStepNumber(): number {
    return this.state.currentStep;
  }

  /**
   * Get total token count
   */
  get totalTokens(): number {
    return this.state.totalTokens;
  }

  /**
   * Check if complete
   */
  get isComplete(): boolean {
    return this.state.isComplete;
  }

  /**
   * Start a new step
   *
   * @returns The step number
   */
  startStep(): number {
    this.state.currentStep++;

    const step: ReActStep = {
      stepNumber: this.state.currentStep,
      startedAt: new Date(),
      status: 'thinking',
      thought: '',
    };

    this.state.steps.push(step);
    return this.state.currentStep;
  }

  /**
   * Update the thought for the current step
   */
  setThought(thought: string): void {
    const step = this.getCurrentStep();
    if (step) {
      step.thought = thought;
      this.updateTokenCount();
    }
  }

  /**
   * Set the action for the current step
   */
  setAction(action: ReActStep['action']): void {
    const step = this.getCurrentStep();
    if (step) {
      step.action = action;
      step.status = 'acting';
      this.updateTokenCount();
    }
  }

  /**
   * Set the observation for the current step
   */
  setObservation(observation: string, madeProgress: boolean = true): void {
    const step = this.getCurrentStep();
    if (step) {
      step.observation = observation;
      step.madeProgress = madeProgress;
      step.status = 'observing';
      this.updateTokenCount();
    }
  }

  /**
   * Complete the current step
   */
  completeStep(): ReActStep | undefined {
    const step = this.getCurrentStep();
    if (step) {
      step.status = 'completed';
      step.completedAt = new Date();
      step.durationMs = step.completedAt.getTime() - step.startedAt.getTime();
      this.updateTokenCount();

      // Check if we need to prune old steps
      this.pruneIfNeeded();

      return step;
    }
    return undefined;
  }

  /**
   * Fail the current step
   */
  failStep(error: string): ReActStep | undefined {
    const step = this.getCurrentStep();
    if (step) {
      step.status = 'failed';
      step.completedAt = new Date();
      step.durationMs = step.completedAt.getTime() - step.startedAt.getTime();
      step.observation = `Error: ${error}`;
      step.madeProgress = false;
      this.updateTokenCount();
      return step;
    }
    return undefined;
  }

  /**
   * Mark the task as complete
   */
  complete(finalResult: string, _stopReason: ReActStopReason): void {
    this.state.isComplete = true;
    this.state.finalResult = finalResult;
  }

  /**
   * Get the current step being worked on
   */
  getCurrentStep(): ReActStep | undefined {
    if (this.state.steps.length === 0) {
      return undefined;
    }
    return this.state.steps[this.state.steps.length - 1];
  }

  /**
   * Get a step by number
   */
  getStep(stepNumber: number): ReActStep | undefined {
    return this.state.steps.find(s => s.stepNumber === stepNumber);
  }

  /**
   * Format scratchpad for prompt injection
   */
  format(options: Partial<ScratchpadFormatOptions> = {}): string {
    const opts = { ...DEFAULT_FORMAT_OPTIONS, ...options };

    if (this.state.steps.length === 0) {
      return 'No steps taken yet.';
    }

    const lines: string[] = [];
    const recentCutoff = this.state.steps.length - opts.recentStepsToKeep;

    for (let i = 0; i < this.state.steps.length; i++) {
      const step = this.state.steps[i];
      const isRecent = i >= recentCutoff;

      lines.push(`### Step ${step.stepNumber}`);

      // Thought
      if (step.thought) {
        lines.push(`**Thought**: ${this.truncateIfNeeded(step.thought, isRecent ? 500 : 200)}`);
      }

      // Action
      if (step.action) {
        if (step.action.type === 'tool_call' && step.action.tool) {
          lines.push(`**Action**: Called \`${step.action.tool}\``);
        } else if (step.action.type === 'respond') {
          lines.push(`**Action**: Responded to user`);
        } else if (step.action.type === 'ask') {
          lines.push(`**Action**: Asked clarifying question`);
        }
      }

      // Observation
      if (step.observation) {
        const obsText = opts.summarizeObservations && !isRecent
          ? this.summarizeObservation(step.observation)
          : this.truncateIfNeeded(step.observation, isRecent ? 1000 : 300);
        lines.push(`**Observation**: ${obsText}`);
      }

      // Progress indicator
      if (step.madeProgress !== undefined) {
        lines.push(`**Progress**: ${step.madeProgress ? 'Yes' : 'No'}`);
      }

      // Timing
      if (opts.includeTiming && step.durationMs) {
        lines.push(`**Duration**: ${step.durationMs}ms`);
      }

      lines.push('');
    }

    // Add progress summary if available
    if (this.state.progressSummary) {
      lines.push('---');
      lines.push(`**Overall Progress**: ${this.state.progressSummary}`);
    }

    return lines.join('\n');
  }

  /**
   * Format as a compact summary
   */
  formatCompact(): string {
    if (this.state.steps.length === 0) {
      return 'No steps yet.';
    }

    return this.state.steps.map(step => {
      const action = step.action?.tool || step.action?.type || 'thinking';
      const progress = step.madeProgress ? '✓' : '✗';
      return `${step.stepNumber}. ${action} ${progress}`;
    }).join(' → ');
  }

  /**
   * Check if progress is stalled
   */
  isStalled(windowSize: number = 3): boolean {
    if (this.state.steps.length < windowSize) {
      return false;
    }

    const recentSteps = this.state.steps.slice(-windowSize);
    return recentSteps.every(step => step.madeProgress === false);
  }

  /**
   * Update token count estimate
   */
  private updateTokenCount(): void {
    const formatted = this.format();
    this.state.totalTokens = Math.ceil(formatted.length / CHARS_PER_TOKEN);
  }

  /**
   * Prune old steps if token limit is exceeded
   */
  private pruneIfNeeded(): void {
    if (this.state.totalTokens <= this.maxTokens) {
      return;
    }

    // Strategy: Summarize oldest steps while keeping recent ones
    const keepRecent = 5;
    if (this.state.steps.length <= keepRecent) {
      return;
    }

    // Create summary of old steps
    const oldSteps = this.state.steps.slice(0, -keepRecent);
    const summary = this.summarizeSteps(oldSteps);

    // Keep only recent steps
    this.state.steps = this.state.steps.slice(-keepRecent);
    this.state.progressSummary = summary;

    this.updateTokenCount();
  }

  /**
   * Summarize a list of steps
   */
  private summarizeSteps(steps: ReActStep[]): string {
    const successful = steps.filter(s => s.madeProgress).length;
    const tools = new Set(steps.map(s => s.action?.tool).filter(Boolean));

    return `Previous ${steps.length} steps: ${successful} made progress. Tools used: ${[...tools].join(', ') || 'none'}.`;
  }

  /**
   * Summarize an observation
   */
  private summarizeObservation(observation: string): string {
    if (observation.length <= 100) {
      return observation;
    }

    // Take first line or first 100 chars
    const firstLine = observation.split('\n')[0];
    if (firstLine.length <= 100) {
      return firstLine + '...';
    }

    return observation.substring(0, 100) + '...';
  }

  /**
   * Truncate text if needed
   */
  private truncateIfNeeded(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
      return text;
    }
    return text.substring(0, maxLength) + '...';
  }

  /**
   * Export state for serialization
   */
  exportState(): ReActScratchpadState {
    return { ...this.state, steps: [...this.state.steps] };
  }

  /**
   * Import state from serialization
   */
  importState(state: ReActScratchpadState): void {
    this.state = { ...state, steps: [...state.steps] };
  }

  /**
   * Reset the scratchpad
   */
  reset(newGoal?: string): void {
    this.state = {
      steps: [],
      currentStep: 0,
      totalTokens: 0,
      goal: newGoal || this.state.goal,
      isComplete: false,
    };
  }
}

// ============================================================================
// Factory
// ============================================================================

/**
 * Create a new scratchpad
 */
export function createScratchpad(goal: string, maxTokens?: number): ReActScratchpad {
  return new ReActScratchpad(goal, maxTokens);
}
