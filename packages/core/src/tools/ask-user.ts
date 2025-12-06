/**
 * Ask User Question Tool
 *
 * Allows the AI to ask the user questions during execution.
 * Supports multiple choice questions with optional custom input.
 * Uses EventEmitter pattern to integrate with the UI layer.
 *
 * @packageDocumentation
 */

import { EventEmitter } from "events";
import type { ToolResult } from "../types/index.js";
import { TIMEOUT_CONFIG } from "../constants.js";
import { extractErrorMessage } from "../utils/error-handler.js";

/**
 * Question option
 */
export interface QuestionOption {
  /** Display label */
  label: string;
  /** Optional description */
  description?: string;
}

/**
 * Question definition
 */
export interface Question {
  /** The question text */
  question: string;
  /** Short header/label for the question */
  header?: string;
  /** Available options */
  options: QuestionOption[];
  /** Allow multiple selections */
  multiSelect?: boolean;
}

/**
 * Question result
 */
export interface QuestionResult {
  /** The question that was asked */
  question: string;
  /** Selected answer(s) */
  answers: string[];
  /** Whether "Other" was selected with custom input */
  customInput?: string;
}

/**
 * Question request for UI
 */
export interface QuestionRequest {
  questions: Question[];
  currentQuestionIndex: number;
}

/**
 * Ask User Question Service
 *
 * Allows the AI to ask clarifying questions during execution.
 * Uses EventEmitter pattern similar to ConfirmationService.
 */
export class AskUserService extends EventEmitter {
  private static instance: AskUserService;
  private pendingQuestions: Promise<QuestionResult[]> | null = null;
  private resolveQuestions: ((results: QuestionResult[]) => void) | null = null;
  private rejectQuestions: ((error: Error) => void) | null = null;
  private questionTimeoutId: NodeJS.Timeout | null = null;
  private currentQuestions: Question[] = [];
  private collectedResults: QuestionResult[] = [];
  private currentQuestionIndex: number = 0;

  static getInstance(): AskUserService {
    if (!AskUserService.instance) {
      AskUserService.instance = new AskUserService();
    }
    return AskUserService.instance;
  }

  constructor() {
    super();
  }

