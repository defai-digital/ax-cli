import React from "react";
import { Box, Text } from "ink";
import { ChatEntry } from "../../agent/llm-agent.js";
import { DiffRenderer } from "./diff-renderer.js";
import { MarkdownRenderer } from "../utils/markdown-renderer.js";
import { ReasoningDisplay } from "./reasoning-display.js";

interface ChatHistoryProps {
  entries: ChatEntry[];
  isConfirmationActive?: boolean;
  verboseMode?: boolean;
}

// Memoized ChatEntry component to prevent unnecessary re-renders
const MemoizedChatEntry = React.memo(
  ({ entry, index, verboseMode = false }: { entry: ChatEntry; index: number; verboseMode?: boolean }) => {
    const renderDiff = (diffContent: string, filename?: string) => {
      return (
        <DiffRenderer
          diffContent={diffContent}
          filename={filename}
          terminalWidth={80}
        />
      );
    };

    const renderFileContent = (content: string) => {
      const lines = content.split("\n");

      // Calculate minimum indentation like DiffRenderer does
      let baseIndentation = Infinity;
      for (const line of lines) {
        if (line.trim() === "") continue;
        const firstCharIndex = line.search(/\S/);
        const currentIndent = firstCharIndex === -1 ? 0 : firstCharIndex;
        baseIndentation = Math.min(baseIndentation, currentIndent);
      }
      if (!isFinite(baseIndentation)) {
        baseIndentation = 0;
      }

      return lines.map((line, index) => {
        const displayContent = line.substring(baseIndentation);
        return (
          <Text key={index} color="gray">
            {displayContent}
          </Text>
        );
      });
    };

    switch (entry.type) {
      case "user":
        return (
          <Box key={index} flexDirection="column" marginTop={1}>
            <Box>
              <Text color="gray">
                {">"} {entry.content}
              </Text>
            </Box>
          </Box>
        );

      case "assistant":
        return (
          <Box key={index} flexDirection="column" marginTop={1}>
            {/* Render reasoning content if present (GLM-4.6 thinking mode) */}
            {entry.reasoningContent && (
              <ReasoningDisplay
                content={entry.reasoningContent}
                visible={true}
                isStreaming={entry.isReasoningStreaming}
              />
            )}
            {/* Render assistant response */}
            <Box flexDirection="row" alignItems="flex-start">
              <Text color="white">⏺ </Text>
              <Box flexDirection="column" flexGrow={1}>
                {entry.toolCalls ? (
                  // If there are tool calls, just show plain text
                  <Text color="white">{entry.content.trim()}</Text>
                ) : (
                  // If no tool calls, render as markdown
                  <MarkdownRenderer content={entry.content.trim()} />
                )}
                {entry.isStreaming && <Text color="cyan">█</Text>}
                {/* Show response duration if available */}
                {!entry.isStreaming && entry.durationMs && (
                  <Text color="gray" dimColor>
                    ⏱ {entry.durationMs >= 1000
                      ? `${(entry.durationMs / 1000).toFixed(1)}s`
                      : `${entry.durationMs}ms`}
                  </Text>
                )}
              </Box>
            </Box>
          </Box>
        );

      case "tool_call":
      case "tool_result":
        const getToolActionName = (toolName: string) => {
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
            case "bash_output":
              return "TaskOutput";
            case "search":
              return "Search";
            case "create_todo_list":
              return "Todo";
            case "update_todo_list":
              return "Todo";
            default:
              return toolName;
          }
        };

        const toolName = entry.toolCall?.function?.name || "unknown";
        const actionName = getToolActionName(toolName);

        const getFilePath = (toolCall: any) => {
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
        };

        // Get full tool arguments for verbose mode
        const getToolArguments = (toolCall: any): string => {
          if (toolCall?.function?.arguments) {
            try {
              const args = JSON.parse(toolCall.function.arguments);
              return JSON.stringify(args, null, 2);
            } catch {
              return toolCall.function.arguments || "";
            }
          }
          return "";
        };

        // Get a brief summary of the result for concise mode
        const getBriefSummary = (content: string, toolName: string): string => {
          if (!content) return "";

          // Count lines for file content
          const lineCount = content.split("\n").length;

          switch (toolName) {
            case "view_file":
              return `${lineCount} lines`;
            case "create_file":
              return `${lineCount} lines written`;
            case "str_replace_editor":
              // Extract just the first line which usually has the summary
              const firstLine = content.split("\n")[0];
              if (firstLine.includes("Updated")) {
                return firstLine.replace(/^Updated\s+/, "").trim();
              }
              return "updated";
            case "bash":
              if (content.includes("Background task started")) {
                return "→ background";
              }
              if (lineCount <= 1) {
                // Short output, show it
                return content.trim().slice(0, 50) + (content.length > 50 ? "..." : "");
              }
              return `${lineCount} lines output`;
            case "search":
              // Try to count matches
              const matches = content.match(/Found \d+ match/);
              if (matches) return matches[0];
              return `${lineCount} lines`;
            default:
              if (lineCount <= 1 && content.length < 60) {
                return content.trim();
              }
              return `${lineCount} lines`;
          }
        };

        const filePath = getFilePath(entry.toolCall);
        const toolArgs = getToolArguments(entry.toolCall);
        const isExecuting = entry.type === "tool_call" || !entry.toolResult;
        const isSuccess = entry.toolResult?.success ?? true;
        const briefSummary = !isExecuting ? getBriefSummary(entry.content, toolName) : "";

        const shouldShowDiff =
          verboseMode &&
          entry.toolCall?.function?.name === "str_replace_editor" &&
          entry.toolResult?.success &&
          entry.content.includes("---") &&
          entry.content.includes("+++");

        const shouldShowFileContent =
          verboseMode &&
          (entry.toolCall?.function?.name === "view_file" ||
            entry.toolCall?.function?.name === "create_file") &&
          entry.toolResult?.success;

        const shouldShowFullOutput =
          verboseMode &&
          !shouldShowDiff &&
          !shouldShowFileContent;

        // CONCISE MODE (default): Single line summary
        if (!verboseMode) {
          return (
            <Box key={index} flexDirection="row" marginTop={0}>
              <Text color="magenta">⏺</Text>
              <Text color="white">
                {" "}
                {filePath ? `${actionName}(${filePath})` : actionName}
              </Text>
              {isExecuting ? (
                <Text color="cyan"> ...</Text>
              ) : (
                <>
                  <Text color={isSuccess ? "green" : "red"}>
                    {" "}{isSuccess ? "✓" : "✗"}
                  </Text>
                  {briefSummary && (
                    <Text color="gray" dimColor> {briefSummary}</Text>
                  )}
                </>
              )}
            </Box>
          );
        }

        // VERBOSE MODE: Full details
        return (
          <Box key={index} flexDirection="column" marginTop={1}>
            {/* Header line */}
            <Box>
              <Text color="magenta">⏺</Text>
              <Text color="white">
                {" "}
                {filePath ? `${actionName}(${filePath})` : actionName}
              </Text>
              {entry.toolCall?.id && (
                <Text color="gray" dimColor> [{entry.toolCall.id.slice(0, 8)}]</Text>
              )}
              {!isExecuting && (
                <Text color={isSuccess ? "green" : "red"}>
                  {" "}{isSuccess ? "✓" : "✗"}
                </Text>
              )}
            </Box>

            {/* Tool arguments */}
            {toolArgs && (
              <Box marginLeft={2} flexDirection="column">
                <Text color="blue" dimColor>Args: {toolArgs.length > 100 ? toolArgs.slice(0, 100) + "..." : toolArgs}</Text>
              </Box>
            )}

            {/* Output content */}
            <Box marginLeft={2} flexDirection="column">
              {isExecuting ? (
                <Text color="cyan">⎿ Executing...</Text>
              ) : shouldShowFileContent ? (
                <Box flexDirection="column">
                  <Text color="gray">⎿ File contents ({entry.content.split("\n").length} lines):</Text>
                  <Box marginLeft={2} flexDirection="column">
                    {renderFileContent(entry.content)}
                  </Box>
                </Box>
              ) : shouldShowDiff ? (
                <Box flexDirection="column">
                  <Text color="gray">⎿ {entry.content.split("\n")[0]}</Text>
                  <Box marginLeft={2} flexDirection="column">
                    {renderDiff(entry.content, filePath)}
                  </Box>
                </Box>
              ) : shouldShowFullOutput ? (
                <Text color="gray">⎿ {entry.content}</Text>
              ) : null}
            </Box>
          </Box>
        );

      default:
        return null;
    }
  }
);

