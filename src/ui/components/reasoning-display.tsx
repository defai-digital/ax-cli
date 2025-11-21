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
  // Auto-collapse if content is long (>200 words or >1000 chars) and not explicitly set
  const wordCount = content.trim().split(/\s+/).length;
  const charCount = content.trim().length;
  const shouldAutoCollapse = !isStreaming && (wordCount > 200 || charCount > 1000);

  // Note: setCollapsed is available for future interactive toggle feature (Ctrl+R)
  const [collapsed] = useState(defaultCollapsed || shouldAutoCollapse);

  // Don't render if not visible or no content
  if (!visible || !content || content.trim().length === 0) {
    return null;
  }

  // Show preview when collapsed (first 80 characters)
  const preview = collapsed && content.length > 80
    ? content.slice(0, 80) + "..."
    : null;

  return (
    <Box flexDirection="column" marginBottom={1} paddingLeft={2} borderStyle="single" borderColor="gray">
      <Box flexDirection="row" marginBottom={collapsed ? 0 : 0}>
        <Text color="cyan">
          💭 Thinking {collapsed ? "▸" : "▾"}
          {isStreaming ? "..." : ` (${wordCount} words)`}
        </Text>
        {!isStreaming && (
          <Text color="gray" dimColor> [Ctrl+R to toggle]</Text>
        )}
      </Box>
      {collapsed && preview && (
        <Box flexDirection="column" paddingLeft={1} marginTop={0}>
          <Text color="gray" dimColor italic>
            {preview}
          </Text>
        </Box>
      )}
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
