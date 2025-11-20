/**
 * Progress tracking utility for init command
 */

import * as prompts from '@clack/prompts';

export interface ProgressStep {
  name: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  startTime?: number;
  endTime?: number;
  details?: string;
}

export class ProgressTracker {
  private steps: Map<string, ProgressStep> = new Map();
  private spinner?: ReturnType<typeof prompts.spinner> | null = null;
  private currentStep?: string;

  /**
   * Add a step to track
   */
  addStep(id: string, name: string): void {
    this.steps.set(id, {
      name,
      status: 'pending',
    });
  }

  /**
   * Start a step
   */
  async startStep(id: string, message?: string): Promise<void> {
    const step = this.steps.get(id);
    if (!step) {
      throw new Error(`Step '${id}' not found`);
    }

    step.status = 'in_progress';
    step.startTime = Date.now();
    this.currentStep = id;

    // Properly clean up previous spinner to prevent memory leak
    if (this.spinner) {
      this.spinner.stop();
      this.spinner = null;
    }

    this.spinner = prompts.spinner();
    this.spinner.start(message || step.name);
  }

  /**
   * Complete a step
   */
  async completeStep(id: string, details?: string): Promise<void> {
    const step = this.steps.get(id);
    if (!step) {
      throw new Error(`Step '${id}' not found`);
    }

    step.status = 'completed';
    step.endTime = Date.now();
    step.details = details;

    if (this.spinner && this.currentStep === id) {
      const duration = step.endTime - (step.startTime || step.endTime);
      const durationStr = this.formatDuration(duration);
      this.spinner.stop(`✅ ${step.name} ${durationStr}`);
      this.spinner = null;
    }

    // Always clear current step, not just when spinner exists
    if (this.currentStep === id) {
      this.currentStep = undefined;
    }
  }

  /**
   * Fail a step
   */
  async failStep(id: string, error: string): Promise<void> {
    const step = this.steps.get(id);
    if (!step) {
      throw new Error(`Step '${id}' not found`);
    }

    step.status = 'failed';
    step.endTime = Date.now();
    step.details = error;

    if (this.spinner && this.currentStep === id) {
      this.spinner.stop(`❌ ${step.name}: ${error}`);
      this.spinner = null;
      this.currentStep = undefined;
    }
  }

  /**
   * Update step message
   */
  updateMessage(message: string): void {
    if (this.spinner) {
      this.spinner.message(message);
    }
  }

  /**
   * Format duration in human-readable form
   */
  private formatDuration(ms: number): string {
    if (ms < 1000) {
      return `(${ms}ms)`;
    } else if (ms < 60000) {
      return `(${(ms / 1000).toFixed(1)}s)`;
    } else {
      const minutes = Math.floor(ms / 60000);
      const seconds = Math.floor((ms % 60000) / 1000);
      return `(${minutes}m ${seconds}s)`;
    }
  }

  /**
   * Get summary of all steps
   */
  getSummary(): string {
    const completed = Array.from(this.steps.values()).filter(s => s.status === 'completed');
    const failed = Array.from(this.steps.values()).filter(s => s.status === 'failed');

    const totalTime = completed.reduce((sum, step) => {
      if (step.startTime && step.endTime) {
        return sum + (step.endTime - step.startTime);
      }
      return sum;
    }, 0);

    const parts: string[] = [];
    parts.push(`Completed: ${completed.length}/${this.steps.size} steps`);

    if (failed.length > 0) {
      parts.push(`Failed: ${failed.length}`);
    }

    parts.push(`Total time: ${this.formatDuration(totalTime)}`);

    return parts.join('\n');
  }

  /**
   * Stop any active spinner
   */
  stop(): void {
    if (this.spinner) {
      try {
        this.spinner.stop();
      } catch (error) {
        // Ignore errors during cleanup
      } finally {
        this.spinner = null;
        this.currentStep = undefined;
      }
    }
  }

  /**
   * Cleanup and destroy tracker
   */
  destroy(): void {
    this.stop();
    // Clear any pending timeouts
    for (const step of this.steps.values()) {
      if (step.status === 'in_progress') {
        step.status = 'failed';
        step.details = 'Tracker destroyed before completion';
      }
    }
    this.steps.clear();
  }
}
