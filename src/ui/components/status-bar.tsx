/**
 * Enhanced Status Bar Component
 * Professional, scannable status display with visual context indicator
 */

import React from "react";
import { Box, Text } from "ink";
import { VerbosityLevel } from "../../constants.js";

interface StatusBarProps {
  projectName: string;
  version: string;
  model: string;
  contextPercentage: number;
  showAutoPrune: boolean;
  autoEditEnabled: boolean;
  /** @deprecated Use verbosityLevel instead. Will be removed in v4.0. */
  verboseMode?: boolean;
  verbosityLevel?: VerbosityLevel;
  backgroundMode?: boolean;
  /** @deprecated Use mcpStatus instead */
  mcpServerCount?: number;
  /** MCP connection status with connected/total counts */
  mcpStatus?: { connected: number; failed: number; connecting: number; total: number };
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
  /** Active agent name when agent-first mode routes to a specific agent */
  activeAgent?: string | null;
  /** Multiple active agents running concurrently */
  activeAgents?: string[];
  // Phase 2: Thinking mode indicator
  thinkingModeEnabled?: boolean;
  flashThinkingMode?: boolean;
  isThinking?: boolean; // Currently processing with reasoning
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
  // Handle invalid inputs
  if (!Number.isFinite(tokens) || tokens < 0) return "0";

  if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`;
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(0)}k`;
  return Math.floor(tokens).toString();
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
  // Clamp percentage to valid range [0, 100] to prevent crashes
  const safePercentage = Math.max(0, Math.min(100, percentage || 0));
  const filledWidth = Math.round((safePercentage / 100) * barWidth);
  const emptyWidth = barWidth - filledWidth;
  const color = getContextColor(safePercentage);
  // Warning message when context is getting low (85%+ used = 15% remaining)
  const showWarning = safePercentage <= 15;

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
      <Text color={color}>
        {"█".repeat(filledWidth)}
      </Text>
      <Text color="gray" dimColor>
        {"░".repeat(emptyWidth)}
      </Text>
      <Text color={color}> {getStatusSymbol(safePercentage)} {safePercentage.toFixed(0)}%</Text>
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
 * Shows clear "Label: On/Off" or "Label: Value" format for better visibility
 * Supports flash animation on toggle
 */
function ModePill({
  label,
  enabled,
  value,
  shortcut,
  enabledColor = "cyan",
  flash = false,
}: {
  label: string;
  enabled?: boolean;
  value?: string;
  shortcut: string;
  enabledColor?: string;
  flash?: boolean;
}) {
  // Flash effect: briefly highlight when toggled
  const displayColor = flash ? "white" : (enabled !== undefined && enabled) ? enabledColor : "gray";
  const isBold = flash || (enabled !== undefined && enabled);
  const status = value !== undefined ? value : (enabled ? "On" : "Off");

  return (
    <Box marginRight={2}>
      <Text color={displayColor} bold={isBold}>{label}: {status}</Text>
      <Text color="gray">
        {" "}({shortcut})
      </Text>
    </Box>
  );
}

/** Verbosity level names lookup table */
const VERBOSITY_NAMES: Record<VerbosityLevel, string> = {
  [VerbosityLevel.QUIET]: "Quiet",
  [VerbosityLevel.CONCISE]: "Concise",
  [VerbosityLevel.VERBOSE]: "Verbose",
};

function getVerbosityName(level: VerbosityLevel): string {
  return VERBOSITY_NAMES[level] ?? "Quiet";
}

/**
 * Get effective verbosity level from props (handles deprecated verboseMode)
 */
function getEffectiveVerbosityLevel(
  verbosityLevel: VerbosityLevel | undefined,
  verboseMode: boolean | undefined
): VerbosityLevel {
  return verbosityLevel !== undefined
    ? verbosityLevel
    : (verboseMode ? VerbosityLevel.VERBOSE : VerbosityLevel.QUIET);
}

/**
 * Combine single activeAgent with activeAgents array, avoiding duplicates
 */
function combineActiveAgents(
  activeAgent: string | null | undefined,
  activeAgents: string[]
): string[] {
  if (!activeAgent) return activeAgents;
  return [activeAgent, ...activeAgents.filter(a => a !== activeAgent)];
}

/**
 * AX Indicator Component - shows active agents or default ax indicator
 */
function AXIndicator({ agents }: { agents: string[] }) {
  if (agents.length > 0) {
    return <Text color="cyan" bold>⚡ {agents.join(", ")}</Text>;
  }
  return <Text color="green">⚡ ax</Text>;
}

/**
 * Get context bar color based on percentage
 */
function getContextColor(percentage: number): string {
  if (percentage > 50) return "green";
  if (percentage > 25) return "yellow";
  return "red";
}

/**
 * MCP Status Indicator Component
 * Shows connected/total with color coding based on health
 */
function MCPIndicator({
  mcpStatus,
  mcpServerCount,
}: {
  mcpStatus?: { connected: number; failed: number; connecting: number; total: number };
  mcpServerCount?: number;
}) {
  // Use new status if available, fallback to legacy count
  if (mcpStatus) {
    const { connected, failed, connecting, total } = mcpStatus;

    // Don't show if no servers configured
    if (total === 0) {
      return <Text color="gray">mcp: -</Text>;
    }

    // Determine color based on status
    let color: string;
    let symbol: string;

    if (failed > 0) {
      color = "red";
      symbol = "✗";
    } else if (connecting > 0) {
      color = "yellow";
      symbol = "◐";
    } else if (connected === total) {
      color = "green";
      symbol = "✓";
    } else {
      color = "yellow";
      symbol = "○";
    }

    return (
      <Text color={color}>
        mcp: {symbol} {connected}/{total}
      </Text>
    );
  }

  // Legacy fallback: just show count
  return (
    <Text color={mcpServerCount && mcpServerCount > 0 ? "blue" : "gray"}>
      mcp: {mcpServerCount ?? 0}
    </Text>
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
    verbosityLevel,
    backgroundMode = false,
    mcpServerCount = 0,
    mcpStatus,
    backgroundTaskCount = 0,
    isProcessing = false,
    currentTokens,
    maxTokens,
    flashAutoEdit = false,
    flashVerbose = false,
    flashBackground = false,
    axEnabled = false,
    activeAgent = null,
    activeAgents = [],
    thinkingModeEnabled = false,
    flashThinkingMode = false,
    isThinking = false,
  } = props;

  const effectiveVerbosityLevel = getEffectiveVerbosityLevel(verbosityLevel, verboseMode);
  const allActiveAgents = combineActiveAgents(activeAgent, activeAgents);

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
          {axEnabled && (
            <>
              <Text color="gray"> • </Text>
              <AXIndicator agents={allActiveAgents} />
            </>
          )}
        </Box>
      </Box>

      {/* Row 2: Context, Tasks, MCP */}
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
          <MCPIndicator mcpStatus={mcpStatus} mcpServerCount={mcpServerCount} />
        </Box>
      </Box>

      {/* Row 3: Mode indicators (compact) */}
      <Box paddingX={1}>
        <ModePill
          label="Auto-Edit"
          enabled={autoEditEnabled}
          shortcut="⇧⇥"
          enabledColor="yellow"
          flash={flashAutoEdit}
        />
        <ModePill
          label="Verbosity"
          value={getVerbosityName(effectiveVerbosityLevel)}
          enabled={effectiveVerbosityLevel !== VerbosityLevel.QUIET}
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
        <ModePill
          label="Thinking"
          enabled={thinkingModeEnabled}
          shortcut="Tab"
          enabledColor="cyan"
          flash={flashThinkingMode}
        />
        {/* Phase 2: Thinking mode indicator - only show when actively thinking */}
        {thinkingModeEnabled && isThinking && (
          <Box marginLeft={1}>
            <Text
              color={flashThinkingMode ? "white" : "cyan"}
              bold
            >
              🤔 THINKING...
            </Text>
          </Box>
        )}
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
    verbosityLevel,
    backgroundMode = false,
    mcpServerCount = 0,
    mcpStatus,
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
    activeAgent = null,
    activeAgents = [],
    thinkingModeEnabled = false,
    flashThinkingMode = false,
    isThinking = false,
  } = props;

