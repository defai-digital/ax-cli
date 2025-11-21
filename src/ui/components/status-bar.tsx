/**
 * Enhanced Status Bar Component
 * Professional, scannable status display with visual context indicator
 */

import React from "react";
import { Box, Text } from "ink";

interface StatusBarProps {
  projectName: string;
  version: string;
  model: string;
  contextPercentage: number;
  showAutoPrune: boolean;
  autoEditEnabled: boolean;
  verboseMode: boolean;
  backgroundMode?: boolean;
  mcpServerCount?: number;
  backgroundTaskCount?: number;
  isProcessing?: boolean;
  processingTime?: number;
  tokenCount?: number;
  // Flash state for mode toggles (visual feedback)
  flashAutoEdit?: boolean;
  flashVerbose?: boolean;
  flashBackground?: boolean;
}

/**
 * Get accessibility symbol for context status
 * Provides visual indicator for colorblind users
 */
function getStatusSymbol(percentage: number): string {
  if (percentage > 50) return "✓";  // Healthy - plenty of context remaining
  if (percentage > 25) return "⚠";  // Warning - context getting low
  return "✕";  // Critical - context nearly exhausted
}

/**
 * Renders a visual progress bar for context usage
 * Uses block characters for smooth visualization
 * Includes accessibility symbols for colorblind users
 */
function ContextBar({ percentage, showAutoPrune }: { percentage: number; showAutoPrune: boolean }) {
  const barWidth = 15;
  const filledWidth = Math.round((percentage / 100) * barWidth);
  const emptyWidth = barWidth - filledWidth;

  // Color based on remaining context (inverted - high % = more remaining = good)
  const getColor = () => {
    if (percentage > 50) return "green";
    if (percentage > 25) return "yellow";
    return "red";
  };

  // Warning message when context is getting low (85%+ used = 15% remaining)
  const showWarning = percentage <= 15;

  if (showAutoPrune) {
    return (
      <Box>
        <Text color="cyan" bold>
          ↻ auto-pruned
        </Text>
      </Box>
    );
  }

  return (
    <Box>
      <Text color={getColor()}>
        {"█".repeat(filledWidth)}
      </Text>
      <Text color="gray" dimColor>
        {"░".repeat(emptyWidth)}
      </Text>
      <Text color={getColor()}> {getStatusSymbol(percentage)} {percentage.toFixed(0)}%</Text>
      {showWarning && (
        <Text color="red" bold> LOW!</Text>
      )}
    </Box>
  );
}

/**
 * Mode indicator pill component
 * Uses bright colors when enabled for better visibility
 * Supports flash animation on toggle
 */
function ModePill({
  label,
  enabled,
  shortcut,
  enabledColor = "cyan",
  flash = false,
}: {
  label: string;
  enabled: boolean;
  shortcut: string;
  enabledColor?: string;
  flash?: boolean;
}) {
  // Flash effect: briefly highlight when toggled
  const displayColor = flash ? "white" : enabled ? enabledColor : "gray";
  const isBold = flash || enabled;

  return (
    <Box marginRight={2}>
      {enabled ? (
        <>
          <Text color={displayColor} bold={isBold}>●</Text>
          <Text color={displayColor} bold={flash}> {label}</Text>
        </>
      ) : (
        <Text color={displayColor} bold={flash}>○ {label}</Text>
      )}
      <Text color="gray" dimColor>
        {" "}({shortcut})
      </Text>
    </Box>
  );
}

/**
 * Format token count for display
 */
function formatTokens(count: number): string {
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
  return count.toString();
}

export function StatusBar({
  projectName,
  version,
  model,
  contextPercentage,
  showAutoPrune,
  autoEditEnabled,
  verboseMode,
  backgroundMode = false,
  mcpServerCount = 0,
  backgroundTaskCount = 0,
  isProcessing = false,
  tokenCount = 0,
  flashAutoEdit = false,
  flashVerbose = false,
  flashBackground = false,
}: StatusBarProps) {
  return (
    <Box flexDirection="column" marginTop={1}>
      {/* Primary status row */}
      <Box
        borderStyle="single"
        borderColor={isProcessing ? "yellow" : "gray"}
        paddingX={1}
        flexDirection="row"
        justifyContent="space-between"
      >
        {/* Left section: Project & Version */}
        <Box>
          <Text color="magenta" bold>
            {projectName}
          </Text>
          <Text color="gray"> • </Text>
          <Text color="white" bold>ax</Text>
          <Text color="greenBright" bold> v{version}</Text>
        </Box>

        {/* Center section: Model + Token count during processing */}
        <Box>
          <Text color="gray">🤖 </Text>
          <Text color="yellow">{model}</Text>
          {isProcessing && tokenCount > 0 && (
            <Text color="cyan"> ({formatTokens(tokenCount)} tokens)</Text>
          )}
        </Box>

        {/* Right section: Context (remaining), MCP, Background Tasks */}
        <Box>
          <Text color="gray">ctx remaining: </Text>
          <ContextBar percentage={contextPercentage} showAutoPrune={showAutoPrune} />
          {backgroundTaskCount > 0 && (
            <>
              <Text color="gray"> • </Text>
              <Text color="yellow">📦 {backgroundTaskCount} running</Text>
              <Text color="gray" dimColor> (/tasks)</Text>
            </>
          )}
          {mcpServerCount > 0 && (
            <>
              <Text color="gray"> • </Text>
              <Text color="blue">MCP: {mcpServerCount}</Text>
            </>
          )}
        </Box>
      </Box>

      {/* Mode indicators row - always visible for better UX */}
      <Box marginTop={0} paddingX={1}>
        <ModePill
          label="auto-edit"
          enabled={autoEditEnabled}
          shortcut="⇧⇥"
          enabledColor="green"
          flash={flashAutoEdit}
        />
        <ModePill
          label="verbose"
          enabled={verboseMode}
          shortcut="^O"
          enabledColor="yellow"
          flash={flashVerbose}
        />
        <ModePill
          label="bg-mode"
          enabled={backgroundMode}
          shortcut="^B"
          enabledColor="magenta"
          flash={flashBackground}
        />
        {/* Show quick hints only when not processing */}
        {!isProcessing && (
          <Box marginLeft={1}>
            <Text color="gray" dimColor>
              • ^K quick actions • /help commands
            </Text>
          </Box>
        )}
      </Box>
    </Box>
  );
}

export default StatusBar;
