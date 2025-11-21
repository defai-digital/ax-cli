/**
 * Collapsible Tool Result Component
 * Shows tool results with expand/collapse capability
 */

import React from "react";
import { Box, Text } from "ink";
import { DiffRenderer } from "./diff-renderer.js";

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
}

/**
 * Get a human-readable action name for a tool
 */
export function getToolActionName(toolName: string): string {
  // Handle MCP tools with mcp__servername__toolname format
  if (toolName.startsWith("mcp__")) {
    const parts = toolName.split("__");
    if (parts.length >= 3) {
      const serverName = parts[1];
      const actualToolName = parts.slice(2).join("__");
      return `${serverName.charAt(0).toUpperCase() + serverName.slice(1)}(${actualToolName.replace(/_/g, " ")})`;
    }
  }

  switch (toolName) {
    case "view_file":
      return "Read";
    case "str_replace_editor":
      return "Update";
    case "create_file":
      return "Create";
    case "bash":
      return "Bash";
    case "search":
      return "Search";
    case "create_todo_list":
      return "Todo";
    case "update_todo_list":
      return "Todo";
    default:
      return toolName.replace(/_/g, " ");
  }
}

/**
 * Get file path from tool call arguments
 */
export function getFilePath(toolCall: any): string {
  if (toolCall?.function?.arguments) {
    try {
      const args = JSON.parse(toolCall.function.arguments);
      if (toolCall.function.name === "search") {
        return args.query;
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

  // For diffs, extract summary
  if (content.includes("Updated") && content.includes("---")) {
    const firstLine = content.split("\n")[0];
    return firstLine;
  }

  // For file reads, show line count
  if (toolName === "view_file" || toolName === "create_file") {
    const lines = content.split("\n").length;
    return `${lines} lines`;
  }

  // For bash, show truncated output
  if (toolName === "bash") {
    const firstLine = content.split("\n")[0];
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
  const firstLine = content.split("\n")[0];
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
}: CollapsibleToolResultProps) {
  const actionName = getToolActionName(toolName);
  const summary = summarizeResult(content, toolName);

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

  return (
    <Box flexDirection="column" marginTop={1}>
      {/* Header row */}
      <Box>
        <Text color="magenta">⏺</Text>
        <Text color="white">
          {" "}
          {filePath ? `${actionName}(${filePath})` : actionName}
        </Text>
        {!isExecuting && (
          <Text color="gray" dimColor>
            {" "}
            {isExpanded ? "[▼]" : "[▶]"}
          </Text>
        )}
        {verboseMode && toolId && (
          <Text color="gray" dimColor>
            {" "}
            [{toolId.slice(0, 8)}]
          </Text>
        )}
      </Box>

      {/* Verbose mode: show arguments */}
      {verboseMode && toolArgs && (
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
        ) : isExpanded ? (
          // Expanded view
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
                  {content.split("\n").slice(0, 20).map((line, i) => (
                    <Text key={i} color="gray">
                      {line}
                    </Text>
                  ))}
                  {content.split("\n").length > 20 && (
                    <Text color="gray" dimColor>
                      ... {content.split("\n").length - 20} more lines
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
      {verboseMode && !isExecuting && (
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
