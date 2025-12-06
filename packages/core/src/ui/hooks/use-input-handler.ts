import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useInput } from "ink";
import { LLMAgent, ChatEntry } from "../../agent/llm-agent.js";
import { ConfirmationService } from "../../utils/confirmation-service.js";
import { useEnhancedInput, Key } from "./use-enhanced-input.js";
import { escapeShellArg } from "../../tools/bash.js";
import { VerbosityLevel, TIMEOUT_CONFIG } from "../../constants.js";

import { filterCommandSuggestions } from "../components/command-suggestions.js";
import { getSettingsManager } from "../../utils/settings-manager.js";
import { ProjectAnalyzer } from "../../utils/project-analyzer.js";
import { InstructionGenerator } from "../../utils/instruction-generator.js";
import { getUsageTracker } from "../../utils/usage-tracker.js";
import { getHistoryManager } from "../../utils/history-manager.js";
import { handleRewindCommand, handleCheckpointsCommand, handleCheckpointCleanCommand } from "../../commands/rewind.js";
import {
  handlePlansCommand,
  handlePlanCommand,
  handlePhasesCommand,
  handlePauseCommand,
  handleResumeCommand,
  handleSkipPhaseCommand,
  handleAbandonCommand,
  handleResumableCommand,
} from "../../commands/plan.js";
import { BashOutputTool } from "../../tools/bash-output.js";
import { getKeyboardShortcutGuideText } from "../components/keyboard-hints.js";
import { clearToolGroupCache } from "../utils/tool-grouper.js";
import {
  getContextStore,
  ContextGenerator,
  getStatsCollector,
} from "../../memory/index.js";
import { openExternalEditor, getPreferredEditor, getEditorDisplayName } from "../../utils/external-editor.js";
import { extractErrorMessage } from "../../utils/error-handler.js";
import { getCustomCommandsManager, type CustomCommand } from "../../commands/custom-commands.js";
import { getHooksManager } from "../../hooks/index.js";
import { getMCPPrompts, getMCPManager, getMCPResources } from "../../llm/tools.js";
import { promptToSlashCommand, parsePromptCommand, formatPromptResult, getPromptDescription } from "../../mcp/prompts.js";
import type { MCPResource } from "../../mcp/resources.js";
import { getPermissionManager, PermissionTier } from "../../permissions/permission-manager.js";
import { parseFileMentions } from "../../utils/file-mentions.js";
import { parseImageInput, formatAttachmentForDisplay, buildMessageContent } from "../utils/image-handler.js";
import { routeToAgent } from "../../agent/agent-router.js";
import { executeAgent } from "../../agent/agent-executor.js";
import * as fs from "fs";
import * as path from "path";

interface UseInputHandlerProps {
  agent: LLMAgent;
  chatHistory: ChatEntry[];
  setChatHistory: React.Dispatch<React.SetStateAction<ChatEntry[]>>;
  setIsProcessing: (processing: boolean) => void;
  setIsStreaming: (streaming: boolean) => void;
  setTokenCount: (count: number) => void;
  setProcessingTime: (time: number) => void;
  processingStartTime: React.MutableRefObject<number>;
  isProcessing: boolean;
  isStreaming: boolean;
  isConfirmationActive?: boolean;
  onQuickActionsToggle?: () => void;
  // Callbacks for mode toggle events (for toast/flash UI feedback)
  onVerboseModeChange?: (enabled: boolean) => void;
  onBackgroundModeChange?: (enabled: boolean) => void;
  onAutoEditModeChange?: (enabled: boolean) => void;
  onTaskMovedToBackground?: (taskId: string) => void;
  onOperationInterrupted?: () => void;
  onChatCleared?: () => void;
  onCopyLastResponse?: () => void;
  // Callbacks for memory operations
  onMemoryWarmed?: (tokens: number) => void;
  onMemoryRefreshed?: () => void;
  // Callbacks for checkpoint operations
  onCheckpointCreated?: () => void;
  onCheckpointRestored?: () => void;
  onLargePaste?: (charCount: number) => void;
  onPasteTruncated?: (originalLength: number, truncatedLength: number) => void;
  onKeyboardHelp?: () => void;
  onMcpDashboardToggle?: () => void;
  onThinkingModeChange?: (enabled: boolean) => void;
  onEditorOpening?: (editorName: string) => void;
  onEditorSuccess?: () => void;
  onEditorCancelled?: () => void;
  onEditorError?: (error: string) => void;
  // Agent-First Mode props
  agentFirstDisabled?: boolean;
  forcedAgent?: string;
  onAgentSelected?: (agent: string | null) => void;
}

interface CommandSuggestion {
  command: string;
  description: string;
}

interface ModelOption {
  model: string;
}