  const effectiveVerbosityLevel = getEffectiveVerbosityLevel(verbosityLevel, verboseMode);
  const allActiveAgents = combineActiveAgents(activeAgent, activeAgents);

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

        {/* Center section: Model + AX + Token count during processing */}
        <Box>
          <Text color="gray">🤖 </Text>
          <Text color="yellow">{model}</Text>
          {axEnabled && (
            <>
              <Text color="gray"> • </Text>
              <AXIndicator agents={allActiveAgents} />
            </>
          )}
          {isProcessing && tokenCount > 0 && (
            <Text color="cyan"> ({formatTokenCount(tokenCount)} tokens)</Text>
          )}
        </Box>

        {/* Right section: Context (available), MCP, Background Tasks */}
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
          <MCPIndicator mcpStatus={mcpStatus} mcpServerCount={mcpServerCount} />
        </Box>
      </Box>

      {/* Mode indicators row - always visible for better UX */}
      <Box marginTop={0} paddingX={1}>
        <ModePill
          label="Auto-Edit"
          enabled={autoEditEnabled}
          shortcut="⇧⇥"
          enabledColor="yellow"
          flash={flashAutoEdit}
        />
        <ModePill
          label="Verbosity"
          value={getVerbosityName(effectiveVerbosityLevel)}
          enabled={effectiveVerbosityLevel !== VerbosityLevel.QUIET}
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
        <ModePill
          label="Thinking"
          enabled={thinkingModeEnabled}
          shortcut="Tab"
          enabledColor="cyan"
          flash={flashThinkingMode}
        />
        {/* Phase 2: Thinking mode indicator - only show when actively thinking */}
        {thinkingModeEnabled && isThinking && (
          <Box marginLeft={1}>
            <Text
              color={flashThinkingMode ? "white" : "cyan"}
              bold
            >
              🤔 THINKING...
            </Text>
          </Box>
        )}
        {/* Show quick hints only when not processing and not in auto-edit mode */}
        {!isProcessing && !autoEditEnabled && (
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
