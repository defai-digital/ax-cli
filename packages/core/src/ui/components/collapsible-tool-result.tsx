/**
 * Collapsible Tool Result Component
 * Shows tool results with expand/collapse capability
 */

import React from "react";
import { Box, Text } from "ink";
import { DiffRenderer } from "./diff-renderer.js";
import { parseMCPIdentifier } from "../../mcp/index.js";
import { formatDuration } from "../utils/tool-grouper.js";

interface CollapsibleToolResultProps {
  toolName: string;
  filePath: string;
  content: string;
  isSuccess: boolean;
  isExpanded: boolean;
  isExecuting: boolean;
  toolArgs?: string;
  toolId?: string;
  verboseMode?: boolean;
  /** Execution duration in milliseconds (shown after completion) */
  executionDurationMs?: number;
  /** Execution start time (for elapsed time while running) */
  executionStartTime?: Date;
}

/**
 * Check if a tool is an MCP tool
 */
export function isMCPTool(toolName: string): boolean {
  return toolName.startsWith("mcp__");
}

/**
 * Parse MCP tool name into server and tool components
 * Uses shared parseMCPIdentifier for consistency with other MCP parsing
 */
export function parseMCPToolName(toolName: string): { serverName: string; toolName: string } | null {
  const parsed = parseMCPIdentifier(toolName, "mcp__");
  if (!parsed) return null;
  return { serverName: parsed.serverName, toolName: parsed.name };
}

/** Tool name to display name mapping (canonical source for all tool display names) */
const TOOL_DISPLAY_NAMES: Record<string, string> = {
  view_file: "Read",
  read_file: "Read",
  str_replace_editor: "Update",
  multi_edit: "MultiEdit",
  create_file: "Create",
  bash: "Bash",
  execute_bash: "Bash",
  bash_output: "TaskOutput",
  search: "Search",
  create_todo_list: "Todo",
  update_todo_list: "Todo",
};

/**
 * Get a human-readable action name for a tool
 */
export function getToolActionName(toolName: string): string {
  // Handle MCP tools with mcp__servername__toolname format
  if (toolName.startsWith("mcp__")) {
    const parsed = parseMCPToolName(toolName);
    if (parsed) {
      // Capitalize server name for display
      const displayServer = parsed.serverName.charAt(0).toUpperCase() + parsed.serverName.slice(1);
      return `${displayServer}(${parsed.toolName.replace(/_/g, " ")})`;
    }
  }

  return TOOL_DISPLAY_NAMES[toolName] ?? toolName.replace(/_/g, " ");
}

/**
 * Get file path from tool call arguments
 */
export function getFilePath(toolCall: any): string {
  if (toolCall?.function?.arguments) {
    try {
      const args = JSON.parse(toolCall.function.arguments);
      if (toolCall.function.name === "search") {
        // Trim query to avoid whitespace-only display
        return (args.query || '').trim();
      }
      // Handle multi_edit which may have files array instead of single path
      if (toolCall.function.name === "multi_edit" && Array.isArray(args.files)) {
        const fileCount = args.files.length;
        return fileCount > 0 ? `${fileCount} file${fileCount > 1 ? 's' : ''}` : '';
      }
      return args.path || args.file_path || args.command || "";
    } catch {
      return "";
    }
  }
  return "";
}

/**
 * Summarize tool result for collapsed view
 */
function summarizeResult(content: string, toolName: string): string {
  if (!content) return "Completed";

  // Split once, reuse throughout (performance optimization)
  const lines = content.split("\n");
  const firstLine = lines[0] || "";

  // For diffs, extract summary
  if (content.includes("Updated") && content.includes("---")) {
    return firstLine;
  }

  // For file reads, show line count
  if (toolName === "view_file" || toolName === "create_file") {
    return `${lines.length} lines`;
  }

  // For bash, show truncated output
  if (toolName === "bash") {
    if (firstLine.length > 60) {
      return firstLine.substring(0, 60) + "...";
    }
    return firstLine || "Completed";
  }

  // For search, show match count if available
  if (toolName === "search") {
    const matches = content.match(/Found (\d+)/);
    if (matches) {
      return `Found ${matches[1]} results`;
    }
  }

  // Default: truncate to first line
  if (firstLine.length > 80) {
    return firstLine.substring(0, 80) + "...";
  }
  return firstLine || "Completed";
}

/**
 * Format content for expanded view
 */
function formatExpandedContent(content: string, toolName: string): string {
  if (toolName.startsWith("mcp__")) {
    try {
      const parsed = JSON.parse(content);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return content;
    }
  }
  return content;
}

