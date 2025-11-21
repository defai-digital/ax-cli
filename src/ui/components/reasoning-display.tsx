import React, { useState } from "react";
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
  /**
   * Whether to start collapsed
   * @default false
   */
  defaultCollapsed?: boolean;
}

/**
 * ReasoningDisplay Component
 *
 * Displays GLM-4.6 reasoning content (thinking mode) with visual
 * separation from the final answer.
 *
 * Features:
 * - Collapsible to reduce clutter
 * - Visual distinction with dimmed styling
 * - Streaming support with indicator
 * - Word count estimate
 * - Clear separation from final answer
 */
export function ReasoningDisplay({
  content,
  visible = true,
  isStreaming = false,
  defaultCollapsed = false,
}: ReasoningDisplayProps) {
  const [collapsed] = useState(defaultCollapsed);

  // Don't render if not visible or no content
  if (!visible || !content || content.trim().length === 0) {
    return null;
  }

  // Estimate word count
  const wordCount = content.trim().split(/\s+/).length;

  return (
    <Box flexDirection="column" marginBottom={1} paddingLeft={2} borderStyle="single" borderColor="gray">
      <Box flexDirection="row" marginBottom={collapsed ? 0 : 0}>
        <Text color="cyan">
          💭 Thinking {collapsed ? "▸" : "▾"}
          {isStreaming ? "..." : ` (${wordCount} words)`}
        </Text>
      </Box>
      {!collapsed && (
        <Box flexDirection="column" paddingLeft={1}>
          <Text color="white" dimColor italic>
            {content}
          </Text>
        </Box>
      )}
    </Box>
  );
}
