import React, { useMemo, useRef, useState, useEffect } from "react";
import { Box, Text } from "ink";
import { ChatEntry } from "../../agent/llm-agent.js";
import { DiffRenderer } from "./diff-renderer.js";
import { MarkdownRenderer } from "../utils/markdown-renderer.js";
import { ReasoningDisplay } from "./reasoning-display.js";
import { ToolGroupDisplay } from "./tool-group-display.js";
import { groupConsecutiveTools, isToolGroup, type GroupedEntry } from "../utils/tool-grouper.js";
import { getBriefToolSummary } from "../utils/change-summarizer.js";
import { VerbosityLevel, UI_CONFIG } from "../../constants.js";

/**
 * Debounce delay for grouping consecutive tool operations (ms)
 * This allows multiple rapid tool calls to be grouped before rendering
 */
const GROUP_DEBOUNCE_DELAY = UI_CONFIG.GROUP_TIME_WINDOW || 300;

interface ChatHistoryProps {
  entries: ChatEntry[];
  isConfirmationActive?: boolean;
  verboseMode?: boolean;  // DEPRECATED: Use verbosityLevel instead
  verbosityLevel?: VerbosityLevel;
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
      // BUG FIX: Handle empty/whitespace-only content early
      if (!content || !content.trim()) {
        return <Text color="gray" dimColor>(empty file)</Text>;
      }

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

