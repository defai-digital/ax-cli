/**
 * Shared types for AX CLI VS Code extension
 *
 * These types are used across multiple modules to ensure consistency
 * and reduce duplication.
 */

/**
 * CLI request payload sent to the AI backend
 */
export interface CLIRequest {
  id: string;
  prompt: string;
  context?: {
    file?: string;
    selection?: string;
    lineRange?: string;
    gitDiff?: boolean;
    // File attachments
    files?: Array<{ path: string; name: string; content?: string }>;
    // Image attachments with base64 data
    images?: Array<{ path: string; name: string; dataUri?: string; mimeType?: string }>;
    // Extended thinking mode
    extendedThinking?: boolean;
  };
}

/**
 * Successful CLI response from AI backend
 */
export interface CLIResponse {
  id: string;
  messages: Array<{
    role: string;
    content: string;
  }>;
  model: string;
  timestamp: string;
}

/**
 * Error response from CLI
 */
export interface CLIError {
  id: string;
  error: {
    message: string;
    type: string;
  };
  timestamp: string;
}

/**
 * Pending file change awaiting user approval
 */
export interface PendingChange {
  id: string;
  file: string;
  oldContent: string;
  newContent: string;
  command: string;
  lineStart?: number;
  lineEnd?: number;
  toolCall: unknown;
}

/**
 * Streaming chunk types for real-time responses
 */
export interface StreamingChunk {
  type: 'thinking' | 'content' | 'tool_call' | 'tool_result' | 'done' | 'error';
  content?: string;
  toolCall?: { id: string; name: string; arguments: string };
  toolResult?: { id: string; result: string; isError: boolean };
  error?: string;
}
