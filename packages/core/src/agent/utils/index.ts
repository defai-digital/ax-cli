/**
 * Agent Utility Functions
 *
 * Re-exports pure utility functions for message processing,
 * formatting, and other agent-related operations.
 *
 * @packageDocumentation
 */

export {
  extractDisplayContent,
  getTextContentFromMessage,
  hasMultimodalContent,
  formatToolResultContent,
  getLoopWarningMessage,
  getCancellationMessage,
  formatContextWarning,
  parseToolArguments,
  type MessageContentPart,
  type TextContentPart,
  type ImageContentPart,
  type LoopDetectionResult,
} from './message-utils.js';