export function CollapsibleToolResult({
  toolName,
  filePath,
  content,
  isSuccess,
  isExpanded,
  isExecuting,
  toolArgs,
  toolId,
  verboseMode = false,
  executionDurationMs,
  executionStartTime,
}: CollapsibleToolResultProps) {
  const actionName = getToolActionName(toolName);
  const summary = summarizeResult(content, toolName);
  const isMcp = isMCPTool(toolName);

  // Auto-verbose for errors: always show full details when a tool fails
  const effectiveVerbose = verboseMode || (!isExecuting && !isSuccess);
  const effectiveExpanded = isExpanded || effectiveVerbose;

  const shouldShowDiff =
    toolName === "str_replace_editor" &&
    isSuccess &&
    content.includes("Updated") &&
    content.includes("---") &&
    content.includes("+++");

  const shouldShowFileContent =
    (toolName === "view_file" || toolName === "create_file") &&
    isSuccess &&
    !shouldShowDiff;

  // Memoize content lines split (performance optimization - avoids repeated split)
  const contentLines = React.useMemo(() => content.split("\n"), [content]);

  // Calculate elapsed time for executing tools
  const [elapsedMs, setElapsedMs] = React.useState(0);

  React.useEffect(() => {
    if (isExecuting && executionStartTime) {
      const interval = setInterval(() => {
        setElapsedMs(Date.now() - executionStartTime.getTime());
      }, 100);
      return () => clearInterval(interval);
    }
    return undefined;
  }, [isExecuting, executionStartTime]);

  return (
    <Box flexDirection="column" marginTop={1}>
      {/* Header row */}
      <Box>
        <Text color="magenta">⏺</Text>
        <Text color={isMcp ? "cyan" : "yellow"} bold>
          {" "}
          {actionName}
        </Text>
        <Text color="gray">
          {filePath ? `(${filePath})` : ""}
        </Text>
        {/* Show execution duration in yellow after completion (like Claude Code) */}
        {!isExecuting && executionDurationMs !== undefined && (
          <Text color="yellow"> {formatDuration(executionDurationMs)}</Text>
        )}
        {/* Show elapsed time in gray while executing (like Claude Code's timeout display) */}
        {isExecuting && executionStartTime && (
          <Text color="gray" dimColor> timeout: {formatDuration(elapsedMs)}</Text>
        )}
        {!isExecuting && (
          <Text color="gray" dimColor>
            {" "}
            {effectiveExpanded ? "[▼]" : "[▶]"}
          </Text>
        )}
        {effectiveVerbose && toolId && (
          <Text color="gray" dimColor>
            {" "}
            [{toolId.slice(0, 8)}]
          </Text>
        )}
      </Box>

      {/* Verbose mode: show arguments (also shown on errors for debugging) */}
      {effectiveVerbose && toolArgs && (
        <Box marginLeft={2} flexDirection="column">
          <Text color="blue" dimColor>
            Arguments:
          </Text>
          <Box marginLeft={2}>
            <Text color="gray" dimColor>
              {toolArgs}
            </Text>
          </Box>
        </Box>
      )}

      {/* Content area */}
      <Box marginLeft={2} flexDirection="column">
        {isExecuting ? (
          <Text color="cyan">⎿ Executing...</Text>
        ) : effectiveExpanded ? (
          // Expanded view (includes auto-expand on errors)
          <>
            {shouldShowDiff ? (
              <>
                <Text color="gray">⎿ {summary}</Text>
                <Box marginLeft={2} flexDirection="column">
                  <DiffRenderer
                    diffContent={content}
                    filename={filePath}
                    terminalWidth={80}
                  />
                </Box>
              </>
            ) : shouldShowFileContent ? (
              <>
                <Text color="gray">⎿ File contents ({summary}):</Text>
                <Box
                  marginLeft={2}
                  flexDirection="column"
                  borderStyle="single"
                  borderColor="gray"
                  paddingX={1}
                >
                  {contentLines.slice(0, 20).map((line, i) => (
                    <Text key={i} color="gray">
                      {line}
                    </Text>
                  ))}
                  {contentLines.length > 20 && (
                    <Text color="gray" dimColor>
                      ... {contentLines.length - 20} more lines
                    </Text>
                  )}
                </Box>
              </>
            ) : (
              <Text color="gray">
                ⎿ {formatExpandedContent(content, toolName)}
              </Text>
            )}
          </>
        ) : (
          // Collapsed view
          <Box>
            <Text color={isSuccess ? "green" : "red"}>
              {isSuccess ? "✓" : "✗"}
            </Text>
            <Text color="gray"> {summary}</Text>
          </Box>
        )}
      </Box>

      {/* Verbose mode: status */}
      {effectiveVerbose && !isExecuting && (
        <Box marginLeft={2}>
          <Text color={isSuccess ? "green" : "red"}>
            Status: {isSuccess ? "✓ Success" : "✗ Failed"}
          </Text>
        </Box>
      )}
    </Box>
  );
}

export default CollapsibleToolResult;