export function useInputHandler({
  agent,
  chatHistory,
  setChatHistory,
  setIsProcessing,
  setIsStreaming,
  setTokenCount,
  setProcessingTime,
  processingStartTime,
  isProcessing,
  isStreaming,
  isConfirmationActive = false,
  onQuickActionsToggle,
  onVerboseModeChange,
  onBackgroundModeChange,
  onAutoEditModeChange,
  onTaskMovedToBackground,
  onOperationInterrupted,
  onChatCleared,
  onCopyLastResponse,
  onMemoryWarmed,
  onMemoryRefreshed,
  onCheckpointCreated: _onCheckpointCreated, // Reserved for future checkpoint UI
  onCheckpointRestored: _onCheckpointRestored, // Reserved for future checkpoint UI
  onLargePaste,
  onPasteTruncated,
  onKeyboardHelp,
  onMcpDashboardToggle,
  onThinkingModeChange,
  onEditorOpening,
  onEditorSuccess,
  onEditorCancelled,
  onEditorError,
  agentFirstDisabled = false,
  forcedAgent,
  onAgentSelected,
}: UseInputHandlerProps) {
  const [showCommandSuggestions, setShowCommandSuggestions] = useState(false);
  const [selectedCommandIndex, setSelectedCommandIndex] = useState(0);
  const [resourceSuggestions, setResourceSuggestions] = useState<MCPResource[]>([]);
  const [suggestionMode, setSuggestionMode] = useState<"command" | "resource">("command");
  // BUG FIX: Track current MCP query to prevent race condition with stale async results
  const currentMcpQueryRef = useRef<string | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [autoEditEnabled, setAutoEditEnabled] = useState(() => {
    const confirmationService = ConfirmationService.getInstance();
    const sessionFlags = confirmationService.getSessionFlags();
    // Default to true (auto-edit enabled by default)
    return sessionFlags.allOperations !== undefined ? sessionFlags.allOperations : true;
  });
  const [verboseMode, setVerboseMode] = useState(false);  // Legacy boolean for backward compat
  const [verbosityLevel, setVerbosityLevel] = useState<VerbosityLevel>(VerbosityLevel.QUIET);
  const [backgroundMode, setBackgroundMode] = useState(false);
  const [thinkingModeEnabled, setThinkingModeEnabled] = useState(true);

  const toggleAutoEditMode = useCallback(() => {
    const newAutoEditState = !autoEditEnabled;
    setAutoEditEnabled(newAutoEditState);

    const confirmationService = ConfirmationService.getInstance();
    if (newAutoEditState) {
      // Enable auto-edit: set all operations to be accepted
      confirmationService.setSessionFlag("allOperations", true);
    } else {
      // Disable auto-edit: reset session flags
      confirmationService.resetSession();
    }
    // Notify parent for toast/flash feedback
    onAutoEditModeChange?.(newAutoEditState);
  }, [autoEditEnabled, onAutoEditModeChange]);

  const handleSpecialKey = (key: Key): boolean => {
    // Don't handle input if confirmation dialog is active
    if (isConfirmationActive) {
      return true; // Prevent default handling
    }

    // Handle shift+tab to toggle auto-edit mode
    if (key.shift && key.tab) {
      toggleAutoEditMode();
      return true; // Handled
    }

    // Handle escape key for closing menus
    if (key.escape) {
      if (showCommandSuggestions) {
        setShowCommandSuggestions(false);
        setSelectedCommandIndex(0);
        // Reset resource mode if active
        if (suggestionMode === "resource") {
          setResourceSuggestions([]);
          setSuggestionMode("command");
        }
        return true;
      }
      if (isProcessing || isStreaming) {
        agent.abortCurrentOperation();
        setIsProcessing(false);
        setIsStreaming(false);
        setTokenCount(0);
        setProcessingTime(0);
        processingStartTime.current = 0;
        // Notify parent for toast feedback
        onOperationInterrupted?.();
        return true;
      }
      return false; // Let default escape handling work
    }

    // Handle command/resource suggestions navigation
    if (showCommandSuggestions) {
      // Get appropriate suggestions based on mode
      const currentSuggestions = suggestionMode === "resource"
        ? resourceSuggestions.map((r) => ({ command: r.reference, description: r.description || r.name }))
        : filterCommandSuggestions(commandSuggestions, input);

      if (currentSuggestions.length === 0) {
        setShowCommandSuggestions(false);
        setSelectedCommandIndex(0);
        return false; // Continue processing
      } else {
        if (key.upArrow) {
          setSelectedCommandIndex((prev) =>
            prev === 0 ? currentSuggestions.length - 1 : prev - 1
          );
          return true;
        }
        if (key.downArrow) {
          setSelectedCommandIndex(
            (prev) => (prev + 1) % currentSuggestions.length
          );
          return true;
        }
        if (key.tab || key.return) {
          // Check if there are any suggestions available
          if (currentSuggestions.length === 0) {
            return true; // No suggestions, do nothing
          }

          const safeIndex = Math.min(
            selectedCommandIndex,
            currentSuggestions.length - 1
          );
          const selected = currentSuggestions[safeIndex];

          if (suggestionMode === "resource") {
            // Replace @mcp:partial with the full reference
            const mcpMatch = input.match(/@mcp:[^\s]*$/);
            if (mcpMatch) {
              const newInput = input.replace(/@mcp:[^\s]*$/, selected.command + " ");
              setInput(newInput);
              setCursorPosition(newInput.length);
            }
            // Reset resource mode
            setResourceSuggestions([]);
            setSuggestionMode("command");
          } else {
            // Command suggestion - replace entire input
            const newInput = selected.command + " ";
            setInput(newInput);
            setCursorPosition(newInput.length);
          }

          setShowCommandSuggestions(false);
          setSelectedCommandIndex(0);
          return true;
        }
      }
    }

    return false; // Let default handling proceed
  };

  const handleInputSubmit = async (userInput: string) => {
    if (userInput === "exit" || userInput === "quit") {
      process.exit(0);
      return;
    }

    if (userInput.trim()) {
      const directCommandResult = await handleDirectCommand(userInput);
      if (!directCommandResult) {
        await processUserMessage(userInput);
      }
    }
  };

  const handleInputChange = useCallback((newInput: string) => {
    // Check for @mcp: resource auto-complete
    const mcpMatch = newInput.match(/@mcp:([^\s]*)$/);
    if (mcpMatch) {
      const query = mcpMatch[1].toLowerCase();
      // BUG FIX: Track current query to prevent race condition
      // If user types faster than async completes, stale results are discarded
      currentMcpQueryRef.current = query;

      // Load resources asynchronously
      getMCPResources().then((resources) => {
        // BUG FIX: Only apply results if query hasn't changed (prevents stale suggestions)
        if (currentMcpQueryRef.current !== query) {
          return; // Query changed, discard stale results
        }

        const filtered = resources.filter((r) =>
          r.reference.toLowerCase().includes(query) ||
          r.name.toLowerCase().includes(query) ||
          (r.description && r.description.toLowerCase().includes(query))
        );
        setResourceSuggestions(filtered);
        setSuggestionMode("resource");
        setShowCommandSuggestions(true);
        setSelectedCommandIndex(0);
      }).catch(() => {
        // Only clear if this is still the current query
        if (currentMcpQueryRef.current === query) {
          setResourceSuggestions([]);
        }
      });
      return;
    }

    // Reset resource mode if it was active but no longer matches
    // BUG FIX: Also clear the query ref when leaving resource mode
    if (suggestionMode === "resource") {
      currentMcpQueryRef.current = null;
      setResourceSuggestions([]);
      setSuggestionMode("command");
    }

    // Update command suggestions based on input
    if (newInput.startsWith("/")) {
      setShowCommandSuggestions(true);
      setSelectedCommandIndex(0);
    } else {
      setShowCommandSuggestions(false);
      setSelectedCommandIndex(0);
    }
  }, [suggestionMode]);

  const handleVerboseToggle = useCallback(() => {
    // Cycle through verbosity levels: QUIET -> CONCISE -> VERBOSE -> QUIET
    setVerbosityLevel((prev) => {
      const nextLevel = (prev + 1) % 3;  // Cycle through 0, 1, 2

      // Update legacy verboseMode for backward compatibility
      setVerboseMode(nextLevel === VerbosityLevel.VERBOSE);

      // Notify parent for toast/flash feedback
      onVerboseModeChange?.(nextLevel === VerbosityLevel.VERBOSE);

      return nextLevel as VerbosityLevel;
    });
  }, [onVerboseModeChange]);

  const handleBackgroundModeToggle = useCallback(() => {
    // Check if a bash command is currently executing
    if (agent.isBashExecuting()) {
      const taskId = agent.moveBashToBackground();
      if (taskId) {
        // Notify parent for toast feedback
        onTaskMovedToBackground?.(taskId);
        return;
      }
    }
    // Otherwise toggle background mode preference
    setBackgroundMode((prev) => {
      const newState = !prev;
      // Notify parent for toast/flash feedback instead of polluting chat history
      onBackgroundModeChange?.(newState);
      return newState;
    });
  }, [agent, onBackgroundModeChange, onTaskMovedToBackground]);

  const handleThinkingModeToggle = useCallback(() => {
    setThinkingModeEnabled((prev) => {
      const newState = !prev;
      // Update agent thinking configuration
      if (newState) {
        agent.setThinkingConfig({ type: "enabled" });
      } else {
        agent.setThinkingConfig({ type: "disabled" });
      }
      // Notify parent for toast/flash feedback
      onThinkingModeChange?.(newState);
      return newState;
    });
  }, [agent, onThinkingModeChange]);

  const handleExternalEditor = useCallback(async (currentInput: string): Promise<string | null> => {
    try {
      // Get editor name for toast notification
      const editor = getPreferredEditor();
      const editorName = getEditorDisplayName(editor);

      // Notify user that editor is opening
      onEditorOpening?.(editorName);

      const result = await openExternalEditor({
        initialContent: currentInput,
        fileExtension: '.md', // Use markdown for syntax highlighting
      });

      if (result.success && result.content) {
        // Successfully edited - return new content
        onEditorSuccess?.();
        return result.content;
      } else if (result.cancelled) {
        // User cancelled - no changes
        onEditorCancelled?.();
        return null;
      } else {
        // Error occurred
        onEditorError?.(result.error || 'Unknown error');
        return null;
      }
    } catch (error: any) {
      onEditorError?.(error.message || 'Failed to open editor');
      return null;
    }
  }, [onEditorOpening, onEditorSuccess, onEditorCancelled, onEditorError]);

  const {
    input,
    cursorPosition,
    pastedBlocks,
    currentBlockAtCursor,
    isPasting,
    setInput,
    setCursorPosition,
    clearInput,
    resetHistory,
    handleInput,
    expandPlaceholdersForSubmit: _expandPlaceholdersForSubmit, // Part of hook interface, reserved for future use
  } = useEnhancedInput({
    onSubmit: handleInputSubmit,
    onSpecialKey: handleSpecialKey,
    onVerboseToggle: handleVerboseToggle,
    onQuickActions: onQuickActionsToggle,
    onBackgroundModeToggle: handleBackgroundModeToggle,
    onCopyLastResponse,
    onThinkingModeToggle: handleThinkingModeToggle,
    onExternalEditor: handleExternalEditor,
    onLargePaste,
    onPasteTruncated,
    onKeyboardHelp,
    disabled: isConfirmationActive,
    projectDir: process.cwd(),
  });
  void _expandPlaceholdersForSubmit; // Suppress unused warning - reserved for future use

  // Hook up the actual input handling
  useInput((inputChar: string, key: Key) => {
    handleInput(inputChar, key);
  });

  // Update command suggestions when input changes
  useEffect(() => {
    handleInputChange(input);
  }, [input, handleInputChange]);

  // Cleanup retry timeout on unmount
  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null; // Clear ref to prevent dangling reference
      }
    };
  }, []);

  // Get custom commands manager
  const customCommandsManager = useMemo(() => getCustomCommandsManager(), []);

  // Build command suggestions including custom commands
  const commandSuggestions: CommandSuggestion[] = useMemo(() => {
    const builtIn: CommandSuggestion[] = [
      { command: "/help", description: "Show help information" },
      { command: "/shortcuts", description: "Show keyboard shortcuts guide" },
      { command: "/continue", description: "Continue incomplete response" },
      { command: "/retry", description: "Re-send the last message" },
      { command: "/clear", description: "Clear chat history" },
      { command: "/init", description: "Initialize project with smart analysis" },
      { command: "/usage", description: "Show API usage statistics" },
      { command: "/doctor", description: "Run health check diagnostics" },
      { command: "/mcp", description: "Open MCP server dashboard" },
      { command: "/permissions", description: "View/manage tool permissions" },
      { command: "/tasks", description: "List background tasks" },
      { command: "/task", description: "View output of a background task" },
      { command: "/kill", description: "Kill a background task" },
      { command: "/rewind", description: "Rewind to previous checkpoint" },
      { command: "/checkpoints", description: "List checkpoint statistics" },
      { command: "/checkpoint-clean", description: "Clean old checkpoints" },
      { command: "/commit-and-push", description: "AI commit & push to remote" },
      { command: "/plans", description: "List all task plans" },
      { command: "/plan", description: "Show current plan details" },
      { command: "/phases", description: "Show phases of current plan" },
      { command: "/pause", description: "Pause current plan execution" },
      { command: "/resume", description: "Resume paused plan" },
      { command: "/skip", description: "Skip current phase" },
      { command: "/abandon", description: "Abandon current plan" },
      { command: "/memory", description: "Show project memory status" },
      { command: "/memory warmup", description: "Generate project memory" },
      { command: "/memory refresh", description: "Update project memory" },
      { command: "/commands", description: "List custom commands" },
      { command: "/theme", description: "Switch color theme (default, dark, light, dracula, monokai)" },
      { command: "/exit", description: "Exit the application" },
    ];

    // Add custom commands
    const customCmds = customCommandsManager.getAllCommands();
    const customSuggestions = customCmds.map((cmd: CustomCommand) => ({
      command: `/${cmd.name}`,
      description: `${cmd.description} [${cmd.scope}]`,
    }));

    // Add MCP prompts as slash commands
    const mcpPrompts = getMCPPrompts();
    const mcpPromptSuggestions = mcpPrompts.map((prompt) => ({
      command: promptToSlashCommand(prompt as any),
      description: getPromptDescription(prompt as any),
    }));

    return [...builtIn, ...customSuggestions, ...mcpPromptSuggestions];
  }, [customCommandsManager]);

  // Load models from configuration with fallback to defaults
  const availableModels: ModelOption[] = useMemo(() => {
    const settingsManager = getSettingsManager();
    const models = settingsManager.getAvailableModels();
    return models.map(m => ({ model: m }));
  }, []);

  const handleDirectCommand = async (input: string): Promise<boolean> => {
    const trimmedInput = input.trim();

    if (trimmedInput === "/continue") {
      // Send a shorter, more focused continuation prompt to avoid timeout
      // Using a brief prompt reduces token overhead for large contexts
      const continuePrompt = "Continue from where you left off.";

      // Add user continue command to history (showing the actual command for clarity)
      const userEntry: ChatEntry = {
        type: "user",
        content: "/continue",
        timestamp: new Date(),
      };
      setChatHistory((prev) => [...prev, userEntry]);

      // Process through agent
      setIsProcessing(true);
      setIsStreaming(true);
      processingStartTime.current = Date.now();

      // Fire async operation with proper error handling
      (async () => {
        try {
          let streamingEntry: ChatEntry | null = null;

          for await (const chunk of agent.processUserMessageStream(continuePrompt)) {
            switch (chunk.type) {
              case "reasoning":
                if (chunk.reasoningContent) {
                  if (!streamingEntry) {
                    const newStreamingEntry: ChatEntry = {
                      type: "assistant",
                      content: "",
                      timestamp: new Date(),
                      isStreaming: true,
                      reasoningContent: chunk.reasoningContent,
                      isReasoningStreaming: true,
                    };
                    setChatHistory((prev) => [...prev, newStreamingEntry]);
                    streamingEntry = newStreamingEntry;
                  } else {
                    setChatHistory((prev) =>
                      prev.map((entry, idx) =>
                        idx === prev.length - 1 && entry.isStreaming
                          ? {
                              ...entry,
                              reasoningContent:
                                (entry.reasoningContent || "") +
                                chunk.reasoningContent,
                              isReasoningStreaming: true,
                            }
                          : entry
                      )
                    );
                  }
                }
                break;

              case "content":
                if (chunk.content) {
                  if (!streamingEntry) {
                    const newStreamingEntry: ChatEntry = {
                      type: "assistant",
                      content: chunk.content,
                      timestamp: new Date(),
                      isStreaming: true,
                    };
                    setChatHistory((prev) => [...prev, newStreamingEntry]);
                    streamingEntry = newStreamingEntry;
                  } else {
                    setChatHistory((prev) =>
                      prev.map((entry, idx) =>
                        idx === prev.length - 1 && entry.isStreaming
                          ? {
                              ...entry,
                              content: entry.content + chunk.content,
                              isReasoningStreaming: false,
                            }
                          : entry
                      )
                    );
                  }
                }
                break;

              case "token_count":
                if (chunk.tokenCount !== undefined) {
                  setTokenCount(chunk.tokenCount);
                }
                break;

              case "tool_calls":
                if (chunk.toolCalls) {
                  setChatHistory((prev) =>
                    prev.map((entry) =>
                      entry.isStreaming
                        ? {
                            ...entry,
                            isStreaming: false,
                            toolCalls: chunk.toolCalls,
                          }
                        : entry
                    )
                  );
                  streamingEntry = null;

                  chunk.toolCalls.forEach((toolCall) => {
                    const toolCallEntry: ChatEntry = {
                      type: "tool_call",
                      content: "Executing...",
                      timestamp: new Date(),
                      toolCall: toolCall,
                    };
                    setChatHistory((prev) => [...prev, toolCallEntry]);
                  });
                }
                break;

              case "tool_result":
                if (chunk.toolCall && chunk.toolResult) {
                  setChatHistory((prev) =>
                    prev.map((entry) => {
                      if (entry.isStreaming) {
                        return { ...entry, isStreaming: false };
                      }
                      if (
                        entry.type === "tool_call" &&
                        entry.toolCall?.id === chunk.toolCall?.id
                      ) {
                        return {
                          ...entry,
                          type: "tool_result",
                          content: chunk.toolResult?.success
                            ? chunk.toolResult?.output || "Success"
                            : chunk.toolResult?.error || "Error occurred",
                          toolResult: chunk.toolResult,
                          executionDurationMs: chunk.executionDurationMs,
                        };
                      }
                      return entry;
                    })
                  );
                  streamingEntry = null;
                }
                break;

              case "done":
                if (streamingEntry) {
                  // Calculate response duration
                  const durationMs = processingStartTime.current > 0
                    ? Date.now() - processingStartTime.current
                    : undefined;

                  setChatHistory((prev) =>
                    prev.map((entry) =>
                      entry.isStreaming ? { ...entry, isStreaming: false, durationMs } : entry
                    )
                  );
                }
                setIsStreaming(false);
                break;
            }
          }
        } catch (error: unknown) {
          const errorObj = error instanceof Error ? error : new Error(String(error));
          let errorMessage = `Error: ${errorObj.message}`;

          // Provide helpful guidance for timeout errors during /continue
          if (errorObj.message?.includes('timeout')) {
            errorMessage += `\n\n💡 Tip: For very long conversations, try:\n`;
            errorMessage += `   • Use /clear to start fresh and ask a more focused question\n`;
            errorMessage += `   • Break down your request into smaller parts\n`;
            errorMessage += `   • Use --continue flag to start a new session with history`;
          }

          const errorEntry: ChatEntry = {
            type: "assistant",
            content: errorMessage,
            timestamp: new Date(),
          };
          setChatHistory((prev) => [...prev, errorEntry]);
          setIsStreaming(false);
        }

        setIsProcessing(false);
        processingStartTime.current = 0;
      })().catch((error: unknown) => {
        // Safety net: handle any uncaught errors from the async IIFE
        const errorObj = error instanceof Error ? error : new Error(String(error));
        const errorEntry: ChatEntry = {
          type: "assistant",
          content: `Unexpected error: ${errorObj.message}`,
          timestamp: new Date(),
        };
        setChatHistory((prev) => [...prev, errorEntry]);
        setIsStreaming(false);
        setIsProcessing(false);
        processingStartTime.current = 0;
      });

      clearInput();
      resetHistory();
      return true;
    }

    if (trimmedInput === "/retry") {
      // Find the last user message index and re-send it
      // Use findLastIndex instead of reverse().find() + lastIndexOf() to avoid object reference issues
      const lastUserIndex = chatHistory.findLastIndex((entry: { type: string }) => entry.type === "user");
      if (lastUserIndex >= 0 && chatHistory[lastUserIndex]?.content) {
        // Store the message content and history state before clearing
        const messageToRetry = chatHistory[lastUserIndex].content;
        const historyBackup = [...chatHistory];

        // Remove the last user message and any assistant responses after it
        setChatHistory(prev => prev.slice(0, lastUserIndex));
        clearInput();

        // Trigger submit after a brief delay to allow state update
        // Track timeout for cleanup on unmount
        retryTimeoutRef.current = setTimeout(() => {
          retryTimeoutRef.current = null;
          // Call async function and handle promise rejection
          handleInputSubmit(messageToRetry).catch(() => {
            // Restore history if retry fails
            setChatHistory(historyBackup);
          });
        }, 50);
      } else {
        clearInput();
      }
      return true;
    }

    if (trimmedInput === "/clear") {
      // Reset chat history
      setChatHistory([]);

      // Clear saved history from disk
      const historyManager = getHistoryManager();
      historyManager.clearHistory();

      // Clear tool grouper cache to prevent memory leaks
      clearToolGroupCache();

      // Reset processing states
      setIsProcessing(false);
      setIsStreaming(false);
      setTokenCount(0);
      setProcessingTime(0);
      processingStartTime.current = 0;

      // Reset confirmation service session flags
      const confirmationService = ConfirmationService.getInstance();
      confirmationService.resetSession();

      // Notify parent for toast feedback
      onChatCleared?.();

      clearInput();
      resetHistory();
      return true;
    }

    if (trimmedInput === "/init") {
      const userEntry: ChatEntry = {
        type: "user",
        content: "/init",
        timestamp: new Date(),
      };
      setChatHistory((prev) => [...prev, userEntry]);

      setIsProcessing(true);

      try {
        const projectRoot = process.cwd();

        // Add analysis message
        const analyzingEntry: ChatEntry = {
          type: "assistant",
          content: "🔍 Analyzing project...\n",
          timestamp: new Date(),
        };
        setChatHistory((prev) => [...prev, analyzingEntry]);

        // Check if already initialized
        const axCliDir = path.join(projectRoot, ".ax-cli");
        const customMdPath = path.join(axCliDir, "CUSTOM.md");
        const indexPath = path.join(axCliDir, "index.json");

        if (fs.existsSync(customMdPath)) {
          const alreadyInitEntry: ChatEntry = {
            type: "assistant",
            content: `✅ Project already initialized!\n📝 Custom instructions: ${customMdPath}\n📊 Project index: ${indexPath}\n\n💡 Run 'ax-cli init --force' from terminal to regenerate`,
            timestamp: new Date(),
          };
          setChatHistory((prev) => [...prev, alreadyInitEntry]);
          setIsProcessing(false);
          clearInput();
          return true;
        }

        // Analyze project
        const analyzer = new ProjectAnalyzer(projectRoot);
        const result = await analyzer.analyze();

        if (!result.success || !result.projectInfo) {
          const errorEntry: ChatEntry = {
            type: "assistant",
            content: `❌ Failed to analyze project: ${result.error || "Unknown error"}`,
            timestamp: new Date(),
          };
          setChatHistory((prev) => [...prev, errorEntry]);
          setIsProcessing(false);
          clearInput();
          return true;
        }

        const projectInfo = result.projectInfo;

        // Generate instructions
        const generator = new InstructionGenerator();
        const instructions = generator.generateInstructions(projectInfo);
        const index = generator.generateIndex(projectInfo);

        // Create .ax-cli directory
        if (!fs.existsSync(axCliDir)) {
          fs.mkdirSync(axCliDir, { recursive: true });
        }

        // Write custom instructions
        fs.writeFileSync(customMdPath, instructions, "utf-8");

        // Write project index
        fs.writeFileSync(indexPath, index, "utf-8");

        // Display success
        let successMessage = `🎉 Project initialized successfully!\n\n`;
        successMessage += `📋 Analysis Results:\n`;
        successMessage += `   Name: ${projectInfo.name}\n`;
        successMessage += `   Type: ${projectInfo.projectType}\n`;
        successMessage += `   Language: ${projectInfo.primaryLanguage}\n`;
        if (projectInfo.techStack.length > 0) {
          successMessage += `   Stack: ${projectInfo.techStack.join(", ")}\n`;
        }
        successMessage += `\n✅ Generated custom instructions: ${customMdPath}\n`;
        successMessage += `✅ Generated project index: ${indexPath}\n\n`;
        successMessage += `💡 Next steps:\n`;
        successMessage += `   1. Review and customize the instructions if needed\n`;
        successMessage += `   2. Run AX CLI - it will automatically use these instructions\n`;
        successMessage += `   3. Use 'ax-cli init --force' to regenerate after project changes`;

        const successEntry: ChatEntry = {
          type: "assistant",
          content: successMessage,
          timestamp: new Date(),
        };
        setChatHistory((prev) => [...prev, successEntry]);
      } catch (error) {
        const errorEntry: ChatEntry = {
          type: "assistant",
          content: `❌ Error during initialization: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
          timestamp: new Date(),
        };
        setChatHistory((prev) => [...prev, errorEntry]);
      }

      setIsProcessing(false);
      clearInput();
      return true;
    }

    if (trimmedInput === "/help") {
      const helpEntry: ChatEntry = {
        type: "assistant",
        content: `AX CLI Help:

Built-in Commands:
  /continue   - Continue incomplete response from where it left off
  /clear      - Clear chat history
  /init       - Initialize project with smart analysis
  /help       - Show this help
  /shortcuts  - Show keyboard shortcuts guide
  /usage      - Show API usage statistics
  /doctor     - Run health check diagnostics
  /mcp        - Open MCP server dashboard
  /exit       - Exit application
  exit, quit  - Exit application

Background Task Commands:
  /tasks             - List all background tasks
  /task <id>         - View output of a background task
  /kill <id>         - Kill a running background task

  Tip: Append ' &' to any bash command to run it in background
       Example: npm run dev &

Checkpoint Commands:
  /rewind            - Rewind to a previous checkpoint (interactive)
  /checkpoints       - Show checkpoint statistics
  /checkpoint-clean  - Clean old checkpoints (compress and prune)

Plan Commands (Multi-Phase Task Planning):
  /plans             - List all task plans
  /plan [id]         - Show current or specific plan details
  /phases            - Show phases of current plan
  /pause             - Pause current plan execution
  /resume [id]       - Resume current or specific plan
  /skip              - Skip current phase
  /abandon           - Abandon current plan

Git Commands:
  /commit-and-push - AI-generated commit + push to remote

Memory Commands (z.ai GLM-4.6 caching):
  /memory          - Show project memory status
  /memory warmup   - Generate project memory context
  /memory refresh  - Update memory after changes

UI Commands:
  /theme           - Show current theme and list available themes
  /theme <name>    - Switch color theme (default, dark, light, dracula, monokai)

Enhanced Input Features:
  ↑/↓ Arrow   - Navigate command history
  Ctrl+C      - Clear input (press twice to exit)
  Ctrl+X      - Clear entire input line
  Esc×2       - Clear input (press Escape twice quickly)
  Ctrl+←/→    - Move by word
  Ctrl+A/E    - Move to line start/end
  Ctrl+W      - Delete word before cursor
  Ctrl+K      - Delete to end of line
  Ctrl+U      - Delete to start of line
  Ctrl+O      - Toggle verbose mode (show full output, default: concise)
  Ctrl+B      - Toggle background mode (run all commands in background)
  Ctrl+P      - Expand/collapse pasted text at cursor
  Ctrl+Y      - Copy last assistant response to clipboard
  Shift+Tab   - Toggle auto-edit mode (bypass confirmations)
  1-4 keys    - Quick select in confirmation dialogs

Paste Handling:
  When you paste 5+ lines, it's automatically collapsed to a preview.
  Position cursor on collapsed text and press Ctrl+P to expand/collapse.
  Full content is always sent to AI (display-only feature).

Direct Commands (executed immediately):
  ls [path]   - List directory contents
  pwd         - Show current directory
  cd <path>   - Change directory
  cat <file>  - View file contents
  mkdir <dir> - Create directory
  touch <file>- Create empty file

Model Configuration:
  Edit ~/.ax-cli/config.json to configure default model and settings

For complex operations, just describe what you want in natural language.
Examples:
  "edit package.json and add a new script"
  "create a new React component called Header"
  "show me all TypeScript files in this project"`,
        timestamp: new Date(),
      };
      setChatHistory((prev) => [...prev, helpEntry]);
      clearInput();
      return true;
    }

    if (trimmedInput === "/shortcuts") {
      const shortcutsEntry: ChatEntry = {
        type: "assistant",
        content: getKeyboardShortcutGuideText(),
        timestamp: new Date(),
      };
      setChatHistory((prev) => [...prev, shortcutsEntry]);
      clearInput();
      return true;
    }

    if (trimmedInput === "/usage") {
      const tracker = getUsageTracker();
      const stats = tracker.getSessionStats();

      let usageContent = "📊 **API Usage & Limits (Z.AI)**\n\n";

      // Session statistics
      usageContent += "**📱 Current Session:**\n";
      if (stats.totalRequests === 0) {
        usageContent += "  No API requests made yet. Ask me something to start tracking!\n";
      } else {
        usageContent += `  • Requests: ${stats.totalRequests.toLocaleString()}\n`;
        usageContent += `  • Prompt Tokens: ${stats.totalPromptTokens.toLocaleString()}\n`;
        usageContent += `  • Completion Tokens: ${stats.totalCompletionTokens.toLocaleString()}\n`;
        usageContent += `  • Total Tokens: ${stats.totalTokens.toLocaleString()}\n`;

        if (stats.totalReasoningTokens > 0) {
          usageContent += `  • Reasoning Tokens: ${stats.totalReasoningTokens.toLocaleString()}\n`;
        }

        if (stats.byModel.size > 0) {
          usageContent += `\n  **Models Used:**\n`;
          for (const [model, modelStats] of stats.byModel.entries()) {
            usageContent += `    - ${model}: ${modelStats.totalTokens.toLocaleString()} tokens (${modelStats.requests} requests)\n`;
          }
        }
      }

      // Z.AI account information
      usageContent += `\n**🔑 Z.AI Account Usage & Limits:**\n`;
      usageContent += `  ⚠️  API does not provide programmatic access to usage data\n`;
      usageContent += `\n  **Check your account:**\n`;
      usageContent += `  • Billing & Usage: https://z.ai/manage-apikey/billing\n`;
      usageContent += `  • Rate Limits: https://z.ai/manage-apikey/rate-limits\n`;
      usageContent += `  • API Keys: https://z.ai/manage-apikey/apikey-list\n`;

      usageContent += `\n**ℹ️  Notes:**\n`;
      usageContent += `  • Billing reflects previous day (n-1) consumption\n`;
      usageContent += `  • Current day usage may not be immediately visible\n`;
      usageContent += `  • Cached content: 1/5 of original price\n`;

      usageContent += `\n**💰 GLM-4.6 Pricing:**\n`;
      usageContent += `  • Input: $0.11 per 1M tokens\n`;
      usageContent += `  • Output: $0.28 per 1M tokens\n`;

      if (stats.totalRequests > 0) {
        // Calculate estimated cost for this session
        const inputCost = (stats.totalPromptTokens / 1000000) * 0.11;
        const outputCost = (stats.totalCompletionTokens / 1000000) * 0.28;
        const totalCost = inputCost + outputCost;
        usageContent += `\n**💵 Estimated Session Cost:**\n`;
        usageContent += `  • Input: $${inputCost.toFixed(6)} (${stats.totalPromptTokens.toLocaleString()} tokens)\n`;
        usageContent += `  • Output: $${outputCost.toFixed(6)} (${stats.totalCompletionTokens.toLocaleString()} tokens)\n`;
        usageContent += `  • **Total: ~$${totalCost.toFixed(6)}**\n`;
      }

      const usageEntry: ChatEntry = {
        type: "assistant",
        content: usageContent,
        timestamp: new Date(),
      };
      setChatHistory((prev) => [...prev, usageEntry]);
      clearInput();
      return true;
    }

    if (trimmedInput === "/doctor") {
      // Run doctor diagnostics
      const doctorContent = "🏥 **Running AX CLI Diagnostics...**\n\n";
      const doctorEntry: ChatEntry = {
        type: "assistant",
        content: doctorContent,
        timestamp: new Date(),
      };
      setChatHistory((prev) => [...prev, doctorEntry]);

      // Execute doctor command asynchronously (non-blocking)
      (async () => {
        try {
          const { exec } = await import("child_process");
          const { promisify } = await import("util");
          const execAsync = promisify(exec);

          // Use 'ax-cli doctor' command which will use the globally installed binary
          // This works whether installed globally or linked locally
          // Disable chalk colors (FORCE_COLOR=0) since output goes to markdown
          const { stdout, stderr } = await execAsync("ax-cli doctor", {
            encoding: "utf-8",
            timeout: TIMEOUT_CONFIG.BASH_DEFAULT,
            maxBuffer: 10 * 1024 * 1024, // 10MB buffer
            env: { ...process.env, FORCE_COLOR: "0" },
          });

          // Convert plain text output to markdown with proper emoji indicators
          const output = (stdout || stderr)
            .replace(/✓/g, "✅")
            .replace(/✗/g, "❌")
            .replace(/⚠/g, "⚠️");
          const resultEntry: ChatEntry = {
            type: "assistant",
            content: output,
            timestamp: new Date(),
          };
          setChatHistory((prev) => [...prev, resultEntry]);
        } catch (error: unknown) {
          const errorMessage = extractErrorMessage(error);
          const errorEntry: ChatEntry = {
            type: "assistant",
            content: `❌ **Doctor diagnostics failed:**\n\n\`\`\`\n${errorMessage}\n\`\`\``,
            timestamp: new Date(),
          };
          setChatHistory((prev) => [...prev, errorEntry]);
        }
      })();

      clearInput();
      return true;
    }

    // MCP Dashboard command
    if (trimmedInput === "/mcp") {
      if (onMcpDashboardToggle) {
        onMcpDashboardToggle();
      }
      clearInput();
      return true;
    }

    // Permissions management command
    if (trimmedInput === "/permissions" || trimmedInput.startsWith("/permissions ")) {
      const args = trimmedInput.replace("/permissions", "").trim();
      const permManager = getPermissionManager();
      const config = permManager.getConfig();

      if (!args || args === "show" || args === "list") {
        // Show current permissions configuration
        const permissionLines: string[] = [
          "**Permission Configuration**\n",
          `Default Tier: **${config.permissions.default_tier}**\n`,
          "\n**Tool Permissions:**\n",
        ];

        const tierEmoji: Record<string, string> = {
          [PermissionTier.AutoApprove]: "✅",
          [PermissionTier.Notify]: "🔔",
          [PermissionTier.Confirm]: "⚠️",
          [PermissionTier.Block]: "🚫",
        };

        for (const [tool, toolConfig] of Object.entries(config.permissions.tools)) {
          const emoji = tierEmoji[toolConfig.tier] || "❓";
          permissionLines.push(`- ${emoji} **${tool}**: ${toolConfig.tier}\n`);
        }

        permissionLines.push("\n**Session Settings:**\n");
        permissionLines.push(`- Allow all bash: ${config.permissions.session_approvals.allow_all_bash ? "Yes" : "No"}\n`);
        permissionLines.push(`- Trust current directory: ${config.permissions.session_approvals.trust_current_directory ? "Yes" : "No"}\n`);

        permissionLines.push("\n*Tip: Use `/permissions set <tool> <tier>` to change permissions*\n");
        permissionLines.push("*Tiers: auto_approve, notify, confirm, block*");

        const permEntry: ChatEntry = {
          type: "assistant",
          content: permissionLines.join(""),
          timestamp: new Date(),
        };
        setChatHistory((prev) => [...prev, permEntry]);

      } else if (args.startsWith("set ")) {
        // Set permission for a tool
        const setArgs = args.replace("set ", "").trim().split(/\s+/);
        if (setArgs.length >= 2) {
          const [tool, tier] = setArgs;
          const validTiers = ["auto_approve", "notify", "confirm", "block"];

          if (!validTiers.includes(tier)) {
            const errorEntry: ChatEntry = {
              type: "assistant",
              content: `❌ Invalid tier: "${tier}"\n\nValid tiers are: ${validTiers.join(", ")}`,
              timestamp: new Date(),
            };
            setChatHistory((prev) => [...prev, errorEntry]);
          } else {
            // Update the permission
            const newTools = { ...config.permissions.tools };
            newTools[tool] = { tier: tier as PermissionTier };

            permManager.updateConfig({ tools: newTools }).then(() => {
              const successEntry: ChatEntry = {
                type: "assistant",
                content: `✅ Set **${tool}** permission to **${tier}**`,
                timestamp: new Date(),
              };
              setChatHistory((prev) => [...prev, successEntry]);
            }).catch((error) => {
              const errorEntry: ChatEntry = {
                type: "assistant",
                content: `❌ Failed to update permission: ${extractErrorMessage(error)}`,
                timestamp: new Date(),
              };
              setChatHistory((prev) => [...prev, errorEntry]);
            });
          }
        } else {
          const helpEntry: ChatEntry = {
            type: "assistant",
            content: "Usage: `/permissions set <tool> <tier>`\n\nExample: `/permissions set bash confirm`",
            timestamp: new Date(),
          };
          setChatHistory((prev) => [...prev, helpEntry]);
        }
      } else if (args === "reset") {
        // Reset to default permissions
        permManager.clearSessionApprovals();
        const resetEntry: ChatEntry = {
          type: "assistant",
          content: "✅ Session permissions cleared. Tool permissions reset to defaults.",
          timestamp: new Date(),
        };
        setChatHistory((prev) => [...prev, resetEntry]);
      } else {
        // Show help
        const helpEntry: ChatEntry = {
          type: "assistant",
          content: "**Permission Commands:**\n\n" +
            "- `/permissions` - Show current permissions\n" +
            "- `/permissions set <tool> <tier>` - Set tool permission tier\n" +
            "- `/permissions reset` - Reset session approvals\n\n" +
            "**Permission Tiers:**\n" +
            "- `auto_approve` - Automatically allow (safe operations)\n" +
            "- `notify` - Allow with notification\n" +
            "- `confirm` - Require user confirmation\n" +
            "- `block` - Always block",
          timestamp: new Date(),
        };
        setChatHistory((prev) => [...prev, helpEntry]);
      }

      clearInput();
      return true;
    }

    // MCP Prompt commands (format: /mcp__servername__promptname [args])
    if (trimmedInput.startsWith("/mcp__")) {
      const parts = trimmedInput.split(" ");
      const commandPart = parts[0];
      const argsPart = parts.slice(1).join(" ");

      const parsed = parsePromptCommand(commandPart);
      if (parsed) {
        const { serverName, promptName } = parsed;

        // Add user command to chat history
        const userEntry: ChatEntry = {
          type: "user",
          content: trimmedInput,
          timestamp: new Date(),
        };
        setChatHistory((prev) => [...prev, userEntry]);

        // Execute the prompt asynchronously
        (async () => {
          try {
            const manager = getMCPManager();
            const v2 = manager.getV2Instance();
            const { createServerName } = await import("../../mcp/client-v2.js");

            const serverNameBranded = createServerName(serverName);
            if (!serverNameBranded) {
              throw new Error(`Invalid server name: ${serverName}`);
            }

            // Parse arguments if provided (format: key=value key2=value2)
            const promptArgs: Record<string, string> = {};
            if (argsPart) {
              const argMatches = argsPart.match(/(\w+)=("[^"]+"|[^\s]+)/g);
              if (argMatches) {
                for (const match of argMatches) {
                  const [key, ...valueParts] = match.split("=");
                  let value = valueParts.join("=");
                  // Remove quotes if present
                  if (value.startsWith('"') && value.endsWith('"')) {
                    value = value.slice(1, -1);
                  }
                  promptArgs[key] = value;
                }
              }
            }

            const result = await v2.getPrompt(serverNameBranded, promptName, Object.keys(promptArgs).length > 0 ? promptArgs : undefined);

            if (!result.success) {
              throw result.error;
            }

            // Cast to GetPromptResult format for formatPromptResult
            const promptResult = result.value as { description?: string; messages: Array<{ role: string; content: string | { text: string } }> };
            const formattedContent = formatPromptResult(promptResult as any);

            // Add the prompt result as an assistant message
            const promptEntry: ChatEntry = {
              type: "assistant",
              content: `**MCP Prompt: ${serverName}/${promptName}**\n\n${formattedContent}`,
              timestamp: new Date(),
            };
            setChatHistory((prev) => [...prev, promptEntry]);

          } catch (error) {
            const errorMessage = extractErrorMessage(error);
            // Use assistant type with error content since "error" is not a valid ChatEntry type
            const errorEntry: ChatEntry = {
              type: "assistant",
              content: `❌ **Failed to execute MCP prompt:** ${errorMessage}`,
              timestamp: new Date(),
            };
            setChatHistory((prev) => [...prev, errorEntry]);
          }
        })();

        clearInput();
        return true;
      }
    }

    if (trimmedInput === "/exit") {
      process.exit(0);
      return true;
    }

    // Memory commands
    if (trimmedInput === "/memory" || trimmedInput === "/memory status") {
      const store = getContextStore();
      const metadata = store.getMetadata();

      let memoryContent = "🧠 **Project Memory Status**\n\n";

      if (!metadata.exists) {
        memoryContent += "❌ No project memory found.\n\n";
        memoryContent += "Run `/memory warmup` to generate project memory for z.ai caching.\n";
      } else {
        memoryContent += `✅ Memory initialized\n\n`;
        memoryContent += `**Token Estimate:** ${metadata.tokenEstimate?.toLocaleString() || 'N/A'} tokens\n`;
        memoryContent += `**Last Updated:** ${metadata.updatedAt ? new Date(metadata.updatedAt).toLocaleString() : 'N/A'}\n`;
        memoryContent += `**Usage Count:** ${metadata.usageCount || 0}\n`;

        // Try to get section breakdown
        const loadResult = store.load();
        if (loadResult.success) {
          const sections = loadResult.data.context.sections;
          memoryContent += `\n**📊 Token Distribution:**\n`;
          const total = Object.values(sections).reduce((a, b) => a + b, 0);
          for (const [name, tokens] of Object.entries(sections)) {
            const pct = total > 0 ? Math.round((tokens / total) * 100) : 0;
            const bar = '█'.repeat(Math.round(pct / 5)) + '░'.repeat(20 - Math.round(pct / 5));
            memoryContent += `   ${bar}  ${name.charAt(0).toUpperCase() + name.slice(1)}  (${pct}%)\n`;
          }
        }

        // Show cache stats if available
        const statsCollector = getStatsCollector();
        const formattedStats = statsCollector.getFormattedStats();
        if (formattedStats && formattedStats.usageCount > 0) {
          memoryContent += `\n**💾 Cache Statistics:**\n`;
          memoryContent += `   • Usage Count: ${formattedStats.usageCount}\n`;
          memoryContent += `   • Tokens Saved: ${formattedStats.tokensSaved.toLocaleString()}\n`;
          memoryContent += `   • Cache Rate: ${formattedStats.cacheRate}%\n`;
          memoryContent += `   • Est. Savings: $${formattedStats.estimatedSavings.toFixed(4)}\n`;
        }
      }

      const memoryEntry: ChatEntry = {
        type: "assistant",
        content: memoryContent,
        timestamp: new Date(),
      };
      setChatHistory((prev) => [...prev, memoryEntry]);
      clearInput();
      return true;
    }

    if (trimmedInput === "/memory warmup") {
      setIsProcessing(true);

      const warmupEntry: ChatEntry = {
        type: "assistant",
        content: "🔄 Generating project memory...",
        timestamp: new Date(),
      };

      // Track the entry index BEFORE any async operations to prevent race conditions
      let entryIndex = -1;
      setChatHistory((prev) => {
        entryIndex = prev.length; // Store index before pushing
        return [...prev, warmupEntry];
      });

      try {
        const generator = new ContextGenerator();
        const result = await generator.generate();

        if (result.success && result.memory) {
          const store = getContextStore();
          const memory = result.memory;
          const saveResult = store.save(memory);

          if (saveResult.success) {
            const sections = memory.context.sections;
            const tokenEstimate = memory.context.token_estimate;
            let resultContent = `✅ Project memory generated (${tokenEstimate.toLocaleString()} tokens)\n\n`;
            resultContent += `**📊 Context breakdown:**\n`;
            for (const [name, tokens] of Object.entries(sections)) {
              if (tokens !== undefined) {
                const tokenCount = tokens as number;
                const pct = Math.round((tokenCount / tokenEstimate) * 100);
                resultContent += `   ${name.charAt(0).toUpperCase() + name.slice(1)}: ${tokenCount.toLocaleString()} tokens (${pct}%)\n`;
              }
            }
            resultContent += `\n💾 Saved to .ax-cli/memory.json`;

            // Update the specific entry by index to avoid race conditions
            setChatHistory((prev) => {
              const updated = [...prev];
              if (entryIndex >= 0 && entryIndex < updated.length) {
                updated[entryIndex] = {
                  type: "assistant",
                  content: resultContent,
                  timestamp: new Date(),
                };
              }
              return updated;
            });

            // Trigger toast notification
            onMemoryWarmed?.(tokenEstimate);
          } else {
            throw new Error(saveResult.error);
          }
        } else {
          throw new Error(result.error);
        }
      } catch (error: unknown) {
        const errorMessage = extractErrorMessage(error);
        // Update the specific entry by index to avoid race conditions
        setChatHistory((prev) => {
          const updated = [...prev];
          if (entryIndex >= 0 && entryIndex < updated.length) {
            updated[entryIndex] = {
              type: "assistant",
              content: `❌ Failed to generate memory: ${errorMessage}`,
              timestamp: new Date(),
            };
          }
          return updated;
        });
      }

      setIsProcessing(false);
      clearInput();
      return true;
    }

    if (trimmedInput === "/memory refresh") {
      setIsProcessing(true);

      const refreshEntry: ChatEntry = {
        type: "assistant",
        content: "🔄 Refreshing project memory...",
        timestamp: new Date(),
      };

      // Track the entry index BEFORE any async operations to prevent race conditions
      let entryIndex = -1;
      setChatHistory((prev) => {
        entryIndex = prev.length; // Store index before pushing
        return [...prev, refreshEntry];
      });

      try {
        const store = getContextStore();
        const existing = store.load();
        const generator = new ContextGenerator();
        const result = await generator.generate();

        if (result.success && result.memory) {
          const memory = result.memory;
          const hasChanges = !existing.success ||
            existing.data.content_hash !== memory.content_hash;

          if (hasChanges) {
            const saveResult = store.save(memory);
            if (saveResult.success) {
              // Update the specific entry by index to avoid race conditions
              setChatHistory((prev) => {
                const updated = [...prev];
                if (entryIndex >= 0 && entryIndex < updated.length) {
                  updated[entryIndex] = {
                    type: "assistant",
                    content: `✅ Memory updated (${memory.context.token_estimate.toLocaleString()} tokens)`,
                    timestamp: new Date(),
                  };
                }
                return updated;
              });

              // Trigger toast notification
              onMemoryRefreshed?.();
            } else {
              throw new Error(saveResult.error);
            }
          } else {
            // Update the specific entry by index to avoid race conditions
            setChatHistory((prev) => {
              const updated = [...prev];
              if (entryIndex >= 0 && entryIndex < updated.length) {
                updated[entryIndex] = {
                  type: "assistant",
                  content: `✅ No changes detected - memory is up to date`,
                  timestamp: new Date(),
                };
              }
              return updated;
            });
          }
        } else {
          throw new Error(result.error);
        }
      } catch (error: unknown) {
        const errorMessage = extractErrorMessage(error);
        // Update the specific entry by index to avoid race conditions
        setChatHistory((prev) => {
          const updated = [...prev];
          if (entryIndex >= 0 && entryIndex < updated.length) {
            updated[entryIndex] = {
              type: "assistant",
              content: `❌ Failed to refresh memory: ${errorMessage}`,
              timestamp: new Date(),
            };
          }
          return updated;
        });
      }

      setIsProcessing(false);
      clearInput();
      return true;
    }

    // Theme command
    if (trimmedInput === "/theme" || trimmedInput.startsWith("/theme ")) {
      try {
        // Convert to lowercase for case-insensitive theme name matching
        const arg = trimmedInput.substring(7).trim().toLowerCase();
        const settings = getSettingsManager();
        const { getAllThemes, isValidTheme } = await import("../themes/index.js");
        const { clearThemeCache } = await import("../utils/colors.js");
        const allThemes = getAllThemes();

        if (!arg || arg === "list") {
          // Show current theme and list available themes
          const uiConfig = settings.getUIConfig();
          const currentTheme = (uiConfig && uiConfig.theme) ? uiConfig.theme : 'default';
          let themeContent = "🎨 **Color Themes**\n\n";
          themeContent += `**Current theme:** ${currentTheme}\n\n`;
          themeContent += "**Available themes:**\n";
          for (const theme of allThemes) {
            const isCurrent = theme.name === currentTheme ? " ✓" : "";
            themeContent += `   • \`${theme.name}\` - ${theme.description}${isCurrent}\n`;
          }
          themeContent += "\n**Usage:** `/theme <name>` to switch themes";

          const themeEntry: ChatEntry = {
            type: "assistant",
            content: themeContent,
            timestamp: new Date(),
          };
          setChatHistory((prev) => [...prev, themeEntry]);
          clearInput();
          return true;
        }

        // Set a specific theme
        if (isValidTheme(arg)) {
          settings.updateUIConfig({ theme: arg });
          clearThemeCache(); // Clear cached theme colors

          const selectedTheme = allThemes.find(t => t.name === arg);
          const themeEntry: ChatEntry = {
            type: "assistant",
            content: `✅ Theme changed to **${selectedTheme?.displayName}** (${selectedTheme?.description}).\n\n💡 The new theme will be applied to UI elements.`,
            timestamp: new Date(),
          };
          setChatHistory((prev) => [...prev, themeEntry]);
          clearInput();
          return true;
        } else {
          // Invalid theme name
          const themeEntry: ChatEntry = {
            type: "assistant",
            content: `❌ Unknown theme: \`${arg}\`\n\nAvailable themes: ${allThemes.map(t => t.name).join(", ")}`,
            timestamp: new Date(),
          };
          setChatHistory((prev) => [...prev, themeEntry]);
          clearInput();
          return true;
        }
      } catch (error) {
        const errorMessage = extractErrorMessage(error);
        const errorEntry: ChatEntry = {
          type: "assistant",
          content: `❌ Failed to process theme command: ${errorMessage}`,
          timestamp: new Date(),
        };
        setChatHistory((prev) => [...prev, errorEntry]);
        clearInput();
        return true;
      }
    }

    // Background task commands
    if (trimmedInput === "/tasks") {
      const bashOutputTool = new BashOutputTool();
      const result = bashOutputTool.listTasks();
      const tasksEntry: ChatEntry = {
        type: "assistant",
        content: result.output || "No background tasks",
        timestamp: new Date(),
      };
      setChatHistory((prev) => [...prev, tasksEntry]);
      clearInput();
      return true;
    }

    if (trimmedInput.startsWith("/task ")) {
      const taskId = trimmedInput.substring(6).trim();
      if (!taskId) {
        const errorEntry: ChatEntry = {
          type: "assistant",
          content: "Usage: /task <task_id>",
          timestamp: new Date(),
        };
        setChatHistory((prev) => [...prev, errorEntry]);
        clearInput();
        return true;
      }

      const bashOutputTool = new BashOutputTool();
      const result = await bashOutputTool.execute(taskId);
      const taskEntry: ChatEntry = {
        type: "assistant",
        content: result.success ? result.output || "No output" : result.error || "Task not found",
        timestamp: new Date(),
      };
      setChatHistory((prev) => [...prev, taskEntry]);
      clearInput();
      return true;
    }

    if (trimmedInput.startsWith("/kill ")) {
      const taskId = trimmedInput.substring(6).trim();
      if (!taskId) {
        const errorEntry: ChatEntry = {
          type: "assistant",
          content: "Usage: /kill <task_id>",
          timestamp: new Date(),
        };
        setChatHistory((prev) => [...prev, errorEntry]);
        clearInput();
        return true;
      }

      const bashOutputTool = new BashOutputTool();
      const result = bashOutputTool.killTask(taskId);
      const killEntry: ChatEntry = {
        type: "assistant",
        content: result.success ? result.output || "Task killed" : result.error || "Failed to kill task",
        timestamp: new Date(),
      };
      setChatHistory((prev) => [...prev, killEntry]);
      clearInput();
      return true;
    }

    if (trimmedInput === "/rewind") {
      await handleRewindCommand(agent);
      clearInput();
      return true;
    }

    if (trimmedInput === "/checkpoints") {
      await handleCheckpointsCommand();
      clearInput();
      return true;
    }

    if (trimmedInput === "/checkpoint-clean") {
      await handleCheckpointCleanCommand();
      clearInput();
      return true;
    }

    // Plan commands
    if (trimmedInput === "/plans") {
      const result = await handlePlansCommand();
      const plansEntry: ChatEntry = {
        type: "assistant",
        content: result.output,
        timestamp: new Date(),
      };
      setChatHistory((prev) => [...prev, plansEntry]);
      clearInput();
      return true;
    }

    if (trimmedInput === "/plan" || trimmedInput.startsWith("/plan ")) {
      const planId = trimmedInput === "/plan" ? undefined : trimmedInput.substring(6).trim();
      const result = await handlePlanCommand(planId || undefined);
      const planEntry: ChatEntry = {
        type: "assistant",
        content: result.output,
        timestamp: new Date(),
      };
      setChatHistory((prev) => [...prev, planEntry]);
      clearInput();
      return true;
    }

    if (trimmedInput === "/phases") {
      const result = await handlePhasesCommand();
      const phasesEntry: ChatEntry = {
        type: "assistant",
        content: result.output,
        timestamp: new Date(),
      };
      setChatHistory((prev) => [...prev, phasesEntry]);
      clearInput();
      return true;
    }

    if (trimmedInput === "/pause") {
      const result = await handlePauseCommand();
      const pauseEntry: ChatEntry = {
        type: "assistant",
        content: result.output,
        timestamp: new Date(),
      };
      setChatHistory((prev) => [...prev, pauseEntry]);
      clearInput();
      return true;
    }

    if (trimmedInput === "/resume" || trimmedInput.startsWith("/resume ")) {
      const planId = trimmedInput === "/resume" ? undefined : trimmedInput.substring(8).trim();
      const result = await handleResumeCommand(planId || undefined);
      const resumeEntry: ChatEntry = {
        type: "assistant",
        content: result.output,
        timestamp: new Date(),
      };
      setChatHistory((prev) => [...prev, resumeEntry]);
      clearInput();
      return true;
    }

    if (trimmedInput === "/skip") {
      const result = await handleSkipPhaseCommand();
      const skipEntry: ChatEntry = {
        type: "assistant",
        content: result.output,
        timestamp: new Date(),
      };
      setChatHistory((prev) => [...prev, skipEntry]);
      clearInput();
      return true;
    }

    if (trimmedInput === "/abandon") {
      const result = await handleAbandonCommand();
      const abandonEntry: ChatEntry = {
        type: "assistant",
        content: result.output,
        timestamp: new Date(),
      };
      setChatHistory((prev) => [...prev, abandonEntry]);
      clearInput();
      return true;
    }

    if (trimmedInput === "/resumable") {
      const result = await handleResumableCommand();
      const resumableEntry: ChatEntry = {
        type: "assistant",
        content: result.output,
        timestamp: new Date(),
      };
      setChatHistory((prev) => [...prev, resumableEntry]);
      clearInput();
      return true;
    }

    if (trimmedInput === "/commit-and-push") {
      const userEntry: ChatEntry = {
        type: "user",
        content: "/commit-and-push",
        timestamp: new Date(),
      };
      setChatHistory((prev) => [...prev, userEntry]);

      setIsProcessing(true);
      setIsStreaming(true);

      try {
        // First check if there are any changes at all
        const initialStatusResult = await agent.executeBashCommand(
          "git status --porcelain"
        );

        if (
          !initialStatusResult.success ||
          !initialStatusResult.output?.trim()
        ) {
          const noChangesEntry: ChatEntry = {
            type: "assistant",
            content: "No changes to commit. Working directory is clean.",
            timestamp: new Date(),
          };
          setChatHistory((prev) => [...prev, noChangesEntry]);
          setIsProcessing(false);
          setIsStreaming(false);
          setInput("");
          return true;
        }

        // Add all changes
        const addResult = await agent.executeBashCommand("git add .");

        if (!addResult.success) {
          const addErrorEntry: ChatEntry = {
            type: "assistant",
            content: `Failed to stage changes: ${
              addResult.error || "Unknown error"
            }`,
            timestamp: new Date(),
          };
          setChatHistory((prev) => [...prev, addErrorEntry]);
          setIsProcessing(false);
          setIsStreaming(false);
          setInput("");
          return true;
        }

        // Show that changes were staged
        const addEntry: ChatEntry = {
          type: "tool_result",
          content: "Changes staged successfully",
          timestamp: new Date(),
          toolCall: {
            id: `git_add_${Date.now()}`,
            type: "function",
            function: {
              name: "bash",
              arguments: JSON.stringify({ command: "git add ." }),
            },
          },
          toolResult: addResult,
        };
        setChatHistory((prev) => [...prev, addEntry]);

        // Get staged changes for commit message generation
        const diffResult = await agent.executeBashCommand("git diff --cached");

        // Generate commit message using AI
        const commitPrompt = `Generate a concise, professional git commit message for these changes:

Git Status:
${initialStatusResult.output}

Git Diff (staged changes):
${diffResult.output || "No staged changes shown"}

Follow conventional commit format (feat:, fix:, docs:, etc.) and keep it under 72 characters.
Respond with ONLY the commit message, no additional text.`;

        let commitMessage = "";
        let streamingEntry: ChatEntry | null = null;

        for await (const chunk of agent.processUserMessageStream(
          commitPrompt
        )) {
          if (chunk.type === "content" && chunk.content) {
            if (!streamingEntry) {
              const newEntry = {
                type: "assistant" as const,
                content: `Generating commit message...\n\n${chunk.content}`,
                timestamp: new Date(),
                isStreaming: true,
              };
              setChatHistory((prev) => [...prev, newEntry]);
              streamingEntry = newEntry;
              commitMessage = chunk.content;
            } else {
              commitMessage += chunk.content;
              setChatHistory((prev) =>
                prev.map((entry, idx) =>
                  idx === prev.length - 1 && entry.isStreaming
                    ? {
                        ...entry,
                        content: `Generating commit message...\n\n${commitMessage}`,
                      }
                    : entry
                )
              );
            }
          } else if (chunk.type === "done") {
            if (streamingEntry) {
              setChatHistory((prev) =>
                prev.map((entry) =>
                  entry.isStreaming
                    ? {
                        ...entry,
                        content: `Generated commit message: "${commitMessage.trim()}"`,
                        isStreaming: false,
                      }
                    : entry
                )
              );
            }
            break;
          }
        }

        // Execute the commit with properly escaped message to prevent command injection
        const cleanCommitMessage = commitMessage.trim();
        const commitCommand = `git commit -m ${escapeShellArg(cleanCommitMessage)}`;
        const commitResult = await agent.executeBashCommand(commitCommand);

        const commitEntry: ChatEntry = {
          type: "tool_result",
          content: commitResult.success
            ? commitResult.output || "Commit successful"
            : commitResult.error || "Commit failed",
          timestamp: new Date(),
          toolCall: {
            id: `git_commit_${Date.now()}`,
            type: "function",
            function: {
              name: "bash",
              arguments: JSON.stringify({ command: commitCommand }),
            },
          },
          toolResult: commitResult,
        };
        setChatHistory((prev) => [...prev, commitEntry]);

        // If commit was successful, push to remote
        if (commitResult.success) {
          // First try regular push, if it fails try with upstream setup
          let pushResult = await agent.executeBashCommand("git push");
          let pushCommand = "git push";

          if (
            !pushResult.success &&
            pushResult.error?.includes("no upstream branch")
          ) {
            pushCommand = "git push -u origin HEAD";
            pushResult = await agent.executeBashCommand(pushCommand);
          }

          const pushEntry: ChatEntry = {
            type: "tool_result",
            content: pushResult.success
              ? pushResult.output || "Push successful"
              : pushResult.error || "Push failed",
            timestamp: new Date(),
            toolCall: {
              id: `git_push_${Date.now()}`,
              type: "function",
              function: {
                name: "bash",
                arguments: JSON.stringify({ command: pushCommand }),
              },
            },
            toolResult: pushResult,
          };
          setChatHistory((prev) => [...prev, pushEntry]);
        }
      } catch (error: unknown) {
        const errorMessage = extractErrorMessage(error);
        const errorEntry: ChatEntry = {
          type: "assistant",
          content: `Error during commit and push: ${errorMessage}`,
          timestamp: new Date(),
        };
        setChatHistory((prev) => [...prev, errorEntry]);
      }

      setIsProcessing(false);
      setIsStreaming(false);
      clearInput();
      return true;
    }

    // Handle /commands - list all custom commands
    if (trimmedInput === "/commands") {
      const customCmds = customCommandsManager.getAllCommands();
      let content = "**Custom Commands:**\n\n";

      if (customCmds.length === 0) {
        content += "No custom commands found.\n\n";
        content += "Create commands by adding markdown files to:\n";
        content += "  • `.ax-cli/commands/` (project-level)\n";
        content += "  • `~/.ax-cli/commands/` (user-level)\n";
      } else {
        const projectCmds = customCmds.filter((c: CustomCommand) => c.scope === "project");
        const userCmds = customCmds.filter((c: CustomCommand) => c.scope === "user");

        if (projectCmds.length > 0) {
          content += "**Project Commands:**\n";
          for (const cmd of projectCmds) {
            content += `  /${cmd.name} - ${cmd.description}\n`;
          }
          content += "\n";
        }

        if (userCmds.length > 0) {
          content += "**User Commands:**\n";
          for (const cmd of userCmds) {
            content += `  /${cmd.name} - ${cmd.description}\n`;
          }
        }
      }

      const commandsEntry: ChatEntry = {
        type: "assistant",
        content,
        timestamp: new Date(),
      };
      setChatHistory((prev) => [...prev, commandsEntry]);
      clearInput();
      return true;
    }

    // Handle custom commands (starts with / but not a built-in command)
    if (trimmedInput.startsWith("/")) {
      const parts = trimmedInput.slice(1).split(/\s+/);
      const cmdName = parts[0];
      const cmdArgs = parts.slice(1).join(" ");

      if (customCommandsManager.hasCommand(cmdName)) {
        let expandedPrompt = customCommandsManager.expandCommand(cmdName, cmdArgs);
        if (expandedPrompt) {
          // Show what command was invoked
          const userEntry: ChatEntry = {
            type: "user",
            content: trimmedInput,
            timestamp: new Date(),
          };
          setChatHistory((prev) => [...prev, userEntry]);

          // Process the expanded prompt through the agent
          setIsProcessing(true);
          clearInput();

          try {
            // Apply hooks and file mentions to expanded prompt
            const hooksManager = getHooksManager();
            expandedPrompt = await hooksManager.processUserInput(expandedPrompt);

            const fileMentionResult = await parseFileMentions(expandedPrompt, {
              baseDir: process.cwd(),
              maxFileSize: 100 * 1024,
              maxMentions: 10,
              includeContents: true,
            });
            if (fileMentionResult.hasMentions) {
              expandedPrompt = fileMentionResult.expandedInput;
            }

            setIsStreaming(true);
            let streamingEntry: ChatEntry | null = null;

            for await (const chunk of agent.processUserMessageStream(expandedPrompt)) {
              switch (chunk.type) {
                case "content":
                  if (chunk.content) {
                    if (!streamingEntry) {
                      const newEntry: ChatEntry = {
                        type: "assistant",
                        content: chunk.content,
                        timestamp: new Date(),
                        isStreaming: true,
                      };
                      setChatHistory((prev) => [...prev, newEntry]);
                      streamingEntry = newEntry;
                    } else {
                      setChatHistory((prev) =>
                        prev.map((entry, idx) =>
                          idx === prev.length - 1 && entry.isStreaming
                            ? { ...entry, content: entry.content + chunk.content }
                            : entry
                        )
                      );
                    }
                  }
                  break;

                case "token_count":
                  if (chunk.tokenCount !== undefined) {
                    setTokenCount(chunk.tokenCount);
                  }
                  break;

                case "tool_calls":
                  if (chunk.toolCalls) {
                    setChatHistory((prev) =>
                      prev.map((entry) =>
                        entry.isStreaming
                          ? { ...entry, isStreaming: false, toolCalls: chunk.toolCalls }
                          : entry
                      )
                    );
                    streamingEntry = null;

                    chunk.toolCalls.forEach((toolCall) => {
                      const toolCallEntry: ChatEntry = {
                        type: "tool_call",
                        content: "Executing...",
                        timestamp: new Date(),
                        toolCall: toolCall,
                      };
                      setChatHistory((prev) => [...prev, toolCallEntry]);
                    });
                  }
                  break;

                case "tool_result":
                  if (chunk.toolCall && chunk.toolResult) {
                    setChatHistory((prev) =>
                      prev.map((entry) => {
                        if (entry.isStreaming) {
                          return { ...entry, isStreaming: false };
                        }
                        if (
                          entry.type === "tool_call" &&
                          entry.toolCall?.id === chunk.toolCall?.id
                        ) {
                          return {
                            ...entry,
                            type: "tool_result",
                            content: chunk.toolResult?.success
                              ? chunk.toolResult?.output || "Success"
                              : chunk.toolResult?.error || "Error occurred",
                            toolResult: chunk.toolResult,
                            executionDurationMs: chunk.executionDurationMs,
                          };
                        }
                        return entry;
                      })
                    );
                    streamingEntry = null;
                  }
                  break;

                case "done":
                  if (streamingEntry) {
                    setChatHistory((prev) =>
                      prev.map((entry) =>
                        entry.isStreaming ? { ...entry, isStreaming: false } : entry
                      )
                    );
                  }
                  setIsStreaming(false);
                  break;
              }
            }
          } catch (error: unknown) {
            const errorMessage = extractErrorMessage(error);
            const errorEntry: ChatEntry = {
              type: "assistant",
              content: `Error: ${errorMessage}`,
              timestamp: new Date(),
            };
            setChatHistory((prev) => [...prev, errorEntry]);
            setIsStreaming(false);
          }

          setIsProcessing(false);
          return true;
        }
      }
    }

    const directBashCommands = [
      "ls",
      "pwd",
      "cd",
      "cat",
      "mkdir",
      "touch",
      "echo",
      "grep",
      "find",
      "cp",
      "mv",
      "rm",
    ];
    const firstWord = trimmedInput.split(" ")[0];

    if (directBashCommands.includes(firstWord)) {
      const userEntry: ChatEntry = {
        type: "user",
        content: trimmedInput,
        timestamp: new Date(),
      };
      setChatHistory((prev) => [...prev, userEntry]);

      try {
        const result = await agent.executeBashCommand(trimmedInput);

        const commandEntry: ChatEntry = {
          type: "tool_result",
          content: result.success
            ? result.output || "Command completed"
            : result.error || "Command failed",
          timestamp: new Date(),
          toolCall: {
            id: `bash_${Date.now()}`,
            type: "function",
            function: {
              name: "bash",
              arguments: JSON.stringify({ command: trimmedInput }),
            },
          },
          toolResult: result,
        };
        setChatHistory((prev) => [...prev, commandEntry]);
      } catch (error: unknown) {
        const errorMessage = extractErrorMessage(error);
        const errorEntry: ChatEntry = {
          type: "assistant",
          content: `Error executing command: ${errorMessage}`,
          timestamp: new Date(),
        };
        setChatHistory((prev) => [...prev, errorEntry]);
      }

      clearInput();
      return true;
    }

    return false;
  };

  const processUserMessage = async (userInput: string) => {
    const userEntry: ChatEntry = {
      type: "user",
      content: userInput,
      timestamp: new Date(),
    };
    setChatHistory((prev) => [...prev, userEntry]);

    setIsProcessing(true);
    clearInput();

    try {
      // Process UserPromptSubmit hooks (may modify input)
      const hooksManager = getHooksManager();
      let processedInput = await hooksManager.processUserInput(userInput);

      // Check for image references (e.g., @image.png, /path/to/image.png)
      const imageResult = await parseImageInput(processedInput, process.cwd());

      // Show image processing errors if any
      if (imageResult.errors.length > 0) {
        const errorEntry: ChatEntry = {
          type: "assistant",
          content: `⚠️ Image processing warnings:\n${imageResult.errors.map(e => `  - ${e}`).join('\n')}`,
          timestamp: new Date(),
        };
        setChatHistory((prev) => [...prev, errorEntry]);
      }

      // If images found, show info about model switch
      if (imageResult.hasImages) {
        const imageInfo = imageResult.images.map((img, i) =>
          formatAttachmentForDisplay(img, i + 1)
        ).join('\n');

        const infoEntry: ChatEntry = {
          type: "assistant",
          content: `📷 Processing ${imageResult.images.length} image(s):\n${imageInfo}\n\n*Using glm-4.5v for vision analysis*`,
          timestamp: new Date(),
        };
        setChatHistory((prev) => [...prev, infoEntry]);
      }

      // Parse and expand @file mentions (only if no images, to avoid conflicts)
      if (!imageResult.hasImages) {
        const fileMentionResult = await parseFileMentions(processedInput, {
          baseDir: process.cwd(),
          maxFileSize: 100 * 1024, // 100KB limit
          maxMentions: 10,
          includeContents: true,
        });

        // Use expanded input if file mentions were found
        processedInput = fileMentionResult.hasMentions
          ? fileMentionResult.expandedInput
          : processedInput;
      }

      // Agent-First Mode: Check if we should route to an AutomatosX agent
      // Skip for image inputs (not supported by agents) and when disabled
      if (!agentFirstDisabled && !imageResult.hasImages) {
        const settings = getSettingsManager();
        const agentFirstSettings = settings.getAgentFirstSettings();

        if (agentFirstSettings.enabled) {
          // Determine which agent to use
          const selectedAgent = forcedAgent || (() => {
            const routerConfig = {
              enabled: agentFirstSettings.enabled,
              defaultAgent: agentFirstSettings.defaultAgent,
              confidenceThreshold: agentFirstSettings.confidenceThreshold,
              excludedAgents: agentFirstSettings.excludedAgents,
            };
            const routingResult = routeToAgent(processedInput, routerConfig);
            return routingResult.agent;
          })();

          // If an agent is selected, execute via ax run
          if (selectedAgent) {
            onAgentSelected?.(selectedAgent);

            // Add routing info to chat
            const routingEntry: ChatEntry = {
              type: "assistant",
              content: `⚡ Routing to **${selectedAgent}** agent...`,
              timestamp: new Date(),
            };
            setChatHistory((prev) => [...prev, routingEntry]);

            setIsStreaming(true);
            let agentOutput = '';

            try {
              for await (const chunk of executeAgent({
                agent: selectedAgent,
                task: processedInput,
                streaming: true,
              })) {
                switch (chunk.type) {
                  case 'output':
                    if (chunk.content) {
                      agentOutput += chunk.content;
                      // Update the routing entry with accumulated output
                      setChatHistory((prev) =>
                        prev.map((entry, idx) =>
                          idx === prev.length - 1
                            ? { ...entry, content: `⚡ **${selectedAgent}** agent:\n\n${agentOutput}`, isStreaming: true }
                            : entry
                        )
                      );
                    }
                    break;
                  case 'error':
                    if (chunk.content) {
                      agentOutput += `\n⚠️ ${chunk.content}`;
                    }
                    break;
                  case 'done':
                    // Finalize the entry
                    setChatHistory((prev) =>
                      prev.map((entry, idx) =>
                        idx === prev.length - 1
                          ? { ...entry, content: `⚡ **${selectedAgent}** agent:\n\n${agentOutput}`, isStreaming: false }
                          : entry
                      )
                    );
                    break;
                }
              }
              // Agent execution succeeded
              setIsStreaming(false);
              setIsProcessing(false);
              // Keep agent name visible in status bar - don't reset to null
              return; // Agent handled the request
            } catch (agentError) {
              // Agent execution failed, show error and fall through to direct LLM
              const errorMessage = extractErrorMessage(agentError);
              setChatHistory((prev) =>
                prev.map((entry, idx) =>
                  idx === prev.length - 1
                    ? { ...entry, content: `⚡ **${selectedAgent}** agent failed:\n\n❌ ${errorMessage}\n\nFalling back to direct LLM...`, isStreaming: false }
                    : entry
                )
              );
              // Keep agent name visible even on failure (shows which agent was attempted)
              setIsStreaming(false);
              // Fall through to direct LLM processing below
            }
          }
        }
      }

      setIsStreaming(true);
      let streamingEntry: ChatEntry | null = null;

      // Build message content - multimodal if images, otherwise text
      const messageContent = imageResult.hasImages
        ? buildMessageContent(imageResult)
        : processedInput;

      for await (const chunk of agent.processUserMessageStream(messageContent)) {
        switch (chunk.type) {
          case "content":
            if (chunk.content !== undefined) {
              const shouldIgnore = shouldIgnoreContentChunk(chunk.content, !!streamingEntry);
              if (shouldIgnore) {
                break;
              }

              const contentChunk = chunk.content;

              if (!streamingEntry) {
                const newStreamingEntry = {
                  type: "assistant" as const,
                  content: contentChunk,
                  timestamp: new Date(),
                  isStreaming: true,
                };
                setChatHistory((prev) => [...prev, newStreamingEntry]);
                streamingEntry = newStreamingEntry;
              } else {
                setChatHistory((prev) =>
                  prev.map((entry, idx) =>
                    idx === prev.length - 1 && entry.isStreaming
                      ? { ...entry, content: entry.content + contentChunk }
                      : entry
                  )
                );
              }
            }
            break;

          case "token_count":
            if (chunk.tokenCount !== undefined) {
              setTokenCount(chunk.tokenCount);
            }
            break;

          case "tool_calls":
            if (chunk.toolCalls) {
              // Stop streaming for the current assistant message
              setChatHistory((prev) =>
                prev.map((entry) =>
                  entry.isStreaming
                    ? {
                        ...entry,
                        isStreaming: false,
                        toolCalls: chunk.toolCalls,
                      }
                    : entry
                )
              );
              streamingEntry = null;

              // Add individual tool call entries to show tools are being executed
              chunk.toolCalls.forEach((toolCall) => {
                const toolCallEntry: ChatEntry = {
                  type: "tool_call",
                  content: "Executing...",
                  timestamp: new Date(),
                  toolCall: toolCall,
                };
                setChatHistory((prev) => [...prev, toolCallEntry]);
              });
            }
            break;

          case "tool_result":
            if (chunk.toolCall && chunk.toolResult) {
              setChatHistory((prev) =>
                prev.map((entry) => {
                  if (entry.isStreaming) {
                    return { ...entry, isStreaming: false };
                  }
                  // Update the existing tool_call entry with the result
                  if (
                    entry.type === "tool_call" &&
                    entry.toolCall?.id === chunk.toolCall?.id
                  ) {
                    return {
                      ...entry,
                      type: "tool_result",
                      content: chunk.toolResult?.success
                        ? chunk.toolResult?.output || "Success"
                        : chunk.toolResult?.error || "Error occurred",
                      toolResult: chunk.toolResult,
                      executionDurationMs: chunk.executionDurationMs,
                    };
                  }
                  return entry;
                })
              );
              streamingEntry = null;
            }
            break;

          case "done":
            if (streamingEntry) {
              setChatHistory((prev) =>
                prev.map((entry) =>
                  entry.isStreaming ? { ...entry, isStreaming: false } : entry
                )
              );
            }
            setIsStreaming(false);
            break;
        }
      }
    } catch (error: unknown) {
      const errorMessage = extractErrorMessage(error);
      const errorEntry: ChatEntry = {
        type: "assistant",
        content: `Error: ${errorMessage}`,
        timestamp: new Date(),
      };
      setChatHistory((prev) => [...prev, errorEntry]);
      setIsStreaming(false);
    }

    setIsProcessing(false);
    processingStartTime.current = 0;
  };


  return {
    input,
    cursorPosition,
    showCommandSuggestions,
    selectedCommandIndex,
    commandSuggestions,
    resourceSuggestions,
    suggestionMode,
    availableModels,
    agent,
    autoEditEnabled,
    verboseMode,
    verbosityLevel,
    backgroundMode,
    thinkingModeEnabled,
    pastedBlocks,
    currentBlockAtCursor,
    isPasting,
    toggleVerbosity: handleVerboseToggle,
    toggleAutoEdit: toggleAutoEditMode,
    toggleThinkingMode: handleThinkingModeToggle,
    toggleBackgroundMode: handleBackgroundModeToggle,
  };
}

/**
 * Determine whether a streaming content chunk should be ignored.
 * We ignore whitespace-only chunks before any assistant content exists to avoid
 * creating empty assistant messages that break tool grouping.
 */
export function shouldIgnoreContentChunk(content: string | undefined, hasActiveStreamingEntry: boolean): boolean {
  if (hasActiveStreamingEntry) return false;
  return !content || content.trim() === "";
}
