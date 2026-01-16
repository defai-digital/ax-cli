/**
 * Context Window Breakdown Component
 *
 * Displays detailed token usage breakdown by category.
 * Triggered by `/context` command.
 *
 * P1.3: Priority 1 Feature - High Value / Low Risk
 */

import React from "react";
import { Box, Text, useInput } from "ink";
import { formatTokenCount } from "../../utils/token-counter.js";

/** Context usage threshold percentages for status indicators */
const CONTEXT_THRESHOLDS = {
  /** Critical: context nearly exhausted */
  CRITICAL: 95,
  /** High: context getting full */
  HIGH: 80,
  /** Moderate: half capacity */
  MODERATE: 50,
} as const;

interface ContextCategory {
  label: string;
  tokens: number;
  percentage: number;
  color: string;
}

interface ContextBreakdownProps {
  onClose: () => void;
  currentTokens: number;
  maxTokens: number;
  categories: ContextCategory[];
}

/**
 * Render a horizontal bar chart for a category
 */
function CategoryBar({
  label,
  tokens,
  percentage,
  color,
}: {
  label: string;
  tokens: number;
  percentage: number;
  color: string;
}) {
  const barWidth = 10;
  const filledWidth = Math.round((percentage / 100) * barWidth);
  const emptyWidth = barWidth - filledWidth;

  return (
    <Box flexDirection="row" marginY={0}>
      <Box width={25}>
        <Text color="white">{label}</Text>
      </Box>
      <Box width={15}>
        <Text color={color}>
          {"█".repeat(filledWidth)}
        </Text>
        <Text color="gray" dimColor>
          {"░".repeat(emptyWidth)}
        </Text>
      </Box>
      <Box width={20} marginLeft={1}>
        <Text color={color}>{formatTokenCount(tokens)} tokens</Text>
        <Text color="gray"> ({percentage.toFixed(1)}%)</Text>
      </Box>
    </Box>
  );
}

/**
 * Get usage status and color based on percentage
 */
function getUsageStatus(percentageUsed: number): {
  status: string;
  color: string;
  symbol: string;
} {
  if (percentageUsed >= CONTEXT_THRESHOLDS.CRITICAL) {
    return { status: "CRITICAL", color: "red", symbol: "🔴" };
  }
  if (percentageUsed >= CONTEXT_THRESHOLDS.HIGH) {
    return { status: "High", color: "yellow", symbol: "⚠️" };
  }
  if (percentageUsed >= CONTEXT_THRESHOLDS.MODERATE) {
    return { status: "Moderate", color: "yellow", symbol: "📊" };
  }
  return { status: "Good", color: "green", symbol: "✅" };
}

export function ContextBreakdown({
  onClose,
  currentTokens,
  maxTokens,
  categories,
}: ContextBreakdownProps) {
  // Handle Escape key to close the breakdown
  useInput((input, key) => {
    if (key.escape || input === "q") {
      onClose();
    }
  });

  const percentageUsed = (currentTokens / maxTokens) * 100;
  const availableTokens = maxTokens - currentTokens;
  const { status, color, symbol } = getUsageStatus(percentageUsed);

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      {/* Header */}
      <Box borderStyle="double" borderColor="cyan" paddingX={2} marginBottom={1}>
        <Text bold color="cyan">
          📊 Context Window Breakdown
        </Text>
        <Text color="gray"> (Press Esc or q to close)</Text>
      </Box>

      {/* Summary Section */}
      <Box flexDirection="column" marginBottom={1}>
        <Text bold color="yellow">
          Summary:
        </Text>
        <Box paddingLeft={2} flexDirection="column">
          <Box>
            <Text color="white">Total Used: </Text>
            <Text color="cyan" bold>
              {formatTokenCount(currentTokens)} / {formatTokenCount(maxTokens)} tokens
            </Text>
            <Text color="gray"> ({percentageUsed.toFixed(1)}% used)</Text>
          </Box>
          <Box>
            <Text color="white">Available: </Text>
            <Text color="green" bold>
              {formatTokenCount(availableTokens)} tokens
            </Text>
            <Text color="gray"> ({(100 - percentageUsed).toFixed(1)}% free)</Text>
          </Box>
          <Box>
            <Text color="white">Status: </Text>
            <Text color={color} bold>
              {symbol} {status}
            </Text>
          </Box>
        </Box>
      </Box>

      {/* Breakdown Section */}
      <Box flexDirection="column" marginBottom={1}>
        <Text bold color="yellow">
          Breakdown by Category:
        </Text>
        <Box paddingLeft={2} flexDirection="column">
          {categories.map((category, index) => (
            <CategoryBar
              key={index}
              label={category.label}
              tokens={category.tokens}
              percentage={category.percentage}
              color={category.color}
            />
          ))}
        </Box>
      </Box>

      {/* Warnings Section */}
      {percentageUsed >= CONTEXT_THRESHOLDS.HIGH && (
        <Box flexDirection="column" marginBottom={1}>
          <Text bold color="red">
            ⚠️  Context Usage Warning:
          </Text>
          <Box paddingLeft={2} flexDirection="column">
            {percentageUsed >= CONTEXT_THRESHOLDS.CRITICAL && (
              <Text color="red">
                • CRITICAL: Context nearly full! Responses may fail soon.
              </Text>
            )}
            {percentageUsed >= CONTEXT_THRESHOLDS.HIGH && percentageUsed < CONTEXT_THRESHOLDS.CRITICAL && (
              <Text color="yellow">
                • Context getting full. Consider freeing up space soon.
              </Text>
            )}
            <Text color="gray">
              • Use /clear to remove old messages
            </Text>
            <Text color="gray">
              • Start a new session if needed
            </Text>
          </Box>
        </Box>
      )}

      {/* Tips Section */}
      {percentageUsed < CONTEXT_THRESHOLDS.HIGH && (
        <Box flexDirection="column" marginBottom={1}>
          <Text bold color="green">
            💡 Tips:
          </Text>
          <Box paddingLeft={2} flexDirection="column">
            <Text color="gray">
              • You have plenty of context available ({(100 - percentageUsed).toFixed(0)}% free)
            </Text>
            <Text color="gray">
              • Context includes conversation history and system instructions
            </Text>
            <Text color="gray">
              • Use /clear to reset conversation if needed
            </Text>
          </Box>
        </Box>
      )}

      {/* Footer */}
      <Box borderStyle="single" borderColor="gray" paddingX={1} marginTop={1}>
        <Text color="gray" dimColor>
          💡 Tip: Monitor context usage in the status bar • Press Ctrl+K for quick actions
        </Text>
      </Box>
    </Box>
  );
}

export default ContextBreakdown;
