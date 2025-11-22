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
  terminalWidth?: number;  // Terminal width for responsive layout
  // Enhanced context info (Phase 3)
  currentTokens?: number;
  maxTokens?: number;
  // Flash state for mode toggles (visual feedback)
  flashAutoEdit?: boolean;
  flashVerbose?: boolean;
  flashBackground?: boolean;
  // AutomatosX integration
  axEnabled?: boolean;
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
 * Format token count for human-readable display
 */
function formatTokenCount(tokens: number): string {
  if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`;
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(0)}k`;
  return tokens.toString();
}

/**
 * Renders a visual progress bar for context usage
 * Uses block characters for smooth visualization
 * Includes accessibility symbols for colorblind users
 * Phase 3: Enhanced with token count display
 */
function ContextBar({
  percentage,
  showAutoPrune,
  currentTokens,
  maxTokens
}: {
  percentage: number;
  showAutoPrune: boolean;
  currentTokens?: number;
  maxTokens?: number;
}) {
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
      {/* Phase 3: Show detailed token count if available */}
      {currentTokens !== undefined && maxTokens !== undefined && (
        <Text color="gray" dimColor> ({formatTokenCount(currentTokens)}/{formatTokenCount(maxTokens)})</Text>
      )}
      {showWarning && (
        <Text color="red" bold> LOW!</Text>
      )}
    </Box>
  );
}

/**
 * Mode indicator pill component
 * Shows clear "Label: On/Off" format for better visibility
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
  const status = enabled ? "On" : "Off";

  return (
    <Box marginRight={2}>
      <Text color={displayColor} bold={isBold}>{label}: {status}</Text>
      <Text color="gray">
        {" "}({shortcut})
      </Text>
    </Box>
  );
}


/**
 * Compact Status Bar for narrow terminals (< 100 columns)
 * Stacks information vertically to prevent wrapping
 */
function CompactStatusBar(props: StatusBarProps) {
  const {
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
    currentTokens,
    maxTokens,
    flashAutoEdit = false,
    flashVerbose = false,
    flashBackground = false,
    axEnabled = false,
  } = props;

  return (
    <Box flexDirection="column" marginTop={1}>
      {/* Row 1: Project & Model */}
      <Box
        borderStyle="single"
        borderColor={isProcessing ? "yellow" : "gray"}
        paddingX={1}
        flexDirection="row"
        justifyContent="space-between"
      >
        <Box>
          <Text color="magenta" bold>{projectName}</Text>
          <Text color="gray"> • </Text>
          <Text color="white" bold>ax-cli</Text>
          <Text color="greenBright" bold> v{version}</Text>
        </Box>
        <Box>
          <Text color="gray">🤖 </Text>
          <Text color="yellow">{model}</Text>
        </Box>
      </Box>

      {/* Row 2: Context, Tasks, MCP, AX */}
      <Box paddingX={1} flexDirection="row" justifyContent="space-between">
        <Box>
          <Text color="gray">ctx: </Text>
          <ContextBar
            percentage={contextPercentage}
            showAutoPrune={showAutoPrune}
            currentTokens={currentTokens}
            maxTokens={maxTokens}
          />
        </Box>
        <Box>
          <Text color={backgroundTaskCount > 0 ? "yellow" : "gray"}>bg: {backgroundTaskCount}</Text>
          <Text color="gray"> • </Text>
          <Text color={mcpServerCount > 0 ? "blue" : "gray"}>mcp: {mcpServerCount}</Text>
          {axEnabled && (
            <>
              <Text color="gray"> • </Text>
              <Text color="green">⚡ ax</Text>
            </>
          )}
        </Box>
      </Box>

      {/* Row 3: Mode indicators (compact) */}
      <Box paddingX={1}>
        <ModePill
          label="Auto-apply"
          enabled={autoEditEnabled}
          shortcut="⇧⇥"
          enabledColor="green"
          flash={flashAutoEdit}
        />
        <ModePill
          label="Verbose"
          enabled={verboseMode}
          shortcut="^O"
          enabledColor="yellow"
          flash={flashVerbose}
        />
        <ModePill
          label="Background"
          enabled={backgroundMode}
          shortcut="^B"
          enabledColor="magenta"
          flash={flashBackground}
        />
      </Box>
    </Box>
  );
}

export function StatusBar(props: StatusBarProps) {
  const {
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
    terminalWidth = 120,  // Default to wide layout
    currentTokens,
    maxTokens,
    flashAutoEdit = false,
    flashVerbose = false,
    flashBackground = false,
    axEnabled = false,
  } = props;

  // Use compact layout for narrow terminals (< 100 columns)
  if (terminalWidth < 100) {
    return <CompactStatusBar {...props} />;
  }

  // Full layout for wide terminals
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
          <Text color="white" bold>ax-cli</Text>
          <Text color="greenBright" bold> v{version}</Text>
        </Box>

        {/* Center section: Model + Token count during processing */}
        <Box>
          <Text color="gray">🤖 </Text>
          <Text color="yellow">{model}</Text>
          {isProcessing && tokenCount > 0 && (
            <Text color="cyan"> ({formatTokenCount(tokenCount)} tokens)</Text>
          )}
        </Box>

        {/* Right section: Context (available), MCP, Background Tasks, AX */}
        <Box>
          <Text color="gray">ctx avail: </Text>
          <ContextBar
            percentage={contextPercentage}
            showAutoPrune={showAutoPrune}
            currentTokens={currentTokens}
            maxTokens={maxTokens}
          />
          <Text color="gray"> • </Text>
          <Text color={backgroundTaskCount > 0 ? "yellow" : "gray"}>bg: {backgroundTaskCount}</Text>
          <Text color="gray"> • </Text>
          <Text color={mcpServerCount > 0 ? "blue" : "gray"}>mcp: {mcpServerCount}</Text>
          {axEnabled && (
            <>
              <Text color="gray"> • </Text>
              <Text color="green">⚡ ax</Text>
            </>
          )}
        </Box>
      </Box>

      {/* Mode indicators row - always visible for better UX */}
      <Box marginTop={0} paddingX={1}>
        <ModePill
          label="Auto-apply"
          enabled={autoEditEnabled}
          shortcut="⇧⇥"
          enabledColor="green"
          flash={flashAutoEdit}
        />
        <ModePill
          label="Verbose"
          enabled={verboseMode}
          shortcut="^O"
          enabledColor="yellow"
          flash={flashVerbose}
        />
        <ModePill
          label="Background"
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
