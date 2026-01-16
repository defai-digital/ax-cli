import React, { useState } from "react";
import { Box, Text } from "ink";

/** Display configuration for reasoning content */
const REASONING_CONFIG = {
  /** Word count threshold for auto-collapse */
  AUTO_COLLAPSE_WORDS: 200,
  /** Character count threshold for auto-collapse */
  AUTO_COLLAPSE_CHARS: 1000,
  /** Number of characters to show in collapsed preview */
  PREVIEW_LENGTH: 80,
} as const;

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
  // Auto-collapse if content exceeds thresholds and not explicitly set
  const trimmedContent = content.trim();
  // BUG FIX: Empty string split returns [""], so check for empty first
  const wordCount = trimmedContent.length === 0 ? 0 : trimmedContent.split(/\s+/).length;
  const charCount = trimmedContent.length;
  const shouldAutoCollapse = !isStreaming && (
    wordCount > REASONING_CONFIG.AUTO_COLLAPSE_WORDS ||
    charCount > REASONING_CONFIG.AUTO_COLLAPSE_CHARS
  );

  // Note: setCollapsed is available for future interactive toggle feature (Ctrl+R)
  const [collapsed] = useState(defaultCollapsed || shouldAutoCollapse);

  // Don't render if not visible or no content
  if (!visible || !content || content.trim().length === 0) {
    return null;
  }

  // Show preview when collapsed
  // BUG FIX: Use trimmedContent for consistent length check
  const preview = collapsed && trimmedContent.length > REASONING_CONFIG.PREVIEW_LENGTH
    ? trimmedContent.slice(0, REASONING_CONFIG.PREVIEW_LENGTH) + "..."
    : null;

  return (
    <Box flexDirection="column" marginBottom={1} paddingLeft={2} borderStyle="single" borderColor="gray">
      {/* BUG FIX: Removed redundant ternary (both branches were 0), add spacing when expanded */}
      <Box flexDirection="row" marginBottom={collapsed ? 0 : 1}>
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
          {/* BUG FIX: Use trimmedContent for consistency with metrics and preview */}
          <Text color="white" dimColor italic>
            {trimmedContent}
          </Text>
        </Box>
      )}
    </Box>
  );
}