MemoizedChatEntry.displayName = "MemoizedChatEntry";

export const ChatHistory = React.memo(
  function ChatHistory({
    entries,
    isConfirmationActive = false,
    verboseMode = false,
  }: ChatHistoryProps) {
    // Filter out tool_call entries with "Executing..." when confirmation is active
    const filteredEntries = isConfirmationActive
      ? entries.filter(
          (entry) =>
            !(entry.type === "tool_call" && entry.content === "Executing...")
        )
      : entries;

    // Show ALL entries - removed the .slice(-20) limitation
    // Scrolling will be handled by the terminal's native scroll capability
    return (
      <Box flexDirection="column">
        {filteredEntries.map((entry, index) => {
          // Safely get timestamp - handle both Date objects and serialized strings
          const timestamp = entry.timestamp instanceof Date
            ? entry.timestamp.getTime()
            : new Date(entry.timestamp).getTime() || index;
          return (
            <MemoizedChatEntry
              key={`${timestamp}-${index}`}
              entry={entry}
              index={index}
              verboseMode={verboseMode}
            />
          );
        })}
      </Box>
    );
  },
  (prevProps, nextProps) => {
    // Only re-render if entries array reference changed AND last entry is different
    // This prevents re-renders when unrelated state updates happen
    if (prevProps.entries === nextProps.entries &&
        prevProps.isConfirmationActive === nextProps.isConfirmationActive &&
        prevProps.verboseMode === nextProps.verboseMode) {
      return true; // Props are equal, skip re-render
    }

    // Always re-render if verbose mode changed
    if (prevProps.verboseMode !== nextProps.verboseMode) {
      return false;
    }

    // If array length is same and last entry is identical, skip re-render
    // (handles case where array is recreated but content is same)
    const prevLast = prevProps.entries[prevProps.entries.length - 1];
    const nextLast = nextProps.entries[nextProps.entries.length - 1];

    return (
      prevProps.entries.length === nextProps.entries.length &&
      prevLast === nextLast &&
      prevProps.isConfirmationActive === nextProps.isConfirmationActive
    );
  }
);
