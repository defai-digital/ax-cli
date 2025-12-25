/**
 * Enhanced Status Bar Component
 * Professional, scannable status display with visual context indicator
 */

import React from "react";
import { Box, Text } from "ink";
import { VerbosityLevel } from "../../constants.js";
import { getThemeColors, type ThemeColors } from "../utils/colors.js";
import { useTranslations } from "../hooks/use-translations.js";
import type { UITranslations } from "../../i18n/types.js";

interface StatusBarProps {
  projectName: string;
  version: string;
  model: string;
  /** CLI name to display (e.g., 'ax-cli', 'ax-glm', 'ax-grok') */
  cliName?: string;
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
  maxTokens,
  theme,
  t,
}: {
  percentage: number;
  showAutoPrune: boolean;
  currentTokens?: number;
  maxTokens?: number;
  theme: ThemeColors;
  t: UITranslations;
}) {
  const barWidth = 15;
  // Clamp percentage to valid range [0, 100] to prevent crashes
  const safePercentage = Math.max(0, Math.min(100, percentage || 0));
  const filledWidth = Math.round((safePercentage / 100) * barWidth);
  const emptyWidth = barWidth - filledWidth;
  const color = getContextColor(safePercentage, theme);
  // Warning message when context is getting low (85%+ used = 15% remaining)
  const showWarning = safePercentage <= 15;

  if (showAutoPrune) {
    return (
      <Box>
        <Text color={theme.primary} bold>
          ↻ {t.status.autoPruned || 'auto-pruned'}
        </Text>
      </Box>
    );
  }

  return (
    <Box>
      <Text color={color}>
        {"█".repeat(filledWidth)}
      </Text>
      <Text color={theme.muted} dimColor>
        {"░".repeat(emptyWidth)}
      </Text>
      <Text color={color}> {getStatusSymbol(safePercentage)} {safePercentage.toFixed(0)}%</Text>
      {/* Phase 3: Show detailed token count if available */}
      {currentTokens !== undefined && maxTokens !== undefined && (
        <Text color={theme.muted} dimColor> ({formatTokenCount(currentTokens)}/{formatTokenCount(maxTokens)})</Text>
      )}
      {showWarning && (
        <Text color={theme.error} bold> {t.status.contextWarning}</Text>
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
  enabledColor,
  flash = false,
  theme,
  t,
}: {
  label: string;
  enabled?: boolean;
  value?: string;
  shortcut: string;
  enabledColor?: string;
  flash?: boolean;
  theme: ThemeColors;
  t: UITranslations;
}) {
  // Flash effect: briefly highlight when toggled
  // Flash effect uses textOnHighlight for visibility on any background
  // Default enabledColor to theme.primary if not provided
  const effectiveEnabledColor = enabledColor ?? theme.primary;
  const displayColor = flash ? theme.textOnHighlight : (enabled !== undefined && enabled) ? effectiveEnabledColor : theme.muted;
  const isBold = flash || (enabled !== undefined && enabled);
  const status = value !== undefined ? value : (enabled ? t.status.on : t.status.off);

  return (
    <Box marginRight={2}>
      <Text color={displayColor} bold={isBold}>{label}: {status}</Text>
      <Text color={theme.muted}>
        {" "}({shortcut})
      </Text>
    </Box>
  );
}

/** Get localized verbosity name */
function getVerbosityName(level: VerbosityLevel, t: UITranslations): string {
  switch (level) {
    case VerbosityLevel.QUIET: return t.status.quiet;
    case VerbosityLevel.CONCISE: return t.status.concise;
    case VerbosityLevel.VERBOSE: return t.status.verbose;
    default: return t.status.quiet;
  }
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
 * Agent name to role mapping for display in status bar
 * Shows role instead of agent name for better UX
 */
const AGENT_ROLES: Record<string, string> = {
  tony: "CTO",
  bob: "Backend",
  avery: "Architect",
  stan: "Standards",
  steve: "Security",
  felix: "Fullstack",
  frank: "Frontend",
  queenie: "QA",
  wendy: "Writer",
  oliver: "DevOps",
  paris: "Product",
  maya: "Mobile",
  dana: "Data Science",
  daisy: "Data Eng",
  debbee: "Design",
  eric: "Executive",
  rodman: "Research",
  candy: "Marketing",
  quinn: "Quantum",
  astrid: "Aerospace",
};

/**
 * Get display role for an agent name
 */
function getAgentRole(agentName: string): string {
  const lower = agentName.toLowerCase();
  return AGENT_ROLES[lower] || agentName;
}

/**
 * AX Indicator Component - shows active agent roles or default ax indicator
 */
function AXIndicator({ agents, theme }: { agents: string[]; theme: ThemeColors }) {
  if (agents.length > 0) {
    const roles = agents.map(getAgentRole);
    return <Text color={theme.primary} bold>⚡ {roles.join(", ")}</Text>;
  }
  return <Text color={theme.success}>⚡ ax</Text>;
}

/**
 * Get context bar color based on percentage (theme-aware)
 */
function getContextColor(percentage: number, theme: ThemeColors): string {
  if (percentage > 50) return theme.success;
  if (percentage > 25) return theme.warning;
  return theme.error;
}

/**
 * MCP Status Indicator Component
 * Shows connected/total with color coding based on health
 */
function MCPIndicator({
  mcpStatus,
  mcpServerCount,
  theme,
}: {
  mcpStatus?: { connected: number; failed: number; connecting: number; total: number };
  mcpServerCount?: number;
  theme: ThemeColors;
}) {
  // Use new status if available, fallback to legacy count
  if (mcpStatus) {
    const { connected, failed, connecting, total } = mcpStatus;

    // Don't show if no servers configured
    if (total === 0) {
      return <Text color={theme.muted}>mcp: -</Text>;
    }

    // Determine color based on status
    let color: string;
    let symbol: string;

    if (failed > 0) {
      color = theme.error;
      symbol = "✗";
    } else if (connecting > 0) {
      color = theme.warning;
      symbol = "◐";
    } else if (connected === total) {
      color = theme.success;
      symbol = "✓";
    } else {
      color = theme.warning;
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
    <Text color={mcpServerCount && mcpServerCount > 0 ? theme.info : theme.muted}>
      mcp: {mcpServerCount ?? 0}
    </Text>
  );
}


/**
 * Compact Status Bar for narrow terminals (< 100 columns)
 * Stacks information vertically to prevent wrapping
 */
function CompactStatusBar(props: StatusBarProps & { theme: ThemeColors; t: UITranslations }) {
  const {
    projectName,
    version,
    model,
    cliName = 'ax-cli',
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
    theme,
  } = props;
  const t = props.t;

  const effectiveVerbosityLevel = getEffectiveVerbosityLevel(verbosityLevel, verboseMode);
  const allActiveAgents = combineActiveAgents(activeAgent, activeAgents);

  return (
    <Box flexDirection="column" marginTop={1}>
      {/* Row 1: Project & Model */}
      <Box
        borderStyle="single"
        borderColor={isProcessing ? theme.warning : theme.border}
        paddingX={1}
        flexDirection="row"
        justifyContent="space-between"
      >
        <Box>
          <Text color={theme.accent} bold>{projectName}</Text>
          <Text color={theme.muted}> • </Text>
          <Text color={theme.info} bold>{cliName}</Text>
          <Text color={theme.success} bold> v{version}</Text>
        </Box>
        <Box>
          <Text color={theme.muted}>🤖 </Text>
          <Text color={theme.warning}>{model}</Text>
          {axEnabled && (
            <>
              <Text color={theme.muted}> • </Text>
              <AXIndicator agents={allActiveAgents} theme={theme} />
            </>
          )}
        </Box>
      </Box>

      {/* Row 2: Context, Tasks, MCP */}
      <Box paddingX={1} flexDirection="row" justifyContent="space-between">
        <Box>
          <Text color={theme.muted}>{t.status.context}: </Text>
          <ContextBar
            percentage={contextPercentage}
            showAutoPrune={showAutoPrune}
            currentTokens={currentTokens}
            maxTokens={maxTokens}
            theme={theme}
            t={t}
          />
        </Box>
        <Box>
          <Text color={backgroundTaskCount > 0 ? theme.warning : theme.muted}>{t.status.background}: {backgroundTaskCount}</Text>
          <Text color={theme.muted}> • </Text>
          <MCPIndicator mcpStatus={mcpStatus} mcpServerCount={mcpServerCount} theme={theme} />
        </Box>
      </Box>

      {/* Row 3: Mode indicators (compact) */}
      <Box paddingX={1}>
        <ModePill
          label={t.status.autoEdit}
          enabled={autoEditEnabled}
          shortcut="⇧⇥"
          enabledColor={theme.warning}
          flash={flashAutoEdit}
          theme={theme}
          t={t}
        />
        <ModePill
          label={t.status.verbosity}
          value={getVerbosityName(effectiveVerbosityLevel, t)}
          enabled={effectiveVerbosityLevel !== VerbosityLevel.QUIET}
          shortcut="^O"
          enabledColor={theme.warning}
          flash={flashVerbose}
          theme={theme}
          t={t}
        />
        <ModePill
          label={t.status.backgroundMode}
          enabled={backgroundMode}
          shortcut="^B"
          enabledColor={theme.accent}
          flash={flashBackground}
          theme={theme}
          t={t}
        />
        <ModePill
          label={t.status.thinkingMode}
          enabled={thinkingModeEnabled}
          shortcut="Tab"
          enabledColor={theme.primary}
          flash={flashThinkingMode}
          theme={theme}
          t={t}
        />
        {/* Phase 2: Thinking mode indicator - only show when actively thinking */}
        {thinkingModeEnabled && isThinking && (
          <Box marginLeft={1}>
            <Text
              color={flashThinkingMode ? theme.textOnHighlight : theme.primary}
              bold
            >
              🤔 {t.status.thinkingActive}
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
    cliName = 'ax-cli',
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

  // Get theme colors directly - caching is handled by getThemeColors()
  // Don't use useMemo with empty deps as theme can change via /theme command
  const theme = getThemeColors();
  const { ui: t } = useTranslations();

  const effectiveVerbosityLevel = getEffectiveVerbosityLevel(verbosityLevel, verboseMode);
  const allActiveAgents = combineActiveAgents(activeAgent, activeAgents);

  // Use compact layout for narrow terminals (< 100 columns)
  if (terminalWidth < 100) {
    return <CompactStatusBar {...props} theme={theme} t={t} />;
  }

  // Full layout for wide terminals
  return (
    <Box flexDirection="column" marginTop={1}>
      {/* Primary status row */}
      <Box
        borderStyle="single"
        borderColor={isProcessing ? theme.warning : theme.border}
        paddingX={1}
        flexDirection="row"
        justifyContent="space-between"
      >
        {/* Left section: Project & Version */}
        <Box>
          <Text color={theme.accent} bold>
            {projectName}
          </Text>
          <Text color={theme.muted}> • </Text>
          <Text color={theme.info} bold>{cliName}</Text>
          <Text color={theme.success} bold> v{version}</Text>
        </Box>

        {/* Center section: Model + AX + Token count during processing */}
        <Box>
          <Text color={theme.muted}>🤖 </Text>
          <Text color={theme.warning}>{model}</Text>
          {axEnabled && (
            <>
              <Text color={theme.muted}> • </Text>
              <AXIndicator agents={allActiveAgents} theme={theme} />
            </>
          )}
          {isProcessing && tokenCount > 0 && (
            <Text color={theme.primary}> ({formatTokenCount(tokenCount)} tokens)</Text>
          )}
        </Box>

        {/* Right section: Context (available), MCP, Background Tasks */}
        <Box>
          <Text color={theme.muted}>{t.status.contextAvailable}: </Text>
          <ContextBar
            percentage={contextPercentage}
            showAutoPrune={showAutoPrune}
            currentTokens={currentTokens}
            maxTokens={maxTokens}
            theme={theme}
            t={t}
          />
          <Text color={theme.muted}> • </Text>
          <Text color={backgroundTaskCount > 0 ? theme.warning : theme.muted}>{t.status.background}: {backgroundTaskCount}</Text>
          <Text color={theme.muted}> • </Text>
          <MCPIndicator mcpStatus={mcpStatus} mcpServerCount={mcpServerCount} theme={theme} />
        </Box>
      </Box>

      {/* Mode indicators row - always visible for better UX */}
      <Box marginTop={0} paddingX={1}>
        <ModePill
          label={t.status.autoEdit}
          enabled={autoEditEnabled}
          shortcut="⇧⇥"
          enabledColor={theme.warning}
          flash={flashAutoEdit}
          theme={theme}
          t={t}
        />
        <ModePill
          label={t.status.verbosity}
          value={getVerbosityName(effectiveVerbosityLevel, t)}
          enabled={effectiveVerbosityLevel !== VerbosityLevel.QUIET}
          shortcut="^O"
          enabledColor={theme.warning}
          flash={flashVerbose}
          theme={theme}
          t={t}
        />
        <ModePill
          label={t.status.backgroundMode}
          enabled={backgroundMode}
          shortcut="^B"
          enabledColor={theme.accent}
          flash={flashBackground}
          theme={theme}
          t={t}
        />
        <ModePill
          label={t.status.thinkingMode}
          enabled={thinkingModeEnabled}
          shortcut="Tab"
          enabledColor={theme.primary}
          flash={flashThinkingMode}
          theme={theme}
          t={t}
        />
        {/* Phase 2: Thinking mode indicator - only show when actively thinking */}
        {thinkingModeEnabled && isThinking && (
          <Box marginLeft={1}>
            <Text
              color={flashThinkingMode ? theme.textOnHighlight : theme.primary}
              bold
            >
              🤔 {t.status.thinkingActive}
            </Text>
          </Box>
        )}
        {/* Show quick hints only when not processing and not in auto-edit mode */}
        {!isProcessing && !autoEditEnabled && (
          <Box marginLeft={1}>
            <Text color={theme.muted} dimColor>
              • ^K {t.shortcuts.quickActions} • /help {t.shortcuts.commands}
            </Text>
          </Box>
        )}
      </Box>
    </Box>
  );
}

export default StatusBar;