      // BUG FIX: Wrap lines in Box with flexDirection="column" to ensure vertical layout
      return (
        <Box flexDirection="column">
          {lines.map((line, lineIdx) => {
            const displayContent = line.substring(baseIndentation);
            return (
              <Text key={`line-${lineIdx}`} color="gray">
                {displayContent}
              </Text>
            );
          })}
        </Box>
      );
    };

    switch (entry.type) {
      case "user":
        return (
          <Box key={index} flexDirection="column" marginTop={1}>
            {/* Add subtle separator before user messages for better visual hierarchy */}
            {index > 0 && (
              <Box borderStyle="single" borderColor="gray" borderTop={false} borderLeft={false} borderRight={false} marginBottom={1} />
            )}
            <Box>
              <Text color="gray">
                {/* BUG FIX: Trim content like assistant messages do */}
                {">"} {entry.content?.trim() ?? ""}
              </Text>
            </Box>
          </Box>
        );

      case "assistant":
        return (
          <Box key={index} flexDirection="column" marginTop={1}>
            {/* Render reasoning content if present (GLM-4.6 thinking mode) */}
            {/* BUG FIX: Check for non-empty trimmed content to avoid unnecessary component instantiation */}
            {entry.reasoningContent?.trim() && (
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
                  <Text color="white">{entry.content?.trim() ?? ""}</Text>
                ) : (
                  // If no tool calls, render as markdown
                  <MarkdownRenderer content={entry.content?.trim() ?? ""} />
                )}
                {entry.isStreaming && <Text color="cyan">█</Text>}
                {/* Show response duration if available */}
                {/* BUG FIX: Use !== undefined instead of truthy check - 0ms is valid but falsy */}
                {!entry.isStreaming && entry.durationMs !== undefined && (
                  <Text color="gray">
                    {/* BUG FIX: Round to integer for consistent display */}
                    ⏱ {entry.durationMs >= 1000
                      ? `${(entry.durationMs / 1000).toFixed(1)}s`
                      : `${Math.round(entry.durationMs)}ms`}
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
              // BUG FIX: Handle empty serverName gracefully
              const displayServer = serverName.length > 0
                ? serverName.charAt(0).toUpperCase() + serverName.slice(1)
                : "MCP";
              return `${displayServer}(${actualToolName.replace(/_/g, " ")})`;
            }
          }

          switch (toolName) {
            case "view_file":
            case "read_file":  // BUG FIX: Handle read_file tool
              return "Read";
            case "str_replace_editor":
              return "Update";
            case "multi_edit":  // BUG FIX: Added multi_edit tool display name
              return "MultiEdit";
            case "create_file":
              return "Create";
            case "bash":
            case "execute_bash":  // BUG FIX: Handle execute_bash same as bash
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
                // BUG FIX: Trim query to avoid whitespace-only display
                return (args.query || '').trim();
              }
              // BUG FIX: Handle multi_edit which may have files array instead of single path
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

        // Use imported brief summary function
        const getBriefSummary = getBriefToolSummary;

        const filePath = getFilePath(entry.toolCall);
        const toolArgs = getToolArguments(entry.toolCall);
        const isExecuting = entry.type === "tool_call" || !entry.toolResult;
        const isSuccess = entry.toolResult?.success ?? true;
        const briefSummary = !isExecuting ? getBriefSummary(entry.content ?? "", toolName) : "";

        // Auto-verbose for errors: always show full details when a tool fails
        // This helps users debug without needing to toggle verbose mode
        const effectiveVerbose = verboseMode || (!isExecuting && !isSuccess);

        const shouldShowDiff =
          effectiveVerbose &&
          entry.toolCall?.function?.name === "str_replace_editor" &&
          entry.toolResult?.success &&
          entry.content?.includes("---") &&
          entry.content?.includes("+++");

        const shouldShowFileContent =
          effectiveVerbose &&
          (entry.toolCall?.function?.name === "view_file" ||
            entry.toolCall?.function?.name === "read_file" ||  // BUG FIX: Handle read_file
            entry.toolCall?.function?.name === "create_file") &&
          entry.toolResult?.success;

        const shouldShowFullOutput =
          effectiveVerbose &&
          !shouldShowDiff &&
          !shouldShowFileContent;

        // Format execution duration like Claude Code
        const formatDuration = (ms: number): string => {
          // BUG FIX: Round to integer to avoid "123.456ms" display
          const roundedMs = Math.round(ms);
          if (roundedMs < 1000) return `${roundedMs}ms`;
          if (roundedMs < 60000) return `${(roundedMs / 1000).toFixed(1)}s`;
          const mins = Math.floor(roundedMs / 60000);
          const secs = Math.floor((roundedMs % 60000) / 1000);
          return `${mins}m ${secs}s`;
        };

        // CONCISE MODE (default): Single line summary with visual hierarchy
        // Note: effectiveVerbose includes auto-verbose for errors
        if (!effectiveVerbose) {
          // Add visual hierarchy with subtle indentation for better scannability
          const isEven = index % 2 === 0;

          return (
            <Box key={index} flexDirection="row" marginTop={0} paddingLeft={isEven ? 0 : 1}>
              <Text color="magenta">⏺</Text>
              <Text color="yellow" bold>
                {" "}
                {actionName}
              </Text>
              <Text color="gray">
                {filePath ? ` (${filePath})` : ""}
              </Text>
              {isExecuting ? (
                <Text color="cyan"> ...</Text>
              ) : (
                <>
                  {/* Show execution duration in yellow like Claude Code */}
                  {entry.executionDurationMs !== undefined && (
                    <Text color="yellow"> {formatDuration(entry.executionDurationMs)}</Text>
                  )}
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
              <Text color="yellow" bold>
                {" "}
                {actionName}
              </Text>
              <Text color="gray">
                {/* BUG FIX: Add space before parenthesis like concise mode */}
                {filePath ? ` (${filePath})` : ""}
              </Text>
              {/* Show execution duration in yellow like Claude Code */}
              {!isExecuting && entry.executionDurationMs !== undefined && (
                <Text color="yellow"> {formatDuration(entry.executionDurationMs)}</Text>
              )}
              {/* BUG FIX: Check for non-empty id before displaying */}
              {entry.toolCall?.id && entry.toolCall.id.length > 0 && (
                <Text color="gray"> [{entry.toolCall.id.slice(0, 8)}]</Text>
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
                {/* BUG FIX: Replace newlines with spaces for single-line display */}
                <Text color="blue">Args: {toolArgs.length > 100 ? toolArgs.replace(/\n/g, ' ').slice(0, 100) + "..." : toolArgs.replace(/\n/g, ' ')}</Text>
              </Box>
            )}

            {/* Output content */}
            <Box marginLeft={2} flexDirection="column">
              {isExecuting ? (
                <Text color="cyan">⎿ Executing...</Text>
              ) : shouldShowFileContent ? (
                <Box flexDirection="column">
                  {/* BUG FIX: Handle empty content - split("") returns [""] with length 1 */}
                  <Text color="gray">⎿ File contents ({(entry.content ?? "").trim() ? (entry.content ?? "").split("\n").length : 0} lines):</Text>
                  <Box marginLeft={2} flexDirection="column">
                    {renderFileContent(entry.content ?? "")}
                  </Box>
                </Box>
              ) : shouldShowDiff ? (
                <Box flexDirection="column">
                  {/* BUG FIX: Find first non-empty line for display */}
                  <Text color="gray">⎿ {(entry.content ?? "").split("\n").find(line => line.trim()) || "diff"}</Text>
                  <Box marginLeft={2} flexDirection="column">
                    {renderDiff(entry.content ?? "", filePath)}
                  </Box>
                </Box>
              ) : shouldShowFullOutput ? (
                // BUG FIX: Trim content to avoid leading/trailing whitespace in display
                <Text color="gray">⎿ {(entry.content ?? "").trim()}</Text>
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
    verbosityLevel,
  }: ChatHistoryProps) {
    // Backward compatibility: convert verboseMode boolean to verbosityLevel
    const effectiveVerbosityLevel = verbosityLevel !== undefined
      ? verbosityLevel
      : (verboseMode ? VerbosityLevel.VERBOSE : VerbosityLevel.QUIET);

    // Filter out tool_call entries with "Executing..." when confirmation is active
    const filteredEntries = isConfirmationActive
      ? entries.filter(
          (entry) =>
            !(entry.type === "tool_call" && entry.content === "Executing...")
        )
      : entries;

    // Debounced grouping state
    // This allows consecutive tool operations to be collected before grouping
    // BUG FIX: Initialize with empty array to avoid stale initial state
    // The useEffect will immediately populate with correct entries
    const [debouncedEntries, setDebouncedEntries] = useState<ChatEntry[]>([]);
    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
    const lastEntriesLengthRef = useRef(0);
    const lastEntryRef = useRef<ChatEntry | null>(null);
    const isFirstRenderRef = useRef(true);

    // Debounce entry updates for better grouping
    // Note: We use specific primitive dependencies to avoid infinite loops
    // since filteredEntries is a new array reference on every render
    const filteredEntriesLength = filteredEntries.length;
    const lastFilteredEntry = filteredEntriesLength > 0 ? filteredEntries[filteredEntriesLength - 1] : null;

    // Use a ref to capture current filteredEntries without adding to dependencies
    const filteredEntriesRef = useRef(filteredEntries);
    filteredEntriesRef.current = filteredEntries;

    // Track previous verbosity level to detect changes
    const prevVerbosityRef = useRef(effectiveVerbosityLevel);

    useEffect(() => {
      // BUG FIX: On first render, immediately set entries without debouncing
      // This ensures we don't show empty state on initial load
      if (isFirstRenderRef.current) {
        isFirstRenderRef.current = false;
        lastEntriesLengthRef.current = filteredEntriesLength;
        lastEntryRef.current = lastFilteredEntry;
        prevVerbosityRef.current = effectiveVerbosityLevel;
        setDebouncedEntries(filteredEntriesRef.current);
        return;
      }

      // Check if entries have actually changed (not just array reference)
      const entriesGrew = filteredEntriesLength > lastEntriesLengthRef.current;
      const lastEntryChanged = lastFilteredEntry !== lastEntryRef.current;
      // BUG FIX: Detect verbosity level changes to flush immediately
      const verbosityChanged = effectiveVerbosityLevel !== prevVerbosityRef.current;
      // BUG FIX: Also detect when entries shrink (e.g., chat cleared)
      const entriesShrunk = filteredEntriesLength < lastEntriesLengthRef.current;

      // Update refs for next comparison
      lastEntriesLengthRef.current = filteredEntriesLength;
      lastEntryRef.current = lastFilteredEntry;
      prevVerbosityRef.current = effectiveVerbosityLevel;

      // BUG FIX: If verbosity changed or entries shrunk, immediately flush
      // This ensures users see current data when switching modes or clearing chat
      if (verbosityChanged || entriesShrunk) {
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
          debounceTimerRef.current = null;
        }
        setDebouncedEntries(filteredEntriesRef.current);
        return;
      }

      // Skip if nothing actually changed
      if (!entriesGrew && !lastEntryChanged) {
        return;
      }

      // Check if last entry is a tool operation (could be grouped)
      const isToolOperation = lastFilteredEntry && (lastFilteredEntry.type === 'tool_call' || lastFilteredEntry.type === 'tool_result');

      // If entries grew and last entry is tool operation, debounce to allow more to come in
      if (entriesGrew && isToolOperation && effectiveVerbosityLevel === VerbosityLevel.QUIET) {
        // Clear existing timer
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }

        // Set new debounced update
        debounceTimerRef.current = setTimeout(() => {
          setDebouncedEntries(filteredEntriesRef.current);
          debounceTimerRef.current = null;
        }, GROUP_DEBOUNCE_DELAY);
      } else {
        // No debouncing needed - update immediately
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
          debounceTimerRef.current = null;
        }
        setDebouncedEntries(filteredEntriesRef.current);
      }
    }, [filteredEntriesLength, lastFilteredEntry, effectiveVerbosityLevel]);

    // BUG FIX: Separate cleanup effect for unmount to avoid stale timer issues
    useEffect(() => {
      return () => {
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }
      };
    }, []);

    // Group entries based on verbosity level
    const groupedEntries: GroupedEntry[] = useMemo(() => {
      if (effectiveVerbosityLevel === VerbosityLevel.QUIET) {
        return groupConsecutiveTools(debouncedEntries);
      }
      return debouncedEntries;
    }, [debouncedEntries, effectiveVerbosityLevel]);

    // Render grouped or individual entries
    return (
      <Box flexDirection="column">
        {groupedEntries.map((entry, index) => {
          // Handle grouped entries
          if (isToolGroup(entry)) {
            // Safely handle startTime - could be Invalid Date
            const groupTime = entry.startTime.getTime();
            const groupKey = Number.isNaN(groupTime)
              ? `group-fallback-${index}`
              : `group-${groupTime}-${index}`;

            return (
              <ToolGroupDisplay
                key={groupKey}
                group={entry}
                index={index}
              />
            );
          }

          // Handle individual entries
          // Safely get timestamp - handle both Date objects and serialized strings
          const rawTimestamp = entry.timestamp instanceof Date
            ? entry.timestamp.getTime()
            : new Date(entry.timestamp).getTime();
          const timestamp = Number.isNaN(rawTimestamp) ? `fallback-${index}` : rawTimestamp;

          // Determine effective verbose mode for this entry
          // QUIET: show minimal (like concise but even less)
          // CONCISE: show one line per tool
          // VERBOSE: show full details
          const entryVerboseMode = effectiveVerbosityLevel === VerbosityLevel.VERBOSE;

          return (
            <MemoizedChatEntry
              key={`${timestamp}-${index}`}
              entry={entry}
              index={index}
              verboseMode={entryVerboseMode}
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
        prevProps.verboseMode === nextProps.verboseMode &&
        prevProps.verbosityLevel === nextProps.verbosityLevel) {
      return true; // Props are equal, skip re-render
    }

    // Always re-render if verbose mode or verbosity level changed
    if (prevProps.verboseMode !== nextProps.verboseMode || prevProps.verbosityLevel !== nextProps.verbosityLevel) {
      return false;
    }

    // If array length is same and last entry is identical, skip re-render
    // (handles case where array is recreated but content is same)
    // Add bounds check to prevent undefined access on empty arrays
    const prevLast = prevProps.entries.length > 0
      ? prevProps.entries[prevProps.entries.length - 1]
      : null;
    const nextLast = nextProps.entries.length > 0
      ? nextProps.entries[nextProps.entries.length - 1]
      : null;

    return (
      prevProps.entries.length === nextProps.entries.length &&
      prevLast === nextLast &&
      prevProps.isConfirmationActive === nextProps.isConfirmationActive
    );
  }
);