  /**
   * Ask questions and wait for user responses
   */
  async askQuestions(questions: Question[]): Promise<ToolResult> {
    if (!questions || questions.length === 0) {
      return {
        success: false,
        error: "No questions provided",
      };
    }

    // Validate questions
    for (const q of questions) {
      if (!q.question || typeof q.question !== "string") {
        return {
          success: false,
          error: "Each question must have a 'question' string",
        };
      }
      if (!q.options || !Array.isArray(q.options) || q.options.length < 2) {
        return {
          success: false,
          error: "Each question must have at least 2 options",
        };
      }
    }

    // Check if there's already pending questions
    if (this.pendingQuestions !== null) {
      return {
        success: false,
        error: "Another question dialog is already pending. Please wait.",
      };
    }

    // Check if we're in a TTY (interactive) environment
    if (!process.stdin.isTTY) {
      // Non-interactive mode: return first option as default
      const defaultAnswers: string[] = [];
      const results: QuestionResult[] = [];
      for (const q of questions) {
        if (q.options && q.options.length > 0) {
          defaultAnswers.push(`${q.question}: Selected default option "${q.options[0].label}" (non-interactive mode)`);
          results.push({
            question: q.question,
            answers: [q.options[0].label],
          });
        }
      }
      return {
        success: true,
        output: `Non-interactive mode detected. Using default selections:\n\n${defaultAnswers.join("\n")}`,
      };
    }

    // Store questions state
    this.currentQuestions = questions;
    this.collectedResults = [];
    this.currentQuestionIndex = 0;

    // Clear any existing timeout
    if (this.questionTimeoutId) {
      clearTimeout(this.questionTimeoutId);
      this.questionTimeoutId = null;
    }

    // Create promise for async resolution
    const resolvedState = { resolved: false };
    this.pendingQuestions = new Promise<QuestionResult[]>((resolve, reject) => {
      const safeResolve = (results: QuestionResult[]) => {
        if (resolvedState.resolved) return;
        resolvedState.resolved = true;
        resolve(results);
      };
      const safeReject = (error: Error) => {
        if (resolvedState.resolved) return;
        resolvedState.resolved = true;
        reject(error);
      };

      this.resolveQuestions = safeResolve;
      this.rejectQuestions = safeReject;

      // Set timeout for questions (use confirmation timeout as base, multiply by number of questions)
      const timeoutMs = TIMEOUT_CONFIG.CONFIRMATION_TIMEOUT * Math.max(questions.length, 1);
      const timeoutSec = Math.round(timeoutMs / TIMEOUT_CONFIG.MS_PER_SECOND);
      this.questionTimeoutId = setTimeout(() => {
        safeReject(new Error(`Question timeout - auto-cancelled after ${timeoutSec} seconds`));
        this.cleanup();
      }, timeoutMs);
    });

    // Emit event for UI to display first question
    setImmediate(() => {
      this.emit("question-requested", {
        questions: this.currentQuestions,
        currentQuestionIndex: this.currentQuestionIndex,
      } as QuestionRequest);
    });

    try {
      const results = await this.pendingQuestions;

      // Format results as readable output
      let output = "User responses:\n\n";
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        output += `**${result.question}**\n`;
        if (result.customInput) {
          output += `Answer: ${result.customInput}\n`;
        } else {
          output += `Answer: ${result.answers.join(", ")}\n`;
        }
        if (i < results.length - 1) {
          output += "\n";
        }
      }

      return {
        success: true,
        output,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to get user response: ${extractErrorMessage(error)}`,
      };
    }
  }

  /**
   * Submit answer for current question
   */
  submitAnswer(answers: string[], customInput?: string): void {
    if (!this.currentQuestions.length || this.currentQuestionIndex >= this.currentQuestions.length) {
      return;
    }

    const currentQuestion = this.currentQuestions[this.currentQuestionIndex];
    this.collectedResults.push({
      question: currentQuestion.question,
      answers,
      customInput,
    });

    this.currentQuestionIndex++;

    // Check if we have more questions
    if (this.currentQuestionIndex < this.currentQuestions.length) {
      // Emit event for next question
      setImmediate(() => {
        this.emit("question-requested", {
          questions: this.currentQuestions,
          currentQuestionIndex: this.currentQuestionIndex,
        } as QuestionRequest);
      });
    } else {
      // All questions answered, resolve the promise
      if (this.resolveQuestions) {
        if (this.questionTimeoutId) {
          clearTimeout(this.questionTimeoutId);
          this.questionTimeoutId = null;
        }
        this.resolveQuestions(this.collectedResults);
        this.cleanup();
      }
    }
  }

  /**
   * Cancel the question dialog
   */
  cancelQuestions(reason?: string): void {
    if (this.rejectQuestions) {
      if (this.questionTimeoutId) {
        clearTimeout(this.questionTimeoutId);
        this.questionTimeoutId = null;
      }
      this.rejectQuestions(new Error(reason || "Questions cancelled by user"));
      this.cleanup();
    }
  }

  /**
   * Check if questions are pending
   */
  isPending(): boolean {
    return this.pendingQuestions !== null;
  }

  /**
   * Get current question
   */
  getCurrentQuestion(): Question | null {
    if (this.currentQuestionIndex < this.currentQuestions.length) {
      return this.currentQuestions[this.currentQuestionIndex];
    }
    return null;
  }

  /**
   * Get progress info
   */
  getProgress(): { current: number; total: number } {
    return {
      current: this.currentQuestionIndex + 1,
      total: this.currentQuestions.length,
    };
  }

  /**
   * Cleanup internal state
   */
  private cleanup(): void {
    this.resolveQuestions = null;
    this.rejectQuestions = null;
    this.pendingQuestions = null;
    this.currentQuestions = [];
    this.collectedResults = [];
    this.currentQuestionIndex = 0;
  }
}

/**
 * Get the singleton instance
 */
export function getAskUserService(): AskUserService {
  return AskUserService.getInstance();
}

// Legacy support: AskUserTool class that wraps the service
export class AskUserTool {
  private service: AskUserService;

  constructor() {
    this.service = getAskUserService();
  }

  /**
   * Set the callback for asking questions (legacy API - no longer needed)
   * @deprecated Use getAskUserService() events instead
   */
  setAskCallback(_callback: (questions: Question[]) => Promise<QuestionResult[]>): void {
    // No-op: callback-based API is deprecated in favor of EventEmitter pattern
    console.warn("AskUserTool.setAskCallback() is deprecated. Use getAskUserService() events instead.");
  }

  /**
   * Execute the ask user question tool
   */
  async execute(questions: Question[]): Promise<ToolResult> {
    return this.service.askQuestions(questions);
  }
}

/**
 * Singleton instance for legacy API
 */
let askUserToolInstance: AskUserTool | null = null;

/**
 * Get the singleton instance (legacy API)
 * @deprecated Use getAskUserService() instead
 */
export function getAskUserTool(): AskUserTool {
  if (!askUserToolInstance) {
    askUserToolInstance = new AskUserTool();
  }
  return askUserToolInstance;
}
