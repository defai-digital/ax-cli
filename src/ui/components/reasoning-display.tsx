import React from "react";
import { Box, Text } from "ink";

export interface ReasoningDisplayProps {
  /**
   * Reasoning content from GLM-4.6 thinking mode
   */
  content: string;
  /**
   * Whether to show the reasoning content
   * @default true
   */
  visible?: boolean;
  /**
   * Whether this is a streaming update
   * @default false
   */
  isStreaming?: boolean;
}

/**
 * ReasoningDisplay Component
 *
 * Displays GLM-4.6 reasoning content (thinking mode) with visual
 * separation from the final answer.
 *
 * Features:
 * - Visual distinction with dimmed styling
 * - Streaming support with indicator
 * - Clear separation from final answer
 */
export function ReasoningDisplay({
  content,
  visible = true,
  isStreaming = false,
}: ReasoningDisplayProps) {
  // Don't render if not visible or no content
  if (!visible || !content || content.trim().length === 0) {
    return null;
  }

  return (
    <Box flexDirection="column" marginBottom={1} paddingLeft={2} borderStyle="single" borderColor="gray">
      <Box flexDirection="row" marginBottom={0}>
        <Text color="cyan" dimColor>
          💭 Thinking{isStreaming ? "..." : ""}
        </Text>
      </Box>
      <Box flexDirection="column" paddingLeft={1}>
        <Text color="white" dimColor italic>
          {content}
        </Text>
      </Box>
    </Box>
  );
}
