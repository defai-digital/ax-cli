/**
 * Ask User Question Tool
 *
 * Allows the AI to ask the user questions during execution.
 * Supports multiple choice questions with optional custom input.
 *
 * @packageDocumentation
 */

import type { ToolResult } from "../types/index.js";

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
 * Callback type for asking questions
 */
export type AskQuestionCallback = (questions: Question[]) => Promise<QuestionResult[]>;

/**
 * Ask User Question Tool
 *
 * Allows the AI to ask clarifying questions during execution.
 */
export class AskUserTool {
  private askCallback: AskQuestionCallback | null = null;

  /**
   * Set the callback for asking questions
   */
  setAskCallback(callback: AskQuestionCallback): void {
    this.askCallback = callback;
  }

  /**
   * Execute the ask user question tool
   */
  async execute(questions: Question[]): Promise<ToolResult> {
    if (!this.askCallback) {
      return {
        success: false,
        error: "Question callback not set. Unable to ask user questions.",
      };
    }

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

    try {
      const results = await this.askCallback(questions);

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
        error: `Failed to get user response: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
}

/**
 * Singleton instance
 */
let askUserToolInstance: AskUserTool | null = null;

/**
 * Get the singleton instance
 */
export function getAskUserTool(): AskUserTool {
  if (!askUserToolInstance) {
    askUserToolInstance = new AskUserTool();
  }
  return askUserToolInstance;
}
